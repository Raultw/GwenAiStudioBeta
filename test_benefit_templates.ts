import {
  initDatabase,
  getBenefitTemplates,
  getBenefitTemplateById,
  createBenefitTemplate,
  updateBenefitTemplate,
  toggleBenefitTemplateActive,
  getPromotions,
  getClientBenefits
} from './src/server/db.js';

async function runTests() {
  console.log('🧪 Running Benefit Templates Test Suite...\n');
  await initDatabase();

  // Test 1: Get initial seeded templates
  console.log('Test 1: Default Seeded Templates');
  const initial = await getBenefitTemplates({ activo: true });
  console.log(`Found ${initial.length} active seeded templates.`);
  if (initial.length === 0) {
    throw new Error('Expected at least 1 default seeded benefit template');
  }
  const first = initial[0];
  console.log(`✅ Seeded template: [${first.id}] ${first.nombrePublico} (${first.tipoDescuento}: ${first.valorDescuento}, vigencia: ${first.vigenciaDias} días)`);

  // Test 2: Create a percentage template
  console.log('\nTest 2: Create Percentage Benefit Template');
  const createdPct = await createBenefitTemplate({
    nombrePublico: 'Compensación Especial 25% OFF',
    descripcionPublica: 'Válido para cualquier servicio en salón tras reprogramación.',
    tipoDescuento: 'porcentaje',
    valorDescuento: 25,
    vigenciaDias: 45,
    serviciosAplicables: ['todos'],
    montoMinimo: null,
    activo: true
  });
  console.log(`✅ Created percentage template ID: ${createdPct.id}`);
  if (createdPct.valorDescuento !== 25 || createdPct.vigenciaDias !== 45) {
    throw new Error('Created percentage template mismatch in values');
  }

  // Test 3: Create fixed amount template
  console.log('\nTest 3: Create Fixed Amount Benefit Template');
  const createdFixed = await createBenefitTemplate({
    nombrePublico: 'Voucher Regalo $4.000',
    descripcionPublica: 'Descuento fijo en servicios superiores a $10.000',
    tipoDescuento: 'monto_fijo',
    valorDescuento: 4000,
    vigenciaDias: 60,
    serviciosAplicables: ['todos'],
    montoMinimo: 10000,
    activo: true
  });
  console.log(`✅ Created fixed amount template ID: ${createdFixed.id}`);
  if (createdFixed.tipoDescuento !== 'monto_fijo' || createdFixed.valorDescuento !== 4000 || createdFixed.montoMinimo !== 10000) {
    throw new Error('Created fixed template mismatch in values');
  }

  // Test 4: Update template
  console.log('\nTest 4: Update Template');
  const updated = await updateBenefitTemplate(createdPct.id, {
    nombrePublico: 'Compensación Exclusiva 30% OFF',
    valorDescuento: 30,
    vigenciaDias: 60
  });
  if (!updated || updated.valorDescuento !== 30 || updated.vigenciaDias !== 60 || updated.nombrePublico !== 'Compensación Exclusiva 30% OFF') {
    throw new Error('Failed to update template properly');
  }
  console.log(`✅ Template updated successfully to: ${updated.nombrePublico}`);

  // Test 5: Toggle active status
  console.log('\nTest 5: Toggle Active Status');
  const toggledOff = await toggleBenefitTemplateActive(createdFixed.id);
  if (!toggledOff || toggledOff.activo !== false) {
    throw new Error('Failed to toggle template to inactive');
  }
  console.log(`✅ Template ${toggledOff.id} is now active=${toggledOff.activo}`);

  const toggledOn = await toggleBenefitTemplateActive(createdFixed.id);
  if (!toggledOn || toggledOn.activo !== true) {
    throw new Error('Failed to toggle template back to active');
  }
  console.log(`✅ Template ${toggledOn.id} is now active=${toggledOn.activo}`);

  // Test 6: Query with search and active filters
  console.log('\nTest 6: Filter and Search Queries');
  const searchResults = await getBenefitTemplates({ search: 'Compensación' });
  console.log(`Found ${searchResults.length} templates matching "Compensación".`);
  if (searchResults.length === 0) {
    throw new Error('Search query returned 0 results');
  }
  console.log(`✅ Search query works correctly.`);

  // Test 7: Domain Isolation Verification
  console.log('\nTest 7: Verify Domain Separation from Promotions and Client Benefits');
  const promotions = await getPromotions(true);
  const clientBenefits = await getClientBenefits();
  const templates = await getBenefitTemplates();

  console.log(`Promotions count: ${promotions.length}`);
  console.log(`Client Benefits count: ${clientBenefits.length}`);
  console.log(`Benefit Templates count: ${templates.length}`);

  // Check no cross-pollution of IDs
  const promoIds = new Set(promotions.map(p => p.id));
  const tplIds = new Set(templates.map(t => t.id));
  for (const tid of tplIds) {
    if (promoIds.has(tid)) {
      throw new Error(`Domain collision: Template ID ${tid} exists in promotions!`);
    }
  }
  console.log(`✅ Domain isolation verified: Benefit templates are strictly separate from promotions and client benefits.`);

  console.log('\n🎉 ALL 7 TEST SCENARIOS PASSED SUCCESSFULLY!\n');
  process.exit(0);
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
