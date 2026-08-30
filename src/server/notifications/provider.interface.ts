import { 
  CancellationNotificationData, 
  NotificationChannel, 
  NotificationResult, 
  NotificationSendOptions 
} from './types';

export interface NotificationProvider {
  readonly channel: NotificationChannel;
  
  /**
   * Check if this notification provider is fully configured and ready to send.
   */
  isConfigured(): boolean;

  /**
   * Dispatches a cancellation notification for an appointment.
   */
  sendCancellation(
    data: CancellationNotificationData,
    options?: NotificationSendOptions
  ): Promise<NotificationResult>;
}
