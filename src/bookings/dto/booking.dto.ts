import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsString, IsDateString, IsOptional, IsIn } from 'class-validator';

export class CreateBookingDto {
  @ApiProperty({ example: 3, description: 'Trainer ID to book' })
  @IsNumber()
  trainerId: number;

  @ApiProperty({ example: '2026-04-20', description: 'Session date (YYYY-MM-DD)' })
  @IsDateString()
  date: string;

  @ApiProperty({ example: '10:00', description: 'Time slot (HH:mm)' })
  @IsString()
  timeSlot: string;
}

export class UpdateBookingStatusDto {
  @ApiProperty({ enum: ['pending', 'confirmed', 'cancelled', 'completed'], example: 'cancelled' })
  @IsIn(['pending', 'confirmed', 'cancelled', 'completed'])
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
  timeSlot: string;

  @ApiProperty({ enum: ['pending', 'confirmed', 'cancelled', 'completed'], example: 'pending' })
  status: string;

  @ApiProperty({ enum: ['unpaid', 'paid', 'expired'], example: 'unpaid' })
  paymentStatus: string;

  @ApiPropertyOptional({ example: 'https://checkout.stripe.com/...' })
  checkoutUrl?: string;
}
