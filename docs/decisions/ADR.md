<!-- COMMIT_STATUS START -->
> **커밋 상태**
> - 기준 커밋: `010bf5cbf28e5e0be8589f4cec7a36045b59c02b` (`feat/co-parent-push`)
> - 최근 커밋: `010bf5cbf28e` feat(notifications): 공동양육자 FCM 기기 푸시 (Phase 2 · 코드)
> - 커밋 일시: `2026-07-07T16:52:20+09:00`
> - 워킹트리: `clean`
> - 문서 갱신: `2026-07-07 16:52:38 +0900`
<!-- COMMIT_STATUS END -->

# Architecture Decision Records (ADR)

프로젝트에서 내린 주요 의사결정을 시간순으로 기록합니다.

---

## 2026-07-17 | 상담 LLM 호출은 60초 타임아웃 + 사용자 취소 (실천 피드백 15초와 분리)

- **결정**: 상담 LLM fetch를 `lib/consultRequest.ts`의 `createConsultRequestController()`로 감싼다. 클라이언트 타임아웃 **60초**(`CONSULT_LLM_TIMEOUT_MS`), 전체화면 로딩 오버레이에 **그만두기** 버튼, 중단 사유를 `user`/`timeout`으로 구분해 안내를 다르게 한다. 적용 대상은 `consult`(questions/initial·questions/followup·prescription)과 `consult/self`(questions·prescription).
- **이유**: 앱의 다른 LLM 호출(홈·실천의 `practice-feedback`)은 15초 `AbortController`가 있는데, **정작 가장 오래 걸리는 상담 생성만 아무 가드가 없어** 통신이 멎으면 `fixed inset-0 z-50` 오버레이(내비까지 덮음)에 갇혀 앱을 죽이는 것 외엔 탈출구가 없었다. 15초를 그대로 쓰지 않은 이유는 성격이 달라서다 — `practice-feedback`은 사용자가 기다리지 않는 배경 보강이라 짧게 끊어도 되지만, 문진/처방은 사용자가 화면을 보며 기다리는 생성 호출이라 15초로 끊으면 정상 응답을 죽인다. 서버측 OpenAI 클라이언트 타임아웃(`lib/openai.ts` 120초)보다는 짧게 둬서 사용자가 서버보다 먼저 풀려나게 했다. 취소와 타임아웃을 구분한 건, 사용자가 스스로 멈춘 건 실패가 아니라 안내 문구가 달라야 하기 때문.
- **대안**: (a) 15초 통일 — 정상 생성을 죽여 기각. (b) 취소 없이 타임아웃만 — 60초를 강제로 기다리게 되어 기각(그만두기 버튼이 실제 탈출구). (c) 스트리밍 전환 — 체감이 가장 좋지만 라우트·프롬프트·파싱을 모두 바꿔야 해서 별건으로 분리.
- **주의(회귀 위험)**: `handleCheckFollowUp`은 실패 시 곧바로 `handleGeneratePrescription`을 부르는 폴백이 있어서, **중단을 일반 오류와 같이 처리하면 그만두려던 사용자가 두 번째 LLM 호출에 다시 갇힌다.** 그래서 `isAbortError`면 폴백을 타지 않고 반환한다. `lib/consultRequest.test.ts`(7개)가 취소/타임아웃/타임아웃 직전 미중단/성공 시 타이머 정리를 고정한다.
- **알려진 한계/후속**: 상담 API 라우트에 `maxDuration` 선언이 없어 Vercel 기본 실행 제한을 따른다(생성이 그보다 길어지면 클라이언트 타임아웃 전에 504). 필요하면 라우트별 `export const maxDuration`을 검토 — 비용/플랜 판단이라 보류. `Navbar`의 `onHomeClick`은 `() => boolean | void` 동기 계약이라 `consult/page.tsx:1021`의 `window.confirm` 1곳은 남겨뒀다(비동기화하면 Navbar를 쓰는 모든 화면에 영향).

## 2026-07-17 | 다크 모드는 클래스 기준(`@custom-variant dark`)으로 고정

- **결정**: `globals.css`에 `@custom-variant dark (&:where(.dark, .dark *));`를 선언해 모든 `dark:*` 유틸리티가 `html.dark` 클래스를 따르게 한다.
- **이유**: Tailwind v4의 `dark:`는 기본값이 `prefers-color-scheme` 미디어 쿼리인데, 이 앱의 다크 모드는 `DarkModeToggle`과 `layout.tsx` 초기화 스크립트가 **클래스**로 토글한다. 두 기준이 어긋나 있어서 `.dark`는 CSS 변수(`--text-main` 등)만 뒤집고 `dark:*` 유틸리티(빌드 결과 221개 규칙)는 OS 설정을 따라갔다. 결과적으로 **OS 라이트 + 인앱 다크**에서 흰 배경 위에 밝은 글씨가 찍혀 본문이 사실상 읽히지 않았고, **OS 다크 + 인앱 라이트**에서도 반대 방향으로 깨졌다. 코드베이스는 처음부터 클래스 기준(v3 `darkMode: 'class'`)을 전제로 쓰였으므로, 유틸리티를 클래스에 맞추는 것이 의도 복원이다.
- **대안**: (a) 토글을 없애고 OS 설정만 따르기 — 사용자가 고른 테마를 무시하게 되고 `DarkModeToggle`·초기화 스크립트를 걷어내야 해서 기각. (b) `dark:*` 사용처를 CSS 변수로 일일이 치환 — 221개 규칙을 손대야 하는 대공사라 기각(한 줄로 같은 결과).

## 2026-07-17 | 사용자 피드백은 Toast, 확인은 `useConfirm` — 네이티브 `alert`/`confirm` 대체

- **결정**: `ToastProvider`(`components/ui/Toast.tsx`)와 `ConfirmProvider`(`components/ui/ConfirmProvider.tsx`)를 `layout.tsx`의 `LocaleProvider` 안에 둔다. 알림은 `useToast().success/error/info`, 확인은 `await useConfirm()({ title, description, tone })`로 쓴다. 되돌릴 수 없는 작업은 `tone: 'danger'`.
- **이유**: 앱이 Flutter WebView에서 도는데 `alert`/`confirm`은 도메인이 박힌 OS 대화상자로 떠서 조잡하다. 특히 저장 성공 같은 안내까지 화면을 막았다. 잘 만든 `ConfirmDialog`가 이미 있었는데도 52곳이 네이티브를 쓴 이유는 **호출부마다 상태 15줄을 배선해야 했기 때문**(`report/page.tsx` 1곳만 채택). 그래서 프라미스 기반 `useConfirm()`으로 `confirm()`과 같은 한 줄 모양(`if (await confirm({...}))`)을 제공해, 쉬운 길이 곧 올바른 길이 되게 했다. Toast는 상단 배치 — 하단 내비/고정 CTA와 겹치지 않는다.
- **대안**: (a) 호출부마다 `ConfirmDialog`를 직접 배선 — 지금까지 아무도 안 한 방식이라 반복될 이유가 없어 기각. (b) 외부 토스트 라이브러리 — lean한 package.json 기조와 어긋나고 safe-area/haptics/다크 토큰을 어차피 직접 맞춰야 해서 기각.
- **톤 규칙**: `toast.error`=실패, `toast.info`=정책 안내·검증·차단(사용자 잘못이 아님), `toast.success`=성공. 무료 플랜 한도(`childProfileLimitReached`)나 재검사 쿨다운처럼 "사용자 잘못이 아닌 안내"는 error 가 아니라 info 로 둔다.
- **의도적으로 남긴 네이티브 호출 2곳**: (1) `consult/page.tsx:1021` — `Navbar`의 `onHomeClick`이 `() => boolean | void` **동기 계약**이라 `await confirm()`을 쓰려면 Navbar와 이를 쓰는 모든 화면을 바꿔야 한다. (2) `install-app/page.tsx:214`의 `window.prompt` — `navigator.clipboard` 실패 시 **선택 가능한 텍스트로 URL을 보여주는 폴백**이라, 자동으로 사라지고 선택도 안 되는 토스트로 바꾸면 오히려 기능이 나빠진다. 네이티브 다이얼로그라고 전부 결함은 아니다.
- **파생 정리**: 확인창 문구가 네이티브 alert 용으로 제목·본문·질문이 한 덩어리(`\n` 포함)로 뭉쳐 있던 것을 제목/본문 키로 분리했다(`consult.confirmDropPractices`·`confirmDeleteSession` → `dropPracticesTitle`/`Body`, `deleteSessionTitle`/`Body`). 이 과정에서 **`confirmDeleteConsult`가 "이 상담 기록을 삭제할까요?"라고 묻고는 마지막 한 건이면 세션 전체를 지우던 불일치**를 발견해, 마지막 건일 때 `deleteLastConsultTitle`/`Body`로 사실대로 알리도록 고쳤다.

## 2026-07-17 | 차수화 검사(`PhasedChildSurvey`)는 파생 인덱스 + 진행 잠금으로 운용

- **결정**: 현재 문항을 "첫 미응답 문항"으로 파생하는 구조는 유지하되, 답 선택 시 220ms `pendingScore` 잠금을 두고(레거시 `survey/page.tsx`의 `isAdvancing`+220ms와 동일 규약), `reviewIndex`로 이전 문항 재열람을 허용한다. 진행 표시는 문항이 속한 차수 기준으로 센다.
- **이유**: 답을 저장하면 파생 인덱스가 즉시 다음 문항으로 넘어가 **같은 좌표에** 새 문항이 나타난다. 잠금이 없으면 더블탭의 두 번째 탭이 부모가 읽지도 않은 문항에 찍힌다 — 심리검사 도구에서 채점 데이터 오염이고, 되돌릴 수단도 없었다. 잠금은 이미 레거시 검사가 쓰던 검증된 규약이라 새 패턴을 만들지 않았다. `visibleItems`는 여러 차수를 합친 목록이라 전체 인덱스를 그대로 표시하면 "2차 · 16/15"가 되므로 차수 스코프로 센다.
- **대안**: (a) 현재 인덱스를 상태로 승격 — `buildAssessmentFlow`(순수 selector)와 이중 소스가 되어 기각. (b) 잠금 없이 전환 애니메이션만 추가 — 애니메이션 중에도 탭은 들어와 오염을 못 막아 기각.

---

## 2026-07-07 | 공동양육자 FCM 푸시(Phase 2) — DB Webhook → Next.js → FCM v1, 제로 의존성

- **결정**: Phase 1 인앱 알림을 실제 기기 푸시로 확장한다(마이그레이션 `027`). (1) **발송 경로 = Supabase Database Webhook → Next.js 라우트 → FCM**: `notifications` INSERT를 Supabase DB Webhook이 `POST /api/webhooks/notification-created`(헤더 `x-webhook-secret`)로 보내고, 라우트가 수신자 `device_tokens`를 조회해 FCM HTTP v1로 발송한다. 기존 IAP 웹훅(`/api/payment/iap/*`)과 동일한 "외부 웹훅 → Next.js 라우트" 패턴을 재사용 — 별도 Edge Function/인프라 없이 Vercel 배포에 얹는다. (2) **제로 의존성 FCM 클라이언트**(`lib/fcm.ts`): `firebase-admin`/`google-auth-library`를 추가하지 않고 Node `crypto`로 서비스계정 RS256 JWT→OAuth2 액세스토큰→FCM v1을 직접 호출(토큰 캐시, 무효토큰 표시 후 정리). (3) **토큰↔사용자 매핑은 웹이 담당**: 네이티브 앱엔 user id가 없고 인증이 WebView Supabase 세션에만 있으므로, 네이티브가 얻은 FCM 토큰을 `window.__gijilaiFcmToken`+CustomEvent로 웹에 주입하고 웹 `FcmTokenSync`가 세션으로 `POST /api/notifications/token`에 등록한다(기존 IAP/ReminderBridge 브릿지 패턴과 동일). (4) **탭 딥링크는 기존 `gijilai://open`→`_openWebPath` 재사용** → `/consultations/{sessionId}`. (5) **옵트아웃**: `profiles.coparent_push_enabled`(기본 ON), 설정 토글, 디스패처가 확인. 인앱 알림은 이 값과 무관하게 항상 남는다.
- **이유**: 발송 주체가 이미 DB 트리거(026)라 서버 앱에 발송 훅이 없다 → notifications INSERT를 신호로 삼는 DB Webhook이 자연스럽고, 트리거에 `pg_net`을 박아 insert 트랜잭션을 네트워크에 묶는 것보다 안전(비동기·관리형). IAP 웹훅이라는 선례가 있어 팀에 익숙한 패턴. 제로 의존성은 Vercel 서버리스 콜드스타트와 번들을 가볍게 유지하고 lean한 package.json 기조와 일치. 토큰 저장을 웹에 둔 것은 네이티브가 세션/유저를 모르기 때문(구조적 제약).
- **대안**: (a) Supabase Edge Function으로 발송 — Edge 배포·시크릿 관리라는 새 인프라가 늘어 기각(웹훅→Next.js가 기존 자산 재사용). (b) `firebase-admin` 채택 — 콜드스타트·번들 부담으로 기각(직접 JWT 20줄로 충분). (c) 네이티브가 직접 토큰 저장 — user id를 모르고 세션 쿠키도 없어 불가. (d) 웹푸시(서비스워커) — iOS Safari 제약 + 사용자는 대부분 Flutter 앱 안이라 후순위.
- **알려진 한계/후속**: (1) 실제 발송은 **외부 콘솔 설정 필요**(Firebase 서비스계정 키, iOS APNs .p8, Supabase Webhook, Vercel env) — 코드와 분리해 `docs/operations/coparent-push-setup.md`로 핸드오프. 미설정 시 디스패처는 `fcm_not_configured`로 조용히 통과(인앱은 정상). (2) 문구는 서버에서 한국어로 조합(인앱은 클라 i18n) — en 로케일 푸시는 Phase 2.5. (3) 방해금지·야간 지연·중복 억제 미구현. (4) 앱 릴리스 후에만 토큰 등록 → 배포 리드타임 존재. **검증**: `next build`(웹)·`flutter analyze`(앱) 통과. E2E(2계정 실기기)는 외부 설정 후.

---

## 2026-07-06 | 공동양육자 인앱 알림(Phase 1) — DB 트리거 기반, CHILD 전용

- **결정**: 한 양육자가 아이 상담을 남기면 상대 양육자에게 인앱 알림을 남기는 기능을 추가한다(마이그레이션 `026`). (1) **발생 지점 = DB 트리거**: 앱 코드가 아니라 `consultation_sessions` AFTER INSERT 트리거(`notify_co_parents_on_consultation_session`, SECURITY DEFINER)로 알림을 만든다. 근거 — CHILD 상담 세션 row는 `consult/page.tsx`가 처방 성공 직후에만 생성하므로 세션 INSERT가 "새 상담 완료"의 가장 정확·견고한 신호이고, 클라이언트 저장 경로가 바뀌어도 누락이 없다. (2) **CHILD 전용**: 트리거가 `type='CHILD'`만 처리 → `SELF_PARENT`(양육자 사적 반성문)는 마이그레이션 020의 가시성 차단에 이어 알림에서도 구조적으로 배제. (3) **구조 참조만 저장**: `notifications` 행에는 텍스트 문구가 아니라 actor/child/session 참조만 저장하고, 표시 문구는 조회 시 호칭 모델(018)로 조합한다. (4) **발송은 트리거/서버만**: RLS는 수신자 본인 SELECT/UPDATE/DELETE만 허용하고 INSERT 정책을 두지 않아 클라이언트 위조 불가. 조회 API는 service-role로 조합하되 항상 인증 세션의 `user_id`로 스코프. (5) **UI**: `/notifications` 화면 + 홈 상단바 벨/뱃지, 벨은 `isCoParentInvitesEnabled()` 플래그를 따른다(현재 알림원이 공동양육자뿐이므로).
- **이유**: 공동양육자는 이미 CHILD 상담을 서로 볼 수 있으므로(020) 알림은 새 동의가 아니라 기존 공유 범위 안의 도달성 개선이다. 별도 옵트인 게이트 없이 시작해 관계형 리텐션 가설(GJ-008)을 빠르게 검증한다. 트리거를 앱 코드 대신 DB에 둔 것은 저장 경로가 웹 클라이언트 직접 insert라 서버 훅이 없고, 트리거가 원자적이며 self-parent 배제를 한 곳에서 강제할 수 있기 때문. 문구를 저장하지 않은 것은 호칭 변경·i18n·알림 타입 확장에 강건하기 위함.
- **대안**: (a) `prescription/route.ts`에서 서버 발송 — 세션 저장 전이라 `session_id`가 없고 저장 실패/중복 처방과 어긋날 수 있어 기각. (b) 알림 문구를 SQL 트리거에서 완성해 저장 — copy가 SQL에 박히고 i18n 불가라 기각. (c) 처음부터 FCM 푸시 — 서버→기기 인프라(APNs 키, 토큰 저장, `firebase_messaging`)가 전무해 리드타임이 큼. 인앱으로 먼저 검증하고 Phase 2로 분리(SPEC §공동양육자 알림).
- **알려진 한계/후속(Phase 2)**: (1) 앱을 열어야 보임 → FCM 실제 푸시는 미착수(SPEC에 작업 목록). (2) 뱃지는 화면 진입 시 폴링(실시간 아님) → Supabase Realtime 후보. (3) 옵트아웃 토글 없음(항상 켜짐) → 부담 시 Phase 1.5. (4) 알림 타입은 `CO_PARENT_CONSULTATION` 1종(스키마는 enum·`data jsonb`로 확장 대비).

---

## 2026-07-04 | SEO 기술 기반 구축(robots·sitemap·manifest·JSON-LD·OG·favicon)과 색인 경계 확정

- **결정**: 앱에 기술 SEO 기반을 추가한다. (1) `app/robots.ts` — 공개(랜딩·가격·설치·법적고지)만 Allow, 로그인 게이트 뒤 앱 화면(`/settings·/consult·/consultations·/report·/practices·/survey·/translate·/intake·/observations·/payment·/pricing/complete·/test`)과 `/api`는 Disallow, sitemap·host 명시. `/shared·/invite`는 카카오 OG 스크랩(링크 미리보기)을 살리려고 막지 않되 sitemap에서는 제외. (2) `app/sitemap.ts` — 공개 URL 9개(랜딩·가격·설치·로그인·법적고지 5). (3) `app/manifest.ts` — PWA 매니페스트(standalone, 기존 아이콘 재사용). (4) 루트 `metadata` 강화 — favicon·apple-touch-icon(기존 전무), OG/twitter 이미지, `robots`(index·follow, max-image-preview:large), title 템플릿 `%s | 기질아이`, appleWebApp. (5) `components/seo/StructuredData.tsx` — Organization·WebSite·WebApplication(월 12,000원 Offer) JSON-LD. (6) **랜딩 SSR**: 루트 `/`를 서버 컴포넌트로 바꿔 쿠키 세션(`supabaseServer.getSession()`, 렌더 힌트)으로 랜딩/앱을 가른다 — 세션 없으면 랜딩을 SSR해 본문·`<h1>`이 초기 HTML에 담기고(네이버·Bing 대응), 세션 있으면 기존 클라이언트 대시보드(`HomeClient`, 구 `page.tsx`)로 이어받는다. 앱 WebView→로그인 전환은 `UnauthedHome`이 `useSyncExternalStore`(서버 스냅샷 false)로 처리해 크롤러엔 항상 랜딩, 앱엔 랜딩 플래시 없이 로그인. (7) 공개 페이지(`/pricing·/install-app·/legal/*`) per-page `layout.tsx`로 고유 title/description/canonical 부여(루트 상속으로 인한 중복 title 해소).
- **이유**: robots·sitemap·manifest·favicon·구조화데이터가 전무해 크롤러 안내·리치 결과·소셜/카카오 공유 카드·모바일 설치 신호가 비어 있었다. 앱 화면은 로그인 게이트라 색인 가치가 없고 크롤 예산만 낭비하므로 차단하고, 공유 토큰 페이지는 SNS 미리보기가 목적이라 크롤은 열되 sitemap엔 빼서 프라이버시와 미리보기를 양립시킨다. 허위 신호 금지 원칙에 따라 실측 없는 `aggregateRating`·리뷰 수는 JSON-LD에 넣지 않는다. 랜딩 CSR은 네이버(국내 유입 핵심)에 본문이 안 보이는 가장 큰 병목이라 서버 렌더링을 우선 처리했다.
- **알려진 한계(후속 우선순위)**: (1) 1200×630 브랜드 OG 배너(현재 256² 아이콘 재사용) — ImageResponse는 한글 폰트 임베드 필요. (2) hreflang은 ko/en이 동일 URL(쿠키 기반)이라 언어별 URL이 없어 미적용. (3) Google Search Console·네이버 서치어드바이저 인증 토큰(소유확인). (4) 공개 마케팅 페이지(`/pricing·/install-app`) 자체의 본문 SSR(현재 메타는 서버, 본문은 여전히 CSR — 랜딩만큼 중요치는 않음).
- **대안**: (a) `public/robots.txt`·`public/sitemap.xml` 정적 파일 — 동적 route handler가 URL 일원화·유지보수에 유리해 채택. (b) `/shared`도 Disallow — 카카오 미리보기가 깨질 수 있어 기각(sitemap 제외로 색인만 억제). (c) 랜딩 SSR까지 이번에 처리 — 로그인 사용자에 랜딩이 잠깐 보이는 UX 리스크가 있는 큰 변경이라 분리.

