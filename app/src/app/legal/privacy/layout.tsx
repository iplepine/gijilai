import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '개인정보처리방침',
  description:
    '기질아이 개인정보처리방침 — 수집 항목, 이용 목적, 보관 기간, 아동 정보 보호 원칙을 안내합니다.',
  alternates: { canonical: '/legal/privacy' },
};

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
