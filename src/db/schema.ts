import { pgTable, text, serial, integer, timestamp, varchar, boolean, doublePrecision } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: text('password').notNull(),
  fullName: text('full_name').notNull(),
  role: varchar('role', { length: 20 }).notNull().default('user'), // 'user', 'trainer'
  imageUrl: text('image_url'),
  onboardingCompleted: boolean('onboarding_completed').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const onboardingData = pgTable('onboarding_data', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().unique().references(() => users.id),
  goal: text('goal').notNull(),
  age: integer('age').notNull(),
  height: integer('height').notNull(),
  weight: integer('weight').notNull(),
  activityLevel: text('activity_level').notNull(),
  experienceLevel: text('experience_level').notNull(),
  healthConditions: text('health_conditions').notNull(), // JSON string
  workoutType: text('workout_type').notNull(),
  dietPreference: text('diet_preference').notNull(),
});

export const specialties = pgTable('specialties', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
});

export const trainingFocus = pgTable('training_focus', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
});

export const trainers = pgTable('trainers', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  specialty: text('specialty').notNull(), // Display specialty (e.g. "Elite conditioning coach")
  bio: text('bio').notNull(),
  imageUrl: text('image_url'),
  rating: doublePrecision('rating').default(5),
  pricePerSession: doublePrecision('price_per_session').notNull().default(0),
  intensity: integer('intensity').default(3), // 1-5
  location: text('location').notNull().default('Gym'),
});

export const trainerSpecialties = pgTable('trainer_specialties', {
  id: serial('id').primaryKey(),
  trainerId: integer('trainer_id').notNull().references(() => trainers.id, { onDelete: 'cascade' }),
  specialtyId: integer('specialty_id').notNull().references(() => specialties.id, { onDelete: 'cascade' }),
});

export const trainerTrainingFocus = pgTable('trainer_training_focus', {
  id: serial('id').primaryKey(),
  trainerId: integer('trainer_id').notNull().references(() => trainers.id, { onDelete: 'cascade' }),
  focusId: integer('focus_id').notNull().references(() => trainingFocus.id, { onDelete: 'cascade' }),
});

export const trainerAvailability = pgTable('trainer_availability', {
  id: serial('id').primaryKey(),
  trainerId: integer('trainer_id').notNull().references(() => trainers.id),
  dayOfWeek: integer('day_of_week').notNull(), // 0 (Sun) to 6 (Sat)
  startTime: varchar('start_time', { length: 10 }).notNull().default('08:00'),
  endTime: varchar('end_time', { length: 10 }).notNull().default('19:00'),
  isClosed: boolean('is_closed').notNull().default(false),
});

export const bookings = pgTable('bookings', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  trainerId: integer('trainer_id').notNull().references(() => trainers.id),
  date: timestamp('date', { mode: 'string' }).notNull(), // ISO Date string YYYY-MM-DD
  timeSlot: varchar('time_slot', { length: 10 }).notNull(), // e.g. "09:00"
  status: varchar('status', { length: 20 }).default('pending'), // 'pending', 'confirmed', 'cancelled', 'completed'
  paymentStatus: varchar('payment_status', { length: 20 }).default('unpaid'), // 'unpaid', 'paid', 'expired'
  stripeSessionId: text('stripe_session_id'),
  expiresAt: timestamp('expires_at'),
  cancellationReason: text('cancellation_reason'),
});

export const reviews = pgTable('reviews', {
  id: serial('id').primaryKey(),
  bookingId: integer('booking_id').notNull().unique().references(() => bookings.id),
  userId: integer('user_id').notNull().references(() => users.id),
  trainerId: integer('trainer_id').notNull().references(() => trainers.id),
  rating: integer('rating').notNull(),
  comment: text('comment'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
