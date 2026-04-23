import { Controller, Get, Query, Req, UseGuards, ParseIntPipe } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ChatService } from './chat.service';

@Controller('chat')
@UseGuards(AuthGuard('jwt'))
export class ChatController {
  constructor(private chatService: ChatService) {}

  @Get('messages')
  getMessages(@Query('with', ParseIntPipe) withUserId: number, @Req() req: any) {
    return this.chatService.getMessages(req.user.userId, withUserId);
  }

  @Get('conversations')
  getConversations(@Req() req: any) {
    return this.chatService.getConversations(req.user.userId);
  }
}
