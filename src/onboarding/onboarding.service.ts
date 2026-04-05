import { Injectable, forwardRef, Inject } from '@nestjs/common';
import { DrizzleService } from '../db/drizzle.service';
import { onboardingData, users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class OnboardingService {
  constructor(
    private drizzle: DrizzleService,
    private authService: AuthService
  ) {}

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
