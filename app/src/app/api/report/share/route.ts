import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabaseServer';
import { invalidJsonResponse, isInvalidJsonBodyError, isNonEmptyString, parseJsonBody } from '@/lib/api';
import { isSharedReportType } from '@/lib/shareReport';

function getSupabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * 공유 토큰 발급 (opt-in).
 * 리포트 소유자가 공유하기를 누른 시점에만 share_token을 만들고,
 * 공개 조회(/api/report/shared/[token])는 이 토큰으로만 가능하다.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { reportId } = await parseJsonBody<{ reportId?: string }>(request);
    if (!isNonEmptyString(reportId)) {
      return NextResponse.json({ error: 'Missing report id' }, { status: 400 });
    }

    // 소유권 확인 — 본인 리포트만 공유 토큰 발급 가능
    const { data: report, error: reportError } = await supabase
      .from('reports')
      .select('id, type')
      .eq('id', reportId)
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (reportError) {
      console.error('[Report Share] Ownership lookup error:', reportError);
      return NextResponse.json({ error: 'Failed to load report' }, { status: 500 });
    }
    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }
    if (!isSharedReportType(report.type)) {
      return NextResponse.json({ error: 'This report type cannot be shared' }, { status: 403 });
    }

    const admin = getSupabaseAdmin();

    // 이미 발급된 토큰이 있으면 재사용
    const { data: existing } = await admin
      .from('reports')
      .select('share_token')
      .eq('id', reportId)
      .maybeSingle<{ share_token: string | null }>();

    if (existing?.share_token) {
      return NextResponse.json({ shareToken: existing.share_token });
    }

    // 토큰 발급 — 동시 요청은 share_token IS NULL 조건으로 한쪽만 성공
    const token = randomUUID();
    const { data: updated, error: updateError } = await admin
      .from('reports')
      .update({ share_token: token })
      .eq('id', reportId)
      .is('share_token', null)
      .select('share_token')
      .maybeSingle<{ share_token: string | null }>();

    if (updateError) {
      console.error('[Report Share] Token mint error:', updateError);
      return NextResponse.json({ error: 'Failed to create share link' }, { status: 500 });
    }

    if (updated?.share_token) {
      return NextResponse.json({ shareToken: updated.share_token });
    }

    // 동시 요청이 먼저 발급한 경우 — 다시 조회
    const { data: raced } = await admin
      .from('reports')
      .select('share_token')
      .eq('id', reportId)
      .maybeSingle<{ share_token: string | null }>();

    if (raced?.share_token) {
      return NextResponse.json({ shareToken: raced.share_token });
    }

    return NextResponse.json({ error: 'Failed to create share link' }, { status: 500 });
  } catch (error) {
    if (isInvalidJsonBodyError(error)) {
      return invalidJsonResponse();
    }

    console.error('[Report Share] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
