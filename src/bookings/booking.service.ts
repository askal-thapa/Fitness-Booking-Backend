import { Injectable, NotFoundException, ForbiddenException, ConflictException, BadRequestException } from '@nestjs/common';
import { DrizzleService } from '../db/drizzle.service';
import { bookings, trainers, users, reviews, trainerAvailability } from '../db/schema';
import { eq, and, sql, lt } from 'drizzle-orm';
import { StripeService } from '../stripe/stripe.service';

@Injectable()
export class BookingService {
  constructor(
    private drizzle: DrizzleService,
    private stripeService: StripeService,
  ) {}

  async findByUser(userId: number) {
    // Auto-complete past confirmed bookings
    await this.completePastBookings();
    // Auto-expire old unpaid bookings
    await this.expireOldPendingBookings();

    return this.drizzle.db.select({
      id: bookings.id,
      date: bookings.date,
      timeSlot: bookings.timeSlot,
      status: bookings.status,
      paymentStatus: bookings.paymentStatus,
      expiresAt: bookings.expiresAt,
      cancellationReason: bookings.cancellationReason,
      trainerName: users.fullName,
      trainerSpecialty: trainers.specialty,
      trainerImageUrl: trainers.imageUrl,
      trainerId: bookings.trainerId,
      isReviewed: sql<boolean>`CASE WHEN ${reviews.id} IS NOT NULL THEN true ELSE false END`,
    })
    .from(bookings)
    .innerJoin(trainers, eq(bookings.trainerId, trainers.id))
    .innerJoin(users, eq(trainers.userId, users.id))
    .leftJoin(reviews, eq(bookings.id, reviews.bookingId))
    .where(eq(bookings.userId, userId));
  }

  async findByTrainerUser(userId: number) {
    const [trainer] = await this.drizzle.db.select().from(trainers).where(eq(trainers.userId, userId));
    if (!trainer) return [];

    await this.completePastBookings();

    return this.drizzle.db.select({
      id: bookings.id,
      date: bookings.date,
      timeSlot: bookings.timeSlot,
      status: bookings.status,
      paymentStatus: bookings.paymentStatus,
      expiresAt: bookings.expiresAt,
      cancellationReason: bookings.cancellationReason,
      userName: users.fullName,
      isReviewed: sql<boolean>`CASE WHEN ${reviews.id} IS NOT NULL THEN true ELSE false END`,
    })
    .from(bookings)
    .innerJoin(users, eq(bookings.userId, users.id))
    .leftJoin(reviews, eq(bookings.id, reviews.bookingId))
    .where(eq(bookings.trainerId, trainer.id));
  }

  async findByTrainer(trainerId: number) {
    // Only return active bookings (not cancelled) so cancelled slots show as available
    return this.drizzle.db.select().from(bookings).where(and(
      eq(bookings.trainerId, trainerId),
      sql`${bookings.status} != 'cancelled'`
    ));
  }

  async retryPayment(bookingId: number, userId: number) {
    const [booking] = await this.drizzle.db.select().from(bookings).where(eq(bookings.id, bookingId));
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.userId !== userId) throw new ForbiddenException('Not your booking');
    if (booking.status !== 'pending') throw new BadRequestException('Only pending bookings can be paid');
    if (booking.paymentStatus === 'paid') throw new BadRequestException('Booking is already paid');

    const [trainer] = await this.drizzle.db.select().from(trainers).where(eq(trainers.id, booking.trainerId));
    if (!trainer) throw new NotFoundException('Trainer not found');

    const [user] = await this.drizzle.db.select().from(users).where(eq(users.id, userId));
    if (!user) throw new NotFoundException('User not found');

    const [trainerUser] = await this.drizzle.db.select().from(users).where(eq(users.id, trainer.userId));

    const stripeExpiresAt = Math.floor(Date.now() / 1000) + 30 * 60;
    const internalExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

    const session = await this.stripeService.createCheckoutSession({
      bookingId: booking.id,
      amount: trainer.pricePerSession || 50,
      trainerName: trainerUser?.fullName || 'Professional Trainer',
      customerEmail: user.email,
      expiresAt: stripeExpiresAt,
    });

    await this.drizzle.db.update(bookings)
      .set({
        stripeSessionId: session.id,
        expiresAt: internalExpiresAt.toISOString(),
        paymentStatus: 'unpaid',
      })
      .where(eq(bookings.id, booking.id));

