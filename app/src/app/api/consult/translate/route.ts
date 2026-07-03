import { NextResponse } from 'next/server';
import { invalidJsonResponse, isInvalidJsonBodyError, isNonEmptyString, parseJsonBody } from '@/lib/api';
import { openai } from '@/lib/openai';
import { createClient } from '@/lib/supabaseServer';
import { validateConsultProblemInput } from '@/lib/consultInputValidation';
import {
    getOwnedConsultChild,
    resolveConsultTemperamentProfile,
} from '@/lib/consultTemperamentContext';
import {
    buildAiTranslatePrompt,
    isAiTranslateResult,
    normalizeAiTranslateResult,
} from '@/lib/aiTranslatePrompt';
import { consumeLlmQuota, LLM_QUOTA_EXCEEDED_CODE } from '@/lib/llm-quota';
import {
    CHILD_NAME_PSEUDONYM,
    maskChildNameText,
    unmaskChildNameDeep,
} from '@/lib/childPseudonym';

// 아이말 번역기: 상담 진입 전의 가벼운 무료 훅.
// 구독 게이트 없이 인증 사용자면 누구나 쓸 수 있고, 남용은 llm_usage_events 일일 쿼터로만 막는다.
// 결과는 저장하지 않는 단발성 응답 — "상담으로 이어가기"가 유료 상담 루프로의 전환 경로다.
// 아이 이름·연령·기질은 서버에서 childId 기준으로 확정한다(클라이언트 값을 그대로 신뢰하지 않음).

function ageTextFromBirthDate(birthDate?: string | null): string | null {
    if (!birthDate) return null;
    const birth = new Date(birthDate);
    if (Number.isNaN(birth.getTime())) return null;
    const today = new Date();
    let months =
        (today.getFullYear() - birth.getFullYear()) * 12 +
        (today.getMonth() - birth.getMonth());
    if (today.getDate() < birth.getDate()) months -= 1;
    months = Math.max(0, months);
    const years = Math.floor(months / 12);
    return `${years}세 (${months}개월)`;
}

export async function POST(request: Request) {
    try {
        const supabase = await createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await parseJsonBody<{ input?: unknown; childId?: unknown }>(request);
        const input = isNonEmptyString(body.input) ? body.input.trim() : '';
        const childId = isNonEmptyString(body.childId) ? body.childId.trim() : null;

        const validation = validateConsultProblemInput(input);
        if (!validation.ok) {
            return NextResponse.json(
                { error: '번역할 상황을 조금 더 적어주세요.', code: validation.code },
                { status: 400 }
            );
        }

        // 아이 소유/공동양육 권한 확인 (권한 없는 childId는 개인화에서 무시)
        const ownedChild = childId ? await getOwnedConsultChild(supabase, session.user.id, childId) : null;
        const effectiveChildId = ownedChild?.id ?? null;

        const [childProfile, parentProfile] = await Promise.all([
            resolveConsultTemperamentProfile(supabase, {
                userId: session.user.id,
                type: 'CHILD',
                childId: effectiveChildId,
            }),
            resolveConsultTemperamentProfile(supabase, {
                userId: session.user.id,
                type: 'PARENT',
            }),
        ]);

        const quota = await consumeLlmQuota({ userId: session.user.id, kind: 'TRANSLATE' });
        if (!quota.allowed) {
            return NextResponse.json(
                { error: '오늘 번역 한도를 초과했어요. 내일 다시 시도해주세요.', code: LLM_QUOTA_EXCEEDED_CODE },
                { status: 429 }
            );
        }

        // 아이 실명은 외부 LLM에 보내지 않는다 — 가명으로 보내고 응답에서 복원한다.
        const realChildName = ownedChild?.name?.trim() || null;
        const { systemPrompt } = buildAiTranslatePrompt({
            input: maskChildNameText(input, realChildName),
            childName: realChildName ? CHILD_NAME_PSEUDONYM : null,
            childAgeText: ageTextFromBirthDate(ownedChild?.birthDate),
            childGender: ownedChild?.gender ?? null,
            childProfile,
            parentProfile,
        });

        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'system', content: systemPrompt }],
            temperature: 0.6,
            response_format: { type: 'json_object' },
        });

        const content = response.choices[0].message.content;
        const parsed = JSON.parse(content || '{}');
        if (!isAiTranslateResult(parsed)) {
            throw new Error('INVALID_TRANSLATE_RESPONSE');
        }
        const result = unmaskChildNameDeep(normalizeAiTranslateResult(parsed), realChildName);

        return NextResponse.json({ result });
    } catch (error) {
        if (isInvalidJsonBodyError(error)) {
            return invalidJsonResponse();
        }
        console.error('[consult/translate] error:', error);
        return NextResponse.json({ error: 'Failed to translate' }, { status: 500 });
    }
}
