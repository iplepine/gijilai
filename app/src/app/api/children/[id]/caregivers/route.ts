import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { TemperamentClassifier } from '@/lib/TemperamentClassifier';
import {
  isCaregiverLabel,
  isCoParentInvitesEnabled,
  type CaregiverLabel,
} from '@/lib/coParent';
import { analyzeParentParentHarmony, type TemperamentScoreSet } from '@/lib/parentParentHarmony';
import { createClient } from '@/lib/supabaseServer';

function getSupabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

type ParentReportRow = {
  analysis_json: unknown;
  created_at: string;
};

function extractScores(analysis: unknown): TemperamentScoreSet | null {
  if (!analysis || typeof analysis !== 'object') return null;
  const a = analysis as Record<string, unknown>;
  const direct = a.scores as Record<string, unknown> | undefined;
  if (direct && isScoreSet(direct)) return direct as unknown as TemperamentScoreSet;
  const nested = a.analysis as Record<string, unknown> | undefined;
  if (nested && isScoreSet(nested.scores as Record<string, unknown> | undefined)) {
    return nested.scores as unknown as TemperamentScoreSet;
  }
  return null;
}

function isScoreSet(value: Record<string, unknown> | undefined): boolean {
  if (!value) return false;
  return ['NS', 'HA', 'RD', 'P'].every((k) => typeof value[k] === 'number');
}

type CaregiverPayload = {
  userId: string;
  role: 'OWNER' | 'CO_PARENT';
  label: CaregiverLabel | null;
  displayName: string | null;
  isCurrentUser: boolean;
  parentProfile:
    | {
        label: string;
        emoji?: string;
        keywords: string[];
        description: string;
        image?: string;
        scores: TemperamentScoreSet;
      }
    | null;
};

async function loadParentProfile(
  admin: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
): Promise<CaregiverPayload['parentProfile']> {
  // 1) reports에서 최신 PARENT 점수 시도
  const { data: reportRows } = await admin
    .from('reports')
    .select('analysis_json, created_at')
    .eq('user_id', userId)
    .eq('type', 'PARENT')
    .order('created_at', { ascending: false })
    .limit(5);

  for (const row of (reportRows ?? []) as ParentReportRow[]) {
    const scores = extractScores(row.analysis_json);
    if (scores) {
      const t = TemperamentClassifier.analyzeParent(scores);
      return {
        label: t.label,
        emoji: t.emoji,
        keywords: t.keywords,
        description: t.desc,
        image: t.image,
        scores,
      };
    }
  }

  // 2) reports에 없으면 surveys.scores fallback
  const { data: surveyRows } = await admin
    .from('surveys')
    .select('scores')
    .eq('user_id', userId)
    .eq('type', 'PARENT')
    .eq('status', 'COMPLETED')
    .order('updated_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(5);

  for (const row of surveyRows ?? []) {
    const scores = (row as { scores?: Record<string, unknown> | null }).scores;
    if (scores && isScoreSet(scores as Record<string, unknown>)) {
      const s = scores as unknown as TemperamentScoreSet;
      const t = TemperamentClassifier.analyzeParent(s);
      return {
        label: t.label,
        emoji: t.emoji,
        keywords: t.keywords,
        description: t.desc,
        image: t.image,
        scores: s,
      };
    }
  }

  return null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isCoParentInvitesEnabled()) {
    return NextResponse.json({ error: 'FEATURE_DISABLED' }, { status: 404 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'MISSING_CHILD_ID' }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = getSupabaseAdmin();

    // 1) 권한: owner 또는 ACCEPTED co-parent
    const { data: child } = await admin
      .from('children')
      .select('id, parent_id, name, owner_label')
      .eq('id', id)
      .maybeSingle();

    if (!child) {
      return NextResponse.json({ error: 'CHILD_NOT_FOUND' }, { status: 404 });
    }

    const isOwner = child.parent_id === user.id;
    let isCoParent = false;
    if (!isOwner) {
      const { data: ownMembership } = await admin
        .from('child_co_parents')
        .select('id')
        .eq('child_id', id)
        .eq('co_parent_id', user.id)
        .eq('status', 'ACCEPTED')
        .maybeSingle();
      isCoParent = Boolean(ownMembership);
    }

    if (!isOwner && !isCoParent) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    // 2) 양육자 목록 — owner + ACCEPTED co-parent들
    const { data: ownerProfile } = await admin
      .from('profiles')
      .select('full_name')
      .eq('id', child.parent_id)
      .maybeSingle();

    const { data: collaborators } = await admin
      .from('child_co_parents')
      .select(
        'co_parent_id, label, ' +
          'co_parent:profiles!child_co_parents_co_parent_id_fkey(full_name)'
      )
      .eq('child_id', id)
      .eq('status', 'ACCEPTED');

    const ownerLabelRaw = (child as { owner_label?: string | null }).owner_label ?? null;
    const ownerLabel = isCaregiverLabel(ownerLabelRaw) ? ownerLabelRaw : null;

    const caregivers: CaregiverPayload[] = [];

    // owner
    const ownerParentProfile = await loadParentProfile(admin, child.parent_id);
    caregivers.push({
      userId: child.parent_id,
      role: 'OWNER',
      label: ownerLabel,
      displayName: ownerProfile?.full_name ?? null,
      isCurrentUser: child.parent_id === user.id,
      parentProfile: ownerParentProfile,
    });

    // co-parents
    for (const row of collaborators ?? []) {
      const coUserId = (row as { co_parent_id?: string | null }).co_parent_id;
      if (!coUserId) continue;
      const cpLabelRaw = (row as { label?: string | null }).label ?? null;
      const cpProfileRaw = (row as {
        co_parent?: { full_name?: string | null } | { full_name?: string | null }[] | null;
      }).co_parent;
      const cpProfile = Array.isArray(cpProfileRaw) ? cpProfileRaw[0] : cpProfileRaw;

      const cpParentProfile = await loadParentProfile(admin, coUserId);
      caregivers.push({
        userId: coUserId,
        role: 'CO_PARENT',
        label: isCaregiverLabel(cpLabelRaw) ? cpLabelRaw : null,
        displayName: cpProfile?.full_name ?? null,
        isCurrentUser: coUserId === user.id,
        parentProfile: cpParentProfile,
      });
    }

    // 3) 두 양육자 모두 PARENT 프로필이 있으면 궁합 계산 (1:1 한정)
    let harmony: ReturnType<typeof analyzeParentParentHarmony> | null = null;
    const withProfile = caregivers.filter((c) => c.parentProfile != null);
    if (caregivers.length === 2 && withProfile.length === 2) {
      harmony = analyzeParentParentHarmony(
        withProfile[0].parentProfile!.scores,
        withProfile[1].parentProfile!.scores,
      );
    }

    return NextResponse.json({
      child: { id: child.id, name: child.name },
      caregivers,
      harmony,
    });
  } catch (error) {
    console.error('[Caregivers API] error:', error);
    return NextResponse.json({ error: 'CAREGIVERS_LOOKUP_FAILED' }, { status: 500 });
  }
}
