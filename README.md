# Askal Fitness Booking API

REST API backend for the Askal fitness booking platform. Built with NestJS 11, PostgreSQL, Drizzle ORM, Stripe Payments, and Cloudinary.

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
    trainer.service.ts    # Trainer logic + vector-based recommendation engine
    cloudinary.service.ts # Cloudinary image upload wrapper
    dto/trainer.dto.ts    # TrainerQueryDto, UpdateTrainerProfileDto, etc.

  bookings/
    booking.controller.ts # 6 endpoints for booking CRUD + payments
    booking.service.ts    # Full booking lifecycle with 9-step validation
    dto/booking.dto.ts    # CreateBookingDto, UpdateBookingStatusDto

  onboarding/
    onboarding.controller.ts # 3 endpoints for fitness profile
    onboarding.service.ts    # Upsert onboarding data + image upload
    dto/onboarding.dto.ts    # SaveOnboardingDto

  stripe/
    stripe.module.ts       # Stripe module with service + webhook controller
    stripe.service.ts      # Checkout session creation + webhook verification
    webhooks.controller.ts # POST /webhooks/stripe — handles payment events

  db/
    schema.ts        # Complete Drizzle schema (10 tables)
    drizzle.service.ts # PostgreSQL connection pool
    seed.ts          # Database seeding script
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 16+
- Stripe account (test mode)
- Cloudinary account

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
npm run db:seed       # Seed with sample data (optional)
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

---

## Database Schema

### Entity Relationship

```
users (1) ──── (1) onboarding_data
  │
  │ (1:1 for trainers)
  ├──── trainers (1) ──── (N) trainer_availability
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
| `users` | All user accounts | email (unique), password (bcrypt), role (user/trainer), onboardingCompleted |
| `onboarding_data` | Fitness profile (1:1 with users) | goal, age, height, weight, activityLevel, experienceLevel, healthConditions (JSON), workoutType, dietPreference |
| `trainers` | Trainer profiles (1:1 with users) | specialty, bio, imageUrl, rating, pricePerSession, intensity (1-5), location |
| `trainer_availability` | Weekly schedule (1:N with trainers) | dayOfWeek (0=Sun..6=Sat), startTime, endTime, isClosed |
| `bookings` | Session bookings | date, timeSlot, status (pending/confirmed/cancelled/completed), paymentStatus (unpaid/paid/expired), stripeSessionId, expiresAt |
| `reviews` | Session reviews (1:1 with bookings) | rating (1-5), comment |
| `specialties` | Lookup table | name |
| `training_focus` | Lookup table | name |
| `trainer_specialties` | Junction (M:N) | trainerId, specialtyId (cascade delete) |
| `trainer_training_focus` | Junction (M:N) | trainerId, focusId (cascade delete) |

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
| `POST` | `/onboarding` | user | Save/update fitness onboarding profile |
| `GET` | `/onboarding/me` | user, trainer | Get merged onboarding + user data |
| `POST` | `/onboarding/me/image` | user | Upload profile photo (multipart/form-data) |

### Trainers

| Method | Route | Auth | Description |
|---|---|---|---|
| `GET` | `/trainers` | Public | List all trainers with optional filters |
| `GET` | `/trainers/recommended` | JWT | Get AI-recommended trainers based on onboarding profile |
| `GET` | `/trainers/:id` | Public | Get trainer detail with availability, reviews, and session count |
| `GET` | `/trainers/me` | JWT + trainer | Get own trainer profile |
| `POST` | `/trainers/review` | JWT + user | Submit a review for a completed session |
| `PUT` | `/trainers/me` | JWT + trainer | Update trainer profile details |
| `PUT` | `/trainers/me/availability` | JWT + trainer | Update weekly availability schedule |
| `POST` | `/trainers/me/image` | JWT + trainer | Upload trainer profile image |

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

The trainer recommendation system uses a **Content-Based Filtering** approach with **Vector Space Model (VSM)** and **Cosine Similarity** to match users with trainers based on their onboarding profile.

### Model Overview

```
                    User Onboarding Data
                           │
                    ┌──────┴──────┐
                    │             │
              Goal Vector    Workout Vector
              (weight: 0.6)  (weight: 0.4)
                    │             │
                    └──────┬──────┘
                           │
                    Weighted Merge
                           │
                    ┌──────┴──────┐
                    │  10-D User  │
                    │   Vector    │
                    └──────┬──────┘
                           │
                    Cosine Similarity ──── 10-D Trainer Vectors
                           │
                    ┌──────┴──────┐
                    │ Composite   │
                    │   Score     │ = similarity(60%) + rating(10%) + overlap(20%)
                    └──────┬──────┘
                           │
                    Top 4 Ranked Trainers
