import { Controller, Post, Body, Get, Param, UseGuards, Request, Patch } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { BookingService } from './booking.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CreateBookingDto, UpdateBookingStatusDto, BookingResponseDto } from './dto/booking.dto';

@ApiTags('Bookings')
@Controller('bookings')
export class BookingController {
  constructor(private bookingService: BookingService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user')
  @Get('my-bookings')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: "Get the authenticated user's booking history" })
  @ApiResponse({ status: 200, description: 'Array of bookings for the current user.', type: [BookingResponseDto] })
  @ApiResponse({ status: 403, description: 'Forbidden — user role required.' })
  findByUser(@Request() req: any) {
    return this.bookingService.findByUser(req.user.userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('trainer')
  @Get('my-sessions')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: "Get all sessions booked with the authenticated trainer" })
  @ApiResponse({ status: 200, description: 'Array of bookings assigned to the current trainer.', type: [BookingResponseDto] })
  @ApiResponse({ status: 403, description: 'Forbidden — trainer role required.' })
  findByTrainerUser(@Request() req: any) {
    return this.bookingService.findByTrainerUser(req.user.userId);
  }

  @Get('trainer/:id')
  @ApiOperation({ summary: "Get all bookings for a specific trainer (public)" })
  @ApiParam({ name: 'id', description: 'Trainer ID', example: 3 })
  @ApiResponse({ status: 200, description: 'Array of bookings for the given trainer.', type: [BookingResponseDto] })
  findByTrainer(@Param('id') id: string) {
    return this.bookingService.findByTrainer(+id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user')
  @Post()
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a new booking and initiate Stripe checkout (user only)' })
  @ApiBody({ type: CreateBookingDto })
  @ApiResponse({ status: 201, description: 'Booking created. Returns booking details with a Stripe checkout URL.', type: BookingResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid request or slot unavailable.' })
  @ApiResponse({ status: 403, description: 'Forbidden — user role required.' })
  create(@Request() req: any, @Body() body: CreateBookingDto) {
    return this.bookingService.create({ ...body, userId: req.user.userId });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch(':id/status')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update booking status (confirm or cancel)' })
  @ApiParam({ name: 'id', description: 'Booking ID', example: 7 })
  @ApiBody({ type: UpdateBookingStatusDto })
  @ApiResponse({ status: 200, description: 'Booking status updated.' })
  @ApiResponse({ status: 404, description: 'Booking not found.' })
  updateStatus(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: UpdateBookingStatusDto,
  ) {
    return this.bookingService.updateStatus(+id, req.user.userId, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user')
  @Post(':id/retry-payment')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Retry Stripe checkout for a pending or expired booking (user only)' })
  @ApiParam({ name: 'id', description: 'Booking ID', example: 7 })
  @ApiResponse({ status: 201, description: 'New Stripe checkout URL returned.' })
  @ApiResponse({ status: 403, description: 'Forbidden — user role required.' })
  @ApiResponse({ status: 404, description: 'Booking not found.' })
  retryPayment(@Request() req: any, @Param('id') id: string) {
    return this.bookingService.retryPayment(+id, req.user.userId);
  }
}
