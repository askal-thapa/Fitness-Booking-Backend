import { Module } from '@nestjs/common';
import { StripeService } from './stripe.service';
import { WebhooksController } from './webhooks.controller';
import { BookingService } from '../bookings/booking.service';

@Module({
  providers: [StripeService, BookingService],
  controllers: [WebhooksController],
  exports: [StripeService],
})
export class StripeModule {}
