import { NextResponse } from 'next/server';
import {
  invalidJsonResponse,
  isInvalidJsonBodyError,
  isNonEmptyString,
  parseJsonBody,
} from '@/lib/api';
import { openai } from '@/lib/openai';
import { createClient } from '@/lib/supabaseServer';
import { getConsultModel } from '@/lib/consult-model';
import { getServerFeatureAccessForChild } from '@/lib/access';
import { recordSubscriptionUsageEvent } from '@/lib/subscription-usage';
import { validateConsultProblemInput } from '@/lib/consultInputValidation';
import { buildSelfParentQuestionsPrompt, type SelfParentCaregiverContext } from '@/lib/selfParentPromptBuilders';
import { checkSelfReflectionSafety } from '@/lib/selfReflectionGuardrail';

type RequestBody = {
  reflection?: unknown;
  childId?: unknown;
  caregiver?: unknown;
};

type QuestionOption = { id: string; text: string; freeText?: boolean };
type Question = { id: string; text: string; type: 'CHOICE' | 'TEXT'; options?: QuestionOption[] };

function isQuestionsResponse(value: unknown): value is { empathy: string; questions: Question[] } {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (typeof v.empathy !== 'string') return false;
  if (!Array.isArray(v.questions)) return false;
  return v.questions.every((q) => {
    if (!q || typeof q !== 'object') return false;
    const c = q as Record<string, unknown>;
    return isNonEmptyString(c.id) && isNonEmptyString(c.text) && (c.type === 'CHOICE' || c.type === 'TEXT');
  });
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await parseJsonBody<RequestBody>(request);
    const reflection = isNonEmptyString(body.reflection) ? body.reflection.trim() : '';
    const childId = isNonEmptyString(body.childId) ? body.childId.trim() : null;

    if (!reflection) {
      return NextResponse.json({ error: 'Missing reflection', code: 'empty' }, { status: 400 });
    }

    // 1) 위기 신호 우선 검사 — 감지 시 처방 대신 전문기관 안내 반환
    const safety = checkSelfReflectionSafety(reflection);
    if (!safety.safe) {
      // 카테고리·시점만 기록(원문 미저장)
      await supabase
        .from('self_reflection_safety_events')
        .insert({ user_id: session.user.id, category: safety.category })
        .then(undefined, (err: unknown) => console.warn('[self/questions] safety log failed:', err));
      return NextResponse.json(
        { safetyTriggered: true, category: safety.category, resources: safety.resources },
        { status: 200 }
      );
    }

    // 2) 입력 품질 검증 (아이 상담과 동일 기준)
    const validation = validateConsultProblemInput(reflection);
    if (!validation.ok) {
      return NextResponse.json(
        { error: 'Invalid input', code: validation.code },
        { status: 400 }
      );
    }

    // 3) 권한 — childId가 있으면 co-parent 커버리지도 반영
    const access = await getServerFeatureAccessForChild(supabase, {
      userId: session.user.id,
      userCreatedAt: session.user.created_at,
      childId,
    });
    if (!access.canUseConsult) {
      return NextResponse.json({ error: 'Subscription required', code: 'SUBSCRIPTION_REQUIRED' }, { status: 402 });
    }

    // 4) 양육자 맥락 구성 (선택적 — childId가 있으면 호칭/아이 이름)
    let caregiverContext: SelfParentCaregiverContext | null = null;
    if (childId) {
      const { data: child } = await supabase
        .from('children')
        .select('name, owner_label')
        .eq('id', childId)
        .maybeSingle();
      if (child) {
        caregiverContext = {
          labelText: typeof child.owner_label === 'string' ? labelToKorean(child.owner_label) : null,
          childName: child.name ?? null,
        };
      }
    }
    // body.caregiver로 클라이언트가 직접 호칭을 넘긴 경우 우선
    if (body.caregiver && typeof body.caregiver === 'object') {
      const c = body.caregiver as Record<string, unknown>;
      caregiverContext = {
        labelText: isNonEmptyString(c.labelText) ? c.labelText : caregiverContext?.labelText ?? null,
        childName: isNonEmptyString(c.childName) ? c.childName : caregiverContext?.childName ?? null,
        childAgeText: isNonEmptyString(c.childAgeText) ? c.childAgeText : null,
      };
    }

    const { systemPrompt, userMessage } = buildSelfParentQuestionsPrompt({ reflection, caregiverContext });
    const model = await getConsultModel(session.user.id);

    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content;
    const parsed = JSON.parse(content || '{"empathy":"","questions":[]}');
    if (!isQuestionsResponse(parsed)) {
      throw new Error('INVALID_SELF_QUESTIONS_RESPONSE');
    }

    await recordSubscriptionUsageEvent({
      userId: session.user.id,
      feature: 'AI_CONSULTATION',
      eventName: 'SELF_PARENT_QUESTIONS',
      metadata: { model },
    }).catch((err) => console.warn('[self/questions] usage log failed:', err));

    return NextResponse.json({ safetyTriggered: false, ...parsed });
  } catch (error) {
    if (isInvalidJsonBodyError(error)) return invalidJsonResponse();
    console.error('[self/questions] error:', error);
    return NextResponse.json({ error: 'Failed to generate questions' }, { status: 500 });
  }
}

function labelToKorean(label: string): string | null {
  switch (label) {
    case 'MOM':
      return '엄마';
    case 'DAD':
      return '아빠';
    case 'CARER':
      return '보호자';
    default:
      return null;
  }
}
