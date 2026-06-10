import {
  CHILD_NAME_PSEUDONYM,
  maskChildNameDeep,
  maskChildNameText,
  unmaskChildNameDeep,
  unmaskChildNameText,
} from './childPseudonym';

describe('maskChildNameText', () => {
  it('masks a batchim name and its friendly stem', () => {
    expect(maskChildNameText('민준이가 밥을 안 먹어요. 민준이는 고집이 세요.', '민준'))
      .toBe('○○이가 밥을 안 먹어요. ○○이는 고집이 세요.');
    expect(maskChildNameText('민준은 블록을 좋아해요', '민준'))
      .toBe('○○이은 블록을 좋아해요');
  });

  it('masks a vowel-ending name', () => {
    expect(maskChildNameText('서아는 잘 자요', '서아')).toBe('○○이는 잘 자요');
  });

  it('does not double the suffix for names already ending in 이', () => {
    expect(maskChildNameText('준이가 웃어요', '준이')).toBe('○○이가 웃어요');
  });

  it('returns text unchanged when there is no name', () => {
    expect(maskChildNameText('이름 없는 문장', null)).toBe('이름 없는 문장');
    expect(maskChildNameText('이름 없는 문장', '  ')).toBe('이름 없는 문장');
  });
});

describe('unmaskChildNameText', () => {
  it('restores a batchim name with correct particles', () => {
    expect(unmaskChildNameText('○○이는 호기심이 많아요. ○○이가 웃을 때, ○○이의 눈을 보세요.', '민준'))
      .toBe('민준이는 호기심이 많아요. 민준이가 웃을 때, 민준이의 눈을 보세요.');
  });

  it('restores a vowel-ending name with correct particles', () => {
    expect(unmaskChildNameText('○○이는 호기심이 많아요. ○○이를 안아주세요.', '서아'))
      .toBe('서아는 호기심이 많아요. 서아를 안아주세요.');
  });

  it('restores a full Korean name without the friendly stem', () => {
    expect(unmaskChildNameText('○○이는 신중해요', '김민준')).toBe('김민준은 신중해요');
  });

  it('restores bare and particle-less placeholders', () => {
    expect(unmaskChildNameText('○○이 엄마와 ○○ 모두', '서아')).toBe('서아 엄마와 서아 모두');
    expect(unmaskChildNameText('○○야, 같이 하자', '서아')).toBe('서아야, 같이 하자');
    expect(unmaskChildNameText('○○이야, 같이 하자', '민준')).toBe('민준이야, 같이 하자');
  });

  it('round-trips prompts built with the pseudonym constant', () => {
    const generated = `${CHILD_NAME_PSEUDONYM}는 차분하지만 ${CHILD_NAME_PSEUDONYM}가 흥분하면 달라요`;
    expect(unmaskChildNameText(generated, '서아')).toBe('서아는 차분하지만 서아가 흥분하면 달라요');
  });
});

describe('deep variants', () => {
  it('masks and unmasks nested objects and arrays', () => {
    const input = {
      problem: '민준이가 동생을 때려요',
      answers: { q1: '민준이는 자주 그래요', q2: '없음' },
      list: ['민준이와 산책', 42, null],
    };

    const masked = maskChildNameDeep(input, '민준');
    expect(masked).toEqual({
      problem: '○○이가 동생을 때려요',
      answers: { q1: '○○이는 자주 그래요', q2: '없음' },
      list: ['○○이와 산책', 42, null],
    });

    const restored = unmaskChildNameDeep(masked, '민준');
    expect(restored).toEqual(input);
  });

  it('returns the value untouched without a name', () => {
    const value = { text: '○○이는 그대로' };
    expect(unmaskChildNameDeep(value, null)).toBe(value);
  });
});
