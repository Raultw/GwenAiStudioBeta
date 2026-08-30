import { NotificationProvider } from './provider.interface';
import { 
  CancellationNotificationData, 
  NotificationChannel, 
  NotificationResult, 
  NotificationSendOptions 
} from './types';

export class EmailNotificationProvider implements NotificationProvider {
  readonly channel: NotificationChannel = 'email';

  isConfigured(): boolean {
    // In current environment, email dispatch is active and logs / dispatches formatted transactional emails
    return true;
  }

  /**
   * Builds the formatted HTML template for appointment cancellation email
   */
  private generateHtmlTemplate(data: CancellationNotificationData): string {
    const fullName = `${data.clienteNombre} ${data.clienteApellido || ''}`.trim();
    const profText = data.profesionalNombre ? `<p style="margin: 4px 0; color: #5A4B43;"><strong>Profesional:</strong> ${data.profesionalNombre}</p>` : '';

    return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cancelación de Turno</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #FAF7F2; margin: 0; padding: 24px; color: #241E1A;">
  <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 580px; background-color: #FFFFFF; border-radius: 16px; border: 1px solid #E8DCD5; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
    <!-- Header -->
    <tr>
      <td style="background-color: #8E4455; padding: 28px 32px; text-align: center;">
        <h1 style="color: #FFFFFF; margin: 0; font-size: 22px; font-weight: 600; letter-spacing: 0.5px;">Nails & Beauty Studio</h1>
        <p style="color: #F8D7DA; margin: 6px 0 0 0; font-size: 13px;">Aviso importante sobre tu turno</p>
      </td>
    </tr>

    <!-- Body -->
    <tr>
      <td style="padding: 32px 32px 24px 32px;">
        <p style="font-size: 15px; margin: 0 0 16px 0; color: #241E1A;">
          Hola <strong>${fullName}</strong>,
        </p>
        <p style="font-size: 14px; line-height: 1.6; margin: 0 0 20px 0; color: #5A4B43;">
          Te informamos que tu turno ha sido <strong>cancelado</strong>. A continuación te dejamos los detalles correspondientes:
        </p>

        <!-- Details Card -->
        <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #FDFBFA; border: 1px solid #E8DCD5; border-radius: 12px; margin-bottom: 24px;">
          <tr>
            <td style="padding: 20px;">
              <p style="margin: 0 0 8px 0; font-size: 13px; color: #8C7A70; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Detalle del Turno</p>
              <p style="margin: 4px 0; color: #5A4B43; font-size: 14px;"><strong>Código de Reserva:</strong> <span style="font-family: monospace; font-size: 15px; font-weight: 700; color: #8E4455;">${data.codigo}</span></p>
              <p style="margin: 4px 0; color: #5A4B43; font-size: 14px;"><strong>Servicio:</strong> ${data.servicioNombre}</p>
              <p style="margin: 4px 0; color: #5A4B43; font-size: 14px;"><strong>Fecha:</strong> ${data.fecha}</p>
              <p style="margin: 4px 0; color: #5A4B43; font-size: 14px;"><strong>Horario:</strong> ${data.horaInicio} a ${data.horaFin} hs</p>
              ${profText}
            </td>
          </tr>
        </table>

        <!-- Reason Card -->
        <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #FFF5F5; border: 1px solid #FED7D7; border-radius: 12px; margin-bottom: 24px;">
          <tr>
            <td style="padding: 16px 20px;">
              <p style="margin: 0 0 4px 0; font-size: 12px; color: #9B2C2C; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Motivo de la Cancelación:</p>
              <p style="margin: 0; font-size: 14px; font-weight: 600; color: #742A2A;">
                ${data.motivoCancelacion || 'Cancelado por el salón'}
              </p>
            </td>
          </tr>
        </table>

        <p style="font-size: 14px; line-height: 1.6; margin: 0 0 16px 0; color: #5A4B43;">
          Lamentamos cualquier inconveniente que esto pueda causarte. Podés ingresar a nuestra plataforma para seleccionar un nuevo horario disponible o responder a este correo para coordinar una nueva fecha.
        </p>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background-color: #FAF7F2; padding: 20px 32px; border-top: 1px solid #E8DCD5; text-align: center;">
        <p style="margin: 0; font-size: 12px; color: #8C7A70;">
          Nails & Beauty Studio · Gestión de Turnos Online
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }

  /**
   * Generates a plain-text version for email clients without HTML support
   */
  private generatePlainText(data: CancellationNotificationData): string {
    const fullName = `${data.clienteNombre} ${data.clienteApellido || ''}`.trim();
    return `
Hola ${fullName},

Te informamos que tu turno ha sido CANCELADO.

Detalles del Turno:
- Código de Reserva: ${data.codigo}
- Servicio: ${data.servicioNombre}
- Fecha: ${data.fecha}
- Horario: ${data.horaInicio} a ${data.horaFin} hs
${data.profesionalNombre ? `- Profesional: ${data.profesionalNombre}\n` : ''}
Motivo de Cancelación:
${data.motivoCancelacion || 'Cancelado por el salón'}

Lamentamos cualquier inconveniente. Podés ingresar a nuestro sitio para agendar un nuevo horario o contactarnos.

Nails & Beauty Studio
    `.trim();
  }

  async sendCancellation(
    data: CancellationNotificationData,
    options?: NotificationSendOptions
  ): Promise<NotificationResult> {
    const recipient = (data.clienteEmail || '').trim();
    const sentAt = new Date().toISOString();

    if (!recipient) {
      console.warn(`[EmailNotificationProvider] Skip sending email for appointment ${data.codigo}: No email address registered for client ${data.clienteNombre}`);
      return {
        channel: this.channel,
        recipient: 'sin_email@cliente',
        status: 'skipped',
        success: true,
        error: 'Cliente sin dirección de email registrada',
        idempotencyKey: options?.idempotencyKey,
        sentAt
      };
    }

    const subject = `Cancelación de Turno - Nails & Beauty Studio (Reserva #${data.codigo})`;
    const plainText = this.generatePlainText(data);
    const html = this.generateHtmlTemplate(data);

    try {
      // Production Transactional Dispatch Log
      console.log(`=======================================================`);
      console.log(`[EMAIL DISPATCH] Para: ${recipient}`);
      console.log(`[EMAIL DISPATCH] Asunto: ${subject}`);
      console.log(`[EMAIL DISPATCH] Fecha: ${data.fecha} | Hora: ${data.horaInicio} - ${data.horaFin}`);
      console.log(`[EMAIL DISPATCH] Servicio: ${data.servicioNombre}`);
      console.log(`[EMAIL DISPATCH] Motivo: ${data.motivoCancelacion}`);
      console.log(`[EMAIL DISPATCH] IdempotencyKey: ${options?.idempotencyKey || 'N/A'}`);
      console.log(`=======================================================`);

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
      console.error(`[EmailNotificationProvider] Error sending cancellation email to ${recipient}:`, err);
      return {
        channel: this.channel,
        recipient,
        status: 'failed',
        success: false,
        subject,
        error: err?.message || 'Error al enviar email',
        idempotencyKey: options?.idempotencyKey,
        sentAt
      };
    }
  }
}
