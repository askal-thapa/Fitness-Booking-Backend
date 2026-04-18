import { Injectable, forwardRef, Inject } from '@nestjs/common';
import { DrizzleService } from '../db/drizzle.service';
import { onboardingData, users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { AuthService } from '../auth/auth.service';
import { EmbeddingService } from '../embeddings/embedding.service';

@Injectable()
export class OnboardingService {
  constructor(
    private drizzle: DrizzleService,
    private authService: AuthService,
    private embeddings: EmbeddingService,
  ) {}

  // Best-effort: refresh the user's semantic embedding from their current onboarding profile
  private async refreshUserEmbedding(userId: number) {
    try {
      const profile = await this.drizzle.db.query.onboardingData.findFirst({
        where: eq(onboardingData.userId, userId),
      });
      if (!profile) return;

      const text = this.embeddings.userText({
        ...profile,
        healthConditions: (() => {
          try { return JSON.parse(profile.healthConditions || '[]'); } catch { return []; }
        })(),
      });
      const vec = await this.embeddings.embed(text, 'RETRIEVAL_QUERY');
      if (vec) {
        await this.drizzle.db.update(onboardingData).set({ embedding: vec }).where(eq(onboardingData.userId, userId));
      }
    } catch {
      // Best-effort — never block the request
    }
  }

  async save(userId: number, data: any) {
    return await this.drizzle.db.transaction(async (tx) => {
      // Handle Onboarding Data UPSERT
      await tx.insert(onboardingData)
        .values({
          userId,
          goal: data.goal,
          age: data.age,
          height: data.height,
          weight: data.weight,
          activityLevel: data.activityLevel,
          experienceLevel: data.experienceLevel,
          healthConditions: JSON.stringify(data.healthConditions || []),
          workoutType: data.workoutType,
          dietPreference: data.dietPreference,
        })
        .onConflictDoUpdate({
          target: onboardingData.userId,
          set: {
            goal: data.goal,
            age: data.age,
            height: data.height,
            weight: data.weight,
            activityLevel: data.activityLevel,
            experienceLevel: data.experienceLevel,
            healthConditions: JSON.stringify(data.healthConditions || []),
            workoutType: data.workoutType,
            dietPreference: data.dietPreference,
          }
        });

      // Handle Full Name update if provided
      if (data.fullName) {
        await tx.update(users)
          .set({
            fullName: data.fullName,
            onboardingCompleted: true
          })
          .where(eq(users.id, userId));
      } else {
        await tx.update(users)
          .set({ onboardingCompleted: true })
          .where(eq(users.id, userId));
      }

      return { success: true };
    }).then(async (result) => {
      // Refresh embedding outside the transaction (best-effort, non-blocking)
      void this.refreshUserEmbedding(userId);
      return result;
    });
  }

  async findByUserId(userId: number) {
    const result = await this.drizzle.db.query.onboardingData.findFirst({
      where: eq(onboardingData.userId, userId),
    });

    if (result && typeof result.healthConditions === 'string') {
        try {
            result.healthConditions = JSON.parse(result.healthConditions);
        } catch (e) {
            result.healthConditions = [];
        }
    }

    return result;
  }
}
