import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter | null = null;

  constructor(private config: ConfigService) {
    const user = config.get<string>('SMTP_USER');
    const pass = config.get<string>('SMTP_PASS');
    if (!user || !pass) {
      console.warn('⚠️  SMTP credentials not configured — emails disabled.');
      return;
    }
    this.transporter = nodemailer.createTransport({
      host: config.get<string>('SMTP_HOST') || 'smtp.gmail.com',
      port: parseInt(config.get<string>('SMTP_PORT') || '587'),
      secure: false,
      auth: { user, pass },
    });
  }

  async sendBookingConfirmation(data: {
    to: string;
    userName: string;
    trainerName: string;
    trainerSpecialty: string;
    date: string;
    timeSlot: string;
    amount: number;
    bookingId: number;
  }) {
    if (!this.transporter) return;

    const fromName = this.config.get<string>('SMTP_FROM_NAME') || 'Askal Fit';
    const fromAddr = this.config.get<string>('SMTP_USER');

    const dateFormatted = new Date(data.date).toLocaleDateString('en-GB', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Booking Confirmed</title>
</head>
<body style="margin:0;padding:0;background:#FAFAF7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAFAF7;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;">

        <!-- Header -->
        <tr><td style="background:#2D7A6F;border-radius:16px 16px 0 0;padding:32px 40px;text-align:center;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="vertical-align:middle;">
                <div style="display:inline-block;width:36px;height:36px;background:rgba(255,255,255,0.2);border-radius:8px;line-height:36px;text-align:center;font-weight:800;color:#fff;font-size:16px;margin-right:10px;vertical-align:middle;">A</div>
                <span style="font-size:20px;font-weight:800;color:#fff;letter-spacing:-0.5px;vertical-align:middle;">ASKAL</span>
              </td>
            </tr>
          </table>
          <h1 style="margin:24px 0 4px;color:#fff;font-size:28px;font-weight:700;letter-spacing:-0.5px;">Booking Confirmed!</h1>
          <p style="margin:0;color:rgba(255,255,255,0.8);font-size:15px;">Your session has been booked and payment received.</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="background:#fff;padding:40px;border-left:1px solid #E2DDD6;border-right:1px solid #E2DDD6;">
          <p style="margin:0 0 24px;color:#2C2825;font-size:16px;">Hi <strong>${data.userName}</strong>,</p>
          <p style="margin:0 0 28px;color:#7A756E;font-size:15px;line-height:1.6;">
            Thanks for booking with Askal! Here&rsquo;s a summary of your upcoming session.
          </p>

          <!-- Booking Card -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAFAF7;border:1px solid #E2DDD6;border-radius:12px;margin-bottom:28px;">
            <tr><td style="padding:24px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-bottom:16px;border-bottom:1px solid #E2DDD6;">
                    <p style="margin:0 0 2px;font-size:11px;font-weight:600;color:#2D7A6F;text-transform:uppercase;letter-spacing:0.8px;">Trainer</p>
                    <p style="margin:0;font-size:16px;font-weight:700;color:#2C2825;">${data.trainerName}</p>
                    <p style="margin:2px 0 0;font-size:13px;color:#7A756E;">${data.trainerSpecialty}</p>
                  </td>
                </tr>
                <tr><td style="padding-top:16px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="width:50%;padding-bottom:12px;">
                        <p style="margin:0 0 2px;font-size:11px;font-weight:600;color:#2D7A6F;text-transform:uppercase;letter-spacing:0.8px;">Date</p>
                        <p style="margin:0;font-size:14px;font-weight:600;color:#2C2825;">${dateFormatted}</p>
                      </td>
                      <td style="width:50%;padding-bottom:12px;">
                        <p style="margin:0 0 2px;font-size:11px;font-weight:600;color:#2D7A6F;text-transform:uppercase;letter-spacing:0.8px;">Time</p>
                        <p style="margin:0;font-size:14px;font-weight:600;color:#2C2825;">${data.timeSlot}</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="width:50%;">
                        <p style="margin:0 0 2px;font-size:11px;font-weight:600;color:#2D7A6F;text-transform:uppercase;letter-spacing:0.8px;">Booking ID</p>
                        <p style="margin:0;font-size:14px;font-weight:600;color:#2C2825;">#${data.bookingId}</p>
                      </td>
                      <td style="width:50%;">
                        <p style="margin:0 0 2px;font-size:11px;font-weight:600;color:#2D7A6F;text-transform:uppercase;letter-spacing:0.8px;">Amount Paid</p>
                        <p style="margin:0;font-size:14px;font-weight:700;color:#2C2825;">&pound;${data.amount.toFixed(2)}</p>
                      </td>
                    </tr>
                  </table>
                </td></tr>
              </table>
            </td></tr>
          </table>

          <!-- CTA -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
            <tr><td align="center">
              <a href="${this.config.get('FRONTEND_URL') || 'http://localhost:3000'}/dashboard/bookings"
                 style="display:inline-block;background:#2D7A6F;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 32px;border-radius:12px;letter-spacing:-0.2px;">
                View My Bookings
              </a>
            </td></tr>
          </table>

          <p style="margin:0;color:#7A756E;font-size:14px;line-height:1.6;">
            If you need to reschedule or have any questions, visit your bookings page or reply to this email.
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#F0EDE8;border-radius:0 0 16px 16px;padding:24px 40px;text-align:center;border:1px solid #E2DDD6;border-top:none;">
          <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#2C2825;">Askal Fit</p>
          <p style="margin:0;font-size:12px;color:#7A756E;">Expert gym trainer booking &mdash; elevate your fitness journey</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

    await this.transporter.sendMail({
      from: `"${fromName}" <${fromAddr}>`,
      to: data.to,
      subject: `✅ Booking Confirmed — Session with ${data.trainerName} on ${dateFormatted}`,
      html,
    });
  }
}
