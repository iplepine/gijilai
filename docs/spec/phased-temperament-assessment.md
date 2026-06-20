<!-- COMMIT_STATUS START -->
> **커밋 상태**
> - 기준 커밋: `42ed4d5e3c01012a9599c8ac423810d3beb99831` (`claude/enable-phased-assessment`)
> - 최근 커밋: `42ed4d5e3c01` 차수화 신뢰도 캘리브레이션 인프라 + 미캘리 신뢰도 노출 게이트
> - 커밋 일시: `2026-06-17T08:17:20+09:00`
> - 워킹트리: `dirty (72 files)`
> - 문서 갱신: `2026-06-20 22:33:14 +0900`
<!-- COMMIT_STATUS END -->

# 기질검사 차수화(점진적 심화형) Specification

Status: Draft v1
Date: 2026-06-13
관련 코드: `app/src/data/questions.ts`, `app/src/lib/TemperamentScorer.ts`, `app/src/lib/TemperamentClassifier.ts`, `app/src/lib/db.ts`, `app/src/lib/access.ts`, `app/src/app/survey/page.tsx`, `app/src/app/report/page.tsx`
관련 정책: `docs/product/policies/survey-questions.md`, `temperament-classification.md`, `payment.md`

---

## 1. Problem Statement

현재 아동 기질검사는 차원당 5문항(facet당 1문항)으로 측정 깊이가 얕아 신뢰도가 낮고 facet 단위 인사이트가 불가능하다. 본 기능은 완성형 문항뱅크를 **여러 차수로 쪼개어** 차수를 거칠수록 측정이 정밀해지게 하고, 매 차수가 **그 자체로 완결된 결과(타입+리포트)** 를 제공하며, 완료 후에는 아이 성장에 맞춰 주기적으로 **재평가(longitudinal)** 해 "살아있는 프로파일"을 만든다. 이는 구독 가치를 정당화하는 핵심 리텐션 장치다.

## 2. Goals and Non-Goals

### 2.1 Goals
- 아동 검사 문항뱅크를 ~45문항으로 확장하고 **3차수(15·15·15)** 로 분할한다.
- 차수마다 **실측 신뢰도(통계 기반)** 를 산출·표시한다. 차수를 진행하면 신뢰도가 실제로 올라가야 한다.
- **1차는 무료로 완결**(타입+리포트), **2·3차는 유료(구독/체험 full-access)** 로 게이팅한다.
- 1차에 **타입 변별력이 높은 문항**을 배치해 무료 1차만으로 안정적인 타입이 나오게 한다.
- 완료 후 **주기적 재평가**(기본 90일 또는 연령 구간 변경)와 **점수 시계열 트렌드 리포트**를 제공한다.
- 기존 `surveys`/`reports`/스코어러/분류기/게이팅을 최대한 재사용한다.

### 2.2 Non-Goals
- 부모(PARENT)·양육태도(PARENTING_STYLE) 검사의 차수화 — 아동 검사 파일럿 검증 후 별도 확장(이번 범위 밖, 인터페이스는 type-agnostic하게 둔다).
- 실시간 적응형 문항 선택(IRT 기반 CAT 본격 구현) — 본 스펙은 **고정 차수 블록 + facet 슬롯 로테이션**의 "CAT 라이트"까지만. 문항별 IRT 파라미터 추정은 비목표.
- 신규 결제/구독 플로우 — 기존 `subscriptions` + `access.ts` 게이팅 재사용. 새 결제 수단·상품 없음.
- 실제 문항 카피 집필 — 별도 콘텐츠 산출물(§5.2의 요구사항만 정의). 코드 스펙은 뱅크 스키마·선택 알고리즘까지.

## 3. Change Scope

