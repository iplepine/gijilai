import { NextResponse } from 'next/server';
import { invalidJsonResponse, isInvalidJsonBodyError, isNonEmptyString, parseJsonBody } from '@/lib/api';
import { openai } from '@/lib/openai';
import { createClient } from '@/lib/supabaseServer';
import { getConsultModel } from '@/lib/consult-model';
import { getServerFeatureAccess } from '@/lib/access';
import { recordSubscriptionUsageEvent } from '@/lib/subscription-usage';

type FollowUpResponse = {
    needsFollowUp: boolean;
    followUpReason?: string;
    followUpQuestions?: Array<{
        id: string;
        text: string;
        type: 'CHOICE' | 'TEXT';
        options?: Array<{
            id: string;
            text: string;
            freeText?: boolean;
        }>;
    }>;
};

function isFollowUpResponse(value: unknown): value is FollowUpResponse {
    if (!value || typeof value !== 'object') return false;
    const payload = value as Record<string, unknown>;

    if (typeof payload.needsFollowUp !== 'boolean') return false;
    if (payload.followUpReason !== undefined && typeof payload.followUpReason !== 'string') return false;
    if (payload.followUpQuestions === undefined) return true;
    if (!Array.isArray(payload.followUpQuestions)) return false;

    return payload.followUpQuestions.every((question) => {
        if (!question || typeof question !== 'object') return false;
        const candidate = question as Record<string, unknown>;
        const validOptions = candidate.options === undefined || (
            Array.isArray(candidate.options)
            && candidate.options.every((option) => {
                if (!option || typeof option !== 'object') return false;
                const optionCandidate = option as Record<string, unknown>;
                return isNonEmptyString(optionCandidate.id)
                    && isNonEmptyString(optionCandidate.text)
                    && (optionCandidate.freeText === undefined || typeof optionCandidate.freeText === 'boolean');
            })
        );

        return isNonEmptyString(candidate.id)
            && isNonEmptyString(candidate.text)
            && (candidate.type === 'CHOICE' || candidate.type === 'TEXT')
            && validOptions;
    });
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

        const { problem, firstRoundAnswers } = await parseJsonBody<{
            problem?: string;
            firstRoundAnswers?: Record<string, string>;
        }>(request);

        if (!problem || !firstRoundAnswers) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        const systemPrompt = `당신은 아동 심리 및 기질 전문가입니다. 
1차 답변 데이터를 분석하여, 아이의 기질적 원인을 확정하기 위해 추가 정보가 더 필요한지 판단하세요.

**[분석 가이드]**
1. 1차 답변만으로 기질적 특성(NS, HA, RD, P 등)과 환경적 요인이 충분히 설명된다면 "needsFollowUp": false로 설정하세요.
2. 특정 기질적 특성을 더 명확히 확인해야 하거나(예: 고집의 이유가 자극추구인지 위험회피인지 등), 갈등의 트리거를 더 구체화해야 한다면 "needsFollowUp": true로 설정하고 '심층 질문' 1~2개를 생성하세요.
3. 질문은 1차 답변 내용을 언급하며 날카롭되 다정하게 물어보세요.
4. 심층 질문도 CHOICE와 TEXT를 적절히 사용하세요. 구체적 경험이나 감정을 직접 들어야 할 때는 TEXT 타입으로 생성하세요. 객관식 선택지로 대부분 커버되지만 양육자의 상황이 다를 수 있는 경우, 마지막 선택지에 "freeText": true를 추가하세요.

**[Output Format (JSON Only)]**
{
  "needsFollowUp": true,
  "followUpReason": "추가 질문이 필요한 이유를 양육자에게 다정하게 설명 (1~2문장)",
  "followUpQuestions": [
    {
      "id": "f1",
      "text": "심층 질문 내용 (객관식)",
      "type": "CHOICE",
      "options": [
        { "id": "f1_a", "text": "선택지 텍스트" },
        { "id": "f1_b", "text": "기타 (직접 입력)", "freeText": true }
      ]
    },
    {
      "id": "f2",
      "text": "심층 질문 내용 (주관식)",
      "type": "TEXT"
    }
  ]
}

주의: JSON 형식만 출력하세요. markdown 기호 없이 순수 JSON 문자열만 반환해야 합니다.`;

        const userMessage = `
고민 상황: ${problem}
1차 문진 답변: ${JSON.stringify(firstRoundAnswers)}
`;

        const model = await getConsultModel(session.user.id);

        const response = await openai.chat.completions.create({
            model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userMessage },
            ],
            temperature: 0.7,
            response_format: { type: "json_object" }
        });

        const content = response.choices[0].message.content;
        const parsed = JSON.parse(content || '{"needsFollowUp": false}');
        if (!isFollowUpResponse(parsed)) {
            throw new Error('INVALID_FOLLOWUP_RESPONSE');
        }
        await recordSubscriptionUsageEvent({
            userId: session.user.id,
            feature: 'AI_CONSULTATION',
            eventName: 'CONSULT_QUESTIONS_FOLLOWUP',
            metadata: {
                needsFollowUp: parsed.needsFollowUp === true,
                model,
            },
        });

        return NextResponse.json(parsed);
    } catch (error) {
        if (isInvalidJsonBodyError(error)) {
            return invalidJsonResponse();
        }

        console.error('Error generating follow-up questions:', error);
        return NextResponse.json(
            { error: 'Failed to process follow-up' },
            { status: 500 }
        );
    }
}
