import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '고객지원',
  description: '기질아이 고객지원·문의 안내입니다.',
  alternates: { canonical: '/legal/support' },
};

export default function SupportLayout({ children }: { children: React.ReactNode }) {
  return children;
}
