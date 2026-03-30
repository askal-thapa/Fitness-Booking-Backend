import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Stripe } from 'stripe';
const StripeConstructor = require('stripe');

@Injectable()
export class StripeService {
  private stripe?: Stripe;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!apiKey || apiKey.includes('your_key_here')) {
      console.warn('⚠️ STRIPE_SECRET_KEY is missing or invalid. Payments will not function.');
      return;
    }

    try {
      this.stripe = new StripeConstructor(apiKey, {
        apiVersion: '2025-01-27' as any,
      });
    } catch (err) {
      console.error('❌ Failed to initialize Stripe:', (err as any).message);
    }
  }

  async createCheckoutSession(data: {
    bookingId: number;
    amount: number;
    trainerName: string;
    customerEmail: string;
    expiresAt: number; // Unix timestamp
  }) {
    if (!this.stripe) {
      throw new Error('Payment system is not configured. Please contact support.');
    }
    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'gbp',
            product_data: {
              name: `Personal Training Session with ${data.trainerName}`,
              description: `Booking #${data.bookingId}`,
            },
            unit_amount: Math.round(data.amount * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      customer_email: data.customerEmail,
      success_url: `${this.configService.get<string>('FRONTEND_URL')}/dashboard/bookings?success=true&bookingId=${data.bookingId}`,
      cancel_url: `${this.configService.get<string>('FRONTEND_URL')}/dashboard/bookings?cancelled=true`,
      metadata: {
        bookingId: data.bookingId.toString(),
      },
      expires_at: data.expiresAt,
    });

    return session;
  }

  async constructEvent(body: any, signature: string) {
    if (!this.stripe) {
      throw new Error('Payment system is not configured. Webhook could not be verified.');
    }
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
    return this.stripe.webhooks.constructEvent(body, signature, webhookSecret || '');
  }
}
