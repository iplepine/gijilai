import { formatSurveyAnswersForPrompt } from './openai';

describe('formatSurveyAnswersForPrompt', () => {
    it('passes the selected BARS sentence instead of a generic Likert label', () => {
        const formatted = formatSurveyAnswersForPrompt('CHILD', [
            { questionId: '6', score: 1 },
        ]);

        expect(formatted).toContain('부모 뒤로 숨어 한참 동안 얼굴도 보여주지 않는다.');
        expect(formatted).not.toContain('전혀 그렇지 않다');
    });
});
