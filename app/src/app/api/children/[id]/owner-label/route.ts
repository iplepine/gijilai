import { NextResponse } from 'next/server';
import {
  invalidJsonResponse,
  isInvalidJsonBodyError,
  parseJsonBody,
} from '@/lib/api';
import { isCaregiverLabel } from '@/lib/coParent';
import { createClient } from '@/lib/supabaseServer';

type Request_ = {
  label?: unknown;
};

// PATCH /api/children/[id]/owner-label
// owner만 본인 호칭을 갱신할 수 있다.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const body = await parseJsonBody<Request_>(request);
    if (!isCaregiverLabel(body.label)) {
      return NextResponse.json({ error: 'INVALID_LABEL' }, { status: 400 });
    }

    // owner 확인
    const { data: child, error: childError } = await supabase
      .from('children')
      .select('id, parent_id')
      .eq('id', id)
      .maybeSingle();

    if (childError) {
      console.error('[OwnerLabel API] Child lookup error:', childError);
      return NextResponse.json(
        { error: 'CHILD_LOOKUP_FAILED', detail: childError.message },
        { status: 500 }
      );
    }
    if (!child) {
      return NextResponse.json({ error: 'CHILD_NOT_FOUND' }, { status: 404 });
    }
    if (child.parent_id !== user.id) {
      return NextResponse.json({ error: 'NOT_OWNER' }, { status: 403 });
    }

    const { error: updateError } = await supabase
      .from('children')
      .update({ owner_label: body.label })
      .eq('id', id);

    if (updateError) {
      console.error('[OwnerLabel API] Update error:', updateError);
      return NextResponse.json(
        {
          error: 'OWNER_LABEL_UPDATE_FAILED',
          detail: updateError.message,
          code: updateError.code,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, label: body.label });
  } catch (error) {
    if (isInvalidJsonBodyError(error)) return invalidJsonResponse();
    console.error('[OwnerLabel API] Unexpected error:', error);
    return NextResponse.json({ error: 'OWNER_LABEL_UPDATE_FAILED' }, { status: 500 });
  }
}