## 2026-07-03 | 아이말 번역기를 상담 진입 전 무료 단발 훅으로 신설하고 홈 “지금 상황 SOS” 카드를 대체한다

- **결정**: 상황 + 아이가 한 말/행동을 한 번에 적으면 아이의 1인칭 속마음(`childVoice`)·지금 진짜 원하는 것(`need`)·그 순간 건넬 한마디(`parentReply`)를 즉시 돌려주는 **단발성 무료 도구** `/translate`를 신설한다. 홈의 “지금 상황 SOS” 카드(고정 상황 키 칩 + 자유 입력 → `/consult`)를 **아이말 번역기 진입 카드로 대체**한다(한 줄 입력 → `/translate?input=...`). 결과 화면의 “이 고민으로 상담 이어가기”가 `/consult?source=translate&prefill={원문}`으로 유료 상담 루프에 연결한다. 게이팅은 **구독 없이 인증만** 요구하고 남용은 일일 LLM 쿼터(`TRANSLATE`, 기본 30/24h)로만 막는다. 모델은 `gpt-4o-mini` 고정, 결과는 **저장하지 않는다(stateless)**. 아이 기질/이름/연령은 서버에서 `childId` 기준으로 확정하고 실명은 가명(`○○이`)으로 보내 복원한다(2026-06-10 프라이버시 정책 준수). 표현 가드레일·입력 검증(`validateConsultProblemInput`)은 상담과 공유한다. 구현: `app/src/lib/aiTranslatePrompt.ts`, `app/src/app/api/consult/translate/route.ts`, `app/src/app/translate/page.tsx`.
- **이유**: 리포트·상담은 무겁고(문진 다단계) 상담은 구독 게이트라 상단 퍼널에서 제품 가치(“속마음 통역”)를 즉시 체감시키는 저마찰 훅이 약했다. 번역기는 상담 처방전의 `interpretation`(1인칭 통역)을 단발로 떼어내 30초 안에 맛보이고, 자연스러운 다음 행동으로 상담 전환을 만든다. 랜딩 카피(“아이의 신호를 올바르게 통역하는”)와도 정확히 같은 포지셔닝이다. 구 SOS 카드의 고정 상황 키 4종보다 자유 서술이 훨씬 넓은 상황을 커버하고, 무료·비저장·mini 고정으로 비용/프라이버시 리스크를 낮게 유지한다.
- **대안**: (a) 상담에 통합(별도 훅 없음) — 진입 마찰(로그인·문진·구독)이 커 훅 가치를 잃어 기각. (b) 구독 게이트 적용 — 상단 퍼널 훅의 목적과 정면 충돌해 기각(전환은 “상담 이어가기”가 담당). (c) 결과 저장·세션화 — v1 단순화를 위해 미저장(필요 시 후속). (d) `gpt-4o` 사용 — 짧은 통역엔 mini로 충분하고 무료·고빈도 특성상 비용이 부담이라 기각. (e) 홈 SOS 카드 유지하고 번역기 별도 추가 — 홈 상단이 중복 진입으로 번잡해지고 사용자 요청이 “SOS 제거”라 대체를 선택.

## 2026-06-16 | 차수화 신뢰도는 실측 캘리브레이션 전까지 노출하지 않고, 캘리브레이션 인프라를 먼저 갖춘다

- **결정**: 차수화 기질검사의 신뢰도 라벨(등급·%)은 `SE_CONSTANT`·밴드가 **실측 데이터로 캘리브레이션되기 전까지 노출하지 않는다** — `CONFIDENCE_CALIBRATED = false` 게이트(`PhasedChildSurvey`·`PhasedAssessmentReportCard` 두 렌더 지점에서 정확도 표기 숨김). 캘리브레이션 인프라를 갖춘다: 순수 통계 모듈 `assessmentCalibration.ts`(Cronbach α → SEM → `SE_CONSTANT` 역산, `assessmentCalibration.test.ts`로 손계산 검증) + 러너 `scripts/calibrate-assessment-confidence.cjs`(`npm run calibrate:assessment`, read-only) + 절차 문서 `docs/operations/assessment-confidence-calibration.md`. 근본 순서를 **문항 검수(DRAFT 101–125) → 데이터 수집 → 캘리브레이션 → 단조성·경계 검증 → 출시(`CONFIDENCE_CALIBRATED=true`)**로 고정한다. `ASSESSMENT_PHASED_ENABLED`는 수집을 위해 on이되 신뢰도는 게이트로 숨긴 채 둔다.
- **이유**: `SE_CONSTANT=18.0`은 임의값이라, 이 값으로 산출한 "신뢰도 X%/정밀+"를 노출하면 스펙 §5.4가 금지한 "가짜로 올라가는 신뢰도"(다크패턴)가 된다. ADR(2026-06-13)이 "2차 하면 더 정확"을 다크패턴 아닌 근거로 든 핵심이 바로 이 실측성이다. 캘리브레이션은 코드 수정이 아니라 실제 한국인 응답으로 하는 통계 작업이므로, 값을 임의로 바꾸지 않고 데이터가 쌓일 때까지 노출만 게이트하고 산출 도구를 미리 둔다. 문항 101–125가 DRAFT라 검수 전 수집분은 무효가 되므로 검수를 수집보다 앞에 둔다.
- **대안**: (a) 프록시 캘리브레이션(기존 20문항 데이터로 산출 후 즉시 출시) — 빠르나 새 45문항 뱅크와 문항이 달라 근사라서 "근본 답안" 요구에 따라 보류(데이터 차면 정식 산출). (b) 임의 보정값으로 출시 — §5.4 정면 위배, 기각. (c) 신뢰도 기능 제거 — 차수화의 핵심 가치(점진적 정밀화)를 버리는 것이라 기각. (d) 상수를 런타임 원격 구성 — 빌드타임 상수로 충분, 원격 구성 인프라는 과함.

## 2026-06-16 | GA4 funnel 계측 보정 및 분석 기준 정립 (platform·auth_state 공통 주입, login_success 전환만 집계, purchase 매출)

- **결정**: GA4(gtag) 이벤트 계측을 funnel 분석이 가능하게 보정하고, 향후 분석 기준을 고정한다.
  1. **공통 컨텍스트 자동 주입** — `analytics.ts`에 `setAnalyticsContext()` + ambient 병합을 추가해 모든 이벤트에 `platform`(web/ios/android, `getRuntimeAppInfo`)·`auth_state`(guest/authed)를 자동으로 붙인다. `FirebaseAnalytics`가 마운트 시 platform을, 인증 변화 시 auth_state를 주입한다. call site 변경 없이 전 이벤트가 세그먼트 가능해진다.
  2. **`login_success`는 "세션 없음→있음" 전환에서만 집계** — `AuthProvider.onAuthStateChange`가 `SIGNED_IN`마다 무조건 쏘던 것을, 첫 콜백(수화)·토큰갱신·재포커스를 제외하고 진짜 로그인 전환에서만 쏘게 한다.
  3. **GA4 표준 `purchase` 매출 이벤트** — 커스텀 `payment_completed`와 별개로 `trackPurchase()`로 `value`+`currency`를 가진 `purchase`를 쏜다. 웹 인라인 결제(`pricing/page`, currency-aware, USD는 센트→달러)·KR 카드 리다이렉트(`pricing/complete/page`, KRW)에 적용. IAP 매출은 서버 영수증(`priceAmountMicros`)으로 별도 집계(후속 과제).
  - **분석 기준(이후 고정)**: 활성화 funnel = `first_visit → intake_completed → survey_module_completed → report_viewed → consult_started → consult_completed → trial_conversion_cta_clicked → purchase`. **모든 funnel은 `platform`·`auth_state`로 세그먼트**한다(웹=게스트 시작 허용, 앱=진입 강제 로그인이라 funnel 형태가 다름). 로그인은 진입 게이트가 아니라 리포트(가치) 게이트(`/api/llm/report` 401), 상담은 구독 게이트(402)로 읽는다. 매출은 `purchase.value` 기준(커스텀 이벤트 금액은 GA 매출 아님).

- **이유**: GA top-이벤트(146 users → login_success 20 → report_viewed 11, consult는 top10 밖) 해석 중, 단일 funnel로는 웹(게스트 시작 가능)과 앱(강제 로그인)을 섞어 "로그인=진입 누수"로 오독함을 발견. 근본 원인은 이벤트에 platform/auth_state가 없어 세그먼트가 불가능했던 것. `login_success`는 `onAuthStateChange`에서 새로고침마다 재발화해 185회/20명(1인 9.25회)으로 부풀려져 신뢰 불가였다. 매출은 GA가 커스텀 이벤트의 금액 파라미터를 집계하지 않아 "총수익 $0" 깜깜이였다 — GA 매출은 표준 `purchase.value`에서만 나온다.

- **데이터 불연속(주의)**: 이 배포 전후로 **`login_success` 정의가 바뀐다** — 이전치는 세션 재발화 포함 과대집계이므로 전/후 직접 비교 금지(추세 단절선). `platform`·`auth_state` 차원과 `purchase` 매출은 **이 배포 이후 데이터부터** 채워진다(이전 구간은 빈 값).

- **대안**: (a) call site마다 platform/auth_state 수동 추가 — 누락·드리프트 위험으로 기각, 공통 컨텍스트 1곳 주입 채택. (b) `login_success`를 로그인 핸들러에 직접 — OAuth는 리다이렉트 후 콜백 페이지에서 SIGNED_IN이 발생해 핸들러가 못 잡음, 리스너+전환감지가 유일하게 정확. (c) 매출을 `payment_completed`에 `value`만 추가 — GA가 커스텀 이벤트를 매출로 안 셈, 표준 `purchase` 필요. (d) 매출 전량 서버 Measurement Protocol — 정확하나 범위가 커, 클라 `purchase`로 웹/카드를 즉시 복구하고 IAP만 서버 후속으로 둔다.

## 2026-06-13 | 기질검사를 차수화(점진적 심화형)하고 1차 무료·2·3차 구독으로 제공한다

- **결정**: 아동 기질검사 문항뱅크를 ~45문항으로 확장하고 **3차수(15·15·15)** 로 분할한다. 매 차수는 그 자체로 완결된 결과(타입+리포트)를 주고, 차수를 거칠수록 **실측 신뢰도**(`typeConfidence = ∏ normalCdf(|점수−임계값|/SE)`, `SE=SE_CONSTANT/√n`)가 올라간다. **1차는 항상 무료·완결**, **2·3차는 `getFeatureAccess.hasFullAccess`(구독 또는 7일 체험)** 로 게이팅한다. 완료 후 **90일 경과 또는 연령밴드 변경** 시 재평가(새 cycle = 새 `surveys` 행, facet 내 문항 로테이션)하고 점수 시계열 트렌드를 2차 이상 프리미엄으로 노출한다. 데이터 모델은 기존 `surveys`·`TemperamentScorer`(가변 문항 수 정규화)·`TemperamentClassifier`(8타입, 임계값 불변)·`access.ts` 게이팅을 재사용하고, `surveys`에 `phase`·`assessment_version`, `reports`에 `phase` 컬럼만 추가(마이그레이션 025). 스펙: `docs/spec/phased-temperament-assessment.md`.
- **이유**: 현재 차원당 5문항(facet당 1문항)은 측정 신뢰도가 얕고 facet 인사이트가 불가능하다. 100문항을 한 번에 받으면 완료율이 떨어지므로 쪼개되, 1차에 변별력 높은 문항을 몰아 무료만으로도 안정적 타입이 나오게 해 전환을 만든다. 신뢰도를 실측 통계로 표시해야 "2차 하면 더 정확"이 다크패턴이 아닌 사실이 되고 CBQ/ATQ 과학적 신뢰 포지셔닝을 지킨다. 성장에 따른 주기적 재평가(살아있는 프로파일)는 일회성 검사가 구독을 정당화하지 못하는 문제를 푸는 핵심 리텐션 장치다. 게이팅을 hasFullAccess로 둔 건 기존 상담/실천과 일관되게 7일 체험을 전환 장치로 쓰기 위해서다.
- **대안**: 주제 분할형(1차 아이·2차 부모·3차 양육태도) — 지금 3모듈 구조에 가깝고 측정 깊이가 그대로라 기각. 전부 무료 — 도달은 좋지만 구독 차별화가 약화돼 기각. 5차수 — 더 잘게 나누나 1차→2차 이탈 리스크가 커 파일럿은 3차수로 하고 검증 후 재고. 신뢰도를 임의 상승 숫자로 표시 — 과학적 신뢰 포지셔닝과 충돌해 기각. 차수/버전 테이블 신설 — 기존 멀티시도(timestamp 새 행) 모델로 충분해 스키마 비대화를 피하려 기각.

## 2026-06-10 | 아이 실명·생년월일은 외부 LLM(OpenAI)에 보내지 않는다

- **결정**: 모든 LLM 프롬프트에서 아이 이름을 가명 토큰 `○○이`로 치환해 보내고, 응답에서 받침 규칙(koreanUtils)에 맞는 조사와 함께 실명으로 복원한다. 자유 텍스트(고민·답변·관찰 기록·세션 맥락)에 들어간 이름도 입력 단계에서 가명화한다. 생년월일 원본은 보내지 않고 나이(세/개월)로 변환한다. 구현: `app/src/lib/childPseudonym.ts`, 적용 지점은 리포트(스트림은 JSONL 모듈 파싱 직후 복원)·상담 질문/처방·self-parent.
- **이유**: 아동 데이터의 국외 제3자 전송은 개인정보보호법상 최소화가 원칙이고, 서비스 품질에 실명이 필요하지 않다. `○○`는 자연어에 등장하지 않는 문자라 복원 치환의 오탐이 없고, 복원이 누락돼도 사용자에게 관용적 익명 표기로 보여 실패 모드가 안전하다. 스트림 리포트는 청크 경계 문제가 있지만 JSONL 모듈 단위로 파싱한 "완성된 객체"에서 복원하므로 경계 문제가 없다.
- **대안**: 실명 유지 + 처리방침 고지만 — 법적 최소화 원칙에 미달, 기각. 모델에게 임의 가명(예: 지우) 부여 — 실제 텍스트와 충돌(가명이 본문 단어와 겹침)·오복원 위험, 기각. 출력 스트림 청크 단위 치환 — 청크 경계에서 토큰이 쪼개져 누락 가능, 기각.

## 2026-06-10 | LLM 호출은 사용자별 24시간 쿼터로 사전 차단한다 (fail-open)

- **결정**: 신규 `llm_usage_events` 테이블(마이그레이션 023)에 모든 인증 사용자의 LLM 호출을 호출 전에 기록하고, 24시간 카운트가 한도를 넘으면 429로 차단한다. 한도는 abuse guard 수준(REPORT 12/일 등)이고 `LLM_DAILY_LIMIT_<KIND>` 환경변수로 조정한다. DB 오류·테이블 미적용 시에는 차단하지 않는다(fail-open). `kind` 컬럼에는 check 제약을 두지 않는다.
- **이유**: 기존 `subscription_usage_events`는 활성 구독자만 기록돼 무료/체험 계정의 남용(가장 큰 비용 위험)을 막지 못한다. 사후 기록이 아니라 사전 차단이어야 비용이 실제로 보호된다. fail-open인 이유는 쿼터 인프라 장애가 제품 전체를 멈추면 안 되기 때문. check 제약을 안 두는 이유는 011→013에서 enum 확장 시 제약 갱신 누락으로 insert가 조용히 실패한 사고(SELF_PARENT_*도 동일 사고 재발)를 반복하지 않기 위해서다.
- **대안**: 미들웨어/외부 rate limiter(업스태시 등) — 인프라 추가 없이 기존 Supabase로 충분, 기각. 구독 등급별 제품 차원 사용량 제한 — 이건 별도 제품 결정이며 이번 범위 아님.

## 2026-06-10 | 리포트 공유 링크는 PK가 아니라 opt-in share_token으로 만든다

- **결정**: `reports.share_token`(uuid, partial unique index, 마이그레이션 022)을 추가하고, 공유 화면 진입 시 `/api/report/share`(소유자 인증)로 토큰을 발급한다. 공개 조회 `/api/report/shared/[token]`은 토큰으로만 조회하며, 응답에서 생년월일 원본을 빼고 나이 표기만 내려준다. **기존 `/shared/{reportId}` 링크는 배포 후 만료된다.**
- **이유**: 종전에는 리포트 PK만 알면 공유한 적 없는 리포트도 아이 이름·성별·생년월일·전체 분석이 공개 조회됐다(소유자 의사와 무관, 회수 불가). 토큰을 공유 시점에만 발급하면 opt-in이 되고, PK와 분리돼 있어 링크 유출 시에도 다른 리소스 추론이 불가능하다. 출시 직후라 기존 공유 링크 트래픽이 거의 없어 호환 레이어 없이 끊는 비용이 가장 낮은 시점이다.
- **대안**: PK 조회 유지 + `is_shared` 플래그 — 링크가 여전히 PK를 노출하고 회수 시 재공유 URL이 같아 기각. 기간 한정 이중 지원(PK+토큰) — 비공유 리포트 노출 구멍이 그대로 남아 기각.

## 2026-06-10 | IAP 검증 실패는 '일시/영구'로 분류하고, Android는 콜드 스타트마다 구매를 복구한다

- **결정**: 영수증 서버 검증의 일시 실패(네트워크/5xx/429/타임아웃)는 `retryable`로 분류해 세션 내 지수 백오프(최대 5회) 재시도하고, 한도 초과 시 스토어 재전달에 맡긴다(`completePurchase` 미호출 → 거래가 스토어에 남음). Android는 `_initIAP`에서 매번 `restorePurchases()`를 자동 호출하고, iOS는 자동 호출하지 않는다. 구독 관리 화면에 앱 전용 '구매 복원' 버튼(`PaymentBridge` `RESTORE_REQUEST`)을 추가한다. 복원(restored) 동기화는 명시적 복원 요청이 아니면 무음 처리한다. 상품/오퍼 선택 로직은 `lib/iap/`로 분리해 단위 테스트를 붙였다.
- **이유**: 종전에는 검증 실패 시 구매가 메모리 큐에서 제거돼 영구 유실됐고, Android 미확인 구매는 Google이 3일 뒤 자동 환불해 "돈 냈는데 구독 없음 → 환불"이라는 최악의 CS 경로가 열려 있었다. iOS에서 자동 restore를 안 하는 이유: 미완료 거래는 어차피 자동 재전달되고, `restoreCompletedTransactions`는 App Store 로그인 프롬프트를 띄울 수 있어 Apple 가이드라인상 사용자 액션으로만 호출해야 한다. 무음 동기화인 이유: Android 콜드 스타트 복구가 활성 구독자에게 매번 "구독이 시작되었습니다!"를 띄우면 안 되기 때문.
- **대안**: 영수증을 SharedPreferences에 자체 영속화 — 스토어가 이미 거래의 단일 진실 소스라 이중 소스(스테일 토큰) 위험만 추가, 기각. iOS도 자동 restore — 로그인 프롬프트 리스크로 기각. main.dart 전체 분리 — 위젯 상태와 깊게 얽혀 무테스트 상태에서 회귀 위험이 커, 이번에는 순수 로직(선택/재시도 정책)만 분리하고 전체 분리는 별도 작업으로 둔다.

