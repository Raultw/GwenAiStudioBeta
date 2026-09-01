/**
 * Centralized Date Utilities for Gwen Nails
 * 
 * Standard Conventions:
 * - Business Timezone: America/Argentina/Buenos_Aires (UTC-3)
 * - User Display Date: DD/MM/YYYY
 * - User Display Date + Time: DD/MM/YYYY HH:mm
 * - Internal / REST API Calendar Date: YYYY-MM-DD
 * - Internal Timestamp: ISO 8601 / UTC (e.g. 2026-08-30T18:30:00.000Z)
 */

export const TIMEZONE_AR = 'America/Argentina/Buenos_Aires';

/**
 * Checks if a given year is a leap year.
 */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Returns the number of days in a given month of a given year (1-indexed month: 1 = Jan, 12 = Dec).
 */
export function getDaysInMonth(year: number, month: number): number {
  if (month < 1 || month > 12) return 0;
  const daysMap = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return daysMap[month - 1];
}

/**
 * Returns current business date in Argentina as YYYY-MM-DD.
 * If a reference date/timestamp is provided, converts that instant to Argentina calendar date.
 */
export function getBusinessDate(date?: Date | string | number | null): string {
  const d = date ? (typeof date === 'string' || typeof date === 'number' ? new Date(date) : date) : new Date();
  if (isNaN(d.getTime())) return '';

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE_AR,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  // 'en-CA' outputs YYYY-MM-DD
  return formatter.format(d);
}

/**
 * Returns date and time breakdown in Argentina timezone.
 */
export function getBusinessDateTimeParts(date?: Date | string | number | null): {
  dateStr: string;
  timeStr: string;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
} {
  const d = date ? (typeof date === 'string' || typeof date === 'number' ? new Date(date) : date) : new Date();
  if (isNaN(d.getTime())) {
    return { dateStr: '', timeStr: '', year: 0, month: 0, day: 0, hour: 0, minute: 0 };
  }

  const formatter = new Intl.DateTimeFormat('es-AR', {
    timeZone: TIMEZONE_AR,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    hourCycle: 'h23'
  });

  const parts = formatter.formatToParts(d);
  let year = 0;
  let month = 0;
  let day = 0;
  let hour = 0;
  let minute = 0;

  for (const p of parts) {
    if (p.type === 'year') year = Number(p.value);
    if (p.type === 'month') month = Number(p.value);
    if (p.type === 'day') day = Number(p.value);
    if (p.type === 'hour') hour = Number(p.value);
    if (p.type === 'minute') minute = Number(p.value);
  }

  const yyyy = String(year).padStart(4, '0');
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  const hh = String(hour).padStart(2, '0');
  const min = String(minute).padStart(2, '0');

  return {
    dateStr: `${yyyy}-${mm}-${dd}`,
    timeStr: `${hh}:${min}`,
    year,
    month,
    day,
    hour,
    minute
  };
}

/**
 * Validates whether an ISO string YYYY-MM-DD is a real calendar date.
 */
export function isValidIsoDate(isoDate: string): boolean {
  if (!isoDate || typeof isoDate !== 'string') return false;
  const match = isoDate.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (year < 1900 || year > 2200) return false;
  if (month < 1 || month > 12) return false;
  const maxDays = getDaysInMonth(year, month);
  if (day < 1 || day > maxDays) return false;

  return true;
}

/**
 * Strictly parses and validates DD/MM/YYYY into YYYY-MM-DD.
 * Returns null if the format or date is invalid.
 */
export function arDateToIso(arDate: string | null | undefined): string | null {
  if (!arDate || typeof arDate !== 'string') return null;
  const trimmed = arDate.trim();
  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);

  if (year < 1900 || year > 2200) return null;
  if (month < 1 || month > 12) return null;
  const maxDays = getDaysInMonth(year, month);
  if (day < 1 || day > maxDays) return null;

  const yyyy = String(year).padStart(4, '0');
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Alias for arDateToIso to support strict parsing requirement.
 */
export function parseDateAR(value: string): string | null {
  return arDateToIso(value);
}

/**
 * Converts a YYYY-MM-DD string directly to DD/MM/YYYY without timezone shift.
 */
export function isoDateToAR(isoDate: string | null | undefined): string {
  if (!isoDate || typeof isoDate !== 'string') return '';
  const trimmed = isoDate.trim();
  
  // If string contains date portion YYYY-MM-DD
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, yyyy, mm, dd] = match;
    return `${dd}/${mm}/${yyyy}`;
  }

  // If already DD/MM/YYYY, return as is
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
    return trimmed;
  }

  return trimmed;
}

/**
 * Formats any date value (YYYY-MM-DD string, Date object, ISO timestamp) into DD/MM/YYYY.
 */
