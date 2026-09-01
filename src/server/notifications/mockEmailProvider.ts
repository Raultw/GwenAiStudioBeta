import { NotificationProvider } from './provider.interface.js';
import { 
  CancellationNotificationData, 
  NotificationChannel, 
  NotificationResult, 
  NotificationSendOptions 
} from './types.js';
import { generateCancellationHtml, generateCancellationPlainText } from './emailTemplate.js';

export interface SentEmailRecord {
  id: string;
  recipient: string;
  subject: string;
  text: string;
  html: string;
  data: CancellationNotificationData;
  options?: NotificationSendOptions;
  sentAt: string;
}

export class MockEmailNotificationProvider implements NotificationProvider {
  readonly channel: NotificationChannel = 'email';
  public readonly sentEmails: SentEmailRecord[] = [];
  private shouldFailNext: boolean = false;
  private failureError: string = 'Simulated provider error';

  isConfigured(): boolean {
    return true;
  }

  public setShouldFailNext(fail: boolean, errorMessage?: string): void {
    this.shouldFailNext = fail;
    if (errorMessage) this.failureError = errorMessage;
  }

  public clearSentEmails(): void {
    this.sentEmails.length = 0;
  }

  public getLastEmail(): SentEmailRecord | undefined {
    return this.sentEmails[this.sentEmails.length - 1];
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

    if (this.shouldFailNext) {
      this.shouldFailNext = false;
      return {
        channel: this.channel,
        recipient,
        status: 'failed',
        success: false,
        subject,
        error: this.failureError,
        idempotencyKey: options?.idempotencyKey,
        sentAt: undefined
      };
    }

    const messageId = `mock-email-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const sentAt = new Date().toISOString();
    this.sentEmails.push({
      id: messageId,
      recipient,
      subject,
      text: plainText,
      html,
      data,
      options,
      sentAt
    });

    return {
      channel: this.channel,
      recipient,
      status: 'sent',
      success: true,
      subject,
      message: plainText,
      idempotencyKey: options?.idempotencyKey,
      providerMessageId: messageId,
      sentAt
    };
  }
}

