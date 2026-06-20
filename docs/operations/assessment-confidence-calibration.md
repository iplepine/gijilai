<!-- COMMIT_STATUS START -->
> **커밋 상태**
> - 기준 커밋: `425ffe550f386bbd28c1035ed096ef4c513e3e51` (`claude/enable-phased-assessment`)
> - 최근 커밋: `425ffe550f38` docs: refresh project documentation status
> - 커밋 일시: `2026-06-20T22:38:59+09:00`
> - 워킹트리: `clean`
> - 문서 갱신: `2026-06-20 22:39:28 +0900`
<!-- COMMIT_STATUS END -->

# 기질검사 신뢰도 캘리브레이션 절차

스펙: [phased-temperament-assessment.md](../spec/phased-temperament-assessment.md) §5.4
관련 코드: `app/src/lib/AssessmentConfidence.ts`(소비) · `app/src/lib/assessmentCalibration.ts`(산출) · `app/scripts/calibrate-assessment-confidence.cjs`(러너)

## 왜 필요한가
신뢰도 = "현재 8타입 판정이 맞을 추정 확률"이고, 이 값은 `SE_CONSTANT`(문항 1개의 측정 노이즈, 0–100 스케일)에 좌우된다. 현재 `SE_CONSTANT = 18.0`은 **임의값**이다. 임의값으로 산출한 "신뢰도 X% / 정밀+"를 사용자에게 보여주면 스펙 §5.4가 금지한 **"가짜로 올라가는 신뢰도"(다크패턴)**가 된다. 따라서 실측 데이터로 캘리브레이션하기 전까지 신뢰도 숫자는 노출하지 않는다(`CONFIDENCE_CALIBRATED = false`).

## 근본 순서 (이 순서를 지킨다)
1. **문항 검증** — 새 문항(`childAssessmentBank.ts` id 101–125)은 **DRAFT**다. CBQ/ATQ 정합·연령 적합성·척도 검수를 먼저 끝낸다. 문항이 바뀌면 이전 수집 데이터는 무효가 되므로 **반드시 캘리브레이션 데이터 수집보다 앞선다.**
2. **데이터 수집** — `ASSESSMENT_PHASED_ENABLED = true`(수집 위해 on), `CONFIDENCE_CALIBRATED = false`(신뢰도 숨김). 차원별 표본이 목표치에 도달할 때까지 새 뱅크 응답을 모은다.
3. **캘리브레이션** — `npm run calibrate:assessment` 실행 → 차원별 Cronbach α → SEM → `SE_CONSTANT` 역산. 산출된 신뢰도 분포를 보고 밴드 컷(`CONFIDENCE_BAND_THRESHOLDS`, 현재 0.60/0.80)을 정한다.
4. **검증** — 스펙 §8 테스트(신뢰도 단조성: 문항 추가 시 비경계 차원 상승 / 경계 케이스: 점수=임계값에서 정체)를 통과하는지 확인.
5. **출시** — `assessmentConfig.ts`의 `SE_CONSTANT`·밴드를 갱신하고 `CONFIDENCE_CALIBRATED = true`로 전환 → 실제 신뢰도 라벨 노출 시작.

## 방법론 (러너가 하는 일)
고전검사이론. 차원(NS·HA·RD — typeConfidence가 쓰는 3개)별로:
- 그 차원 문항을 **모두 답한 응답자**만 사용(내적 일관성은 동일 문항셋에서 산출).
- **Cronbach α** = 내적 일관성 신뢰도(역채점 반영).
- **SEM** = `SD × √(1 − α)` — 0–100 정규화 점수의 측정표준오차.
- **SE_CONSTANT** = `SEM × √k` (모델 `dimSE(n) = SE_CONSTANT/√n`에서 n=k 역산).
- 차원별 값의 **중앙값**을 단일 `SE_CONSTANT` 권장값으로 제시(모델은 단일 상수 사용).

수학은 `assessmentCalibration.ts`의 순수 함수이며 `assessmentCalibration.test.ts`로 검증된다(손계산 케이스 포함).

## 표본 기준
- **차원별 N ≥ 150**(러너 `MIN_N`). Cronbach α가 안정되는 실무 최소선. 미만이면 러너가 "표본 부족"으로 보류한다.
- 연령밴드(3–4, 5–7)별로 측정 특성이 다를 수 있으므로, 여유가 되면 밴드별로 분리 산출한다(현재 뱅크는 `ageBand: 'all'`이라 1차 통합 산출 → 밴드 분리는 후속).

## 합격 기준 (출시 게이트)
- [ ] 문항 DRAFT 검수 완료(101–125).
- [ ] 차원별 N ≥ 150 수집.
- [ ] `SE_CONSTANT` 실측 산출, 밴드 컷 결정.
- [ ] 단조성·경계 테스트 통과.
- [ ] `CONFIDENCE_CALIBRATED = true` 전환 PR 리뷰.

## 현재 상태 (2026-06-16)
- 플래그 `ASSESSMENT_PHASED_ENABLED = true`(수집 가능), 마이그레이션 025 prod 적용 완료.
- `CONFIDENCE_CALIBRATED = false` — 신뢰도 라벨 숨김(다크패턴 차단).
- 문항 101–125 **DRAFT 미검수**, 새 뱅크 응답 **미수집** → 1·2단계가 선결.
- 캘리브레이션 인프라(모듈·테스트·러너)는 준비 완료, 데이터가 차면 즉시 산출 가능.
