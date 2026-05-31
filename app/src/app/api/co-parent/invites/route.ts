import { NextResponse } from 'next/server';
import {
  invalidJsonResponse,
  isInvalidJsonBodyError,
  isNonEmptyString,
  parseJsonBody,
} from '@/lib/api';
import {
  buildInviteLink,
  generateInviteToken,
  isCoParentInvitesEnabled,
} from '@/lib/coParent';
import { createClient } from '@/lib/supabaseServer';

type CreateInviteRequest = {
  childId?: unknown;
};

function originFromRequest(request: Request): string {
  const headerOrigin = request.headers.get('origin');
  if (headerOrigin) return headerOrigin;
  const host = request.headers.get('host');
  if (host) {
    const proto = request.headers.get('x-forwarded-proto') ?? 'https';
    return `${proto}://${host}`;
  }
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? '';
}

// owner가 공동양육자 초대 토큰을 발급한다.
// 한 아이당 PENDING 초대는 1개만 허용 — 기존 PENDING은 REVOKED 처리.
export async function POST(request: Request) {
  if (!isCoParentInvitesEnabled()) {
    return NextResponse.json({ error: 'FEATURE_DISABLED' }, { status: 404 });
  }

  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await parseJsonBody<CreateInviteRequest>(request);
    if (!isNonEmptyString(body.childId)) {
      return NextResponse.json({ error: 'MISSING_CHILD_ID' }, { status: 400 });
    }
    const childId = body.childId.trim();

    // 1. owner 확인
    const { data: child, error: childError } = await supabase
      .from('children')
      .select('id, parent_id, name')
      .eq('id', childId)
      .eq('parent_id', user.id)
      .maybeSingle();

    if (childError) {
      console.error('[CoParent API] Child lookup error:', childError);
      return NextResponse.json(
        { error: 'CHILD_LOOKUP_FAILED', detail: childError.message, code: childError.code },
        { status: 500 }
      );
    }
    if (!child) {
      return NextResponse.json({ error: 'CHILD_NOT_FOUND_OR_NOT_OWNER' }, { status: 404 });
    }

    // 2. 이미 ACCEPTED 협력자가 있으면 409
    const { data: accepted, error: acceptedError } = await supabase
      .from('child_co_parents')
      .select('id')
      .eq('child_id', childId)
      .eq('status', 'ACCEPTED')
      .maybeSingle();

    if (acceptedError) {
      console.error('[CoParent API] Accepted lookup error:', acceptedError);
      return NextResponse.json(
        { error: 'INVITE_LOOKUP_FAILED', detail: acceptedError.message, code: acceptedError.code },
        { status: 500 }
      );
    }
    if (accepted) {
      return NextResponse.json({ error: 'CO_PARENT_ALREADY_LINKED' }, { status: 409 });
    }

    // 3. 기존 PENDING은 REVOKED 처리
    const now = new Date().toISOString();
    const { error: revokeError } = await supabase
      .from('child_co_parents')
      .update({ status: 'REVOKED', revoked_at: now })
      .eq('child_id', childId)
      .eq('status', 'PENDING');

    if (revokeError) {
      console.error('[CoParent API] Pending revoke error:', revokeError);
      return NextResponse.json(
        { error: 'INVITE_REVOKE_FAILED', detail: revokeError.message, code: revokeError.code },
        { status: 500 }
      );
    }

    // 4. 새 PENDING 발급
    const token = generateInviteToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: invite, error: insertError } = await supabase
      .from('child_co_parents')
      .insert({
        child_id: childId,
        invited_by: user.id,
        invite_token: token,
        status: 'PENDING',
        expires_at: expiresAt,
      })
      .select('id, invite_token, expires_at, status')
      .single();

    if (insertError || !invite) {
      console.error('[CoParent API] Invite insert error:', insertError);
      return NextResponse.json(
        {
          error: 'INVITE_CREATE_FAILED',
          detail: insertError?.message ?? 'no row returned',
          code: insertError?.code,
        },
        { status: 500 }
      );
    }

    const link = buildInviteLink(invite.invite_token, originFromRequest(request));

    return NextResponse.json({
      invite: {
        id: invite.id,
        token: invite.invite_token,
        link,
        expiresAt: invite.expires_at,
        status: invite.status,
        childName: child.name,
      },
    });
  } catch (error) {
    if (isInvalidJsonBodyError(error)) return invalidJsonResponse();
    console.error('[CoParent API] Create invite error:', error);
    return NextResponse.json({ error: 'INVITE_CREATE_FAILED' }, { status: 500 });
  }
}