## 2026-06-10 | 활성 구독은 DB unique 제약으로 1인 1개를 강제한다

- **결정**: `subscriptions(user_id) WHERE status IN ('ACTIVE','PAST_DUE')` partial unique index(마이그레이션 024, 기존 중복은 최신 1건만 남기고 정리). `/api/payment/subscribe`는 23505 위반 시 이번 결제를 자동 환불하고 `ALREADY_SUBSCRIBED`(400)로 응답하되, 먼저 성공한 구독은 건드리지 않는다(같은 billing_key 기반 cleanup이 승자 구독을 취소하는 사고 방지).
- **이유**: "기존 구독 확인 → 생성" 사이 레이스(결제 버튼 더블탭)로 이중 결제·이중 구독이 가능했다. 애플리케이션 체크만으로는 동시성을 못 막고, DB 제약이 유일하게 신뢰 가능한 차단선이다. 웹훅의 구독 복구 경로도 같은 제약에 걸리면 자동 환불로 수렴한다.
- **대안**: advisory lock/트랜잭션 — PostgREST 경유라 멀티 스테이트먼트 트랜잭션이 어려워 기각. 클라이언트 버튼 비활성화만 — 우회 가능, 보조 수단으로만.

---

## 2026-06-03 | 상담 진입 대상 아이는 selectedChildId 단일 소스로 통일한다

- **결정**: "현재 보고 있는 아이"는 store의 `selectedChildId`를 단일 진실 소스로 삼는다. 홈은 화면에 실제로 표시되는 `mainChild`(선택값이 없으면 children[0])를 effect로 항상 `selectedChildId`에 반영하고, 상담 페이지는 세션 없이 진입해 fallback으로 아이를 정한 경우 그 아이를 `selectedChildId`에 다시 써넣는다(self-heal). 화면마다 children[0]을 독립적으로 재추론하지 않는다. 더불어 children 조회 정렬을 `db.getChildren`(birth_date 내림차순)으로 통일한다.
- **이유**: 기존에는 홈/리포트(db.getChildren, birth_date desc 정렬)와 상담(자체 쿼리, 정렬 없음)이 각각 children[0]로 "현재 아이"를 따로 추론했고, `selectedChildId`는 사용자가 아이 스위처를 직접 탭할 때만 설정돼 평소 null이었다. 그 결과 아이가 둘일 때 홈에서 보던(기질검사 완료한) 아이와 상담이 고른 아이가 어긋나, 검사하지 않은 다른 아이의 "기질검사를 먼저 완료하세요" 게이트가 떴다. selectedChildId를 항상 유효하게 유지하면 모든 화면이 같은 아이를 가리키고, 삭제된 아이를 가리키던 stale 선택도 자동 보정된다.
- **대안**: `/consult` 이동 시 URL로 childId를 명시 전달 — 진입점(홈 CTA·하단 네비·실천 모달 등)을 모두 고쳐야 하고 하단 네비처럼 클릭 시점에 아이 맥락이 없는 경로는 결국 store fallback이 필요해, 이미 selectedChildId를 공유하는 기존 구조와 충돌해 기각. 정렬만 맞추기(1차 수정) — children[0] 기준은 일치시키지만 selectedChildId가 null일 때 "사용자가 보던 아이"를 보장하지 못해 미봉책. 화면마다 children[0]을 재추론하는 구조 유지 — 근본 불일치가 남아 기각.

---

## 2026-05-31 | 양육자 자신을 위한 상담(self-parent)을 도입한다

- **결정**: 아이 행동 상담 외에, 양육자 본인의 마음·자기 작업을 다루는 별도 상담 흐름을 추가한다. 캐치프라이즈 **"더 좋은 사람이 되기 위해 고민하는 것만으로 당신은 이미 좋은 사람"** 을 제품 톤의 약속으로 삼는다. 데이터는 기존 `consultation_sessions` / `consultations` / `practice_items`에 `type ('CHILD' | 'SELF_PARENT')` 컬럼을 추가해 분리하고 별도 테이블을 만들지 않는다. 처방 구조는 아이 상담(속마음 통역 + 3 실천)과 다르게 **짧은 acknowledgment + reflection + 나에게 해줄 한 마디(magicWordForSelf) + 오늘 나를 위한 단 하나의 action(7개 자기작업 도구 중 1개)** 로 둔다. Phase 1은 아이 상담 결과 후 CTA로 진입하는 one-shot reflection(입력→2질문→처방, 기록만 저장, 후속 상담 X). 단계별 확장은 `docs/product/SELF_PARENT_CONSULTATION_PLAN.html` 참조.
- **이유**: 발달심리 합의상 양육 변화는 "좋은 부모→좋은 아이" 한방향이 아니라 양방향이며, 부모의 자기 조절·reflective functioning·자기 돌봄이 아이 발달의 베이스다. 아이 행동만 분석하는 서비스는 본질적으로 절반짜리다. 별도 테이블 대신 type 컬럼을 쓰면 기존 RLS·co-parent 가시성·이력 화면을 재사용하고 Phase 3 cross-context(자기 상태→아이 상담 톤 조정)도 자연스럽다.
- **임상 경계(핵심 가드라인)**: AI가 심리치료를 흉내내지 않는다. 어린 시절·트라우마를 깊이 캐묻거나 진단명을 붙이지 않고, 부부 관계 분석을 하지 않는다. 자해/폭력/지속 디스트레스 위기 키워드 감지 시 처방 대신 전문기관 안내(자살예방 109/1393, 정신건강 1577-0199, 아동학대 112)를 우선한다. 위기 감지는 카테고리·시점만 기록하고 자유 텍스트 원문은 저장하지 않는다.
- **대안**: 기존 양육자 분석 탭만 강화 — 진입 동기와 실천 루프가 약해 기각(보조로만 유지). 별도 self_reflections 테이블 신설 — RLS·이력·co-parent 가시성을 다시 짜야 해 기각. 어린 시절·원가족까지 다루는 깊은 자기 작업 — 임상 경계 위험이 커 명시적으로 범위 밖.

---

## 2026-05-31 | 공동양육자(co-parent) 연결은 비대칭 초대 모델로 간다

- **결정**: 한 아이당 공동양육자 1명을 초대할 수 있다(1:1). 아이를 처음 등록한 사용자를 `owner`로 두고, 초대받은 사용자(`co_parent`)는 별도 계정으로 가입해 owner의 아이 맥락(리포트·상담 세션·실천·기록)을 읽고 쓸 수 있다. 단, **아이 정보 수정·삭제·구독 변경**은 owner 전용이다. 양육자 호칭은 `MOM | DAD | CARER` 폐쇄형 enum으로 owner와 co_parent 양쪽이 각각 선택한다. 검증 단계(Phase 1)에서는 owner의 구독 권한으로 co_parent도 새 상담/리포트 생성을 수행할 수 있다. Owner 해지/탈퇴 시의 co_parent 처리(7일 grace 등)는 Phase 2에서 다시 결정한다.
- **이유**: 공유 계정(가족 계정) 모델은 누가 무엇을 했는지 구분이 안 돼서 nodtry에서 검증된 "옆에 있는 사람" 트리거(상대 기록·반응)를 만들 수 없고, 양육자 기질(ATQ)도 둘로 분리되지 않아 양육자 분석 리포트가 깨진다. 평등 peer-to-peer는 이상적이지만 가입 마찰이 GJ-008의 kill 기준(`초대율 < 15%`)을 인위적으로 끌어내려 가설 검증을 오염시킨다. 비대칭 초대는 (a) nodtry 파트너 연결 모델과 정합, (b) 현재 `children.parent_id` 단일 소유자 구조 손상 없음, (c) 초대받는 쪽 마찰 최소화, (d) 옵트인 원칙(솔로 경험 무손상) 모두를 동시에 만족한다.
- **대안**: 가족 계정(단일 공유) — 양육자별 트리거·기질 분리 불가, OAuth 충돌로 기각. 평등 peer-to-peer — 가입 마찰로 검증 결과 오염 우려, Phase 2 채택 후 확장 옵션으로 보류. 호칭 자유 입력 — LLM 프롬프트 안정성·데이터 일관성을 위해 Phase 1 폐쇄형, 자유 입력은 Phase 2에서 검토.

---

## 2026-05-31 | 공동양육 도입에 따른 상담·실천 데이터는 작성자(`user_id`)로 분리해 표시한다

- **결정**: `consultation_sessions`, `consultations`, `practice_logs`, `practice_reviews`의 작성자는 기존 `user_id` 컬럼을 그대로 사용한다(DB 모델 변경 없음). 다만 (a) 모든 관련 UI에 작성자 호칭 라벨을 표시하고(예: `엄마가 시작한 상담`, `오늘 아빠 ✓`), (b) 상담 LLM 프롬프트에 현재 작성자 호칭과 공동양육자 존재 여부, 이전 상담의 작성자 라벨을 주입한다. 추가 상담(후속)은 owner·co_parent 양쪽 누구나 이어갈 수 있고, 이어간 사람이 새 `consultations.user_id`로 박힌다. 양육자 분석 리포트의 두 양육자 분리는 co_parent ATQ 측정 흐름과 묶여 Phase 2 범위로 둔다.
- **이유**: 현재도 `user_id`로 작성자가 박혀 있어 DB는 이미 분리되어 있다. 빠진 건 표시·LLM 컨텍스트뿐이라 구조 변경 없이 라벨링만 추가하면 두 양육자가 같은 아이를 두고 서로 다른 시점으로 상담해도 처방 톤·인사·이력 표기에서 혼선이 없다. 양육자 분석 리포트 분리는 ATQ 두 명 측정 데이터가 필요하므로 검증 단계엔 ROI가 낮다.
- **대안**: 세션을 양쪽 공동 소유로 합치고 작성자를 별도 필드로 추가 — 기존 RLS·쿼리·이력 컨텍스트 주입을 모두 재작성해야 하며 이득이 표시 라벨뿐이라 기각. 추가 상담을 시작한 사람만 잇기 — 한 명이 잊어도 상대가 끌어오는 co-parent 가치를 약화시켜 기각.

---

## 2026-05-12 | 리텐션 진입점은 기록 숙제가 아니라 즉시 조정과 상황 SOS로 만든다

- **결정**: 실천 상세 기록은 추천 실천 첫 기록부터 아이 반응 기반 피드백을 생성해 `내일 조정안`을 즉시 보여준다. 홈 인라인 체크는 빠른 저장을 유지하되 기본 구조화 신호로 짧은 피드백을 시도하고, 더 정확한 기록을 위한 상세 기록 CTA를 함께 노출한다. 또한 아이 기질 리포트가 있는 홈에는 `지금 상황 SOS` 카드를 상시 노출해 방금 발생한 등원/외출, 떼쓰기/폭발, 잠자리, 화낸 뒤 후회 상황을 상담 입력 초안으로 바로 연결한다.
- **이유**: 실천 기록은 저장 자체가 보상이 되기 어렵고 사용자가 다시 앱을 여는 순간은 “기록해야지”보다 “방금 문제가 터졌다”에 가깝다. 기록 직후 작은 조정안을 돌려주고, 위기 순간을 상담 시작점으로 만들면 재방문 이유가 더 직접적이다.
- **대안**: 실천 기록 입력 항목만 늘리기 — 입력 부담이 커지고 재방문 동기를 만들지 못해 기각. 상담 CTA를 기존 조건(`진행 중 실천 없음`)에서만 노출 — 이미 실천 중인 사용자의 실제 위기 순간을 받지 못해 기각.

---

## 2026-05-05 | 무료 플랜 아이 프로필은 영구 슬롯으로 제한한다

- **결정**: 무료 플랜은 아이 프로필 1명 영구 슬롯만 제공한다. 7일 체험 중이거나 구독 중이면 여러 명을 등록/삭제할 수 있지만, 무료 상태에서는 슬롯 사용 이력을 `child_profile_slots`에 남기고 마지막 아이 삭제를 막아 삭제 후 재등록으로 새 기질검사를 반복하는 우회를 방어한다.
- **이유**: 현재 아이 삭제가 hard delete라서 “현재 등록된 아이 수”만 검사하면 무료 전환 후 아이를 삭제하고 새 아이를 등록해 기질검사를 계속 새로 시작할 수 있다. 슬롯 이력과 DB RLS/트리거를 같이 두면 브라우저 직접 Supabase 호출이나 리포트 생성 중 자동 아이 생성 경로도 같은 정책을 따른다.
- **대안**: 클라이언트 화면에서만 추가 버튼을 숨김 — 직접 API/DB 호출과 리포트 자동 생성 경로가 남아 기각. 아이 삭제를 모두 soft delete로 바꿈 — 데이터 모델과 기존 삭제 UX 변경 범위가 커서, 이번 결정에서는 영구 슬롯 테이블과 마지막 아이 삭제 차단으로 최소 방어선을 먼저 구축한다.

---

## 2026-05-05 | 리포트 재분석은 설문 타입별로 독립 실행한다

- **결정**: 아이 기질과 양육자 기질의 다시 분석은 서로의 설문 응답과 리포트를 초기화하지 않는다. 아이 재분석은 `CHILD` 설문/리포트만, 양육자 재분석은 `PARENT` 설문/리포트만 새로 만들고, 둘 중 하나가 바뀌면 기질 맞춤 양육 리포트는 별도 CTA로 재분석을 안내한다.
- **이유**: 한쪽 기질만 다시 보고 싶은 사용자가 전체 설문을 다시 치르게 되면 작업량이 커지고, 이미 안정적으로 생성된 반대쪽 결과까지 흔들린다. 반면 하모니 리포트는 두 기질의 조합 결과라 한쪽이 바뀌면 stale 가능성이 있으므로 명시적으로 다시 생성할 수 있어야 한다.
- **대안**: 기존처럼 전체 설문을 다시 시작 — 구현은 단순하지만 사용자 의도보다 큰 범위를 초기화해 기각. 한쪽 재분석 후 하모니까지 자동 재생성 — 비용과 대기 시간이 늘고 사용자가 원하지 않는 생성이 발생할 수 있어 안내 CTA로 분리한다.

---

## 2026-05-05 | 아이 기질 리포트는 모듈 단위 SSE 스트리밍으로 먼저 보여준다

- **결정**: `/api/llm/report`는 아이 기질 리포트에 한해 `stream: true` 요청을 지원한다. 새 리포트 생성 시 OpenAI 응답을 JSONL 모듈(`intro`, `dimensions`, `insight`, `strengths`, `parentingTips`, `scripts`)로 받아 SSE `module` 이벤트로 순차 전달하고, 모든 핵심 모듈이 완성된 뒤에만 DB에 저장한다. 캐시가 있으면 기존처럼 즉시 반환하되 SSE의 `cached/completed` 이벤트로 전달한다.
- **이유**: 아이 기질 리포트 생성은 OpenAI 응답 자체가 약 20초 이상 걸리는 병목이었고, 입력 크기보다 긴 출력 생성 시간이 지연의 대부분이었다. 전체 JSON이 끝날 때까지 빈 로딩을 보여주기보다 첫 모듈부터 화면에 누적 표시하면 사용자가 실제 진행을 볼 수 있고, 실패 시에도 기존 안정 리포트를 보존하는 정책과 충돌하지 않는다.
- **대안**: 모델만 바꾸기 — 품질/비용/지연 트레이드오프를 다시 검증해야 하고 첫 화면 체감 대기는 여전히 남아 보류. 전체 JSON 응답 유지 — 구현은 단순하지만 사용자가 20초 이상 결과를 전혀 보지 못해 기각. 부모/기질 맞춤 양육까지 한 번에 스트리밍 전환 — 화면과 프롬프트 계약 변경 범위가 커서 아이 리포트 thin slice 이후 확장하기로 했다.

---

## 2026-05-02 | 네이티브 앱 WebView에서는 앱 설치 유도를 렌더링하지 않는다

- **결정**: 웹 설치 전환 화면(`/install-app`)과 상담 결과의 앱 설치/다운로드 CTA는 네이티브 앱 WebView에서 렌더링하지 않는다. `/install-app`이 앱 안에서 열리면 설치 화면을 보여주지 않고 `from` 값에 따라 `/pricing`, `/payment`, 또는 홈으로 되돌린다. `/payment`, `/pricing`의 앱 여부 판별 중 로딩 문구도 설치 화면 이동 문구 대신 중립 로딩 문구를 사용한다.
- **이유**: 앱 사용자는 이미 설치된 환경에 있으므로 "앱 설치하기", "스토어 열기" 같은 문구가 보이면 현재 실행 맥락과 충돌한다. 특히 WebView 특성상 웹 라우트와 컴포넌트를 그대로 공유하므로, 설치 유도는 웹 브라우저 사용자에게만 제한해야 한다.
- **대안**: 앱에서도 설치 페이지를 그대로 노출 — 이미 앱 안에 있는 사용자에게 불필요하고 혼란스러워 기각. 문구만 "앱에서 이용 중"으로 변경 — 설치 전환 화면 자체의 목적이 사라지므로 라우트 fallback이 더 명확해 기각.

---

## 2026-05-02 | 하단 시트와 모달도 공통 safe area 유틸리티로 관리한다

- **결정**: 하단 고정 CTA뿐 아니라 바텀시트/모달 오버레이도 `app-modal-overlay`, `app-modal-panel`, `app-modal-panel-scroll`, `app-bottom-sheet-*` 공통 클래스로 하단 safe area를 반영한다. 일반보다 높은 고정 CTA가 있는 child-only 리포트는 `app-large-fixed-cta-scroll`로 별도 스크롤 여백을 둔다.
- **이유**: 실천 기록 입력처럼 화면 위에 뜨는 바텀시트는 페이지 본문의 `app-page-scroll`이나 `app-fixed-cta-scroll` 보호를 받지 않아 Android edge-to-edge 환경에서 저장 버튼과 마지막 입력이 시스템 내비게이션 영역에 붙거나 가려질 수 있다. 모달 계층까지 같은 inset 값을 쓰면 화면별 `pb-*` 임의값을 줄이고, DatePicker/알림 시간 선택/결제 확인 다이얼로그 같은 유사 구조의 회귀를 함께 막을 수 있다.
- **대안**: 실천 기록 모달에만 개별 `pb-*`를 추가 — 다른 바텀시트에서 같은 문제가 반복될 가능성이 높아 기각. WebView 전체를 다시 native `SafeArea`로 감싸기 — fixed/absolute/sticky UI의 내부 스크롤 여백은 웹에서 계속 별도로 맞춰야 하므로 기각.

---

## 2026-05-02 | 앱 설치 랜딩의 모바일 스토어 선택은 단일 CTA로 축소한다

- **결정**: `/install-app`은 iOS/Android 브라우저에서 "이 기기에 맞는 스토어" 선택 카드를 렌더링하지 않고, 하단 고정 CTA 하나로 App Store 또는 Google Play 이동을 처리한다. 데스크톱/기타 브라우저에서는 기기를 확정할 수 없으므로 두 스토어 선택지를 유지한다.
- **이유**: 모바일에서는 UA로 대상 스토어가 이미 결정되는데 동일한 목적의 카드와 하단 CTA가 함께 보이면 사용자가 선택해야 할 일이 있는 것처럼 느낀다. 설치 전환 화면은 설명보다 바로 이동이 중요하므로 모바일은 단일 CTA가 더 명확하다.
- **대안**: 모바일에서도 추천 스토어 카드를 계속 노출 — 실제 선택지는 하나뿐이라 중복 UI가 되고 첫 화면 밀도가 높아져 기각. 모든 플랫폼에서 스토어 카드를 제거 — 데스크톱 사용자는 설치할 기기를 선택해야 하므로 기각.

