import { Injectable, OnModuleInit } from '@nestjs/common';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DrizzleService implements OnModuleInit {
  db: any; // Using any for simplicity with complex drizzle types

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const pool = new Pool({
      connectionString: this.configService.get<string>('DATABASE_URL'),
    });
    this.db = drizzle(pool, { schema });
  }
}
