import { CHILD_QUESTIONS, PARENT_QUESTIONS } from '@/data/questions';
import { TemperamentClassifier } from '@/lib/TemperamentClassifier';
import { TemperamentScorer } from '@/lib/TemperamentScorer';
import { extractReportScores, isTemperamentScores, parseAnswerMap, type TemperamentScores } from '@/lib/home';
import type { createClient } from '@/lib/supabaseServer';

type Supabase = Awaited<ReturnType<typeof createClient>>;
type SurveyType = 'CHILD' | 'PARENT';

export type ConsultTemperamentProfile = {
    label: string;
    keywords: string[];
    description: string;
    image: string;
    scores: TemperamentScores;
};

export type ConsultChildBasics = {
    id: string;
    name: string;
    birthDate: string;
    gender: 'male' | 'female';
};

export async function getOwnedConsultChild(
    supabase: Supabase,
    userId: string,
    childId?: string | null,
): Promise<ConsultChildBasics | null> {
    if (!childId) return null;

    const { data, error } = await supabase
        .from('children')
        .select('id, name, birth_date, gender')
        .eq('id', childId)
        .eq('parent_id', userId)
        .maybeSingle();

    if (error || !data) return null;

    return {
        id: data.id,
        name: data.name,
        birthDate: data.birth_date,
        gender: data.gender,
    };
}

export async function resolveConsultTemperamentProfile(
    supabase: Supabase,
    params: {
        userId: string;
        type: SurveyType;
        childId?: string | null;
        fallback?: ConsultTemperamentProfile | null;
    },
): Promise<ConsultTemperamentProfile | null> {
    const scores = await resolveTemperamentScores(supabase, params);
    if (scores) {
        const result = params.type === 'CHILD'
            ? TemperamentClassifier.analyzeChild(scores)
            : TemperamentClassifier.analyzeParent(scores);

        return {
            label: result.label,
            keywords: result.keywords,
            description: result.desc,
            image: result.image,
            scores,
        };
    }

    if (params.type === 'CHILD' && params.childId) return null;

    return params.fallback ?? null;
}

async function resolveTemperamentScores(
    supabase: Supabase,
    params: {
        userId: string;
        type: SurveyType;
        childId?: string | null;
    },
): Promise<TemperamentScores | null> {
    const surveyScores = await getLatestSurveyScores(supabase, params);
    if (surveyScores) return surveyScores;

    const reportScores = await getLatestReportScores(supabase, params);
    if (reportScores) return reportScores;

    return null;
}

async function getLatestSurveyScores(
    supabase: Supabase,
    params: {
        userId: string;
        type: SurveyType;
        childId?: string | null;
    },
): Promise<TemperamentScores | null> {
    if (params.type === 'CHILD' && !params.childId) return null;

    let query = supabase
        .from('surveys')
        .select('scores, answers')
        .eq('user_id', params.userId)
        .eq('type', params.type)
        .eq('status', 'COMPLETED');

    if (params.type === 'CHILD') {
        query = query.eq('child_id', params.childId);
    }

    const { data, error } = await query
        .order('updated_at', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(5);

    if (error || !data) return null;

    for (const row of data) {
        if (isTemperamentScores(row.scores)) return row.scores;

        const answers = parseAnswerMap(row.answers);
        if (answers) {
            return TemperamentScorer.calculate(
                params.type === 'CHILD' ? CHILD_QUESTIONS : PARENT_QUESTIONS,
                answers,
            );
        }
    }

    return null;
}

async function getLatestReportScores(
    supabase: Supabase,
    params: {
        userId: string;
        type: SurveyType;
        childId?: string | null;
    },
): Promise<TemperamentScores | null> {
    if (params.type === 'CHILD' && !params.childId) return null;

    let query = supabase
        .from('reports')
        .select('analysis_json')
        .eq('user_id', params.userId)
        .eq('type', params.type);

    if (params.type === 'CHILD') {
        query = query.eq('child_id', params.childId);
    }

    const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(5);

    if (error || !data) return null;

    for (const row of data) {
        const scores = extractReportScores(row.analysis_json);
        if (scores) return scores;
    }

    return null;
}
