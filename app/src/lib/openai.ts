import OpenAI from 'openai';
import { PARENT_REPORT_PROMPT, CHILD_REPORT_PROMPT } from '@/lib/prompts';

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
    console.warn('OPENAI_API_KEY is not set in environment variables.');
}

export const openai = new OpenAI({
    apiKey: apiKey,
});

export type ReportType = 'PARENT' | 'CHILD';

import { CHILD_QUESTIONS, PARENT_QUESTIONS } from '@/data/questions';

export const generateReport = async (
    userName: string,
    scores: { NS: number; HA: number; RD: number; P: number },
    type: ReportType,
    systemPrompt?: string,
    model: string = 'gpt-4o',
    answers?: { questionId: string; score: number }[]
) => {
    const defaultPrompt = type === 'CHILD' ? CHILD_REPORT_PROMPT : PARENT_REPORT_PROMPT;
    const promptToUse = systemPrompt || defaultPrompt;

    // Scan and Format Q&A if answers provided
    let formattedQnA = '';
    if (answers && answers.length > 0) {
        // 실제 설문 문항(CHILD_QUESTIONS / PARENT_QUESTIONS)에서 텍스트 조회
        const questions = type === 'CHILD' ? CHILD_QUESTIONS : PARENT_QUESTIONS;

        formattedQnA = answers.map(ans => {
            const question = questions.find(q => String(q.id) === String(ans.questionId));
            if (!question) return null;

            const scoreLabels: Record<number, string> = {
                1: '전혀 그렇지 않다',
                2: '그렇지 않다',
                3: '보통이다',
                4: '그렇다',
                5: '매우 그렇다',
            };
            const answerText = `${ans.score}점 (${scoreLabels[ans.score] || '알 수 없음'})`;

            const questionText = question.context || question.text || '(질문 없음)';
            return `Q. ${questionText}\n   A. ${answerText}`;
        }).filter(Boolean).join('\n\n');
    }

    const userMessage = JSON.stringify({
        userName,
        scores,
        type,
        // Note: traits and preferences would typically be calculated before passing to LLM
        // or the LLM can infer them from scores if instructed.
        // For now we just pass scores as per the prompt instructions.
        surveyDetails: formattedQnA // Add the detailed Q&A to the prompt
    });

    const response = await openai.chat.completions.create({
        model: model,
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
