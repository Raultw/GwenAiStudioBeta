/**
 * Smoke Test Script for Resend Email Integration in Gwen Nails (Testing Environment)
 * 
 * Usage:
 *   npx tsx scripts/smoke_test_resend.ts [recipient_email]
 * 
 * Environment variables used:
 *   EMAIL_PROVIDER_MODE=resend
 *   EMAIL_DELIVERY_ENV=test
 *   RESEND_API_KEY=re_...
 *   RESEND_FROM_EMAIL=onboarding@resend.dev
 *   RESEND_FROM_NAME="Gwen Nails"
 *   RESEND_ENABLE_REAL_SEND_IN_TEST=true
 *   RESEND_TEST_ALLOWED_RECIPIENTS=admin@example.com,test@example.com
 *   RESEND_TEST_SUBJECT_PREFIX=[TEST Gwen Nails]
 */

import { ResendEmailNotificationProvider } from '../src/server/notifications/resendEmailProvider.js';
import { CancellationNotificationData } from '../src/server/notifications/types.js';

async function main() {
  console.log('\n======================================================');
  console.log('💅 GWEN NAILS - RESEND EMAIL INTEGRATION SMOKE TEST');
  console.log('======================================================\n');

  const provider = new ResendEmailNotificationProvider();

  console.log('📋 Configuración Actual:');
  console.log(`  - Modo de Proveedor: ${process.env.EMAIL_PROVIDER_MODE || '(default)'}`);
  console.log(`  - Entorno de Envío (Delivery Env): ${provider.getDeliveryEnv()}`);
  console.log(`  - API Key Configurada: ${provider.isConfigured() ? 'SÍ (oculta)' : 'NO'}`);
  console.log(`  - Envíos Reales en Test Habilitados: ${provider.isRealSendInTestEnabled() ? 'SÍ' : 'NO (RESEND_ENABLE_REAL_SEND_IN_TEST=true)'}`);
  console.log(`  - Remitente: ${provider.getFromName()} <${provider.getFromEmail()}>`);
  console.log(`  - Prefijo de Asunto: "${provider.getSubjectPrefix()}"`);
  
  const allowedSet = provider.getAllowedRecipients();
  console.log(`  - Destinatarios Autorizados (${allowedSet.size}):`, Array.from(allowedSet).map(e => ResendEmailNotificationProvider.maskEmail(e)).join(', ') || '(ninguno configurado)');

  const targetEmail = (process.argv[2] || process.env.RESEND_TEST_TO || Array.from(allowedSet)[0] || 'onboarding@resend.dev').trim();
  console.log(`\n🎯 Destinatario Objetivo: ${ResendEmailNotificationProvider.maskEmail(targetEmail)}`);

  const isAllowed = provider.isRecipientAllowed(targetEmail);
  console.log(`  - ¿Autorizado por allowlist?: ${isAllowed ? 'SÍ ✅' : 'NO ❌'}`);

  const subject = '[TEST Gwen Nails] Prueba de configuración Resend';
  const textContent = 'Este es un correo de prueba genérico generado para verificar la integración de Resend en Gwen Nails.\n\nEntorno de pruebas / Testing.';
  const htmlContent = '<div style="font-family:sans-serif;padding:20px;"><h2>Gwen Nails - Prueba de Configuración</h2><p>Este es un correo de prueba genérico generado para verificar la integración de Resend en Gwen Nails.</p><p><strong>Entorno de pruebas / Testing</strong></p></div>';

  const idempotencyKey = `smoke-test-real-v2-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

  console.log('\n🚀 Ejecutando intento de despacho...');
  const result = await provider.sendTestEmail(targetEmail, subject, htmlContent, textContent, {
    idempotencyKey
  });

  console.log('\n📊 Resultado del Despacho:');
  console.log(`  - Estado: ${result.status}`);
  console.log(`  - Éxito (Success): ${result.success}`);
  console.log(`  - Asunto: "${result.subject}"`);
  console.log(`  - Clave Idempotente: ${result.idempotencyKey}`);
  if (result.providerMessageId) {
    console.log(`  - Provider Message ID: ${result.providerMessageId}`);
  }
  if (result.sentAt) {
    console.log(`  - Fecha/Hora de Envío (sentAt): ${result.sentAt}`);
  }
  if (result.error) {
    console.log(`  - Detalle del Error / Rechazo: ${result.error}`);
  }

  console.log('\n======================================================');
  if (result.status === 'sent') {
    console.log('✅ Despacho completado con éxito.');
  } else if (result.status === 'failed' && result.error === 'real_test_delivery_disabled') {
    console.log('ℹ️ Despacho bloqueado de forma segura: configure RESEND_ENABLE_REAL_SEND_IN_TEST=true en .env para habilitar llamadas de red en testing.');
  } else if (result.status === 'failed' && result.error === 'test_recipient_not_allowed') {
    console.log('ℹ️ Despacho bloqueado de forma segura: el email no está en RESEND_TEST_ALLOWED_RECIPIENTS.');
  } else if (result.status === 'failed' && result.error === 'missing_api_key') {
    console.log('ℹ️ Despacho bloqueado: configure RESEND_API_KEY en .env');
  } else {
    console.log(`⚠️ Estado: ${result.status} (${result.error || 'sin error'})`);
  }
  console.log('======================================================\n');
}

main().catch(err => {
  console.error('Error fatal en smoke test:', err);
});
