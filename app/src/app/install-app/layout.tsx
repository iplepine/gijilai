import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '앱 설치 안내',
  description:
    '기질아이 앱 설치 안내 — iOS·Android 앱으로 아이 기질검사, AI 육아상담, 실천 알림을 더 편하게 이용하세요.',
  alternates: { canonical: '/install-app' },
  openGraph: {
    title: '기질아이 앱 설치',
    description: 'iOS·Android 앱으로 아이 기질검사와 육아상담을 이어가세요.',
    url: 'https://gijilai.com/install-app',
  },
};

export default function InstallAppLayout({ children }: { children: React.ReactNode }) {
  return children;
}
