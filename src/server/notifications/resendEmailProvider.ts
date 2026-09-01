import { Resend } from 'resend';
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

export interface ResendProviderConfig {
  apiKey?: string;
  deliveryEnv?: string;
  fromEmail?: string;
  fromName?: string;
  replyTo?: string;
  enableRealSendInTest?: boolean;
  allowedRecipients?: string | string[];
  subjectPrefix?: string;
  customClient?: any;
}

/**
 * Resend Email Notification Provider
 * Implements delivery via Resend API with support for:
 * - Safe testing environment delivery restricted to authorized allowlist recipients
 * - Explicit test delivery activation flag (RESEND_ENABLE_REAL_SEND_IN_TEST=true)
 * - Visual [TEST] subject prefix and test disclaimer banner in test environment
 * - Idempotency key forwarding
 * - Error sanitization and credential privacy protection
 */
export class ResendEmailNotificationProvider implements NotificationProvider {
  readonly channel: NotificationChannel = 'email';
  private resendClient: any = null;
  private customConfig?: ResendProviderConfig;

  constructor(customConfig?: ResendProviderConfig, customClient?: any) {
    this.customConfig = customConfig;
    if (customClient) {
      this.resendClient = customClient;
    } else if (customConfig?.customClient) {
      this.resendClient = customConfig.customClient;
    }
  }

  public getApiKey(): string {
    return (this.customConfig?.apiKey ?? process.env.RESEND_API_KEY ?? '').trim();
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
    const envVal = (process.env.RESEND_ENABLE_REAL_SEND_IN_TEST || '').toLowerCase().trim();
    return envVal === 'true' || envVal === '1';
  }

