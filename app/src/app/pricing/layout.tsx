import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '요금 안내',
  description:
    '기질아이 구독 요금 안내 — 7일 무료 체험 후 월 구독으로 AI 육아상담, 실천 기록, 다음 상담 맥락 누적까지 이어가세요.',
  alternates: { canonical: '/pricing' },
  openGraph: {
    title: '기질아이 요금 안내',
    description: '7일 무료 체험 후 월 구독. 상담 → 실천 → 기록 → 다음 상담의 지속관리 루프.',
    url: 'https://gijilai.com/pricing',
  },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
