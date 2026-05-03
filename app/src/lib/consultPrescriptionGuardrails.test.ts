import { applyConsultPrescriptionGuardrails } from './consultPrescriptionGuardrails';

describe('consultPrescriptionGuardrails', () => {
    it('keeps weak answers from becoming parent blame', () => {
        const guarded = applyConsultPrescriptionGuardrails({
            questionAnalysis: [{
                question: '아이에게 물어보신 적이 있나요?',
                answer: '물어본적 없어',
                analysis: '아이의 필요를 이해할 기회를 놓치신 것으로 볼 수 있습니다.',
            }],
        });

        expect(guarded.questionAnalysis?.[0].analysis).toContain('아직 아이가 그 행동을 어떤 느낌으로 경험하는지 확인되지 않았다는 뜻');
        expect(guarded.questionAnalysis?.[0].analysis).not.toContain('기회를 놓치');
    });

    it('rewrites neutral frequency answers that over-read emotion', () => {
        const guarded = applyConsultPrescriptionGuardrails({
            questionAnalysis: [{
                question: '얼마나 반복되나요?',
                answer: '가끔 발생한다',
                analysis: '가끔 발생한다는 것은 불안과 안정감을 원한다는 신호입니다.',
            }],
        });

        expect(guarded.questionAnalysis?.[0].analysis).toContain('이 문항만으로 감정이나 기질을 단정하기보다');
        expect(guarded.questionAnalysis?.[0].analysis).not.toContain('불안과 안정감');
    });

    it('rewrites unsafe car contact and post-event praise actions', () => {
        const guarded = applyConsultPrescriptionGuardrails({
            actionItems: [
                {
                    title: '차 안에서 울 때, 잠깐 안아주기',
                    action: '차 안에서 민재가 울면 잠깐 안아주기',
                    description: '안정감을 줍니다.',
                    duration: 3,
                    encouragement: '작게 해보세요.',
                },
                {
                    title: '놀이가 끝난 후, 칭찬하기',
                    action: '잘했다고 칭찬하기',
                    description: '격려합니다.',
                    duration: 3,
                    encouragement: '작게 해보세요.',
                },
            ],
        });

        expect(guarded.actionItems?.[0].title).toBe('차 안에서 울 때, 안전 신호 말하기');
        expect(guarded.actionItems?.[0].action).toContain('운전에 시선 두기');
        expect(guarded.actionItems?.[1].title).toBe('놀이 중 틀렸을 때, 대본 한 줄 확인하기');
        expect(guarded.actionItems?.[1].action).toContain('엄마 대사는 뭐야?');
    });

    it('makes car song routine actions concrete', () => {
        const guarded = applyConsultPrescriptionGuardrails({
            actionItems: [
                {
                    title: '차 타기 전, 첫 곡 순서 정하기',
                    action: '첫 곡을 정하기',
                    description: '순서를 정합니다.',
                    duration: 3,
                    encouragement: '작게 해보세요.',
                },
                {
                    title: '노래가 끊길 때, 안전 신호 말하기',
                    action: '안전 신호를 말하기',
                    description: '안전합니다.',
                    duration: 3,
                    encouragement: '작게 해보세요.',
                },
                {
                    title: '차에 타기 시작할 때, 기분 확인하기',
                    action: "'차에 타면 기분이 어때?'라고 묻기",
                    description: '감정을 확인합니다.',
                    duration: 3,
                    encouragement: '작게 해보세요.',
                },
            ],
        });

        expect(guarded.actionItems?.[0].action).toContain('손가락 1개');
        expect(guarded.actionItems?.[1].action).toContain('운전에 시선 두기');
        expect(guarded.actionItems?.[2].title).toBe('차 안에서 다시 요구할 때, 다음 순서 말하기');
        expect(guarded.actionItems?.[2].action).toContain('다음은 조용히 가는 시간이야');
    });
});
