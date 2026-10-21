import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class DatabaseService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    super({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000, max: 10 }) });
  }
  async onModuleDestroy() { await this.$disconnect(); }
}
