CREATE TABLE "bookings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"trainer_id" integer NOT NULL,
	"date" timestamp NOT NULL,
	"time_slot" varchar(10) NOT NULL,
	"status" varchar(20) DEFAULT 'pending',
	"payment_status" varchar(20) DEFAULT 'unpaid',
	"stripe_session_id" text,
	"expires_at" timestamp,
	"cancellation_reason" text
);
--> statement-breakpoint
CREATE TABLE "onboarding_data" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"goal" text NOT NULL,
	"age" integer NOT NULL,
	"height" integer NOT NULL,
	"weight" integer NOT NULL,
	"activity_level" text NOT NULL,
	"experience_level" text NOT NULL,
	"health_conditions" text NOT NULL,
	"workout_type" text NOT NULL,
	"diet_preference" text NOT NULL,
	CONSTRAINT "onboarding_data_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"trainer_id" integer NOT NULL,
	"rating" integer NOT NULL,
	"comment" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_booking_id_unique" UNIQUE("booking_id")
);
--> statement-breakpoint
CREATE TABLE "specialties" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	CONSTRAINT "specialties_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "trainer_availability" (
	"id" serial PRIMARY KEY NOT NULL,
	"trainer_id" integer NOT NULL,
	"day_of_week" integer NOT NULL,
	"start_time" varchar(10) DEFAULT '08:00' NOT NULL,
	"end_time" varchar(10) DEFAULT '19:00' NOT NULL,
	"is_closed" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trainer_specialties" (
	"id" serial PRIMARY KEY NOT NULL,
	"trainer_id" integer NOT NULL,
	"specialty_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trainer_training_focus" (
	"id" serial PRIMARY KEY NOT NULL,
	"trainer_id" integer NOT NULL,
	"focus_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trainers" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"specialty" text NOT NULL,
	"bio" text NOT NULL,
	"image_url" text,
	"rating" double precision DEFAULT 5,
	"price_per_session" double precision DEFAULT 0 NOT NULL,
	"intensity" integer DEFAULT 3,
	"location" text DEFAULT 'Gym' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_focus" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	CONSTRAINT "training_focus_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"password" text NOT NULL,
	"full_name" text NOT NULL,
	"role" varchar(20) DEFAULT 'user' NOT NULL,
	"image_url" text,
	"onboarding_completed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_trainer_id_trainers_id_fk" FOREIGN KEY ("trainer_id") REFERENCES "public"."trainers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_data" ADD CONSTRAINT "onboarding_data_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_trainer_id_trainers_id_fk" FOREIGN KEY ("trainer_id") REFERENCES "public"."trainers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trainer_availability" ADD CONSTRAINT "trainer_availability_trainer_id_trainers_id_fk" FOREIGN KEY ("trainer_id") REFERENCES "public"."trainers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trainer_specialties" ADD CONSTRAINT "trainer_specialties_trainer_id_trainers_id_fk" FOREIGN KEY ("trainer_id") REFERENCES "public"."trainers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trainer_specialties" ADD CONSTRAINT "trainer_specialties_specialty_id_specialties_id_fk" FOREIGN KEY ("specialty_id") REFERENCES "public"."specialties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trainer_training_focus" ADD CONSTRAINT "trainer_training_focus_trainer_id_trainers_id_fk" FOREIGN KEY ("trainer_id") REFERENCES "public"."trainers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trainer_training_focus" ADD CONSTRAINT "trainer_training_focus_focus_id_training_focus_id_fk" FOREIGN KEY ("focus_id") REFERENCES "public"."training_focus"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trainers" ADD CONSTRAINT "trainers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;