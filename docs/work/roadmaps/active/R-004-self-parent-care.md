<!-- COMMIT_STATUS START -->
> **커밋 상태**
> - 기준 커밋: `42ed4d5e3c01012a9599c8ac423810d3beb99831` (`claude/enable-phased-assessment`)
> - 최근 커밋: `42ed4d5e3c01` 차수화 신뢰도 캘리브레이션 인프라 + 미캘리 신뢰도 노출 게이트
> - 커밋 일시: `2026-06-17T08:17:20+09:00`
> - 워킹트리: `dirty (72 files)`
> - 문서 갱신: `2026-06-20 22:33:14 +0900`
<!-- COMMIT_STATUS END -->

# Roadmap

ID: `R-004-self-parent-care`

상태: `Active`

연결 Goal: `G-001-paid-conversion-trust`

마지막 갱신일: 2026-06-03

## 목적

아이 행동 상담만 다루던 기질아이를 "부모와 아이가 함께 자라는 동행자"로 확장한다. 양육자 본인의 마음·자기 작업을 상담→실천 루프에 넣어, 수치심 없는 양육 코칭으로 재방문·신뢰·전환을 만든다. 캐치프라이즈: "더 좋은 사람이 되기 위해 고민하는 것만으로 당신은 이미 좋은 사람."

기획: `docs/product/SELF_PARENT_CONSULTATION_PLAN.html` · 정책: `docs/product/policies/self-parent.md` · 결정: ADR 2026-05-31

## 기간

시작: 2026-05-31

목표 종료: 2026-06-27

## 진행률

진행률: 55%

근거: Phase 0(캐치프라이즈)과 Phase 1(one-shot self-parent 상담), Phase 2(self practice loop — action 실천 저장, "내 마음 기록" 화면, 이번 주 후속 체크인, 홈 "오늘의 나" 카드)를 구현했다. 마이그레이션 019/020 운영 적용·실데이터 검증·Phase 3~4는 시작 전.

## Milestones

| 순서 | Milestone | 완료 기준 | 상태 |
|---:|---|---|---|
| 0 | 캐치프라이즈 톤 약속 | pricing·상담 결과·양육자 탭·self 결과에 노출 | `Done` |
| 1 | one-shot reflection thin slice | 입력→2질문→처방, 위기 가드레일, 기록 저장 (GJ-010) | `Done` |
| 2 | self practice loop | 1 action 실천 저장 + "내 마음 기록" + "이번 주 어떠셨어요?" 후속 + 홈 카드 (GJ-011) | `In Review` |
| 3 | cross context | 자기 상태가 아이 상담 톤에 반영 | `Todo` |
| 4 | co-parent 결합 | 두 양육자 patterns 가볍게 공유 (R-003 의존) | `Todo` |

## Active Tasks

- `GJ-010-self-parent-reflection-thinslice` (Phase 1 — 코드 완료, 운영 적용 남음)
- `GJ-011-self-parent-practice-loop` (Phase 2 — 코드 완료, 운영 적용·검증 남음)

## Backlog Tasks

- 위기 키워드 가드레일 정밀도 운영 데이터로 튜닝 (false positive/negative)
- self-parent 결과 화면 사람 리뷰 — 위로만 늘어놓지 않고 작은 행동으로 이어지는지
- Phase 2 실천 루프 설계 (평가 아닌 안부 톤)
- "내 마음 기록" 별도 이력 화면 (Phase 2)

## 제외

- 어린 시절·원가족·트라우마 깊이 작업 (임상 경계 밖)
- 부부 상담·관계 분석
- 진단·치료 기능

## 검증 계획

- GJ-010: 아이 상담 결과 CTA 클릭률, self 상담 완료율, 위기 감지 발생률, 며칠 뒤 재방문
- kill 기준: CTA 클릭률이 매우 낮거나(<5%) 완료율이 아이 상담 대비 현저히 낮으면 진입점·톤 재설계

## 완료 후 업데이트

- [ ] 연결 Goal 지표 갱신
- [ ] 제품 문서 갱신
- [ ] 진행상황 문서 갱신