  public getFromEmail(): string {
    return (this.customConfig?.fromEmail ?? process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev').trim();
  }

  public getFromName(): string {
    return (this.customConfig?.fromName ?? process.env.RESEND_FROM_NAME ?? 'Gwen Nails').trim();
  }

  public getReplyTo(): string | undefined {
    const val = (this.customConfig?.replyTo ?? process.env.RESEND_REPLY_TO ?? '').trim();
    return val.length > 0 ? val : undefined;
  }

  public getSubjectPrefix(): string {
    const prefix = this.customConfig?.subjectPrefix ?? process.env.RESEND_TEST_SUBJECT_PREFIX;
    if (prefix !== undefined) {
      return prefix.trim();
    }
    return '[TEST Gwen Nails]';
  }

  /**
   * Parses the comma-separated list or array of allowed recipients for testing environment
   */
  public getAllowedRecipients(): Set<string> {
    const raw = this.customConfig?.allowedRecipients ?? process.env.RESEND_TEST_ALLOWED_RECIPIENTS ?? '';
    return ResendEmailNotificationProvider.parseAllowedRecipients(raw);
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
    const norm = (recipient || '').toLowerCase().trim();
    if (!norm) return false;
    return this.getAllowedRecipients().has(norm);
  }

  public isConfigured(): boolean {
    if (this.resendClient) return true;
    const key = this.getApiKey();
    return key.length > 0 && !key.includes('xxxx');
  }

  /**
   * Helper to mask email addresses for safe logging
   */
  public static maskEmail(email: string): string {
    if (!email || typeof email !== 'string') return 'unknown';
    const clean = email.trim();
    const parts = clean.split('@');
    if (parts.length !== 2) return 'invalid_email';
    const [user, domain] = parts;
    const maskedUser = user.length <= 2 
      ? `${user[0] || '*'}***` 
      : `${user.slice(0, 2)}***${user.slice(-1)}`;
    return `${maskedUser}@${domain}`;
  }

  private getClient(): Resend {
    if (!this.resendClient) {
      const key = this.getApiKey();
      if (!key) {
        throw new Error('missing_api_key');
      }
      this.resendClient = new Resend(key);
    }
    return this.resendClient;
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
    const prefix = this.getSubjectPrefix();

    const baseSubject = data.beneficio
      ? `Aviso importante sobre tu turno y beneficio de compensación - Gwen Nails`
      : `Cancelación de Turno - Gwen Nails (Reserva #${data.codigo})`;

    const finalSubject = (isTestEnv && prefix)
      ? `${prefix} ${baseSubject}`
      : baseSubject;

    const templateOptions = {
      isTestEnv,
      testDisclaimer: 'Este mensaje fue generado desde el entorno de pruebas de Gwen Nails.'
    };

    const plainText = generateCancellationPlainText(data, templateOptions);
    const html = generateCancellationHtml(data, templateOptions);

    // 1. Guard for testing environment activation
    if (isTestEnv) {
      if (!this.isRealSendInTestEnabled()) {
        return {
          channel: this.channel,
          recipient,
          status: 'failed',
          success: false,
          subject: finalSubject,
          error: 'real_test_delivery_disabled',
          idempotencyKey: options?.idempotencyKey,
          sentAt: undefined
        };
      }

      // 2. Guard for allowlist in testing environment
      if (!this.isRecipientAllowed(recipient)) {
        return {
          channel: this.channel,
          recipient,
          status: 'failed',
          success: false,
          subject: finalSubject,
          error: 'test_recipient_not_allowed',
          idempotencyKey: options?.idempotencyKey,
          sentAt: undefined
        };
      }
    }

    // 3. Guard for API Key
    if (!this.isConfigured()) {
      return {
        channel: this.channel,
        recipient,
        status: 'failed',
        success: false,
        subject: finalSubject,
        error: 'missing_api_key',
        idempotencyKey: options?.idempotencyKey,
        sentAt: undefined
      };
    }

    try {
      const resend = this.getClient();
      const fromName = this.getFromName();
      const fromEmail = this.getFromEmail();
      const fromFormatted = fromName ? `${fromName} <${fromEmail}>` : fromEmail;
      const replyTo = this.getReplyTo();

      const sendPayload: any = {
        from: fromFormatted,
        to: [recipient],
        subject: finalSubject,
        html,
        text: plainText,
        headers: options?.idempotencyKey ? {
          'X-Idempotency-Key': options.idempotencyKey
        } : undefined
      };

      if (replyTo) {
        sendPayload.replyTo = replyTo;
      }

      const requestOptions: any = {};
      if (options?.idempotencyKey) {
        // Resend idempotencyKey max length is typically 256 chars
        requestOptions.idempotencyKey = options.idempotencyKey.slice(0, 256);
      }

      const result = await resend.emails.send(sendPayload, requestOptions);

      if (result.error) {
        const errObj = result.error;
        let sanitizedError = errObj.name || errObj.message || 'resend_delivery_error';

        const errMsg = (errObj.message || '').toLowerCase();
        if (errMsg.includes('verify a domain') || (errMsg.includes('domain') && errMsg.includes('verif'))) {
          sanitizedError = 'domain_not_verified: El remitente de prueba requiere verificar un dominio o enviar únicamente al email registrado en Resend.';
        }

        console.warn(`[ResendProvider] Delivery failed for ${ResendEmailNotificationProvider.maskEmail(recipient)}: ${sanitizedError}`);

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

      const providerMessageId = result.data?.id;
      const sentAt = new Date().toISOString();

      console.log(`[ResendProvider] Delivery successful for ${ResendEmailNotificationProvider.maskEmail(recipient)} (ID: ${providerMessageId}, isTestEnv: ${isTestEnv})`);

      return {
        channel: this.channel,
        recipient,
        status: 'sent',
        success: true,
        subject: finalSubject,
        message: plainText,
        idempotencyKey: options?.idempotencyKey,
        providerMessageId,
        sentAt
      };
    } catch (err: any) {
      const sanitizedError = err?.name || err?.code || err?.message || 'resend_exception';
      console.error(`[ResendProvider] Exception delivering email to ${ResendEmailNotificationProvider.maskEmail(recipient)}:`, sanitizedError);

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
        error: 'missing_api_key',
        idempotencyKey: options?.idempotencyKey,
        sentAt: undefined
      };
    }

    try {
      const resend = this.getClient();
      const fromName = this.getFromName();
      const fromEmail = this.getFromEmail();
      const fromFormatted = fromName ? `${fromName} <${fromEmail}>` : fromEmail;
      const replyTo = this.getReplyTo();

      const sendPayload: any = {
        from: fromFormatted,
        to: [recipient],
        subject,
        html: htmlContent,
        text: textContent,
        headers: options?.idempotencyKey ? {
          'X-Idempotency-Key': options.idempotencyKey
        } : undefined
      };

      if (replyTo) {
        sendPayload.replyTo = replyTo;
      }

      const requestOptions: any = {};
      if (options?.idempotencyKey) {
        requestOptions.idempotencyKey = options.idempotencyKey.slice(0, 256);
      }

      const result = await resend.emails.send(sendPayload, requestOptions);

      if (result.error) {
        const errObj = result.error;
        let sanitizedError = errObj.name || errObj.message || 'resend_delivery_error';
        const errMsg = (errObj.message || '').toLowerCase();
        if (errMsg.includes('verify a domain') || (errMsg.includes('domain') && errMsg.includes('verif'))) {
          sanitizedError = 'domain_not_verified: El remitente de prueba requiere verificar un dominio o enviar únicamente al email registrado en Resend.';
        }
        console.warn(`[ResendProvider] Delivery failed for ${ResendEmailNotificationProvider.maskEmail(recipient)}: ${sanitizedError}`);
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

      const providerMessageId = result.data?.id;
      const sentAt = new Date().toISOString();
      console.log(`[ResendProvider] Delivery successful for ${ResendEmailNotificationProvider.maskEmail(recipient)} (ID: ${providerMessageId}, isTestEnv: ${isTestEnv})`);

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
      const sanitizedError = err?.name || err?.code || err?.message || 'resend_exception';
      console.error(`[ResendProvider] Exception delivering test email to ${ResendEmailNotificationProvider.maskEmail(recipient)}:`, sanitizedError);

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
