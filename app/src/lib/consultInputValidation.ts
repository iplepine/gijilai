export const MIN_CONSULT_PROBLEM_LENGTH = 30;

export type ConsultInputValidationCode = 'empty' | 'too_short' | 'gibberish';

export type ConsultInputValidationResult =
  | { ok: true }
  | { ok: false; code: ConsultInputValidationCode };

function countMatches(value: string, pattern: RegExp) {
  return value.match(pattern)?.length ?? 0;
}

function hasRepeatedShortPattern(value: string) {
  if (value.length < 12) return false;

  for (let size = 1; size <= 4; size += 1) {
    const pattern = value.slice(0, size);
    if (!pattern) continue;

    const repeated = pattern.repeat(Math.ceil(value.length / size)).slice(0, value.length);
    if (repeated === value) return true;
  }

  return false;
}

export function validateConsultProblemInput(input: string): ConsultInputValidationResult {
  const normalized = input.replace(/\s+/g, ' ').trim();
  if (!normalized) return { ok: false, code: 'empty' };

  const compact = input.replace(/\s+/g, '');
  const hangulSyllables = countMatches(compact, /[가-힣]/g);
  const hangulJamo = countMatches(compact, /[ㄱ-ㅎㅏ-ㅣ]/g);
  const latinLetters = countMatches(compact, /[A-Za-z]/g);
  const digits = countMatches(compact, /[0-9]/g);
  const textCharacters = hangulSyllables + latinLetters;
  const meaningfulCharacters = textCharacters + digits;
  const uniqueCharacters = new Set(Array.from(compact)).size;
  const jamoRatio = compact.length > 0 ? hangulJamo / compact.length : 0;

  if (compact.length >= 8 && textCharacters === 0) {
    return { ok: false, code: 'gibberish' };
  }

  if (hangulJamo >= 6 && jamoRatio >= 0.35) {
    return { ok: false, code: 'gibberish' };
  }

  if (hasRepeatedShortPattern(compact)) {
    return { ok: false, code: 'gibberish' };
  }

  if (compact.length >= 16 && uniqueCharacters <= 4 && meaningfulCharacters < 12) {
    return { ok: false, code: 'gibberish' };
  }

  if (normalized.length < MIN_CONSULT_PROBLEM_LENGTH || textCharacters < 18) {
    return { ok: false, code: 'too_short' };
  }

  return { ok: true };
}
