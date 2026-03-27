import OpenAI from 'openai';
import {
    PARENT_REPORT_PROMPT,
    CHILD_REPORT_PROMPT,
    HARMONY_REPORT_PROMPT,
} from '@/lib/prompts';

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
    console.warn('OPENAI_API_KEY is not set in environment variables.');
}

export const openai = new OpenAI({
    apiKey: apiKey,
});

export type ReportType = 'PARENT' | 'CHILD' | 'HARMONY';

import { CHILD_QUESTIONS, PARENT_QUESTIONS, PARENTING_STYLE_QUESTIONS } from '@/data/questions';

export const generateReport = async (
    userName: string,
    scores: any,
    type: ReportType,
    systemPrompt?: string,
    answers?: { questionId: string; score: number }[],
    parentScores?: { NS: number; HA: number; RD: number; P: number },
    childType?: { label: string; keywords: string[] },
    parentType?: { label: string; keywords: string[] }
) => {
    let defaultPrompt = CHILD_REPORT_PROMPT;
    if (type === 'PARENT') defaultPrompt = PARENT_REPORT_PROMPT;
    if (type === 'HARMONY') defaultPrompt = HARMONY_REPORT_PROMPT;

    const promptToUse = systemPrompt || defaultPrompt;

    // Scan and Format Q&A
    let formattedQnA = '';
    if (answers && answers.length > 0) {
        let questions = CHILD_QUESTIONS;
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

    const payload: any = { userName, type, surveyDetails: formattedQnA };
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

    const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
            { role: 'system', content: promptToUse },
            { role: 'user', content: userMessage },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
    });

    const content = response.choices[0].message.content;
    if (!content) return null;

    try {
        const parsed = JSON.parse(content);
        console.log('[generateReport] Parsed keys:', JSON.stringify(Object.keys(parsed)));

        // CHILD 리포트: dimensions가 analysis 밖에 있으면 안으로 이동
        if (type === 'CHILD' && parsed.analysis) {
            if (!parsed.analysis.dimensions && parsed.dimensions) {
                parsed.analysis.dimensions = parsed.dimensions;
                delete parsed.dimensions;
                console.log('[generateReport] Moved top-level dimensions into analysis');
            }
            // insight가 analysis 밖에 있으면 안으로 이동
            if (!parsed.analysis.insight && parsed.insight) {
                parsed.analysis.insight = parsed.insight;
                delete parsed.insight;
            }
            // strengths가 analysis 밖에 있으면 안으로 이동
            if (!parsed.analysis.strengths && parsed.strengths) {
                parsed.analysis.strengths = parsed.strengths;
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

        if (parsed.analysis?.dimensions) {
            console.log('[generateReport] dimensions keys:', JSON.stringify(Object.keys(parsed.analysis.dimensions)));
        } else {
            console.warn('[generateReport] WARNING: analysis.dimensions is missing after normalization!');
        }

        return parsed;
    } catch (e) {
        console.error("JSON Parsing failed for AI report", e);
        return content; // Fallback to raw string if parsing fails
    }
};