### 3.1 New Components
- `app/src/lib/AssessmentPhase.ts` (신규): 차수 파생(`completedPhase`), 문항 선택(`selectItems`), 재평가 주기 판정(`reassessmentDue`), 연령 구간(`ageBandOf`). 순수 함수 모듈.
- `app/src/lib/AssessmentConfidence.ts` (신규): 신뢰도 산출(`typeConfidence`, `confidenceBand`) + `erf`/`normalCdf` 헬퍼. 순수 함수 모듈.
- `app/src/lib/assessmentConfig.ts` (신규): §6 설정 상수.
- 성장 트렌드 UI 컴포넌트(신규, `app/src/app/report/` 하위): 점수 시계열 차트. 기존 `chart.js` 의존성 재사용.

### 3.2 Modified Components
- `app/src/data/questions.ts`: `CHILD_QUESTIONS`를 차수 뱅크로 확장(§5.2). 각 문항에 `phase`, `tier`, `ageBand` 메타 추가.
- `app/src/types/survey.ts`: `Question`에 `phase?: 1|2|3`, `tier?: number`, `ageBand?: AgeBand` 추가. `AgeBand` 타입 신설.
- `app/src/lib/db.ts`: `saveSurveyResponses`가 `phase`·`assessment_version` 컬럼도 기록. `getChildAssessmentCycles(userId, childId)`(신규, 트렌드용) 추가. `saveReport`/리포트 조회는 `phase` 포함.
- `app/src/app/survey/page.tsx`: 차수 경계 인지(현재 차수까지만 문항 노출), 차수 완료 시 차수별 완료 모달 + 게이팅 분기.
- `app/src/app/report/page.tsx`: 차수별 리포트 깊이 분기(예비/정밀/정밀+), 신뢰도 인디케이터, 트렌드 섹션, 2·3차 잠금 UI.
- 리포트 생성 API 라우트(아동 리포트 생성 경로): `phase` 파라미터로 깊이 제어 + 서버측 게이팅(§5.6).
- DB 마이그레이션 신규 파일: `docs/operations/migrations/025_assessment_phases.sql`.

### 3.3 Unchanged (Explicit Preservation)
- `TemperamentScorer.calculate` 시그니처·정규화 공식 `(총점/(문항수×5))×100` — **변경 없음**. 가변 문항 수를 이미 지원하므로 차수별 누적 채점이 그대로 동작.
- `TemperamentClassifier`의 8타입 분류 로직·임계값(NS64/HA56/RD60) — **변경 없음**. 신뢰도는 분류 결과에 덧붙는 별도 레이어.
- `surveys`/`reports`의 기존 컬럼·RLS 정책 — **보존**. 신규 컬럼만 추가(default 포함)하며 기존 행/쿼리 호환.
- `access.ts`의 `getFeatureAccess`/`hasFullAccess`/`TRIAL_DAYS=7`/공동양육 게이팅 — **변경 없음**, 그대로 호출만 함.
- 부모·양육태도 검사 플로우 — **변경 없음**.
- 기존 2초 자동저장(`useSurveySync`)·이어하기(`useSurveyRestore`)·재검사(`startFreshSurveyResponses`) — **보존**, 차수 모델이 그 위에 얹힘.

## 4. Data Model

### 4.1 `Question` (확장) — `app/src/types/survey.ts`
```ts
export type AgeBand = '3-4' | '5-7' | 'all';
export interface Question {
  id: number;
  type: SurveyType;              // 'CHILD' | 'PARENT' | 'PARENTING_STYLE' (변경 없음)
  category: string;              // 'NS'|'HA'|'RD'|'P' (변경 없음)
  facet?: string;                // 하위요인 (변경 없음)
  context?: string; text?: string; choices?: string[]; reverse?: boolean; // 변경 없음
  // 신규 (CHILD 차수 뱅크 전용; 그 외 type은 undefined 허용)
  phase?: 1 | 2 | 3;             // 이 문항이 속한 차수
  tier?: number;                 // 타입 변별력 가중(1=최고). 1차 문항 선별 기준
  ageBand?: AgeBand;             // 연령 적합 구간. 미지정 시 'all'로 간주
}
```
- MUST: CHILD 뱅크의 모든 문항은 `phase`와 `facet`이 채워져 있어야 한다(빌드 타임 테스트로 강제, §13).

