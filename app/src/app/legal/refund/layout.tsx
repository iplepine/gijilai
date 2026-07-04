import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '환불 정책',
  description: '기질아이 구독 환불 정책을 안내합니다.',
  alternates: { canonical: '/legal/refund' },
};

export default function RefundLayout({ children }: { children: React.ReactNode }) {
  return children;
}
