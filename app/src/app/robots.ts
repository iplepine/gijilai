import type { MetadataRoute } from 'next';

const SITE_URL = 'https://gijilai.com';

// 공개 색인 대상은 랜딩·가격·설치 안내·법적 고지뿐이다.
// 로그인 게이트 뒤의 앱 화면과 API는 크롤링에서 제외한다.
// /shared·/invite는 카카오 등 SNS 링크 미리보기(OG 스크랩)를 위해 막지 않는다(sitemap에는 미포함).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/auth/',
          '/settings/',
          '/survey',
          '/consult',
          '/consultations',
          '/practices',
          '/report',
          '/observations',
          '/intake',
          '/translate',
          '/payment/',
          '/pricing/complete',
          '/test/',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
