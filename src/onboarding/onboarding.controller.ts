import { Controller, Post, Body, Get, UseGuards, Request, UseInterceptors, UploadedFile } from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { CloudinaryService } from '../trainers/cloudinary.service';
import { AuthService } from '../auth/auth.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('onboarding')
export class OnboardingController {
  constructor(
    private onboardingService: OnboardingService,
    private cloudinaryService: CloudinaryService,
    private authService: AuthService
  ) {}

  @Roles('user')
  @Post()
  save(@Request() req: any, @Body() body: any) {
    return this.onboardingService.save(req.user.userId, body);
  }

  @Roles('user', 'trainer')
  @Get('me')
  async getMe(@Request() req: any) {
    const onboarding = await this.onboardingService.findByUserId(req.user.userId);
    const user = await this.authService.getMe(req.user.userId);
    return { ...onboarding, ...user };
  }

  @Roles('user')
  @Post('me/image')
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(@Request() req: any, @UploadedFile() file: Express.Multer.File) {
    const imageUrl = await this.cloudinaryService.uploadImage(file);
    await this.authService.updateImageUrl(req.user.userId, imageUrl);
    return { imageUrl };
  }
}
