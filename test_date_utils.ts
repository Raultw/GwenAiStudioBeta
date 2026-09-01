import {
  getBusinessDate,
  getBusinessDateTimeParts,
  formatDateAR,
  formatDateTimeAR,
  isoDateToAR,
  arDateToIso,
  parseDateAR,
  isValidIsoDate,
  isLeapYear,
  getDaysInMonth,
  formatDateLongAR,
  formatDateWithWeekdayAR
} from './src/utils/dateUtils.js';

console.log('--- TESTING DATE UTILS ---');

// 1. Visual Conversion
console.assert(isoDateToAR('2026-08-30') === '30/08/2026', 'isoDateToAR 2026-08-30 failed');
console.assert(isoDateToAR('2027-01-01') === '01/01/2027', 'isoDateToAR 2027-01-01 failed');
console.assert(isoDateToAR('2028-02-29') === '29/02/2028', 'isoDateToAR 2028-02-29 failed');
console.assert(isoDateToAR(null) === '', 'isoDateToAR null failed');
console.assert(isoDateToAR(undefined) === '', 'isoDateToAR undefined failed');
console.assert(formatDateAR('2026-08-30') === '30/08/2026', 'formatDateAR string failed');
console.assert(formatDateAR(null) === '', 'formatDateAR null failed');

// 2. Strict Parsing
console.assert(arDateToIso('30/08/2026') === '2026-08-30', 'arDateToIso 30/08/2026 failed');
console.assert(arDateToIso('01/01/2027') === '2027-01-01', 'arDateToIso 01/01/2027 failed');
console.assert(arDateToIso('29/02/2028') === '2028-02-29', 'arDateToIso 29/02/2028 (leap year) failed');

// Rejections
console.assert(arDateToIso('31/02/2026') === null, 'arDateToIso 31/02/2026 should be null');
console.assert(arDateToIso('29/02/2027') === null, 'arDateToIso 29/02/2027 (non-leap) should be null');
console.assert(arDateToIso('30/13/2026') === null, 'arDateToIso 30/13/2026 should be null');
console.assert(arDateToIso('00/08/2026') === null, 'arDateToIso 00/08/2026 should be null');
console.assert(arDateToIso('30/00/2026') === null, 'arDateToIso 30/00/2026 should be null');
console.assert(arDateToIso('abc') === null, 'arDateToIso abc should be null');
console.assert(arDateToIso('30-08-2026') === null, 'arDateToIso 30-08-2026 should be null');

// 3. Timezone test cases (UTC to Argentina UTC-3)
// 2026-08-31T00:00:00Z -> 2026-08-30 21:00 in Argentina -> date is 2026-08-30 -> '30/08/2026'
const tz1 = new Date('2026-08-31T00:00:00Z');
console.assert(getBusinessDate(tz1) === '2026-08-30', `tz1 getBusinessDate failed: ${getBusinessDate(tz1)}`);
console.assert(formatDateAR(tz1) === '30/08/2026', `tz1 formatDateAR failed: ${formatDateAR(tz1)}`);
console.assert(formatDateTimeAR('2026-08-31T00:00:00Z') === '30/08/2026 21:00', `tz1 formatDateTimeAR failed: ${formatDateTimeAR('2026-08-31T00:00:00Z')}`);

// 2026-08-31T02:59:59Z -> 2026-08-30 23:59:59 in Argentina -> date is 2026-08-30 -> '30/08/2026'
const tz2 = new Date('2026-08-31T02:59:59Z');
console.assert(getBusinessDate(tz2) === '2026-08-30', `tz2 getBusinessDate failed: ${getBusinessDate(tz2)}`);
console.assert(formatDateAR(tz2) === '30/08/2026', `tz2 formatDateAR failed: ${formatDateAR(tz2)}`);
console.assert(formatDateTimeAR('2026-08-31T02:59:59Z') === '30/08/2026 23:59', `tz2 formatDateTimeAR failed: ${formatDateTimeAR('2026-08-31T02:59:59Z')}`);

// 2026-08-31T03:00:00Z -> 2026-08-31 00:00:00 in Argentina -> date is 2026-08-31 -> '31/08/2026'
const tz3 = new Date('2026-08-31T03:00:00Z');
console.assert(getBusinessDate(tz3) === '2026-08-31', `tz3 getBusinessDate failed: ${getBusinessDate(tz3)}`);
console.assert(formatDateAR(tz3) === '31/08/2026', `tz3 formatDateAR failed: ${formatDateAR(tz3)}`);
console.assert(formatDateTimeAR('2026-08-31T03:00:00Z') === '31/08/2026 00:00', `tz3 formatDateTimeAR failed: ${formatDateTimeAR('2026-08-31T03:00:00Z')}`);

console.log('ALL DATE UTILS TESTS PASSED SUCCESSFULLLY!');
