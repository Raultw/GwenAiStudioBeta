import nodemailer from 'nodemailer';
import { NotificationProvider } from './provider.interface.js';
import { 
  CancellationNotificationData, 
  NotificationChannel, 
  NotificationResult, 
  NotificationSendOptions 
} from './types.js';
import { 
  generateCancellationHtml, 
  generateCancellationPlainText 
} from './emailTemplate.js';

export interface GmailSmtpProviderConfig {
  user?: string;
  pass?: string;
  fromName?: string;
  replyTo?: string;
  deliveryEnv?: string;
  enableRealSendInTest?: boolean;
  allowedRecipients?: string | string[];
  subjectPrefix?: string;
  customTransporter?: any;
}

/**
 * Gmail SMTP Email Notification Provider
 * Implements delivery via Gmail SMTP (smtp.gmail.com, port 465, secure) with support for:
 * - Safe testing environment delivery restricted to authorized allowlist recipients
 * - Explicit test delivery activation flag (GMAIL_ENABLE_REAL_SEND_IN_TEST=true)
 * - Visual test subject prefix and test disclaimer banner in test environment
 * - Error sanitization and credential privacy protection
 */
export class GmailSmtpEmailNotificationProvider implements NotificationProvider {
  readonly channel: NotificationChannel = 'email';
  private transporter: any = null;
  private customConfig?: GmailSmtpProviderConfig;

  constructor(customConfig?: GmailSmtpProviderConfig, customTransporter?: any) {
    this.customConfig = customConfig;
    if (customTransporter) {
      this.transporter = customTransporter;
    } else if (customConfig?.customTransporter) {
      this.transporter = customConfig.customTransporter;
    }
  }

  public getUser(): string {
    return (this.customConfig?.user ?? process.env.GMAIL_SMTP_USER ?? '').trim();
  }

  public getPass(): string {
    return (this.customConfig?.pass ?? process.env.GMAIL_SMTP_APP_PASSWORD ?? '').trim();
  }

  public getDeliveryEnv(): string {
    return (this.customConfig?.deliveryEnv ?? process.env.EMAIL_DELIVERY_ENV ?? 'test').toLowerCase().trim();
  }

  public isTestDeliveryEnv(): boolean {
    return this.getDeliveryEnv() === 'test';
  }

  public isRealSendInTestEnabled(): boolean {
    if (this.customConfig?.enableRealSendInTest !== undefined) {
      return Boolean(this.customConfig.enableRealSendInTest);
    }
    const envVal = (process.env.GMAIL_ENABLE_REAL_SEND_IN_TEST || '').toLowerCase().trim();
    return envVal === 'true' || envVal === '1';
  }

  public getFromName(): string {
    return (this.customConfig?.fromName ?? process.env.GMAIL_FROM_NAME ?? 'Gwen Nails').trim();
  }

  public getFromEmail(): string {
    return this.getUser();
  }

  public getReplyTo(): string | undefined {
    const val = (this.customConfig?.replyTo ?? process.env.GMAIL_REPLY_TO ?? '').trim();
    return val.length > 0 ? val : undefined;
  }

  public getSubjectPrefix(): string {
    const prefix = this.customConfig?.subjectPrefix ?? process.env.GMAIL_TEST_SUBJECT_PREFIX;
    if (prefix !== undefined) {
      return prefix.trim();
    }
    return '[TEST Gwen Nails]';
  }

  /**
   * Parses the comma-separated list or array of allowed recipients for testing environment
   */
  public getAllowedRecipients(): Set<string> {
    const raw = this.customConfig?.allowedRecipients ?? process.env.GMAIL_TEST_ALLOWED_RECIPIENTS ?? '';
    return GmailSmtpEmailNotificationProvider.parseAllowedRecipients(raw);
  }

  public static parseAllowedRecipients(raw: string | string[] | undefined): Set<string> {
    const allowed = new Set<string>();
    if (!raw) {
      return allowed;
    }

    if (Array.isArray(raw)) {
      for (const part of raw) {
        const clean = String(part).trim().toLowerCase();
        if (clean.length > 0) {
          allowed.add(clean);
        }
      }
      return allowed;
    }

    if (typeof raw === 'string') {
      const parts = raw.split(',');
      for (const part of parts) {
        const clean = part.trim().toLowerCase();
        if (clean.length > 0) {
          allowed.add(clean);
        }
      }
    }
    return allowed;
  }

  public isRecipientAllowed(recipient: string): boolean {
    const allowed = this.getAllowedRecipients();
    const clean = (recipient || '').trim().toLowerCase();
    return allowed.has(clean);
  }