### 4.2 `surveys` 테이블 (컬럼 추가) — 마이그레이션 `025_assessment_phases.sql`
```sql
alter table public.surveys
  add column if not exists phase integer not null default 0,             -- 이 cycle에서 완료된 최고 차수(0=없음)
  add column if not exists assessment_version text;                       -- 문항 선택 버전/cycle 식별(연령밴드·로테이션 추적)
```
- 의미론: **한 행 = 하나의 assessment cycle**. `answers` jsonb가 그 cycle의 차수들을 누적한다. 새 재평가 cycle은 **새 행**으로 시작(기존 멀티시도/`startFreshSurveyResponses` 모델과 동일) → 시계열 보존.
- `phase`: `completedPhase(...)`(§5.1) 결과를 `saveSurveyResponses`가 기록.
- `status`: `phase == ASSESSMENT_PHASES_CHILD`일 때 `COMPLETED`, 아니면 `IN_PROGRESS`(기존 컬럼 재사용).
- RLS: 신규 컬럼은 기존 행 정책 그대로 적용(추가 정책 불필요). MUST: 마이그레이션 후 기존 RLS로 신규 컬럼 접근됨을 확인.

### 4.3 `reports` 테이블 (컬럼 추가)
```sql
alter table public.reports
  add column if not exists phase integer;                                 -- 이 리포트를 생성한 차수(legacy=null)
```
- 신뢰도 스냅샷은 신규 컬럼 없이 `analysis_json.confidence = { level, pct, perDimension }`에 저장(재계산 가능, 컬럼 churn 최소화).
- 트렌드는 `surveys.scores`(완료 cycle들) 시계열로 산출 → reports에 별도 저장 안 함.

### 4.4 관계
- `child` 1 — N `surveys`(CHILD, cycle별 행) — 각 cycle 0..N `reports`(차수별).
- 트렌드: `child_id` 기준 `status='COMPLETED'` CHILD survey 행을 `created_at` 정렬 → 차원별 점수 시계열.

## 5. Core Behavior

### 5.1 차수 라이프사이클 (State)

cycle 단위 상태 = (`phase` 0..N, `status`). 입력 이벤트별 전이:

| 현재 상태 | 이벤트 | 결과 |
|---|---|---|
| phase=0, IN_PROGRESS | 1차 블록 일부 응답 | answers 누적, phase=0 유지(차수 미완), step 갱신 |
| phase=0, IN_PROGRESS | 1차 블록 **전부** 응답 | phase=1, **1차 리포트 생성**(무료), status=IN_PROGRESS |
| phase=k (k<N) | k+1차 진입 시도, 게이트 통과 | k+1차 문항 노출 |
| phase=k (k<N) | k+1차 진입 시도, 게이트 실패 | 잠금 화면(§5.6), 문항 비노출 |
| phase=k (k<N) | k+1차 블록 전부 응답 | phase=k+1, **(k+1)차 리포트 생성** |
| phase=N | (모든 차수 완료) | status=COMPLETED, 재평가 스케줄(§5.7) |
| status=COMPLETED | `reassessmentDue`=true | 새 cycle 행 생성(새 문항 선택), 위 흐름 반복 |
| 임의 IN_PROGRESS | 이탈 후 복귀 | `useSurveyRestore`로 answers 복원, phase 재파생, 첫 미응답 문항부터 재개(기존 동작) |

차수 파생(MUST, 단일 진실원):
```
function completedPhase(answeredIds, selectedItems, numPhases):
    phase = 0
    for k in 1..numPhases:
        requiredK = selectedItems.filter(it => it.phase <= k).map(it => it.id)
        if requiredK.every(id => answeredIds.has(id)): phase = k
        else: break
    return phase
```

### 5.2 문항뱅크 & 선택 (CAT 라이트)

