import { Body, Controller, Get, HttpCode, HttpException, Inject, Injectable, Module, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import jwt from 'jsonwebtoken';
import { Prisma } from '@prisma/client';
import { DatabaseService } from './database.js';

const derive = promisify(scrypt);
const cookieName = 'saveme_session';
const duration = 7 * 24 * 60 * 60;
const publicUser = { id: true, name: true, email: true } as const;
function fail(status: number, message: string): never { throw new HttpException({ statusCode: status, message }, status); }
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${(await derive(password, salt, 64) as Buffer).toString('hex')}`;
}
export async function verifyPassword(password: string, hash: string) {
  const [salt, encoded] = hash.split(':');
  const expected = Buffer.from(encoded, 'hex');
  const actual = await derive(password, salt, 64) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

@Injectable()
export class AuthService {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}
  private secret() {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) fail(503, 'Autenticação não configurada no servidor.');
    return secret;
  }
  private credentials(body: unknown, signup = false) {
    if (!body || typeof body !== 'object') fail(400, 'Informe os dados da conta.');
    const { email, password, name } = body as Record<string, unknown>;
    if (typeof email !== 'string' || email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) fail(400, 'Informe um e-mail válido.');
    if (typeof password !== 'string' || password.length < 8 || password.length > 128) fail(400, 'A senha deve ter entre 8 e 128 caracteres.');
    if (signup && (typeof name !== 'string' || !name.trim() || name.trim().length > 100)) fail(400, 'Informe um nome de até 100 caracteres.');
    return { email: email.trim().toLowerCase(), password, name: typeof name === 'string' ? name.trim() : '' };
  }
  async register(body: unknown, res: Response) {
    this.secret();
    const input = this.credentials(body, true);
    try {
      const passwordHash = await hashPassword(input.password);
      const { user, session } = await this.db.$transaction(async tx => {
        const user = await tx.user.create({ data: { name: input.name, email: input.email, passwordHash }, select: publicUser });
        const session = await tx.session.create({ data: { userId: user.id, expiresAt: new Date(Date.now() + duration * 1000) } });
        return { user, session };
      });
      this.setCookie(user.id, session.id, res);
      return { user };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') fail(409, 'Este e-mail já está cadastrado.');
      throw error;
    }
  }
  async login(body: unknown, res: Response) {
    this.secret();
    const input = this.credentials(body);
    const user = await this.db.user.findUnique({ where: { email: input.email } });
    // Executa a derivação também quando o e-mail não existe.
    const valid = await verifyPassword(input.password, user?.passwordHash ?? `${'0'.repeat(32)}:${'0'.repeat(128)}`);
    if (!user || !valid) fail(401, 'E-mail ou senha incorretos.');
    await this.issue(user.id, res);
    return { user: { id: user.id, name: user.name, email: user.email } };
  }
  private cookieOptions() { return { httpOnly: true, secure: process.env.COOKIE_SECURE === 'true', sameSite: 'lax' as const, path: '/api/auth' }; }
  private async issue(userId: string, res: Response) {
    await this.db.session.deleteMany({ where: { userId, expiresAt: { lte: new Date() } } });
    const session = await this.db.session.create({ data: { userId, expiresAt: new Date(Date.now() + duration * 1000) } });
    this.setCookie(userId, session.id, res);
  }
  private setCookie(userId: string, sessionId: string, res: Response) {
    const token = jwt.sign({}, this.secret(), { algorithm: 'HS256', subject: userId, jwtid: sessionId, expiresIn: duration, issuer: 'saveme-api', audience: 'saveme-web' });
    res.cookie(cookieName, token, { ...this.cookieOptions(), maxAge: duration * 1000 });
  }
  private token(req: Request) {
    const token = req.headers.cookie?.split(';').map(part => part.trim()).find(part => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
    if (!token) return null;
    try {
      const payload = jwt.verify(token, this.secret(), { algorithms: ['HS256'], issuer: 'saveme-api', audience: 'saveme-web' });
      return typeof payload === 'object' && typeof payload.jti === 'string' && typeof payload.sub === 'string' ? payload : null;
    } catch { return null; }
  }
  async me(req: Request) {
    const payload = this.token(req);
    if (!payload) fail(401, 'Entre na sua conta para continuar.');
    const session = await this.db.session.findUnique({ where: { id: payload.jti }, include: { user: { select: publicUser } } });
    if (!session || session.userId !== payload.sub || session.expiresAt.getTime() <= Date.now()) fail(401, 'Sua sessão expirou. Entre novamente.');
    return { user: session.user };
  }
  async logout(req: Request, res: Response) {
    const payload = this.token(req);
    if (payload) await this.db.session.deleteMany({ where: { id: payload.jti, userId: payload.sub } });
    res.clearCookie(cookieName, this.cookieOptions());
    return { message: 'Você saiu da sua conta.' };
  }
}

@Controller('auth')
export class AuthController {
  private readonly attempts = new Map<string, { count: number; until: number }>();
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}
  private checkOrigin(req: Request) {
    const allowed = (process.env.AUTH_ORIGINS ?? 'http://127.0.0.1:5173,http://localhost:5173').split(',').map(value => value.trim());
    if (req.headers.origin && !allowed.includes(req.headers.origin)) fail(403, 'Origem não autorizada.');
    if (!req.is('application/json')) fail(415, 'Envie os dados no formato JSON.');
  }
  private limit(req: Request) {
    const now = Date.now();
    for (const [key, entry] of this.attempts) if (entry.until <= now) this.attempts.delete(key);
    const key = req.ip ?? 'unknown';
    const entry = this.attempts.get(key) ?? { count: 0, until: now + 60000 };
    if (entry.count >= 20) fail(429, 'Muitas tentativas. Aguarde um minuto e tente novamente.');
    entry.count++;
    this.attempts.set(key, entry);
  }
  @Post('register') register(@Body() body: unknown, @Req() req: Request, @Res({ passthrough: true }) res: Response) { this.checkOrigin(req); this.limit(req); return this.auth.register(body, res); }
  @Post('login') @HttpCode(200) login(@Body() body: unknown, @Req() req: Request, @Res({ passthrough: true }) res: Response) { this.checkOrigin(req); this.limit(req); return this.auth.login(body, res); }
  @Get('me') me(@Req() req: Request) { return this.auth.me(req); }
  @Post('logout') @HttpCode(200) logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) { this.checkOrigin(req); return this.auth.logout(req, res); }
}

@Module({ controllers: [AuthController], providers: [DatabaseService, AuthService] })
export class AuthModule {}
