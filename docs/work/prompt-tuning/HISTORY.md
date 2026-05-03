# 상담 프롬프트 튜닝 히스토리

마지막 갱신일: 2026-05-04

## 목적

상담 프롬프트 튜닝은 일회성 코드 수정이 아니라 기질아이의 제품 자산이다. 이 문서는 상담 결과 품질을 높이기 위해 발견한 문제, 프롬프트 변경, 평가 결과, 남은 판단을 시간순으로 축적한다.

히스토리는 다음 용도로 쓴다.

- 어떤 품질 문제가 반복됐는지 추적한다.
- 어떤 프롬프트/가드레일 변경이 효과가 있었는지 재사용한다.
- 새 모델, 새 케이스, 새 정책 변경 때 과거 판단을 다시 비교한다.
- 실제 사용자 데이터가 섞인 로컬 평가 결과를 문서화하되, 개인정보는 남기지 않는다.

## 기록 원칙

- 모든 튜닝 세션은 이 문서에 1개 항목을 추가한다.
- 실제 사용자/가족 식별 정보는 기록하지 않는다. 케이스는 익명화된 장면명으로만 남긴다.
- `cases.local.json`과 `runs/` 원본은 로컬 전용으로 유지하고, 문서에는 짧은 발췌와 실행 ID만 남긴다.
- AI 평가 점수는 1차 필터로 기록하되, 사람 리뷰에서 본 문장 품질과 리스크를 반드시 함께 적는다.
- 프롬프트 변경만 기록하지 말고, 후처리 가드레일/temperature/평가 기준 변경도 같은 자산으로 기록한다.

## 기록 템플릿

```md
## YYYY-MM-DD | 짧은 제목

- 연결 목표:
- 튜닝 대상:
- 발견한 문제:
- 변경한 것:
- 검증:
- 결과:
- 남은 리스크:
- 관련 파일:
- 관련 실행 ID:
```

## 2026-05-04 | 상담 결과와 문진해설 품질 가드 확립

- 연결 목표: `G-001-paid-conversion-trust`, `R-001-consult-report-conversion`
- 튜닝 대상: `/api/consult/prescription`의 상담 결과 전체와 `questionAnalysis`
- 발견한 문제:
  - 반복 요구 케이스에서 `100번 틀어줄게`처럼 문제 행동을 강화하는 문장이 나왔다.
  - 차 안 상황에서 안아주기, 다른 노래 찾기처럼 주행 중 제약과 맞지 않는 실천이 나왔다.
  - `가끔 발생한다`, `차를 타기 시작할 때` 같은 중립 답변을 불안/안정감/강한 욕구로 과잉 해석했다.
  - `물어본 적 없어`, `딱히 없어` 같은 약한 답변이 부모가 기회를 놓친 것처럼 읽힐 수 있었다.
  - 문진해설이 처방 근거가 아니라 기질 라벨링처럼 보이는 경우가 있었다.
- 변경한 것:
  - 상담 프롬프트를 `consultPromptBuilders.ts`로 분리하고 테스트 가능한 빌더로 만들었다.
  - `actionItems`를 정확히 3개로 고정하고, `actionItems[0]`을 가장 작은 기본 추천안으로 명시했다.
  - 마찰 대체, 문제 강화 금지, 장면 제약, 첫 실천 타이밍, 금지 제목 규칙을 추가했다.
  - 문진해설 목적을 "기질 라벨 붙이기"에서 "이 처방이 왜 나왔는지 납득시키는 근거"로 재정의했다.
  - 중립/빈도/시점/모름 답변은 정보 해석으로 제한하고, 부모 탓/아이 결핍 표현을 금지했다.
  - `consultPrescriptionGuardrails.ts`를 추가해 모델이 금지 표현을 뱉어도 저장 전 보정하도록 했다.
  - 처방 생성 temperature를 `0.7`에서 `0.45`로 낮췄다.
  - `run-consult-prompt-eval.cjs`와 샘플 케이스를 추가해 반복 평가가 가능하게 했다.
- 검증:
  - `npx jest --runInBand`: 54 tests 통과
  - `npx tsc --noEmit`: 통과
  - `npm run build`: 통과
  - 실제 로컬 상담 케이스 5개 eval 실행
- 결과:
  - 최신 eval `2026-05-03T15-47-21-530Z`에서 5개 케이스 모두 `wowScore=4`, `pass=true`
  - `safetyFlags=[]`, `contractIssues=[]`
  - 차 안 반복 노래 케이스가 `100번 틀어줄게`에서 `한 번 인정 후 다음 순서/경계 제시`로 바뀌었다.
  - `물어본 적 없어` 답변은 부모 평가가 아니라 "아직 확인되지 않은 정보"로 처리하게 됐다.
- 남은 리스크:
  - 문진해설은 안전해진 대신 일부 문장이 담백해졌다. 와우 포인트는 `interpretation`, `chemistry`, `magicWord`, 첫 실천에서 보강해야 한다.
  - 가드레일은 위험 문장을 줄이는 안전장치다. 좋은 상담문 자체를 만드는 핵심은 계속 프롬프트 예시와 케이스 품질이다.
  - 실제 사용자 케이스가 늘어나면 장면별 금지/권장 예시를 계속 확장해야 한다.
- 관련 파일:
  - `app/src/lib/consultPromptBuilders.ts`
  - `app/src/lib/consultPrescriptionGuardrails.ts`
  - `app/scripts/run-consult-prompt-eval.cjs`
  - `app/evals/consultation-prompt-tuning/cases.example.json`
  - `docs/work/prompt-tuning/consultation-result-tuning.md`
  - `docs/work/prompt-tuning/consultation-before-after.md`
  - `docs/product/policies/consultation.md`
- 관련 실행 ID:
  - Before: `2026-05-03T14-35-09-377Z`
  - After: `2026-05-03T15-47-21-530Z`
- 배포:
  - Android production `1.0.1+18`
  - Git commit: `86fca80`, `3bc235e`
