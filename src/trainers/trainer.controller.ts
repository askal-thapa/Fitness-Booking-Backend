import { Controller, Get, Param, UseGuards, Request, Put, Body, Query, Post, UseInterceptors, UploadedFile } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiConsumes,
} from '@nestjs/swagger';
import { TrainerService } from './trainer.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { CloudinaryService } from './cloudinary.service';
import {
  TrainerQueryDto,
  UpdateTrainerProfileDto,
  AvailabilitySlotDto,
  SubmitReviewDto,
} from './dto/trainer.dto';

@ApiTags('Trainers')
@Controller('trainers')
export class TrainerController {
  constructor(
    private trainerService: TrainerService,
    private cloudinaryService: CloudinaryService,
  ) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('trainer')
  @Get('me')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: "Get the authenticated trainer's own profile" })
  @ApiResponse({ status: 200, description: 'Trainer profile returned.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden — trainer role required.' })
  getMe(@Request() req: any) {
    return this.trainerService.getMe(req.user.userId);
  }

  @Get()
  @ApiOperation({ summary: 'List all trainers with optional filters' })
  @ApiResponse({ status: 200, description: 'Array of trainer profiles.' })
  findAll(@Query() query: TrainerQueryDto) {
    return this.trainerService.findAll(query);
  }

  @UseGuards(JwtAuthGuard)
  @Get('recommended')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get trainers recommended for the authenticated user based on onboarding data' })
  @ApiResponse({ status: 200, description: 'Array of recommended trainer profiles.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  findRecommended(@Request() req: any) {
    return this.trainerService.findRecommended(req.user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single trainer by ID' })
  @ApiParam({ name: 'id', description: 'Trainer ID', example: 3 })
  @ApiResponse({ status: 200, description: 'Trainer profile with availability and reviews.' })
  @ApiResponse({ status: 404, description: 'Trainer not found.' })
  findOne(@Param('id') id: string) {
    return this.trainerService.findOne(+id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user')
  @Post('review')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Submit a review for a trainer (user only)' })
  @ApiBody({ type: SubmitReviewDto })
  @ApiResponse({ status: 201, description: 'Review submitted.' })
  @ApiResponse({ status: 403, description: 'Forbidden — user role required.' })
  submitReview(@Request() req: any, @Body() body: SubmitReviewDto) {
    return this.trainerService.submitReview(req.user.userId, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('trainer')
  @Put('me/availability')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: "Update the authenticated trainer's weekly availability" })
  @ApiBody({ type: [AvailabilitySlotDto] })
  @ApiResponse({ status: 200, description: 'Availability updated.' })
  @ApiResponse({ status: 403, description: 'Forbidden — trainer role required.' })
  updateAvailability(@Request() req: any, @Body() body: AvailabilitySlotDto[]) {
    return this.trainerService.updateAvailability(req.user.userId, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('trainer')
  @Put('me')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: "Update the authenticated trainer's profile details" })
  @ApiBody({ type: UpdateTrainerProfileDto })
  @ApiResponse({ status: 200, description: 'Profile updated.' })
  @ApiResponse({ status: 403, description: 'Forbidden — trainer role required.' })
  updateProfile(@Request() req: any, @Body() body: UpdateTrainerProfileDto) {
    return this.trainerService.updateProfile(req.user.userId, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('trainer')
  @Post('me/image')
  @UseInterceptors(FileInterceptor('file'))
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: "Upload a profile image for the authenticated trainer" })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Profile image file',
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Image uploaded and profile updated.' })
  @ApiResponse({ status: 403, description: 'Forbidden — trainer role required.' })
  async uploadImage(@Request() req: any, @UploadedFile() file: Express.Multer.File) {
    const imageUrl = await this.cloudinaryService.uploadImage(file);
    return this.trainerService.updateProfileImage(req.user.userId, imageUrl);
  }
}
