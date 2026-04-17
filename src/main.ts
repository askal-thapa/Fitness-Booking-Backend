import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  app.enableCors();

  const config = new DocumentBuilder()
    .setTitle('Askal Fitness Booking API')
    .setDescription(
      'REST API for the Askal fitness booking platform. Supports user/trainer authentication, trainer discovery, session booking, Stripe payments, and user onboarding.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' },
      'access-token',
    )
    .addTag('Auth', 'User registration, login, and profile')
    .addTag('Trainers', 'Trainer profiles, availability, and reviews')
    .addTag('Bookings', 'Session booking and payment management')
    .addTag('Onboarding', 'User fitness profile and onboarding')
    .addTag('Webhooks', 'Stripe webhook event handling')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`Backend running on:  http://localhost:${port}`);
  console.log(`Swagger docs at:     http://localhost:${port}/api/docs`);
}
bootstrap();
