import dotenv from 'dotenv';
dotenv.config();

import { GmailSmtpEmailNotificationProvider } from '../src/server/notifications/gmailSmtpEmailProvider.js';

function maskEmail(email: string): string {
  if (!email) return '';
  const parts = email.split('@');
  if (parts.length !== 2) return '***';
  const user = parts[0];
  const maskedUser = user.length <= 2 ? user[0] + '***' : user.slice(0, 2) + '***' + user.slice(-1);
  return maskedUser + '@' + parts[1];
}

async function runSmokeTest() {
  console.log('======================================================');
  console.log('💅 GWEN NAILS - GMAIL SMTP EMAIL INTEGRATION SMOKE TEST');
  console.log('======================================================');

  const provider = new GmailSmtpEmailNotificationProvider();

  const deliveryEnv = provider.getDeliveryEnv();
  const isConfigured = provider.isConfigured();
  const realSendEnabled = provider.isRealSendInTestEnabled();
  const userEmail = provider.getUser();
  const subjectPrefix = provider.getSubjectPrefix();
  const targetEmail = (process.env.GMAIL_TEST_TO || '').trim();
  const allowedRecipientsSet = provider.getAllowedRecipients();

  console.log(`📋 Configuración Actual:`);
  console.log(`  - Modo de Proveedor: gmail_smtp`);
  console.log(`  - Entorno de Envío (Delivery Env): ${deliveryEnv}`);
  console.log(`  - Credenciales Gmail Configuradas: ${isConfigured ? 'SÍ ✅' : 'NO ❌'}`);
  console.log(`  - Envíos Reales en Test Habilitados (GMAIL_ENABLE_REAL_SEND_IN_TEST): ${realSendEnabled ? 'SÍ ✅' : 'NO ❌'}`);
  console.log(`  - Remitente / Usuario SMTP: ${userEmail ? maskEmail(userEmail) : 'AUSENTE'}`);
  console.log(`  - Prefijo de Asunto: "${subjectPrefix}"`);
  console.log(`  - Destinatarios Autorizados (${allowedRecipientsSet.size}): ${Array.from(allowedRecipientsSet).map(e => maskEmail(e)).join(', ') || 'NINGUNO'}`);

  if (deliveryEnv !== 'test') {
    console.error(`\n❌ ERROR: EMAIL_DELIVERY_ENV debe ser 'test' para ejecutar este smoke test. (Actual: ${deliveryEnv})`);
    process.exit(1);
  }

  if (!realSendEnabled) {
    console.error(`\n❌ ERROR: GMAIL_ENABLE_REAL_SEND_IN_TEST debe configurarse en 'true' para permitir el despacho real.`);
    process.exit(1);
  }

  if (!targetEmail) {
    console.error(`\n❌ ERROR: GMAIL_TEST_TO no está definido en las variables de entorno.`);
    process.exit(1);
  }

  console.log(`\n🎯 Destinatario Objetivo: ${maskEmail(targetEmail)}`);
  const isAllowed = provider.isRecipientAllowed(targetEmail);
  console.log(`  - ¿Autorizado por allowlist?: ${isAllowed ? 'SÍ ✅' : 'NO ❌'}`);

  if (!isAllowed) {
    console.error(`\n❌ ERROR: El destinatario objetivo no se encuentra en GMAIL_TEST_ALLOWED_RECIPIENTS.`);
    process.exit(1);
  }

  const subject = `${subjectPrefix} Prueba de configuración Gmail`;
  const textContent = 'Este es un correo de prueba genérico generado para verificar la integración de Gmail SMTP en Gwen Nails.\n\nEntorno de pruebas / Testing.';
  const htmlContent = '<div style="font-family:sans-serif;padding:20px;"><h2>Gwen Nails - Prueba de Configuración Gmail SMTP</h2><p>Este es un correo de prueba genérico generado para verificar la integración de Gmail SMTP en Gwen Nails.</p><p><strong>Entorno de pruebas / Testing</strong></p></div>';

  const idempotencyKey = `smoke-test-gmail-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

  console.log('\n🚀 Ejecutando intento de despacho único...');
  const result = await provider.sendTestEmail(targetEmail, subject, htmlContent, textContent, {
    idempotencyKey
  });

  console.log('\n📊 Resultado del Despacho:');
  console.log(`  - Estado: ${result.status}`);
  console.log(`  - Éxito (Success): ${result.success}`);
  console.log(`  - Asunto: "${result.subject}"`);
  console.log(`  - Clave Idempotente: ${result.idempotencyKey}`);
  if (result.providerMessageId) {
    console.log(`  - Provider Message ID (MessageID): ${result.providerMessageId}`);
  }
  if (result.error) {
    console.log(`  - Error / Detalle: ${result.error}`);
  }
  if (result.sentAt) {
    console.log(`  - Fecha/Hora de Envío (sentAt): ${result.sentAt}`);
  }

  console.log('======================================================');
  if (result.success) {
    console.log('✅ Despacho completado con éxito.');
  } else {
    console.log('❌ El despacho falló o fue bloqueado por política de seguridad.');
    process.exit(1);
  }
  console.log('======================================================');
}

runSmokeTest().catch(err => {
  console.error('Fatal smoke test error:', err);
  process.exit(1);
});
