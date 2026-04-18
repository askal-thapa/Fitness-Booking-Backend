-- Migrate any image stored on trainers into users where the user record has none
UPDATE "users"
SET "image_url" = "trainers"."image_url"
FROM "trainers"
WHERE "trainers"."user_id" = "users"."id"
  AND "users"."image_url" IS NULL
  AND "trainers"."image_url" IS NOT NULL;

--> statement-breakpoint
ALTER TABLE "trainers" DROP COLUMN IF EXISTS "image_url";
