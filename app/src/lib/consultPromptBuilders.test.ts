import {
    buildConsultPrescriptionPrompt,
    buildFollowUpConsultQuestionsPrompt,
    buildInitialConsultQuestionsPrompt,
    formatConsultChildAge,
} from './consultPromptBuilders';

const childProfile = {
    label: '신중한 관찰가',
    keywords: ['조심스러움', '민감함'],
    description: '새로운 상황을 천천히 살피고 익숙해지면 안정적으로 참여합니다.',
    scores: { NS: 32, HA: 78, RD: 66, P: 44 },
};

const parentProfile = {
    label: '빠른 해결형 양육자',
    keywords: ['추진력', '실용성'],
    description: '문제를 빨리 해결하고 다음 행동으로 옮기는 편입니다.',
    scores: { NS: 70, HA: 28, RD: 48, P: 52 },
};

describe('consultPromptBuilders', () => {
    it('formats child age in months or years', () => {
        const now = new Date('2026-05-03T00:00:00+09:00');

        expect(formatConsultChildAge('2024-05-15', now)).toBe('24개월');
        expect(formatConsultChildAge('2021-09-01', now)).toBe('4세 8개월');
    });

    it('builds initial question prompts with child context and user message', () => {
        const prompt = buildInitialConsultQuestionsPrompt({
            problem: '어린이집 현관에서 매일 울고 떨어지지 않으려고 해요.',
            childName: '서아',
            childBirthDate: '2021-09-01',
            childGender: 'female',
            childProfile,
            parentProfile,
        });

        expect(prompt.systemPrompt).toContain('기초 질문');
        expect(prompt.systemPrompt).toContain('아이 기질 유형: 신중한 관찰가');
        expect(prompt.systemPrompt).toContain('가장 바라는 변화나 목표 행동');
        expect(prompt.systemPrompt).toContain('표면 문제와 부모가 원하는 변화를 구분');
        expect(prompt.userMessage).toContain('서아');
        expect(prompt.userMessage).toContain('현재 고민 상황');
    });

    it('builds follow-up prompts with first round answers', () => {
        const prompt = buildFollowUpConsultQuestionsPrompt({
            problem: '등원 때 울어요.',
            firstRoundAnswers: { q1: '현관에서만 심해요' },
        });

        expect(prompt.systemPrompt).toContain('needsFollowUp');
        expect(prompt.systemPrompt).toContain('나아졌다고 느끼는 모습');
        expect(prompt.userMessage).toContain('현관에서만 심해요');
    });

    it('builds prescription prompts with the result quality contract', () => {
        const prompt = buildConsultPrescriptionPrompt({
            problem: '등원할 때마다 현관에서 울고 제 다리를 붙잡아요.',
            questions: [
                { id: 'q1', text: '언제 가장 심해지나요?' },
                { id: 'q2', text: '그때 양육자님은 어떻게 반응하시나요?' },
            ],
            answers: {
                q1: '어린이집 문 앞에서 선생님이 나오면 심해져요.',
                q2: '시간이 없어서 빨리 떼어놓고 돌아서요.',
            },
            childName: '서아',
            childBirthDate: '2021-09-01',
            childGender: 'female',
            childProfile,
            parentProfile,
        });

        expect(prompt.systemPrompt).toContain('등원할 때마다 현관에서 울고');
        expect(prompt.systemPrompt).toContain('Q: 언제 가장 심해지나요?');
        expect(prompt.systemPrompt).toContain('이 처방이 왜 나왔는지');
        expect(prompt.systemPrompt).toContain('부모 목표 검토 원칙');
        expect(prompt.systemPrompt).toContain('부모님의 목표가 틀렸다는 뜻은 아니지만');
        expect(prompt.systemPrompt).toContain('부모님이 바라는 변화');
        expect(prompt.systemPrompt).toContain('부모 감정/이미 시도한 방법 인정');
        expect(prompt.systemPrompt).toContain('이 답변은 ~을 보여줍니다');
        expect(prompt.systemPrompt).toContain('기질 라벨은 선택 사항');
        expect(prompt.systemPrompt).toContain('감정 단정 금지');
        expect(prompt.systemPrompt).toContain('해당 문항의 answer에 직접 포함된 단서');
        expect(prompt.systemPrompt).toContain('정보 해석');
        expect(prompt.systemPrompt).toContain('충분히 이해하지 못했다');
        expect(prompt.systemPrompt).toContain('기회를 놓친 것으로 볼 수 있습니다');
        expect(prompt.systemPrompt).toContain('기회를 놓치신');
        expect(prompt.systemPrompt).toContain('인내가 부족하다');
        expect(prompt.systemPrompt).toContain('과정이 설계되지 않았다');
        expect(prompt.systemPrompt).toContain('대처 방안이 부족하다');
        expect(prompt.systemPrompt).toContain('물어본 적 없어');
        expect(prompt.systemPrompt).toContain('정확히 3개의 실천 항목');
        expect(prompt.systemPrompt).toContain('actionItems[0]은 기본 추천안');
        expect(prompt.systemPrompt).toContain('성별 일반화는 금지');
        expect(prompt.systemPrompt).toContain('마찰 대체 원칙');
        expect(prompt.systemPrompt).toContain('문제 강화 금지');
        expect(prompt.systemPrompt).toContain('장면 제약 반영');
        expect(prompt.systemPrompt).toContain('차 안에서 울 때, 잠깐 안아주기');
        expect(prompt.systemPrompt).toContain('금지 제목');
        expect(prompt.systemPrompt).toContain('첫 실천 타이밍');
        expect(prompt.systemPrompt).toContain('사건 뒤 칭찬/회고만 하는 실천');
        expect(prompt.systemPrompt).toContain('아빠가 말했잖아');
        expect(prompt.systemPrompt).toContain('차 안 반복 노래');
        expect(prompt.systemPrompt).toContain('생활 장면 중심 제목');
        expect(prompt.isFollowUp).toBe(false);
    });

    it('builds follow-up prescription prompts that avoid repeating prior practice unchanged', () => {
        const prompt = buildConsultPrescriptionPrompt({
            problem: '여전히 유치원 선생님 놀이를 반복하고, 제가 대본과 다르게 말하면 다시 하자고 해요.',
            questions: [{ id: 'q1', text: '놀이가 반복될 때 아이 반응은 어떤가요?' }],
            answers: { q1: '어? 이게 아닌데 하면서 같은 말을 반복해요.' },
            childName: '서아',
            childBirthDate: '2021-09-01',
            childGender: 'female',
            childProfile,
            parentProfile,
            sessionContext: {
                session: { title: '유치원 놀이 재연' },
                consultations: [{
                    created_at: '2026-05-01T00:00:00Z',
                    problem_description: '유치원 선생님 놀이를 계속 따라해요.',
                    ai_prescription: { magicWord: '선생님 놀이구나.' },
                }],
                practices: [{
                    id: 'practice-1',
                    title: '아이의 놀이 끝나면, 칭찬하기',
                    duration: 7,
                    status: 'ACTIVE',
                }],
            },
        });

        expect(prompt.isFollowUp).toBe(true);
        expect(prompt.systemPrompt).toContain('현재 고민에 "여전히", "다시", "계속"처럼 반복 신호');
        expect(prompt.systemPrompt).toContain('이전 실천 항목을 그대로 반복하지 말고');
    });
});
