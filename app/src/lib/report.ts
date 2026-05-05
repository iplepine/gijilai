import type { Json } from '@/types/supabase';

export type ReportTab = 'child' | 'parent' | 'parenting';

export type TemperamentScores = {
    NS: number;
    HA: number;
    RD: number;
    P: number;
};

export type ParentingStyleScores = {
    Efficacy: number;
    Autonomy: number;
    Responsiveness: number;
};

export type ReportScoreKey = keyof TemperamentScores;

const DIMENSION_KEY_ALIASES: Record<string, ReportScoreKey> = {
    ns: 'NS',
    noveltyseeking: 'NS',
    '자극추구': 'NS',
    '새로움추구': 'NS',
    ha: 'HA',
    harmavoidance: 'HA',
    '위험회피': 'HA',
    '손상회피': 'HA',
    rd: 'RD',
    rewarddependence: 'RD',
    '사회적민감성': 'RD',
    '보상의존': 'RD',
    p: 'P',
    persistence: 'P',
    '인내력': 'P',
    '지속성': 'P',
};

function normalizeDimensionKey(key: string): ReportScoreKey | null {
    return DIMENSION_KEY_ALIASES[key.replace(/[\s_-]/g, '').toLowerCase()] ?? null;
}

export function normalizeTemperamentDimensions(
    dimensions: Record<string, unknown> | null | undefined,
): Partial<Record<ReportScoreKey, string>> | undefined {
    if (!dimensions || typeof dimensions !== 'object') return undefined;

    const normalized: Partial<Record<ReportScoreKey, string>> = {};
    Object.entries(dimensions).forEach(([key, value]) => {
        const scoreKey = normalizeDimensionKey(key);
        if (!scoreKey || typeof value !== 'string' || value.trim().length === 0) return;
        normalized[scoreKey] = value;
    });

    return Object.keys(normalized).length > 0 ? normalized : undefined;
}

export type ChildInsightItem = {
    scene: string;
    content: string;
};

export type ParentingTip = {
    situation: string;
    tips?: string[];
};

export type ScriptTip = {
    situation: string;
    script: string;
    guide: string;
};

export type ParentSceneItem = {
    scene: string;
    content: string;
};

export type ParentSolution = {
    name: string;
    action: string;
    reason: string;
};

export type ParentSection = {
    id: string;
    content?: string;
};

export type HarmonyPairAnalysis = {
    label: string;
    childScore: number;
    parentScore: number;
    insight: string;
    reframe?: string;
    strength?: string;
};

export type HarmonyPrinciple = {
    title: string;
    why: string;
    do: string;
    dont: string;
};

export type HarmonySituationalTip = {
    situation: string;
    childFeeling: string;
    parentTrap: string;
    betterResponse: string;
    script: string;
};

export type HarmonyParentingAudit = {
    currentStyle: string;
    evaluation: string;
    adjustment: string;
};

export type ChildAiReport = {
    title?: string;
    intro?: string;
    analysis?: {
        dimensions?: Partial<Record<ReportScoreKey, string>>;
        insight?: string | ChildInsightItem[];
        strengths?: string;
    };
    parentingTips?: ParentingTip[];
    scripts?: ScriptTip[];
    shareText?: string;
};

export type ParentAiReport = {
    intro?: string;
    dimensions?: Partial<Record<ReportScoreKey, string>>;
    shining?: string;
    sections?: ParentSection[];
    parentingStyle?: ParentSceneItem[];
    vulnerability?: string;
    solutions?: ParentSolution[];
    letter?: string;
};

export type HarmonyAiReport = {
    harmonyTitle?: string;
    oneLiner?: string;
    compatibilityScore?: number;
    dynamics?: { description?: string };
    coreGap?: HarmonyPairAnalysis;
    coreMatch?: HarmonyPairAnalysis;
    parentingPrinciples?: HarmonyPrinciple[];
    situationalTips?: HarmonySituationalTip[];
    parentingAudit?: HarmonyParentingAudit;
    dailyReminder?: string;
};

export type ReportDates = Partial<Record<ReportTab, string>>;

export type ReportApiPayload = {
    userName: string;
    scores: TemperamentScores;
    type: 'CHILD' | 'PARENT' | 'HARMONY';
    answers: Array<{ questionId: string; score: number }>;
    refresh?: boolean;
    childId?: string | null;
    parentScores?: TemperamentScores;
    styleScores?: ParentingStyleScores;
    isPreview?: boolean;
    childType?: { label: string; keywords: string[]; desc?: string };
    parentType?: { label: string; keywords: string[]; desc?: string };
};

export type ReportApiResult = {
    report: Json;
    reportId?: string;
    createdAt: string;
    persisted?: boolean;
};

type JsonRecord = Record<string, Json | undefined>;

function isJsonRecord(value: Json | null | undefined): value is JsonRecord {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function asChildAiReport(value: Json | null | undefined): ChildAiReport | null {
    if (!isJsonRecord(value)) return null;

    const report = value as unknown as ChildAiReport;
    const dimensions = normalizeTemperamentDimensions(report.analysis?.dimensions);
    if (!dimensions) return report;

    return {
        ...report,
        analysis: {
            ...report.analysis,
            dimensions,
        },
    };
}

export function asParentAiReport(value: Json | null | undefined): ParentAiReport | null {
    if (!isJsonRecord(value)) return null;

    const report = value as unknown as ParentAiReport;
    const dimensions = normalizeTemperamentDimensions(report.dimensions);
    if (!dimensions) return report;

    return {
        ...report,
        dimensions,
    };
}

export function asHarmonyAiReport(value: Json | null | undefined): HarmonyAiReport | null {
    return isJsonRecord(value) ? (value as unknown as HarmonyAiReport) : null;
}

export function getParentSectionContent(report: ParentAiReport | null, id: string): string | undefined {
    return report?.sections?.find((section) => section.id === id)?.content;
}

export function sanitizeQuotedText(value: string): string {
    return value.replace(/^["“”]+|["“”]+$/g, '');
}
