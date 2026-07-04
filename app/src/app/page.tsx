import { createClient } from '@/lib/supabaseServer';
import HomeClient from './HomeClient';
import { UnauthedHome } from './UnauthedHome';

// 루트(`/`)는 서버에서 쿠키 세션을 보고 랜딩/앱을 가른다.
// - 세션 없음(크롤러·신규 방문자) → 랜딩을 SSR → 본문·<h1>이 초기 HTML에 담긴다(SEO).
// - 세션 있음 → 클라이언트 대시보드(HomeClient)가 자체 인증으로 이어받는다(랜딩 플래시 없음).
// getSession()은 쿠키만 읽는 렌더 힌트다(보안 경계가 아님 — 실제 데이터는 각 API가 재검증).
export default async function Home() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return <UnauthedHome />;
  }

  return <HomeClient />;
}
