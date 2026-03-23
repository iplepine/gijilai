import { NextResponse } from 'next/server';
import { openai } from '@/lib/openai';

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

export async function POST(request: Request) {
    try {
        const { problem, questions, answers, childProfile, parentProfile, harmonyAnalysis, childName, recentObservations } = await request.json();

        if (!problem || !answers) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        const nameContext = childName ? `${childName} 아이` : '아이';

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
${harmonyAnalysis ? `- 양육자-아이 기질 조화: 가장 큰 차이 차원 = "${harmonyAnalysis.title}" (차이 ${harmonyAnalysis.score}점)
  - ${harmonyAnalysis.desc}` : ''}
- 고민 상황: ${problem}
- 문진 질문과 답변:
${questions && questions.length > 0 ? questions.map((q: any) => `  Q: ${q.text}\n  A: ${answers[q.id] || '(미응답)'}`).join('\n') : JSON.stringify(answers)}${recentObservations && recentObservations.length > 0 ? `
- 최근 양육 관찰 기록:
${formatObservationsForPrompt(recentObservations)}` : ''}

**[응답 가이드]**
1. **아이의 속마음 통역 (interpretation)**: 아이가 직접 이야기하는 것처럼 아이의 말투로 속마음을 표현하세요. 예: "나는 게임에서 지면 너무 무서워요. 잘하고 싶은 마음이 너무 크거든요. 그런데 지면 그 마음이 한꺼번에 터져서 울음이 나와요..." 식으로 아이의 1인칭 시점에서 기질적 욕구를 자연스럽게 담아 설명하세요. 문진 답변에서 드러난 구체적 상황을 반영하되, 아이의 눈높이에 맞는 단어와 표현을 사용하세요. (5~7줄로 충분히 상세하게)
2. **아이와 나 (chemistry)**: 양육자를 탓하지 마세요. 문진 답변에서 나타난 양육자의 대응 방식과 아이의 반응 패턴을 연결하여, 기질 간 역동으로 설명하세요. "~한 상황에서 양육자님이 ~하신 것은 자연스러운 반응이지만, 아이의 ~한 기질과 만나면..." 식으로 구체적으로 분석하세요. (4~6줄)
3. **마법의 한마디 (magicWord)**: 상황을 반전시킬 수 있는 구체적인 대화 스크립트를 제공하세요. 따옴표는 포함하지 마세요.
4. **문진 해설 (questionAnalysis)**: 각 문진 질문과 양육자의 답변을 기질 관점에서 해설하세요. 각 항목은 질문 원문(question), 답변 원문(answer), 그리고 해설(analysis)로 구성합니다. 해설은 "이 답변에서 아이의 ~한 기질적 특성이 드러납니다" 또는 "~한 반응은 ~한 기질 욕구와 관련이 있습니다" 식으로 1~2줄로 작성하세요.
5. **데일리 액션 아이템 (actionItem)**: 오늘 혹은 내일부터 바로 실천할 수 있는 아주 구체적이고 작은 행동 하나를 제안하세요. 문진에서 파악된 구체적 상황에 맞춘 실천 과제를 제시하세요.${recentObservations && recentObservations.length > 0 ? `
6. **관찰 기록 연계**: 양육자의 최근 관찰 기록을 참고하여, 이전에 시도한 방법 중 효과적이었던 것은 강화하고 효과가 없었던 것은 다른 접근을 제안하세요. 관찰 기록이 있으면 "지난번에 ~를 시도하셨는데"와 같이 자연스럽게 언급하세요.` : ''}

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
  "magicWord": "실제 대화문...",
  "actionItem": "구체적 실천 과제..."
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
        return NextResponse.json(JSON.parse(content || '{}'));
    } catch (error) {
        console.error('Error generating prescription:', error);
        return NextResponse.json(
            { error: 'Failed to generate prescription' },
            { status: 500 }
        );
    }
}
