import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import { formatCaregiverLabel, isCaregiverLabel } from '@/lib/coParent';

type Params = { token: string };

// Kakao 스크랩 카드는 응답 HTML의 OG 메타를 읽어서 만들기 때문에,
// 공유 받는 사람의 메시지 미리보기가 초대별로 보이도록 server-side로 메타를 채운다.
export async function generateMetadata(
  { params }: { params: Promise<Params> },
): Promise<Metadata> {
  const fallbackTitle = '함께 보는 분 초대 — 기질아이';
  const fallbackDescription = '아이의 기질 리포트, 상담, 실천 기록을 함께 봐요. 한 명이 잊어도 옆에 있는 분이 끌어와요.';
  const fallbackImage = 'https://gijilai.com/gijilai_icon_kakao.png';

  const fallback: Metadata = {
    title: fallbackTitle,
    description: fallbackDescription,
    openGraph: {
      title: fallbackTitle,
      description: fallbackDescription,
      type: 'article',
      images: [{ url: fallbackImage }],
    },
    twitter: {
      card: 'summary',
      title: fallbackTitle,
      description: fallbackDescription,
    },
  };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return fallback;

  try {
    const { token } = await params;
    if (!token) return fallback;

    const supabase = createClient(supabaseUrl, serviceKey);
    const { data: invite } = await supabase
      .from('child_co_parents')
      .select(
        'status, expires_at, ' +
          'child:children(name, owner_label), ' +
          'owner:profiles!child_co_parents_invited_by_fkey(full_name)'
      )
      .eq('invite_token', token)
      .maybeSingle();

    if (!invite) return fallback;

    const status = (invite as { status?: string }).status ?? 'PENDING';
    const expiresAtRaw = (invite as { expires_at?: string | null }).expires_at;
    const isExpired = expiresAtRaw ? new Date(expiresAtRaw).getTime() < Date.now() : false;

    if (status !== 'PENDING' || isExpired) {
      const expiredTitle = '함께 보는 분 초대가 만료됐어요';
      const expiredDesc = '초대한 분에게 새 링크를 받아주세요.';
      return {
        title: expiredTitle,
        description: expiredDesc,
        openGraph: {
          title: expiredTitle,
          description: expiredDesc,
          type: 'article',
          images: [{ url: fallbackImage }],
        },
      };
    }

    const childRaw = (invite as {
      child?: { name?: string | null; owner_label?: string | null }
        | { name?: string | null; owner_label?: string | null }[]
        | null;
    }).child;
    const child = Array.isArray(childRaw) ? childRaw[0] : childRaw;
    const childName = child?.name?.trim() || '우리 아이';

    const ownerLabelRaw = child?.owner_label ?? null;
    const ownerLabel = isCaregiverLabel(ownerLabelRaw) ? ownerLabelRaw : null;
    const ownerCaption = ownerLabel ? formatCaregiverLabel(ownerLabel) : '함께 사용하는 분';

    const title = `${childName}의 양육을 ${ownerCaption}와 함께 봐요`;
    const description = `${ownerCaption}이(가) ${childName}의 기질 리포트·상담·실천 기록을 함께 보자고 초대했어요. 7일 안에 수락해주세요.`;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: 'article',
        images: [{ url: fallbackImage }],
      },
      twitter: {
        card: 'summary',
        title,
        description,
      },
    };
  } catch {
    return fallback;
  }
}

export default function InviteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
