import type { MetadataRoute } from 'next';

const SITE_URL = 'https://gijilai.com';

// 공개(비인증) 페이지만 등록한다. 앱 화면·공유 토큰 URL은 제외.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const entries: Array<{
    path: string;
    changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'];
    priority: number;
  }> = [
    { path: '/', changeFrequency: 'weekly', priority: 1 },
    { path: '/pricing', changeFrequency: 'monthly', priority: 0.8 },
    { path: '/install-app', changeFrequency: 'monthly', priority: 0.6 },
    { path: '/login', changeFrequency: 'yearly', priority: 0.4 },
    { path: '/legal/about', changeFrequency: 'yearly', priority: 0.3 },
    { path: '/legal/privacy', changeFrequency: 'yearly', priority: 0.3 },
    { path: '/legal/terms', changeFrequency: 'yearly', priority: 0.3 },
    { path: '/legal/refund', changeFrequency: 'yearly', priority: 0.3 },
    { path: '/legal/support', changeFrequency: 'yearly', priority: 0.3 },
  ];

  return entries.map(({ path, changeFrequency, priority }) => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  }));
}
