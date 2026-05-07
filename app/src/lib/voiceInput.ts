export interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

export interface SpeechRecognitionResultLike {
  isFinal: boolean;
  item: (index: number) => SpeechRecognitionAlternativeLike;
  [index: number]: SpeechRecognitionAlternativeLike;
}

export interface SpeechRecognitionResultListLike {
  length: number;
  item: (index: number) => SpeechRecognitionResultLike;
  [index: number]: SpeechRecognitionResultLike;
}

export interface SpeechRecognitionEventLike {
  resultIndex?: number;
  results: SpeechRecognitionResultListLike;
}

export interface SpeechRecognitionTranscriptSegment {
  transcript: string;
  isFinal: boolean;
}

function comparableTranscript(transcript: string) {
  return transcript.replace(/\s+/g, ' ').trim();
}

function getSpeechResultTranscript(result: SpeechRecognitionResultLike) {
  return result[0]?.transcript ?? result.item(0)?.transcript ?? '';
}

function shouldReplacePreviousSegment(
  previous: SpeechRecognitionTranscriptSegment,
  current: SpeechRecognitionTranscriptSegment,
) {
  const previousText = comparableTranscript(previous.transcript);
  const currentText = comparableTranscript(current.transcript);
  if (!previousText || !currentText) return false;
  if (previousText === currentText) return true;
  if (previous.isFinal) return false;
  return currentText.startsWith(previousText) || previousText.startsWith(currentText);
}

function chooseSpeechSegment(
  previous: SpeechRecognitionTranscriptSegment,
  current: SpeechRecognitionTranscriptSegment,
) {
  if (current.isFinal && !previous.isFinal) return current;

  const previousText = comparableTranscript(previous.transcript);
  const currentText = comparableTranscript(current.transcript);
  return currentText.length >= previousText.length ? current : previous;
}

export function mergeSpeechRecognitionResults(
  previousSegments: SpeechRecognitionTranscriptSegment[],
  event: SpeechRecognitionEventLike,
) {
  const nextSegments = previousSegments.slice(0, event.results.length);
  const startIndex =
    typeof event.resultIndex === 'number' && event.resultIndex >= 0
      ? Math.min(event.resultIndex, event.results.length)
      : 0;

  for (let i = startIndex; i < event.results.length; i += 1) {
    const result = event.results[i] ?? event.results.item(i);
    nextSegments[i] = {
      transcript: getSpeechResultTranscript(result),
      isFinal: result.isFinal,
    };
  }

  return nextSegments;
}

export function buildSpeechRecognitionTranscript(
  segments: SpeechRecognitionTranscriptSegment[],
) {
  const mergedSegments: SpeechRecognitionTranscriptSegment[] = [];

  segments.forEach((segment) => {
    if (!comparableTranscript(segment.transcript)) return;

    const previous = mergedSegments[mergedSegments.length - 1];
    if (previous && shouldReplacePreviousSegment(previous, segment)) {
      mergedSegments[mergedSegments.length - 1] = chooseSpeechSegment(previous, segment);
      return;
    }

    mergedSegments.push(segment);
  });

  return mergedSegments.map((segment) => segment.transcript).join('');
}

export function appendTranscript(baseValue: string, transcript: string, maxLength?: number) {
  const cleanTranscript = transcript.replace(/\s+/g, ' ').trim();
  if (!cleanTranscript) return baseValue;

  const separator = baseValue.trim().length > 0 && !/\s$/.test(baseValue) ? ' ' : '';
  const nextValue = `${baseValue}${separator}${cleanTranscript}`;
  return typeof maxLength === 'number' ? nextValue.slice(0, maxLength) : nextValue;
}
