<!-- COMMIT_STATUS START -->
> **커밋 상태**
> - 기준 커밋: `f85a0183f40110ce1f5dde4e0df746c67ca1c9d3` (`feat/co-parent-notifications`)
> - 최근 커밋: `f85a0183f401` feat(notifications): 공동양육자 인앱 알림 (Phase 1)
> - 커밋 일시: `2026-07-06T14:27:05+09:00`
> - 워킹트리: `dirty (1 files)`
> - 문서 갱신: `2026-07-06 14:28:26 +0900`
<!-- COMMIT_STATUS END -->

# 공동양육자(Co-Parent) 정책

마지막 갱신일: 2026-05-31

## 목적

한 아이의 기질·상담·실천 맥락을 두 양육자가 함께 보고, **한 명이 잊어도 상대가 끌어오는** 관계형 리텐션을 만든다. 자세한 사업적 배경과 가설은 [`docs/product/COPARENT_RELATIONAL_RETENTION.md`](../COPARENT_RELATIONAL_RETENTION.md)와 ADR(2026-05-31)을 참조한다.

## 권한 모델

| 역할 | 식별 | 권한 |
|------|------|------|
| `owner` | `children.parent_id` (아이를 처음 등록한 사용자) | 아이 정보 수정/삭제, 구독 변경, 모든 읽기/쓰기, 협력자 초대/해제 |
| `co_parent` | `child_co_parents.co_parent_id` (수락 후 채워짐) | 아이 맥락 읽기, 상담 시작/이어가기, 실천 기록·회고 작성, 본인 연결 해제 |

- 한 아이당 `co_parent`는 **최대 1명** (1:1). 3인 이상 다자는 Phase 2 이후로 보류.
- `co_parent`는 **본인 계정**으로 가입한다. 가족 공유 계정은 사용하지 않는다.
- `owner`만 아이 정보 수정·삭제·구독 변경을 할 수 있다. 그 외 데이터(상담·실천)는 둘 다 가능.
- 솔로 사용자는 기존 경험을 그대로 유지한다(옵트인).

## 호칭(Label)

- 폐쇄형 enum: `MOM | DAD | CARER`
- 한국어 매핑: `MOM → 엄마`, `DAD → 아빠`, `CARER → 보호자`
- `owner`는 아이 설정에서 본인 호칭을 1회 선택한다. 미설정 owner에게는 초대 전 호칭 선택 안내가 노출된다.
- `co_parent`는 초대 수락 화면에서 호칭을 필수 선택한다.
- 두 양육자가 같은 호칭을 고르는 것은 허용한다(예: 동성 부모 가정). 표시는 `엄마(A)`, `엄마(B)` 같은 구분 대신 첫 이름 1자를 추가한다.
- 자유 입력 호칭은 Phase 2에서 검토.

## 데이터 가시성

다운스트림 9개 테이블은 모두 작성자(`user_id`) 외에 **수락된 `co_parent`도 읽기·쓰기**가 가능하도록 RLS에 OR-clause를 추가한다.

| 테이블 | co-parent 권한 |
|---|---|
| `surveys` | 읽기 (본인 설문은 본인이 작성) |
| `reports` | 읽기 |
| `consultation_sessions` | 읽기 + 시작 + 상태 변경(`RESOLVED`) |
| `consultations` | 읽기 + 새 상담 또는 후속 상담 작성 |
| `action_items` | 읽기 + 작성 |
| `practice_items` | 읽기 |
| `practice_logs` | 읽기 + 본인이 한 체크 작성 |
| `practice_reviews` | 읽기 + 본인 회고 작성 |
| `observations` | 읽기 + 본인 관찰 작성 |

가드: `subscriptions`, `payments`, `profiles`, `referrals`, `child_profile_slots`는 co-parent에게 노출하지 않는다.

**self-parent 상담은 공유 범위 밖**: 위 `consultation_sessions`/`consultations`/`practice_items`/`practice_logs`/`practice_reviews` 공유는 모두 **`type='CHILD'`에 한정**된다. 양육자 자신을 위한 상담(`type='SELF_PARENT'`)은 child_id가 연결돼 있어도 co-parent에게 노출되지 않는다(마이그레이션 020이 RLS로 강제). 정책: [`self-parent.md`](self-parent.md).

