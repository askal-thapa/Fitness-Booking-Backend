import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { DrizzleService } from './db/drizzle.service';
import { AuthService } from './auth/auth.service';
import { AuthController } from './auth/auth.controller';
import { OnboardingService } from './onboarding/onboarding.service';
import { OnboardingController } from './onboarding/onboarding.controller';
import { TrainerService } from './trainers/trainer.service';
import { TrainerController } from './trainers/trainer.controller';
import { CloudinaryService } from './trainers/cloudinary.service';
import { BookingService } from './bookings/booking.service';
import { BookingController } from './bookings/booking.controller';
import { AppController } from './app.controller';
import { JwtStrategy } from './auth/jwt.strategy';
import { StripeModule } from './stripe/stripe.module';
import { EmbeddingService } from './embeddings/embedding.service';
import { ChatModule } from './chat/chat.module';
import { PushModule } from './push/push.module';

@Global()
@Module({
  providers: [DrizzleService, EmbeddingService],
  exports: [DrizzleService, EmbeddingService],
})
class DbModule {}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    PassportModule,
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET || 'premium-secret-askal-2026',
      signOptions: { expiresIn: '15d' },
    }),
    DbModule,
    StripeModule,
    ChatModule,
    PushModule,
  ],
  controllers: [AppController, AuthController, OnboardingController, TrainerController, BookingController],
  providers: [AuthService, OnboardingService, TrainerService, CloudinaryService, BookingService, JwtStrategy],
})
export class AppModule {}