뱅크 구성(아동 CHILD, MVP 목표):
- 차원별 총 문항: NS 12 / HA 12 / RD 12 / P 9 = **45**. 각 facet(차원당 5 facet)에 2~3문항.
- 차수별 분배(누적): 1차 NS4·HA4·RD4·P3=15 → 2차 +동일=누적30 → 3차 +동일=누적45.
- **1차 우선순위 MUST**: 타입은 NS/HA/RD만 사용하므로(§temperament-classification) 1차는 각 차원에서 **`tier`가 가장 높은(변별력 큰) 문항**을 담아 무료 1차만으로 8타입이 안정적으로 나오게 한다. P는 타입엔 미사용이나 프로파일/조화용으로 분배.
- 연령: 각 문항은 `ageBand`('3-4'|'5-7'|'all'). 동일 (차원,facet) 슬롯에 연령별 변형을 둘 수 있다.

문항 집필 요구(콘텐츠 산출물, 코드 외):
- BARS 5단계 형식·역채점 규칙은 `survey-questions.md` 관례를 따른다. 신규 문항도 facet·역채점 플래그를 명시.
- 로테이션 풀: 동일 (차수,차원,facet,ageBand) 슬롯에 후보가 2개 이상이면 cycle별로 다른 문항이 선택됨(§재평가). MVP는 풀=선택(후보 1개)로 시작 가능하며 스키마/알고리즘은 풀을 지원.

선택 알고리즘(cycle 시작 시 1회):
```
function selectItems(bank, child, cycleIndex, numPhases):
    ageBand = ageBandOf(child.birthDate, now)        // §5.7
    selected = []
    for k in 1..numPhases:
      for (dim, facet) in facetSlotsForPhase(k):     // 설정으로 정의된 (차수→슬롯) 매핑
        candidates = bank.filter(it =>
           it.phase==k && it.category==dim && it.facet==facet &&
           (it.ageBand==ageBand || it.ageBand=='all'))
        if candidates.length == 0: throw BankIncompleteError(k,dim,facet,ageBand)
        chosen = candidates[ cycleIndex % candidates.length ]   // 결정적 로테이션
        selected.push({ ...chosen, phase: k })
    return selected
```
- MUST: 모든 (차수,차원,facet) 슬롯이 채워져야 한다. 비면 `BankIncompleteError` → 빌드/테스트 실패(§13). 런타임 도달 금지.
- `assessment_version`에 `cycleIndex`+`ageBand`+선택 시그니처를 기록해 재현·비교 가능하게 한다.

### 5.3 차수 누적 채점
- 채점은 기존 `TemperamentScorer.calculate(selectedItems, answers)` **그대로** 호출. 응답된 문항만 정규화하므로 1차(부분)→3차(전체)로 자연 정밀화.
- 각 차수 완료 시 그 시점 `answers`로 `scores` 재계산해 `surveys.scores`에 저장.
- 타입은 `TemperamentClassifier.analyzeChild(scores)` **그대로**.

### 5.4 신뢰도 산출 (실측, 다크패턴 금지)

핵심: 신뢰도 = **현재 8타입 판정이 맞을 추정 확률**. 문항이 늘면 차원별 표준오차가 줄어 확률이 오른다. 단, 점수가 임계값 경계에 있으면 문항을 늘려도 낮게 유지되며 이는 **사실대로** 안내한다.

```
// 설정(보정 필요 — §6, MUST: 출시 전 한국인 데이터로 캘리브레이션)
SE_CONSTANT = 18.0                         // 0-100 스케일 문항 노이즈 상수
THRESHOLDS = { NS:64, HA:56, RD:60 }       // TemperamentClassifier에서 단일 출처로 import

erf(x): Abramowitz-Stegun 7.1.26 근사
normalCdf(z): 0.5 * (1 + erf(z / sqrt(2)))

dimSE(n):           return n>0 ? SE_CONSTANT / sqrt(n) : Infinity
dimConfidence(score, T, n):
    se = dimSE(n); if se==Infinity: return 0.5
    return normalCdf( abs(score - T) / se )         // 경계=0.5, 멀수록 →1.0

typeConfidence(scores, counts):                      // 세 차원이 모두 맞아야 타입 정답
    return dimConfidence(scores.NS, T.NS, counts.NS)
         * dimConfidence(scores.HA, T.HA, counts.HA)
         * dimConfidence(scores.RD, T.RD, counts.RD)

confidenceBand(p):
    pct = round(p*100)
    if p < 0.60: return { level:'예비',  pct }
    if p < 0.80: return { level:'정밀',  pct }
    return                { level:'정밀+', pct }
```
- 표시 규칙 MUST:
  - 화면의 "신뢰도 X%"는 `typeConfidence`의 실제 값이어야 한다. **가짜로 올라가는 숫자 금지.**
  - 어떤 차원이 임계값 경계(예: `|score−T| < 5`)면, 차수를 더 해도 신뢰도가 안 오를 수 있음을 **명시**("OO 차원이 경계에 있어 추가 문항으로도 단정이 어려워요")하고 단순 % 만 보여주지 않는다.
