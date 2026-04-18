import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsBoolean, Min, Max, IsIn, IsArray, IsUrl } from 'class-validator';
import { Type } from 'class-transformer';

export class TrainerQueryDto {
  @ApiPropertyOptional({ example: 'yoga', description: 'Filter by specialty keyword' })
  @IsOptional()
  @IsString()
  specialty?: string;

  @ApiPropertyOptional({ example: 'Gym', description: 'Filter by location' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ example: 50, description: 'Maximum price per session' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxPrice?: number;
}

export class UpdateTrainerProfileDto {
  @ApiPropertyOptional({ example: 'Yoga & Mindfulness' })
  @IsOptional()
  @IsString()
  specialty?: string;

  @ApiPropertyOptional({ example: 'Certified yoga instructor with 5+ years experience.' })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional({ example: 75 })
  @IsOptional()
  @IsNumber()
  pricePerSession?: number;

  @ApiPropertyOptional({ example: ['Flexibility', 'Endurance'], type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  focus?: string[];

  @ApiPropertyOptional({ example: ['Yoga', 'Strength Training'], type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specialties?: string[];

  @ApiPropertyOptional({ example: 2, minimum: 1, maximum: 5 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  intensity?: number;

  @ApiPropertyOptional({ example: 'Studio' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ example: 'https://res.cloudinary.com/.../profile.jpg' })
  @IsOptional()
  @IsUrl({ require_tld: false })
  imageUrl?: string;
}

export class AvailabilitySlotDto {
  @ApiProperty({ example: 1, description: '0 = Sunday, 1 = Monday ... 6 = Saturday' })
  @IsNumber()
  dayOfWeek: number;

  @ApiProperty({ example: '09:00' })
  @IsString()
  startTime: string;

  @ApiProperty({ example: '17:00' })
  @IsString()
  endTime: string;

  @ApiProperty({ example: false })
  @IsBoolean()
  isClosed: boolean;
}

export class SubmitReviewDto {
  @ApiProperty({ example: 7, description: 'Booking ID being reviewed' })
  @IsNumber()
  bookingId: number;

  @ApiProperty({ example: 5, minimum: 1, maximum: 5 })
  @IsNumber()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiPropertyOptional({ example: 'Great session, very professional!' })
  @IsOptional()
  @IsString()
  comment?: string;
}
