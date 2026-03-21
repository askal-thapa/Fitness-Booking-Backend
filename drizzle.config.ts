import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';
import { join } from 'path';
dotenv.config({ path: join(process.cwd(), '.env') });

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
