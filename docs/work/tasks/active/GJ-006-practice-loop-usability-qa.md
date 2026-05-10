# Task

ID: `GJ-006-practice-loop-usability-qa`

유형: `Build + Verify`

상태: `Active`

연결 Roadmap: `R-002-practice-loop-retention`

연결 Goal: `G-001-paid-conversion-trust`

마지막 갱신일: 2026-05-10

## 목표

홈과 실천 탭에서 다음 행동이 즉시 이해되도록 하고, 실천 마무리 입력 부담을 낮춰 상담-실천-후속상담 루프 이탈을 줄인다.

## 배경

최근 사용성 점검에서 하단 탭 아이콘 잘림, 홈 스크롤 reveal 애니메이션, 다자녀 맥락 구분, "실천 정리하기" 용어, 홈 대표 실천 개수 표시, 실천 마무리 회고 필수 입력이 마찰로 확인됐다.

## 범위

포함:

- 홈 대표 실천 카드의 남은 항목 수 표시
- 실천 마무리/회고 입력 선택화
- 다자녀 실천 목록과 상담 인사 맥락 구분
- 홈 화면 즉시 노출성 유지
- 관련 제품/정책/작업 문서 업데이트

제외:

- 실천 스키마 변경
- 리마인더 발송 방식 변경
- 상담 프롬프트 품질 튜닝
- 가격/구독 구조 변경

## 완료 기준

- [x] 홈 대표 실천 카드가 최대 2개만 미리 보여도 남은 개수를 `+N개 더`로 표시
- [x] 실천 마무리 회고를 비워도 저장 가능
- [x] 빈 회고가 다음 상담 LLM 컨텍스트에 빈 `회고` 필드로 들어가지 않음
- [x] 다자녀 실천 목록에서 아이 이름 태그 표시
- [x] 상담 인사에서 아이 이름 강조
- [x] 홈 스크롤 reveal 애니메이션 제거
- [ ] 모바일 WebView에서 홈/실천/상담 주요 상태 수동 확인
- [x] 관련 문서 업데이트
- [ ] 남은 리스크 기록

## 검증 계획

명령:

- `cd app && npm run lint`
- `cd app && npm run build`

수동 확인:

- 홈에서 마무리할 실천이 3개 이상일 때 `+1개 더` 표시
- 실천 마무리 모달에서 텍스트 없이 저장
- 다자녀 계정에서 실천 카드 아이 태그와 상담 인사 색상 확인
- 하단 탭 기록 아이콘이 잘리지 않는지 확인

## 문서 업데이트 대상

- `docs/work/TODO.md`
- `docs/work/roadmaps/active/R-002-practice-loop-retention.md`
- `docs/product/FEATURE_MAP.md`
- `docs/product/USE_CASES.md`
- `docs/product/policies/home.md`
- `docs/product/policies/consultation.md`

## 결과

완료 내용:

- 코드 변경은 반영됐고 `npm run lint`, `npm run build`를 통과했다.
- 제품/정책/작업 문서를 현재 홈·실천 루프 동작과 TODO 기준으로 갱신했다.

검증 결과:

- 자동 검증 완료. 모바일 WebView 수동 QA는 남아 있다.

남은 리스크:

- 실제 기기에서 safe area, 하단 탭, 모달 높이 회귀를 아직 스크린샷으로 확인하지 않았다.

후속 task:

- 모바일 WebView 회귀 QA
- 첫 주 실천 마무리 후 다음 상담 진입률 기준선 기록