```

### Mathematical Model

#### Step 1: Feature Space Definition

The system operates in a **10-dimensional feature space** defined by 9 fitness categories plus an intensity dimension:

```
C = {c₁, c₂, ..., c₉, c₁₀}

where:
  c₁  = Weight Loss
  c₂  = Muscle Building
  c₃  = Endurance
  c₄  = Flexibility
  c₅  = Consultant
  c₆  = Diet Planner
  c₇  = HIIT
  c₈  = Strength Training
  c₉  = Cardio
  c₁₀ = Intensity (derived)
```

#### Step 2: User Vector Construction

The user vector **U** is built by combining two sub-vectors with a weighted merge:

```
U = α · G(goal) + β · W(workoutType)     for dimensions c₁..c₉
U₁₀ = (A(activityLevel) + E(experienceLevel)) / 2    for dimension c₁₀

where α = 0.6, β = 0.4
```

**Goal Vectors G(goal):**

| Goal | c₁ | c₂ | c₃ | c₄ | c₅ | c₆ | c₇ | c₈ | c₉ |
|---|---|---|---|---|---|---|---|---|---|
| Lose Weight | 0.9 | 0.2 | 0.5 | 0.3 | 0.2 | 0.6 | 0.7 | 0.3 | 0.8 |
| Build Muscle | 0.2 | 0.9 | 0.4 | 0.2 | 0.1 | 0.4 | 0.5 | 0.9 | 0.3 |
| Stay Fit | 0.4 | 0.4 | 0.7 | 0.6 | 0.3 | 0.3 | 0.5 | 0.5 | 0.7 |
| Improve Health | 0.3 | 0.2 | 0.5 | 0.7 | 0.8 | 0.6 | 0.3 | 0.2 | 0.4 |

**Workout Type Vectors W(workoutType):**

| Workout | c₁ | c₂ | c₃ | c₄ | c₅ | c₆ | c₇ | c₈ | c₉ |
|---|---|---|---|---|---|---|---|---|---|
| Gym | 0.5 | 0.8 | 0.5 | 0.2 | 0.1 | 0.2 | 0.6 | 0.9 | 0.5 |
| Home | 0.6 | 0.4 | 0.5 | 0.7 | 0.3 | 0.3 | 0.8 | 0.3 | 0.7 |
| Yoga | 0.3 | 0.1 | 0.3 | 0.9 | 0.5 | 0.4 | 0.2 | 0.1 | 0.3 |

**Activity Level Mapping A(level):**

| Level | Score |
|---|---|
| sedentary | 0.2 |
| light | 0.4 |
| moderate | 0.6 |
| active | 0.8 |
| very_active | 1.0 |

**Experience Level Mapping E(level):**

| Level | Score |
|---|---|
| beginner | 0.3 |
| intermediate | 0.6 |
| advanced | 0.9 |

#### Step 3: Trainer Vector Construction

For each trainer **T**, the vector is built from their focus areas and specialties:

```
Tᵢ = 1.0   if category cᵢ ∈ trainer.focus
Tᵢ = 0.7   if category cᵢ ∈ trainer.specialties (but not in focus)
Tᵢ = 0.0   otherwise

T₁₀ = (trainer.intensity - 1) / 4     normalized to [0, 1]
```

#### Step 4: Cosine Similarity

The similarity between user vector **U** and trainer vector **T** is computed using cosine similarity:

```
                    n
                   Σ  Uᵢ · Tᵢ
                   i=1
