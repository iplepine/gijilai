import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isSharedReportType } from '@/lib/shareReport';

type SharedReportRow = {
  id: string;
  type: string;
  content: string | null;
  analysis_json: unknown;
  created_at: string;
  children: Relation<{
    name: string;
    gender: string;
    birth_date: string;
  }>;
  surveys: Relation<{
    scores: unknown;
  }>;
};

type Relation<T> = T | T[] | null;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getRelationItem<T>(value: Relation<T>): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// 공개 응답에는 생년월일 원본 대신 나이 표기만 내려준다.
function toAgeText(birthDate: string | null | undefined): string | null {
  if (!birthDate) return null;
  const [year, month, day] = birthDate.split('-').map(Number);
  if (!year || !month || !day) return null;

  const now = new Date();
  let months = (now.getFullYear() - year) * 12 + (now.getMonth() - (month - 1));
  if (now.getDate() < day) months -= 1;
  months = Math.max(0, months);

  const years = Math.floor(months / 12);
  return years > 0 ? `${years}세` : `${months}개월`;
}

/**
 * 공유 리포트 공개 조회 — 경로 파라미터는 reports.share_token (opt-in 발급).
 * 리포트 PK(id)로는 더 이상 조회할 수 없다: 공유한 적 없는 리포트가
 * id 노출만으로 공개되는 것을 막기 위함. 토큰 발급은 /api/report/share.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: shareToken } = await params;

  if (!shareToken || !UUID_PATTERN.test(shareToken)) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 });
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('reports')
      .select('id, type, content, analysis_json, created_at, children(name, gender, birth_date), surveys(scores)')
      .eq('share_token', shareToken)
      .maybeSingle();

    if (error) {
      console.error('Shared report query error:', error);
      return NextResponse.json({ error: 'Failed to load report' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    const report = data as unknown as SharedReportRow;

    if (!isSharedReportType(report.type)) {
      return NextResponse.json({ error: 'This report type cannot be shared' }, { status: 403 });
    }

    const child = getRelationItem(report.children);

    return NextResponse.json({
      id: report.id,
      type: report.type,
      analysis: report.analysis_json,
      createdAt: report.created_at,
      child: child
        ? { name: child.name, gender: child.gender, ageText: toAgeText(child.birth_date) }
        : null,
      scores: getRelationItem(report.surveys)?.scores ?? null,
    });
  } catch (e) {
    console.error('Failed to load shared report:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
