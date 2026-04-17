import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsArray, IsOptional, IsIn } from 'class-validator';

export class SaveOnboardingDto {
  @ApiProperty({ example: 'Lose weight', description: 'Primary fitness goal' })
  @IsString()
  goal: string;

  @ApiProperty({ example: 28 })
  @IsNumber()
  age: number;

  @ApiProperty({ example: 175, description: 'Height in cm' })
  @IsNumber()
  height: number;

  @ApiProperty({ example: 75, description: 'Weight in kg' })
  @IsNumber()
  weight: number;

  @ApiProperty({
    enum: ['sedentary', 'light', 'moderate', 'active', 'very_active'],
    example: 'moderate',
  })
  @IsIn(['sedentary', 'light', 'moderate', 'active', 'very_active'])
  activityLevel: string;

  @ApiProperty({ enum: ['beginner', 'intermediate', 'advanced'], example: 'beginner' })
  @IsIn(['beginner', 'intermediate', 'advanced'])
  experienceLevel: string;

  @ApiProperty({ example: ['knee pain'], description: 'List of health conditions or injuries' })
  @IsArray()
  healthConditions: string[];

  @ApiProperty({ example: 'Strength', description: 'Preferred workout type' })
  @IsString()
  workoutType: string;

  @ApiPropertyOptional({ example: 'Vegetarian' })
  @IsOptional()
  @IsString()
  dietPreference?: string;
}
