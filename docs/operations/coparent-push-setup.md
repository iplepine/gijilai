<!-- COMMIT_STATUS START -->
> **커밋 상태**
> - 기준 커밋: `010bf5cbf28e5e0be8589f4cec7a36045b59c02b` (`feat/co-parent-push`)
> - 최근 커밋: `010bf5cbf28e` feat(notifications): 공동양육자 FCM 기기 푸시 (Phase 2 · 코드)
> - 커밋 일시: `2026-07-07T16:52:20+09:00`
> - 워킹트리: `dirty (1 files)`
> - 문서 갱신: `2026-07-07 16:52:38 +0900`
<!-- COMMIT_STATUS END -->

# 공동양육자 FCM 푸시 — 외부 설정 가이드 (Phase 2)

> 코드(웹 백엔드·앱 클라이언트)는 구현 완료. **이 문서의 외부 콘솔 설정을 마쳐야 실제 기기 푸시가 나간다.**
> 관련: SPEC §공동양육자 알림, ADR 2026-07-07, 마이그레이션 `026`(인앱)·`027`(기기토큰).

발송 흐름:

```
CHILD 상담 세션 INSERT
  └─(트리거 026)→ notifications row INSERT
        └─(Supabase DB Webhook)→ POST /api/webhooks/notification-created
              └─ device_tokens 조회 + coparent_push_enabled 확인
                    └─(FCM v1)→ 수신자 기기 푸시  ──탭──→ /consultations/{id}
```

체크리스트(순서 무관, 전부 필요):

## 1. Supabase — 마이그레이션 + Database Webhook

- [ ] **마이그레이션 적용**: SQL Editor에서 `docs/operations/migrations/027_device_tokens.sql` 실행 (재실행 안전).
- [ ] **Database Webhook 생성**: Dashboard → Database → Webhooks → *Create a new hook*
  - Table: `public.notifications`
  - Events: **Insert**
  - Type: **HTTP Request**, Method **POST**
  - URL: `https://gijilai.com/api/webhooks/notification-created`
  - HTTP Headers: `x-webhook-secret: <NOTIFICATION_WEBHOOK_SECRET와 동일한 값>`
  - (Supabase는 `{ type, table, schema, record, old_record }` 형태로 보냄 — 라우트가 `record`를 읽는다.)

## 2. Firebase — Cloud Messaging + 서비스 계정 키

- [ ] **Cloud Messaging API(V1)** 활성화 확인 (프로젝트 `gijilai`, sender `247682708380`).
- [ ] **서비스 계정 비공개 키**: 프로젝트 설정 → 서비스 계정 → *새 비공개 키 생성* → JSON 다운로드.
  - 이 JSON **전체**를 Vercel 환경변수 `FCM_SERVICE_ACCOUNT_JSON`에 넣는다(개행 포함 문자열 그대로. 코드가 `\n` 복원 처리함).

## 3. Apple — APNs 키 (iOS 푸시 필수)

- [ ] Apple Developer → Keys → **APNs Auth Key(.p8)** 생성.
- [ ] Firebase 콘솔 → 프로젝트 설정 → Cloud Messaging → **Apple 앱 구성**에 .p8 업로드(Key ID, Team ID 입력). Bundle ID `com.devho.gijilai`.
- [ ] Xcode: Runner 타깃 → Signing & Capabilities → **Push Notifications** + **Background Modes(Remote notifications)** 추가.
  - (Android는 `google-services.json`이 이미 있고 알림 채널 `coparent`는 앱 코드가 생성한다 — 추가 설정 없음.)

## 4. Vercel — 환경변수

- [ ] `FCM_SERVICE_ACCOUNT_JSON` = (2)의 서비스 계정 JSON 전체
- [ ] `NOTIFICATION_WEBHOOK_SECRET` = 임의의 강한 랜덤 문자열 ((1)의 웹훅 헤더와 동일)
- 설정 후 재배포. 미설정 시: 디스패치 라우트는 `skipped: fcm_not_configured`로 조용히 통과(인앱 알림은 정상 동작).

## 5. 앱 빌드/릴리스

- [ ] `cd gijilai_app && flutter pub get` (firebase_messaging 추가됨)
- [ ] iOS 실기기로 빌드(푸시는 시뮬레이터 불가). Android 실기기/에뮬 가능.
- [ ] 스토어 릴리스 — 사용자가 신규 앱 버전을 설치해야 토큰이 등록된다.

## 6. 스모크테스트 (2계정 + 실기기)

1. B가 앱 로그인 → (자동) FCM 토큰이 `device_tokens`에 등록됐는지 확인
2. A가 아이 상담 완료 → **B 기기에 푸시 도착** → 탭 → `/consultations/{id}` 열림
3. 설정 → 알림 → "공동양육자 상담 알림" OFF → A가 상담 → **B에게 푸시 안 감**(인앱 알림은 계속 남음)
4. (프라이버시) A가 "내 마음(자기) 상담" → B에게 **푸시/인앱 모두 안 감**

## 트러블슈팅

- 푸시 안 옴 → 라우트 응답의 `skipped` 값 확인: `fcm_not_configured`(2·4 미설정), `no_tokens`(앱 미설치/토큰 미등록), `opted_out`(설정 OFF).
- iOS만 안 옴 → APNs 키(3) 누락이 가장 흔함.
- 무효 토큰은 발송 실패 시 자동 정리(`device_tokens`에서 삭제)된다.
