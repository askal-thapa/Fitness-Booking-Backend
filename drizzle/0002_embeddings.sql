ALTER TABLE "trainers" ADD COLUMN IF NOT EXISTS "embedding" jsonb;
--> statement-breakpoint
ALTER TABLE "onboarding_data" ADD COLUMN IF NOT EXISTS "embedding" jsonb;
