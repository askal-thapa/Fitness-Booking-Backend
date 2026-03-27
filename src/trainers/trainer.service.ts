import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DrizzleService } from '../db/drizzle.service';
import { trainers, users, trainerAvailability, onboardingData, reviews, bookings, specialties, trainingFocus, trainerSpecialties, trainerTrainingFocus } from '../db/schema';
import { eq, and, sql, avg, count, desc, lt, inArray } from 'drizzle-orm';

@Injectable()
export class TrainerService {
  constructor(private drizzle: DrizzleService) {}

  private async completePastBookings() {
    const now = new Date().toISOString().split('T')[0];
    await this.drizzle.db.update(bookings)
      .set({ status: 'completed' })
      .where(and(
        eq(bookings.status, 'confirmed'),
        lt(bookings.date, now)
      ));
  }

  async getSpecialties() {
    return this.drizzle.db.select().from(specialties).orderBy(specialties.name);
  }

  async getTrainingFocus() {
    return this.drizzle.db.select().from(trainingFocus).orderBy(trainingFocus.name);
  }

  private async attachRelations(trainerList: any[]) {
    if (trainerList.length === 0) return trainerList;

    const trainerIds = trainerList.map(t => t.id);

    // Fetch Specialties
    const specLinks = await this.drizzle.db
      .select({
        trainerId: trainerSpecialties.trainerId,
        name: specialties.name,
      })
      .from(trainerSpecialties)
      .innerJoin(specialties, eq(trainerSpecialties.specialtyId, specialties.id))
      .where(inArray(trainerSpecialties.trainerId, trainerIds));

    // Fetch Training Focus
    const focusLinks = await this.drizzle.db
      .select({
        trainerId: trainerTrainingFocus.trainerId,
        name: trainingFocus.name,
      })
      .from(trainerTrainingFocus)
      .innerJoin(trainingFocus, eq(trainerTrainingFocus.focusId, trainingFocus.id))
      .where(inArray(trainerTrainingFocus.trainerId, trainerIds));

    // Grouping
    const specMap = new Map<number, string[]>();
    specLinks.forEach(l => {
      const arr = specMap.get(l.trainerId) || [];
      arr.push(l.name);
      specMap.set(l.trainerId, arr);
    });

    const focusMap = new Map<number, string[]>();
    focusLinks.forEach(l => {
      const arr = focusMap.get(l.trainerId) || [];
      arr.push(l.name);
      focusMap.set(l.trainerId, arr);
    });

    return trainerList.map(t => ({
      ...t,
      specialties: specMap.get(t.id) || [],
      focus: focusMap.get(t.id) || [],
    }));
  }

  async findAll(filters?: any) {
    await this.completePastBookings();
    const raw = await this.drizzle.db.select({
      id: trainers.id,
      specialty: trainers.specialty,
      bio: trainers.bio,
      imageUrl: trainers.imageUrl,
      rating: trainers.rating,
      name: users.fullName,
      pricePerSession: trainers.pricePerSession,
      intensity: trainers.intensity,
      location: trainers.location,
    })
    .from(trainers)
    .innerJoin(users, eq(trainers.userId, users.id));

    return this.attachRelations(raw);
  }

  // ─── Vector-based Recommendation Engine ───
  // All categories used across the platform for vector dimensions
  private readonly ALL_CATEGORIES = [
    'Weight Loss', 'Muscle Building', 'Endurance', 'Flexibility',
    'Consultant', 'Diet Planner', 'HIIT', 'Strength Training', 'Cardio',
  ];