  public isConfigured(): boolean {
    if (this.transporter) return true;
    const user = this.getUser();
    const pass = this.getPass();
    return user.length > 0 && pass.length > 0 && !pass.includes('xxxx');
  }

  public static maskEmail(r: string): string {
    if (!r) return '***';
    const parts = r.split('@');
    if (parts.length === 2) {
      const user = parts[0];
      const visible = user.length > 2 ? user.substring(0, 2) : user.substring(0, 1);
      return `${visible}***@${parts[1]}`;
    }
    return `${r.substring(0, Math.min(3, r.length))}***`;
  }

  private getTransporter(): any {
    if (!this.transporter) {
      const user = this.getUser();
      const pass = this.getPass();
      if (!user || !pass) {
        throw new Error('missing_gmail_credentials: GMAIL_SMTP_USER and GMAIL_SMTP_APP_PASSWORD are required.');
      }
      this.transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
          user,
          pass
        }
      });
    }
    return this.transporter;
  }

  async sendCancellation(
    data: CancellationNotificationData,
    options?: NotificationSendOptions
  ): Promise<NotificationResult> {
    const rawRecipient = (data.clienteEmail || '').trim();
    if (!rawRecipient) {
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

    const recipient = rawRecipient.toLowerCase().trim();
    const isTestEnv = this.isTestDeliveryEnv();

    if (isTestEnv && !this.isRealSendInTestEnabled()) {
      return {
        channel: this.channel,
        recipient,
        status: 'failed',
        success: false,
        error: 'real_test_delivery_disabled',
        idempotencyKey: options?.idempotencyKey,
        sentAt: undefined
      };
    }

    if (isTestEnv && !this.isRecipientAllowed(recipient)) {
      return {
        channel: this.channel,
        recipient,
        status: 'failed',
        success: false,
        error: 'test_recipient_not_allowed',
        idempotencyKey: options?.idempotencyKey,
        sentAt: undefined
      };
    }

    if (!this.isConfigured()) {
      return {
        channel: this.channel,
        recipient,
        status: 'failed',
        success: false,
        error: 'missing_gmail_credentials',
        idempotencyKey: options?.idempotencyKey,
        sentAt: undefined
      };
    }

    const prefix = this.getSubjectPrefix();
    const rawSubject = data.beneficio
      ? `Aviso importante sobre tu turno y beneficio de compensación - Gwen Nails`
      : `Cancelación de Turno - Gwen Nails (Reserva #${data.codigo})`;
    const finalSubject = prefix ? `${prefix} ${rawSubject}` : rawSubject;

    let plainText = generateCancellationPlainText(data);
    let html = generateCancellationHtml(data);

    if (isTestEnv) {
      const testDisclaimerText = '\n\nEste mensaje fue generado desde el entorno de pruebas de Gwen Nails.';
      const testDisclaimerHtml = '<div style="background:#f8f9fa;color:#495057;padding:12px;margin-bottom:20px;border:1px solid #dee2e6;border-radius:4px;font-size:13px;">Este mensaje fue generado desde el entorno de pruebas de Gwen Nails.</div>';
      plainText += testDisclaimerText;
      if (html.includes('<body>')) {
        html = html.replace('<body>', `<body>${testDisclaimerHtml}`);
      } else {
        html = testDisclaimerHtml + html;
      }
    }

    try {
      const transporter = this.getTransporter();
      const fromName = this.getFromName();
      const user = this.getUser();
      const fromFormatted = `${fromName} <${user}>`;
      const replyTo = this.getReplyTo();

      const mailOptions: any = {
        from: fromFormatted,
        to: recipient,
        subject: finalSubject,
        text: plainText,
        html,
        headers: options?.idempotencyKey ? {
          'X-Idempotency-Key': options.idempotencyKey
        } : undefined
      };

      if (replyTo) {
        mailOptions.replyTo = replyTo;
      }

      const info = await transporter.sendMail(mailOptions);
      const providerMessageId = info?.messageId;
      const sentAt = new Date().toISOString();

      console.log(`[GmailSmtpProvider] Delivery successful for ${GmailSmtpEmailNotificationProvider.maskEmail(recipient)} (ID: ${providerMessageId})`);

      return {
        channel: this.channel,
        recipient,
        status: 'sent',
        success: true,
        subject: finalSubject,
        providerMessageId,
        idempotencyKey: options?.idempotencyKey,
        sentAt
      };
    } catch (err: any) {
      const errMessage = (err?.message || '').toLowerCase();
      let sanitizedError = err?.name || err?.code || err?.message || 'gmail_smtp_error';
      if (errMessage.includes('invalid login') || errMessage.includes('username and password not accepted') || errMessage.includes('auth')) {
        sanitizedError = 'smtp_authentication_error: Verifique GMAIL_SMTP_USER y la contraseña de aplicación.';
      } else if (errMessage.includes('timeout') || errMessage.includes('ETIMEDOUT') || errMessage.includes('ESOCKET')) {
        sanitizedError = 'smtp_timeout: Tiempo de espera agotado al conectar con el servidor SMTP.';
      }

      console.error(`[GmailSmtpProvider] Delivery failed for ${GmailSmtpEmailNotificationProvider.maskEmail(recipient)}: ${sanitizedError}`);

      return {
        channel: this.channel,
        recipient,
        status: 'failed',
        success: false,
        subject: finalSubject,
        error: sanitizedError,
        idempotencyKey: options?.idempotencyKey,
        sentAt: undefined
      };
    }
  }

  async sendTestEmail(
    recipientEmail: string,
    subject: string,
    htmlContent: string,
    textContent: string,
    options?: NotificationSendOptions
  ): Promise<NotificationResult> {
    const rawRecipient = (recipientEmail || '').trim();
    if (!rawRecipient) {
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

    const recipient = rawRecipient.toLowerCase().trim();
    const isTestEnv = this.isTestDeliveryEnv();

    if (isTestEnv && !this.isRealSendInTestEnabled()) {
      return {
        channel: this.channel,
        recipient,
        status: 'failed',
        success: false,
        subject,
        error: 'real_test_delivery_disabled',
        idempotencyKey: options?.idempotencyKey,
        sentAt: undefined
      };
    }

    if (isTestEnv && !this.isRecipientAllowed(recipient)) {
      return {
        channel: this.channel,
        recipient,
        status: 'failed',
        success: false,
        subject,
        error: 'test_recipient_not_allowed',
        idempotencyKey: options?.idempotencyKey,
        sentAt: undefined
      };
    }

    if (!this.isConfigured()) {
      return {
        channel: this.channel,
        recipient,
        status: 'failed',
        success: false,
        subject,
        error: 'missing_gmail_credentials',
        idempotencyKey: options?.idempotencyKey,
        sentAt: undefined
      };
    }

    try {
      const transporter = this.getTransporter();
      const fromName = this.getFromName();
      const user = this.getUser();
      const fromFormatted = `${fromName} <${user}>`;
      const replyTo = this.getReplyTo();

      const mailOptions: any = {
        from: fromFormatted,
        to: recipient,
        subject,
        text: textContent,
        html: htmlContent,
        headers: options?.idempotencyKey ? {
          'X-Idempotency-Key': options.idempotencyKey
        } : undefined
      };

      if (replyTo) {
        mailOptions.replyTo = replyTo;
      }

      const info = await transporter.sendMail(mailOptions);
      const providerMessageId = info?.messageId;
      const sentAt = new Date().toISOString();

      console.log(`[GmailSmtpProvider] Test delivery successful for ${GmailSmtpEmailNotificationProvider.maskEmail(recipient)} (ID: ${providerMessageId})`);

      return {
        channel: this.channel,
        recipient,
        status: 'sent',
        success: true,
        subject,
        providerMessageId,
        idempotencyKey: options?.idempotencyKey,
        sentAt
      };
    } catch (err: any) {
      const errMessage = (err?.message || '').toLowerCase();
      let sanitizedError = err?.name || err?.code || err?.message || 'gmail_smtp_error';
      if (errMessage.includes('invalid login') || errMessage.includes('username and password not accepted') || errMessage.includes('auth')) {
        sanitizedError = 'smtp_authentication_error: Verifique GMAIL_SMTP_USER y la contraseña de aplicación.';
      } else if (errMessage.includes('timeout') || errMessage.includes('ETIMEDOUT') || errMessage.includes('ESOCKET')) {
        sanitizedError = 'smtp_timeout: Tiempo de espera agotado al conectar con el servidor SMTP.';
      }

      console.error(`[GmailSmtpProvider] Test delivery failed for ${GmailSmtpEmailNotificationProvider.maskEmail(recipient)}: ${sanitizedError}`);

      return {
        channel: this.channel,
        recipient,
        status: 'failed',
        success: false,
        subject,
        error: sanitizedError,
        idempotencyKey: options?.idempotencyKey,
        sentAt: undefined
      };
    }
  }
}