## 초대 흐름

1. **Owner**: 아이 설정 → "함께 보는 분 초대" → 토큰 발급(만료 7일) → 카카오톡/링크 공유
2. **Co-parent**: 초대 링크 진입 → 미리보기(owner 이름, 아이 이름, 무엇을 함께 보는지) → 비로그인이면 로그인 → 호칭 선택 → 동의 → 수락
3. **결과**: `child_co_parents.status = 'ACCEPTED'`, `accepted_at` 기록. 아이 셀렉터에 해당 아이가 노출되고 모든 맥락이 공유된다.

토큰은 일회용이다. 한 아이당 동시에 `PENDING` 1개만 허용한다. 새로 발급하면 기존 `PENDING`은 `REVOKED`로 만료된다.

## 동의

초대 수락 화면 마지막 단계에서 한 줄 동의 문구를 노출한다.

> 아이의 기질 리포트, 상담 이력, 실천 기록을 함께 봅니다. 동의하고 시작하기.

동의 없이는 수락이 진행되지 않는다. 동의 일자는 `accepted_at`으로 기록된다.

## 작성자 표시

상담/실천 UI는 누가 작성·기록했는지 라벨로 표시한다. 자세한 규칙은 [`heart-interpreter.md`](heart-interpreter.md), [`consultation.md`](consultation.md), [`home.md`](home.md)에 추가한다.

- 세션 카드: `엄마가 시작한 상담 · 5월 24일`
- 상담 인사: `엄마, 안녕하세요. 오늘 ○○이의 어떤 상황으로 오셨어요?`
- 실천 카드 체크: `오늘 엄마 ✓ · 아빠 미체크`
- 추가 상담 시작 화면: `엄마가 시작한 상담을 아빠가 이어갑니다`
- 솔로 사용자는 라벨을 노출하지 않는다(공동양육자가 없으면 기존 UI 유지).

## 공동양육자 알림

한 양육자가 아이 상담을 남기면 상대 양육자에게 알림을 보낸다. "한 명이 잊어도 상대가 끌어온다"는 관계형 리텐션의 도달 채널. (구현: 마이그레이션 `026`, ADR 2026-07-06, 작업목록 [`SPEC.md`](../../../SPEC.md) §공동양육자 알림)

- **발생 조건**: 새 `CHILD` 상담 세션이 생성될 때(= 처방 성공 후 세션 저장 시점) 1건. 소유자↔공동양육자 **양방향** — 누가 상담을 남기든 상대가 받는다.
- **프라이버시 불변 규칙**: `SELF_PARENT`(양육자 사적 상담)는 **절대 알림 대상이 아니다.** DB 트리거가 `type='CHILD'`만 처리한다(데이터 가시성 규칙과 동일 경계).
- **동의 범위**: 공동양육자는 이미 CHILD 상담을 서로 볼 수 있으므로, 알림은 새 동의가 아니라 기존 공유 범위 안의 도달성 개선이다. 별도 옵트인 게이트 없이 시작한다(부담 시 옵트아웃은 Phase 1.5 후보).
- **솔로 사용자**: 공동양육자가 없으면 알림이 생성되지 않고, 홈 알림 벨도 노출되지 않는다(`isCoParentInvitesEnabled()` 플래그를 따른다).
- **저장 형태**: 문구 텍스트가 아니라 구조 참조(actor/child/session)만 저장하고, 표시 문구는 조회 시 호칭 모델로 조합한다(호칭 변경·i18n에 강건).
- **발송 권한**: 알림 생성(INSERT)은 SECURITY DEFINER 트리거/서버만. 수신자는 본인 알림 조회·읽음·삭제만 가능(RLS).
- **실제 기기 푸시(FCM)**: Phase 2 — 현재는 인앱(앱을 열면 확인). 작업 목록은 SPEC 참조.

## LLM 컨텍스트 주입