---

## 2026-05-01 | 설문 진입은 빠른 아이 리포트와 전체 분석 경로를 분리한다

- **결정**: 설문 안내 화면(`/survey/intro`)은 단일 시작 버튼 대신 두 경로를 명시적으로 제공한다. `3분으로 아이 기질 검사`는 아이 기질 설문 완료 후 즉시 `/report?child_only=true`로 이동하고, `처음부터 전체 분석 시작하기`는 아이 설문 뒤 곧바로 양육자 기질/양육 스타일 설문까지 연속 진행한다. 단, 양육자 기질 데이터가 이미 있는 사용자가 `child_only` 리포트에 진입하면 `/report?tab=child` 전체 리포트 모드로 정규화한다.
- **이유**: 기존 구현에는 이미 `아이 설문 완료 → child_only 리포트` 경로가 있었지만, 사용자는 이를 “빠른 첫 결과” 경로로 인지하기 어려웠다. 설문 시작 시 선택지를 분리하면 첫 가치 도달 시간을 줄이면서도, 처음부터 전체 분석을 원하는 사용자 흐름을 막지 않을 수 있다.
- **대안**: 기존 단일 진입 유지 — 빠른 결과 경로의 발견성이 낮아 초기 이탈을 줄이기 어렵다. 별도 새 라우트 추가 — 실제 로직은 기존 흐름으로 충분해 구조 복잡도만 증가하므로 기각.

---

## 2026-05-01 | 모바일 safe area 점검은 구현 체크리스트로 문서화한다

- **결정**: 모바일 WebView/웹 화면 작업 시 edge-to-edge와 safe area 점검을 암묵 지식으로 두지 않고, 프로젝트 작업지침(`AGENTS.md`)과 코드 규칙 문서(`docs/CONVENTIONS.md`)에 명시된 체크리스트로 관리한다.
- **이유**: 알림 설정, 고객센터, 구독 관리처럼 구조가 비슷한 화면에서도 공통 safe-area 유틸리티 누락이나 CSS 정의 누락이 반복될 수 있었다. 화면 하나를 고치는 것보다, 새 화면 추가와 리팩터링 때 항상 확인해야 하는 기본 항목으로 문서화하는 편이 회귀 방지에 더 효과적이다.
- **대안**: 개인 기억이나 PR 리뷰에서만 잡기 — 반복 누락 가능성이 높아 기각. 모든 화면에 개별 `pb-*` 규칙만 추가 — 기준이 흩어지고 공통 패턴 회귀를 막기 어려워 기각.

---

## 2026-05-01 | 앱 비로그인 첫 진입은 로그인 화면 대신 랜딩을 먼저 보여준다

- **결정**: Flutter 앱 WebView가 루트(`/`)로 시작할 때 로그인 세션이 없어도 즉시 `/login`으로 리다이렉트하지 않는다. 웹과 동일한 랜딩 화면을 먼저 렌더링하고, 사용자가 CTA를 눌러 `/login`에 진입했을 때만 네이티브 로그인 오버레이를 띄운다.
- **이유**: 앱을 처음 실행한 사용자가 서비스 설명 없이 바로 로그인 화면에 도착하면 제품 맥락이 끊기고 진입 경험이 갑작스럽다. 랜딩을 먼저 보여주면 앱에서도 가치 제안과 흐름을 이해한 뒤 로그인으로 넘어갈 수 있고, 기존 네이티브 로그인 오버레이 구조도 그대로 재사용할 수 있다.
- **대안**: 기존처럼 앱에서 비로그인 사용자를 즉시 `/login`으로 이동 — 구현은 단순하지만 앱 첫 인상이 웹보다 거칠고 설명이 비어 보여 기각.

## 2026-04-30 | 실천 리마인더는 현재 실천 상태와 로컬 날짜를 반영한다

- **결정**: 실천 리마인더는 단순 `on/off + 시간` 예약에 머물지 않고, WebView에서 현재 활성 실천/미체크 상태를 함께 전달해 알림 문구를 개인화하고 활성 실천이 없을 때는 예약을 유지하지 않는다. 또한 실천 로그의 `오늘` 기준은 UTC 문자열이 아니라 사용자의 로컬 날짜를 사용한다.
- **이유**: 매일 같은 고정 문구 알림은 실제 실천 흐름과 쉽게 어긋나고, 한국 시간 기준 밤 시간대에는 UTC 날짜 계산 때문에 오늘 체크 여부가 틀어질 수 있다. 리마인더는 실천 상태와 연결되어야 실제로 다시 앱을 열 동기가 생긴다.
- **대안**: 기존처럼 설정 페이지만 브리지 연동하고 앱에서 고정 문구를 반복 예약 — 구현은 단순하지만 실천이 없는 날에도 알림이 남고, 날짜 경계 버그 때문에 체크 상태와 알림 체감이 어긋나 기각.

## 2026-04-30 | 웹 성능 병목 분석을 위해 공통 단계별 성능 로그를 남긴다

- **결정**: Next.js 웹 앱은 지연 원인 추적이 필요한 인증/대시보드/리포트 경로에 공통 성능 계측 유틸(`app/src/lib/perf.ts`)을 사용한다. 서버 라우트는 단계별 `console.log`와 `Server-Timing` 헤더를 함께 남기고, 클라이언트는 동일한 단계명을 사용해 네트워크 체감시간을 기록한다.
- **이유**: 현재 구조는 Supabase 세션 확인, 여러 DB 조회, OpenAI 리포트 생성이 한 화면 전환 안에 섞여 있어 "Vercel이 느린지", "외부 API가 느린지", "클라이언트 초기화가 느린지"를 로그 없이 분리하기 어렵다. 공통 포맷의 단계별 시간 로그가 있어야 Vercel 함수 로그와 브라우저 콘솔을 바로 대조할 수 있다.
- **대안**: 각 파일에서 임시 `Date.now()` 로그를 흩뿌리기 — 빠르지만 단계명과 출력 형식이 제각각이라 비교가 어렵고 제거/확장이 번거로워 기각. 별도 APM/관측 SaaS 도입 — 현재 문제는 우선 원인 분리가 목적이라 구현과 운영 비용이 과해 보류.

---

## 2026-04-30 | 이벤트/마케팅 수신 동의는 profiles에 서버 저장한다

- **결정**: 알림 설정 화면에서 `이메일 알림` 항목은 제거하고, `이벤트/마케팅 정보 수신`만 유지한다. 이 동의값은 브라우저 `localStorage`가 아니라 `profiles.marketing_opt_in` 컬럼에 저장해 사용자 계정 기준으로 서버 동기화한다. 반면 실천 리마인더 on/off와 시간은 계속 기기 단위 로컬 설정으로 유지한다.
- **이유**: 이메일 알림은 실제 발송 기능이 없어 토글만 노출하는 것이 잘못된 기대를 만든다. 반면 이벤트/마케팅 수신은 계정 단위 동의 이력이 의미가 있으므로 기기 로컬 상태가 아니라 서버 프로필에 저장해야 여러 기기에서 일관되게 해석할 수 있다.
- **대안**: 두 항목 모두 계속 localStorage에만 저장 — 계정 동기화가 되지 않고 운영/법적 동의 이력으로 쓰기 어려워 기각. 두 항목 모두 즉시 제거 — 마케팅 수신 동의 수집 자체가 불가능해져 보류.

---

## 2026-04-30 | Android 앱은 edge-to-edge를 켜고 웹 화면 하단 여백은 공통 safe area 유틸리티로 맞춘다

- **결정**: Flutter Android 쉘은 `SystemUiMode.edgeToEdge`와 투명 status/navigation bar를 사용하고, WebView에는 `--native-safe-area-top/bottom` 값을 함께 주입한다. 웹은 `app-page-scroll`, `app-fixed-cta-scroll`, `app-fixed-cta` 공통 클래스로 일반 스크롤 화면과 하단 고정 CTA 화면의 하단 여백을 일관되게 처리한다.
- **이유**: Android 앱이 시스템 바 영역까지 확장되지 않으면 최신 edge-to-edge 레이아웃과 맞지 않고, 반대로 edge-to-edge만 켜면 고객센터/알림설정/자녀 정보 입력처럼 Navbar만 있거나 하단 고정 버튼이 있는 화면에서 마지막 콘텐츠가 시스템 내비게이션 영역에 붙거나 가려질 수 있다. 네이티브 inset을 웹 공통 유틸리티에 연결하면 화면별 수동 `pb-*` 조정보다 회귀를 줄이기 쉽다.
- **대안**: 각 페이지마다 개별 `pb-*` 값만 늘리기 — 특정 기기에서만 맞고 다른 화면 회귀를 만들기 쉬워 기각. Flutter 쪽에서 WebView 전체를 다시 `SafeArea`로 감싸기 — 웹 내부 fixed CTA, sticky header, 독립 스크롤 영역의 여백 문제를 직접 해결하지 못해 기각.

## 2026-04-30 | 앱 WebView 하단 탭 safe area는 iOS와 Android를 분리 계산한다

- **결정**: Flutter 앱 쉘은 WebView 문서 루트에 현재 네이티브 플랫폼(`ios`/`android`)을 함께 주입하고, 웹 하단 탭바는 플랫폼별 탭바/스크롤 여백 변수를 사용한다. iOS에서는 홈 인디케이터 보정을 유지하고, Android에서도 실제 하단 native inset을 탭 아이콘/라벨/터치 영역의 padding에 반영해 시스템 제스처 영역과 겹치지 않게 한다.
- **이유**: iOS WebView 겹침을 막기 위해 넣은 native safe area 보정이 Android 하단 탭바 높이에도 그대로 합산되면서, 탭바가 필요 이상으로 떠 보이고 마지막 카드가 가려지는 회귀가 발생했다. 플랫폼별로 하단 보정을 분리하면 iOS 안전영역 대응은 유지하면서 Android 원래 밀도와 스크롤 가시성을 복원할 수 있다.
- **대안**: 모든 플랫폼에서 동일한 `max(env(...), native inset)` 유지 — iOS 문제는 해결되지만 Android 탭바 높이 회귀가 계속돼 기각. Flutter에서 WebView 전체를 다시 `SafeArea`로 감싸기 — 웹 내부 fixed/sticky 하단 UI 높이와 스크롤 여백 문제를 직접 제어하지 못해 기각.

## 2026-05-03 | Android 하단 탭은 edge-to-edge 배경을 유지하고 터치 영역만 native inset 위로 올린다

- **결정**: Android 앱의 하단 탭바는 edge-to-edge를 끄거나 WebView 전체를 `SafeArea`로 감싸지 않는다. 탭바 배경은 화면 하단까지 확장하고, 탭 아이콘/라벨/중앙 상담 버튼의 실제 터치 영역은 `--native-safe-area-bottom` 기반 padding으로 시스템 내비게이션/제스처 영역을 피한다.
- **이유**: Android edge-to-edge의 권장 모델은 배경과 divider는 시스템 바 뒤까지 그리되, 텍스트와 버튼 같은 중요한 UI는 inset을 적용하는 방식이다. 기존 Android 탭바 보정은 하단 inset을 `0.25rem`으로 잘라 일부 기기에서 탭 영역이 시스템 제스처 영역과 겹칠 수 있었다.
- **대안**: 하단 탭 화면에서 edge-to-edge 비활성화 — Android 15 이후 기본 edge-to-edge 흐름과 맞지 않고 화면별 동작이 갈라져 기각. 하단 탭바 전체를 safe area 위로 띄우기 — 배경이 시스템 바 영역까지 이어지지 않아 최신 Android 시각 언어와 맞지 않아 기각.

---

## 2026-04-30 | iOS OAuth 콜드 스타트 딥링크는 AppDelegate에서 app_links로 직접 브리지한다

- **결정**: iOS 앱은 Safari/외부 브라우저 OAuth 완료 후 `gijilai://auth/callback`으로 앱이 새로 시작될 수 있는 경로를 위해, `AppDelegate`에서 `launchOptions`의 초기 URL을 `app_links`에 직접 전달한다. `Info.plist`의 `FlutterDeepLinkingEnabled`는 `false`로 유지해 Flutter 기본 딥링크 처리와 충돌하지 않게 한다. Apple OAuth 요청에는 `name email` scope를 명시한다.
- **이유**: 기존 구현은 앱이 이미 살아 있는 상태의 딥링크는 받았지만, 외부 브라우저에서 돌아오며 앱이 콜드 스타트되면 첫 callback URL이 Flutter까지 전달되지 않을 수 있었다. 이 경우 Apple/Google 같은 외부 OAuth만 로딩 상태에서 멈추거나 로그인 완료 후 세션 교환이 누락된다. 초기 URL을 네이티브에서 `app_links`로 직접 브리지하면 앱 시작 시점의 callback 유실을 막을 수 있다.
- **대안**: Flutter 기본 딥링킹에만 의존 — `app_links`와 동일 스킴을 중복 처리하거나 콜드 스타트 callback을 놓칠 수 있어 기각. Apple 로그인만 별도 네이티브 SDK로 전면 교체 — 장기적으로는 가능하지만, 현재 문제의 직접 원인은 딥링크 handoff 안정성이라 수정 범위가 과도해 보류.

---

## 2026-04-29 | iOS 앱은 iPhone only 대상으로 제출한다

- **결정**: iOS `Runner` 타깃의 `TARGETED_DEVICE_FAMILY`를 `1`로 제한하고, `Info.plist`의 `UISupportedInterfaceOrientations~ipad` 선언을 제거한다. App Store Connect 메타데이터와 스크린샷 준비도 iPhone 규격만 유지한다.
- **이유**: 현재 기질아이 앱 UI는 WebView 기반의 휴대폰 폭 레이아웃(`max-w-md` 중심)에 맞춰 설계되어 있어, iPad에서는 실행은 가능해도 태블릿 최적화 경험을 제공하지 못한다. 이번 심사에서는 지원하지 않는 폼팩터를 열어두기보다 iPhone 사용성에 집중하는 편이 안전하다.
- **대안**: iPad 지원을 유지한 채 심사 진행 — iPad 스크린샷과 사용성 검증 범위가 늘고, 중앙 정렬된 휴대폰 UI 그대로 노출될 가능성이 높아 기각. iPad 전용 반응형 레이아웃을 먼저 구현 — 장기적으로 가능하지만 이번 출시 준비 범위를 넘어 보류.

---

## 2026-04-29 | iOS 심사 대응을 위해 Apple 로그인을 앱과 웹에 함께 노출한다

- **결정**: 로그인 수단에 Sign in with Apple을 추가한다. 웹 로그인 페이지와 Flutter 앱의 `/login` 네이티브 오버레이 모두에서 Apple 버튼을 노출하고, Apple 로그인은 기존 Supabase OAuth + `gijilai://auth/callback` 딥링크 handoff 경로를 재사용한다. 카카오는 기존처럼 Kakao SDK 앱투앱 + `/auth/native-session` 경로를 우선 유지한다.
- **이유**: 현재 앱은 Kakao/Google 같은 제3자 로그인을 주 계정 인증에 사용하므로 App Store Review Guidelines 4.8 리스크가 있다. 기존 OAuth/딥링크 구조를 재사용하면 native Apple SDK와 entitlement를 새로 붙이지 않고도 앱과 웹 양쪽에서 일관된 Apple 로그인 동선을 빠르게 제공할 수 있다.
- **대안**: Apple 로그인을 웹에만 추가 — iOS 앱의 네이티브 로그인 오버레이에는 Apple 선택지가 보이지 않아 심사 대응이 약해 기각. Flutter에 Sign in with Apple 네이티브 SDK를 새로 붙여 ID 토큰을 `/auth/native-session`으로 교환 — 장기적으로 가능하지만 외부 설정과 entitlement 범위가 커 이번 심사 대응 범위로는 과하므로 보류.

---

## 2026-04-29 | 앱 WebView safe area는 웹 CSS와 Flutter native inset을 함께 사용한다

- **결정**: 홈을 포함한 앱 WebView 화면의 상단/하단 고정 UI는 CSS `env(safe-area-inset-top/bottom)`만 단독으로 쓰지 않고, Flutter 쉘이 WebView에 주입하는 `--native-safe-area-top`, `--native-safe-area-bottom` 값을 함께 사용한다. Next.js viewport에는 `viewport-fit=cover`를 명시한다.
- **이유**: iOS WebView에서는 기기/상태에 따라 CSS safe area env 값이 0으로 떨어져 헤더와 탭바가 상태바, 홈 인디케이터와 겹칠 수 있다. 웹이 브라우저 표준 inset과 앱 쉘이 측정한 native inset 둘 다 읽으면 Safari/웹뷰 간 차이를 흡수하면서 레이아웃을 안정화할 수 있다.
- **대안**: CSS `env(...)`만 유지 — iOS 앱에서 상단 액션바 겹침이 재발할 수 있어 기각. Flutter `SafeArea`로 WebView 전체를 감싸기 — 웹 내부 sticky/fixed UI의 상하 inset 정보를 직접 해결하지 못해 기각.

---

## 2026-04-29 | iOS Fastlane은 로컬 App Store Connect API 키를 자동 탐색한다

- **결정**: `gijilai_app/fastlane/Fastfile`의 `deploy_testflight`와 `deploy_appstore` lane은 `APP_STORE_CONNECT_API_KEY_PATH`, `/tmp/gijilai_app_store_connect_api_key.json`, `nodtry` 프로젝트의 공유 키 설정 순으로 App Store Connect API 키를 자동 탐색해 사용한다. iOS 스크린샷 디렉터리가 비어 있으면 `deploy_appstore`는 스크린샷 업로드를 건너뛴다.
- **이유**: 기존 저장소는 iOS 업로드 문서는 있었지만 lane 자체에는 인증 연결이 없어, 같은 개발 머신에서도 매번 수동 명령 조합을 다시 수행해야 했다. 재사용 가능한 로컬 키 경로를 Fastlane이 직접 인식하게 만들면 TestFlight/App Store 제출 준비 절차가 저장소 기준으로 재현 가능해진다. 빈 스크린샷 디렉터리 때문에 제출 lane이 불필요하게 깨지는 것도 방지해야 했다.
- **대안**: API 키 경로를 매번 환경변수로만 강제 — 문서 의존성이 커지고 같은 머신의 재사용성이 떨어져 기각. 저장소에 키 JSON을 커밋 — 비밀정보 관리 원칙에 어긋나므로 기각. 스크린샷이 없으면 무조건 실패 — 기존 App Store Connect 자산을 유지하는 제출까지 막게 되어 운영성이 떨어져 기각.

---

## 2026-05-05 | Android 프로덕션 배포는 내부 테스트 트랙도 함께 유지한다

- **결정**: Android 기본 프로덕션 배포(`deploy_production`, `release_production`, `scripts/deploy_android_production.sh`)는 `pubspec.yaml` build number를 한 번만 증가시키고 AAB를 한 번 빌드한 뒤, Google Play `internal` 트랙에 업로드하고 같은 versionCode를 `production` 트랙에도 릴리스로 설정한다. 프로덕션 트랙에만 직접 올리는 예외용 lane은 `deploy_production_only`로 분리한다.
- **이유**: Google Play 프로덕션 검토/반영은 지연될 수 있으므로, 배포 직후 실제 스토어 배포 산출물을 내부 테스트 트랙에서 바로 설치 확인할 수 있어야 한다. 같은 AAB/versionCode를 사용하면 내부 테스트와 프로덕션 후보가 갈라지지 않는다.
- **대안**: 내부 테스트와 프로덕션을 각각 별도 build number로 업로드 — 테스트한 빌드와 프로덕션 후보가 달라져 검증 신뢰가 떨어져 기각. 내부 테스트 업로드 후 프로덕션 수동 설정 — 배포 절차가 두 단계로 남아 누락 가능성이 있어 기각. 프로덕션만 업로드 — 검토 지연 중 즉시 설치 검증 경로가 없어 기각.

## 2026-04-29 | Android 배포는 build number 기준 출시노트를 자동 생성한다

