import OpenAI from 'openai';
import {
    PARENT_REPORT_PROMPT,
    CHILD_REPORT_PROMPT,
    HARMONY_REPORT_PROMPT,
} from '@/lib/prompts';
import { createPerfTracker } from '@/lib/perf';
import { CHILD_QUESTIONS, PARENT_QUESTIONS, PARENTING_STYLE_QUESTIONS } from '@/data/questions';
import { Question } from '@/types/survey';

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
    console.warn('OPENAI_API_KEY is not set in environment variables.');
}

export const openai = new OpenAI({
    apiKey: apiKey,
});

export type ReportType = 'PARENT' | 'CHILD' | 'HARMONY';

type TemperamentScores = { NS: number; HA: number; RD: number; P: number };
type TemperamentSummary = { label: string; keywords: string[] };
type ChildInfo = { name: string; gender: string; birthDate: string };
type ReportPayload = {
    userName: string;
    type: ReportType;
    surveyDetails: string;
    scores?: TemperamentScores;
    childScores?: TemperamentScores;
    parentScores?: TemperamentScores;
    childType?: TemperamentSummary;
    parentType?: TemperamentSummary;
    childInfo?: {
        name: string;
        gender: string;
        age: string;
    };
};

export const generateReport = async (
    userName: string,
    scores: TemperamentScores,
    type: ReportType,
    systemPrompt?: string,
    answers?: { questionId: string; score: number }[],
    parentScores?: TemperamentScores,
    childType?: TemperamentSummary,
    parentType?: TemperamentSummary,
    childInfo?: ChildInfo | null
) => {
    const perf = createPerfTracker('generateReport', {
        type,
        hasAnswers: !!answers?.length,
        hasChildInfo: !!childInfo,
    });

    let defaultPrompt = CHILD_REPORT_PROMPT;
    if (type === 'PARENT') defaultPrompt = PARENT_REPORT_PROMPT;
    if (type === 'HARMONY') defaultPrompt = HARMONY_REPORT_PROMPT;

    const promptToUse = systemPrompt || defaultPrompt;

    // Scan and Format Q&A
    let formattedQnA = '';
    if (answers && answers.length > 0) {
        let questions: Question[] = CHILD_QUESTIONS;
        if (type === 'PARENT') questions = PARENT_QUESTIONS;
        if (type === 'HARMONY') questions = [...CHILD_QUESTIONS, ...PARENT_QUESTIONS, ...PARENTING_STYLE_QUESTIONS];

        formattedQnA = answers.map(ans => {
            const question = questions.find(q => String(q.id) === String(ans.questionId));
            if (!question) return null;

            const scoreLabels: Record<number, string> = {
                1: '전혀 그렇지 않다', 2: '그렇지 않다', 3: '보통이다', 4: '그렇다', 5: '매우 그렇다',
            };
            const answerText = `${ans.score}점 (${scoreLabels[ans.score] || '알 수 없음'})`;
            const questionText = question.context || question.text || '(질문 없음)';
            return `Q. ${questionText}\nA. ${answerText}`;
        }).filter(Boolean).join('\n\n');
    }

    const payload: ReportPayload = { userName, type, surveyDetails: formattedQnA };

    if (childInfo) {
        const calculateAgeMonths = (birthDate: string) => {
            const birth = new Date(birthDate);
            const today = new Date();
            const yearDiff = today.getFullYear() - birth.getFullYear();
            const monthDiff = today.getMonth() - birth.getMonth();
            const dayDiff = today.getDate() - birth.getDate();
            let months = yearDiff * 12 + monthDiff;
            if (dayDiff < 0) months--;
            return Math.max(0, months);
        };
        const months = calculateAgeMonths(childInfo.birthDate);
        const age = Math.floor(months / 12);
        
        payload.childInfo = {
            name: childInfo.name,
            gender: childInfo.gender === 'male' ? '남아' : (childInfo.gender === 'female' ? '여아' : childInfo.gender),
            age: `${age}세 (${months}개월)`
        };
    }

    if (type === 'HARMONY') {
        payload.childScores = scores;
        payload.parentScores = parentScores;
        if (childType) payload.childType = childType;
        if (parentType) payload.parentType = parentType;
    } else {
        payload.scores = scores;
        if (childType) payload.childType = childType;
        if (parentType) payload.parentType = parentType;
    }

    const userMessage = JSON.stringify(payload);
    perf.mark('prompt_prepared', { payloadBytes: userMessage.length });

    const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
            { role: 'system', content: promptToUse },
            { role: 'user', content: userMessage },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
    });
    perf.mark('openai_completion');

    const content = response.choices[0].message.content;
    if (!content) return null;

    try {
        const parsed = JSON.parse(content) as Record<string, unknown>;
        console.log('[generateReport] Parsed keys:', JSON.stringify(Object.keys(parsed)));

        // CHILD 리포트: dimensions가 analysis 밖에 있으면 안으로 이동
        const analysis = (parsed.analysis ?? null) as Record<string, unknown> | null;

        if (type === 'CHILD' && analysis) {
            if (!analysis.dimensions && parsed.dimensions) {
                analysis.dimensions = parsed.dimensions;
                delete parsed.dimensions;
                console.log('[generateReport] Moved top-level dimensions into analysis');
            }
            // insight가 analysis 밖에 있으면 안으로 이동
            if (!analysis.insight && parsed.insight) {
                analysis.insight = parsed.insight;
                delete parsed.insight;
            }
            // strengths가 analysis 밖에 있으면 안으로 이동
            if (!analysis.strengths && parsed.strengths) {
                analysis.strengths = parsed.strengths;
                delete parsed.strengths;
            }
        }

        // CHILD 리포트: analysis가 없지만 dimensions가 top-level에 있으면 analysis 구성
        if (type === 'CHILD' && !parsed.analysis && parsed.dimensions) {
            parsed.analysis = {
                dimensions: parsed.dimensions,
                insight: parsed.insight || [],
                strengths: parsed.strengths || '',
            };
            delete parsed.dimensions;
            delete parsed.insight;
            delete parsed.strengths;
            console.log('[generateReport] Constructed analysis from top-level fields');
        }

        const normalizedAnalysis = (parsed.analysis ?? null) as Record<string, unknown> | null;
        const dimensions = (normalizedAnalysis?.dimensions ?? null) as Record<string, unknown> | null;

        if (dimensions) {
            console.log('[generateReport] dimensions keys:', JSON.stringify(Object.keys(dimensions)));
        } else {
            console.warn('[generateReport] WARNING: analysis.dimensions is missing after normalization!');
        }

        perf.mark('response_parsed');
        return parsed;
    } catch (e) {
        perf.fail(e, { stage: 'json_parse' });
        console.error("JSON Parsing failed for AI report", e);
        return content; // Fallback to raw string if parsing fails
    }
};
