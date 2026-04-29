import { NextResponse } from 'next/server';
import { invalidJsonResponse, isInvalidJsonBodyError, isNonEmptyString, parseJsonBody } from '@/lib/api';
import { openai } from '@/lib/openai';
import { createClient } from '@/lib/supabaseServer';
import { getConsultModel } from '@/lib/consult-model';
import { getServerFeatureAccess } from '@/lib/access';
import { recordSubscriptionUsageEvent } from '@/lib/subscription-usage';

type ObservationPromptItem = {
    created_at: string;
    situation: string;
    my_action: string;
    child_reaction: string;
    note?: string | null;
};

type SessionContextPrescription = {
    interpretation?: string;
    magicWord?: string;
    questionAnalysis?: Array<{
        question: string;
        answer: string;
        analysis: string;
    }>;
};

type SessionContextConsultation = {
    created_at: string;
    problem_description: string;
    ai_prescription?: SessionContextPrescription | null;
};

type SessionContextPractice = {
    id: string;
    title: string;
    duration: number;
    status: string;
};

type SessionContextLog = {
    practice_id: string;
    done: boolean;
};

type SessionContextReview = {
    practice_id: string;
    content: string;
};

type SessionContext = {
    session: { title: string };
    consultations?: SessionContextConsultation[];
    practices?: SessionContextPractice[];
    logs?: SessionContextLog[];
    reviews?: SessionContextReview[];
};

type QuestionPromptItem = {
    id: string;
    text: string;
};

type PrescriptionResponse = {
    interpretation: string;
    chemistry: string;
    magicWord: string;
    questionAnalysis?: Array<{
        question: string;
        answer: string;
        analysis: string;
    }>;
    actionItem?: string;
    actionItems?: Array<{
        title: string;
        trigger?: string;
        action?: string;
        description: string;
        duration: number;
        encouragement: string;
    }>;
    sessionTitle?: string;
};

function isPrescriptionResponse(value: unknown): value is PrescriptionResponse {
    if (!value || typeof value !== 'object') return false;
    const payload = value as Record<string, unknown>;
    const validQuestionAnalysis = payload.questionAnalysis === undefined || (
        Array.isArray(payload.questionAnalysis)
        && payload.questionAnalysis.every((item) => {
            if (!item || typeof item !== 'object') return false;
            const candidate = item as Record<string, unknown>;
            return isNonEmptyString(candidate.question)
                && isNonEmptyString(candidate.answer)
                && isNonEmptyString(candidate.analysis);
        })
    );
    const validActionItems = payload.actionItems === undefined || (
        Array.isArray(payload.actionItems)
        && payload.actionItems.every((item) => {
            if (!item || typeof item !== 'object') return false;
            const candidate = item as Record<string, unknown>;
            return isNonEmptyString(candidate.title)
                && isNonEmptyString(candidate.description)
                && typeof candidate.duration === 'number'
                && isNonEmptyString(candidate.encouragement)
                && (candidate.trigger === undefined || typeof candidate.trigger === 'string')
                && (candidate.action === undefined || typeof candidate.action === 'string');
        })
    );

    return isNonEmptyString(payload.interpretation)
        && isNonEmptyString(payload.chemistry)
        && isNonEmptyString(payload.magicWord)
        && validQuestionAnalysis
        && validActionItems
        && (payload.actionItem === undefined || typeof payload.actionItem === 'string')
        && (payload.sessionTitle === undefined || typeof payload.sessionTitle === 'string');
}

function formatObservationsForPrompt(observations: ObservationPromptItem[]): string {
    return observations.map((obs) => {
        const date = new Date(obs.created_at).toLocaleDateString('ko-KR');
        let entry = `[${date}] 상황: ${obs.situation} → 양육자 행동: ${obs.my_action} → 아이 반응: ${obs.child_reaction}`;
        if (obs.note) {
            entry += ` (메모: ${obs.note})`;
        }
        return entry;
    }).join('\n');
}

