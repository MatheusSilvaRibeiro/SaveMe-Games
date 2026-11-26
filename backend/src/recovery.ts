import { Body, Controller, Header, HttpCode, HttpException, Inject, Injectable, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { createHash, randomBytes } from 'node:crypto';
import { DatabaseService } from './database.js';
import { checkWriteOrigin, hashPassword } from './auth.js';

export interface RecoveryMailer {
  configured(): boolean;
  send(email: string, link: string): Promise<void>;
}
export const RECOVERY_MAILER = Symbol('RECOVERY_MAILER');
export class BrevoRecoveryMailer implements RecoveryMailer {
  configured() { return Boolean(process.env.BREVO_API_KEY && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(process.env.MAIL_FROM ?? '') && recoveryOrigin()); }
  async send(email: string, link: string) {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST', signal: AbortSignal.timeout(10000),
      headers: { 'api-key': process.env.BREVO_API_KEY!, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sender: { email: process.env.MAIL_FROM, name: 'SaveMe Games' }, to: [{ email }], subject: 'Redefinir senha - SaveMe Games',
        textContent: `Recebemos uma solicitacao para redefinir sua senha. O link expira em 15 minutos e funciona uma unica vez:\n\n${link}\n\nSe voce nao solicitou, ignore este e-mail. Sua senha permanece igual.` }),
    });
    if (!response.ok) throw new Error('MAIL_DELIVERY_FAILED');
  }
}
function recoveryOrigin() {
  try {
    const url = new URL(process.env.PUBLIC_WEB_URL ?? '');
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname))) return null;
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/') return null;
    return url.origin;
  } catch { return null; }
}
function fail(status: number, message: string): never { throw new HttpException({ statusCode: status, message }, status); }
const acknowledgement = { message: 'Se houver uma conta com este e-mail, enviaremos um link para redefinir a senha.' };
export const resetHash = (token: string) => createHash('sha256').update(token).digest('hex');

@Injectable()
export class RecoveryService {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService, @Inject(RECOVERY_MAILER) private readonly mailer: RecoveryMailer) {}
  async forgot(body: unknown) {
    const input = body as Record<string, unknown> | null;
    if (!input || typeof input.email !== 'string' || Object.keys(input).length !== 1 || input.email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) fail(400, 'Informe um e-mail valido.');
    const origin = recoveryOrigin();
    if (!this.mailer.configured() || !origin) fail(503, 'Recuperacao de senha indisponivel. Tente novamente mais tarde.');
    const email = input.email.trim().toLowerCase();
    const user = await this.db.user.findUnique({ where: { email }, select: { id: true } });
    if (!user) return acknowledgement;
    const token = randomBytes(32).toString('hex'), tokenHash = resetHash(token);
    const created = await this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${user.id}::uuid FOR UPDATE`;
      // Cooldown por conta evita invalidar links em uso ou enviar e-mails em excesso.
      const recent = await tx.passwordResetToken.findFirst({ where: { userId: user.id, createdAt: { gt: new Date(Date.now() - 60000) } } });
      if (recent) return false;
      await tx.passwordResetToken.deleteMany({ where: { userId: user.id } });
      await tx.passwordResetToken.create({ data: { tokenHash, userId: user.id, expiresAt: new Date(Date.now() + 15 * 60000) } });
      return true;
    });
    if (created) {
      try { await this.mailer.send(email, `${origin}/#/redefinir-senha?token=${token}`); }
      catch {
        await this.db.passwordResetToken.deleteMany({ where: { tokenHash } });
        // Nao registra endereco, token, resposta do provedor ou segredos.
        console.error('Password recovery: email delivery failed');
      }
    }
    return acknowledgement;
  }
  async reset(body: unknown) {
    const input = body as Record<string, unknown> | null;
    if (!input || typeof input.token !== 'string' || !/^[a-f0-9]{64}$/.test(input.token) || typeof input.password !== 'string' || input.password.length < 8 || input.password.length > 128 || Object.keys(input).length !== 2) fail(400, 'Informe um link valido e uma senha de 8 a 128 caracteres.');
    const tokenHash = resetHash(input.token);
    const candidate = await this.db.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!candidate || candidate.usedAt || candidate.expiresAt.getTime() <= Date.now()) fail(400, 'Link invalido ou expirado. Solicite outro link.');
    const passwordHash = await hashPassword(input.password);
    await this.db.$transaction(async tx => {
      // A mesma ordem de lock da solicitacao serializa trocas e novos links por conta.
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${candidate.userId}::uuid FOR UPDATE`;
      const consumed = await tx.passwordResetToken.updateMany({ where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
      if (consumed.count !== 1) fail(400, 'Link invalido ou expirado. Solicite outro link.');
      await tx.user.update({ where: { id: candidate.userId }, data: { passwordHash } });
      await tx.session.deleteMany({ where: { userId: candidate.userId } });
      await tx.passwordResetToken.updateMany({ where: { userId: candidate.userId, usedAt: null }, data: { usedAt: new Date() } });
    });
    return { message: 'Senha atualizada. Entre novamente com sua nova senha.' };
  }
}
@Controller('auth')
export class RecoveryController {
  private readonly attempts = new Map<string, { count: number; until: number }>();
  constructor(@Inject(RecoveryService) private readonly service: RecoveryService) {}
  private limit(req: Request) {
    const now = Date.now();
    for (const [key, value] of this.attempts) if (value.until <= now) this.attempts.delete(key);
    const key = req.ip ?? 'unknown';
    const entry = this.attempts.get(key) ?? { count: 0, until: now + 15 * 60000 };
    if (entry.count >= 10) fail(429, 'Muitas tentativas. Aguarde 15 minutos.');
    entry.count++; this.attempts.set(key, entry);
  }
  @Post('forgot-password') @HttpCode(200) @Header('Cache-Control', 'no-store')
  forgot(@Body() body: unknown, @Req() req: Request) { checkWriteOrigin(req); this.limit(req); return this.service.forgot(body); }
  @Post('reset-password') @HttpCode(200) @Header('Cache-Control', 'no-store')
  reset(@Body() body: unknown, @Req() req: Request) { checkWriteOrigin(req); this.limit(req); return this.service.reset(body); }
}