  // Maps user goals to category relevance weights (0-1)
  private readonly GOAL_VECTORS: Record<string, Record<string, number>> = {
    'lose weight':     { 'Weight Loss': 1.0, 'Endurance': 0.7, 'Cardio': 0.8, 'HIIT': 0.6, 'Diet Planner': 0.9, 'Flexibility': 0.2 },
    'build muscle':    { 'Muscle Building': 1.0, 'Strength Training': 0.9, 'Endurance': 0.4, 'HIIT': 0.5, 'Diet Planner': 0.3 },
    'stay fit':        { 'Endurance': 0.8, 'Flexibility': 0.7, 'Weight Loss': 0.4, 'Muscle Building': 0.4, 'Cardio': 0.6, 'HIIT': 0.5 },
    'improve health':  { 'Flexibility': 0.9, 'Consultant': 0.8, 'Diet Planner': 0.7, 'Endurance': 0.5, 'Cardio': 0.4 },
  };

  // Maps workout types to category relevance weights
  private readonly WORKOUT_VECTORS: Record<string, Record<string, number>> = {
    'gym':  { 'Muscle Building': 0.8, 'Weight Loss': 0.5, 'Endurance': 0.4, 'Strength Training': 0.7, 'HIIT': 0.5 },
    'home': { 'Flexibility': 0.7, 'Endurance': 0.6, 'HIIT': 0.8, 'Cardio': 0.6 },
    'yoga': { 'Flexibility': 1.0, 'Consultant': 0.3 },
  };

  // Maps activity levels to normalized intensity (0-1)
  private readonly ACTIVITY_MAP: Record<string, number> = {
    'sedentary': 0.1, 'lightly active': 0.35, 'active': 0.65, 'very active': 0.9,
  };

  // Maps experience levels to normalized intensity (0-1)
  private readonly EXPERIENCE_MAP: Record<string, number> = {
    'beginner': 0.15, 'intermediate': 0.5, 'advanced': 0.9,
  };

  private buildUserVector(profile: any): number[] {
    const goalKey = profile.goal?.toLowerCase() || '';
    const workoutKey = profile.workoutType?.toLowerCase() || '';
    const goalWeights = this.GOAL_VECTORS[goalKey] || {};
    const workoutWeights = this.WORKOUT_VECTORS[workoutKey] || {};

    // Merge goal + workout vectors (goal weighted 0.6, workout 0.4)
    const merged: Record<string, number> = {};
    for (const cat of this.ALL_CATEGORIES) {
      merged[cat] = (goalWeights[cat] || 0) * 0.6 + (workoutWeights[cat] || 0) * 0.4;
    }

    // Add intensity dimension
    const activityScore = this.ACTIVITY_MAP[profile.activityLevel?.toLowerCase()] || 0.5;
    const experienceScore = this.EXPERIENCE_MAP[profile.experienceLevel?.toLowerCase()] || 0.5;
    const intensityDim = (activityScore * 0.5 + experienceScore * 0.5);

    return [...this.ALL_CATEGORIES.map(c => merged[c] || 0), intensityDim];
  }

