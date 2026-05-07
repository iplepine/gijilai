import {
  appendTranscript,
  buildSpeechRecognitionTranscript,
  mergeSpeechRecognitionResults,
  type SpeechRecognitionEventLike,
  type SpeechRecognitionResultLike,
} from './voiceInput';

function recognitionResult(transcript: string, isFinal: boolean): SpeechRecognitionResultLike {
  const alternative = { transcript };
  return {
    isFinal,
    0: alternative,
    item: () => alternative,
  };
}

function recognitionEvent(
  results: Array<{ transcript: string; isFinal: boolean }>,
  resultIndex = 0,
): SpeechRecognitionEventLike {
  const resultItems = results.map((result) => recognitionResult(result.transcript, result.isFinal));

  return {
    resultIndex,
    results: Object.assign(resultItems, {
      item: (index: number) => resultItems[index],
    }),
  };
}

describe('voiceInput', () => {
  it('replaces changed speech results by resultIndex instead of appending stale text', () => {
    let segments = mergeSpeechRecognitionResults([], recognitionEvent([
      { transcript: '아이가 울어요', isFinal: false },
    ]));

    segments = mergeSpeechRecognitionResults(segments, recognitionEvent([
      { transcript: '아이가 울어요', isFinal: true },
      { transcript: ' 계속 안기려고 해요', isFinal: false },
    ], 1));

    expect(buildSpeechRecognitionTranscript(segments)).toBe('아이가 울어요 계속 안기려고 해요');
  });

  it('collapses duplicated adjacent interim/final speech segments from mobile browsers', () => {
    const segments = mergeSpeechRecognitionResults([], recognitionEvent([
      { transcript: '같은 말이 들어가요', isFinal: false },
      { transcript: '같은 말이 들어가요', isFinal: true },
    ]));

    expect(buildSpeechRecognitionTranscript(segments)).toBe('같은 말이 들어가요');
  });

  it('uses the longer final segment when an interim segment is repeated as a prefix', () => {
    const segments = mergeSpeechRecognitionResults([], recognitionEvent([
      { transcript: '아이가', isFinal: false },
      { transcript: '아이가 계속 울어요', isFinal: true },
    ]));

    expect(buildSpeechRecognitionTranscript(segments)).toBe('아이가 계속 울어요');
  });

  it('keeps intentional repetition inside a single recognition segment', () => {
    const segments = mergeSpeechRecognitionResults([], recognitionEvent([
      { transcript: '엄마 엄마 하고 불러요', isFinal: true },
    ]));

    expect(buildSpeechRecognitionTranscript(segments)).toBe('엄마 엄마 하고 불러요');
  });

  it('appends cleaned speech text to existing input within maxLength', () => {
    expect(appendTranscript('기존 내용', '  새   내용입니다  ', 12)).toBe('기존 내용 새 내용입니');
  });
});
