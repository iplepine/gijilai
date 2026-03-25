import { NextResponse } from 'next/server';
import { openai } from '@/lib/openai';
import { createClient } from '@/lib/supabaseServer';

function formatObservationsForPrompt(observations: any[]): string {
    return observations.map((obs: any) => {
        const date = new Date(obs.created_at).toLocaleDateString('ko-KR');
        let entry = `[${date}] 상황: ${obs.situation} → 양육자 행동: ${obs.my_action} → 아이 반응: ${obs.child_reaction}`;
        if (obs.note) {
            entry += ` (메모: ${obs.note})`;
        }
        return entry;
    }).join('\n');
}

function formatSessionContextForPrompt(sessionContext: any): string {
    if (!sessionContext) return '';

    let context = `\n\n**[이전 상담 맥락 — 추가 상담]**\n`;
    context += `세션 주제: ${sessionContext.session.title}\n`;

    // 최근 3건 상담만 상세
    const consultations = sessionContext.consultations || [];
    const recent = consultations.slice(-3);

    for (const c of recent) {
        const date = new Date(c.created_at).toLocaleDateString('ko-KR');
        context += `\n[${date} 상담]\n`;
        context += `고민: ${c.problem_description}\n`;
        if (c.ai_prescription) {
            const rx = c.ai_prescription;
            if (rx.interpretation) context += `속마음 통역: ${rx.interpretation.substring(0, 200)}...\n`;
            if (rx.magicWord) context += `마법의 한마디: ${rx.magicWord}\n`;
            // questionAnalysis 요약
            if (rx.questionAnalysis && rx.questionAnalysis.length > 0) {
                context += `문진 해설:\n`;
                for (const qa of rx.questionAnalysis) {
                    context += `  Q: ${qa.question} → A: ${qa.answer} → ${qa.analysis}\n`;
                }
            }
        }
    }

    // 실천 기록 요약
    const practices = sessionContext.practices || [];
    if (practices.length > 0) {
        context += `\n[실천 기록]\n`;
        const logs = sessionContext.logs || [];
        const reviews = sessionContext.reviews || [];
        for (const p of practices) {
            const practiceLogs = logs.filter((l: any) => l.practice_id === p.id);
            const doneDays = practiceLogs.filter((l: any) => l.done).length;
            const review = reviews.find((r: any) => r.practice_id === p.id);
            context += `- ${p.title} | ${doneDays}/${p.duration}일 실천 (${p.status})`;
            if (review) context += ` | 회고: ${review.content}`;
            context += `\n`;
        }
    }

    return context;
}

