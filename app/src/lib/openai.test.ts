import { formatSurveyAnswersForPrompt } from './openai';

describe('formatSurveyAnswersForPrompt', () => {
    it('passes the selected BARS sentence instead of a generic Likert label', () => {
        const formatted = formatSurveyAnswersForPrompt('CHILD', [
            { questionId: '6', score: 1 },
        ]);

        expect(formatted).toContain('부모 뒤로 숨어 한참 동안 얼굴도 보여주지 않는다.');
        expect(formatted).not.toContain('전혀 그렇지 않다');
    });

    it('marks survey answers as internal evidence that should not be copied into reports', () => {
        const formatted = formatSurveyAnswersForPrompt('CHILD', [
            { questionId: '6', score: 1 },
        ]);

        expect(formatted).toContain('내부 근거');
        expect(formatted).toContain('질문, 선택지, 점수 문장을 그대로 복사');
        expect(formatted).toContain('기질 차원과 생활 패턴');
    });
});
