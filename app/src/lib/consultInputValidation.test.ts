import {
  MIN_CONSULT_PROBLEM_LENGTH,
  validateConsultProblemInput,
  type ConsultInputValidationCode,
} from './consultInputValidation';

function expectInvalid(input: string, code: ConsultInputValidationCode) {
  expect(validateConsultProblemInput(input)).toEqual({ ok: false, code });
}

describe('validateConsultProblemInput', () => {
  describe('empty input', () => {
    test.each([
      ['empty string', ''],
      ['spaces only', '     '],
      ['newlines and tabs only', '\n\t \n'],
    ])('rejects %s', (_label, input) => {
      expectInvalid(input, 'empty');
    });
  });

  describe('too little consultation context', () => {
    test.each([
      ['short Korean sentence', '아이가 울어요'],
      ['short English sentence', 'My child cries.'],
      ['short Korean concern with punctuation', '.... 아이가 울어요 ....'],
      ['short Korean concern with age only', '아이가 7살이에요'],
      ['meaningful but below minimum length', '아이가 등원 전에 울고 떼를 써요'],
    ])('rejects %s', (_label, input) => {
      expectInvalid(input, 'too_short');
    });
  });

  describe('clearly meaningless input', () => {
    test.each([
      ['Korean jamo spam with line breaks', 'ㅁㄴㅇㄹ\nㅁㄴㅇㄹ\nㄴㅁㅇㄹ\nㅁㄴㅇㄹ'],
      ['Korean jamo mixed with numbers', 'ㄱㄴㄷㄹㅁㅂ 12345678'],
      ['Latin repeated keyboard pattern', 'asdfasdfasdfasdfasdfasdfasdf'],
      ['repeated one-character Korean syllable', '아아아아아아아아아아아아'],
      ['repeated two-character Korean pattern', '안녕안녕안녕안녕안녕안녕'],
      ['repeated four-character Korean pattern', '도와줘요도와줘요도와줘요'],
      ['symbols only', '!!!!!!!!'],
      ['punctuation only', '!!!???!!!???'],
      ['emoji only', '😀😃😄😁😆😅😂🤣'],
      ['numbers only', '123456789012345678901234567890'],
      ['Korean laughter spam', 'ㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋ'],
    ])('rejects %s', (_label, input) => {
      expectInvalid(input, 'gibberish');
    });
  });

  describe('valid consultation concerns', () => {
    test.each([
      [
        'first consultation in Korean',
        '아이가 아침마다 어린이집 가기 싫다고 울고 옷을 안 입어서 매일 실랑이를 해요.',
      ],
      [
        'follow-up after practice in Korean',
        '실천해본 뒤에는 잠깐 좋아졌는데 어제부터 다시 소리를 지르고 장난감을 던져요.',
      ],
      [
        'Korean concern with age and task context',
        '아이가 7살인데 숙제 시작만 하면 배가 아프다고 하고 자리에서 계속 일어나요.',
      ],
      [
        'Korean concern with quoted child words',
        '아이가 "싫어"라고 소리치고 문을 닫아버려서 어떻게 말해야 할지 모르겠어요.',
      ],
      [
        'English daycare concern',
        'My child cries every morning before daycare and refuses to get dressed.',
      ],
      [
        'English follow-up after practice',
        'After we tried the bedtime routine, my child still screams when I turn off the light.',
      ],
      [
        'valid concern with newlines',
        '아이가 아침마다\n어린이집 가기 싫다고 울고\n옷을 안 입어서 매일 실랑이를 해요.',
      ],
    ])('accepts %s', (_label, input) => {
      expect(validateConsultProblemInput(input)).toEqual({ ok: true });
    });
  });

  describe('threshold behavior', () => {
    test('exports the current minimum length used by the consult CTA', () => {
      expect(MIN_CONSULT_PROBLEM_LENGTH).toBe(20);
    });

    test('accepts consultation concern at the 20 character minimum', () => {
      expect(validateConsultProblemInput('아이가등원할때마다많이울고계속또떼를써요')).toEqual({ ok: true });
    });

    test('rejects consultation concern below the 20 character minimum', () => {
      expectInvalid('아이가등원할때마다많이울고계속떼를써요', 'too_short');
    });

    test('does not let numbers alone satisfy the meaningful text requirement', () => {
      expectInvalid('1234567890 1234567890 1234567890', 'gibberish');
    });

    test('allows numbers when there is enough actual concern text', () => {
      expect(
        validateConsultProblemInput('아이가 3일째 밤 11시가 넘어도 잠을 안 자고 계속 뛰어다녀요.'),
      ).toEqual({ ok: true });
    });
  });
});
