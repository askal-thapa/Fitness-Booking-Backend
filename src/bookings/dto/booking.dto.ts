import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsString, IsDateString, IsOptional, IsIn } from 'class-validator';

export class CreateBookingDto {
  @ApiProperty({ example: 3, description: 'Trainer ID to book' })
  @IsNumber()
  trainerId: number;

  @ApiProperty({ example: '2026-04-20', description: 'Session date (YYYY-MM-DD)' })
  @IsDateString()
  date: string;

  @ApiProperty({ example: '10:00', description: 'Session start time (HH:mm)' })
  @IsString()
  startTime: string;

  @ApiProperty({ example: '11:00', description: 'Session end time (HH:mm)' })
  @IsString()
  endTime: string;
}

export class UpdateBookingStatusDto {
  @ApiProperty({ enum: ['pending', 'confirmed', 'cancelled'], example: 'cancelled' })
  @IsIn(['pending', 'confirmed', 'cancelled'])
  status: string;

  @ApiPropertyOptional({ example: 'Schedule conflict' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class BookingResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 5 })
  userId: number;

  @ApiProperty({ example: 3 })
  trainerId: number;

  @ApiProperty({ example: '2026-04-20' })
  date: string;

  @ApiProperty({ example: '10:00' })
  startTime: string;

  @ApiProperty({ example: '11:00' })
  endTime: string;

  @ApiProperty({ enum: ['pending', 'confirmed', 'cancelled'], example: 'pending' })
  status: string;

  @ApiPropertyOptional({ example: 'https://checkout.stripe.com/...' })
  checkoutUrl?: string;
}
