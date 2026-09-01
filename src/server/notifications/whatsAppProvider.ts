import { NotificationProvider } from './provider.interface';
import { 
  CancellationNotificationData, 
  NotificationChannel, 
  NotificationResult, 
  NotificationSendOptions 
} from './types';
import { isoDateToAR } from '../../utils/dateUtils.js';

/**
 * WhatsApp Notification Provider (Prepared skeleton for future activation).
 * Ready to integrate with Meta Cloud API, Twilio, or Baileys when credentials are provided.
 */
export class WhatsAppNotificationProvider implements NotificationProvider {
  readonly channel: NotificationChannel = 'whatsapp';

  isConfigured(): boolean {
    // WhatsApp is kept unconfigured/disabled until credentials or provider is enabled
    return false;
  }

  /**
   * Builds formatted message text for WhatsApp
   */
  private generateWhatsAppMessage(data: CancellationNotificationData): string {
    const fullName = `${data.clienteNombre} ${data.clienteApellido || ''}`.trim();
    const profLine = data.profesionalNombre ? `\n*Profesional:* ${data.profesionalNombre}` : '';
    const fechaAR = isoDateToAR(data.fecha);

    return (
      `🌸 *Nails & Beauty Studio* - Aviso de Cancelación\n\n` +
      `Hola *${fullName}*, te informamos que tu turno ha sido cancelado.\n\n` +
      `📌 *Detalle de la reserva:*\n` +
      `• *Código:* ${data.codigo}\n` +
      `• *Servicio:* ${data.servicioNombre}\n` +
      `• *Fecha:* ${fechaAR}\n` +
      `• *Horario:* ${data.horaInicio} a ${data.horaFin} hs${profLine}\n\n` +
      `⚠️ *Motivo:* ${data.motivoCancelacion || 'Cancelado por el salón'}\n\n` +
      `Lamentamos el inconveniente. Podés agendar un nuevo horario desde nuestra web.`
    );
  }

  async sendCancellation(
    data: CancellationNotificationData,
    options?: NotificationSendOptions
  ): Promise<NotificationResult> {
    const recipient = (data.clienteTelefono || '').trim();
    const sentAt = new Date().toISOString();

    if (!this.isConfigured()) {
      return {
        channel: this.channel,
        recipient: recipient || 'sin_telefono',
        status: 'skipped',
        success: true,
        error: 'Canal WhatsApp no activado actualmente (preparado para futura integración)',
        idempotencyKey: options?.idempotencyKey,
        sentAt
      };
    }

    // When configured in future:
    const message = this.generateWhatsAppMessage(data);
    return {
      channel: this.channel,
      recipient,
      status: 'sent',
      success: true,
      message,
      idempotencyKey: options?.idempotencyKey,
      sentAt
    };
  }
}
