import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { isCoParentInvitesEnabled } from '@/lib/coParent';

function getSupabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET: 토큰 미리보기 (비로그인도 가능, 식별자 노출 X)
// 응답: 아이 이름, owner 호칭, owner 표시 이름, 상태, 만료 정보
export async function GET(
  _request: Request,
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
    const supabase = getSupabaseAdmin();

    type InvitePreviewRow = {
      id: string;
      child_id: string;
      invited_by: string;
      status: string;
      expires_at: string | null;
      accepted_at: string | null;
      child:
        | { id: string; name: string | null; owner_label: string | null }
        | { id: string; name: string | null; owner_label: string | null }[]
        | null;
      owner: { full_name: string | null } | { full_name: string | null }[] | null;
    };

    const { data, error } = await supabase
      .from('child_co_parents')
      .select(
        'id, child_id, invited_by, status, expires_at, accepted_at, ' +
          'child:children(id, name, owner_label), ' +
          'owner:profiles!child_co_parents_invited_by_fkey(full_name)'
      )
      .eq('invite_token', token)
      .maybeSingle();

    if (error) {
      console.error('[CoParent API] Invite preview error:', error);
      return NextResponse.json({ error: 'INVITE_LOOKUP_FAILED' }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: 'INVITE_NOT_FOUND' }, { status: 404 });
    }
    const invite = data as unknown as InvitePreviewRow;

    const now = Date.now();
    const expiresAtMs = invite.expires_at ? new Date(invite.expires_at).getTime() : 0;
    const isExpired = expiresAtMs > 0 && expiresAtMs < now;

    let effectiveStatus = invite.status;
    if (effectiveStatus === 'PENDING' && isExpired) effectiveStatus = 'EXPIRED';

    const childRaw = Array.isArray(invite.child) ? invite.child[0] : invite.child;
    const ownerRaw = Array.isArray(invite.owner) ? invite.owner[0] : invite.owner;

    return NextResponse.json({
      preview: {
        status: effectiveStatus,
        expiresAt: invite.expires_at,
        acceptedAt: invite.accepted_at,
        child: childRaw
          ? {
              name: childRaw.name ?? null,
              ownerLabel: childRaw.owner_label ?? null,
            }
          : null,
        ownerDisplayName: ownerRaw?.full_name ?? null,
      },
    });
  } catch (error) {
    console.error('[CoParent API] Invite preview error:', error);
    return NextResponse.json({ error: 'INVITE_LOOKUP_FAILED' }, { status: 500 });
  }
}