sim(U, T) = ─────────────────────────
              ┌─  n      ┐   ┌─  n      ┐
              │  Σ  Uᵢ²  │ · │  Σ  Tᵢ²  │
              └─ i=1     ─┘   └─ i=1     ─┘

where n = 10 (dimensions)
```

Returns a value in `[0, 1]` where 1 = perfect alignment.

#### Step 5: Composite Scoring

The final score combines three signals:

```
S(U, T) = (sim(U, T) × 60) + R(T) + O(U, T)

where:
  sim(U, T) × 60  = similarity component (0-60 points)
  R(T)             = rating quality bonus (0-10 points)
  O(U, T)          = goal overlap bonus (0-20 points)
```

**Rating Bonus R(T):**
```
R(T) = (trainer.rating / 5) × 10

Example: 4.5 rating → (4.5/5) × 10 = 9.0 points
```

**Goal Overlap Bonus O(U, T):**
```
O(U, T) = (number of matching focus/specialty categories with user's top goal categories / total top categories) × 20

Top categories = categories where G(goal)ᵢ ≥ 0.6
```

#### Step 6: Ranking and Output

```
1. Compute S(U, T) for all trainers T
2. Sort by score descending
3. Select top 4
4. For each trainer, compute:
   - matchScore = S (0-100)
   - matchConfidence = min(S, 99) as percentage
   - matchReasons = human-readable explanation strings
```

### Match Reasons Generation

The system generates contextual reasons for each match:

| Condition | Reason Example |
|---|---|
| Trainer focus overlaps user's goal categories | "Specializes in Weight Loss & Cardio" |
| Intensity difference ≤ 1 | "Matches your fitness level" |
| Rating ≥ 4.5 | "Highly rated (4.8 stars)" |
| Trainer location matches workout type | "Available at Gym" |

### Example Calculation

```
User: goal = "Lose Weight", workout = "Gym", activity = "active", experience = "intermediate"

User Vector:
  c₁..c₉ = 0.6 × G("Lose Weight") + 0.4 × W("Gym")
  c₁  = 0.6(0.9) + 0.4(0.5) = 0.74  (Weight Loss)
  c₂  = 0.6(0.2) + 0.4(0.8) = 0.44  (Muscle Building)
  c₇  = 0.6(0.7) + 0.4(0.6) = 0.66  (HIIT)
  c₈  = 0.6(0.3) + 0.4(0.9) = 0.54  (Strength Training)
  c₉  = 0.6(0.8) + 0.4(0.5) = 0.68  (Cardio)
  c₁₀ = (0.8 + 0.6) / 2 = 0.7       (Intensity)

Trainer A: focus = [Weight Loss, Cardio, HIIT], intensity = 4
  T = [1.0, 0, 0, 0, 0, 0, 1.0, 0, 1.0, 0.75]

Cosine Similarity = dot(U, T) / (||U|| × ||T||)
                  = (0.74×1 + 0.66×1 + 0.68×1 + 0.7×0.75) / (||U|| × ||T||)
                  ≈ 0.87

Score = (0.87 × 60) + (4.5/5 × 10) + (3/3 × 20)
      = 52.2 + 9.0 + 20.0
      = 81.2

matchConfidence: 81%
matchReasons: ["Specializes in Weight Loss & Cardio", "Matches your fitness level"]
```

### Fallback

If the user has no onboarding profile, the system falls back to returning all trainers (unranked).

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

### Onboarding
- `healthConditions` stored as JSON string, parsed on read with fallback to empty array
- Save is idempotent (upsert pattern)
- Sets `onboardingCompleted = true` on the user record within a transaction

### Stripe
- Missing `STRIPE_SECRET_KEY` → service degrades gracefully (warns at startup, throws on checkout attempt)
- Webhook signature verification failure → `400`
- Unhandled webhook events → logged and acknowledged with `200`

### General
- `ValidationPipe` with `whitelist: true` and `forbidNonWhitelisted: true` strips/rejects unknown fields
- `transform: true` converts incoming payloads to DTO instances
- All timestamp columns receive `Date` objects (not strings) for Drizzle ORM compatibility
