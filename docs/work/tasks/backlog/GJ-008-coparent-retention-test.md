<!-- COMMIT_STATUS START -->
> **커밋 상태**
> - 기준 커밋: `425ffe550f386bbd28c1035ed096ef4c513e3e51` (`claude/enable-phased-assessment`)
> - 최근 커밋: `425ffe550f38` docs: refresh project documentation status
> - 커밋 일시: `2026-06-20T22:38:59+09:00`
> - 워킹트리: `clean`
> - 문서 갱신: `2026-06-20 22:39:28 +0900`
<!-- COMMIT_STATUS END -->

# Task

ID: `GJ-008-coparent-retention-test`

유형: `Validate`

상태: `Ready`

연결 Roadmap: `R-003-episodic-followup-retention`

연결 Goal: `G-001-paid-conversion-trust`

마지막 갱신일: 2026-05-30

대기 사유: active task 최대 3개 규칙. `GJ-005`/`GJ-006`/`GJ-007` 중 하나가 닫히면 active로 승격한다(전략상 GJ-007과 병행 권장).

## 목표

"같은 아이에 두 번째 양육자를 초대하면 리텐션이 오르는가"를 풀구현 전에 싸게 검증한다.

## 배경

`nodtry`에서 창업자 부부가 함께 쓰며 리텐션이 좋고 약속 수행이 늘었다 — 리텐션 엔진은 콘텐츠가 아니라 관계였다. gijilai는 AI와의 1:1이라 답을 받으면 기다리는 사람이 없어 이탈한다. 육아는 보통 두 부모가 하므로, 두 번째 양육자를 루프에 넣어 관계형 리텐션을 이식할 수 있는지 검증한다. 설계: `docs/product/COPARENT_RELATIONAL_RETENTION.md`.

## 범위

포함:

- 이미 두 부모가 함께 쓰거나 쓸 의향이 있는 소수 케이스(창업자 부부 포함) 모집
- 초대-공유 thin-slice 또는 수동 시뮬레이션으로 공유 맥락·실천 전달·상대 반응 재현
- "연결된 아이" vs "솔로 아이"의 리텐션·실천 수행율 비교 기록

제외:

- 3인 이상 다자 구조
- 서버 푸시 신규 구축
- 가격/구독 구조 변경
- 관계/권한 모델 대규모 코드 구현(검증 후 별도 task)

## 완료 기준

- [ ] 공동 사용 케이스 소수 모집(목표 5쌍 내외)
- [ ] 초대-공유 흐름을 thin-slice/수동으로 재현
- [ ] 한 명의 실천 기록이 상대에게 전달되고 상대가 반응하는 경험 제공
- [ ] 연결 아이 vs 솔로 아이의 리텐션·실천 수행율 비교 집계
- [ ] 초대율/수락율 기록
- [ ] kill 기준 대비 가설 채택/기각 판단

## 검증 계획

집계:

- 초대율 = 초대 발송 / 대상, 수락율 = 수락 / 초대
- 리텐션 비교 = 연결 아이 코호트 vs 솔로 아이 코호트 재방문/재상담
- 실천 수행율 = 연결 vs 솔로

판정:

- 연결 아이가 솔로 대비 유의미하게 더 retained → R-003 관계형 트랙을 구현 범위로 진행
- kill 기준(초대율 < 15% 또는 연결-솔로 리텐션 차이 없음) → 관계형 접고 episodic 후속 단일 베팅으로 회귀

## 문서 업데이트 대상

- `docs/work/TODO.md`
- `docs/work/roadmaps/active/R-003-episodic-followup-retention.md`
- `docs/product/COPARENT_RELATIONAL_RETENTION.md`

## 결과

완료 내용:

검증 결과:

남은 리스크:

후속 task:
