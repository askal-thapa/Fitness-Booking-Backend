import { Injectable } from '@nestjs/common';
import { DrizzleService } from '../db/drizzle.service';
import { messages, users } from '../db/schema';
import { eq, or, and, desc } from 'drizzle-orm';

@Injectable()
export class ChatService {
  constructor(private drizzle: DrizzleService) {}

  async saveMessage(fromUserId: number, toUserId: number, content: string) {
    const [msg] = await this.drizzle.db
      .insert(messages)
      .values({ fromUserId, toUserId, content })
      .returning();
    return msg;
  }

  async getMessages(userId1: number, userId2: number) {
    return this.drizzle.db
      .select()
      .from(messages)
      .where(
        or(
          and(eq(messages.fromUserId, userId1), eq(messages.toUserId, userId2)),
          and(eq(messages.fromUserId, userId2), eq(messages.toUserId, userId1)),
        ),
      )
      .orderBy(messages.createdAt)
      .limit(100);
  }

  async getConversations(userId: number) {
    const sent = await this.drizzle.db
      .selectDistinct({ otherId: messages.toUserId })
      .from(messages)
      .where(eq(messages.fromUserId, userId));

    const received = await this.drizzle.db
      .selectDistinct({ otherId: messages.fromUserId })
      .from(messages)
      .where(eq(messages.toUserId, userId));

    const partnerIds = [...new Set([...sent.map(s => s.otherId), ...received.map(r => r.otherId)])];
    if (partnerIds.length === 0) return [];

    const convs = await Promise.all(
      partnerIds.map(async (partnerId) => {
        const [lastMsg] = await this.drizzle.db
          .select()
          .from(messages)
          .where(
            or(
              and(eq(messages.fromUserId, userId), eq(messages.toUserId, partnerId)),
              and(eq(messages.fromUserId, partnerId), eq(messages.toUserId, userId)),
            ),
          )
          .orderBy(desc(messages.createdAt))
          .limit(1);

        const [partner] = await this.drizzle.db
          .select({ id: users.id, name: users.fullName, imageUrl: users.imageUrl })
          .from(users)
          .where(eq(users.id, partnerId));

        return {
          otherUserId: partnerId,
          otherUserName: partner?.name || 'Unknown',
          otherUserImage: partner?.imageUrl || null,
          lastMessage: lastMsg?.content || '',
          lastMessageAt: lastMsg?.createdAt || new Date(),
        };
      }),
    );

    return convs.sort(
      (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime(),
    );
  }
}