- **결정**: Android Fastlane 배포(`deploy_internal`, `deploy_production`, `deploy_production_only`)는 `pubspec.yaml` build number를 증가시킨 직후, `fastlane/release_notes/android/ko-KR.txt`와 `en-US.txt`를 읽어 Play Console 표준 경로인 `fastlane/metadata/android/<locale>/changelogs/<versionCode>.txt`를 자동 생성한다. 프로덕션 배포 진입점은 `release_production` lane과 `scripts/deploy_android_production.sh`로 제공한다.
- **이유**: 프로덕션 배포가 가능해진 시점부터 내부 테스트와 운영 배포 모두에서 build number와 출시노트 파일명이 어긋나지 않아야 한다. 출시노트 원본을 언어별 단일 파일로 두고 배포 시점에 버전별 changelog를 렌더링하면, 운영자가 한글/영문 문구를 한 곳에서 수정하면서도 Play Console 업로드 규칙을 자동으로 맞출 수 있다.
- **대안**: 배포 때마다 `metadata/android/.../changelogs/<versionCode>.txt`를 수동 생성 — build number와 파일명을 자주 맞춰야 해 실수 가능성이 높아 기각. 릴리즈 노트를 Fastfile 코드에 직접 하드코딩 — 문구 수정 때 코드 변경 범위가 커지고 운영성이 떨어져 기각.

---

## 2026-04-29 | 앱 구독 가격은 한국 12,000원 / 미국 9.99달러로 운영

- **결정**: 앱 구독 기준 가격을 한국 `₩12,000/월`, 미국 `USD $9.99/월`로 운영한다. App Store Connect와 코드 상수, 운영 문서를 이 기준으로 통일한다.
- **이유**: 한국은 기존 웹 가격과 맞춰 사용자 혼선을 줄이고, 미국은 App Store 자동 환산 시 한국 가격이 과도하게 올라가는 문제를 피하면서 진입 장벽을 낮추기 위해 `USD 9.99`를 기준가로 채택한다.
- **대안**: `USD 11.99` 유지 — 한국 storefront를 별도 수동 조정해야 하고, 문서/코드/스토어 가격 정합성을 유지하기 번거로워 기각.

---

## 2026-04-29 | 스토어 재구독 CTA는 목적 중심 문구로 표기

- **결정**: 해지 예약 상태에서 `APPLE_IAP`/`GOOGLE_PLAY` 구독 재개 CTA 라벨을 `스토어 열기`에서 `다시 구독하기`로 변경한다. 클릭 동작은 그대로 각 스토어 구독 관리 화면 이동을 유지한다.
- **이유**: `스토어 열기`는 사용자가 하려는 일보다 이동 수단을 설명하는 문구라, 재개 맥락에서 왜 갑자기 스토어를 여는지 혼란을 준다. 해지 예약 상태의 1차 CTA는 사용 목적을 직접 드러내야 한다.
- **대안**: 기존 `스토어 열기` 유지 — 실제 이동 대상은 맞지만, 재구독 의도가 버튼 문구에 드러나지 않아 해지 예약 복구 UX가 어색해 기각.

---

## 2026-04-28 | 해지 예약 상태에서 결제 출처별 재개 버튼을 항상 노출

- **결정**: 구독이 해지 예약(`cancelled_at` 존재) 상태일 때 구독 관리(`/settings/subscription`)와 요금제(`/pricing`) 화면 모두에서 재개 동선을 버튼으로 노출한다. `PORTONE`은 앱 내 `구독 계속하기` 버튼으로 `/api/payment/reactivate-subscription`을 호출하고, `APPLE_IAP`/`GOOGLE_PLAY`는 스토어 구독 관리 화면으로 이동시키는 재개 CTA를 노출한다.
- **이유**: 기존 UI는 PORTONE에만 재개 버튼이 있고 스토어 구독은 안내 문구만 보여 사용자 입장에서 "다시 구독을 이어갈 수 있는 버튼이 없다"는 혼란이 발생했다. 해지 예약 상태의 핵심 작업은 결제 출처에 맞는 재개 경로 진입이므로, 안내 텍스트보다 명시적 CTA 버튼이 필요하다.
- **대안**: 스토어 구독은 문구 안내만 유지 — 재개 가능 경로를 사용자가 직접 찾아야 해 전환/복구 UX가 떨어져 기각.

---

## 2026-04-23 | 월 구독 환불은 유료 기능 사용 이력 기준으로 판단

- **결정**: 웹 월 구독 환불 정책을 7일 이내 유료 기능 미사용 전액 환불과 결제 주기 내 미사용 일자 부분 환불로 운영한다. 유료 기능 사용 이력은 `subscription_usage_events`에 서버 기준으로 기록하고, AI 상담 질문/처방 생성과 구독자 전용 실천 기록 전체 열람을 사용 이벤트로 본다. 부분 환불은 실제 결제금액을 기준으로 `남은 미사용 일수 / 해당 결제 주기의 총 일수`를 곱해 산정하고, 환불 처리 후 유료 기능 접근은 종료한다.
- **이유**: 토스페이 간편결제 계약 검토에서 구독권 상품의 미사용 일자에 대한 조건부 환불 규정 보완이 요구되었다. "미사용"을 단순 접속 여부가 아니라 결제 이후 유료 기능 사용 여부로 정의해야 고객 응대와 환불 판단을 일관되게 처리할 수 있다.
- **대안**: 7일 이후 환불 불가 유지 — 구독권 부분 환불 기준이 없어 간편결제 심사 요구사항을 충족하기 어렵다. 클라이언트 화면 상태만으로 판단 — 사용 이력 조작·누락 가능성이 있어 환불 근거로 약하다.

---

## 2026-04-22 | 앱 WebView JavaScript 다이얼로그를 Flutter 다이얼로그로 처리

- **결정**: Flutter 앱 WebView에서 웹 JavaScript `alert`, `confirm`, `prompt` 호출을 가로채 플랫폼 기본 시스템 다이얼로그 대신 앱 테마의 Flutter 다이얼로그로 렌더링한다.
- **이유**: WebView 기본 JavaScript 다이얼로그는 앱 UI와 분리된 시스템 다이얼로그처럼 보여 사용성이 떨어지고, 일부 기기에서 앱 화면과 어울리지 않게 표시된다. WebView 컨트롤러의 JavaScript dialog 콜백을 사용하면 기존 웹의 동기 `confirm()` 흐름을 바꾸지 않고도 앱다운 다이얼로그를 제공할 수 있다.
- **대안**: 웹 전역에서 `window.alert/confirm`을 커스텀 모달로 대체 — `confirm()`은 동기 반환값을 요구하는 기존 호출부가 많아 비동기 React 모달로 치환하면 제어 흐름 변경 범위가 커지므로 기각.

---

## 2026-04-17 | 리포트와 상담 결과 하단에 의료 면책 안내 노출

- **결정**: 리포트 결과 하단 CTA 영역과 상담 결과의 격려 문구 하단에 의료 관련 안내를 고정 노출한다. 문구는 결과가 양육 참고 자료이며 의학적·심리학적 진단, 치료, 전문 상담을 대체하지 않는다는 점과 건강·발달 우려 시 전문기관 상담을 권장한다는 내용을 포함한다.
- **이유**: 서비스가 기질 분석, AI 상담, 마음 처방전 같은 표현을 사용하므로 사용자가 의료·심리 진단처럼 받아들일 가능성이 있다. 접수 단계의 면책 동의만으로는 실제 결과를 소비하는 순간의 오해를 충분히 줄이기 어렵다.
- **대안**: 결과 화면마다 별도 팝업 또는 재동의 요구 — 핵심 사용 흐름을 과도하게 방해하므로 하단 안내 문구로 처리.

---

## 2026-04-16 | 실천 리마인더는 앱 로컬 알림으로 제공

- **결정**: 실천 탭에 다음 상담을 위한 실천 기록 요약 패널과 알림 설정 진입점을 추가하고, 알림 설정 페이지에서 실천 리마인더 사용 여부와 시간을 저장한다. 웹 브라우저에서는 `localStorage`에만 저장하고, Flutter 앱에서는 WebView `ReminderBridge`를 통해 네이티브 로컬 알림을 매일 반복 예약한다.
- **이유**: 실천 리마인더는 사용자별 서버 이벤트가 아니라 기기에서 정해진 시간에 반복되는 개인 알림이다. 서버 푸시보다 로컬 알림이 단순하고, 푸시 토큰/예약 워커/서버 저장소 없이도 앱 사용 맥락에 맞는 리마인더를 제공할 수 있다.
- **대안**: 서버 푸시 인프라 구현 — 원격 캠페인이나 서버 이벤트 알림에는 필요하지만, 매일 같은 시간의 실천 리마인더에는 과도하므로 기각.

---

## 2026-04-16 | 긴 글 입력에 브라우저 음성 입력 버튼 추가

- **결정**: 상담 고민 입력, 문진 주관식 답변, 실천 회고 textarea에 공통 `VoiceInputButton`을 붙이고, 모바일/터치 입력 환경에서만 브라우저 Web Speech API를 사용한다.
- **이유**: 사용자가 긴 육아 상황을 모바일에서 타이핑하기 어렵다. 별도 서버 STT나 API 키 없이 브라우저 마이크 권한만으로 입력 보조를 제공할 수 있고, 기존 텍스트 입력/글자 수 제한을 유지할 수 있다.
- **대안**: 서버 기반 STT API 연동 — 정확도와 호환성은 높일 수 있지만 녹음 업로드, 개인정보 처리, 비용, 지연시간이 생겨 현재 범위에서는 과도하므로 보류.

## 2026-05-05 | Android 앱 음성 입력은 네이티브 bridge로 보완한다

- **결정**: Android Flutter WebView 앱은 `VoiceInputBridge`와 `window.__nativeCapabilities.voiceInput`을 제공하고, 웹 `VoiceInputButton`은 이 capability가 확인되면 Web Speech API보다 Android `RecognizerIntent` 기반 네이티브 speech-to-text를 우선 사용한다. 브라우저/미지원 앱에서는 기존 Web Speech API와 키보드 입력 fallback을 유지한다.
- **이유**: Android WebView에서는 브라우저 Web Speech API 노출과 권한 동작이 Chrome 브라우저와 다를 수 있어, manifest/runtime microphone 권한이 있어도 앱 안 음성 입력이 동작하지 않는 환경이 생긴다. 앱 셸이 네이티브 STT를 제공하면 로컬 HTTP WebView QA와 운영 앱 모두에서 같은 입력 컴포넌트를 유지하면서 Android 음성 입력을 복구할 수 있다.
- **대안**: Web Speech API와 `getUserMedia` preflight만 유지 — Android WebView 호환성 문제를 해결하지 못해 기각. 서버 STT 업로드로 전환 — 개인정보, 비용, 지연시간과 녹음 파일 처리 범위가 커져 현재 입력 보조 용도에는 과도하므로 기각.

## 2026-04-13 | 웹 모듈 구조와 의존 방향은 별도 Web Architecture 문서로 관리

- **결정**: 시스템 전체 구조 문서(`ARCHITECTURE.md`)와 별도로, Next.js 웹 앱 전용 모듈 구조/의존 방향/상태 관리 기준을 `WEB_ARCHITECTURE.md`에 분리해 관리한다.
- **이유**: 기존 `ARCHITECTURE.md`는 시스템 개요와 컴포넌트 책임 설명에는 충분하지만, 실제 웹 개발 중 자주 필요한 "어디에 무엇을 둘 것인가", "페이지와 lib의 경계는 어디인가", "store와 local state를 어떻게 나눌 것인가" 같은 규칙까지 담기에는 목적이 너무 넓다. 웹 전용 문서를 따로 두는 편이 기능 추가와 리팩터링 판단 기준으로 더 실용적이다.
- **대안**: (1) `ARCHITECTURE.md`에 계속 누적 — 시스템 설명과 웹 구현 규칙이 섞여 문서 성격이 흐려짐 (2) `CONVENTIONS.md`에 포함 — 코드 스타일과 모듈 책임이 뒤섞여 참조성이 떨어져 기각

## 2026-04-13 | ESLint는 생성 산출물을 제외하고 기존 엄격 규칙은 경고로 관리

- **결정**: `app`의 ESLint는 `.next`와 `src/.next` 같은 생성 산출물을 검사 대상에서 제외한다. 기존 코드베이스 전반에 넓게 퍼져 있는 `no-explicit-any`, React Compiler 수동 메모이제이션 경고는 당장 빌드를 막지 않도록 warning으로 관리하고, 문법 오류와 런타임 리스크성 규칙은 계속 error로 유지한다.
- **이유**: 생성물까지 검사하면 실제 코드 품질 신호가 완전히 묻혀서 린트 결과를 신뢰할 수 없다. 또한 현재 코드베이스는 `any`와 일부 수동 메모이제이션 패턴을 이미 광범위하게 사용하고 있어, 이를 한 번에 error로 강제하면 유지보수 속도만 떨어지고 핵심 결함 탐지가 어려워진다.
- **대안**: (1) 기존 lint 규칙 유지 — 경고 노이즈가 과도해 실질적인 품질 게이트로 기능하지 못함 (2) 엄격 규칙을 전면 비활성화 — 문제 탐지력이 너무 약해져 기각

## 2026-04-13 | 상담 문진 해설은 과잉 기질 매핑 대신 근거 중심의 가능성형 해석으로 생성

- **결정**: 상담 처방전의 `questionAnalysis` 프롬프트를 수정해, 답변의 구체 장면을 먼저 짚고 그 다음에 기질 또는 발달적 가능성을 연결하는 방식으로 생성한다. 답변 하나당 기질 포인트는 1개만 허용하고, 단정형 표현보다 가능성형 표현을 우선한다.
- **이유**: 기존 해설은 `표현력`, `사회적 민감성`, `인내력` 같은 추상 라벨을 한 답변에 여러 개 붙이며 근거 없이 성급하게 해석하는 경향이 있었다. 읽기에는 부드럽지만 실제 상담 분석으로서는 설득력이 약하고, 사용자가 "끼워 맞춘다"는 인상을 받을 수 있었다.
- **대안**: (1) 기존 프롬프트 유지 — 문장이 그럴듯해 보여도 해석 신뢰도가 낮음 (2) 기질 용어 사용 자체를 최소화 — 서비스의 기질 기반 차별점이 약해져 기각

## 2026-04-12 | Flutter 모바일 쉘에 Firebase Crashlytics를 기본 연결

- **결정**: `gijilai_app/` Flutter 쉘은 Firebase Crashlytics를 기본 활성화하고, 앱 시작 예외·Flutter 프레임워크 예외·플랫폼 비동기 예외·주요 WebView/IAP 비정상 흐름을 Crashlytics에 기록한다. Android는 Gradle Crashlytics 플러그인을 적용해 릴리스 심볼을 업로드한다
- **이유**: 현재 앱은 WebView + 인앱결제 + 로컬 알림 권한을 동시에 다루므로, 스토어 배포 후 장애 재현이 어렵다. 단순 콘솔 로그만으로는 실제 기기 오류 원인 파악이 불가능해 운영 관측성이 필요
- **대안**: (1) `debugPrint` 로그만 유지 — 실기기 릴리스 장애 추적이 어려움 (2) 별도 자체 에러 수집 API 구축 — Firebase를 이미 사용 중이어서 중복 투자라 기각

---

## 2026-04-12 | 앱 IAP는 스토어 서버 알림으로 후속 상태를 동기화

- **결정**: 앱 인앱결제는 최초 구매 시 클라이언트 검증 API(`/api/payment/iap`)로 구독을 생성하고, 이후 갱신/해지/환불/만료는 Apple App Store Server Notifications V2와 Google RTDN으로 서버에서 `subscriptions` 상태를 동기화
- **이유**: 최초 구매 검증만으로는 갱신 실패, 환불, 해지 예약, 만료를 서버가 정확히 알 수 없음. 실제 과금 운영과 앱 심사 대응을 위해 스토어 서버 이벤트 기준의 상태 동기화가 필요
- **대안**: (1) 최초 구매 검증만 유지 — 시간이 지나면 구독 상태가 틀어짐 (2) 주기적 폴링만 사용 — 지연과 호출 비용이 커서 기각

---

## 2026-04-03 | 인앱결제(IAP) Apple/Google 연동 구현

- **결정**: Flutter 앱에서 `in_app_purchase` 패키지로 Apple IAP + Google Play Billing 연동. 서버에서 각 플랫폼 영수증 검증 후 기존 `subscriptions` 테이블에 `source` 구분하여 저장
- **이유**: Apple/Google 정책상 앱 내에서 웹 결제(PortOne) 사용 불가. 앱스토어 출시를 위해 네이티브 IAP 필수
- **대안**: 웹 결제 링크로 외부 브라우저 유도 — Apple 심사 리젝 위험이 높아 기각

---

## 2026-04-02 | 연 구독(89,000원) 폐지, 월 구독 전용으로 전환

- **결정**: 연 구독(₩89,000/$89.99) 옵션을 제거하고 월 구독(₩12,000/$11.99) 전용으로 운영
- **이유**: 연 구독은 전자상거래법상 중도 환불 산식 의무, 갱신 사전 고지 의무 등 법적·운영적 부담이 큼. 초기 단계에서 환불 처리/약관 관리 비용이 연 구독으로 얻는 캐시플로우보다 큼
- **대안**: 연 구독 유지 + 환불 산식/갱신 알림 구현 — 현 단계에서 과잉 투자로 기각

---

## 2026-04-02 | AI 상담 월 30건 초과 시 gpt-4o-mini 폴백

- **결정**: 구독자 월 상담 30건까지 gpt-4o, 초과 시 gpt-4o-mini로 자동 전환. 상담 플로우 전체(질문 생성, 처방전)에 동일 적용
- **이유**: gpt-4o 건당 ~₩165, 무제한 시 월 73건 이상이면 적자. 30건 기준 gpt-4o 비용 ~₩4,950으로 마진 확보하면서 대부분의 사용자에게는 프리미엄 품질 유지
- **대안**: (1) 월 상담 횟수 하드캡 — UX 저하 큼 (2) 현행 무제한 유지 — 헤비유저 적자 리스크

---

## 2026-04-02 | KG 이니시스 → NHN KCP + 토스페이 + 네이버페이 체제로 전환

- **결정**: KG 이니시스를 제거하고, 한국 결제수단을 NHN KCP(카드) + 토스페이(간편결제) + 네이버페이(간편결제)로 전환. Stripe(글로벌)는 유지
- **이유**: 월구독 전용이므로 NHN KCP 빌링키 발급 가능. 카드결제(KCP) + 간편결제(토스/네이버) 조합으로 결제 커버리지 극대화
- **대안**: 간편결제만 운영 — 카드 직접결제 선호 사용자 이탈 우려로 기각

---

## 2026-04-02 | 한국 카드결제 PG를 NHN KCP → KG 이니시스로 변경

- **결정**: 한국 카드결제 PG를 NHN KCP에서 KG 이니시스로 교체. 네이버페이(간편결제)와 Stripe(글로벌)는 유지
- **이유**: KG 이니시스로 PG사 변경 결정
- **대안**: NHN KCP 유지 — 기각

---

## 2026-04-01 | 건별 결제(990원) 폐지, 구독 전용 모델로 전환

- **결정**: 건별 결제(프리미엄 리포트 1회 990원)를 폐지하고 구독제(월 12,000원 / 연 89,000원) 전용으로 전환
- **이유**: 건별 결제는 객단가가 낮아 수익성이 부족하고, 구독 전환을 저해하는 대체재 역할을 함. 구독 전용으로 단순화하여 반복 수익 구조에 집중
- **대안**: 건별 가격 인상(1,900원~) — 가격 저항으로 기각

---

## 2026-03-30 | 한국 PG를 토스페이먼츠 → NHN KCP + 네이버페이로 변경