function formatSessionContextForPrompt(sessionContext: SessionContext | null | undefined): string {
    if (!sessionContext) return '';

    let context = `\n\n**[이전 상담 맥락 — 추가 상담]**\n`;
    context += `세션 주제: ${sessionContext.session.title}\n`;

    // 최근 3건 상담만 상세
    const consultations = sessionContext.consultations || [];
    const recent = consultations.slice(-3);

    for (const c of recent) {
        const date = new Date(c.created_at).toLocaleDateString('ko-KR');
        context += `\n[${date} 상담]\n`;
        context += `고민: ${c.problem_description}\n`;
        if (c.ai_prescription) {
            const rx = c.ai_prescription;
            if (rx.interpretation) context += `속마음 통역: ${rx.interpretation.substring(0, 200)}...\n`;
            if (rx.magicWord) context += `마법의 한마디: ${rx.magicWord}\n`;
            // questionAnalysis 요약
            if (rx.questionAnalysis && rx.questionAnalysis.length > 0) {
                context += `문진 해설:\n`;
                for (const qa of rx.questionAnalysis) {
                    context += `  Q: ${qa.question} → A: ${qa.answer} → ${qa.analysis}\n`;
                }
            }
        }
    }

    // 실천 기록 요약
    const practices = sessionContext.practices || [];
    if (practices.length > 0) {
        context += `\n[실천 기록]\n`;
        const logs = sessionContext.logs || [];
        const reviews = sessionContext.reviews || [];
        for (const p of practices) {
            const practiceLogs = logs.filter((l) => l.practice_id === p.id);
            const doneDays = practiceLogs.filter((l) => l.done).length;
            const review = reviews.find((r) => r.practice_id === p.id);
            context += `- ${p.title} | ${doneDays}/${p.duration}일 실천 (${p.status})`;
            if (review) context += ` | 회고: ${review.content}`;
            context += `\n`;
        }
    }

    return context;
}

