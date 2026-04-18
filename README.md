# Askal Fitness Booking API

REST API backend for the Askal fitness booking platform. Built with NestJS 11, PostgreSQL, Drizzle ORM, Stripe Payments, Cloudinary, and Google Gemini Embeddings.

**Live API:** `https://askal.prajwolghimire.com.np`
**Swagger Docs:** `https://askal.prajwolghimire.com.np/api/docs`

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Docker Deployment](#docker-deployment)
- [Environment Variables](#environment-variables)
- [Database Schema](#database-schema)
- [API Endpoints](#api-endpoints)
- [Authentication & Authorization](#authentication--authorization)
- [User Roles & Permissions](#user-roles--permissions)
- [Booking Lifecycle](#booking-lifecycle)
- [Payment Integration (Stripe)](#payment-integration-stripe)
- [Recommendation Engine](#recommendation-engine)
- [Semantic Embeddings](#semantic-embeddings)
- [Edge Cases & Validations](#edge-cases--validations)

---

## Tech Stack

| Technology | Purpose |
|---|---|
| NestJS 11 | Application framework |
| PostgreSQL 16 | Database |
| Drizzle ORM | Type-safe query builder and migrations |
| Passport + JWT | Authentication |
| Stripe | Payment processing |
| Cloudinary | Image upload and CDN |
| Google Gemini (`gemini-embedding-001`) | Semantic embeddings for AI recommendations |
| Docker | Containerization |
| Swagger / OpenAPI | API documentation |
| bcrypt | Password hashing |
| class-validator | DTO validation |

---

## Architecture

```
src/
  app.module.ts          # Root module — wires all dependencies
  app.controller.ts      # Health check endpoints (/ and /health/db)
  main.ts                # Bootstrap — CORS, validation pipe, Swagger setup

  auth/
    auth.controller.ts   # POST /auth/register, POST /auth/login, GET /auth/me
    auth.service.ts      # Registration, login, JWT generation, profile
    jwt.strategy.ts      # Passport JWT strategy
    jwt-auth.guard.ts    # JWT authentication guard
    roles.guard.ts       # Role-based access control guard
    roles.decorator.ts   # @Roles() decorator
    dto/auth.dto.ts      # RegisterDto, LoginDto, AuthResponseDto

  trainers/
    trainer.controller.ts # 8 endpoints for trainer CRUD, search, reviews
    trainer.service.ts    # Trainer logic + blended recommendation engine
    cloudinary.service.ts # Cloudinary image upload wrapper
    dto/trainer.dto.ts    # TrainerQueryDto, UpdateTrainerProfileDto, etc.

  bookings/
    booking.controller.ts # 6 endpoints for booking CRUD + payments
    booking.service.ts    # Full booking lifecycle with 9-step validation
    dto/booking.dto.ts    # CreateBookingDto, UpdateBookingStatusDto

  onboarding/
    onboarding.controller.ts # 3 endpoints for fitness profile
    onboarding.service.ts    # Upsert onboarding data + embedding refresh
    dto/onboarding.dto.ts    # SaveOnboardingDto

  embeddings/
    embedding.service.ts  # Google Gemini embedding API wrapper + cosine similarity + corpus builders

  stripe/
    stripe.module.ts       # Stripe module with service + webhook controller
    stripe.service.ts      # Checkout session creation + webhook verification
    webhooks.controller.ts # POST /webhooks/stripe — handles payment events

  db/
    schema.ts        # Complete Drizzle schema (10 tables + embedding columns)
    drizzle.service.ts # PostgreSQL connection pool
    seed.ts          # Database seeding script (10 trainers, 8 users, pre-computed embeddings)
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 16+
- Stripe account (test mode)
- Cloudinary account
- Google AI API key (for Gemini embeddings — optional, degrades gracefully)

### Installation

```bash
git clone https://github.com/askal-thapa/Fitness-Booking-Backend.git
cd Fitness-Booking-Backend
npm install
```

### Configure Environment

```bash
cp .env.example .env
# Edit .env with your credentials (see Environment Variables section)
```

### Database Setup

```bash
npm run db:generate   # Generate migrations from schema
npm run db:migrate    # Apply migrations to PostgreSQL
npm run db:seed       # Seed with 10 trainers + 8 users (all with embeddings)
```

### Run Development Server

```bash
npm run start:dev     # http://localhost:3001 (watch mode)
```

### Other Commands

```bash
npm run build         # Production build
npm run start:prod    # Run production build
npm run lint          # ESLint (auto-fix)
npm run format        # Prettier
npm run test          # Jest unit tests
npm run test:e2e      # End-to-end tests
```

---

## Docker Deployment

### Build and Run

```bash
docker compose build --no-cache
docker compose up -d
```

### Dockerfile

Multi-stage build:
1. **Builder stage:** Node 20 Alpine, installs all dependencies, compiles TypeScript via `nest build`.
2. **Production stage:** Copies compiled `dist/`, `node_modules`, and `drizzle/` migrations. Runs `node dist/main`.

### docker-compose.yml

Single `api` service:
- Port: `3001`
- Environment variables loaded from `.env`
- Restart policy: `unless-stopped`
- No database service included — connects to an external PostgreSQL instance via `DATABASE_URL`

---

## Environment Variables

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/askal_db` |
| `PORT` | API server port | `3001` |
| `JWT_SECRET` | Secret key for signing JWTs | `my-secret-key-2026` |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name | `dxxxxxx` |
| `CLOUDINARY_API_KEY` | Cloudinary API key | `123456789` |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | `abcdefg` |
| `STRIPE_SECRET_KEY` | Stripe secret key (test or live) | `sk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | `whsec_...` |
| `FRONTEND_URL` | Frontend app URL (for Stripe redirects) | `https://your-frontend.vercel.app` |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Google AI API key for Gemini embeddings | `AIza...` |

> **Note:** `GOOGLE_GENERATIVE_AI_API_KEY` is optional. If omitted, semantic embeddings are skipped and recommendations fall back to the rule-based engine only. The app degrades gracefully with a warning log.

---

## Database Schema

### Entity Relationship

```
users (1) ──── (1) onboarding_data  [embedding: jsonb]
  │
  │ (1:1 for trainers)
  ├──── trainers (1) ──── (N) trainer_availability   [embedding: jsonb]
  │       │
  │       ├──── (M:N) specialties       [via trainer_specialties]
  │       ├──── (M:N) training_focus    [via trainer_training_focus]
  │       └──── (1:N) bookings (1) ──── (1) reviews
  │
  └──── (1:N) bookings
```

### Tables

| Table | Purpose | Key Fields |
|---|---|---|
| `users` | All user accounts | email (unique), password (bcrypt), role (user/trainer), imageUrl, fullName, onboardingCompleted |
| `onboarding_data` | Fitness profile (1:1 with users) | goal, age, height, weight, activityLevel, experienceLevel, healthConditions (JSON), workoutType, dietPreference, **embedding** (jsonb) |
| `trainers` | Trainer profiles (1:1 with users) | specialty, bio, rating, pricePerSession, intensity (1-5), location, **embedding** (jsonb) |
| `trainer_availability` | Weekly schedule (1:N with trainers) | dayOfWeek (0=Sun..6=Sat), startTime, endTime, isClosed |
| `bookings` | Session bookings | date, timeSlot, status (pending/confirmed/cancelled/completed), paymentStatus (unpaid/paid/expired), stripeSessionId, expiresAt |
| `reviews` | Session reviews (1:1 with bookings) | rating (1-5), comment |
| `specialties` | Lookup table | name |
| `training_focus` | Lookup table | name |
| `trainer_specialties` | Junction (M:N) | trainerId, specialtyId (cascade delete) |
| `trainer_training_focus` | Junction (M:N) | trainerId, focusId (cascade delete) |

> **Profile image consolidation:** Trainer profile images are stored in `users.imageUrl` (single source of truth). There is no separate `imageUrl` column on the `trainers` table. This was unified via migration `0001_unify_profile_image.sql`.

### Migrations

| Migration | Description |
|---|---|
| `0001_unify_profile_image.sql` | Copies any trainer-specific imageUrl values to the users table, then drops the redundant column |
| `0002_embeddings.sql` | Adds `embedding jsonb` columns to `trainers` and `onboarding_data` for semantic similarity |

---

## API Endpoints

### Health (Public)

| Method | Route | Description |
|---|---|---|
| `GET` | `/` | API health check — returns `{ status: "ok" }` |
| `GET` | `/health/db` | Database connectivity check — returns server time or error |

### Auth (Public)

| Method | Route | Description |
|---|---|---|
| `POST` | `/auth/register` | Register a new user or trainer account |
| `POST` | `/auth/login` | Login with email/password, returns JWT |
| `GET` | `/auth/me` | Get authenticated user profile (JWT required) |

### Onboarding (JWT Required)

| Method | Route | Role | Description |
|---|---|---|---|
| `POST` | `/onboarding` | user | Save/update fitness onboarding profile (triggers embedding refresh) |
| `GET` | `/onboarding/me` | user, trainer | Get merged onboarding + user data |
| `POST` | `/onboarding/me/image` | user | Upload profile photo (multipart/form-data) |

### Trainers

| Method | Route | Auth | Description |
|---|---|---|---|
| `GET` | `/trainers` | Public | List all trainers with optional filters (price, location, intensity, rating, focus) |
| `GET` | `/trainers/recommended` | JWT | Get AI-recommended trainers (blended semantic + rule-based) |
| `GET` | `/trainers/:id` | Public | Get trainer detail with availability, reviews, and session count |
| `GET` | `/trainers/me` | JWT + trainer | Get own trainer profile |
| `POST` | `/trainers/review` | JWT + user | Submit a review for a completed session |
| `PUT` | `/trainers/me` | JWT + trainer | Update trainer profile details (triggers embedding refresh) |
| `PUT` | `/trainers/me/availability` | JWT + trainer | Update weekly availability schedule |
| `POST` | `/trainers/me/image` | JWT + trainer | Upload trainer profile image (stored to users.imageUrl) |

### Bookings

| Method | Route | Auth | Description |
|---|---|---|---|
| `GET` | `/bookings/my-bookings` | JWT + user | Get user's booking history |
| `GET` | `/bookings/my-sessions` | JWT + trainer | Get trainer's incoming sessions |
| `GET` | `/bookings/trainer/:id` | Public | Get non-cancelled bookings for a trainer (slot availability) |
| `POST` | `/bookings` | JWT + user | Create booking and initiate Stripe checkout |
| `PATCH` | `/bookings/:id/status` | JWT | Update booking status (user or trainer) |
| `POST` | `/bookings/:id/retry-payment` | JWT + user | Retry Stripe checkout for unpaid booking |

### Webhooks

| Method | Route | Auth | Description |
|---|---|---|---|
| `POST` | `/webhooks/stripe` | Stripe signature | Process Stripe payment events |

**Total: 23 endpoints**

---

## Authentication & Authorization

### JWT Flow

1. User registers or logs in via `/auth/register` or `/auth/login`.
2. Backend returns a JWT with payload: `{ sub: userId, email, role }`.
3. JWT is valid for **15 days**.
4. Client sends JWT as `Authorization: Bearer <token>` header on protected requests.
5. `JwtAuthGuard` validates the token and populates `req.user` with `{ userId, email, role }`.
6. `RolesGuard` + `@Roles()` decorator enforces role-based access.

### Password Security

- Passwords are hashed with **bcrypt** (10 salt rounds) before storage.
- Passwords are never returned in API responses.

---

## User Roles & Permissions

### User Role (`role: "user"`)

| Action | Allowed |
|---|---|
| Complete onboarding wizard | Yes |
| Browse and search trainers | Yes |
| View trainer profiles and reviews | Yes |
| Get AI-recommended trainers | Yes |
| Book sessions with trainers | Yes |
| Pay for bookings via Stripe | Yes |
| Retry payment for pending bookings | Yes |
| Cancel own bookings | Yes |
| Submit reviews for completed sessions | Yes |
| View own booking history | Yes |
| Update own profile and photo | Yes |

### Trainer Role (`role: "trainer"`)

| Action | Allowed |
|---|---|
| View and update own trainer profile | Yes |
| Upload trainer profile image | Yes |
| Set weekly availability schedule | Yes |
| View incoming session requests | Yes |
| Accept or decline bookings | Yes |
| View client booking history | Yes |
| Book sessions (as a user) | No |
| Submit reviews | No |

### Registration Behavior

- **User registration:** Creates a `users` record with `role: "user"`, `onboardingCompleted: false`.
- **Trainer registration:** Creates a `users` record with `role: "trainer"`, plus a `trainers` record with defaults (specialty: "General Fitness", price: 50, intensity: 3, location: "Gym"), and 7 availability rows (Mon-Fri 08:00-20:00 open, Sat-Sun closed).

---

## Booking Lifecycle

### Status Flow

```
                  ┌──────────────┐
                  │   PENDING    │ (created, awaiting payment)
                  │ unpaid       │
                  └──────┬───────┘
                         │
            ┌────────────┼────────────┐
            │            │            │
    Payment succeeds  Payment expires  User/Trainer cancels
            │            │            │
            v            v            v
    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
    │  CONFIRMED   │  │  CANCELLED   │  │  CANCELLED   │
    │  paid        │  │  expired     │  │  unpaid      │
    └──────┬───────┘  └──────────────┘  └──────────────┘
           │
    Session date passes
           │
           v
    ┌──────────────┐
    │  COMPLETED   │ → User can now submit a review
    │  paid        │
    └──────────────┘
```

### Booking Creation (9-Step Validation)

1. **User exists** — Validates the JWT user ID against the database. Returns "Please log out and log back in" for stale sessions.
2. **Trainer exists** — Trainer ID must map to a valid trainer record.
3. **Date not in past** — Booking date must be today or later.
4. **Date within 7 days** — Cannot book more than 7 days in advance.
5. **5-hour lead time** — Same-day bookings require at least 5 hours before the slot.
6. **Trainer availability** — Checks the trainer's weekly schedule for the booking day. Validates the slot falls within start/end hours and the day is not closed.
7. **No double-booking** — No other active (non-cancelled) booking exists for the same trainer/date/time.
8. **No user conflict** — The user doesn't already have a booking at the same date/time with any trainer.
9. **Stripe checkout** — Creates a Stripe checkout session (30-min expiry). If Stripe fails, booking is still created without a checkout URL.

### Automatic State Transitions

- **Auto-complete:** Confirmed bookings with a past date are automatically moved to `completed` status when bookings are fetched.
- **Auto-expire:** Pending/unpaid bookings past their `expiresAt` time are automatically cancelled with reason "Payment not completed in time".

---

## Payment Integration (Stripe)

### Checkout Flow

1. User creates a booking → backend creates a Stripe Checkout session.
2. Backend returns `checkoutUrl` → frontend redirects user to Stripe.
3. User completes payment on Stripe's hosted page.
4. Stripe sends `checkout.session.completed` webhook → backend confirms booking and marks as paid.
5. User is redirected to `/dashboard/bookings?success=true`.

### Webhook Events Handled

| Event | Action |
|---|---|
| `checkout.session.completed` | Set booking status to `confirmed`, paymentStatus to `paid` |
| `checkout.session.expired` | Set booking status to `cancelled`, paymentStatus to `expired` |

### Retry Payment

Users can retry payment for pending/unpaid bookings. A new Stripe checkout session is created with fresh expiry times.

### Configuration

- Currency: **GBP**
- Stripe checkout expiry: **30 minutes**
- Internal booking expiry: **15 minutes**
- Booking ID is passed in Stripe session metadata for webhook correlation.

---

## Recommendation Engine

The trainer recommendation system uses a **blended scoring model** combining rule-based vector similarity with semantic embeddings from Google Gemini to match users with trainers.

### Scoring Formula

```
Score(user, trainer) =
    (0.40 × rule_similarity)   +   rule-based 10-D cosine similarity
    (0.30 × semantic_cosine)   +   Gemini embedding cosine similarity
    (0.10 × rating_bonus)      +   normalized trainer rating
    (0.20 × focus_overlap)         shared goal category overlap

Falls back to 0.80 × rule_similarity when no embeddings are stored yet.
```

### Rule-Based Vector Model

The system operates in a **10-dimensional feature space** defined by 9 fitness categories plus an intensity dimension:

```
C = { Weight Loss, Muscle Building, Endurance, Flexibility,
      Consultant, Diet Planner, HIIT, Strength Training, Cardio, Intensity }
```

**User vector** is built from onboarding data:
```
U_categories = 0.6 × Goal_vector(goal) + 0.4 × Workout_vector(workoutType)
U_intensity  = (Activity_score(activityLevel) + Experience_score(experienceLevel)) / 2
```

**Trainer vector** is built from focus areas and specialties:
```
Tᵢ = 1.0   if category cᵢ ∈ trainer.focus
Tᵢ = 0.7   if category cᵢ ∈ trainer.specialties (but not in focus)
Tᵢ = 0.0   otherwise
T_intensity = (trainer.intensity - 1) / 4   normalized to [0, 1]
```

Activity level mapping: `sedentary=0.2 | light=0.4 | moderate=0.6 | active=0.8 | very_active=1.0`

Experience level mapping: `beginner=0.3 | intermediate=0.6 | advanced=0.9`

### Match Reasons Generation

| Condition | Reason Example |
|---|---|
| Trainer focus overlaps user's goal categories | "Specializes in Weight Loss & Cardio" |
| Intensity difference ≤ 1 | "Matches your fitness level" |
| Rating ≥ 4.5 | "Highly rated (4.8 stars)" |
| Semantic score high | "Strong profile alignment" |

### Fallback

If the user has no onboarding profile, the system falls back to returning all trainers unranked. If embeddings are unavailable (no API key), rule-based scoring is doubled (×0.8 weight) to compensate.

---

## Semantic Embeddings

The `EmbeddingService` generates dense vector representations of trainer profiles and user onboarding data using **Google Gemini `gemini-embedding-001`** (3072-dimensional vectors stored as `jsonb`).

### How It Works

1. **Corpus building:** `trainerText()` and `userText()` methods serialize profiles into natural language descriptions optimized for retrieval.
2. **Embedding generation:** Calls `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent` with the appropriate `taskType`.
3. **Storage:** Vectors stored as `jsonb` in `trainers.embedding` and `onboarding_data.embedding`.
4. **Retrieval:** Cosine similarity is computed in-process at query time.

### When Embeddings Are Refreshed

- **Trainers:** After `PUT /trainers/me` (profile update) — fire-and-forget, never blocks the HTTP response.
- **Users:** After `POST /onboarding` (onboarding save) — fire-and-forget, never blocks the HTTP response.
- **Seed:** All 10 trainers and 8 users in `seed.ts` have embeddings pre-computed at seed time.

### Graceful Degradation

- Missing `GOOGLE_GENERATIVE_AI_API_KEY` → logs a warning, skips embedding, falls back to rule-only recommendations.
- API errors → caught silently, embedding column left unchanged.

---

## Edge Cases & Validations

### Authentication
- Duplicate email on registration → `409 Conflict`
- Invalid credentials on login → `401 Unauthorized`
- Stale JWT (user deleted from DB) → `400 Bad Request` with clear "log out and log back in" message
- Password never returned in any API response

### Bookings
- Past date booking → `400 Bad Request`
- Date more than 7 days ahead → `400 Bad Request`
- Same-day without 5hr lead time → `400 Bad Request`
- Trainer not available on that day → `400 Bad Request`
- Slot outside trainer hours → `400 Bad Request`
- Slot already booked → `409 Conflict`
- User already has booking at same time → `409 Conflict`
- Stripe failure → booking created without checkout URL (can retry later)
- Cancel only by booking owner or assigned trainer → `403 Forbidden`

### Trainers
- Review only for own completed bookings → `400 Bad Request`
- Cannot review future sessions → `400 Bad Request`
- Rating recalculated after each new review
- Availability update is full replacement (delete all, insert new)
- `PUT /trainers/me` rejects unknown fields (`forbidNonWhitelisted: true`) — `imageUrl` is submitted separately via `/trainers/me/image`

### Onboarding
- `healthConditions` stored as JSON string, parsed on read with fallback to empty array
- Save is idempotent (upsert pattern)
- Sets `onboardingCompleted = true` on the user record within a transaction
- Embedding refresh runs after the transaction commits (non-blocking)

### Stripe
- Missing `STRIPE_SECRET_KEY` → service degrades gracefully (warns at startup, throws on checkout attempt)
- Webhook signature verification failure → `400`
- Unhandled webhook events → logged and acknowledged with `200`

### General
- `ValidationPipe` with `whitelist: true` and `forbidNonWhitelisted: true` strips/rejects unknown fields
- `transform: true` converts incoming payloads to DTO instances
- All timestamp columns receive `Date` objects (not strings) for Drizzle ORM compatibility