export function formatDateAR(value: string | Date | null | undefined): string {
  if (!value) return '';

  if (typeof value === 'string') {
    const trimmed = value.trim();
    // If it's pure YYYY-MM-DD, direct component transform
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return isoDateToAR(trimmed);
    }
    // If it has timestamp or other format
    if (trimmed.includes('T') || trimmed.includes(':') || trimmed.includes('Z')) {
      const d = new Date(trimmed);
      if (!isNaN(d.getTime())) {
        const parts = getBusinessDateTimeParts(d);
        if (parts.dateStr) {
          return isoDateToAR(parts.dateStr);
        }
      }
    }
    // If it's already DD/MM/YYYY
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed)) {
      const [d, m, y] = trimmed.split('/');
      return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
    }
    // Try iso date conversion fallback
    return isoDateToAR(trimmed);
  }

  if (value instanceof Date) {
    if (isNaN(value.getTime())) return '';
    const parts = getBusinessDateTimeParts(value);
    return isoDateToAR(parts.dateStr);
  }

  return '';
}

/**
 * Formats a timestamp (ISO string or Date) into DD/MM/YYYY HH:mm in Argentina timezone.
 */
export function formatDateTimeAR(value: string | Date | null | undefined): string {
  if (!value) return '';

  let d: Date;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    // If it's purely YYYY-MM-DD without time, return date only
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return isoDateToAR(trimmed);
    }
    d = new Date(trimmed);
  } else if (value instanceof Date) {
    d = value;
  } else {
    return '';
  }

  if (isNaN(d.getTime())) return typeof value === 'string' ? value : '';

  const { dateStr, timeStr } = getBusinessDateTimeParts(d);
  if (!dateStr) return '';
  return `${isoDateToAR(dateStr)} ${timeStr}`;
}

/**
 * Formats date to long Spanish format (e.g. "30 de agosto de 2026")
 */
export function formatDateLongAR(value: string | Date | null | undefined): string {
  if (!value) return '';

  let dateObj: Date;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [y, m, d] = trimmed.split('-').map(Number);
      dateObj = new Date(y, m - 1, d, 12, 0, 0); // safe noon local
    } else {
      dateObj = new Date(trimmed);
    }
  } else {
    dateObj = value;
  }

  if (isNaN(dateObj.getTime())) return '';

  return new Intl.DateTimeFormat('es-AR', {
    timeZone: TIMEZONE_AR,
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(dateObj);
}

/**
 * Formats date with day of week (e.g. "Sábado 30/08/2026" or "Sábado, 30 de agosto")
 */
export function formatDateWithWeekdayAR(value: string | Date | null | undefined, format: 'short' | 'long' = 'short'): string {
  if (!value) return '';

  let dateObj: Date;
  let isoDate = '';
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      isoDate = trimmed;
      const [y, m, d] = trimmed.split('-').map(Number);
      dateObj = new Date(y, m - 1, d, 12, 0, 0);
    } else {
      dateObj = new Date(trimmed);
      isoDate = getBusinessDate(dateObj);
    }
  } else {
    dateObj = value;
    isoDate = getBusinessDate(dateObj);
  }

  if (isNaN(dateObj.getTime())) return '';

  const weekday = new Intl.DateTimeFormat('es-AR', {
    timeZone: TIMEZONE_AR,
    weekday: 'long'
  }).format(dateObj);

  const capitalizedWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1);

  if (format === 'long') {
    const dayAndMonth = new Intl.DateTimeFormat('es-AR', {
      timeZone: TIMEZONE_AR,
      day: 'numeric',
      month: 'long'
    }).format(dateObj);
    return `${capitalizedWeekday}, ${dayAndMonth}`;
  }

  return `${capitalizedWeekday} ${isoDateToAR(isoDate)}`;
}

/**
 * Checks if a target date (YYYY-MM-DD) is within a start and end range inclusively.
 * Comparison is purely lexical on YYYY-MM-DD strings.
 */
export function isDateWithinRange(targetDate: string, startDate?: string | null, endDate?: string | null): boolean {
  if (!targetDate) return false;
  if (startDate && targetDate < startDate) return false;
  if (endDate && targetDate > endDate) return false;
  return true;
}

/**
 * Adds an integer number of days to an ISO calendar date (YYYY-MM-DD).
 * Uses UTC date calculations to avoid Daylight Saving / local time offset drift.
 */
export function addDaysToIsoDate(isoDate: string, days: number): string {
  if (!isoDate || typeof isoDate !== 'string') return '';
  const match = isoDate.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return '';
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const dateUtc = new Date(Date.UTC(year, month - 1, day + days, 12, 0, 0));
  const yyyy = dateUtc.getUTCFullYear();
  const mm = String(dateUtc.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dateUtc.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
