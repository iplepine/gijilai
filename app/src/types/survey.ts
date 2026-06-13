export type SurveyType = 'CHILD' | 'PARENT' | 'PARENTING_STYLE';

/** 연령 적합 구간. 'all' = 모든 연령. 스펙 §5.2 */
export type AgeBand = '3-4' | '5-7' | 'all';

export interface Question {
    id: number;
    text?: string; // Legacy text or used as context title
    context?: string; // BARS situation
    type: SurveyType;
    category: string;
    facet?: string;
    reverse?: boolean;
    // BARS 5-step descriptions
    choices?: string[]; // Array of 5 strings corresponding to score 1..5
    // --- 차수화(점진적 심화형) 메타. CHILD 차수 뱅크 전용; 그 외 type 은 undefined 허용 ---
    phase?: 1 | 2 | 3; // 이 문항이 속한 차수
    tier?: number; // 타입 변별력 가중(1=최고). 1차 문항 선별 기준
    ageBand?: AgeBand; // 연령 적합 구간. 미지정 시 'all' 로 간주
}

export interface Answer {
    questionId: number;
    score: number; // 1-5
}

export interface SurveyResult {
    childTemperament: {
        NS: number;
        HA: number;
        RD: number;
        P: number;
    };
    parentTemperament: {
        NS: number;
        HA: number;
        RD: number;
        P: number;
    };
    parentingStyle: {
        efficacy: number;
        autonomy: number;
        responsiveness: number;
    };
    bciScore: number;
}
