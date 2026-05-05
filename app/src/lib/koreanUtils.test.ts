import {
  childNameObject,
  childNamePossessive,
  childNameSubject,
  childNameTopic,
  childNameWith,
  euroRo,
  normalizeChildNameParticles,
  normalizeChildNameParticlesInValue,
} from './koreanUtils';

describe('koreanUtils', () => {
  test('formats child names with a final consonant in a friendly form', () => {
    expect(childNameTopic('재윤')).toBe('재윤이는');
    expect(childNameSubject('재윤')).toBe('재윤이가');
    expect(childNameObject('재윤')).toBe('재윤이를');
    expect(childNameWith('재윤')).toBe('재윤이와');
    expect(childNamePossessive('재윤')).toBe('재윤이의');
  });

  test('formats child names without a final consonant without adding 이', () => {
    expect(childNameTopic('서아')).toBe('서아는');
    expect(childNameSubject('서아')).toBe('서아가');
    expect(childNameObject('서아')).toBe('서아를');
    expect(childNameWith('서아')).toBe('서아와');
    expect(childNamePossessive('서아')).toBe('서아의');
  });

  test('formats likely full Korean names with standard particles', () => {
    expect(childNameTopic('박재윤')).toBe('박재윤은');
    expect(childNameSubject('박재윤')).toBe('박재윤이');
    expect(childNameObject('박재윤')).toBe('박재윤을');
    expect(childNameWith('박재윤')).toBe('박재윤과');
    expect(childNamePossessive('박재윤')).toBe('박재윤의');
  });

  test('normalizes awkward child-name particles in report text', () => {
    expect(normalizeChildNameParticles('재윤은 새 환경을 살피고, 재윤을 기다려야 해요.', '재윤'))
      .toBe('재윤이는 새 환경을 살피고, 재윤이를 기다려야 해요.');
    expect(normalizeChildNameParticles('서아은 새 환경을 살피고, 서아와 대화해요.', '서아'))
      .toBe('서아는 새 환경을 살피고, 서아와 대화해요.');
    expect(
      normalizeChildNameParticles(
        '박재윤이는 신중하고, 박재윤이가 고른 장난감을 박재윤이를 위해 두고, 박재윤이의 속도도 봐야 해요.',
        '박재윤',
      ),
    ).toBe('박재윤은 신중하고, 박재윤이 고른 장난감을 박재윤을 위해 두고, 박재윤의 속도도 봐야 해요.');
  });

  test('normalizes nested report values without mutating non-string fields', () => {
    const result = normalizeChildNameParticlesInValue({
      intro: '재윤은 신중한 편이에요.',
      score: 88,
      tips: [{ content: '재윤을 재촉하지 마세요.' }],
    }, '재윤');

    expect(result).toEqual({
      intro: '재윤이는 신중한 편이에요.',
      score: 88,
      tips: [{ content: '재윤이를 재촉하지 마세요.' }],
    });
  });

  test('handles 으로/로 with the ㄹ exception', () => {
    expect(euroRo('서울')).toBe('서울로');
    expect(euroRo('집')).toBe('집으로');
  });
});
