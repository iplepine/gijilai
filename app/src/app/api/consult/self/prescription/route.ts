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
import { buildSelfParentPrescriptionPrompt, type SelfParentCaregiverContext } from '@/lib/selfParentPromptBuilders';
import { checkSelfReflectionSafety } from '@/lib/selfReflectionGuardrail';
import {
  isSelfParentPrescription,
  normalizeSelfParentPrescription,
} from '@/lib/selfParentPrescription';

type RequestBody = {
  reflection?: unknown;
  questions?: unknown;
  answers?: unknown;
  childId?: unknown;
  caregiver?: unknown;
};

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
    const answers = (body.answers && typeof body.answers === 'object' ? body.answers : {}) as Record<string, string>;
    const questions = Array.isArray(body.questions)
      ? (body.questions as Array<{ id: string; text: string }>).filter(
          (q) => q && typeof q.id === 'string' && typeof q.text === 'string'
        )
      : undefined;

    if (!reflection) {
      return NextResponse.json({ error: 'Missing reflection' }, { status: 400 });
    }

    // 1) 위기 신호 재검사 — 입력 + 답변 자유 텍스트 모두 검사
    const combinedText = [reflection, ...Object.values(answers)].join(' ');
    const safety = checkSelfReflectionSafety(combinedText);
    if (!safety.safe) {
      await supabase
        .from('self_reflection_safety_events')
        .insert({ user_id: session.user.id, category: safety.category })
        .then(undefined, (err: unknown) => console.warn('[self/prescription] safety log failed:', err));
      return NextResponse.json(
        { safetyTriggered: true, category: safety.category, resources: safety.resources },
        { status: 200 }
      );
    }

    // 2) 권한
    const access = await getServerFeatureAccessForChild(supabase, {
      userId: session.user.id,
      userCreatedAt: session.user.created_at,
      childId,
    });
    if (!access.canUseConsult) {
      return NextResponse.json({ error: 'Subscription required', code: 'SUBSCRIPTION_REQUIRED' }, { status: 402 });
    }

    // 3) 양육자 맥락
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
    if (body.caregiver && typeof body.caregiver === 'object') {
      const c = body.caregiver as Record<string, unknown>;
      caregiverContext = {
        labelText: isNonEmptyString(c.labelText) ? c.labelText : caregiverContext?.labelText ?? null,
        childName: isNonEmptyString(c.childName) ? c.childName : caregiverContext?.childName ?? null,
        childAgeText: isNonEmptyString(c.childAgeText) ? c.childAgeText : null,
      };
    }

    const { systemPrompt } = buildSelfParentPrescriptionPrompt({
      reflection,
      questions,
      answers,
      caregiverContext,
    });
    const model = await getConsultModel(session.user.id);

    const response = await openai.chat.completions.create({
      model,
      messages: [{ role: 'system', content: systemPrompt }],
      temperature: 0.5,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content;
    const parsed = JSON.parse(content || '{}');
    if (!isSelfParentPrescription(parsed)) {
      throw new Error('INVALID_SELF_PRESCRIPTION_RESPONSE');
    }
    const prescription = normalizeSelfParentPrescription(parsed);

    // 4) 상담 기록 저장 — SELF_PARENT 세션 + consultation (Phase 1: 후속 상담 X, 기록만)
    let savedSessionId: string | null = null;
    let savedConsultId: string | null = null;
    try {
      const { data: newSession } = await supabase
        .from('consultation_sessions')
        .insert({
          user_id: session.user.id,
          child_id: childId,
          title: prescription.sessionTitle?.slice(0, 30) || '내 마음 기록',
          status: 'ACTIVE',
          type: 'SELF_PARENT',
        })
        .select('id')
        .single();
      savedSessionId = newSession?.id ?? null;

      const { data: newConsult } = await supabase
        .from('consultations')
        .insert({
          user_id: session.user.id,
          child_id: childId,
          session_id: savedSessionId,
          problem_description: reflection,
          user_response: answers,
          ai_prescription: prescription,
          status: 'COMPLETED',
          type: 'SELF_PARENT',
        })
        .select('id')
        .single();
      savedConsultId = newConsult?.id ?? null;
    } catch (saveError) {
      // 저장 실패해도 처방은 보여준다 (사용자 경험 우선)
      console.warn('[self/prescription] save failed:', saveError);
    }

    await recordSubscriptionUsageEvent({
      userId: session.user.id,
      feature: 'AI_CONSULTATION',
      eventName: 'SELF_PARENT_PRESCRIPTION',
      metadata: { model, tool: prescription.action.tool },
    }).catch((err) => console.warn('[self/prescription] usage log failed:', err));

    return NextResponse.json({
      safetyTriggered: false,
      prescription,
      sessionId: savedSessionId,
      consultationId: savedConsultId,
    });
  } catch (error) {
    if (isInvalidJsonBodyError(error)) return invalidJsonResponse();
    console.error('[self/prescription] error:', error);
    return NextResponse.json({ error: 'Failed to generate prescription' }, { status: 500 });
  }
}
