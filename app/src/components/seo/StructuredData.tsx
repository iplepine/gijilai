const SITE_URL = 'https://gijilai.com';

// schema.org 구조화 데이터 (JSON-LD). Google 리치 결과·지식 패널 신호.
// 허위 신호 금지: aggregateRating·review처럼 실측 없는 값은 넣지 않는다.
const STRUCTURED_DATA = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: '기질아이',
      alternateName: 'GIJILAI',
      url: SITE_URL,
      logo: `${SITE_URL}/gijilai_icon.png`,
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: SITE_URL,
      name: '기질아이',
      description:
        '아이 기질검사와 AI 육아상담으로 떼쓰기·예민함·등원거부의 이유를 이해하고 맞춤 대화법을 찾는 지속관리형 육아 코치.',
      publisher: { '@id': `${SITE_URL}/#organization` },
      inLanguage: 'ko-KR',
    },
    {
      '@type': 'WebApplication',
      '@id': `${SITE_URL}/#webapp`,
      name: '기질아이',
      url: SITE_URL,
      applicationCategory: 'LifestyleApplication',
      operatingSystem: 'Web, iOS, Android',
      description:
        '3~7세 아이의 기질(CBQ·ATQ)을 분석해 행동의 이유를 생활 언어로 해석하고, AI 상담·실천 기록으로 오늘의 양육 행동까지 이어주는 육아 코치.',
      inLanguage: 'ko-KR',
      publisher: { '@id': `${SITE_URL}/#organization` },
      offers: {
        '@type': 'Offer',
        price: '12000',
        priceCurrency: 'KRW',
        category: 'subscription',
        description: '월 구독 (7일 무료 체험 포함)',
      },
    },
  ],
};

export function StructuredData() {
  return (
    <script
      type="application/ld+json"
      // JSON.stringify 결과라 사용자 입력이 없고 XSS 위험이 없다.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
    />
  );
}
