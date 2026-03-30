import { Controller, Post, Headers, Req, Res, RawBodyRequest } from '@nestjs/common';
import { Request, Response } from 'express';
import { StripeService } from './stripe.service';
import { BookingService } from '../bookings/booking.service';

@Controller('webhooks/stripe')
export class WebhooksController {
  constructor(
    private stripeService: StripeService,
    private bookingService: BookingService,
  ) {}

  @Post()
  async handleWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() req: RawBodyRequest<Request>,
    @Res() res: Response,
  ) {
    let event;

    try {
      event = await this.stripeService.constructEvent(req.rawBody, signature);
    } catch (err) {
      console.error(`Webhook Error: ${err.message}`);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object;
        const bookingId = parseInt(session.metadata.bookingId);
        
        // Update booking to paid and confirmed
        await this.bookingService.updateStatus(bookingId, null, { status: 'confirmed' });
        
        console.log(`Payment successful for booking ${bookingId}`);
        break;
        
      case 'checkout.session.expired':
        const expiredSession = event.data.object;
        const expiredBookingId = parseInt(expiredSession.metadata.bookingId);
        await this.bookingService.updateStatus(expiredBookingId, null, { status: 'cancelled', reason: 'Payment expired' });
        break;

      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
  }
}
