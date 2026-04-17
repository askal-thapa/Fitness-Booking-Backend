import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { DrizzleService } from './db/drizzle.service';
import { sql } from 'drizzle-orm';

@ApiTags('Health')
@Controller()
export class AppController {
  constructor(private drizzle: DrizzleService) {}

  @Get()
  @ApiOperation({ summary: 'Health check' })
  @ApiResponse({ status: 200, description: 'API is running.' })
  healthCheck() {
    return { status: 'ok', service: 'Askal Fitness Booking API' };
  }

  @Get('health/db')
  @ApiOperation({ summary: 'Database health check' })
  @ApiResponse({ status: 200, description: 'Database is reachable.' })
  @ApiResponse({ status: 503, description: 'Database is unreachable.' })
  async dbHealth() {
    try {
      const result = await this.drizzle.db.execute(sql`SELECT NOW() as time`);
      return { status: 'ok', database: 'connected', serverTime: result.rows[0].time };
    } catch (err) {
      return { status: 'error', database: 'disconnected', message: err.message };
    }
  }
}
