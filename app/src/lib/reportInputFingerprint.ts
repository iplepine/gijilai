import { createHash } from 'node:crypto';
import type { Json } from '@/types/supabase';

const CACHE_VERSION = 1;

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, canonicalize(item)]));
  }
  return value;
}

/** Persist a digest only: no additional answers, names, or birth dates in report metadata. */
export function createReportInputFingerprint(input: {
  type: string;
  model: string;
  prompt: string;
  language: string;
  answers?: Array<{ questionId: string; score: number }>;
  context: unknown;
}) {
  const answers = [...(input.answers ?? [])].sort((left, right) =>
    left.questionId.localeCompare(right.questionId) || left.score - right.score);
  return createHash('sha256').update(JSON.stringify(canonicalize({
    ...input, answers, version: CACHE_VERSION,
  }))).digest('hex');
}

export function withReportInputFingerprint(report: Json, fingerprint: string): Json {
  if (!report || typeof report !== 'object' || Array.isArray(report)) return report;
  return { ...report, _generationCache: { version: CACHE_VERSION, inputHash: fingerprint } };
}

export function hasMatchingReportInput(report: unknown, fingerprint: string) {
  if (!report || typeof report !== 'object') return false;
  const metadata = (report as { _generationCache?: { version?: unknown; inputHash?: unknown } })._generationCache;
  return metadata?.version === CACHE_VERSION && metadata.inputHash === fingerprint;
}
