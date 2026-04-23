import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';
import { DrizzleService } from '../db/drizzle.service';
import { pushSubscriptions } from '../db/schema';
import { eq } from 'drizzle-orm';

@Injectable()
export class PushService implements OnModuleInit {
  private enabled = false;

  constructor(
    private config: ConfigService,
    private drizzle: DrizzleService,
  ) {}

  onModuleInit() {
    const publicKey = this.config.get<string>('VAPID_PUBLIC_KEY');
    const privateKey = this.config.get<string>('VAPID_PRIVATE_KEY');
    const email = this.config.get<string>('VAPID_EMAIL') || 'mailto:admin@askal.fit';

    if (publicKey && privateKey) {
      webpush.setVapidDetails(email, publicKey, privateKey);
      this.enabled = true;
    } else {
      console.warn('⚠️  VAPID keys not configured — push notifications disabled.');
    }
  }

  getVapidPublicKey() {
    return this.config.get<string>('VAPID_PUBLIC_KEY') || null;
  }

  async saveSubscription(userId: number, subscription: object) {
    const serialized = JSON.stringify(subscription);
    await this.drizzle.db
      .insert(pushSubscriptions)
      .values({ userId, subscription: serialized })
      .onConflictDoUpdate({
        target: pushSubscriptions.userId,
        set: { subscription: serialized },
      });
  }

  async removeSubscription(userId: number) {
    await this.drizzle.db
      .delete(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId));
  }

  async sendToUser(
    userId: number,
    payload: { title: string; body: string; url?: string },
  ) {
    if (!this.enabled) return;

    const [row] = await this.drizzle.db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId));

    if (!row) return;

    try {
      await webpush.sendNotification(
        JSON.parse(row.subscription),
        JSON.stringify({ title: payload.title, body: payload.body, url: payload.url || '/chat' }),
      );
    } catch (err: any) {
      // Subscription expired or invalid — clean it up
      if (err.statusCode === 410 || err.statusCode === 404) {
        await this.removeSubscription(userId);
      }
    }
  }
}
