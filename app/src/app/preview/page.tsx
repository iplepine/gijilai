import type { Metadata } from 'next';
import { getPreviewScenario } from '@/lib/preview';
import ParentingPreview from '@/components/landing/ParentingPreview';

export const metadata: Metadata = {
  title: '가입 없이 보는 상황별 육아 대화 예시',
  description: '놀이 마무리, 등원 인사, 원하는 것을 못 가질 때. 상황별 대화와 작은 실천 예시를 가입 없이 확인하고 무료 아이 기질검사로 이어가세요.',
  alternates: { canonical: '/preview' },
  openGraph: {
    title: '오늘 아이에게 건넬 한마디 | 기질아이',
    description: '가입 없이 상황별 대화 예시를 보고, 우리 아이를 위한 기질검사를 시작해보세요.',
    url: 'https://gijilai.com/preview',
  },
};

export default async function PreviewPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return <ParentingPreview scenario={getPreviewScenario(params.scenario)} />;
}
