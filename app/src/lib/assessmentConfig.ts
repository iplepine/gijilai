// 기질검사 차수화(점진적 심화형) 설정 상수.
// 스펙: docs/spec/phased-temperament-assessment.md §6
//
// 주의: SE_CONSTANT / CONFIDENCE_BAND_THRESHOLDS / TYPE_THRESHOLDS 는
// 출시 전 한국인 데이터로 캘리브레이션이 필요하다(스펙 §5.4 MUST).

/**
 * 차수화 플로우 활성 플래그. 기본 off — 켜질 때만 라이브 아동 검사가 차수 UI를 쓴다.
 * (off 동안 기존 20문항 검사 그대로 동작 → 라이브 무손상.)
 */
export const ASSESSMENT_PHASED_ENABLED = false;

/** 아동 검사 차수 수 */
export const ASSESSMENT_PHASES_CHILD = 3;

/** 차수별 문항 수(누적 45). 합은 문항뱅크 크기와 일치해야 한다. */
export const PHASE_ITEM_COUNTS: readonly number[] = [15, 15, 15];

/** 무료로 제공되는 최고 차수. 이 차수 이하는 항상 무료. */
export const FREE_PHASE_MAX = 1;

/** 재평가 주기(일). 이 기간 경과 또는 연령밴드 변경 시 재평가 due. */
export const REASSESSMENT_INTERVAL_DAYS = 90;

/** 신뢰도 표준오차 상수(0-100 스케일). 문항이 늘수록 SE = SE_CONSTANT/sqrt(n) 로 감소. */
export const SE_CONSTANT = 18.0;

/** 신뢰도 등급 경계: p<precise → 예비, p<precisePlus → 정밀, 그 이상 → 정밀+. */
export const CONFIDENCE_BAND_THRESHOLDS = { precise: 0.6, precisePlus: 0.8 } as const;

/** 점수가 임계값에서 이 폭(|score-threshold|) 안에 있으면 "경계" 안내를 발동. */
export const BOUNDARY_MARGIN = 5;

/**
 * 8타입 분류 임계값(신뢰도 레이어용 사본).
 * MUST: TemperamentClassifier 의 분류 임계값(NS>64, HA>56, RD>60)과 항상 일치시킨다.
 */
export const TYPE_THRESHOLDS = { NS: 64, HA: 56, RD: 60 } as const;