export async function POST(request: Request) {
    try {
        const supabase = await createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { problem, questions, answers, childProfile, parentProfile, childName, recentObservations, sessionContext } = await request.json();

        if (!problem || !answers) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        const nameContext = childName ? `${childName} 아이` : '아이';
        const isFollowUp = !!sessionContext;

        const systemPrompt = `당신은 기질(TCI) 기반의 분석 전문가이자 따뜻한 마음 통역사입니다.
아이의 기질, 양육자의 기질, 그리고 구체적인 상황 문진 결과를 분석하여 이 갈등의 근본적인 원인을 친절하게 설명하고 실천 가능한 솔루션을 제공하세요.

**[분석 재료]**
- 대상: ${nameContext}
${childProfile ? `- 아이 기질 유형: ${childProfile.label} (${childProfile.keywords.join(', ')})
  - 설명: ${childProfile.description}
  - 차원별 점수 (0~100): 자극추구=${childProfile.scores.NS}, 위험회피=${childProfile.scores.HA}, 사회적민감성=${childProfile.scores.RD}, 지속성=${childProfile.scores.P}` : '- 아이 기질: 검사 데이터 없음 (보편적 아동 기질로 분석)'}
${parentProfile ? `- 양육자 기질 유형: ${parentProfile.label} (${parentProfile.keywords.join(', ')})
  - 설명: ${parentProfile.description}
  - 차원별 점수 (0~100): 자극추구=${parentProfile.scores.NS}, 위험회피=${parentProfile.scores.HA}, 사회적민감성=${parentProfile.scores.RD}, 지속성=${parentProfile.scores.P}` : '- 양육자 기질: 검사 데이터 없음 (보편적 양육자 기질로 분석)'}
- 고민 상황: ${problem}
- 문진 질문과 답변:
${questions && questions.length > 0 ? questions.map((q: any) => `  Q: ${q.text}\n  A: ${answers[q.id] || '(미응답)'}`).join('\n') : JSON.stringify(answers)}${recentObservations && recentObservations.length > 0 ? `
- 최근 양육 관찰 기록:
${formatObservationsForPrompt(recentObservations)}` : ''}${formatSessionContextForPrompt(sessionContext)}

**[응답 가이드]**
1. **아이의 속마음 통역 (interpretation)**: 아이가 직접 이야기하는 것처럼 아이의 말투로 속마음을 표현하세요. 예: "나는 게임에서 지면 너무 무서워요. 잘하고 싶은 마음이 너무 크거든요. 그런데 지면 그 마음이 한꺼번에 터져서 울음이 나와요..." 식으로 아이의 1인칭 시점에서 기질적 욕구를 자연스럽게 담아 설명하세요. 문진 답변에서 드러난 구체적 상황을 반영하되, 아이의 눈높이에 맞는 단어와 표현을 사용하세요. (5~7줄로 충분히 상세하게)
2. **아이와 나 (chemistry)**: 양육자를 탓하지 마세요. 문진 답변에서 나타난 양육자의 대응 방식과 아이의 반응 패턴을 연결하여, 기질 간 역동으로 설명하세요. "~한 상황에서 양육자님이 ~하신 것은 자연스러운 반응이지만, 아이의 ~한 기질과 만나면..." 식으로 구체적으로 분석하세요. (4~6줄)
3. **문진 해설 (questionAnalysis)**: 각 문진 질문과 양육자의 답변을 기질 관점에서 해설하세요. 각 항목은 질문 원문(question), 답변 원문(answer), 그리고 해설(analysis)로 구성합니다. 해설은 "이 답변에서 아이의 ~한 기질적 특성이 드러납니다" 또는 "~한 반응은 ~한 기질 욕구와 관련이 있습니다" 식으로 1~2줄로 작성하세요.
4. **오늘의 한마디 (magicWord)**: 이 상황에서 아이에게 바로 해볼 수 있는 구체적인 대화 스크립트를 제공하세요. 따옴표는 포함하지 마세요.
5. **실천 항목 (actionItems)**: 정확히 3개의 실천 항목을 제안하세요. 양육자가 이 중에서 자신의 생활에 맞는 것을 골라 실천합니다. 각 항목에는 다음을 포함합니다:
   - title: 구체적 행동을 한 줄로 표현 (예: "잠들기 전 책 10분 더 읽기", "장난감 교환 놀이"). 난이도 라벨이 아닌 실제 행동명이어야 합니다.
   - description: 실천 방법 상세 설명
   - duration: 권장 기간 (일 단위 1~14). 항목마다 적절한 기간을 다르게 설정하세요.
   - encouragement: 기간 안내 응원 메시지. 숙제가 아닌 응원 톤으로.
   - 3개 항목은 서로 다른 접근 방식이어야 합니다. 모두 동등하게 효과적인 방법이고, 양육자의 상황에 맞는 것을 고를 수 있도록 제안하세요.${isFollowUp ? `
6. **실천 기록 연계**: 이전 상담의 실천 기록을 참고하여, 효과적이었던 방법은 강화하고 효과 없었던 것은 다른 접근을 제안하세요. "지난번에 ~를 시도하셨는데"와 같이 자연스럽게 언급하세요.` : recentObservations && recentObservations.length > 0 ? `
6. **관찰 기록 연계**: 양육자의 최근 관찰 기록을 참고하여, 이전에 시도한 방법 중 효과적이었던 것은 강화하고 효과가 없었던 것은 다른 접근을 제안하세요. 관찰 기록이 있으면 "지난번에 ~를 시도하셨는데"와 같이 자연스럽게 언급하세요.` : ''}
${!isFollowUp ? `7. **세션 제목 (sessionTitle)**: 이 고민을 한 줄(15자 이내)로 요약한 제목을 생성하세요. 예: "어린이집 분리불안", "형제 장난감 싸움", "밥 안 먹는 문제"` : ''}

**[중요]**
- 모든 분석에서 문진 답변의 구체적 내용을 근거로 활용하세요. 추상적이고 일반적인 조언이 아닌, 이 양육자의 상황에 딱 맞는 맞춤 분석이어야 합니다.
- "~라고 답변해 주셨는데", "문진에서 ~한 경향이 보이는데" 등의 표현으로 답변을 자연스럽게 인용하세요.
- 절대 NS, HA, RD, P, TCI 같은 영문 약어를 사용하지 마세요. 한글 용어(자극추구, 위험회피, 사회적민감성, 인내력)를 사용하세요.

**[Output Format (JSON Only)]**
{
  "interpretation": "아이의 속마음 번역 (5~7줄, 문진 답변 근거 포함)...",
  "chemistry": "기질 간의 충돌 지점 설명 (4~6줄, 문진 답변 근거 포함)...",
  "questionAnalysis": [
    { "question": "질문 원문", "answer": "답변 원문", "analysis": "기질 관점 해설 1~2줄" }
  ],
  "magicWord": "아이에게 바로 해볼 수 있는 대화 스크립트",
  "actionItems": [
    { "title": "구체적 행동명", "description": "실천 방법", "duration": 5, "encouragement": "응원" },
    { "title": "다른 접근의 행동명", "description": "실천 방법", "duration": 7, "encouragement": "응원" },
    { "title": "또 다른 접근의 행동명", "description": "실천 방법", "duration": 10, "encouragement": "응원" }
  ]${!isFollowUp ? `,
  "sessionTitle": "고민 요약 제목 (15자 이내)"` : ''}
}

주의: JSON 형식만 출력하세요. markdown 기호 없이 순수 JSON 문자열만 반환해야 합니다.`;

        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: systemPrompt }
            ],
            temperature: 0.7,
            response_format: { type: "json_object" }
        });

        const content = response.choices[0].message.content;
        const parsed = JSON.parse(content || '{}');

        // 하위 호환: actionItem 필드 유지
        if (parsed.actionItems && parsed.actionItems.length > 0 && !parsed.actionItem) {
            parsed.actionItem = parsed.actionItems[0].description;
        }

        return NextResponse.json(parsed);
    } catch (error) {
        console.error('Error generating prescription:', error);
        return NextResponse.json(
            { error: 'Failed to generate prescription' },
            { status: 500 }
        );
    }
}
