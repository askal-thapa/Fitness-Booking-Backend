import { Controller, Post, Body, Get, Param, UseGuards, Request, Patch } from '@nestjs/common';
import { BookingService } from './booking.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('bookings')
export class BookingController {
  constructor(private bookingService: BookingService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user')
  @Get('my-bookings')
  findByUser(@Request() req: any) {
    return this.bookingService.findByUser(req.user.userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('trainer')
  @Get('my-sessions')
  findByTrainerUser(@Request() req: any) {
    return this.bookingService.findByTrainerUser(req.user.userId);
  }

  // Public endpoint for availability check
  @Get('trainer/:id')
  findByTrainer(@Param('id') id: string) {
    return this.bookingService.findByTrainer(+id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user')
  @Post()
  create(@Request() req: any, @Body() body: any) {
    return this.bookingService.create({
      ...body,
      userId: req.user.userId,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch(':id/status')
  updateStatus(@Request() req: any, @Param('id') id: string, @Body() body: { status: string; reason?: string }) {
    return this.bookingService.updateStatus(+id, req.user.userId, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user')
  @Post(':id/retry-payment')
  retryPayment(@Request() req: any, @Param('id') id: string) {
    return this.bookingService.retryPayment(+id, req.user.userId);
  }
}
