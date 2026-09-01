import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { NotificationProvider } from './provider.interface';
import { 
  CancellationNotificationData, 
  NotificationChannel, 
  NotificationResult, 
  NotificationSendOptions 
} from './types';
import { generateCancellationHtml, generateCancellationPlainText } from './emailTemplate';

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

export class SmtpEmailNotificationProvider implements NotificationProvider {
  readonly channel: NotificationChannel = 'email';
  private transporter: Transporter | null = null;
  private config: SmtpConfig | null = null;

  constructor(customConfig?: Partial<SmtpConfig>) {
    const host = customConfig?.host || process.env.SMTP_HOST || '';
    const port = customConfig?.port || (process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587);
    const secure = customConfig?.secure ?? (process.env.SMTP_SECURE === 'true' || port === 465);
    const user = customConfig?.user || process.env.SMTP_USER || '';
    const pass = customConfig?.pass || process.env.SMTP_PASS || '';
    const from = customConfig?.from || process.env.EMAIL_FROM || 'Gwen Nails <notificaciones@gwennails.com>';

    if (host && user) {
      this.config = { host, port, secure, user, pass, from };
    }
  }

  public isConfigured(): boolean {
    return Boolean(
      this.config && 
      this.config.host && 
      this.config.user && 
      this.config.from
    );
  }

  private getTransporter(): Transporter {
    if (!this.transporter) {
      if (!this.config) {
        throw new Error('SMTP Configuration is missing. Set SMTP_HOST, SMTP_USER, SMTP_PASS, and EMAIL_FROM.');
      }
      this.transporter = nodemailer.createTransport({
        host: this.config.host,
        port: this.config.port,
        secure: this.config.secure,
        auth: {
          user: this.config.user,
          pass: this.config.pass
        }
      });
    }
    return this.transporter;
  }

  async sendCancellation(
    data: CancellationNotificationData,
    options?: NotificationSendOptions
  ): Promise<NotificationResult> {
    const recipient = (data.clienteEmail || '').trim();

    if (!recipient) {
      return {
        channel: this.channel,
        recipient: 'sin_email',
        status: 'omitido_sin_email',
        success: true,
        error: 'no enviado por falta de email',
        idempotencyKey: options?.idempotencyKey,
        sentAt: undefined
      };
    }

    const subject = data.beneficio
      ? `Aviso importante sobre tu turno y beneficio de compensación - Gwen Nails`
      : `Cancelación de Turno - Gwen Nails (Reserva #${data.codigo})`;
    const plainText = generateCancellationPlainText(data);
    const html = generateCancellationHtml(data);

    try {
      const transporter = this.getTransporter();
      const info = await transporter.sendMail({
        from: this.config?.from || 'Gwen Nails <notificaciones@gwennails.com>',
        to: recipient,
        subject,
        text: plainText,
        html,
        headers: options?.idempotencyKey ? { 'X-Idempotency-Key': options.idempotencyKey } : undefined
      });

      const sentAt = new Date().toISOString();
      return {
        channel: this.channel,
        recipient,
        status: 'sent',
        success: true,
        subject,
        message: plainText,
        idempotencyKey: options?.idempotencyKey,
        sentAt
      };
    } catch (err: any) {
      console.error(`[SmtpEmailNotificationProvider] Error sending cancellation email to ${recipient}:`, err);
      return {
        channel: this.channel,
        recipient,
        status: 'failed',
        success: false,
        subject,
        error: err?.message || 'Error al enviar email via SMTP',
        idempotencyKey: options?.idempotencyKey,
        sentAt: undefined
      };
    }
  }
}