상담 시작·문진·처방 프롬프트에 다음 컨텍스트를 추가한다.

- 현재 작성자 호칭(예: 이 상담은 `엄마`가 작성합니다)
- 공동양육자 존재 여부와 상대 호칭
- 이전 상담 이력 주입 시 작성자 라벨 (`(엄마가 시작) "…"`, `(아빠가 시작) "…"`)
- 처방 톤 가이드 1줄: 답변은 현재 작성자 시점에서 1인칭으로 말하고, 상대 양육자를 평가하거나 비교하지 않는다.

## 구독 권한 (Phase 1)

- `owner`의 **활성 구독**으로 두 양육자 모두 유료 기능을 사용한다. **체험(trial)은 흘러가지 않는다** — 체험은 본인 사용자용이지 공유 자원이 아니다.
- 구체적으로는 `getServerFeatureAccessForChild(userId, childId)` 헬퍼가 본인 액세스(본인 구독 또는 본인 체험)와 해당 아이 owner의 **활성 구독만**을 OR로 결합한다. 본인 액세스가 풀이면 owner 조회는 생략한다.
- 이 정책의 이유: 두 신규 계정이 각자 7일 체험을 받은 뒤 한쪽이 owner로 invite를 보내 다른 쪽이 본인 체험 + owner 체험을 합산해 무한 사용하는 어뷰징을 차단한다. 신규 어카운트도 본인 체험을 다 쓰고 나면 owner가 **유료 구독 상태일 때만** 계속 쓸 수 있다.
- 적용 라우트: `/api/consult/questions/initial`, `/api/consult/questions/followup`, `/api/consult/prescription`. 이 셋이 메인 상담 흐름이라 권한 확장이 필수다.
- 미적용 라우트 (Phase 1 결정): `/api/consult/options`, `/api/consult/practice-feedback`. 둘은 childId 없이도 호출되는 보조 경로라 본인 액세스만 본다. owner가 구독 중이고 co-parent의 체험이 끝났을 때 이 두 엔드포인트만 막힌다 — Phase 2에서 닫는다.
- `co_parent`는 결제 화면·구독 관리 화면에 접근할 수 없다.
- `owner`가 해지/탈퇴/체험 만료된 경우의 `co_parent` 동작(7일 grace, 본인 구독 전환 안내 등)은 Phase 2에서 결정한다. 검증 단계에는 owner 활성 구독이 사라지면 `co_parent`도 본인 액세스(구독 또는 체험)만 남고 자연 강등된다.

## 의도적 비포함 (Phase 1)

- ~~자동 푸시 알림~~ → **인앱 알림은 Phase 1로 구현됨**(§공동양육자 알림). 실제 기기 푸시(FCM)는 Phase 2 — [`SPEC.md`](../../../SPEC.md) 참조
- co-parent의 양육자 기질(ATQ) 응답 강제 — 옵션
- 응원/똑똑 반응 UI — Phase 2
- 양육자 분석 리포트 두 명 분리 — co-parent ATQ 데이터 필요, Phase 2
- 권한 세분화(read-only vs editor) — Phase 2

## 측정 (kill 기준 판정용 최소 이벤트)

```
co_parent_invite_generated   { child_id }
co_parent_invite_link_shared { channel }
co_parent_invite_viewed      { token_age_days }
co_parent_invite_accepted    { token_age_days, label }
co_parent_invite_declined    { reason? }
co_parent_first_view         { hours_after_accept }
co_parent_practice_logged    { actor_role, actor_label }
co_parent_consult_started    { actor_role, actor_label, is_follow_up }
co_parent_revoked            { by }
```

이벤트에 개인식별 가능 자유 텍스트는 포함하지 않는다.

## kill 후 처리

GJ-008 결과가 약하면(초대율 < 15% 또는 연결-솔로 리텐션 차이 없음):

- DB 마이그레이션은 유지 (RLS OR-clause는 솔로에 무해)
- API/UI는 환경변수 `NEXT_PUBLIC_ENABLE_CO_PARENT_INVITES=false`로 숨김
- ADR에 가설 기각과 episodic 단일 베팅 전환을 기록
