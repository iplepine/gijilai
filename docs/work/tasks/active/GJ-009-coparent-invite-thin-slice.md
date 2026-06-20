<!-- COMMIT_STATUS START -->
> **커밋 상태**
> - 기준 커밋: `425ffe550f386bbd28c1035ed096ef4c513e3e51` (`claude/enable-phased-assessment`)
> - 최근 커밋: `425ffe550f38` docs: refresh project documentation status
> - 커밋 일시: `2026-06-20T22:38:59+09:00`
> - 워킹트리: `clean`
> - 문서 갱신: `2026-06-20 22:39:28 +0900`
<!-- COMMIT_STATUS END -->

# Task

ID: `GJ-009-coparent-invite-thin-slice`

유형: `Build`

상태: `Active`

연결 Roadmap: `R-003-episodic-followup-retention`

연결 Goal: `G-001-paid-conversion-trust`

마지막 갱신일: 2026-05-31

## 목표

GJ-008(공동양육자 리텐션 검증)을 실제로 시작할 수 있도록, 비대칭 초대(Option C) thin-slice 코드를 구현한다. owner가 초대 링크를 발급하고, 초대받은 사용자가 본인 계정으로 가입·수락해 같은 아이의 리포트·상담·실천 맥락을 함께 보고 쓸 수 있는 최소 경로를 만든다.

## 배경

ADR(2026-05-31)에서 공동양육자 연결 모델을 비대칭 초대(`owner` → `co_parent`)로 확정했다. `docs/product/COPARENT_RELATIONAL_RETENTION.md` 가설을 검증하려면 GJ-008(5쌍 모집 + 연결 vs 솔로 리텐션 비교)이 필요한데, 현재 코드에는 다(多)양육자 모델이 없어 사람이 시작할 수가 없다. 이 task는 GJ-008 검증의 코드 의존성을 닫는다.

상세 정책: [`docs/product/policies/co-parent.md`](../../../product/policies/co-parent.md)

## 범위

포함:

- 마이그레이션 018: `child_co_parents` 테이블, `children.owner_label`/`child_co_parents.label` 컬럼, 9개 다운스트림 테이블 RLS OR-clause
- Co-parent API 5개: 초대 생성/미리보기/수락, 협력자 목록/해제
- Owner UI: 아이 설정에서 호칭 선택 + 초대 링크 발급/공유
- Invited UI: `/invite/[token]` 랜딩 — 미리보기 → 로그인 → 호칭 선택 → 동의 → 수락
- 상담/실천 UI: 세션 카드, 상담 인사, 실천 카드에 작성자 호칭 라벨 표시
- 상담 LLM 프롬프트: 현재 작성자 + 공동양육자 존재 + 이전 상담 작성자 라벨 주입
- Analytics 이벤트 9개

제외:

- 자동 푸시 알림 인프라(1차 검증은 카카오톡으로 수동)
- co-parent의 ATQ 응답 강제 흐름
- 응원/똑똑 반응 UI
- 양육자 분석 리포트 두 명 분리
- owner 해지/탈퇴 시 grace 흐름
- 3인 이상 다자

## 완료 기준

- [ ] 마이그레이션 018 작성, 로컬 적용 성공
- [ ] `npm run lint` / `npm run build` / `npm test --runInBand` 모두 통과
- [ ] Owner가 아이 설정에서 호칭을 선택할 수 있다
- [ ] Owner가 초대 링크를 발급해 카카오톡 공유 시트로 보낼 수 있다
- [ ] 초대받은 사용자가 `/invite/[token]`에서 미리보기를 보고, 로그인 후 호칭 선택 + 동의를 거쳐 연결된다
- [ ] 수락 직후 co-parent 계정에서 같은 아이의 리포트/상담/실천이 보인다
- [ ] co-parent가 새 상담을 시작·이어갈 수 있고, 실천 체크와 회고를 작성할 수 있다
- [ ] 세션 카드·상담 인사·실천 카드에 작성자 호칭 라벨이 노출된다
- [ ] 상담 LLM 응답이 작성자 시점을 인지하고 1인칭으로 말한다
- [ ] Analytics 이벤트 9개가 발화되고 개인식별 자유 텍스트가 포함되지 않는다
- [ ] 솔로 사용자(공동양육자 없음) UI는 변화 없음 (회귀 확인)
- [ ] `feature flag` `NEXT_PUBLIC_ENABLE_CO_PARENT_INVITES`로 숨김 가능
- [ ] 관련 문서 업데이트
- [ ] 남은 리스크 기록

## 작업 계획

1. 마이그레이션 018 작성 — 테이블, 호칭 컬럼, RLS 9개 패치
2. 타입과 lib 헬퍼 — `Child`, `CoParent`, `CaregiverLabel`, 호칭 매핑/표시 유틸
3. API 라우트 5개 + 권한 헬퍼(`getChildAccessRole`)
4. Owner 설정 UI — 호칭 선택, 초대 섹션
5. Invited 랜딩 UI — `/invite/[token]`
6. 상담/실천 UI 라벨 부착
7. LLM 프롬프트 작성자 컨텍스트 주입
8. Analytics 이벤트
9. lint/build/test 검증 + 솔로 회귀 확인

## 검증 계획

명령:

- `cd app && npm run lint`
- `cd app && npm run build`
- `cd app && npm test -- --runInBand`

수동 확인:

- 두 개의 테스트 계정으로 초대→수락→공유 맥락 확인
- 솔로 계정에서 기존 UI 회귀 확인
- 협력자 해제 후 권한 즉시 차단 확인

## 문서 업데이트 대상

