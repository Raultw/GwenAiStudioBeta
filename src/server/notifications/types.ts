export type NotificationChannel = 'email' | 'whatsapp' | 'sms';

export type NotificationType = 
  | 'appointment_cancellation' 
  | 'appointment_confirmation' 
  | 'appointment_reminder'
  | 'availability_exception_cancellation';

export type NotificationStatus = 'sent' | 'failed' | 'skipped' | 'pending' | 'omitido_sin_email' | 'processing';

export interface CancellationBenefitSnapshot {
  titulo: string;
  descripcion?: string;
  tipoDescuento: string;
  valorDescuento: number;
  fechaVencimiento?: string | null;
  codigo?: string;
}

export interface CancellationNotificationData {
  appointmentId: string;
  codigo: string;
  clienteNombre: string;
  clienteApellido?: string;
  clienteEmail?: string;
  clienteTelefono?: string;
  servicioNombre: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  motivoCancelacion: string;
  profesionalNombre?: string;
  origen?: string;
  canceladoPor?: string;
  beneficio?: CancellationBenefitSnapshot;
}

export interface NotificationSendOptions {
  idempotencyKey?: string;
  channels?: NotificationChannel[];
  metadata?: Record<string, any>;
  forceResend?: boolean;
}

export interface NotificationResult {
  channel: NotificationChannel;
  recipient: string;
  status: NotificationStatus;
  success: boolean;
  subject?: string;
  message?: string;
  error?: string;
  idempotencyKey?: string;
  sentAt?: string;
  providerMessageId?: string;
}

export interface NotificationLog {
  id: string;
  appointmentId?: string;
  channel: NotificationChannel;
  recipient: string;
  notificationType: NotificationType | string;
  status: NotificationStatus;
  subject?: string;
  message?: string;
  idempotencyKey?: string;
  error?: string;
  sentAt?: string;
  processingStartedAt?: string;
  leaseExpiresAt?: string;
  attemptCount?: number;
  maxAttempts?: number;
  nextAttemptAt?: string;
  providerMessageId?: string;
  metadata?: Record<string, any>;
}
