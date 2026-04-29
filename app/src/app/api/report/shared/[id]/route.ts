import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

type SharedReportRow = {
  id: string;
  type: string;
  content: string | null;
  analysis_json: unknown;
  created_at: string;
  children: Array<{
    name: string;
    gender: string;
    birth_date: string;
  }>;
  surveys: Array<{
    scores: unknown;
  }>;
};

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
      .single();

    if (error) {
      console.error('Shared report query error:', error);
      return NextResponse.json({ error: 'Failed to load report' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    const report = data as unknown as SharedReportRow;

    if (report.type !== 'CHILD') {
      return NextResponse.json({ error: 'This report type cannot be shared' }, { status: 403 });
    }

    return NextResponse.json({
      id: report.id,
      type: report.type,
      analysis: report.analysis_json,
      createdAt: report.created_at,
      child: report.children[0] ?? null,
      scores: report.surveys[0]?.scores ?? null,
    });
  } catch (e) {
    console.error('Failed to load shared report:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
