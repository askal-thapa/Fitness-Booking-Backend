import { Controller, Post, Body, Get, UseGuards, Request, UseInterceptors, UploadedFile } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { OnboardingService } from './onboarding.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { CloudinaryService } from '../trainers/cloudinary.service';
import { AuthService } from '../auth/auth.service';
import { SaveOnboardingDto } from './dto/onboarding.dto';

@ApiTags('Onboarding')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('onboarding')
export class OnboardingController {
  constructor(
    private onboardingService: OnboardingService,
    private cloudinaryService: CloudinaryService,
    private authService: AuthService,
  ) {}

  @Roles('user')
  @Post()
  @ApiOperation({ summary: 'Save or update the fitness onboarding profile (user only)' })
  @ApiBody({ type: SaveOnboardingDto })
  @ApiResponse({ status: 201, description: 'Onboarding profile saved. Marks onboardingCompleted = true on the user.' })
  @ApiResponse({ status: 403, description: 'Forbidden — user role required.' })
  save(@Request() req: any, @Body() body: SaveOnboardingDto) {
    return this.onboardingService.save(req.user.userId, body);
  }

  @Roles('user', 'trainer')
  @Get('me')
  @ApiOperation({ summary: 'Get the onboarding profile merged with user account details' })
  @ApiResponse({ status: 200, description: 'Merged onboarding + user object.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async getMe(@Request() req: any) {
    const onboarding = await this.onboardingService.findByUserId(req.user.userId);
    const user = await this.authService.getMe(req.user.userId);
    return { ...onboarding, ...user };
  }

  @Roles('user')
  @Post('me/image')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: "Upload the user's profile photo" })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Profile photo file',
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Image uploaded. Returns the Cloudinary URL.' })
  @ApiResponse({ status: 403, description: 'Forbidden — user role required.' })
  async uploadImage(@Request() req: any, @UploadedFile() file: Express.Multer.File) {
    const imageUrl = await this.cloudinaryService.uploadImage(file);
    await this.authService.updateImageUrl(req.user.userId, imageUrl);
    return { imageUrl };
  }
}