- `counts`는 차원별 응답 문항 수(스코어러의 내부 count와 동일 정의).

### 5.5 차수별 리포트 생성
- 차수 완료 이벤트 → 기존 아동 리포트 생성 파이프라인을 `phase` 파라미터와 함께 호출, 깊이 분기:
  - **1차(예비)**: 타입 + 핵심 프로파일 + 신뢰도 배지. 무료.
  - **2차(정밀)**: 점수 정밀화 + **facet 단위 분해** 해금 + 신뢰도 상승. 유료.
  - **3차(정밀+)**: 풀 프로파일 + (부모 검사 완료 시) **부모-자녀 조화**(`analyzeHarmony`) + 최고 신뢰도. 유료.
- 생성 리포트는 `reports`에 `phase`와 함께 저장, `analysis_json.confidence` 포함.
- MUST: 1차 리포트는 **단독 완결**이어야 한다(타입+요약+다음 차수 안내). "반쪽 결과"·"2차 해야 봄" 금지.

### 5.6 게이팅 (1차 무료 / 2·3차 유료)
```
FREE_PHASE_MAX = 1
canAccessPhase(phase, access):                 // access = getFeatureAccess({userCreatedAt, hasSubscription})
    if phase <= FREE_PHASE_MAX: return true     // 1차는 항상 무료
    return access.hasFullAccess                  // 구독 OR 7일 체험(기존 일관)
```
- MUST(서버 강제): "k차(k≥2) 진입" 액션과 **차수별 리포트 생성 API**에서 `getServerFeatureAccessForChild`(공동양육 OR 결합 포함)로 검증. 클라이언트 숨김만으로 불충분.
- 게이트 실패 시: 잠금 화면 + 구독 전환 CTA. 이미 응답한 answers는 **보존**(다운그레이드돼도 손실 없음).
- Fail-closed: 구독 상태 조회 실패/불명 → phase≥2 **거부**. 단 phase 1은 **절대** 막지 않는다.

### 5.7 성장 추적(Longitudinal)
```
REASSESSMENT_INTERVAL_DAYS = 90
ageBandOf(birthDate, at):  // 만나이 → '3-4' | '5-7' (범위 밖은 가장 가까운 밴드로 클램프)
reassessmentDue(latestCompletedCycle, child, now):
    if !latestCompletedCycle: return false
    if (now - latestCompletedCycle.created_at).days >= REASSESSMENT_INTERVAL_DAYS: return true
    if ageBandOf(child.birthDate, latestCompletedCycle.created_at)
       != ageBandOf(child.birthDate, now): return true
    return false
```
- 재평가 due → 홈/리포트에서 "최신화" 제안(+ 푸시; 기존 리텐션 인프라 연동, MVP는 SHOULD). 시작 시 **새 cycle 행** + `selectItems(cycleIndex+1)`로 facet 내 문항 로테이션.
- 트렌드 리포트: `getChildAssessmentCycles`로 완료 cycle 시계열 → 차원별 변화 차트("6개월 전 대비 자극추구 ↑"). 위치: 2차 이상(프리미엄) 노출.
- 비교 가능성 MUST: 로테이션은 **facet 내 문항만 교체**한다. 차원/facet 자체를 cycle 간 제거·교체 금지(시계열 비교 불가해짐).

