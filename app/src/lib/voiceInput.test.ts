import {
  appendTranscript,
  SpeechRecognitionEventLike,
  SpeechRecognitionResultLike,
  transcriptFromSegments,
  updateSpeechTranscriptSegments,
} from './voiceInput';

function result(transcript: string, isFinal = false): SpeechRecognitionResultLike {
  return {
    0: { transcript },
    isFinal,
    item: () => ({ transcript }),
  };
}

function speechEvent(
  results: SpeechRecognitionResultLike[],
  resultIndex = 0,
): SpeechRecognitionEventLike {
  return {
    resultIndex,
    results: Object.assign(results, {
      item: (index: number) => results[index],
    }),
  };
}

describe('voiceInput', () => {
  test('appends clean transcript to the existing input value', () => {
    expect(appendTranscript('기존 내용', '  아이가   울어요  ')).toBe('기존 내용 아이가 울어요');
    expect(appendTranscript('기존 내용 ', '아이가 울어요', 9)).toBe('기존 내용 아이가');
  });

  test('replaces revised interim results instead of appending them repeatedly', () => {
    let segments: string[] = [];

    segments = updateSpeechTranscriptSegments(segments, speechEvent([result('아')]));
    expect(transcriptFromSegments(segments)).toBe('아');

    segments = updateSpeechTranscriptSegments(segments, speechEvent([result('아이')]));
    expect(transcriptFromSegments(segments)).toBe('아이');

    segments = updateSpeechTranscriptSegments(segments, speechEvent([result('아이가')]));
    expect(transcriptFromSegments(segments)).toBe('아이가');
  });

  test('keeps prior final results while updating only the latest changed result', () => {
    let segments = updateSpeechTranscriptSegments([], speechEvent([result('아이가', true)]));

    segments = updateSpeechTranscriptSegments(
      segments,
      speechEvent([result('아이가', true), result(' 많이 울었어요')], 1),
    );

    expect(transcriptFromSegments(segments)).toBe('아이가 많이 울었어요');
  });

  test('deduplicates overlapping final and interim chunks from mobile speech engines', () => {
    const segments = updateSpeechTranscriptSegments(
      [],
      speechEvent([result('아이가', true), result('아이가 울었어요')], 0),
    );

    expect(transcriptFromSegments(segments)).toBe('아이가 울었어요');
  });

  test('replaying the same event does not duplicate transcript characters', () => {
    let segments = updateSpeechTranscriptSegments([], speechEvent([result('밥을 먹었어요', true)]));
    segments = updateSpeechTranscriptSegments(segments, speechEvent([result('밥을 먹었어요', true)]));

    expect(transcriptFromSegments(segments)).toBe('밥을 먹었어요');
  });
});
