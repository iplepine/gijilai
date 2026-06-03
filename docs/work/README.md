# 작업 관리

마지막 갱신일: 2026-05-31

## 현재 집중

현재 active goal: `G-001-paid-conversion-trust`

현재 active roadmaps:

- `R-001-consult-report-conversion` — 리포트/가격/결제 전환 검증 운영 후속
- `R-002-practice-loop-retention` — 홈/실천/회고 루프 입력 부담 낮추기
- `R-003-episodic-followup-retention` — 리텐션 재설계: 관계형 co-parent(주) + episodic 후속(보조)
- `R-004-self-parent-care` — 양육자 자신을 위한 상담(수치심 없는 양육 코칭)

현재 active tasks:

- `GJ-005-report-trust-baseline-qa` (코드 완료, 배포 환경 DebugView 확인만 남아 운영 후속화)
- `GJ-006-practice-loop-usability-qa` (코드 완료, 모바일 WebView 회귀 QA만 남아 운영 후속화)
- `GJ-007-manual-followup-test`
- `GJ-009-coparent-invite-thin-slice` (R-003 co-parent thin-slice — 코드 완료, 마이그레이션 적용·실기기 확인 남음)
- `GJ-010-self-parent-reflection-thinslice` (R-004 self-parent Phase 1 — 코드 완료, 마이그레이션 적용·실기기 확인 남음)
- `GJ-011-self-parent-practice-loop` (R-004 self-parent Phase 2 — 코드 완료, 마이그레이션 적용·실기기 확인 남음)

신규 빌드는 GJ-009/010/011이 코드 완료 상태이고 운영 적용(마이그레이션 018·019·020)·실기기 확인이 남았다.

다음 대기(Ready): `GJ-008-coparent-retention-test` — GJ-009 운영 적용 후 5쌍 모집/연결 vs 솔로 비교 시작.

현재 TODO: [TODO.md](TODO.md)

운영 후속 확인:

- 배포 환경 Firebase DebugView 이벤트 수집 확인
- 첫 주 리포트 전환 기준선 기록
- 홈/실천 루프 모바일 WebView 회귀 QA

## 읽는 순서

1. `goals/active/`에서 지금 왜 이 일을 하는지 확인한다.
2. `roadmaps/active/`에서 이번 사이클의 순서를 확인한다.
3. `tasks/active/`에서 지금 실제로 끝낼 작업을 확인한다.
4. 전체 TODO와 운영 후속은 `TODO.md`에서 확인한다.
5. 상담 결과 품질을 튜닝할 때는 `prompt-tuning/consultation-result-tuning.md`를 확인한다.
6. 상담 프롬프트 튜닝 히스토리를 볼 때는 `prompt-tuning/HISTORY.md`를 확인한다.
7. 상담/문진해설 프롬프트 변경 전후를 비교할 때는 `prompt-tuning/consultation-before-after.md`를 확인한다.
8. 완료된 작업은 `tasks/done/`으로 옮기고 roadmap 진행률을 갱신한다.

## 운영 규칙

- active task는 최대 3개만 둔다.
- task는 반드시 roadmap에 연결한다.
- roadmap은 반드시 goal에 연결한다.
- 완료 기준이 없는 task는 active에 두지 않는다.
- 개발 task는 테스트, 빌드/검증, 문서 업데이트 체크를 포함한다.