## 6. Configuration (`app/src/lib/assessmentConfig.ts`)

| 상수 | 타입 | 기본값 | 설명 / 재로드 |
|---|---|---|---|
| `ASSESSMENT_PHASES_CHILD` | int | `3` | 아동 차수 수 |
| `PHASE_ITEM_COUNTS` | int[] | `[15,15,15]` | 차수별 문항 수(누적 45). 합=뱅크 크기와 일치 MUST |
| `FACET_SLOTS_BY_PHASE` | map | §5.2 분배표 | (차수→(차원,facet) 슬롯) 매핑 |
| `FREE_PHASE_MAX` | int | `1` | 무료 최고 차수 |
| `REASSESSMENT_INTERVAL_DAYS` | int | `90` | 재평가 주기 |
| `SE_CONSTANT` | float | `18.0` | 신뢰도 표준오차 상수. **MUST 캘리브레이션** |
| `CONFIDENCE_BANDS` | tuple | `0.60 / 0.80` | 예비/정밀/정밀+ 경계. **MUST 캘리브레이션** |
| `BOUNDARY_MARGIN` | int | `5` | 임계값 경계 안내 발동 폭(\|score−T\|) |
- 모두 빌드 타임 상수(런타임 리로드 없음). 변경은 배포로 반영. 임계값(NS64/HA56/RD60)은 `TemperamentClassifier`에서 단일 출처로 import(중복 정의 금지).

## 7. Integration Contract (구독 게이팅)
- 호출: `getServerFeatureAccessForChild(supabase, { userId, userCreatedAt, childId })` → `.hasFullAccess`.
- 인증: 기존 Supabase 세션/RLS. 신규 외부 호출 없음. 타임아웃/재시도는 기존 DB 클라이언트 정책 그대로. 조회 실패 → fail-closed(§5.6).

## 8. Failure Model and Recovery

| 오류 클래스 | 발생 | 복구 |
|---|---|---|
| `BankIncompleteError` | 선택 시 슬롯 후보 0개 | 빌드/테스트 실패로 사전 차단(§13). 런타임 도달 시 1차 최소셋으로 폴백 + 에러 로깅, 사용자에겐 1차는 진행 |
| 리포트 생성(LLM) 실패 | 차수 경계 생성 중 | answers·phase·scores는 이미 저장됨(손실 없음). 직전 정상 리포트 표시 + 재시도 버튼. phase 되돌리지 않음 |
| 게이팅 조회 실패 | 구독 상태 불명 | phase≥2 거부(fail-closed). phase 1은 영향 없음 |
| 부분 차수 이탈 | 차수 중간 종료 | `status` IN_PROGRESS·phase 불변 유지. 복귀 시 재개(기존) |
| 경계값 점수 | 신뢰도 정체 | 오류 아님. §5.4 경계 안내 카피로 정직하게 표시 |
| 마이그레이션 부분 실패 | 컬럼 추가 실패 | `if not exists`로 멱등. 신규 컬럼 없으면 phase=0 default로 1차만 동작(degrade) |

## 9. Security and Safety Invariants (MUST)
1. **1차는 항상 무료·항상 완결**. 어떤 게이팅·실패도 1차 결과(타입+리포트) 제공을 막지 않는다.
2. **신뢰도는 실측값**. 조작된 상승 숫자 금지. 경계 케이스는 사실대로 안내(§5.4).
3. **phase≥2 게이팅은 서버 강제**. 클라이언트 숨김만으로 불충분.
4. **다운그레이드 무손실**. 구독 만료/체험 종료로 잠겨도 기존 answers·리포트는 보존·열람 가능(생성만 차단).
5. **시계열 비교 보존**. 로테이션은 facet 내 문항만 교체, 차원/facet 불변.
6. **RLS 불변**. 신규 컬럼/쿼리는 기존 user-소유 RLS 안에서만 접근.

