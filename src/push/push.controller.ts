import { Body, Controller, Delete, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PushService } from './push.service';

@Controller('push')
@UseGuards(AuthGuard('jwt'))
export class PushController {
  constructor(private pushService: PushService) {}

  @Get('vapid-key')
  getVapidKey() {
    return { publicKey: this.pushService.getVapidPublicKey() };
  }

  @Post('subscribe')
  subscribe(@Body() body: { subscription: object }, @Req() req: any) {
    return this.pushService.saveSubscription(req.user.userId, body.subscription);
  }

  @Delete('subscribe')
  unsubscribe(@Req() req: any) {
    return this.pushService.removeSubscription(req.user.userId);
  }
}
