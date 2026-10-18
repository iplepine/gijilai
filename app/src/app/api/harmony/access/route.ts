import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/iap';
import { getHarmonyAccess } from '@/lib/harmonyAccess';
import { isUuid } from '@/lib/harmonyUnlock';
import { createClient } from '@/lib/supabaseServer';

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const childId = new URL(req.url).searchParams.get('childId');
    if (!isUuid(childId)) {
      return NextResponse.json({ error: 'INVALID_CHILD_ID' }, { status: 400 });
    }

    const access = await getHarmonyAccess(getSupabaseAdmin(), { userId: session.user.id, childId });
    if (!access) {
      return NextResponse.json({ error: 'CHILD_NOT_FOUND' }, { status: 404 });
    }
    return NextResponse.json(access);
  } catch (error) {
    console.error('[Harmony Access API] Error:', error);
    return NextResponse.json({ error: 'HARMONY_ACCESS_FAILED' }, { status: 500 });
  }
}
