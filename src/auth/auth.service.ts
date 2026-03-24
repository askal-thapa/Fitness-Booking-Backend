import { Injectable, UnauthorizedException, ConflictException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DrizzleService } from '../db/drizzle.service';
import { users, trainers, trainerAvailability } from '../db/schema';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private drizzle: DrizzleService,
    private jwt: JwtService,
  ) {}

  async register(data: any) {
    const existing = await this.drizzle.db.query.users.findFirst({
      where: eq(users.email, data.email),
    });

    if (existing) throw new ConflictException('Email already exists');

    const hashedPassword = await bcrypt.hash(data.password, 10);
    
    const [newUser] = await this.drizzle.db.insert(users).values({
      email: data.email,
      password: hashedPassword,
      fullName: data.fullName,
      role: data.role || 'user',
      onboardingCompleted: false,
    }).returning();

    // If the role is trainer, create a default trainer record
    if (data.role === 'trainer') {
      const [trainer] = await this.drizzle.db.insert(trainers).values({
        userId: newUser.id,
        specialty: 'General Fitness',
        bio: 'Professional trainer at Askal.',
        pricePerSession: 50,
        focus: 'General',
        intensity: 3,
        location: 'Gym',
      }).returning();

      // Set default availability: Mon-Fri 08:00 - 20:00, Sat-Sun closed
      const defaultAvailability = [
        { trainerId: trainer.id, dayOfWeek: 1, startTime: '08:00', endTime: '20:00', isClosed: false },
        { trainerId: trainer.id, dayOfWeek: 2, startTime: '08:00', endTime: '20:00', isClosed: false },
        { trainerId: trainer.id, dayOfWeek: 3, startTime: '08:00', endTime: '20:00', isClosed: false },
        { trainerId: trainer.id, dayOfWeek: 4, startTime: '08:00', endTime: '20:00', isClosed: false },
        { trainerId: trainer.id, dayOfWeek: 5, startTime: '08:00', endTime: '20:00', isClosed: false },
        { trainerId: trainer.id, dayOfWeek: 0, startTime: '09:00', endTime: '17:00', isClosed: true },
        { trainerId: trainer.id, dayOfWeek: 6, startTime: '09:00', endTime: '17:00', isClosed: true },
      ];
      await this.drizzle.db.insert(trainerAvailability).values(defaultAvailability);
    }

    return this.generateToken(newUser);
  }

  async login(data: any) {
    const user = await this.drizzle.db.query.users.findFirst({
      where: eq(users.email, data.email),
    });

    if (!user || !(await bcrypt.compare(data.password, user.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.generateToken(user);
  }

  async getMe(userId: number) {
    const user = await this.drizzle.db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    if (!user) throw new NotFoundException('User not found');
    
    // Don't return password
    const { password, ...result } = user;
    return result;
  }

  async getUserById(userId: number) {
      return this.drizzle.db.query.users.findFirst({
          where: eq(users.id, userId),
      });
  }

  async updateImageUrl(userId: number, imageUrl: string) {
    return this.drizzle.db.update(users)
      .set({ imageUrl })
      .where(eq(users.id, userId))
      .returning();
  }

  async updateFullName(userId: number, fullName: string) {
    return this.drizzle.db.update(users)
      .set({ fullName })
      .where(eq(users.id, userId))
      .returning();
  }

  private generateToken(user: any) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    return {
      access_token: this.jwt.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        imageUrl: user.imageUrl,
        onboardingCompleted: user.onboardingCompleted,
      },
    };
  }
}
