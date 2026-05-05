import { NextResponse } from 'next/server';
import {
  LAST_FREE_CHILD_DELETE_BLOCKED_CODE,
  getServerChildProfileAccess,
} from '@/lib/access';
import { createClient } from '@/lib/supabaseServer';

export async function DELETE(
  _request: Request,
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

    const { data: child, error: childError } = await supabase
      .from('children')
      .select('id')
      .eq('id', id)
      .eq('parent_id', user.id)
      .maybeSingle();

    if (childError) {
      console.error('[Children API] Child lookup error:', childError);
      return NextResponse.json({ error: 'CHILD_LOOKUP_FAILED' }, { status: 500 });
    }

    if (!child) {
      return NextResponse.json({ error: 'CHILD_NOT_FOUND' }, { status: 404 });
    }

    const access = await getServerChildProfileAccess(supabase, {
      userId: user.id,
      userCreatedAt: user.created_at,
    });

    if (!access.canDeleteChild) {
      return NextResponse.json(
        {
          code: LAST_FREE_CHILD_DELETE_BLOCKED_CODE,
          error: LAST_FREE_CHILD_DELETE_BLOCKED_CODE,
        },
        { status: 403 }
      );
    }

    const { error } = await supabase
      .from('children')
      .delete()
      .eq('id', id)
      .eq('parent_id', user.id);

    if (error) {
      console.error('[Children API] Child delete error:', error);
      if (error.message?.includes(LAST_FREE_CHILD_DELETE_BLOCKED_CODE)) {
        return NextResponse.json(
          {
            code: LAST_FREE_CHILD_DELETE_BLOCKED_CODE,
            error: LAST_FREE_CHILD_DELETE_BLOCKED_CODE,
          },
          { status: 403 }
        );
      }
      return NextResponse.json({ error: 'CHILD_DELETE_FAILED' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[Children API] Delete error:', error);
    return NextResponse.json({ error: 'CHILD_DELETE_FAILED' }, { status: 500 });
  }
}
