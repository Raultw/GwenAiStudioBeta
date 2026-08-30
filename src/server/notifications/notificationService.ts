import { NotificationProvider } from './provider.interface';
import { EmailNotificationProvider } from './emailProvider';
import { WhatsAppNotificationProvider } from './whatsAppProvider';
import {
  CancellationNotificationData,
  NotificationChannel,
  NotificationLog,
  NotificationResult,
  NotificationSendOptions
} from './types';
import { createNotificationLog, isNotificationAlreadySent } from '../db';
import type { Appointment } from '../../types';

export class NotificationService {
  private static instance: NotificationService;
  private providers: Map<NotificationChannel, NotificationProvider> = new Map();

  private constructor() {
    // Register default providers
    this.registerProvider(new EmailNotificationProvider());
    this.registerProvider(new WhatsAppNotificationProvider());
  }

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Register or replace a provider for a specific channel
   */
  public registerProvider(provider: NotificationProvider): void {
    this.providers.set(provider.channel, provider);
  }

  /**
   * Get registered provider for channel
   */
  public getProvider(channel: NotificationChannel): NotificationProvider | undefined {
    return this.providers.get(channel);
  }

  /**
   * Dispatches appointment cancellation notification to all configured or requested channels.
   * Ensures idempotency: duplicate requests with the same idempotency key are skipped.
   */
  public async sendAppointmentCancellation(
    appointment: Appointment,
    options?: {
      motivo?: string;
      origen?: string;
      canceladoPor?: string;
      idempotencyKey?: string;
      channels?: NotificationChannel[];
      forceResend?: boolean;
      metadata?: Record<string, any>;
    }
  ): Promise<NotificationResult[]> {
    const motivoCancelacion = 
      options?.motivo || 
      appointment.motivoCancelacion || 
      'Cancelado por administración';

    const cancellationData: CancellationNotificationData = {
      appointmentId: appointment.id,
      codigo: appointment.codigo,
      clienteNombre: appointment.nombre,
      clienteApellido: appointment.apellido,
      clienteEmail: appointment.email,
      clienteTelefono: appointment.telefono,
      servicioNombre: appointment.servicioNombre,
      fecha: appointment.fecha,
      horaInicio: appointment.horaInicio,
      horaFin: appointment.horaFin,
      motivoCancelacion,
      profesionalNombre: appointment.profesionalNombre,
      origen: options?.origen || appointment.canceladoOrigen,
      canceladoPor: options?.canceladoPor || appointment.canceladoPor
    };

    // By default, dispatch to email (and any other configured active channels)
    const targetChannels: NotificationChannel[] = options?.channels && options.channels.length > 0
      ? options.channels
      : ['email'];

    const results: NotificationResult[] = [];

    for (const channel of targetChannels) {
      const provider = this.providers.get(channel);
      if (!provider) {
        console.warn(`[NotificationService] No provider registered for channel: ${channel}`);
        continue;
      }

      // Compute unique idempotency key for this appointment cancellation + channel
      const rawKey = options?.idempotencyKey || `cancel-${appointment.id}-${channel}-${appointment.canceladoEn || appointment.fecha}`;
      const idempotencyKey = rawKey.substring(0, 120);

      // Check if already sent (Idempotency Guard)
      if (!options?.forceResend) {
        try {
          const alreadySent = await isNotificationAlreadySent(idempotencyKey, channel);
          if (alreadySent) {
            console.log(`[NotificationService] Skipping duplicate notification for appointment ${appointment.codigo} on channel ${channel} (Key: ${idempotencyKey})`);
            results.push({
              channel,
              recipient: channel === 'email' ? (appointment.email || 'sin_email') : (appointment.telefono || 'sin_telefono'),
              status: 'skipped',
              success: true,
              message: 'Notificación ya enviada previamente (idempotencia verificada)',
              idempotencyKey,
              sentAt: new Date().toISOString()
            });
            continue;
          }
        } catch (checkErr) {
          console.error('[NotificationService] Error checking idempotency:', checkErr);
        }
      }

      // Execute provider dispatch
      try {
        const sendResult = await provider.sendCancellation(cancellationData, {
          idempotencyKey,
          metadata: options?.metadata
        });

        // Persist notification log
        const logId = `notif-${channel}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        const logEntry: NotificationLog = {
          id: logId,
          appointmentId: appointment.id,
          channel,
          recipient: sendResult.recipient,
          notificationType: 'appointment_cancellation',
          status: sendResult.status,
          subject: sendResult.subject,
          message: sendResult.message,
          idempotencyKey,
          error: sendResult.error,
          sentAt: sendResult.sentAt || new Date().toISOString(),
          metadata: {
            codigo: appointment.codigo,
            fecha: appointment.fecha,
            horaInicio: appointment.horaInicio,
            servicioNombre: appointment.servicioNombre,
            motivoCancelacion,
            ...options?.metadata
          }
        };

        await createNotificationLog(logEntry);
        results.push(sendResult);
      } catch (sendErr: any) {
        console.error(`[NotificationService] Uncaught error sending notification via ${channel}:`, sendErr);
        results.push({
          channel,
          recipient: channel === 'email' ? (appointment.email || 'desconocido') : (appointment.telefono || 'desconocido'),
          status: 'failed',
          success: false,
          error: sendErr?.message || 'Error desconocido al enviar notificación',
          idempotencyKey,
          sentAt: new Date().toISOString()
        });
      }
    }

    return results;
  }
}

// Export singleton instance
export const notificationService = NotificationService.getInstance();