- **결정**: 한국 결제 PG를 토스페이먼츠에서 NHN KCP(카드)와 네이버페이(간편결제) 이원 체제로 전환. 사용자가 카드/네이버페이 중 결제수단 선택 가능
- **이유**: NHN KCP는 국내 가맹점 수수료 경쟁력이 높고, 네이버페이는 국내 간편결제 시장점유율 1위로 전환율 향상 기대
- **대안**: 토스페이먼츠 유지하면서 네이버페이만 추가 — KCP 수수료 이점을 살리지 못하므로 기각

---

## 2026-03-25 | 결제 시스템 포트원 V2 전환 + 구독제 도입

- **결정**: Stripe 직접 연동 + 포트원 V1 혼재 → 포트원 V2로 통합. 구독제(월 12,000원 / 연 89,000원) 전용 모델 도입 (건별 결제 폐지)
- **이유**: (1) 반복 수익 구조 필요 (2) 글로벌 확장 시 포트원 V2가 Stripe을 PG사로 지원하므로 하나의 SDK로 국내/해외 처리 가능 (3) 포트원 V1 가맹점 ID가 플레이스홀더 상태로 실질적 미사용
- **대안**: Stripe 직접 연동 유지 (글로벌) + 토스페이먼츠 직접 연동 (국내) — 이중 구현 비용이 높아 기각

---

## 2026-03-24 | 생일 입력 연도 제한 제거

- **결정**: DatePicker 연도 범위를 16년(2011~2026)에서 100년(1926~2026)으로 확장
- **이유**: 서비스 대상을 소아로 한정할 필요 없음. 사용자가 자유롭게 선택할 수 있어야 함
- **대안**: 20년으로 소폭 확장 — 불필요한 제한이 남으므로 기각

## 2026-03-24 | ADR을 단일 파일로 관리

- **결정**: `docs/ADR.md` 단일 파일에 시간순으로 기록
- **이유**: 프로젝트 규모 대비 파일별 ADR은 과도. 한 파일에서 히스토리를 빠르게 훑을 수 있음
- **대안**: `docs/adr/NNNN-제목.md` 개별 파일 방식 — 현 규모에서는 불필요

## 2026-03-24 | 상담 결과 CTA를 '바로 실천하기' + '내일 꼭 해볼게요'로 변경

- **결정**: 상담 결과 화면의 '홈으로 돌아가기' 단일 버튼을 두 가지 CTA로 교체. '바로 실천하기'는 관찰 일지로, '내일 꼭 해볼게요'는 홈으로 이동
- **이유**: 홈으로 바로 보내면 상담이 끝나버리는 느낌. 실천으로 연결되는 흐름이 필요
- **대안**: 단순 문구 변경만 — 행동 유도가 약하므로 기각

## 2026-03-24 | 상담 세션 모델 도입 — 동시 3세션, 실천 최대 5개

- **결정**: 상담을 일회성이 아닌 고민별 세션(스레드)으로 관리. 동시 활성 세션 최대 3개, 세션 내 추가 상담으로 실천 항목 업데이트. 전체 활성 실천 항목 최대 5개
- **이유**: 실천 기간 중 새 상담이 쌓이면 실천 항목이 발산됨. 세션으로 묶고 개수를 제한해야 관리 가능
- **대안**: (1) 무제한 허용 — 항목 폭발 (2) 새 상담이 이전 실천을 대체 — 진행 중인 실천이 날아감 (3) 실천 등록을 선택제로 — 세션 개념 없이는 맥락이 끊김
## 2026-04-12 | 웹 기본 퍼널 통계를 Firebase Analytics로 수집

### 결정
- Next.js 웹 앱에 Firebase에 연결된 Measurement ID 기반 이벤트 추적을 추가한다.
- 페이지 이동은 공통 `page_view`로 자동 수집하고, 랜딩 CTA/로그인/접수/설문/리포트/결제/상담은 별도 이벤트로 남긴다.

### 이유
- 현재 모바일 쉘에는 Firebase가 연결되어 있지만 웹 퍼널 데이터가 비어 있어 전환율과 개선 기준선을 보기 어렵다.
- A/B 테스트를 하기 전에 기준선 이벤트가 먼저 있어야 하며, 별도 사내 대시보드 없이 Firebase/GA 콘솔에서 즉시 확인할 수 있는 구성이 필요했다.
- 환경변수가 없는 개발 환경에서도 안전하게 동작하도록 no-op 구조가 필요했다.

### 대안
- Supabase에 자체 이벤트 테이블을 만들어 직접 집계할 수 있다.
- PostHog, Amplitude 같은 별도 분석 도구를 도입할 수 있다.
- Firebase JS SDK를 직접 설치해 웹 앱을 초기화할 수 있으나, 현재는 Measurement ID 기반 추적이 더 단순하고 배포 부담이 적다.

## 2026-04-15 | 한국 웹 카드 PG를 KCP와 KG 이니시스 병행 지원으로 조정

- **결정**: 한국 웹 결제에서 카드 결제 PG를 NHN KCP 단일 노출에서 NHN KCP와 KG 이니시스를 병행 선택할 수 있게 변경
- **이유**: 카드 PG별 테스트/운영 승인 경로와 빌링키 동작 차이를 직접 비교해야 했고, 네이버페이 실패 이슈와 카드 PG 이슈를 분리해서 검증할 필요가 있었음
- **대안**: KCP 단일 유지 또는 KG 이니시스 단일 교체 — 둘 다 비교 검증이 어려워 기각

## 2026-04-16 | KG 이니시스 빌링키 발급에 휴대폰 번호만 추가 수집

- **결정**: KG 이니시스 카드 선택 후 구독 버튼을 누른 시점에 다이얼로그로 구매자 휴대폰 번호를 입력받고, PortOne 빌링키 발급창 호출의 `customer.phoneNumber`로 전달한다. 별도 본인인증은 붙이지 않고, 입력값은 DB에 저장하지 않는다.
- **이유**: KG 이니시스 V2 카드 빌링키 발급은 구매자 이름/휴대폰 번호가 필수 파라미터다. 현재 오류는 본인인증 부재가 아니라 결제창 호출 파라미터 누락이므로, 구독 전환 마찰을 최소화하는 입력 보완이 적절하다.
- **대안**: PASS 본인인증 추가 — 결제창 호출 오류 해결 범위를 넘어선 인증 정책 변경이고 가입/구독 전환 마찰이 커서 보류

## 2026-04-16 | 결제 이력에는 마스킹된 결제수단만 표시

- **결정**: 결제 성공 시 PortOne 응답의 PG/결제수단 정보와 마스킹 카드번호만 `payments`에 저장하고, 구독 관리의 결제 이력에 표시한다. 카드 전체 번호, CVC, 유효기간은 저장하지 않는다.
- **이유**: 사용자는 결제 이력에서 어떤 수단으로 결제됐는지 확인해야 하지만, 민감 카드정보를 직접 저장하면 보안/컴플라이언스 부담이 커진다. PortOne이 반환한 마스킹 정보만 보관하면 사용자 확인성과 데이터 최소화를 동시에 만족한다.
- **대안**: 결제수단 미표시 — 사용자가 결제 이력을 신뢰하기 어렵다. 카드정보 직접 저장 — 보안 위험이 커서 기각

## 2026-04-17 | iOS 배포 API Key는 문서화하고 키 본문은 저장하지 않음

- **결정**: 다른 프로젝트에서 쓰는 App Store Connect API Key 재사용 절차를 `docs/operations/deployment/ios/`에 문서화하되, `.p8` 키와 키 본문이 포함된 JSON은 저장소에 커밋하지 않는다.
- **이유**: App Store Connect API Key는 같은 Apple Developer 팀 안에서 재사용 가능하지만, 키 파일 자체는 장기 권한을 가진 민감정보다. 경로와 임시 JSON 생성 절차만 남기면 다음 배포 때 재사용성이 생기고 보안 위험은 줄일 수 있다.
- **대안**: 기질아이 저장소에 `.p8` 복사 — 유출 위험 때문에 기각. 매번 App Store Connect에서 새 키 발급 — 운영 비용이 커서 기각

## 2026-04-17 | 토스페이·네이버페이 결제 UI 미노출

- **결정**: 토스페이와 네이버페이는 심사 거부 상태이므로 웹 결제수단 선택 UI에서 제거하고, 한국 웹 결제는 NHN KCP(계약 진행 중)와 KG 이니시스 카드 선택지만 노출한다.
- **이유**: 사용자가 승인되지 않은 간편결제 수단을 선택하면 결제 실패 또는 운영 혼선을 만든다. 심사 상태와 실제 노출 UI를 일치시켜야 한다.
- **대안**: 비활성 버튼으로 표시 — 사용자에게 불필요한 기대를 주므로 기각. 백엔드만 차단 — UI 혼선을 막지 못해 기각

## 2026-04-17 | 구독 결제 라우팅을 사용자에게 숨김

- **결정**: 구독 페이지에서 PG사/카드/인앱결제 선택 UI를 제거하고, 사용자는 `구독 시작`만 누르게 한다. 앱은 Apple/Google IAP로, 웹은 내부 기본 PG(KG 이니시스, KCP 계약 완료 후 전환 가능)로 자동 라우팅한다.
- **이유**: 사용자는 NHN KCP, KG 이니시스, 카드결제, 인앱결제 같은 결제 인프라를 선택할 이유가 없다. 결제수단 선택 UI는 전환 마찰과 혼란만 만든다.
- **대안**: PG사 선택 유지 — 운영 디테일을 사용자에게 노출하므로 기각. 카드/인앱결제 선택 표시 — 플랫폼별 필수 결제 정책과 충돌할 수 있어 기각

## 2026-04-25 | 포트원 웹훅 시크릿 이중화 검증 지원
- **결정**: 포트원 V2 웹훅 검증은 `PORTONE_WEBHOOK_SECRET` 단일 값 외에 `PORTONE_WEBHOOK_SECRET_SECONDARY` 및 `PORTONE_WEBHOOK_SECRETS`(comma-separated)를 함께 읽어 최대 2개 이상의 활성 시크릿을 순차 검증한다. 검증 실패 시에는 헤더 존재 여부와 각 시크릿 검증 실패 사유를 서버 로그에 남긴다.
- **이유**: 포트원은 웹훅 시크릿을 환경별로 최대 2개까지 동시에 발급할 수 있고, 운영 중 시크릿 교체 시 이전 시크릿과 신규 시크릿이 공존할 수 있다. 단일 시크릿만 검증하면 시크릿 교체 직후 `401`로 웹훅 재시도가 반복될 수 있어 운영 안정성이 떨어진다.
- **대안**: 단일 시크릿만 유지 — 무중단 교체와 장애 분석이 어렵다. 시크릿 검증 자체를 비활성화 — 위조 웹훅 방어를 포기하게 되어 기각.

## 2026-04-17 | 구독 유도는 핵심 가치 순간 3곳에 추가

- **결정**: 비구독자에게 홈 체험 종료 임박 카드, 리포트 하단 프리미엄 CTA, 상담 결과 직후 실천 연결 CTA를 노출한다.
- **이유**: 기존 구독 유도는 헤더 뱃지와 기능 차단 순간에 치우쳐 있어, 사용자가 가치를 느낀 직후의 전환 경로가 약했다. 리포트와 상담 결과는 서비스 가치가 가장 분명한 순간이며, 홈 D-2/D-1 카드는 체험 종료 전에 연속성을 안내할 수 있다.
- **대안**: 모든 화면에 구독 배너 상시 노출 — 육아 앱 신뢰를 해칠 수 있어 기각. 기존 게이트만 유지 — 전환 경로가 부족해 기각

## 2026-04-17 | 앱 공유는 Flutter ShareBridge로 처리

- **결정**: `/share` 화면의 `다른 앱` 버튼은 모바일 브라우저 또는 앱 WebView에서만 노출하고, 앱 WebView에서는 Flutter `ShareBridge`가 OS 공유 시트를 직접 호출한다.
- **이유**: 데스크톱에서는 다른 앱 공유 버튼이 기대와 다르게 동작할 수 있고, 앱 WebView에서는 브라우저 Web Share API 지원이 안정적이지 않다. 앱 환경은 네이티브 공유 플러그인을 사용하는 편이 사용자 기대와 플랫폼 동작에 맞다.
- **대안**: 항상 `navigator.share` 사용 — 앱 WebView에서 동작 보장이 약해 기각. 버튼을 전부 링크 복사로 대체 — 모바일에서 자연스러운 앱 공유 흐름을 잃어 기각

## 2026-04-17 | 앱 소셜 로그인은 네이티브 화면과 딥링크로 처리

- **결정**: Flutter 앱 WebView가 `/login`에 도달하면 WebView 위에 네이티브 로그인 화면을 오버레이한다. 카카오 버튼은 Kakao Flutter SDK 앱투앱 로그인을 먼저 사용하고, Kakao ID 토큰을 `/auth/native-session`으로 전달해 WebView에 Supabase 세션 쿠키를 설정한다. Kakao ID 토큰이 없거나 Google 로그인인 경우 Supabase OAuth authorize URL을 외부 앱/브라우저로 열고, 인증 완료 후 `gijilai://auth/callback` 딥링크를 받아 WebView의 `https://gijilai.com/auth/callback`으로 다시 로드한다. 기존 웹 `AuthBridge` 경로는 fallback으로 유지한다.
- **이유**: 로그인 진입 화면은 앱다운 경험을 제공해야 하지만, WebView 세션은 기존 Supabase 쿠키 기반으로 유지되어야 한다. 카카오는 앱투앱 로그인을 제공해 사용자가 카카오톡에서 바로 인증할 수 있고, `/auth/native-session` 세션 교환으로 기존 웹 권한/세션 구조를 유지할 수 있다.
- **대안**: WebView 내부 로그인 화면 유지 — 앱 UX가 약하고 OAuth 제공자 정책/UX와 맞지 않아 기각. 모든 소셜 로그인을 완전 네이티브 SDK로 전환 — Google OAuth 클라이언트 ID 설정과 플랫폼별 검증 범위가 커서 후속 과제로 보류.

## 2026-04-17 | Android 홈 백키는 2회 입력 종료로 처리

- **결정**: Flutter 앱 WebView가 홈(`/`)을 보고 있을 때 Android 백키를 누르면 첫 번째 입력에는 종료 안내를 띄우고, 3초 안에 두 번째 입력이 들어오면 `SystemNavigator.pop()`으로 앱을 종료한다. 홈이 아닌 URL에서는 기존 WebView 뒤로가기를 우선한다.
- **이유**: 홈에서 백키가 아무 반응 없이 무시되면 Android 사용자의 기본 기대와 맞지 않는다. 다만 실수 종료를 막기 위해 즉시 종료 대신 2회 입력 패턴을 사용한다.
- **대안**: 홈에서 즉시 종료 — 실수 종료 가능성이 커서 기각. 항상 WebView 뒤로가기만 수행 — 홈에서 종료할 수 없어 기각

## 2026-04-17 | 앱 루트 진입은 소개 화면을 건너뜀

- **결정**: Flutter 앱 WebView에서 `/`에 진입했을 때 로그인 세션이 없으면 마케팅 소개 화면을 렌더링하지 않고 `/login`으로 이동한다. 세션이 있으면 기존 홈 화면을 렌더링한다.
- **이유**: 앱 설치 후 재방문 사용자는 웹 랜딩보다 즉시 홈 또는 로그인 흐름을 기대한다. 소개 화면은 웹 유입 전환용으로 유지하되, 앱 셸에서는 진입 마찰을 줄인다.
- **대안**: 앱에서도 소개 화면 유지 — 재방문 사용자 경험이 느려져 기각. Flutter에서 초기 URL을 `/login`으로 고정 — 로그인 사용자의 홈 직행이 깨질 수 있어 기각

## 2026-04-17 | Android 런처 아이콘은 adaptive icon으로 제공

- **결정**: Android 앱 아이콘을 legacy PNG만 쓰지 않고 adaptive icon 리소스로 제공한다. 배경색은 전용 color resource로 분리하고, 손/하트 심볼은 투명 foreground PNG로 분리한다.
- **이유**: legacy 정사각형 PNG만 사용하면 일부 런처에서 흰 원형 배경 안에 아이콘이 작게 들어가 앱 아이콘이 축소되어 보인다. adaptive icon은 런처 마스크에 맞게 배경과 전경을 합성하므로 더 자연스럽게 표시된다.
- **대안**: 기존 PNG 크기만 키움 — 런처가 흰 배경을 추가하는 문제를 해결하지 못해 기각. 아이콘을 완전히 새로 디자인 — 범위가 커서 후속 브랜딩 작업으로 보류.

## 2026-04-19 | 앱 OAuth 취소 복귀는 로그인 로딩을 해제

- **결정**: 앱 WebView에서 웹 로그인 화면의 `AuthBridge` 또는 네이티브 로그인 화면이 외부 OAuth 앱/브라우저를 열었지만 `gijilai://auth/callback` 없이 앱으로 복귀하면, Flutter가 인증 핸드오프를 취소로 보고 웹의 `__authLoadingDone` 훅과 네이티브 로딩 상태를 함께 해제한다.
- **이유**: 사용자가 제공자 로그인 화면에서 뒤로가기나 취소를 선택하면 성공 콜백이 오지 않는다. 이 경로를 처리하지 않으면 로그인 버튼이 계속 `Logging in...` 상태로 남아 재시도할 수 없다.
- **대안**: 웹에서 타임아웃으로만 해제 — 실제 외부 앱 전환 시간과 네트워크 지연을 구분하기 어렵다. Flutter 네이티브 로그인 화면만 사용 — 기존 웹 `AuthBridge` fallback을 유지해야 하므로 불충분하다.

## 2026-04-20 | 앱 OAuth fallback은 웹 AuthProvider 경로를 우선 사용

- **결정**: Flutter 앱에서 Kakao ID 토큰이 없어 OAuth fallback으로 내려가거나 Google 로그인을 시작할 때, 직접 Supabase authorize URL을 만들기 전에 WebView의 `AuthProvider` 훅을 호출한다. 서버 콜백 라우트는 localhost 계열 host 헤더를 정식 앱 origin으로 보정한다.
- **이유**: Flutter에서 직접 만든 authorize URL은 auth-js의 PKCE 생성과 앱 WebView 판정을 우회해 localhost origin이나 비정상 콜백으로 이어질 수 있었다. OAuth URL 생성 책임을 웹 `AuthProvider`로 모으면 웹/앱 리다이렉트 정책이 일관되고, 앱 로그인 후 `localhost:3000`으로 이동하는 문제를 막을 수 있다.
- **대안**: Flutter에서 PKCE를 직접 구현 — 모바일 코드와 웹 인증 정책이 중복되어 유지보수 부담이 커 기각. Supabase/Kakao 콘솔 설정만 변경 — 런타임 origin 생성 문제가 남아 기각.

## 2026-04-22 | Kakao OAuth fallback은 추가 scope를 요청하지 않음

- **결정**: 앱 OAuth fallback에서 Kakao `openid`, `profile_nickname`, `profile_image` scope를 명시하지 않는다. 네이티브 SDK ID 토큰 경로는 Kakao Developers의 OpenID Connect 설정이 완료된 경우에만 사용하고, fallback은 Supabase provider 기본 요청에 맡긴다.
- **이유**: Kakao Developers 동의항목 또는 OIDC 설정이 요청 scope와 맞지 않으면 `KOE205`로 로그인 화면에서 차단된다. 로그인 자체가 우선이므로 앱 코드에서 추가 동의항목을 강제하지 않는다.
- **대안**: 코드에서 `openid,profile_nickname,profile_image`를 강제 — 콘솔 설정이 완전히 맞지 않으면 서비스가 차단되어 기각. Kakao 콘솔 설정만 바꾸기 — 운영 설정 반영 전 앱이 계속 실패하므로 코드도 방어적으로 조정한다.

## 2026-04-22 | Kakao OAuth fallback은 account_email을 제외

