import {
  checkSelfReflectionSafety,
  safetyHeadline,
  safetyBody,
} from './selfReflectionGuardrail';

describe('checkSelfReflectionSafety', () => {
  it('일반적인 양육 고민은 safe로 통과시킨다', () => {
    const cases = [
      '요즘 아이한테 자꾸 화를 내게 돼서 죄책감이 들어요.',
      '퇴근하고 오면 너무 지쳐서 아이랑 놀아줄 힘이 없어요.',
      '내가 좋은 엄마인지 매일 의심이 들어요.',
      '아이가 떼쓸 때 어떻게 반응해야 할지 모르겠어요.',
    ];
    for (const text of cases) {
      expect(checkSelfReflectionSafety(text)).toEqual({ safe: true });
    }
  });

  it('자해 신호를 SELF_HARM으로 감지한다', () => {
    const cases = ['그냥 다 사라지고 싶어요', '이렇게 살고 싶지 않아', '죽고 싶다는 생각이 들어요'];
    for (const text of cases) {
      const result = checkSelfReflectionSafety(text);
      expect(result.safe).toBe(false);
      if (!result.safe) {
        expect(result.category).toBe('SELF_HARM');
        expect(result.resources.length).toBeGreaterThan(0);
      }
    }
  });

  it('폭력 신호를 VIOLENCE로 감지한다', () => {
    const cases = ['애한테 손이 올라가요', '아이를 때리고 싶을 때가 있어요', '내가 무서워질 때가 있어요'];
    for (const text of cases) {
      const result = checkSelfReflectionSafety(text);
      expect(result.safe).toBe(false);
      if (!result.safe) {
        expect(result.category).toBe('VIOLENCE');
      }
    }
  });

  it('지속적 디스트레스를 PERSISTENT_DISTRESS로 감지한다', () => {
    const cases = ['몇 주째 아침에 일어나기가 힘들어요', '매일 울고 싶어요', '다 포기하고 싶어요'];
    for (const text of cases) {
      const result = checkSelfReflectionSafety(text);
      expect(result.safe).toBe(false);
      if (!result.safe) {
        expect(result.category).toBe('PERSISTENT_DISTRESS');
      }
    }
  });

  it('자해 신호가 폭력·디스트레스보다 우선한다', () => {
    const result = checkSelfReflectionSafety('매일 울고 싶고 사라지고 싶어요');
    expect(result.safe).toBe(false);
    if (!result.safe) {
      expect(result.category).toBe('SELF_HARM');
    }
  });

  it('빈 입력은 safe로 처리한다', () => {
    expect(checkSelfReflectionSafety('')).toEqual({ safe: true });
    expect(checkSelfReflectionSafety('   ')).toEqual({ safe: true });
  });

  it('공백이 끼어 있어도 감지한다', () => {
    const result = checkSelfReflectionSafety('죽 고 싶 어 요');
    expect(result.safe).toBe(false);
  });

  it('safetyHeadline/safetyBody는 모든 카테고리에서 비어있지 않다', () => {
    for (const category of ['SELF_HARM', 'VIOLENCE', 'PERSISTENT_DISTRESS'] as const) {
      expect(safetyHeadline(category).length).toBeGreaterThan(0);
      expect(safetyBody(category).length).toBeGreaterThan(0);
    }
  });
});
