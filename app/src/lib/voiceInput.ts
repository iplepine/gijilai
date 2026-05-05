export interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

export interface SpeechRecognitionResultLike {
  isFinal: boolean;
  item?: (index: number) => SpeechRecognitionAlternativeLike;
  [index: number]: SpeechRecognitionAlternativeLike;
}

export interface SpeechRecognitionResultListLike {
  length: number;
  item?: (index: number) => SpeechRecognitionResultLike;
  [index: number]: SpeechRecognitionResultLike;
}

export interface SpeechRecognitionEventLike {
  results: SpeechRecognitionResultListLike;
  resultIndex?: number;
}

function getResultTranscript(result: SpeechRecognitionResultLike | undefined) {
  return result?.[0]?.transcript ?? result?.item?.(0)?.transcript ?? '';
}

function overlapLength(left: string, right: string) {
  const maxLength = Math.min(left.length, right.length);
  for (let length = maxLength; length > 0; length -= 1) {
    if (left.endsWith(right.slice(0, length))) return length;
  }
  return 0;
}

function appendDedupedSegment(value: string, segment: string) {
  const normalizedSegment = segment.replace(/\s+/g, ' ');
  if (!normalizedSegment.trim()) return value;
  if (!value) return normalizedSegment.trimStart();

  const duplicatedLength = overlapLength(value, normalizedSegment);
  return `${value}${normalizedSegment.slice(duplicatedLength)}`;
}

export function transcriptFromSegments(segments: readonly string[]) {
  return segments
    .reduce((value, segment) => appendDedupedSegment(value, segment), '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function updateSpeechTranscriptSegments(
  previousSegments: readonly string[],
  event: SpeechRecognitionEventLike,
) {
  const nextSegments = previousSegments.slice();
  const startIndex = Math.max(0, event.resultIndex ?? 0);

  if (startIndex === 0) {
    nextSegments.length = event.results.length;
  }

  for (let index = startIndex; index < event.results.length; index += 1) {
    nextSegments[index] = getResultTranscript(event.results[index]);
  }

  if (event.results.length < nextSegments.length) {
    nextSegments.length = event.results.length;
  }

  return nextSegments;
}

export function appendTranscript(baseValue: string, transcript: string, maxLength?: number) {
  const cleanTranscript = transcript.replace(/\s+/g, ' ').trim();
  if (!cleanTranscript) return baseValue;

  const separator = baseValue.trim().length > 0 && !/\s$/.test(baseValue) ? ' ' : '';
  const nextValue = `${baseValue}${separator}${cleanTranscript}`;
  return typeof maxLength === 'number' ? nextValue.slice(0, maxLength) : nextValue;
}