export async function POST(request: Request) {
    try {
        const supabase = await createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const access = await getServerFeatureAccess(supabase, {
            userId: session.user.id,
            userCreatedAt: session.user.created_at,
        });
        if (!access.canUseConsult) {
            return NextResponse.json({ error: 'Subscription required', code: 'SUBSCRIPTION_REQUIRED' }, { status: 402 });
        }

        const {
            problem,
            questions,
            answers,
            childProfile,
            parentProfile,
            childName,
            childBirthDate,
            childGender,
            recentObservations,
            sessionContext
        }: {
            problem?: string;
            questions?: QuestionPromptItem[];
            answers?: Record<string, string>;
            childProfile?: {
                label: string;
                keywords: string[];
                description: string;
                scores: { NS: number; HA: number; RD: number; P: number };
            } | null;
            parentProfile?: {
                label: string;
                keywords: string[];
                description: string;
                scores: { NS: number; HA: number; RD: number; P: number };
            } | null;
            childName?: string;
            childBirthDate?: string;
            childGender?: string;
            recentObservations?: ObservationPromptItem[];
            sessionContext?: SessionContext | null;
        } = await parseJsonBody<{
            problem?: string;
            questions?: QuestionPromptItem[];
            answers?: Record<string, string>;
            childProfile?: {
                label: string;
                keywords: string[];
                description: string;
                scores: { NS: number; HA: number; RD: number; P: number };
            } | null;
            parentProfile?: {
                label: string;
                keywords: string[];
                description: string;
                scores: { NS: number; HA: number; RD: number; P: number };
            } | null;
            childName?: string;
            childBirthDate?: string;
            childGender?: string;
            recentObservations?: ObservationPromptItem[];
            sessionContext?: SessionContext | null;
        }>(request);

        // 나이 계산
        let childAge = '';
        if (childBirthDate) {
          const birth = new Date(childBirthDate);
          const today = new Date();
          const totalMonths = (today.getFullYear() - birth.getFullYear()) * 12 + (today.getMonth() - birth.getMonth());
          if (totalMonths <= 36) {
            childAge = `${totalMonths}개월`;
          } else {
            const years = Math.floor(totalMonths / 12);
            const months = totalMonths % 12;
            childAge = months > 0 ? `${years}세 ${months}개월` : `${years}세`;
          }
        }

        if (!problem || !answers) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        const nameContext = childName ? `${childName}(${childAge || '나이 미상'}${childGender === 'male' ? ', 남아' : childGender === 'female' ? ', 여아' : ''})` : '아이';
        const isFollowUp = !!sessionContext;

        const systemPrompt = `당신은 기질(TCI) 기반의 분석 전문가이자 따뜻한 마음 통역사입니다.
아이의 기질, 양육자의 기질, 그리고 구체적인 상황 문진 결과를 분석하여 이 갈등의 근본적인 원인을 친절하게 설명하고 실천 가능한 솔루션을 제공하세요.

**[분석 재료]**
- 대상: ${nameContext}
${childProfile ? `- 아이 기질 유형: ${childProfile.label} (${childProfile.keywords.join(', ')})
  - 설명: ${childProfile.description}
  - 차원별 점수 (0~100): 자극추구=${childProfile.scores.NS}, 위험회피=${childProfile.scores.HA}, 사회적민감성=${childProfile.scores.RD}, 지속성=${childProfile.scores.P}` : '- 아이 기질: 검사 데이터 없음 (보편적 아동 기질로 분석)'}
${parentProfile ? `- 양육자 기질 유형: ${parentProfile.label} (${parentProfile.keywords.join(', ')})
  - 설명: ${parentProfile.description}
  - 차원별 점수 (0~100): 자극추구=${parentProfile.scores.NS}, 위험회피=${parentProfile.scores.HA}, 사회적민감성=${parentProfile.scores.RD}, 지속성=${parentProfile.scores.P}` : '- 양육자 기질: 검사 데이터 없음 (보편적 양육자 기질로 분석)'}
- 고민 상황: ${problem}
- 문진 질문과 답변:
${questions && questions.length > 0 ? questions.map((q) => `  Q: ${q.text}\n  A: ${answers[q.id] || '(미응답)'}`).join('\n') : JSON.stringify(answers)}${recentObservations && recentObservations.length > 0 ? `
- 최근 양육 관찰 기록:
${formatObservationsForPrompt(recentObservations)}` : ''}${formatSessionContextForPrompt(sessionContext)}

**[응답 가이드]**
1. **연령·성별 개인화 전제**:
   - 아이의 연령/개월 수를 분석의 핵심 조건으로 사용하세요. 해당 시기의 인지 이해 수준, 감정 조절 가능 범위, 전환 난이도, 놀이/또래/가정 맥락을 반영해야 합니다.
   - 성별은 고정관념 강화 근거로 사용하지 마세요. "남자아이니까", "여자아이니까" 같은 일반화는 금지합니다.
   - 성별 정보는 부모가 체감하는 생활 장면을 더 자연스럽게 구체화하는 수준에서만 보조적으로 활용하세요.
2. **아이의 속마음 통역 (interpretation)**: 아이가 직접 이야기하는 것처럼 아이의 말투로 속마음을 표현하세요. 예: "나는 게임에서 지면 너무 무서워요. 잘하고 싶은 마음이 너무 크거든요. 그런데 지면 그 마음이 한꺼번에 터져서 울음이 나와요..." 식으로 아이의 1인칭 시점에서 기질적 욕구를 자연스럽게 담아 설명하세요. 문진 답변에서 드러난 구체적 상황을 반영하되, 아이의 눈높이와 연령에 맞는 단어와 표현을 사용하세요. 너무 성숙하거나 지나치게 유아적인 말투는 금지합니다. (5~7줄로 충분히 상세하게)
3. **아이와 나 (chemistry)**: 양육자를 탓하지 마세요. 문진 답변에서 나타난 양육자의 대응 방식과 아이의 반응 패턴을 연결하여, 기질 간 역동으로 설명하세요. "~한 상황에서 양육자님이 ~하신 것은 자연스러운 반응이지만, 아이의 ~한 기질과 만나면..." 식으로 구체적으로 분석하세요. 분석에는 현재 연령에서 가능한 자기조절 수준과 이해 수준을 반영하세요. (4~6줄)
4. **문진 해설 (questionAnalysis)**: 각 문진 질문과 양육자의 답변을 기질 관점에서 해설하세요. 각 항목은 질문 원문(question), 답변 원문(answer), 그리고 해설(analysis)로 구성합니다.
   - 해설은 반드시 **답변의 구체 장면/표현을 먼저 짚고**, 그 다음에 기질 또는 발달적 가능성을 연결하세요.
   - 단정형보다 **가능성형 표현**을 우선 사용하세요. 예: "~가 드러납니다"보다 "~ 가능성이 보입니다", "~로 이해할 수 있습니다", "~ 경향이 엿보입니다".
   - **한 답변에서 기질 포인트는 1개만** 잡으세요. 한 문장에 여러 특성을 한꺼번에 붙여 끼워 맞추지 마세요.
   - 답변만으로 근거가 약하면 기질을 억지로 특정하지 말고, **발달적 맥락/상황 해석** 수준에서 설명하세요.
   - "표현력이 있다", "사회적 민감성이 높다", "인내력이 높다"처럼 **추상 라벨만 단독 선언하는 문장**은 금지합니다. 왜 그렇게 보는지 답변 속 단서와 연결해 설명하세요.
   - 동일한 행동을 자극추구/위험회피/사회적민감성/인내력 중 여러 축에 동시에 과잉 매핑하지 마세요.
   - 해설은 2~3문장으로 작성하되, **장면 근거 1문장 + 해석 1문장** 구조를 기본으로 하세요.
   - 좋은 예: "유치원 장면을 집에 와서 반복해 재현했다는 답변을 보면, 그 경험이 아이에게 꽤 인상 깊었던 것으로 보여요. 단순 모방이라기보다 흥미로운 장면을 자기 방식으로 다시 다뤄보려는 몰입 경향으로 이해할 수 있습니다."
   - 나쁜 예: "이 답변에서 아이의 표현력, 사회적 민감성, 자극추구가 모두 드러납니다."
5. **오늘의 한마디 (magicWord)**: 이 상황에서 아이에게 바로 해볼 수 있는 구체적인 대화 스크립트를 제공하세요. 따옴표는 포함하지 마세요.
   - 해당 연령의 아이가 한 번에 이해할 수 있는 짧고 구체적인 문장으로 작성하세요.
   - 추상적 훈계나 긴 설명은 금지합니다.
6. **실천 항목 (actionItems)**: 정확히 3개의 실천 항목을 제안하세요. 양육자가 이 중에서 하나만 골라 실천합니다.
   - title: 구체적 행동을 한 줄로 표현. 가능하면 "~할 때, ~하기" If-Then 형식을 권장합니다. (예: "어린이집 현관에서 울 때, 10초 안아주기"). 30초 이내에 실행 가능한 크기여야 합니다.
   - trigger: (선택) 이 실천을 할 구체적 상황/순간. If-Then 형식일 때 포함. (예: "아이가 어린이집 앞에서 울 때")
   - action: (선택) 그 순간에 할 구체적 행동. If-Then 형식일 때 포함. (예: "현관에서 10초 안아주며 '엄마도 보고 싶을 거야' 말하기")
   - description: 왜 이 실천이 이 아이의 기질에 효과적인지 1~2줄 설명.
   - duration: 권장 기간 (일 단위 3~7). 짧게 설정하여 성공 경험을 먼저 만드세요.
   - encouragement: 응원 메시지. 숙제가 아닌 다정한 톤으로.
   - 3개 항목은 서로 다른 접근 방식이어야 합니다.
   **실천 항목 품질 기준 (반드시 준수)**:
   - **Tiny Habits 원칙**: 각 실천은 30초 이내에 할 수 있는 아주 작은 행동이어야 합니다. 크고 어려운 과제는 금지. "매일 30분 놀아주기" ❌ → "잠들기 전 이불 속에서 '오늘 뭐가 재밌었어?' 한마디 묻기" ✅
   - **If-Then 권장**: 상황이 명확한 고민이면 "~할 때, ~하기" 구조 + trigger/action 필드를 포함하세요. 일상 습관형 실천이면 If-Then 없이 작성해도 됩니다.
   - 각 항목은 위에서 분석한 고민 상황과 직접적으로 연결되어야 합니다. 문진 답변에서 나온 구체적 상황(예: 아침 등원, 식사 시간, 형제 다툼)에 맞춘 행동을 제안하세요.
   - "칭찬하기", "공감하기", "대화하기" 같은 범용적/추상적 실천은 금지합니다.
   - 나쁜 예: "하루 한 번 아이 감정 공감해주기" → 좋은 예: "어린이집 가기 싫다고 울 때, 현관에서 10초 안아주며 '엄마도 보고 싶을 거야' 말하기"
   - 실천 항목은 해당 연령의 아이가 실제로 따라올 수 있는 전환 속도와 이해 수준을 기준으로 설계하세요.
   - 성별 고정관념에 기대는 처방은 금지합니다.${isFollowUp ? `
7. **실천 기록 연계**: 이전 상담의 실천 기록을 참고하여, 효과적이었던 방법은 강화하고 효과 없었던 것은 다른 접근을 제안하세요. "지난번에 ~를 시도하셨는데"와 같이 자연스럽게 언급하세요.` : recentObservations && recentObservations.length > 0 ? `
7. **관찰 기록 연계**: 양육자의 최근 관찰 기록을 참고하여, 이전에 시도한 방법 중 효과적이었던 것은 강화하고 효과가 없었던 것은 다른 접근을 제안하세요. 관찰 기록이 있으면 "지난번에 ~를 시도하셨는데"와 같이 자연스럽게 언급하세요.` : ''}
${!isFollowUp ? `8. **세션 제목 (sessionTitle)**: 이 고민을 한 줄(15자 이내)로 요약한 제목을 생성하세요. 예: "어린이집 분리불안", "형제 장난감 싸움", "밥 안 먹는 문제"` : ''}

**[중요]**
- 모든 분석에서 문진 답변의 구체적 내용을 근거로 활용하세요. 추상적이고 일반적인 조언이 아닌, 이 양육자의 상황에 딱 맞는 맞춤 분석이어야 합니다.
- "~라고 답변해 주셨는데", "문진에서 ~한 경향이 보이는데" 등의 표현으로 답변을 자연스럽게 인용하세요.
- 절대 NS, HA, RD, P, TCI 같은 영문 약어를 사용하지 마세요. 한글 용어(자극추구, 위험회피, 사회적민감성, 인내력)를 사용하세요.
- 실천 항목은 "고민 상황 → 속마음 통역 → 실천"의 일관된 흐름을 가져야 합니다. 속마음 통역에서 파악한 아이의 핵심 욕구를 충족시키는 방향으로 실천을 설계하세요.
- 아이의 연령, 성별 정보는 반드시 분석과 표현에 반영하되, 성별 일반화는 금지합니다.
- 특히 \`questionAnalysis\`는 "그럴듯한 기질 라벨 붙이기"가 아니라, **답변 근거를 바탕으로 신중하게 해석하는 섹션**이어야 합니다.

**[Output Format (JSON Only)]**
{
  "interpretation": "아이의 속마음 번역 (5~7줄, 문진 답변 근거 포함)...",
  "chemistry": "기질 간의 충돌 지점 설명 (4~6줄, 문진 답변 근거 포함)...",
  "questionAnalysis": [
    { "question": "질문 원문", "answer": "답변 원문", "analysis": "답변 속 장면 근거 + 신중한 기질/발달 해석 2~3문장" }
  ],
  "magicWord": "아이에게 바로 해볼 수 있는 대화 스크립트",
  "actionItems": [
    { "title": "~할 때, ~하기", "trigger": "구체적 상황/순간", "action": "30초 이내 행동", "description": "기질 연결 설명", "duration": 5, "encouragement": "응원" },
    { "title": "~할 때, ~하기", "trigger": "구체적 상황/순간", "action": "30초 이내 행동", "description": "기질 연결 설명", "duration": 5, "encouragement": "응원" },
    { "title": "~할 때, ~하기", "trigger": "구체적 상황/순간", "action": "30초 이내 행동", "description": "기질 연결 설명", "duration": 7, "encouragement": "응원" }
  ]${!isFollowUp ? `,
  "sessionTitle": "고민 요약 제목 (15자 이내)"` : ''}
}

주의: JSON 형식만 출력하세요. markdown 기호 없이 순수 JSON 문자열만 반환해야 합니다.`;

        const model = await getConsultModel(session.user.id);

        const response = await openai.chat.completions.create({
            model,
            messages: [
                { role: 'system', content: systemPrompt }
            ],
            temperature: 0.7,
            response_format: { type: "json_object" }
        });

        const content = response.choices[0].message.content;
        const parsed = JSON.parse(content || '{}');
        if (!isPrescriptionResponse(parsed)) {
            throw new Error('INVALID_PRESCRIPTION_RESPONSE');
        }

        // 하위 호환: actionItem 필드 유지
        if (parsed.actionItems && parsed.actionItems.length > 0 && !parsed.actionItem) {
            parsed.actionItem = parsed.actionItems[0].description;
        }

        await recordSubscriptionUsageEvent({
            userId: session.user.id,
            feature: 'AI_CONSULTATION',
            eventName: 'CONSULT_PRESCRIPTION',
            metadata: {
                isFollowUp,
                model,
                actionItemCount: Array.isArray(parsed.actionItems) ? parsed.actionItems.length : 0,
            },
        });

        return NextResponse.json(parsed);
    } catch (error) {
        if (isInvalidJsonBodyError(error)) {
            return invalidJsonResponse();
        }

        console.error('Error generating prescription:', error);
        return NextResponse.json(
            { error: 'Failed to generate prescription' },
            { status: 500 }
        );
    }
}
