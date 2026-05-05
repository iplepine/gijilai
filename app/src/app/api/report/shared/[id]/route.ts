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

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: 'Missing report id' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('reports')
      .select('id, type, content, analysis_json, created_at, children(name, gender, birth_date), surveys(scores)')
      .eq('id', id)
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

    return NextResponse.json({
      id: report.id,
      type: report.type,
      analysis: report.analysis_json,
      createdAt: report.created_at,
      child: getRelationItem(report.children),
      scores: getRelationItem(report.surveys)?.scores ?? null,
    });
  } catch (e) {
    console.error('Failed to load shared report:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
