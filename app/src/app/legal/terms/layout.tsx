import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '이용약관',
  description: '기질아이 서비스 이용약관을 안내합니다.',
  alternates: { canonical: '/legal/terms' },
};

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
