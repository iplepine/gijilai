<!-- COMMIT_STATUS START -->
> **커밋 상태**
> - 기준 커밋: `425ffe550f386bbd28c1035ed096ef4c513e3e51` (`claude/enable-phased-assessment`)
> - 최근 커밋: `425ffe550f38` docs: refresh project documentation status
> - 커밋 일시: `2026-06-20T22:38:59+09:00`
> - 워킹트리: `clean`
> - 문서 갱신: `2026-06-20 22:39:28 +0900`
<!-- COMMIT_STATUS END -->

# Roadmap

ID: `R-003-episodic-followup-retention`

상태: `Active`

연결 Goal: `G-001-paid-conversion-trust`

마지막 갱신일: 2026-05-31

## 목적

gijilai를 매일 쓰는 앱으로 우기지 않고, 리텐션을 두 가지 베팅으로 재설계한다.

- 주(主) 베팅 — 관계형(co-parent): `nodtry`에서 창업자 부부가 함께 쓰며 리텐션이 좋았던 핵심은 "옆에 있는 사람"이었다. 두 번째 양육자를 같은 아이 맥락에 넣어 그 관계형 리텐션을 gijilai로 이식한다. 설계: `docs/product/COPARENT_RELATIONAL_RETENTION.md`.
- 보조 베팅 — episodic 후속: 매일 체크인 대신 `상담 → 한 가지 실천 → 며칠 뒤 1회 후속 → 성공 저금/재상담`. 솔로 사용자에게도 작동. 설계: `docs/product/EPISODIC_FOLLOWUP_RETENTION.md`.

공통 목표: 후속/실천 결과를 아이 맥락에 저장해, 다음 고민 때 ChatGPT가 아니라 "내 아이를 기억하는 gijilai"로 돌아오게 만드는 누적 맥락 해자를 작동시킨다.

## 기간

시작: 2026-05-30

목표 종료: 2026-06-20

## 진행률

진행률: 25%

근거: 두 베팅의 기획 문서와 검증 task(GJ-007 episodic, GJ-008 co-parent)를 만들었다. co-parent 모델은 비대칭 초대(Option C)로 결정해 ADR과 정책 문서를 박았고, thin-slice 구현 task GJ-009를 active로 추가했다. episodic 수동 테스트와 co-parent 가설 검증은 아직 시작 전이다.

## Milestones

| 순서 | Milestone | 완료 기준 | 상태 |
|---:|---|---|---|
| 1 | 가설/지표 정의 | episodic·관계형 두 가설의 지표와 kill 기준 확정 | `Done` |
| 2 | co-parent 모델 결정 | 비대칭 초대(Option C) ADR + 정책 + thin-slice 작업 분해 | `Done` |
| 3 | co-parent thin-slice 구현 | 초대-수락-공유 맥락-작성자 라벨 최소 경로(GJ-009) | `In Progress` |
| 4 | episodic 후속 수동 테스트 | 유료 사용자 ~10명에게 상담 후 후속 수동 발송, 3분기 응답 회수 (GJ-007) | `Todo` |
| 5 | co-parent 리텐션 테스트 | thin-slice 위에서 연결 vs 솔로 리텐션 비교 (GJ-008) | `Ready` |
| 6 | 판정·결합 | 두 베팅 결과로 채택/기각, 결합 전략(기본 episodic + 업그레이드 co-parent) 확정 | `Todo` |

## Active Tasks

- `GJ-007-manual-followup-test` (episodic, active)
- `GJ-009-coparent-invite-thin-slice` (co-parent thin-slice 구현, active)

## Ready / 대기 Tasks

- `GJ-008-coparent-retention-test` (관계형 검증 — GJ-009 코드 완료 후 시작)

## Backlog Tasks

- 매일 체크인 축소/제거 범위 정의(실천 항목 최대 5개·매일 체크 → 단일 실천)
- 후속/실천 결과(됨/안 됨/안 함)를 아이 맥락에 저장하고 다음 상담 프롬프트에 주입하는 경로 설계
- episodic 리듬에 맞는 과금 옵션 검토(회수권/일시정지/연간 "항상 거기 있음")
- 후속 메시지 3분기 카피 A/B 후보 정리
- co-parent Phase 2: ATQ 측정 흐름, 응원/똑똑 반응, owner 해지 시 grace, 양육자 분석 두 명 분리

## 제외

이번 roadmap에서 하지 않는 일:

- 3인 이상 다자 공동육아(첫 버전은 1:1)
- 서버 푸시 인프라 신규 구축(1차는 수동/로컬·thin-slice 검증)
- 가격/구독 상품 구조 변경(검토는 backlog, 구현은 제외)
- 상담 모델/프롬프트 품질 자체 튜닝

## 검증 계획

테스트:

- GJ-007(episodic): 후속 응답률, "해봤다" 응답율, 30/60일 재상담 복귀율
- GJ-008(co-parent): 초대율/수락율, 연결 아이 vs 솔로 아이 리텐션·실천 수행율

kill 기준:

- episodic: 후속 응답률 < 20% & 재상담 복귀 ≈ 0 → 상담 결과 품질 검증으로 전환
- co-parent: 초대율 < 15% 또는 연결-솔로 리텐션 차이 없음 → 관계형 접고 episodic 단일 베팅