## 10. Observability
- analytics 이벤트(기존 `trackEvent` 사용): `assessment_phase_started{phase, cycleIndex}`, `assessment_phase_completed{phase, confidencePct, confidenceLevel}`, `assessment_phase_gate_viewed{phase}`, `assessment_phase_gate_converted{phase}`, `assessment_reassessment_due`, `assessment_reassessment_started`, `assessment_trend_viewed`.
- 서버 로깅: `BankIncompleteError`, 게이팅 거부, 리포트 생성 실패는 경고 로그.

## 11. Interface Contract (신규 핵심 함수)
```ts
// AssessmentPhase.ts
ageBandOf(birthDate: string, at: Date): AgeBand
selectItems(bank: Question[], child: {birthDate:string}, cycleIndex: number, numPhases: number): Question[]
completedPhase(answeredIds: Set<number>, selected: Question[], numPhases: number): number
reassessmentDue(latestCompleted: SurveyData | null, child: {birthDate:string}, now: Date): boolean
// AssessmentConfidence.ts
typeConfidence(scores: ScoreResult, counts: Record<'NS'|'HA'|'RD'|'P', number>): number  // 0..1
confidenceBand(p: number): { level: '예비'|'정밀'|'정밀+'; pct: number }
// db.ts (추가)
getChildAssessmentCycles(userId: string, childId: string): Promise<SurveyData[]> // COMPLETED, created_at asc
```

## 12. Policy Changes (구현 후 `/sync`로 반영)
- `survey-questions.md`: 확장된 뱅크(차수·tier·ageBand 태그, facet당 2~3문항) 반영.
- `temperament-classification.md`: 신뢰도 산출(§5.4)·차수 의미론 추가. 임계값 단일 출처 명시.
- `payment.md`: 1차 무료 / 2·3차 full-access(구독·체험) 게이팅 반영.
- 신규 `docs/product/policies/phased-assessment.md`: 차수 라이프사이클·재평가 주기·트렌드.
- ADR: "차수화·신뢰도·게이팅·재평가 모델" 결정 1건 기록.

## 13. Test and Validation Matrix
| 영역 | 케이스 | 기대 |
|---|---|---|
| 뱅크 완전성 | 모든 (차수,차원,facet,ageBand) 슬롯 | `selectItems` 무오류, `BankIncompleteError` 없음 (빌드 테스트) |
| 차수 파생 | 1차만/일부/전체 응답 | `completedPhase` = 0/1.../N 정확 |
| 누적 채점 | 1차 vs 3차 동일 응답 패턴 | scores가 정의대로 정규화, 타입 일관 |
| 신뢰도 단조성 | 동일 응답에 문항 추가 | 경계 아닌 차원은 `typeConfidence` 증가 |
| 신뢰도 경계 | 점수=임계값 | dimConfidence≈0.5, 경계 안내 발동 |
| 게이팅 | 무료/체험/구독/만료 × phase1/2/3 | phase1 항상 허용, phase≥2는 hasFullAccess만 |
| 다운그레이드 | 체험 종료 후 재방문 | 기존 answers·리포트 열람 가능, 생성만 차단 |
| 재평가 트리거 | 90일 경과 / 연령밴드 변경 | `reassessmentDue`=true, 새 cycle 행 |
| 시계열 | 2개 이상 완료 cycle | 트렌드 차트 차원별 정렬·비교 정확 |
| 마이그레이션 | 기존 행 존재 상태 적용 | 멱등, 기존 행 phase=0, 쿼리 호환 |

---

## Resolved Decisions (2026-06-13 확정)
1. **차수 수**: **3차수**(15·15·15). 1차 완료율 보호 우선. (5차수는 파일럿 검증 후 재고.)
2. **재평가 주기**: **90일 경과 또는 연령밴드 변경** 시 due.
3. **phase≥2 게이팅 기준**: **`hasFullAccess`** — 구독 **또는** 7일 체험. 기존 상담/실천 게이팅과 일관.
4. **트렌드 리포트 위치**: **2차 이상(프리미엄) 묶음**으로 노출.
