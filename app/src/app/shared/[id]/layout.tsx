import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import {
  buildSharedReportSummary,
  isSharedReportType,
  parseSharedAnalysis,
} from '@/lib/shareReport';

type Params = { id: string };

// Kakao 스크랩 카드는 응답 HTML의 OG 메타를 읽어서 만들기 때문에,
// 공유 받는 사람의 메시지 미리보기가 리포트별로 보이도록 server-side로 메타를 채운다.
export async function generateMetadata(
  { params }: { params: Promise<Params> },
): Promise<Metadata> {
  const fallback: Metadata = {
    title: '기질아이 리포트',
    description: '기질아이로 받은 아이 기질 리포트를 확인해 보세요.',
    openGraph: {
      title: '기질아이 리포트',
      description: '기질아이로 받은 아이 기질 리포트를 확인해 보세요.',
      type: 'article',
    },
  };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return fallback;

  try {
    const { id } = await params;
    const supabase = createClient(supabaseUrl, serviceKey);
    // 경로 파라미터는 opt-in 발급된 share_token이다 (리포트 PK 아님).
    const { data } = await supabase
      .from('reports')
      .select(
        'id, type, analysis_json, children(name, gender), surveys(scores)',
      )
      .eq('share_token', id)
      .maybeSingle();

    if (!data || !isSharedReportType(data.type)) return fallback;

    const child = Array.isArray(data.children) ? data.children[0] : data.children;
    const survey = Array.isArray(data.surveys) ? data.surveys[0] : data.surveys;
    const analysis = parseSharedAnalysis(data.analysis_json);
    const childName = child?.name || '우리 아이';

    const summary = buildSharedReportSummary({
      type: data.type,
      analysis,
      scores: survey?.scores ?? null,
      childName,
      locale: 'ko',
      t: (key, values) => {
        if (!values) return key;
        let out = key;
        for (const [k, v] of Object.entries(values)) {
          out = out.replace(`{${k}}`, String(v));
        }
        return out;
      },
    });

    const title = `${summary.headline} "${summary.label}"`;
    const description = summary.description || '기질아이로 받은 아이 기질 리포트를 확인해 보세요.';
    const imageUrl = summary.image
      ? `https://gijilai.com${summary.image}`
      : 'https://gijilai.com/gijilai_icon_kakao.png';

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: 'article',
        images: [{ url: imageUrl }],
      },
    };
  } catch {
    return fallback;
  }
}

export default function SharedReportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
