import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ChatService } from './chat.service';
import { PushService } from '../push/push.service';

@WebSocketGateway({ cors: { origin: '*' } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  private userSocketMap = new Map<number, string>();

  // Tracks which users are currently in a room (connected + joined)
  private activeInRoom = new Map<string, Set<number>>();

  constructor(
    private jwtService: JwtService,
    private chatService: ChatService,
    private pushService: PushService,
  ) {}

  handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token as string;
      if (!token) { client.disconnect(); return; }
      const payload = this.jwtService.verify(token);
      (client as any).userId = payload.sub;
      this.userSocketMap.set(payload.sub, client.id);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = (client as any).userId;
    if (userId) {
      this.userSocketMap.delete(userId);
      // Remove from all active rooms
      this.activeInRoom.forEach((set) => set.delete(userId));
    }
  }

  private roomName(a: number, b: number) {
    return `chat_${Math.min(a, b)}_${Math.max(a, b)}`;
  }

  @SubscribeMessage('join_room')
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { otherUserId: number },
  ) {
    const myId = (client as any).userId;
    if (!myId) return;
    const room = this.roomName(myId, data.otherUserId);
    client.join(room);
    if (!this.activeInRoom.has(room)) this.activeInRoom.set(room, new Set());
    this.activeInRoom.get(room)!.add(myId);
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { toUserId: number; content: string },
  ) {
    const fromUserId = (client as any).userId;
    if (!fromUserId || !data.content?.trim()) return;
    const msg = await this.chatService.saveMessage(fromUserId, data.toUserId, data.content.trim());
    const room = this.roomName(fromUserId, data.toUserId);
    this.server.to(room).emit('new_message', msg);

    // Send push notification to recipient if they're not in the active room
    const activeUsers = this.activeInRoom.get(room);
    if (!activeUsers?.has(data.toUserId)) {
      this.pushService
        .sendToUser(data.toUserId, {
          title: '💬 New message',
          body: data.content.trim().length > 80 ? data.content.trim().slice(0, 80) + '…' : data.content.trim(),
          url: '/chat',
        })
        .catch(() => {});
    }
  }

  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { toUserId: number },
  ) {
    const fromUserId = (client as any).userId;
    if (!fromUserId) return;
    client.to(this.roomName(fromUserId, data.toUserId)).emit('user_typing', { fromUserId });
  }

  @SubscribeMessage('stop_typing')
  handleStopTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { toUserId: number },
  ) {
    const fromUserId = (client as any).userId;
    if (!fromUserId) return;
    client.to(this.roomName(fromUserId, data.toUserId)).emit('user_stop_typing', { fromUserId });
  }
}
