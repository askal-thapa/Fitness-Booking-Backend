import { Module } from '@nestjs/common';
import { StripeService } from './stripe.service';
import { WebhooksController } from './webhooks.controller';
import { BookingService } from '../bookings/booking.service';
import { MailService } from '../mail/mail.service';

@Module({
  providers: [StripeService, BookingService, MailService],
  controllers: [WebhooksController],
  exports: [StripeService],
})
export class StripeModule {}
