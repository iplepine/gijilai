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
    const { problem, childName, childProfile, parentProfile, recentObservations } = await request.json();

    if (!problem) {
      return NextResponse.json(
        { error: 'Missing required field: problem' },
        { status: 400 }
      );
    }

    const nameContext = childName ? `${childName} 아이의 양육자이고, ` : '';

    const systemPrompt = `당신은 아동 심리 및 기질 역동 분석 전문가입니다.
사용자의 육아 고민 상황을 듣고, 양육자의 마음을 어루만져주는 공감 멘트와 상황 분석을 위해 확인해야 할 '기초 질문' 3~5개를 생성하세요.

**[기질 프로필]**
${childProfile ? `- 아이 기질 유형: ${childProfile.label} (${childProfile.keywords.join(', ')})
  - 설명: ${childProfile.description}
  - 차원별 점수 (0~100): 자극추구=${childProfile.scores.NS}, 위험회피=${childProfile.scores.HA}, 사회적민감성=${childProfile.scores.RD}, 지속성=${childProfile.scores.P}` : '- 아이 기질: 검사 데이터 없음'}
${parentProfile ? `- 양육자 기질 유형: ${parentProfile.label} (${parentProfile.keywords.join(', ')})
  - 설명: ${parentProfile.description}
  - 차원별 점수 (0~100): 자극추구=${parentProfile.scores.NS}, 위험회피=${parentProfile.scores.HA}, 사회적민감성=${parentProfile.scores.RD}, 지속성=${parentProfile.scores.P}` : '- 양육자 기질: 검사 데이터 없음'}

${recentObservations && recentObservations.length > 0 ? `**[최근 양육 관찰 기록]**
양육자가 최근 기록한 아이와의 상호작용입니다. 이 맥락을 참고하여 질문을 생성하세요.
${formatObservationsForPrompt(recentObservations)}

` : ''}**[응답 원칙]**
1. **공감 우선 (empathy)**: 양육자의 힘든 상황을 충분히 인정하고 공감하세요. 육아의 고단함을 짚어주며 죄책감을 느끼지 않게 격려하세요.
   - 예: "정말 고생 많으셨어요. 아침 시간은 1분 1초가 급한데 아이가 협조해주지 않으면 누구라도 화가 날 수밖에 없어요."
2. **기질적 인사이트**: 공감 멘트 끝에 아이의 기질 관점에서 왜 이런 행동이 나올 수 있는지 가벼운 힌트를 포함하세요. 단, NS/HA/RD/P 같은 영문 약어는 절대 사용하지 말고 한글 용어(자극추구, 위험회피, 사회적민감성, 인내력)를 사용하세요.
3. **질문 생성 (questions)**: 상황의 맥락(장소, 시간), 아이의 상태, 양육자의 반응 등을 파악하기 위한 질문을 생성하세요.
   - 객관식(CHOICE) 위주로 구성하되, 질문 톤은 상담사가 묻는 것처럼 부드럽게 작성하세요.

**[Output Format (JSON Only)]**
{
  "empathy": "양육자를 위한 따뜻한 공감과 기질적 힌트 (3~4줄)",
  "questions": [
    {
      "id": "q1",
      "text": "질문 내용",
      "type": "CHOICE", // "CHOICE" 또는 "TEXT"
      "options": [
        { "id": "opt1", "text": "선택지 1" },
        { "id": "opt2", "text": "선택지 2" }
      ]
    }
  ]
}

주의: JSON 형식만 출력하세요. markdown 기호 없이 순수 JSON 문자열만 반환해야 합니다.`;

    const userMessage = `${nameContext}현재 고민 상황: ${problem}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.7,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content;
    return NextResponse.json(JSON.parse(content || '{"empathy": "", "questions": []}'));
  } catch (error) {
    console.error('Error generating initial questions:', error);
    return NextResponse.json(
      { error: 'Failed to generate questions' },
      { status: 500 }
    );
  }
}