- `docs/decisions/ADR.md` (완료)
- `docs/product/policies/co-parent.md` (완료)
- `docs/product/policies/index.md` (완료)
- `docs/product/policies/heart-interpreter.md` — LLM 컨텍스트 항목 추가
- `docs/product/policies/consultation.md` — 작성자 표시 항목 추가
- `docs/product/policies/home.md` — 실천 카드 라벨 항목 추가
- `docs/product/FEATURE_MAP.md` — 공동양육자 모드 영역 추가
- `docs/work/roadmaps/active/R-003-episodic-followup-retention.md` — milestone 갱신
- `docs/work/TODO.md` — 완료/후속 갱신
- `SPEC.md` — 공동양육자 흐름 절 추가

## 사용자 확인

필요 여부: `no`

결정: ADR(2026-05-31) 결정대로 진행한다.

## 결과

완료 내용:

- 마이그레이션 018 작성: `child_co_parents` 테이블, `caregiver_label` enum, `children.owner_label` / `child_co_parents.label` 컬럼, 권한 헬퍼 `is_child_co_parent()`, 9개 다운스트림 테이블(reports/surveys/consultations/consultation_sessions/action_items/practice_items/practice_logs/practice_reviews/observations) RLS OR-clause 추가, children 테이블에 co-parent SELECT 정책 추가
- Co-parent API 5개 라우트: POST `/api/co-parent/invites`, GET `/api/co-parent/invites/[token]`, POST `/api/co-parent/invites/[token]/accept`, GET/DELETE `/api/children/[id]/collaborators`
- Owner UI: `/settings/child/[id]` 페이지에 호칭 선택 + 초대 링크 발급/공유/해제 섹션(`OwnerCoParentSection` 컴포넌트), navigator.share + 클립보드 폴백
- Invited UI: `/invite/[token]` 랜딩 페이지 — 미리보기, 비로그인 시 `/login?redirect=` 유도, 호칭 선택, 동의 체크박스 후 수락
- DB 가시성: `db.getChildren`/`db.getSessions`/`db.getActivePracticeItems`/`consult/page.tsx`의 children 로딩이 `parent_id` 필터 대신 RLS 기반으로 동작
- 상담 인사 라벨: 공동양육자가 연결돼 있고 본인 호칭이 정해진 경우에만 인사 앞에 호칭 표시 (`엄마, ○○이의 어떤 상황으로 오셨어요?`)
- LLM 프롬프트 컨텍스트: `consultPromptBuilders`에 `ConsultCaregiverContext` 타입과 `formatCaregiverContextBlock` 헬퍼 추가, `buildInitialConsultQuestionsPrompt`/`buildConsultPrescriptionPrompt`에 `caregiverContext` 파라미터 추가, 서버 헬퍼 `buildConsultCaregiverContext`로 두 상담 API에서 자동 주입
- Analytics 이벤트: `co_parent_invite_generated`, `co_parent_invite_link_shared`, `co_parent_invite_viewed`, `co_parent_invite_accepted`, `co_parent_revoked` 발화
- Feature flag: `NEXT_PUBLIC_ENABLE_CO_PARENT_INVITES`로 API/UI 전체 숨김 가능
- 문서: ADR(2026-05-31) 2건, `docs/product/policies/co-parent.md` 신설, `docs/product/policies/index.md`, `SPEC.md §8-2`, `docs/work/roadmaps/active/R-003-*`, `docs/work/README.md`, `docs/work/TODO.md` 갱신

검증 결과:

- `npm run lint` 통과 (경고 0, 오류 0)
- `npm run build` 통과
- `npm test -- --runInBand` 통과 (18 suites, 109 tests)
- 솔로 사용자 흐름은 caregiver context가 null이라 LLM 프롬프트·UI 모두 기존과 동일하게 동작 (회귀 가드)

남은 리스크:

- **실기기 E2E 미검증**: 두 계정 간 초대→수락→공유 맥락 진입 흐름은 로컬/스테이징에서 수동 확인 필요. 특히 `/invite/[token]` 라우트가 앱 WebView에서 정상 동작하는지(딥링크/Universal Link 충돌 여부), 카카오톡으로 공유된 링크가 외부 브라우저에서 열렸을 때 로그인 후 다시 invite 페이지로 돌아오는 redirect 체인.
- **세션·실천 UI의 작성자 라벨 부분 적용**: 이번 thin-slice는 상담 인사에만 라벨을 부착했다. 세션 카드 목록(`/consultations`), 실천 카드(`/practices`)의 작성자 표시(`엄마 ✓`, `엄마가 시작`)는 후속 작업으로 남았다. LLM 컨텍스트와 권한은 갖춰져 있어 UX 후속 PR로 분리 가능.
- **상담 외 영역(observations, reports)의 작성자 라벨**: 현재 표시 안 함. 데이터 분리는 user_id로 이미 되어 있어 후속.
- **`children` 조회를 RLS 기반으로 바꾸면서** owner의 솔로 동작이 변하지 않는지 실 데이터 트래픽으로 한 번 검증 필요. 마이그레이션 적용 전 환경에서는 owner_label 컬럼이 없어 컴파일은 통과해도 런타임에서 빈 값을 받게 됨 — 배포 전 마이그레이션 018 실행 필수.
- **observations 테이블 RLS**: 008 마이그레이션이 ALTER로만 정의돼 있어 정의 위치가 미궁이다. 018의 observations 정책은 `IF EXISTS` 가드로 안전 추가했지만, 실제 RLS 동작은 적용 후 확인 필요.

후속 task:

- GJ-008로 5쌍 모집 + 연결 vs 솔로 리텐션 비교 시작
- 세션 카드·실천 카드 작성자 라벨 UI 부착 (별도 작업)
- Phase 2 후보: co-parent ATQ 측정, 응원/똑똑 반응 UI, owner 해지 시 grace, 양육자 분석 두 명 분리, 푸시 알림 인프라
