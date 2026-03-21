import OpenAI from 'openai';
import { 
    PARENT_REPORT_PROMPT, 
    CHILD_REPORT_PROMPT, 
    HARMONY_REPORT_PROMPT,
    CHILD_PREVIEW_PROMPT,
    PARENT_PREVIEW_PROMPT,
    HARMONY_PREVIEW_PROMPT
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
    model: string = 'gpt-4o',
    answers?: { questionId: string; score: number }[],
    parentScores?: { NS: number; HA: number; RD: number; P: number },
    isPreview: boolean = false
) => {
    let defaultPrompt = CHILD_REPORT_PROMPT;
    if (type === 'PARENT') defaultPrompt = PARENT_REPORT_PROMPT;
    if (type === 'HARMONY') defaultPrompt = HARMONY_REPORT_PROMPT;

    // 프리뷰 모드일 경우 모델 고정 및 전 전용 프롬프트 사용
    let activeModel = model;
    if (isPreview) {
        activeModel = 'gpt-4o-mini';
        if (type === 'CHILD') defaultPrompt = CHILD_PREVIEW_PROMPT;
        if (type === 'PARENT') defaultPrompt = PARENT_PREVIEW_PROMPT;
        if (type === 'HARMONY') defaultPrompt = HARMONY_PREVIEW_PROMPT;
    }

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
    } else {
        payload.scores = scores;
    }

    const userMessage = JSON.stringify(payload);

    const response = await openai.chat.completions.create({
        model: activeModel,
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
        return JSON.parse(content);
    } catch (e) {
        console.error("JSON Parsing failed for AI report", e);
        return content; // Fallback to raw string if parsing fails
    }
};
