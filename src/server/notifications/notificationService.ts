import { NotificationProvider } from './provider.interface.js';
import { EmailNotificationProvider } from './emailProvider.js';
import { WhatsAppNotificationProvider } from './whatsAppProvider.js';
import {
  CancellationBenefitSnapshot,
  CancellationNotificationData,
  NotificationChannel,
  NotificationLog,
  NotificationResult,
  NotificationSendOptions
} from './types.js';
import { createNotificationLog, isNotificationAlreadySent, acquireNotificationLock } from '../db.js';
import type { Appointment } from '../../types.js';

function maskRecipient(r: string): string {
  if (!r) return '***';
  const parts = r.split('@');
  if (parts.length === 2) {
    const user = parts[0];
    const visible = user.length > 2 ? user.substring(0, 2) : user.substring(0, 1);
    return `${visible}***@${parts[1]}`;
  }
  return `${r.substring(0, Math.min(3, r.length))}***`;
}

export class NotificationService {
  private static instance: NotificationService;
  private providers: Map<NotificationChannel, NotificationProvider> = new Map();

  public constructor(customProviders?: NotificationProvider[]) {
    if (customProviders && customProviders.length > 0) {
      for (const p of customProviders) {
        this.registerProvider(p);
      }
    } else {
      // Register default providers
      this.registerProvider(new EmailNotificationProvider());
      this.registerProvider(new WhatsAppNotificationProvider());
    }
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
      beneficio?: CancellationBenefitSnapshot;
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
      canceladoPor: options?.canceladoPor || appointment.canceladoPor,
      beneficio: options?.beneficio
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

      const recipient = channel === 'email' ? (appointment.email || '').trim() : (appointment.telefono || '').trim();

      // Check if client has no email/recipient -> record 'omitido_sin_email'
      if (!recipient) {
        console.log(`[NotificationService] Skipping notification for appointment ${appointment.codigo} on channel ${channel}: Missing recipient info`);
        const omittedLogId = `notif-${channel}-${appointment.id}`;
        try {
          await createNotificationLog({
            id: omittedLogId,
            appointmentId: appointment.id,
            channel,
            recipient: 'sin_recipiente',
            notificationType: 'appointment_cancellation',
            status: 'omitido_sin_email',
            idempotencyKey,
            sentAt: new Date().toISOString(),
            error: 'no enviado por falta de destinatario',
            metadata: { codigo: appointment.codigo, motivoCancelacion, ...options?.metadata }
          });
        } catch (logErr) {
          console.error('[NotificationService] Error recording omitido_sin_email log:', logErr);
        }
        results.push({
          channel,
          recipient: 'sin_recipiente',
          status: 'omitido_sin_email',
          success: true,
          message: 'Notificación omitida por falta de destinatario',
          idempotencyKey,
          sentAt: new Date().toISOString()
        });
        continue;
      }

      // Ensure initial pending log exists if not already present
      const initialLogId = `notif-${channel}-${appointment.id}`;
      try {
        await createNotificationLog({
          id: initialLogId,
          appointmentId: appointment.id,
          channel,
          recipient,
          notificationType: 'appointment_cancellation',
          status: 'pending',
          idempotencyKey,
          metadata: { codigo: appointment.codigo, motivoCancelacion, ...options?.metadata }
        });
      } catch (initErr) {
        // ignore if conflict/already exists
      }

      // Attempt atomic acquisition of processing lease
      let acquired: any = null;
      try {
        acquired = await acquireNotificationLock(idempotencyKey, channel);
      } catch (lockErr) {
        console.error('[NotificationService] Error acquiring notification lock:', lockErr);
      }

      if (!acquired) {
        // Check if already successfully sent or omitted
        const alreadySent = await isNotificationAlreadySent(idempotencyKey, channel);
        if (alreadySent) {
          results.push({
            channel,
            recipient,
            status: 'skipped',
            success: true,
            message: 'Notificación ya enviada previamente (idempotencia verificada)',
            idempotencyKey,
            sentAt: undefined
          });
        } else {
          results.push({
            channel,
            recipient,
            status: 'skipped',
            success: true,
            message: 'Notificación ya en proceso por otro worker o en espera de reintento',
            idempotencyKey,
            sentAt: undefined
          });
        }
        continue;
      }

      // Execute provider dispatch under acquired lock
      try {
        const sendResult = await provider.sendCancellation(cancellationData, {
          idempotencyKey,
          metadata: options?.metadata
        });

        const currentAttempts = acquired.attemptCount || 1;
        const maxAttempts = acquired.maxAttempts || 3;
        let nextAttemptAt: string | undefined = undefined;

        if (sendResult.status === 'failed' && currentAttempts < maxAttempts) {
          const delaySeconds = Math.min(60 * Math.pow(2, currentAttempts - 1), 3600);
          nextAttemptAt = new Date(Date.now() + delaySeconds * 1000).toISOString();
        }

        const logEntry: NotificationLog = {
          id: acquired.id || initialLogId,
          appointmentId: appointment.id,
          channel,
          recipient: sendResult.recipient || recipient,
          notificationType: 'appointment_cancellation',
          status: sendResult.status,
          subject: sendResult.subject,
          message: sendResult.message,
          idempotencyKey,
          error: sendResult.error,
          sentAt: sendResult.status === 'sent' ? (sendResult.sentAt || new Date().toISOString()) : undefined,
          attemptCount: currentAttempts,
          maxAttempts,
          nextAttemptAt,
          providerMessageId: sendResult.providerMessageId,
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
        console.error(`[NotificationService] Error sending notification via ${channel} to ${maskRecipient(recipient)}:`, sendErr?.message || sendErr);
        const currentAttempts = acquired.attemptCount || 1;
        const maxAttempts = acquired.maxAttempts || 3;
        let nextAttemptAt: string | undefined = undefined;

        if (currentAttempts < maxAttempts) {
          const delaySeconds = Math.min(60 * Math.pow(2, currentAttempts - 1), 3600);
          nextAttemptAt = new Date(Date.now() + delaySeconds * 1000).toISOString();
        }

        const failEntry: NotificationLog = {
          id: acquired.id || initialLogId,
          appointmentId: appointment.id,
          channel,
          recipient,
          notificationType: 'appointment_cancellation',
          status: 'failed',
          idempotencyKey,
          error: sendErr?.message || 'Error desconocido al enviar notificación',
          attemptCount: currentAttempts,
          maxAttempts,
          nextAttemptAt,
          metadata: { codigo: appointment.codigo, motivoCancelacion, ...options?.metadata }
        };
        await createNotificationLog(failEntry);
        results.push({
          channel,
          recipient,
          status: 'failed',
          success: false,
          error: sendErr?.message || 'Error desconocido al enviar notificación',
          idempotencyKey,
          sentAt: undefined
        });
      }
    }

    return results;
  }
}

// Export singleton instance
export const notificationService = NotificationService.getInstance();