- **결정**: Supabase Kakao OAuth fallback 요청에 `profile_nickname` scope를 명시해 `account_email` 기본 요청을 제외한다.
- **이유**: Kakao Developers에서 `account_email` 동의항목이 설정되지 않은 상태에서 인증 코드 요청에 email scope가 포함되면 `KOE205`가 발생한다. 현재 로그인에 이메일은 필수 입력값이 아니므로 닉네임 scope만 요청해 차단을 피한다.
- **대안**: Kakao Developers에서 `account_email` 동의항목 활성화 — 운영 콘솔 설정 변경이 필요하고 개인/비즈앱 상태에 따라 불가능할 수 있어 앱 요청을 먼저 보수적으로 제한한다.
- **후속 변경(2026-05-03)**: Kakao Developers 개인정보 동의항목에서 `account_email`이 필수 동의로 설정된 것을 확인해 웹/Supabase OAuth fallback scope를 `profile_nickname account_email`로 다시 확장한다. 이후 카카오 신규 로그인은 이메일 수신을 기대한다.

## 2026-04-23 | Android 배포 lane은 pubspec build number를 자동 증가

- **결정**: Fastlane `android deploy_internal`과 `android deploy_production`은 Play Store 업로드 전에 Flutter `pubspec.yaml`의 `version` build number(`+N`)를 1 증가시킨다. 로컬 AAB 확인용 `android build` lane은 버전을 변경하지 않는다.
- **이유**: Google Play는 이미 사용한 `versionCode` 재사용을 거절한다. Flutter Android 빌드는 `pubspec.yaml`의 build number를 `versionCode`로 사용하므로, 업로드 직전에 자동 증가시키면 매번 실패 후 수동으로 bump하는 흐름을 제거할 수 있다.
- **대안**: 실패 후 수동 bump 유지 — 반복적인 배포 실패를 만들므로 기각. 모든 `android build`에서 자동 bump — 로컬 검증 빌드만 해도 버전이 바뀌어 불필요한 변경이 생기므로 기각.

## 2026-04-29 | 앱 구독 해지는 스토어 관리로 보내고 Google Play는 복귀 시 재동기화

- **결정**: 구독 관리 화면의 해지 UX는 브라우저 기본 `confirm/alert` 대신 서비스 UI에 맞는 커스텀 모달로 통일한다. `PORTONE` 구독만 `/api/payment/cancel-subscription`로 해지 예약을 처리하고, `APPLE_IAP`/`GOOGLE_PLAY` 구독은 각 스토어 구독 관리 화면으로 보낸다. 또한 `GOOGLE_PLAY` 구독은 `/api/payment/subscription` 조회 시 스토어 상태를 다시 읽어 `autoRenewing === false`면 `cancelled_at`를 즉시 반영한다.
- **이유**: WebView 기본 다이얼로그는 `https://gijilai.com 페이지의 내용` 같은 브라우저 출처 문구를 노출해 앱 UX를 해친다. 또 스토어 구독은 서버가 임의로 종료할 수 없고, 스토어에서 해지한 뒤 앱으로 돌아와도 상태 재조회가 없으면 여전히 활성 구독처럼 보인다. Google Play는 on-demand 재검증으로 즉시 반영이 가능하므로 복귀 UX를 개선한다.
- **대안**: 앱 구독도 서버 해지 API로 직접 `cancelled_at` 설정 — 스토어 진실값과 어긋날 수 있어 기각. 서버 알림만 기다리기 — 실제 해지 후 즉시 상태가 안 바뀌어 UX가 나빠 기각. 브라우저 기본 `confirm/alert` 유지 — 앱 컨텍스트와 어울리지 않아 기각.

## 2026-04-29 | API 에러 처리는 입력/운영/모델 실패를 분리한다
- **결정**: 클라이언트와 API 사이의 에러 처리는 `잘못된 요청 본문(400)`, `인증/권한 실패(401/402/403)`, `서버 내부 실패(5xx)`를 명시적으로 분리한다. `request.json()` 파싱 실패는 공통 `INVALID_JSON_BODY`로 응답하고, 결제 API는 내부 예외 메시지 대신 안정된 에러 코드만 반환한다. 상담 API는 LLM JSON 파싱 후 필수 필드 shape까지 검증해야만 성공 응답을 반환한다.
- **이유**: 기존 구현은 일부 화면에서 `res.ok` 확인 없이 JSON을 신뢰하거나, 일부 API가 내부 예외 문자열을 그대로 반환해 사용자 오동작과 운영 진단 혼선을 만들었다. 특히 결제/구독에서는 실패를 빈 상태로 오인하면 잘못된 구매 안내가 노출될 수 있고, 상담 API에서는 schema-broken 모델 응답이 UI를 깨뜨릴 수 있다.
- **대안**: 각 화면과 라우트에서 개별적으로 `try/catch`만 추가 — 에러 분류와 메시지 정책이 쉽게 다시 어긋나므로 기각. 모든 서버 에러를 단일 문자열로 반환 — 사용자 복구 가능성과 운영 원인 분리가 어려워 기각.

## 2026-05-01 | 구독 가치는 기능 잠금 해제보다 지속관리 루프로 설명한다

- **결정**: 요금제와 주요 업셀 표면은 구독 가치를 `무제한 기능 묶음`보다 `리포트 → 상담 → 실천 기록 → 다음 상담`의 지속관리 루프로 설명한다. 혜택 문구는 후속 상담, 아이별 실천 기록 누적, 다음 상담에 이전 기록 반영을 중심으로 정리한다.
- **이유**: 기존 구독 문구는 "무제한 리포트/상담" 위주라 사용자가 결제 후 무엇이 시간이 지날수록 더 좋아지는지 읽기 어려웠다. 실제 제품의 강점은 상담 결과를 실천으로 옮기고, 그 기록이 다음 상담의 맥락이 되는 연속성에 있으므로 이 흐름을 전면에 두는 편이 전환 논리와 제품 실체가 더 잘 맞는다.
- **대안**: 기존 기능 목록 중심 메시지 유지 — 잠금 해제 페이지처럼 보여 지속관리 가치가 약해 기각. 더 강한 기능 게이트를 추가해 전환 강제 — 육아 서비스의 신뢰를 해칠 수 있어 기각.

## 2026-05-01 | 리포트 전환 개선은 Firebase 퍼널 이벤트와 주간 실험 사이클로 운영한다

- **결정**: `/report` 개선은 감이나 단일 페이지 조회수가 아니라 Firebase/GA4 이벤트 퍼널 기준으로 운영한다. 기본 퍼널은 `report_viewed → report_primary_cta_clicked → pricing_viewed → payment_started → payment_completed`로 두고, `child_only` 확장 흐름은 `continue_parent_survey` CTA에서 시작하는 별도 퍼널로 관리한다.
- **이유**: 현재 제품의 가장 큰 불확실성은 무료 리포트 이후 사용자가 다음 행동으로 넘어가는지다. 페이지뷰만으로는 신뢰 형성, CTA 클릭, 설문 확장, 가격 도달, 결제 시작 중 어디서 막히는지 알 수 없어서 개선 우선순위를 잘못 잡기 쉽다.
- **대안**: 기존 `page_view`와 소수 핵심 이벤트만 유지 — `/report` 내부 전환 해석력이 부족해 기각. 별도 BI 파이프라인을 먼저 구축 — 현재 단계에서는 Firebase/GA4 이벤트만으로도 충분히 운영 가능해 과투자라 기각.

## 2026-05-01 | 앱 핵심 화면 네이티브 전환은 capability 기반으로 단계 적용한다

- **결정**: 앱 핵심 화면의 네이티브 전환은 `앱 여부`가 아니라 Flutter WebView가 주입하는 `window.__nativeCapabilities` 계약을 기준으로 단계 적용한다. 웹 라우트(`/login`, `/payment`, `/settings/subscription`, `/settings/notifications`, `/settings/profile`)는 계속 유지하고, 앱은 해당 버전이 실제로 지원하는 화면만 capability에 `true`로 선언한 뒤 선택적으로 네이티브 인터셉트한다. 초기 계약 버전에서는 `login`만 활성화하고 나머지 화면은 fallback 웹 흐름을 유지한다. 후속 계약 버전에서는 `nativeAuthProviders`를 추가해 카카오, Apple, Google 중 실제 네이티브 토큰 교환을 시도할 provider를 별도로 선언한다.
- **이유**: 로그인, 결제, 알림, 프로필을 한 번에 네이티브로 옮기면 웹/앱/구버전 앱 간 분기가 화면마다 퍼지기 쉽다. 단순 UA 분기만으로 네이티브 여부를 결정하면, 아직 구현되지 않은 앱 버전이나 스토어 심사 중인 구버전에서 잘못된 CTA와 깨진 이동이 발생한다. capability 계약을 WebView 문서마다 주입하면 웹은 "앱인가?"보다 "이 앱 버전이 이 화면을 네이티브로 지원하는가?"를 기준으로 안전하게 분기할 수 있다.
- **대안**: 앱 UA만 감지해 모든 핵심 화면을 네이티브로 가정 — 구버전 앱에서 즉시 회귀가 생길 수 있어 기각. 웹 라우트를 제거하고 앱 전용 화면으로 강제 전환 — 모바일 웹과 fallback 경로를 잃어 운영 리스크가 커 기각. 앱 버전 문자열을 웹 곳곳에서 직접 비교 — 분기 로직이 흩어져 유지보수성이 낮아 기각.

## 2026-05-01 | iOS 로컬 결제 테스트는 전용 StoreKit 스킴으로 분리한다

- **결정**: iOS 시뮬레이터 결제 플로우 테스트는 기본 `Runner` 스킴을 바꾸지 않고 `Runner Local StoreKit` 공유 스킴으로 분리한다. 이 스킴은 `gijilai_app/ios/Runner/Configuration.storekit`을 연결해 App Store Connect에 등록된 `gijilai_premium_montly` 상품을 로컬 StoreKit으로 제공한다.
- **이유**: 팀은 시뮬레이터에서 상품 조회·구매 UI·취소 같은 앱 내부 흐름을 빠르게 확인해야 하지만, 같은 스킴으로 실기기 샌드박스와 App Store Connect 실상품 테스트도 유지해야 한다. 로컬 StoreKit을 기본 스킴에 고정하면 실기기 디버그에서도 실제 스토어 조회가 가려져 운영 검증과 개발 검증이 섞인다. 전용 스킴으로 분리하면 시뮬레이터 로컬 테스트와 실기기 샌드박스 테스트를 명확히 나눌 수 있다.
- **대안**: 기본 `Runner` 스킴에 항상 `.storekit` 연결 — 실기기에서 실제 스토어 상품 테스트가 헷갈려 기각. 시뮬레이터에서는 결제를 아예 포기하고 실기기만 사용 — UI/상태 플로우 반복 검증 속도가 너무 느려 기각. 앱 코드에 시뮬레이터 전용 가짜 결제 분기 추가 — 실제 StoreKit 동작과 멀어져 회귀 탐지력이 떨어져 기각.

## 2026-05-01 | iOS 시뮬레이터 결제 테스트는 앱 런타임에서 StoreKit 세션을 자동 시작한다

- **결정**: iOS `Debug` 시뮬레이터 실행에서는 `Runner/AppDelegate.swift`가 번들된 `Configuration.storekit`을 읽어 `StoreKitTest.SKTestSession`을 자동 시작한다. `Runner Local StoreKit` 스킴은 유지하되, `flutter run`이나 수동 설치 빌드처럼 Xcode Launch Action을 거치지 않는 실행 경로도 로컬 상품 조회와 구매 UI를 재현할 수 있게 한다.
- **이유**: 기존 스킴 기반 설정은 Xcode에서 특정 스킴으로 Run 할 때만 로컬 StoreKit이 붙었다. 하지만 실제 개발 플로우는 `flutter run`, 디버그 빌드 설치, 기본 `Runner` 실행이 섞여 있어, 같은 시뮬레이터에서도 `queryProductDetails`가 비어 `"상품 정보를 찾을 수 없습니다"`가 반복됐다. 런타임 자동 세션은 테스트 방식의 차이로 인한 회귀를 줄이고, 시뮬레이터 결제 플로우를 실행 경로와 무관하게 일관되게 만든다.
- **대안**: 스킴 선택만 더 엄격하게 강제 — Flutter CLI/수동 설치 경로를 해결하지 못해 기각. 앱 내부 가짜 결제 분기 추가 — 실제 StoreKit 요청/구매 UI를 통과하지 않아 회귀 탐지력이 떨어져 기각. 기본 스킴에만 `.storekit` 연결 — 실기기 디버그에서 실제 스토어 검증과 충돌할 수 있어 기각.

## 2026-05-01 | iOS 시뮬레이터 결제는 StoreKit 실패 시 네이티브 테스트 다이얼로그로 fallback 한다

- **결정**: iOS `Debug`에서는 먼저 로컬 StoreKit 상품 조회를 시도하되, `queryProductDetails`가 비면 네이티브 테스트 다이얼로그(`성공/실패/취소`)로 결제 플로우를 이어간다. 동시에 iOS 디버그는 StoreKit 1 경로를 우선 사용해 StoreKit 2 전용 `storekit_no_response` 오류를 피한다.
- **이유**: 현재 Flutter `in_app_purchase`의 iOS 시뮬레이터 조합에서는 런타임 StoreKit 세션을 올려도 상품 조회가 안정적으로 반환되지 않았다. StoreKit 2 경로는 `storekit_no_response`, StoreKit 1 경로는 단순 `notFound`로 끝나 실제 구매 UI까지 진입하지 못했다. 팀이 시뮬레이터에서 확인하려는 것은 주로 로딩/취소/성공/실패 같은 앱 내부 UX이므로, 디버그 전용 fallback을 두는 편이 반복 검증 속도와 예측 가능성이 높다.
- **대안**: 시뮬레이터에서는 끝까지 실제 StoreKit 응답만 고집 — 현재 도구 조합에서 재현이 불안정해 개발 흐름을 막아 기각. 완전 가짜 상품/구독 상태를 웹과 서버까지 연결 — 범위가 커지고 운영 코드와 테스트 코드가 과도하게 섞여 기각. 실기기 샌드박스만 허용 — UI 회귀 확인 속도가 너무 느려 기각.

## 2026-05-06 | Apple 첫 구독 심사 전에는 시뮬레이터 UX와 실결제 검증을 분리한다

- **결정**: `gijilai_premium_montly`가 App Store Connect에서 `심사 대기 중`인 동안에는 실제 App Store/Sandbox 상품 조회 실패를 제품 결제 구현 실패로 단정하지 않는다. iOS 디버그 앱은 `GIJILAI_ENABLE_IOS_IAP_FALLBACK=true` dart define이 있을 때만 StoreKit 1 경로와 네이티브 시뮬레이터 테스트 다이얼로그 fallback을 사용한다. fallback 성공은 웹 결제 완료 콜백까지 호출하되 실제 서버 구독은 생성하지 않는다. 실기기 Sandbox/TestFlight 검증에서는 이 fallback을 켜지 않는다.
- **이유**: Apple 첫 구독은 새 앱 버전과 함께 심사를 통과해야 실제 스토어 상품 조회와 영수증 검증 흐름을 안정적으로 확인할 수 있다. 반면 심사 대기 중에도 앱 내부 결제 CTA, 로딩 해제, 성공/실패 메시지, 분석 콜백은 반복 검증해야 한다. 둘을 분리하면 심사 상태 때문에 막히는 외부 스토어 검증과 앱 내부 UX 회귀를 혼동하지 않는다.
- **대안**: 심사 전에도 실제 App Store 상품 조회만 기준으로 삼기 — 외부 상태 때문에 개발 검증이 막히므로 기각. 시뮬레이터 fallback에서 서버 구독까지 생성 — 생산 DB나 운영 권한을 잘못 열 수 있어 기각. 상품 조회 실패를 계속 Crashlytics 에러로 기록 — 의도된 디버그 fallback을 운영 장애처럼 오인하게 되어 기각.

## 2026-05-06 | Apple 월 구독 Product ID 오타는 운영 식별자로 유지한다

- **결정**: App Store Connect에 이미 저장된 Apple 월 구독 Product ID `gijilai_premium_montly`를 운영 식별자로 유지한다. Flutter 앱, WebView 가격 페이지, 서버 IAP 검증/갱신, 로컬 StoreKit 설정은 모두 이 ID를 기준으로 맞춘다. 서버의 `IAP_PRODUCTS` 매핑에는 향후 정정 상품을 만들 때의 호환성을 위해 `gijilai_premium_monthly`도 같은 월 구독 상품으로 남겨둔다.
- **이유**: 2026-05-06 App Store Connect API 조회에서 실제 구독 상품은 `gijilai_premium_montly` 1개뿐이고 상태는 `WAITING_FOR_REVIEW`였다. Apple Product ID는 저장 후 수정할 수 없고, 기존 ID를 앱 코드의 `gijilai_premium_monthly`와 맞지 않게 둔 것이 실기기 샌드박스에서 `"상품 정보를 찾을 수 없습니다"` 오류를 만든 직접 원인이었다. 사용자는 Product ID를 보지 않으므로 내부 오타 자체보다 앱/서버/문서의 일관성이 더 중요하다.
- **대안**: 새 구독을 `gijilai_premium_monthly`로 생성 — 표기는 깔끔하지만 심사 중인 첫 구독을 다시 구성해야 하고 App Store Connect 전파/첨부 상태를 다시 확인해야 해 현재 제출 일정에는 불리해 기각. 앱만 `montly`로 바꾸고 서버는 `monthly` 유지 — 구매 성공 후 영수증 검증/구독 갱신에서 다시 실패할 수 있어 기각. 기존 오타 상품을 삭제 후 재사용 — Apple은 같은 앱 안에서 삭제된 Product ID도 재사용할 수 없어 불가능.

## 2026-05-01 | 앱 WebView 버튼 탭에는 공통 네이티브 햅틱을 연결한다

- **결정**: Flutter 앱 WebView 셸에 `HapticBridge` JavaScript channel과 `window.__nativeCapabilities.haptics` capability를 추가하고, 웹 공통 `Button` 및 상단/하단 공용 내비게이션 탭은 bridge가 확인된 경우에만 가벼운 네이티브 impact 햅틱을 요청한다. Flutter 네이티브 로그인/다이얼로그 버튼도 동일한 강도의 탭 피드백을 사용한다.
- **이유**: 현재 앱은 WebView 기반이라 버튼 탭 직후의 촉각 반응이 부족해, 화면 전환·결제 진입·로그인 시작 같은 액션이 시각적으로만 느껴진다. 공통 버튼 계층과 앱 셸 브리지에서 일관되게 처리하면 페이지별 중복 구현 없이 앱다운 반응성을 보강할 수 있다.
- **대안**: 웹 전체에 전역 click listener로 모든 버튼/링크를 일괄 감지 — raw 버튼과 특수 컨트롤이 많아 과도한 적용이나 회귀 범위가 커 기각. 각 페이지별 버튼마다 직접 햅틱 호출 추가 — 일관성 유지가 어렵고 누락 가능성이 커 기각.

## 2026-05-01 | 브라우저 결제 진입은 앱 설치 랜딩으로 통합한다

- **결정**: 웹 브라우저에서 `/pricing` 또는 `/payment`로 들어온 사용자는 웹 PG/IAP 분기 UI를 보지 않고 `/install-app`으로 즉시 보낸다. 이 랜딩은 UA 기준으로 iPhone/iPad는 App Store, Android는 Google Play를 우선 CTA로 제시하고, 데스크톱/기타 브라우저에는 두 스토어를 모두 보여준다.
- **이유**: 현재 실제 운영 구독은 앱 IAP가 기준인데, 브라우저 결제 화면이 남아 있으면 사용자는 웹에서도 결제가 되는지 오해하기 쉽고 스토어 정책/운영 정책과도 어긋난다. 결제 퍼널의 웹 진입을 앱 설치 페이지로 통일하면 플랫폼별 스토어 이동이 명확해지고, 결제 시작 지점이 앱 IAP 하나로 정리된다.
- **대안**: 웹 `/pricing`에 카드결제와 앱결제 안내를 함께 유지 — 결제 정책과 실제 운영 기준이 섞여 전환 퍼널이 흐려져 기각. CTA마다 개별적으로 App Store/Play Store 링크를 하드코딩 — UA 감지와 스토어 URL 관리가 흩어져 유지보수가 나빠 기각.

