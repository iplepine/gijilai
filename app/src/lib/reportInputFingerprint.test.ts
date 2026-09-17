import { createReportInputFingerprint, hasMatchingReportInput, withReportInputFingerprint } from './reportInputFingerprint';

const input = {
  type: 'CHILD', model: 'test-model', prompt: 'prompt-v1', language: 'ko',
  answers: [{ questionId: '2', score: 4 }, { questionId: '1', score: 2 }],
  context: { name: '테스트', gender: 'female', age: '5세 (62개월)', scores: { NS: 60, HA: 40, RD: 60, P: 40 } },
};

describe('report input fingerprint', () => {
  it('is stable across answer and object key order', () => {
    expect(createReportInputFingerprint(input)).toBe(createReportInputFingerprint({
      ...input, answers: [...input.answers].reverse(),
      context: { scores: { P: 40, RD: 60, HA: 40, NS: 60 }, age: '5세 (62개월)', gender: 'female', name: '테스트' },
    }));
  });

  it.each([
    { answers: [...input.answers, { questionId: '101', score: 5 }] },
    { answers: [{ questionId: '2', score: 5 }, input.answers[1]] },
    { context: { ...input.context, age: '5세 (63개월)' } },
    { context: { ...input.context, name: '다른이름' } },
    { language: 'en' }, { prompt: 'prompt-v2' }, { model: 'new-model' }, { type: 'PARENT' },
  ])('invalidates when a generation input changes: %j', (change) => {
    expect(createReportInputFingerprint({ ...input, ...change })).not.toBe(createReportInputFingerprint(input));
  });

  it('stores only a versioned digest and recognizes no legacy metadata as a match', () => {
    const digest = createReportInputFingerprint(input);
    const report = withReportInputFingerprint({ title: 'result' }, digest);
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(report)).not.toContain(input.context.name);
    expect(hasMatchingReportInput(report, digest)).toBe(true);
    expect(hasMatchingReportInput(report, 'changed')).toBe(false);
    expect(hasMatchingReportInput({ title: 'legacy' }, digest)).toBe(false);
  });
});
