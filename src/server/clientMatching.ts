import type { Client } from '../types.js';

/**
 * Normalizes text: converts to lowercase, removes accents/diacritics,
 * removes non-alphanumeric punctuation and collapses extra whitespace.
 */
export function normalizeText(text: string = ''): string {
  return String(text || '')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents (á->a, é->e, í->i, ó->o, ú->u, ñ->n)
    .replace(/[^a-z0-9\s]/g, '') // remove special characters
    .replace(/\s+/g, ' '); // collapse duplicate spaces
}

/**
 * Normalizes person names (clients, etc.):
 * - Trims leading and trailing spaces
 * - Replaces letters with accents by letters without accents (á->a, é->e, etc.)
 * - Replaces uppercase letters with lowercase
 * - Collapses internal consecutive spaces
 */
export function normalizePersonName(name: string = ''): string {
  return String(name || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Normalizes brand names (tips & soft gel brands):
 * - Trims leading and trailing spaces
 * - Replaces letters with accents by letters without accents
 * - Replaces uppercase letters with lowercase
 * - Collapses internal spaces
 */
export function normalizeBrandName(brand: string = ''): string {
  return String(brand || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Normalizes email addresses: lowercase, trimmed, standard clean format.
 */
export function normalizeEmail(email?: string): string {
  if (!email) return '';
  return String(email).trim().toLowerCase();
}

/**
 * Normalizes Argentine and international phone numbers into a canonical
 * comparison key (national digits) and standard international format.
 * 
 * Handles:
 * - "011 15-1234-5678" -> "1112345678" (national), "5491112345678" (canonical)
 * - "11-1234-5678" -> "1112345678" (national), "5491112345678" (canonical)
 * - "+54 9 11 1234-5678" -> "1112345678" (national), "5491112345678" (canonical)
 * - "5491112345678" -> "1112345678" (national), "5491112345678" (canonical)
 */
export function normalizePhone(rawPhone: string = ''): { nationalDigits: string; canonical: string } {
  let digits = String(rawPhone || '').replace(/\D/g, '');

  if (!digits) {
    return { nationalDigits: '', canonical: '' };
  }

  // Remove leading international plus or zeros if formatted as 0054...
  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }

  // If starts with 549 (Argentine mobile international)
  if (digits.startsWith('549') && digits.length >= 12) {
    digits = digits.slice(3);
  } else if (digits.startsWith('54') && digits.length >= 11) {
    // If starts with 54 followed by 9 (e.g. 54 9 ...) or direct area code
    digits = digits.slice(2);
    if (digits.startsWith('9')) {
      digits = digits.slice(1);
    }
  }

  // If starts with 0 (national trunk prefix, e.g. 011...)
  if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  // Handle mobile prefix "15" after 2, 3, or 4 digit area codes in Argentina
  // Area codes: 11 (CABA/GBA), 341, 351, 261, 221, etc.
  // Example: 111512345678 -> 1112345678
  if (digits.length === 12 && digits.startsWith('1115')) {
    digits = '11' + digits.slice(4);
  } else if (digits.length === 12 && (digits.slice(2, 4) === '15' || digits.slice(3, 5) === '15')) {
    // 3-digit area code with 15, e.g. 351151234567 -> 3511234567
    if (digits.slice(3, 5) === '15') {
      digits = digits.slice(0, 3) + digits.slice(5);
    } else if (digits.slice(2, 4) === '15') {
      digits = digits.slice(0, 2) + digits.slice(4);
    }
  } else if (digits.length === 11 && digits.startsWith('15')) {
    // Missing area code default (fallback 11 for Buenos Aires)
    digits = '11' + digits.slice(2);
  }

  const nationalDigits = digits;
  const canonical = digits.length >= 10 ? `549${digits}` : digits;

  return { nationalDigits, canonical };
}

/**
 * Calculates Levenshtein Distance between two strings.
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculates similarity ratio between 0.0 (completely different) and 1.0 (exact match).
 */
export function stringSimilarity(a: string, b: string): number {
  const normA = normalizeText(a);
  const normB = normalizeText(b);
  if (normA === normB) return 1.0;
  if (!normA || !normB) return 0.0;

  const maxLen = Math.max(normA.length, normB.length);
  if (maxLen === 0) return 1.0;

  const dist = levenshteinDistance(normA, normB);
  return Math.max(0, (maxLen - dist) / maxLen);
}

export interface ClientMatchResult {
  isMatch: boolean;
  matchedClient?: Client;
  confidence: number;
  isPotentialDuplicate: boolean;
  duplicateCandidate?: Client;
  duplicateReason?: string;
  matchSignals: {
    phoneMatch: boolean;
    emailMatch: boolean;
    exactNameMatch: boolean;
    similarNameMatch: boolean;
    browserIdMatch: boolean;
  };
}

/**
 * Multi-signal Matching Engine.
 * Evaluates candidate clients against incoming booking info.
 */
export function evaluateClientMatch(
  incoming: {
    nombre: string;
    apellido: string;
    telefono: string;
    email?: string;
    browserId?: string;
  },
  existingClients: Client[]
): ClientMatchResult {
  const normNombre = normalizeText(incoming.nombre);
  const normApellido = normalizeText(incoming.apellido);
  const normFullName = `${normNombre} ${normApellido}`.trim();
  const phoneNorm = normalizePhone(incoming.telefono);
  const normEmail = normalizeEmail(incoming.email);
  const browserId = incoming.browserId ? incoming.browserId.trim() : '';

  let bestMatchClient: Client | null = null;
  let bestMatchConfidence = 0;
  let bestMatchSignals = {
    phoneMatch: false,
    emailMatch: false,
    exactNameMatch: false,
    similarNameMatch: false,
    browserIdMatch: false
  };

  let potentialDuplicateClient: Client | null = null;
  let potentialDuplicateScore = 0;
  let potentialDuplicateReason = '';

  for (const client of existingClients) {
    if (!client.activo) continue; // Skip deactivated or merged accounts

    const clientPhoneNorm = client.telefonoNormalizado || normalizePhone(client.telefono).nationalDigits;
    const clientEmailNorm = client.emailNormalizado || normalizeEmail(client.email);
    const clientFullName = `${client.nombreNormalizado || normalizeText(client.nombre)} ${client.apellidoNormalizado || normalizeText(client.apellido)}`.trim();

    // Signal Checks
    const phoneMatches = phoneNorm.nationalDigits && clientPhoneNorm && (
      phoneNorm.nationalDigits === clientPhoneNorm ||
      phoneNorm.canonical === client.telefono ||
      phoneNorm.nationalDigits.endsWith(clientPhoneNorm) ||
      clientPhoneNorm.endsWith(phoneNorm.nationalDigits)
    );

    const emailMatches = Boolean(normEmail && clientEmailNorm && normEmail === clientEmailNorm);

    const exactNameMatches = Boolean(
      normFullName && clientFullName && (
        normFullName === clientFullName ||
        (normNombre === client.nombreNormalizado && normApellido === client.apellidoNormalizado)
      )
    );

    const nameSim = stringSimilarity(normFullName, clientFullName);
    const similarNameMatches = exactNameMatches || nameSim >= 0.85;

    const browserIdMatches = Boolean(browserId && client.browserId && browserId === client.browserId);

    // Scoring calculation
    let score = 0;

    if (phoneMatches) {
      score += 55;
    }

    if (emailMatches) {
      score += 35;
    }

    if (exactNameMatches) {
      score += 35;
    } else if (similarNameMatches) {
      score += Math.round(nameSim * 25);
    }

    if (browserIdMatches) {
      score += 10;
    }

    // High confidence combinations
    if (phoneMatches && (exactNameMatches || similarNameMatches) && emailMatches) {
      score = 100; // Strong match: 100%
    } else if (phoneMatches && (exactNameMatches || similarNameMatches)) {
      score = 95; // Strong match: 95%
    } else if (phoneMatches && emailMatches) {
      score = 92; // Strong match: 92%
    } else if (phoneMatches && !exactNameMatches && !normEmail) {
      // Same phone, no email provided, maybe slight nickname variation
      score = 90;
    } else if (emailMatches && exactNameMatches) {
      score = 90;
    } else if (emailMatches && similarNameMatches) {
      score = 85;
    }

    // Special Case: Possible Duplicate Detection
    // Same full name (exact or >= 90% similarity), but DIFFERENT phone number and NO email match
    if (!phoneMatches && !emailMatches && (exactNameMatches || nameSim >= 0.90)) {
      const dupScore = exactNameMatches ? 75 : 65;
      if (dupScore > potentialDuplicateScore) {
        potentialDuplicateScore = dupScore;
        potentialDuplicateClient = client;
        potentialDuplicateReason = exactNameMatches
          ? 'Mismo nombre y apellido pero diferente número de teléfono registrado.'
          : `Nombre y apellido muy similares (${Math.round(nameSim * 100)}% coincidencia) pero diferente teléfono.`;
      }
    }

    if (score > bestMatchConfidence) {
      bestMatchConfidence = score;
      bestMatchClient = client;
      bestMatchSignals = {
        phoneMatch: !!phoneMatches,
        emailMatch: !!emailMatches,
        exactNameMatch: exactNameMatches,
        similarNameMatch: similarNameMatches,
        browserIdMatch: browserIdMatches
      };
    }
  }

  // Threshold: >= 85 is an automatic match to existing client
  if (bestMatchConfidence >= 85 && bestMatchClient) {
    return {
      isMatch: true,
      matchedClient: bestMatchClient,
      confidence: Math.min(100, bestMatchConfidence),
      isPotentialDuplicate: false,
      matchSignals: bestMatchSignals
    };
  }

  // If there's a potential duplicate flagged
  if (potentialDuplicateClient && potentialDuplicateScore >= 60) {
    return {
      isMatch: false,
      confidence: potentialDuplicateScore,
      isPotentialDuplicate: true,
      duplicateCandidate: potentialDuplicateClient,
      duplicateReason: potentialDuplicateReason,
      matchSignals: bestMatchSignals
    };
  }

  // No match
  return {
    isMatch: false,
    confidence: bestMatchConfidence,
    isPotentialDuplicate: false,
    matchSignals: bestMatchSignals
  };
}
