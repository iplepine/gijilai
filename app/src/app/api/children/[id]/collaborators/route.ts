import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { isCoParentInvitesEnabled } from '@/lib/coParent';
import { createClient } from '@/lib/supabaseServer';

function getSupabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

type CollaboratorRow = {
  id: string;
  child_id: string;
  invited_by: string;
  co_parent_id: string | null;
  status: string;
  invited_at: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  label: string | null;
  invite_token: string;
  child?: { name?: string | null; parent_id?: string | null } | { name?: string | null; parent_id?: string | null }[] | null;
  co_parent?: { full_name?: string | null } | { full_name?: string | null }[] | null;
};

// GET: 해당 아이의 협력자(PENDING + ACCEPTED) 정보
// owner 또는 co-parent 본인만 조회 가능
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

    // 권한 확인: owner 또는 ACCEPTED co_parent
    const { data: child } = await admin
      .from('children')
      .select('id, parent_id, owner_label')
      .eq('id', id)
      .maybeSingle();

    if (!child) {
      return NextResponse.json({ error: 'CHILD_NOT_FOUND' }, { status: 404 });
    }

    const isOwner = child.parent_id === user.id;
    const { data: ownMembership } = await admin
      .from('child_co_parents')
      .select('id')
      .eq('child_id', id)
      .eq('co_parent_id', user.id)
      .eq('status', 'ACCEPTED')
      .maybeSingle();
    const isCoParent = Boolean(ownMembership);

    if (!isOwner && !isCoParent) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    const { data: rows, error } = await admin
      .from('child_co_parents')
      .select(
        'id, child_id, invited_by, co_parent_id, status, invited_at, expires_at, accepted_at, revoked_at, label, ' +
          'co_parent:profiles!child_co_parents_co_parent_id_fkey(full_name)'
      )
      .eq('child_id', id)
      .in('status', ['PENDING', 'ACCEPTED'])
      .order('invited_at', { ascending: false });

    if (error) {
      console.error('[CoParent API] Collaborators lookup error:', error);
      return NextResponse.json({ error: 'COLLABORATORS_LOOKUP_FAILED' }, { status: 500 });
    }

    const collaborators = (rows ?? []).map((row) => {
      const r = row as unknown as CollaboratorRow;
      const cpRaw = Array.isArray(r.co_parent) ? r.co_parent[0] : r.co_parent;
      return {
        id: r.id,
        status: r.status,
        label: r.label,
        invitedAt: r.invited_at,
        expiresAt: r.expires_at,
        acceptedAt: r.accepted_at,
        coParentDisplayName: cpRaw ? (cpRaw as { full_name?: string | null }).full_name ?? null : null,
        isCurrentUser: r.co_parent_id === user.id,
      };
    });

    return NextResponse.json({
      role: isOwner ? 'OWNER' : 'CO_PARENT',
      child: {
        id: child.id,
        ownerLabel: child.owner_label ?? null,
      },
      collaborators,
    });
  } catch (error) {
    console.error('[CoParent API] Collaborators GET error:', error);
    return NextResponse.json({ error: 'COLLABORATORS_LOOKUP_FAILED' }, { status: 500 });
  }
}

// DELETE: 협력자 연결 해제
// - owner는 협력자(또는 PENDING 초대)를 해제할 수 있다.
// - co-parent 본인은 본인 연결을 해제할 수 있다.
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isCoParentInvitesEnabled()) {
    return NextResponse.json({ error: 'FEATURE_DISABLED' }, { status: 404 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'MISSING_CHILD_ID' }, { status: 400 });
  }

  const url = new URL(request.url);
  const targetMembershipId = url.searchParams.get('membershipId');

  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    const { data: child } = await admin
      .from('children')
      .select('id, parent_id')
      .eq('id', id)
      .maybeSingle();

    if (!child) {
      return NextResponse.json({ error: 'CHILD_NOT_FOUND' }, { status: 404 });
    }

    const isOwner = child.parent_id === user.id;

    // 대상 row 결정
    let query = admin
      .from('child_co_parents')
      .select('id, co_parent_id, invited_by, status')
      .eq('child_id', id);

    if (targetMembershipId) {
      query = query.eq('id', targetMembershipId);
    } else if (!isOwner) {
      // co-parent 본인 연결 해제 시: ACCEPTED 본인 행
      query = query.eq('co_parent_id', user.id).eq('status', 'ACCEPTED');
    } else {
      // owner가 membershipId 미지정 시: 가장 최근 PENDING 또는 ACCEPTED 1개
      query = query.in('status', ['PENDING', 'ACCEPTED']).order('invited_at', { ascending: false });
    }

    const { data: rows, error: lookupError } = await query;
    if (lookupError) {
      console.error('[CoParent API] Collaborator lookup error:', lookupError);
      return NextResponse.json({ error: 'COLLABORATOR_LOOKUP_FAILED' }, { status: 500 });
    }
    const target = rows && rows.length > 0 ? rows[0] : null;
    if (!target) {
      return NextResponse.json({ error: 'COLLABORATOR_NOT_FOUND' }, { status: 404 });
    }

    // 권한 확인
    const canRevoke =
      isOwner || (target.co_parent_id === user.id && target.status === 'ACCEPTED');
    if (!canRevoke) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    const now = new Date().toISOString();
    const { error: updateError } = await admin
      .from('child_co_parents')
      .update({ status: 'REVOKED', revoked_at: now })
      .eq('id', target.id);

    if (updateError) {
      console.error('[CoParent API] Collaborator revoke error:', updateError);
      return NextResponse.json({ error: 'COLLABORATOR_REVOKE_FAILED' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, by: isOwner ? 'OWNER' : 'CO_PARENT' });
  } catch (error) {
    console.error('[CoParent API] Collaborator DELETE error:', error);
    return NextResponse.json({ error: 'COLLABORATOR_REVOKE_FAILED' }, { status: 500 });
  }
}
