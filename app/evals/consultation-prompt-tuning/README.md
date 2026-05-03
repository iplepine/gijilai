# 상담 결과 프롬프트 튜닝 하네스

이 폴더는 상담 결과, 즉 `/api/consult/prescription` 단계의 프롬프트 품질을 반복 평가하기 위한 샘플 케이스와 실행 스크립트를 둔다.

## 기본 실행

```bash
cd /Users/basil/Projects/gijilai/app
npm run eval:consult -- --limit 1 --dry-run
```

실제 OpenAI 호출과 AI 평가를 함께 돌릴 때:

```bash
cd /Users/basil/Projects/gijilai/app
npm run eval:consult -- --model gpt-4o-mini --eval-model gpt-4o-mini
```

결과는 `evals/consultation-prompt-tuning/runs/` 아래에 JSON과 Markdown으로 남는다. 이 디렉터리는 git에 올리지 않는다.

## 개인 사례 파일

실제 사용자/가족 데이터는 `cases.example.json`에 넣지 않는다. 로컬에서만 쓰는 사례는 `cases.local.json`에 둔다.

```bash
cd /Users/basil/Projects/gijilai/app
npm run eval:consult -- --cases evals/consultation-prompt-tuning/cases.local.json
```

`cases.local.json`도 git에 올리지 않는다.

## 케이스 설계 기준

각 케이스는 상담 결과가 만족스럽게 느껴져야 하는 가설을 명시한다.

- `userWowHypothesis`: 사용자가 어떤 순간에 "내 상황을 알아봤다"고 느낄지
- `successSignals`: 결과에 반드시 드러나야 하는 신호
- `riskSignals`: 신뢰를 깎거나 정책을 어길 위험
- `request`: 실제 prescription 프롬프트에 들어갈 입력

좋은 케이스는 단순 고민 문장만 넣지 않는다. 문진 질문과 답변, 아이/양육자 기질, 연령, 최근 실천 기록이 함께 있어야 프롬프트가 "근거 있는 개인화"를 하는지 볼 수 있다.

## 평가 해석

AI 평가는 최종 판단이 아니라 1차 필터다. 특히 다음 항목은 사람이 다시 읽어야 한다.

- `wowScore`: 저장하고 실천하고 싶게 만드는가
- `contractIssues`: JSON 구조, 실천 항목 3개, 기본 추천안 문제
- `safetyFlags`: 진단/치료/정상·비정상/성별 고정관념/기질 코드 노출
- `revisionHints`: 다음 프롬프트 수정 후보

튜닝은 한 번에 여러 프롬프트를 크게 바꾸기보다, 케이스 3~5개에서 반복되는 약점 하나만 고쳐 다시 돌린다.
