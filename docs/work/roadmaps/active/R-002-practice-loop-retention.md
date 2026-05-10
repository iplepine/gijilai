# Roadmap

ID: `R-002-practice-loop-retention`

상태: `Active`

연결 Goal: `G-001-paid-conversion-trust`

마지막 갱신일: 2026-05-10

## 목적

홈, 실천, 상담을 오가는 반복 루프에서 사용자가 "지금 무엇을 해야 하는지"를 바로 이해하고, 기록/회고 입력 부담 때문에 이탈하지 않게 만든다.

## 기간

시작: 2026-05-10

목표 종료: 2026-05-17

## 진행률

진행률: 45%

근거: 하단 탭 아이콘 잘림, 홈 reveal 애니메이션, 다자녀 실천/상담 구분, 실천 마무리 용어, 홈 대표 실천 미리보기 개수, 선택 회고 입력은 반영했다. 남은 일은 모바일 WebView 회귀 QA와 첫 주 행동 지표 확인이다.

## Milestones

| 순서 | Milestone | 완료 기준 | 상태 |
|---:|---|---|---|
| 1 | 홈 다음 행동 명료화 | 대표 실천 카드의 전체 개수와 미리보기 개수가 어긋나 보이지 않음 | `Done` |
| 2 | 다자녀 맥락 강화 | 실천 목록과 상담 인사에서 어떤 아이의 맥락인지 구분 가능 | `Done` |
| 3 | 실천 마무리 마찰 감소 | 회고 내용이 선택 입력이며 빈 회고가 다음 상담 맥락을 어지럽히지 않음 | `In Review` |
| 4 | 모바일 WebView 회귀 QA | 하단 탭, safe area, 홈/실천 모달 주요 상태 스크린샷 확인 | `Todo` |

## Active Tasks

- `GJ-006-practice-loop-usability-qa`

## Backlog Tasks

- 다자녀 홈 선택 아이와 실천 탭 필터의 일관성 점검
- 실천 상태별 홈 카드 문구 A/B 후보 정리
- 실천 마무리 후 다음 상담 진입률 기준선 기록

## 제외

이번 roadmap에서 하지 않는 일:

- 실천 DB 스키마 변경
- 상담 모델 교체
- 리마인더 서버 푸시 도입
- 신규 결제 상품 추가

## 검증 계획

명령:

- `cd app && npm run lint`
- `cd app && npm run build`

수동 확인:

- 다자녀 계정에서 실천 목록 아이 태그 확인
- 홈 대표 실천 카드가 3개 이상일 때 `+N개 더` 표시 확인
- 실천 마무리 모달에서 회고 내용을 비우고 저장 가능 확인
- Android/iOS WebView 하단 탭과 모달 safe area 확인

## 완료 후 업데이트

- [x] `docs/product/FEATURE_MAP.md`
- [x] `docs/product/policies/home.md`
- [x] `docs/product/policies/consultation.md`
- [x] `docs/work/TODO.md`
