// 라우트 핸들러 테스트가 모듈 import 시점에 supabase 클라이언트 초기화로 죽지 않도록
// 더미 환경변수를 먼저 채운다. 실제 네트워크 호출은 각 테스트에서 모킹한다.
process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-role-key';
process.env.OPENAI_API_KEY ||= 'test-openai-key';
