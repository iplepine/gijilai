// ========== Child & Parent Data ==========
export interface Child {
  id?: string;
  name: string;
  gender: 'male' | 'female';
  birthDateTime: Date;
  birthPlace: string;
  ageMonths?: number;
  concerns: Concern[];
}

export type Concern = 'sleep' | 'eating' | 'tantrum' | 'social' | 'learning';

export const CONCERN_LABELS: Record<Concern, string> = {
  sleep: '수면',
  eating: '식사',
  tantrum: '떼쓰기',
  social: '사회성',
  learning: '학습',
};

// ========== Survey Data ==========
export interface SurveyResponse {
  childId?: string;
  parentId?: string;
  cbqScores: Record<string, number>;
  atqScores: Record<string, number>;
  completedAt?: Date;
}

export interface SurveyQuestion {
  id: string;
  text: string;
  factor: 'surgency' | 'negativeAffect' | 'effortfulControl';
  isReverse: boolean;
}

// ========== Temperament Scores ==========
export interface TemperamentScores {
  surgency: number;           // 외향성/활성
  negativeAffect: number;     // 부정적 정서
  effortfulControl: number;   // 의도적 통제
}

export interface TScoreResult extends TemperamentScores {
  percentiles: Record<keyof TemperamentScores, number>;
  levels: Record<keyof TemperamentScores, TScoreLevel>;
}

export type TScoreLevel = '매우 높음' | '높음' | '보통' | '낮음' | '매우 낮음';

// ========== Saju Analysis ==========
export type Element = 'wood' | 'fire' | 'earth' | 'metal' | 'water';
export type TenGod = 'bigyup' | 'siksang' | 'jaesung' | 'gwansung' | 'insung';

export const ELEMENT_LABELS: Record<Element, string> = {
  wood: '목(木)',
  fire: '화(火)',
  earth: '토(土)',
  metal: '금(金)',
  water: '수(水)',
};

export interface SajuAnalysis {
  fourPillars: {
    year: { stem: string; branch: string };
    month: { stem: string; branch: string };
    day: { stem: string; branch: string };
    hour: { stem: string; branch: string };
  };
  elements: Record<Element, number>;
  tenGods: Record<TenGod, number>;
  yongsin: Element;
  dayStem: string;
}

// ========== Goodness of Fit ==========
export type FitType = 'easy_match' | 'synergy_match' | 'energy_mismatch' | 'emotional_strain';

export const FIT_TYPE_LABELS: Record<FitType, { name: string; description: string }> = {
  easy_match: {
    name: '안정적 조화형',
    description: '양육자와 자녀의 기질이 유사하고 부정적 정서가 모두 낮음',
  },
  synergy_match: {
    name: '역동적 보완형',
    description: '기질 차이가 있으나 양육자의 조절 역량이 높음',
  },
  energy_mismatch: {
    name: '에너지 평행선형',
    description: '활동성 차이가 극심하여 생활 리듬이 충돌함',
  },
  emotional_strain: {
    name: '정서적 민감형',
    description: '자녀의 부정적 정서가 높고 양육자의 수용력이 한계에 도달함',
  },
};

// ========== Integrated Analysis ==========
export interface IntegratedAnalysis {
  integratedType: string;
  consistency: 'high' | 'medium' | 'low';
  coreInsight: string;
  latentTalents: string[];
  riskAreas: string[];
  solutionDirection: 'expression' | 'structure' | 'support' | 'balance';
}

// ========== Solutions ==========
export interface Solution {
  category: 'play' | 'script' | 'environment';
  title: string;
  description: string;
  priority: number;
}

export const SOLUTION_CATEGORY_LABELS: Record<Solution['category'], { icon: string; name: string }> = {
  play: { icon: 'rocket_launch', name: '맞춤 놀이 제안' },
  script: { icon: 'chat_bubble', name: '대화 스크립트' },
  environment: { icon: 'home_work', name: '환경 가이드' },
};

// ========== Full Analysis Result ==========
export interface AnalysisResult {
  child: Child;
  childTemperament: TScoreResult;
  parentTemperament: TScoreResult;
  saju: SajuAnalysis;
  fitScore: number;
  fitType: FitType;
  integrated: IntegratedAnalysis;
  solutions: Solution[];
}

// ========== Form State ==========
export interface IntakeFormData {
  privacyAgreed: boolean;
  disclaimerAgreed: boolean;
  childName: string;
  gender: 'male' | 'female' | '';
  birthDate: string;

  birthPlace: string;
  concerns: Concern[];
}
