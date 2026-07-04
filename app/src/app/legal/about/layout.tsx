import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '서비스 소개',
  description: '기질아이 서비스 소개와 운영 정보를 안내합니다.',
  alternates: { canonical: '/legal/about' },
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
