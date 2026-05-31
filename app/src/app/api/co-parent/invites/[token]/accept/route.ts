import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import {
  invalidJsonResponse,
  isInvalidJsonBodyError,
  parseJsonBody,
} from '@/lib/api';
import { isCaregiverLabel, isCoParentInvitesEnabled } from '@/lib/coParent';
import { createClient } from '@/lib/supabaseServer';

type AcceptRequest = {
  label?: unknown;
  consentAccepted?: unknown;
};

function getSupabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  if (!isCoParentInvitesEnabled()) {
    return NextResponse.json({ error: 'FEATURE_DISABLED' }, { status: 404 });
  }

  const { token } = await params;
  if (!token) {
    return NextResponse.json({ error: 'MISSING_TOKEN' }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await parseJsonBody<AcceptRequest>(request);
    if (!isCaregiverLabel(body.label)) {
      return NextResponse.json({ error: 'INVALID_LABEL' }, { status: 400 });
    }
    if (body.consentAccepted !== true) {
      return NextResponse.json({ error: 'CONSENT_REQUIRED' }, { status: 400 });
    }
    const label = body.label;

    // 토큰 조회는 admin client로 (RLS는 owner에게만 select 허용)
    const admin = getSupabaseAdmin();
    const { data: invite, error: lookupError } = await admin
      .from('child_co_parents')
      .select('id, child_id, invited_by, status, expires_at')
      .eq('invite_token', token)
      .maybeSingle();

    if (lookupError) {
      console.error('[CoParent API] Accept lookup error:', lookupError);
      return NextResponse.json({ error: 'INVITE_LOOKUP_FAILED' }, { status: 500 });
    }
    if (!invite) {
      return NextResponse.json({ error: 'INVITE_NOT_FOUND' }, { status: 404 });
    }

    // 본인 초대 수락 금지 (owner 본인은 이미 owner)
    if (invite.invited_by === user.id) {
      return NextResponse.json({ error: 'CANNOT_ACCEPT_OWN_INVITE' }, { status: 400 });
    }

    if (invite.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'INVITE_NOT_PENDING', status: invite.status },
        { status: 409 }
      );
    }

    const expiresAtMs = invite.expires_at ? new Date(invite.expires_at).getTime() : 0;
    if (expiresAtMs > 0 && expiresAtMs < Date.now()) {
      // 만료 처리도 admin으로
      await admin
        .from('child_co_parents')
        .update({ status: 'EXPIRED' })
        .eq('id', invite.id);
      return NextResponse.json({ error: 'INVITE_EXPIRED' }, { status: 410 });
    }

    // 이미 다른 협력자가 ACCEPTED인지 한 번 더 확인
    const { data: existingAccepted } = await admin
      .from('child_co_parents')
      .select('id')
      .eq('child_id', invite.child_id)
      .eq('status', 'ACCEPTED')
      .maybeSingle();

    if (existingAccepted) {
      return NextResponse.json({ error: 'CO_PARENT_ALREADY_LINKED' }, { status: 409 });
    }

    // 본인이 owner인 아이를 다시 협력자로 받는 경우 차단
    const { data: child } = await admin
      .from('children')
      .select('parent_id')
      .eq('id', invite.child_id)
      .maybeSingle();

    if (child && child.parent_id === user.id) {
      return NextResponse.json({ error: 'OWNER_CANNOT_BE_CO_PARENT' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const { data: updated, error: updateError } = await admin
      .from('child_co_parents')
      .update({
        co_parent_id: user.id,
        label,
        status: 'ACCEPTED',
        accepted_at: now,
      })
      .eq('id', invite.id)
      .eq('status', 'PENDING')
      .select('id, child_id, accepted_at, label')
      .maybeSingle();

    if (updateError || !updated) {
      console.error('[CoParent API] Accept update error:', updateError);
      return NextResponse.json({ error: 'INVITE_ACCEPT_FAILED' }, { status: 500 });
    }

    return NextResponse.json({
      membership: {
        id: updated.id,
        childId: updated.child_id,
        acceptedAt: updated.accepted_at,
        label: updated.label,
      },
    });
  } catch (error) {
    if (isInvalidJsonBodyError(error)) return invalidJsonResponse();
    console.error('[CoParent API] Accept error:', error);
    return NextResponse.json({ error: 'INVITE_ACCEPT_FAILED' }, { status: 500 });
  }
}