## 2026-05-01 | 앱 로그인은 Apple·Google도 네이티브 토큰 교환을 우선한다

- **결정**: Flutter 앱의 로그인 오버레이는 Kakao뿐 아니라 Apple과 Google도 네이티브 SDK 로그인을 우선 시도한다. Apple은 `sign_in_with_apple`로 ID 토큰과 nonce를 받아 `/auth/native-session`에 전달하고, Google은 `google_sign_in`으로 ID 토큰을 받아 같은 세션 교환 경로를 사용한다. iOS/Android Google 네이티브 로그인은 `GOOGLE_WEB_CLIENT_ID`가 있을 때만 capability로 광고하고, 값이 없으면 기존 Supabase OAuth handoff fallback을 사용한다. 네이티브 토큰을 받을 수 없거나 세션 교환이 실패할 때도 기존 Supabase OAuth handoff fallback을 유지한다.
- **이유**: 앱 결제와 알림은 이미 네이티브 경험을 강화하는 쪽으로 가고 있는데, 로그인만 외부 OAuth handoff 중심으로 남으면 첫 진입 경험이 가장 거칠게 느껴진다. 특히 iOS에서는 Sign in with Apple이 네이티브 흐름일수록 심사/신뢰 측면에서 유리하고, Google도 외부 브라우저 전환 없이 복귀 실패 지점을 줄일 수 있다.
- **대안**: 기존 OAuth handoff 유지 — 구현은 단순하지만 앱다운 경험과 복귀 안정성이 약해 기각. Apple만 네이티브화하고 Google은 유지 — 로그인 수단별 경험 차이가 커져 일관성이 떨어져 기각.

## 2026-05-05 | iOS 앱 로그인에서 브라우저 OAuth fallback을 차단한다

- **결정**: iOS 앱에서는 Supabase OAuth authorize URL과 Google/Apple/Kakao OAuth 도메인을 외부 브라우저나 인앱 브라우저로 열지 않는다. WebView `AuthBridge`가 OAuth URL을 전달해도 Flutter가 provider를 식별해 심사 안전한 네이티브 경로로만 라우팅한다. 카카오 로그인은 iOS에서 카카오톡 앱투앱 로그인이 가능한 경우에만 노출하며, 카카오 계정 웹 fallback은 사용하지 않는다. Google은 iOS 심사 환경에서 웹 인증 표면으로 이어질 수 있어 노출하지 않고 Apple 또는 이메일 로그인을 안내한다. 앱 WebView의 웹 `/login` 화면은 이메일 로그인/회원가입 폼만 노출해 심사자가 웹 소셜 OAuth 버튼을 누를 표면도 제거한다. Next.js 클라이언트 라우팅으로 `/login`에 도달해도 `RouteBridge`로 네이티브 오버레이 상태를 동기화한다.
- **이유**: App Review에서 앱 로그인 중 외부 브라우저 기반 인증이 노출되는 흐름이 리젝 요인이 될 수 있다. iOS 심사 환경에서는 카카오톡이 설치되어 있지 않을 수 있으므로 카카오 웹 fallback을 열면 같은 문제가 재현된다.
- **대안**: 기존 fallback 유지 — 심사 리젝을 반복할 수 있어 기각. iOS에서 모든 소셜 로그인을 제거 — 리스크는 낮지만 Apple 네이티브 로그인은 심사 권장 흐름이고 이메일 대안도 있어 과도하므로 기각.
- **후속 변경(2026-05-06)**: iOS 네이티브 로그인 오버레이에 카카오톡과 Google 버튼을 다시 노출한다. 단, 둘 다 Supabase 웹 OAuth fallback은 열지 않고 네이티브 SDK 경로만 사용한다. 카카오톡이 설치되어 있지 않으면 Kakao SDK의 카카오계정 로그인으로 전환하고, Google ID 토큰을 받지 못하면 앱 안에서 실패를 안내한다.

## 2026-05-06 | iOS 로그인 오버레이는 카카오톡·Apple·Google을 함께 제공한다

- **결정**: iOS Flutter 네이티브 로그인 오버레이는 카카오톡, Apple, Google, 이메일 진입점을 모두 제공한다. Google client ID는 release fastlane 기본값과 같은 값을 앱의 dart define 기본값으로 내장해 직접 `flutter run`으로 설치한 디버그 빌드에서도 Google 버튼이 노출되게 한다. 카카오톡 버튼은 설치 여부로 숨기지 않고, 미설치 상태에서는 Kakao SDK의 카카오계정 로그인으로 전환한다.
- **이유**: 실제 실기기 검증에서 iOS 로그인 화면에 Apple과 이메일만 보이면 사용자가 기존 계정 수단인 카카오톡/Google을 찾지 못한다. Google Sign-In과 Kakao SDK 모두 네이티브 경로로 처리하고 웹 OAuth fallback은 계속 차단하면 App Review 리스크를 낮추면서도 기존 가입자의 복귀 경로를 유지할 수 있다.
- **대안**: iOS에서 Apple/이메일만 유지 — 심사 리스크는 낮지만 기존 소셜 가입 사용자가 앱에서 로그인할 수 없어 기각. 카카오/Google을 Supabase 웹 OAuth fallback으로 열기 — 외부 브라우저 인증 표면이 다시 생겨 기각. 카카오톡 설치 여부에 따라 버튼을 숨기기 — 기능이 사라진 것처럼 보여 디버깅과 사용자 안내가 어려워 기각.

## 2026-05-06 | Android 앱에서 Apple 로그인을 웹 OAuth handoff로 지원한다

- **결정**: Android 로그인 오버레이에도 Apple 버튼을 노출한다. Android에는 Apple 네이티브 SDK가 없으므로 Apple만 예외적으로 Supabase OAuth URL을 Android Custom Tab으로 열고, 인증 후 `gijilai://auth/callback` 딥링크로 앱에 복귀시킨다. Google과 Kakao는 계속 네이티브 SDK 경로만 사용하고, iOS는 기존처럼 Apple 네이티브 SDK를 사용한다.
- **이유**: Apple로 가입한 사용자가 Android 기기에서도 같은 계정으로 로그인할 수 있어야 한다. Apple 공식 문서는 비 Apple 플랫폼에서 웹 기반 Sign in with Apple과 리다이렉트 처리를 지원한다.
- **대안**: Android에서 Apple 로그인을 숨김 — iOS에서 Apple 계정으로 가입한 사용자의 Android 재로그인을 막으므로 기각. Android에서 모든 소셜 OAuth fallback을 다시 허용 — Google/Kakao의 네이티브 로그인 안정성과 iOS 심사 대응 정책을 약화하므로 기각.

## 2026-05-06 | Android 카카오톡 로그인 복귀는 MainActivity taskAffinity를 기본값으로 둔다

- **결정**: Android `MainActivity`의 `android:taskAffinity=""`를 제거해 기본 task affinity를 사용한다. 카카오 로그인은 KakaoTalk 설치 시 `loginWithKakaoTalk`, 미설치 또는 앱투앱 로그인 실패 시 `loginWithKakaoAccount`를 사용하는 공식 SDK 경로를 유지한다. 로그인 성공 후 WebView가 기존 `/login` 화면을 잠깐 노출하지 않도록 완료 전환 상태에서는 네이티브 `로그인 중` 화면을 유지한다.
- **이유**: 실제 기기에서 `TalkAuthCodeActivity`가 카카오톡 복귀 URL을 처리할 때 `Reply already submitted` 네이티브 크래시가 발생했다. Kakao DevTalk의 공식 안내도 Flutter 3.22 이후 템플릿에 들어간 `android:taskAffinity=""`와 Kakao 로그인 복귀 문제가 있을 수 있어 해당 옵션 제거 또는 SDK 업데이트를 권장한다. 현재 프로젝트의 Flutter 3.32/Dart 3.8 조합에서는 Kakao SDK 1.10.0이 빌드되지 않으므로, 공식 안내의 manifest 수정으로 앱투앱 로그인 경로를 유지한다.
- **대안**: 카카오톡 앱투앱 로그인을 끄고 카카오계정 웹 로그인만 사용 — 크래시는 피할 수 있지만 네이티브 카카오 로그인 요구를 약화해 기각. Kakao Flutter SDK 1.10.0 또는 v2로 즉시 올림 — 현재 Flutter/Dart 버전에서 빌드 또는 요구사항 문제가 있어 이번 수정 범위에서는 기각.

## 2026-05-06 | Android 카카오 로그인은 카카오톡 앱투앱만 사용한다

- **결정**: Android 카카오 로그인은 카카오톡 앱 설치가 확인될 때만 버튼을 노출하고, `loginWithKakaoTalk`만 호출한다. `loginWithKakaoTalk` 실패, 카카오톡 미설치, 추가 scope 확인 실패 시 `loginWithKakaoAccount` 또는 `loginWithNewScopes` 웹 fallback을 열지 않고 앱 안에서 실패를 안내한다. Manifest package visibility에는 `com.kakao.talk`, `com.kakao.onetalk`, 카카오톡 로그인 intent action을 함께 선언한다.
- **이유**: 배포 앱에서 카카오 로그인 버튼을 눌렀을 때 앱투앱 대신 카카오계정 웹 화면으로 빠지는 동선이 확인됐다. 앱 로그인은 네이티브/앱투앱 경험이어야 하고, 웹 fallback은 iOS 심사 대응 정책 및 Android 네이티브 로그인 기대와 맞지 않는다.
- **대안**: 카카오톡 실패 시 카카오계정 웹 fallback 유지 — 로그인 성공률은 높일 수 있지만 사용자가 기대한 앱투앱 동선을 깨고 웹 OAuth 표면을 다시 노출하므로 기각.

## 2026-05-06 | Kakao Flutter common 1.9.7+3은 로컬 패치로 고정한다

- **결정**: `kakao_flutter_sdk_user`는 1.9.7+3을 유지하되, transitive `kakao_flutter_sdk_common`은 `gijilai_app/third_party/kakao_flutter_sdk_common` path override로 고정한다. 로컬 패치는 앱투앱 로그인 복귀 시 `MethodChannel.Result`를 전역 필드가 아니라 요청별 pending result로 캡처하고 한 번만 응답하게 한다.
- **이유**: 실기기에서 KakaoTalk 복귀 URL 수신 직후 `Reply already submitted` 크래시가 재현됐다. common plugin이 하나의 전역 result 필드를 공유해, 복귀 직전/직후의 다른 Kakao method call이 pending login result를 덮을 수 있다. 현재 Flutter 3.32/Dart 3.8 조합에서는 상위 Kakao SDK로 즉시 올리는 선택지가 안정적이지 않다.
- **대안**: pub.dev 패키지를 그대로 사용 — 실기기 카카오 로그인 복귀 크래시가 남아 기각. SDK 2.x로 즉시 업그레이드 — 인증 플로우와 빌드 요구사항 변경이 커 이번 장애 수정 범위를 넘어서 기각. 앱 코드에서 호출 순서를 지연 — race를 줄일 수는 있지만 plugin 전역 result 구조를 해결하지 못해 기각.

## 2026-05-06 | Android Google 로그인 QA는 APK 서명 SHA 기준으로 분리한다

- **결정**: Android Google 네이티브 로그인 smoke는 Firebase/Google Cloud에 등록된 서명 인증서로 빌드한 APK에서 검증한다. 현재 `google-services.json`의 Android OAuth client는 업로드/릴리스 키 SHA-1 `5E:78:C4:70:A2:52:AE:50:1E:C9:EA:AC:5E:1E:EA:A1:B4:7A:9B:31`에 맞춰져 있으므로, 연결 기기에서 Google 로그인을 확인할 때는 `ANDROID_BUILD_MODE=release ANDROID_FORCE_REINSTALL=1 ./scripts/install_android_default.sh`로 릴리스 서명 APK를 설치한다. debug APK로도 확인해야 하면 해당 개발자의 debug keystore SHA-1/SHA-256을 Firebase/Google Cloud에 추가 등록한다.
- **이유**: 실기기 debug APK는 Google 계정 선택 후 `ApiException: 10`으로 실패했지만, 같은 코드와 같은 `GOOGLE_WEB_CLIENT_ID`를 릴리스 서명 APK로 설치하면 Google 로그인과 Supabase 세션 교환이 완료됐다. Google Sign-In은 package name뿐 아니라 APK signing certificate SHA를 Android OAuth client와 대조하므로, code path가 같아도 서명 키가 다르면 로그인 단계에서 차단된다.
- **대안**: debug 빌드를 항상 업로드 키로 서명 — Google 로그인은 통과하지만 개발 빌드와 배포 키의 경계가 흐려지고 같은 package name의 설치 교체가 혼란스러워 기각. Google 실패 시 브라우저 OAuth fallback 허용 — 앱 로그인 정책과 iOS 심사 대응 원칙을 약화하므로 기각.

## 2026-05-05 | 앱 이메일 로그인/회원가입은 Flutter 네이티브 화면에서 제공한다

- **결정**: 앱에서 사용자가 보는 로그인/회원가입 화면은 Flutter 네이티브 오버레이로 제공한다. 이메일 로그인/회원가입도 웹 `/login` 폼으로 전환하지 않고 네이티브 폼에서 입력받으며, WebView는 `/auth/native-email` API를 통해 Supabase 세션 쿠키를 설정하는 백그라운드 컨텍스트로만 사용한다. Android와 iOS 모두 Supabase OAuth authorize URL과 소셜 OAuth 도메인을 브라우저/Custom Tab으로 열지 않고, 네이티브 SDK 경로가 없으면 앱 안에서 실패를 안내한다.
- **이유**: 앱 화면에서 웹 폼 또는 Custom Tab이 드러나면 사용자는 로그인 경험을 앱이 아니라 웹뷰가 제공한다고 느낀다. App Review 관점에서도 외부 브라우저 인증 표면이 남아 있으면 같은 리젝 사유가 반복될 수 있다.
- **대안**: 이메일만 웹 폼 유지 — 구현은 쉽지만 사용자가 지적한 앱다운 로그인 요구를 충족하지 못해 기각. WebView `/login`을 완전히 제거 — 웹 세션 쿠키 교환과 기존 라우팅 보호를 다시 설계해야 해 이번 수정 범위로는 과도하므로 기각.

## 2026-05-01 | 홈·상담·실천은 한 번에 하나의 다음 행동을 더 강하게 추천한다

- **결정**: 홈은 가장 중요한 다음 행동 1개를 상단에서 먼저 강조하고, 상담 결과는 첫 번째 실천 항목을 기본 추천으로 자동 선택하며, 실천 탭은 오늘의 추천 실천 1개를 목록 최상단에 별도 카드로 노출한다. 같은 행동을 중복으로 다시 고르게 만드는 UI는 줄인다.
- **이유**: 현재 제품은 상담 이후 "무엇부터 해야 하는지"에서 사용자가 다시 결정을 많이 요구받는다. 검사 미완료, 미체크 실천, 상담 시작, 구독 전환이 한 화면에서 비슷한 강도로 섞이면 실제 행동 시작률이 떨어진다. 선택 피로를 줄이려면 상태별 최우선 행동을 시스템이 먼저 제안해야 한다.
- **대안**: 기존처럼 여러 카드를 동등하게 유지 — 정보량은 많지만 실행 우선순위가 흐려져 기각. 추천 실천을 AI가 생성만 하고 UI는 중립 유지 — 사용자가 다시 3개를 다 읽고 판단해야 하므로 기각.

## 2026-05-02 | 실천 피드백 모델 선택은 사용자 입력 신호로 자동 라우팅한다

- **결정**: 추천 실천 기록은 한줄메모 대신 시도 방식, 과정/말 메모, 아이 반응, 양육자 인상을 구조화해서 받고, `/api/consult/practice-feedback`이 이 신호로 static/quick/deep 피드백을 자동 선택한다. 사용자가 모델을 직접 고르는 UI는 만들지 않는다. 피드백 이후 실천을 바꾸면 새 상담 결과에서 선택한 실천을 저장하고 기존 실천은 `DROPPED`로 종료한다.
- **이유**: 대부분의 기록은 저비용 모델의 짧은 피드백으로 충분하지만, 사용자가 "이건 아닌 것 같다", "바꿔보고 싶다", 아이 반응 악화, 긴 상황 설명처럼 의구심이 큰 신호를 남기면 더 신중한 피드백이 필요하다. 모델 선택을 사용자에게 노출하면 비용 구조와 제품 경험이 드러나므로, 입력 품질과 위험 신호를 서버에서 판단하는 편이 자연스럽다.
- **대안**: 모든 피드백을 고급 모델로 생성 — 비용이 누적되어 구독 단가를 압박하므로 기각. 사용자가 "고급 피드백"을 직접 누르게 하기 — 육아 기록 흐름에서 모델 등급을 의식하게 만들어 신뢰와 단순성이 떨어져 기각. 피드백만 주고 실천 변경은 다음 상담으로 미루기 — 부정적 반응을 기록한 직후의 전환 기회를 놓쳐 기각.

## 2026-05-02 | 실천 마감은 성공 횟수가 아니라 기간과 마지막 행동일로 판단한다

- **결정**: 실천 항목의 `duration`은 성공 횟수 목표가 아니라 달력 기준 리뷰 권장 기간으로 해석한다. 마지막 행동일은 가장 최근 실천 로그 날짜로 계산하고, 로그가 없으면 생성일을 사용한다. 마지막 행동 후 3일 이상 멈춘 실천은 반복 리마인더 대상에서 제외하고 앱 안에서 재기록/방법 변경을 제안한다. 권장 기간이 지난 실천은 마감 회고를 기본 제안하며, 아직 이어가고 싶으면 최대 14일 범위 안에서 3일 연장할 수 있다.
- **이유**: 육아 실천에서 며칠 쉬는 것은 실패라기보다 생활 맥락이 바뀌었다는 신호다. 성공 횟수가 `duration`에 도달해야만 회고가 뜨면 7일 실천을 2주 넘게 끌고 가도 "진행 중"처럼 보이고, 사용자는 서비스가 현실을 이해하지 못한다고 느낄 수 있다. 기간과 마지막 행동일을 분리하면 신뢰를 해치지 않으면서도 정리, 재시작, 방법 변경을 적절한 순간에 제안할 수 있다.
- **대안**: `doneDays >= duration`만으로 완료 판단 유지 — 기간 약속과 실제 UI가 어긋나 기각. `EXPIRED` 같은 DB 상태 추가 — 지금은 파생 상태로 충분하고 마이그레이션/상태 전이가 커져 기각. 앱 미접속 기간으로 판단 — 실천별 행동과 무관한 신호라 같은 사용자의 여러 실천 상태를 정확히 설명하지 못해 기각.

## 2026-05-03 | 실천 회고는 상담 세션을 자동 마감하지 않는다

- **결정**: 실천 마감 회고를 저장해도 연결된 상담 세션은 자동으로 `RESOLVED` 처리하지 않는다. 회고 완료 화면에서 사용자가 "이 고민은 어느 정도 해결됐어요"를 선택할 때만 세션을 `RESOLVED`로 바꾸고, 같은 세션에 남아 있는 ACTIVE 실천 항목은 `DROPPED`로 정리한다. 그 외에는 같은 고민으로 다음 상담에서 조정하거나, 상황이 바뀐 새 상담을 시작하도록 연결한다.
- **이유**: 실천 완료와 고민 해결은 심리적으로 다른 사건이다. 앱이 실천 마감만 보고 상담까지 끝냈다고 판단하면, 아직 고민이 남은 사용자는 "앱이 내 상황을 단정한다"고 느낄 수 있다. 반대로 선택지를 너무 많이 주면 피로해지므로, 회고 직후에는 마무리/조정/새 상담 3가지 다음 행동만 제안한다.
- **대안**: 회고 저장 시 세션 자동 해결 — 완료감은 있지만 사용자 통제감과 신뢰를 해칠 수 있어 기각. 항상 다음 상담을 기본으로 강하게 유도 — 필요 없는 상담 소비 압박으로 느껴질 수 있어 기각. 세션 상태를 그대로 두고 아무 CTA도 주지 않기 — 회고 후 다음 행동이 끊겨 지속 루프가 약해져 기각.
