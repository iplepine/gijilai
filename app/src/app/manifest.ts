import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '기질아이 — 아이 기질검사·맞춤 육아상담',
    short_name: '기질아이',
    description:
      '3분 아이 기질검사로 떼쓰기·예민함·등원거부의 이유를 보고, 오늘 바로 쓸 맞춤 대화법과 육아상담을 받아보세요.',
    start_url: '/',
    display: 'standalone',
    background_color: '#F9F8F6',
    theme_color: '#F9F8F6',
    lang: 'ko',
    dir: 'ltr',
    categories: ['parenting', 'lifestyle', 'education'],
    icons: [
      {
        src: '/gijilai_icon_kakao.png',
        sizes: '256x256',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/gijilai_icon.png',
        sizes: '1024x1024',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}