    return { checkoutUrl: session.url };
  }

  async updateStatus(bookingId: number, userId: number | null, data: { status: string; reason?: string }) {
    const [booking] = await this.drizzle.db.select().from(bookings).where(eq(bookings.id, bookingId));

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    let isAuthorized = false;
    if (userId === null) {
      isAuthorized = true; // System/Webhook override
    } else if (booking.userId === userId) {
      isAuthorized = true;
    } else {
      const [trainer] = await this.drizzle.db.select().from(trainers).where(eq(trainers.userId, userId));
      if (trainer && trainer.id === booking.trainerId) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      throw new ForbiddenException('Not authorized to update this booking');
    }

    const updateData: any = {
      status: data.status,
      cancellationReason: data.reason,
    };

    // When confirming via webhook, also mark payment as paid
    if (data.status === 'confirmed' && userId === null) {
      updateData.paymentStatus = 'paid';
    }

    // When cancelling, if payment was expired
    if (data.status === 'cancelled' && data.reason === 'Payment expired') {
      updateData.paymentStatus = 'expired';
    }

    return this.drizzle.db.update(bookings)
      .set(updateData)
      .where(eq(bookings.id, bookingId))
      .returning();
  }

  async create(data: any) {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const maxDate = new Date();
    maxDate.setDate(now.getDate() + 7);
    const maxDateStr = maxDate.toISOString().split('T')[0];

    // 1. Validate date is not in the past
    if (data.date < todayStr) {
      throw new BadRequestException('Cannot book in the past');
    }

    // 2. Validate date is within 7 days
    if (data.date > maxDateStr) {
      throw new BadRequestException('Cannot book more than 7 days in advance');
    }

    // 3. Validate 5-hour lead time for same-day bookings
    if (data.date === todayStr) {
      const currentHour = now.getHours();
      const slotHour = parseInt(data.timeSlot.split(':')[0]);
      if (slotHour < currentHour + 5) {
        throw new BadRequestException('Same-day bookings require at least 5 hours lead time');
      }
    }

    // 4. Validate trainer exists
    const [trainer] = await this.drizzle.db.select().from(trainers).where(eq(trainers.id, data.trainerId));
    if (!trainer) throw new NotFoundException('Trainer not found');

    // 5. Validate slot falls within trainer's availability
    const bookingDate = new Date(data.date);
    const dayOfWeek = bookingDate.getDay();
    const [availability] = await this.drizzle.db.select()
      .from(trainerAvailability)
      .where(and(
        eq(trainerAvailability.trainerId, data.trainerId),
        eq(trainerAvailability.dayOfWeek, dayOfWeek),
      ));

    if (!availability || availability.isClosed) {
      throw new BadRequestException('Trainer is not available on this day');
    }

    const slotHour = parseInt(data.timeSlot.split(':')[0]);
    const startHour = parseInt(availability.startTime.split(':')[0]);
    const endHour = parseInt(availability.endTime.split(':')[0]);

    if (slotHour < startHour || slotHour >= endHour) {
      throw new BadRequestException(`Trainer is only available from ${availability.startTime} to ${availability.endTime} on this day`);
    }

    // 6. Check for double-booking (slot already taken)
    const [existing] = await this.drizzle.db.select().from(bookings).where(and(
      eq(bookings.trainerId, data.trainerId),
      eq(bookings.date, data.date),
      eq(bookings.timeSlot, data.timeSlot),
      sql`${bookings.status} != 'cancelled'`
    ));

    if (existing) {
      throw new ConflictException('This slot is already booked');
    }

    // 7. Check user doesn't have a booking at the same time with another trainer
    const [userConflict] = await this.drizzle.db.select().from(bookings).where(and(
      eq(bookings.userId, data.userId),
      eq(bookings.date, data.date),
      eq(bookings.timeSlot, data.timeSlot),
      sql`${bookings.status} != 'cancelled'`
    ));

    if (userConflict) {
      throw new ConflictException('You already have a booking at this time');
    }

    const [user] = await this.drizzle.db.select().from(users).where(eq(users.id, data.userId));
    if (!user) throw new NotFoundException('User not found');

    // 8. Create the booking
    const [newBooking] = await this.drizzle.db.insert(bookings).values({
      userId: data.userId,
      trainerId: data.trainerId,
      date: data.date,
      timeSlot: data.timeSlot,
      status: 'pending',
      paymentStatus: 'unpaid',
    }).returning();

    // 9. Create Stripe checkout session
    const internalExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const stripeExpiresAt = Math.floor(Date.now() / 1000) + 30 * 60;

    try {
        const [trainerUser] = await this.drizzle.db.select().from(users).where(eq(users.id, trainer.userId));
        const session = await this.stripeService.createCheckoutSession({
            bookingId: newBooking.id,
            amount: trainer.pricePerSession || 50,
            trainerName: trainerUser?.fullName || 'Professional Trainer',
            customerEmail: user.email,
            expiresAt: stripeExpiresAt,
        });

        await this.drizzle.db.update(bookings)
            .set({
                stripeSessionId: session.id,
                expiresAt: internalExpiresAt.toISOString()
            })
            .where(eq(bookings.id, newBooking.id));

        return {
            ...newBooking,
            checkoutUrl: session.url
        };
    } catch (err) {
        console.error("Stripe Session Creation Failed:", err);
        // If Stripe fails, still return booking but without checkout URL
        // This allows the booking to exist for non-Stripe flows or retry
        return newBooking;
    }
  }

  // Auto-complete past confirmed bookings
  private async completePastBookings() {
    const now = new Date().toISOString().split('T')[0];
    await this.drizzle.db.update(bookings)
      .set({ status: 'completed' })
      .where(and(
        eq(bookings.status, 'confirmed'),
        lt(bookings.date, now)
      ));
  }

  // Auto-cancel old unpaid pending bookings (older than 30 minutes)
  private async expireOldPendingBookings() {
    const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    await this.drizzle.db.update(bookings)
      .set({
        status: 'cancelled',
        paymentStatus: 'expired',
        cancellationReason: 'Payment not completed in time',
      })
      .where(and(
        eq(bookings.status, 'pending'),
        eq(bookings.paymentStatus, 'unpaid'),
        sql`${bookings.expiresAt} IS NOT NULL AND ${bookings.expiresAt} < ${cutoff}`
      ));
  }
}
