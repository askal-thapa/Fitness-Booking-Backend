import { Controller, Post, Headers, Req, Res, RawBodyRequest } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiHeader,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { StripeService } from './stripe.service';
import { BookingService } from '../bookings/booking.service';
import { MailService } from '../mail/mail.service';
import { DrizzleService } from '../db/drizzle.service';
import { bookings, trainers, users } from '../db/schema';
import { eq } from 'drizzle-orm';

@ApiTags('Webhooks')
@Controller('webhooks/stripe')
export class WebhooksController {
  constructor(
    private stripeService: StripeService,
    private bookingService: BookingService,
    private mailService: MailService,
    private drizzle: DrizzleService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Receive Stripe webhook events',
    description:
      'Handles `checkout.session.completed` (confirms booking as paid) and `checkout.session.expired` (cancels booking). Requires the raw request body and a valid `stripe-signature` header.',
  })
  @ApiHeader({
    name: 'stripe-signature',
    description: 'Stripe webhook signature for payload verification',
    required: true,
  })
  @ApiResponse({ status: 200, description: 'Event received and processed.' })
  @ApiResponse({ status: 400, description: 'Signature verification failed.' })
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

    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object;
        const bookingId = parseInt(session.metadata.bookingId);
        await this.bookingService.updateStatus(bookingId, null, { status: 'confirmed' });
        console.log(`Payment successful for booking ${bookingId}`);
        // Fire-and-forget confirmation email
        this.sendConfirmationEmail(bookingId).catch(err =>
          console.error('Email send error:', err),
        );
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

  private async sendConfirmationEmail(bookingId: number) {
    const [booking] = await this.drizzle.db
      .select()
      .from(bookings)
      .where(eq(bookings.id, bookingId));
    if (!booking) return;

    const [user] = await this.drizzle.db
      .select()
      .from(users)
      .where(eq(users.id, booking.userId));

    const [trainer] = await this.drizzle.db
      .select()
      .from(trainers)
      .where(eq(trainers.id, booking.trainerId));

    const [trainerUser] = trainer
      ? await this.drizzle.db.select().from(users).where(eq(users.id, trainer.userId))
      : [null];

    if (!user || !trainer || !trainerUser) return;

    await this.mailService.sendBookingConfirmation({
      to: user.email,
      userName: user.fullName,
      trainerName: trainerUser.fullName,
      trainerSpecialty: trainer.specialty,
      date: booking.date,
      timeSlot: booking.timeSlot,
      amount: trainer.pricePerSession,
      bookingId: booking.id,
    });
  }
}