  private buildTrainerVector(trainer: any): number[] {
    // Binary presence of each category in focus + specialties (with slight weight boost for focus)
    const combined = new Set([...(trainer.focus || []), ...(trainer.specialties || [])]);
    const focusSet = new Set(trainer.focus || []);

    const categoryDims = this.ALL_CATEGORIES.map(cat => {
      if (focusSet.has(cat)) return 1.0;       // Primary focus = full weight
      if (combined.has(cat)) return 0.7;        // Specialty only = partial weight
      return 0;
    });

    // Intensity dimension normalized to 0-1
    const intensityDim = ((trainer.intensity || 3) - 1) / 4;

    return [...categoryDims, intensityDim];
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0, magA = 0, magB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      magA += a[i] * a[i];
      magB += b[i] * b[i];
    }
    magA = Math.sqrt(magA);
    magB = Math.sqrt(magB);
    if (magA === 0 || magB === 0) return 0;
    return dot / (magA * magB);
  }

  async findRecommended(userId: number) {
    const userProfile = await this.drizzle.db.query.onboardingData.findFirst({
      where: eq(onboardingData.userId, userId),
    });

    if (!userProfile) return this.findAll();

    const allTrainers = await this.findAll();
    const userVector = this.buildUserVector(userProfile);

    const scored = allTrainers.map(trainer => {
      const trainerVector = this.buildTrainerVector(trainer);

      // Core similarity via cosine (0-1), scaled to 0-60
      const similarity = this.cosineSimilarity(userVector, trainerVector);
      let score = similarity * 60;

      // Rating quality bonus (0-10)
      const ratingScore = ((trainer.rating || 5) / 5) * 10;
      score += ratingScore;

      // Goal-category direct overlap bonus (0-20)
      const goalKey = userProfile.goal?.toLowerCase() || '';
      const goalCategories = Object.keys(this.GOAL_VECTORS[goalKey] || {});
      const focusOverlap = (trainer.focus || []).filter(f => goalCategories.includes(f));
      score += focusOverlap.length * 5;

      // Build human-readable match reasons
      const matchReasons: string[] = [];

      if (focusOverlap.length > 0) {
        matchReasons.push(`Specializes in ${focusOverlap.slice(0, 2).join(' & ')}`);
      }

      // Intensity match reason
      const userIntensity = (this.ACTIVITY_MAP[userProfile.activityLevel?.toLowerCase()] || 0.5) * 0.5 +
                            (this.EXPERIENCE_MAP[userProfile.experienceLevel?.toLowerCase()] || 0.5) * 0.5;
      const trainerIntensity = ((trainer.intensity || 3) - 1) / 4;
      if (Math.abs(userIntensity - trainerIntensity) < 0.25) {
        matchReasons.push('Matches your fitness level');
      }

      if (trainer.rating >= 4.5) matchReasons.push('Highly rated');

      const confidencePercent = Math.min(99, Math.round(similarity * 100));

      return {
        ...trainer,
        matchScore: Math.round(score),
        matchReasons,
        matchConfidence: confidencePercent,
      };
    });

    return scored.sort((a, b) => b.matchScore - a.matchScore).slice(0, 4);
  }

  async findOne(id: number) {
    const [trainer] = await this.drizzle.db.select({
      id: trainers.id,
      specialty: trainers.specialty,
      bio: trainers.bio,
      imageUrl: trainers.imageUrl,
      rating: trainers.rating,
      name: users.fullName,
      pricePerSession: trainers.pricePerSession,
      intensity: trainers.intensity,
      location: trainers.location,
    })
    .from(trainers)
    .innerJoin(users, eq(trainers.userId, users.id))
    .where(eq(trainers.id, id));
    
    if (!trainer) throw new NotFoundException('Trainer not found');

    const [withRelations] = await this.attachRelations([trainer]);

    const availability = await this.drizzle.db.select().from(trainerAvailability).where(eq(trainerAvailability.trainerId, id));
    const trainerReviews = await this.drizzle.db.select({
      id: reviews.id,
      rating: reviews.rating,
      comment: reviews.comment,
      userName: users.fullName,
      createdAt: reviews.createdAt,
    })
    .from(reviews)
    .innerJoin(users, eq(reviews.userId, users.id))
    .where(eq(reviews.trainerId, id))
    .orderBy(desc(reviews.createdAt));

    // Get total completed sessions count
    const [sessionStats] = await this.drizzle.db.select({
      totalSessions: count(bookings.id),
    })
    .from(bookings)
    .where(and(
      eq(bookings.trainerId, id),
      sql`${bookings.status} IN ('completed', 'confirmed')`
    ));

    (withRelations as any).availability = availability;
    (withRelations as any).reviews = trainerReviews;
    (withRelations as any).totalSessions = sessionStats?.totalSessions || 0;

    return withRelations;
  }

  async getMe(userId: number) {
    const [trainer] = await this.drizzle.db.select({ id: trainers.id }).from(trainers).where(eq(trainers.userId, userId));
    if (!trainer) throw new NotFoundException('Trainer profile not found');
    return this.findOne(trainer.id);
  }

  async submitReview(userId: number, data: { bookingId: number; rating: number; comment?: string }) {
    const [booking] = await this.drizzle.db.select().from(bookings).where(eq(bookings.id, data.bookingId));
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.userId !== userId) throw new BadRequestException('Not your booking');
    
    const sessionDate = new Date(booking.date);
    if (sessionDate > new Date()) throw new BadRequestException('Cannot review a future session');

    await this.drizzle.db.insert(reviews).values({
      bookingId: data.bookingId,
      userId,
      trainerId: booking.trainerId,
      rating: data.rating,
      comment: data.comment,
    });

    const [avgRating] = await this.drizzle.db.select({
      value: avg(reviews.rating)
    }).from(reviews).where(eq(reviews.trainerId, booking.trainerId));

    await this.drizzle.db.update(trainers)
      .set({ rating: parseFloat(avgRating.value as string) || 5 })
      .where(eq(trainers.id, booking.trainerId));

    return { success: true };
  }

  async updateAvailability(userId: number, availabilityData: any[]) {
    const [trainer] = await this.drizzle.db.select().from(trainers).where(eq(trainers.userId, userId));
    if (!trainer) throw new NotFoundException('Trainer not found');

    await this.drizzle.db.delete(trainerAvailability).where(eq(trainerAvailability.trainerId, trainer.id));

    if (availabilityData.length > 0) {
      const values = availabilityData.map(a => ({
        trainerId: trainer.id,
        dayOfWeek: a.dayOfWeek,
        startTime: a.startTime,
        endTime: a.endTime,
        isClosed: a.isClosed,
      }));
      await this.drizzle.db.insert(trainerAvailability).values(values);
    }

    return this.findOne(trainer.id);
  }

  async updateProfile(userId: number, data: any) {
    const [trainer] = await this.drizzle.db.select().from(trainers).where(eq(trainers.userId, userId));
    if (!trainer) throw new NotFoundException('Trainer not found');

    // Update main profile
    await this.drizzle.db.update(trainers)
      .set({
        specialty: data.specialty,
        bio: data.bio,
        pricePerSession: data.pricePerSession,
        intensity: data.intensity,
        location: data.location,
        imageUrl: data.imageUrl,
      })
      .where(eq(trainers.id, trainer.id));

    // Update Specialties
    if (data.specialties) {
      await this.drizzle.db.delete(trainerSpecialties).where(eq(trainerSpecialties.trainerId, trainer.id));
      const allSpecs = await this.drizzle.db.select().from(specialties);
      const toInsert = allSpecs.filter(s => data.specialties.includes(s.name)).map(s => ({
        trainerId: trainer.id,
        specialtyId: s.id,
      }));
      if (toInsert.length > 0) await this.drizzle.db.insert(trainerSpecialties).values(toInsert);
    }

    // Update Focus
    if (data.focus) {
      await this.drizzle.db.delete(trainerTrainingFocus).where(eq(trainerTrainingFocus.trainerId, trainer.id));
      const allFocus = await this.drizzle.db.select().from(trainingFocus);
      const toInsert = allFocus.filter(f => data.focus.includes(f.name)).map(f => ({
        trainerId: trainer.id,
        focusId: f.id,
      }));
      if (toInsert.length > 0) await this.drizzle.db.insert(trainerTrainingFocus).values(toInsert);
    }

    return this.findOne(trainer.id);
  }

  async updateProfileImage(userId: number, imageUrl: string) {
    const [trainer] = await this.drizzle.db.select().from(trainers).where(eq(trainers.userId, userId));
    if (!trainer) throw new NotFoundException('Trainer not found');

    await this.drizzle.db.update(trainers)
      .set({ imageUrl })
      .where(eq(trainers.id, trainer.id));

    return { imageUrl };
  }
}
