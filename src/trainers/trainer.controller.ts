import { Controller, Get, Param, UseGuards, Request, Put, Body, Query, Post, UseInterceptors, UploadedFile } from '@nestjs/common';
import { TrainerService } from './trainer.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { CloudinaryService } from './cloudinary.service';

@Controller('trainers')
export class TrainerController {
  constructor(
    private trainerService: TrainerService,
    private cloudinaryService: CloudinaryService
  ) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('trainer')
  @Get('me')
  getMe(@Request() req: any) {
    return this.trainerService.getMe(req.user.userId);
  }

  @Get()
  findAll(@Query() query: any) {
    return this.trainerService.findAll(query);
  }

  @UseGuards(JwtAuthGuard)
  @Get('recommended')
  findRecommended(@Request() req: any) {
    return this.trainerService.findRecommended(req.user.userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.trainerService.findOne(+id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user')
  @Post('review')
  submitReview(@Request() req: any, @Body() body: any) {
    return this.trainerService.submitReview(req.user.userId, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('trainer')
  @Put('me/availability')
  updateAvailability(@Request() req: any, @Body() body: any[]) {
    return this.trainerService.updateAvailability(req.user.userId, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('trainer')
  @Put('me')
  updateProfile(@Request() req: any, @Body() body: any) {
    return this.trainerService.updateProfile(req.user.userId, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('trainer')
  @Post('me/image')
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(@Request() req: any, @UploadedFile() file: Express.Multer.File) {
    const imageUrl = await this.cloudinaryService.uploadImage(file);
    return this.trainerService.updateProfileImage(req.user.userId, imageUrl);
  }
}
