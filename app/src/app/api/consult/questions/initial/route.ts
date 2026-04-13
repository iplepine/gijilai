import { NextResponse } from 'next/server';
import { openai } from '@/lib/openai';
import { createClient } from '@/lib/supabaseServer';
import { getConsultModel } from '@/lib/consult-model';
import { getServerFeatureAccess } from '@/lib/access';

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
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const access = await getServerFeatureAccess(supabase, {
      userId: session.user.id,
      userCreatedAt: session.user.created_at,
    });
    if (!access.canUseConsult) {
      return NextResponse.json({ error: 'Subscription required', code: 'SUBSCRIPTION_REQUIRED' }, { status: 402 });
    }

    const { problem, childName, childBirthDate, childGender, childProfile, parentProfile, recentObservations, sessionContext } = await request.json();

    // 나이 계산
    let childAge = '';
    if (childBirthDate) {
      const birth = new Date(childBirthDate);
      const today = new Date();
      const totalMonths = (today.getFullYear() - birth.getFullYear()) * 12 + (today.getMonth() - birth.getMonth());
      if (totalMonths <= 36) {
        childAge = `${totalMonths}개월`;
      } else {
        const years = Math.floor(totalMonths / 12);
        const months = totalMonths % 12;
        childAge = months > 0 ? `${years}세 ${months}개월` : `${years}세`;
      }
    }

    if (!problem) {
      return NextResponse.json(
        { error: 'Missing required field: problem' },
        { status: 400 }
      );
    }

    const nameContext = childName ? `${childName}(${childAge || '나이 미상'}${childGender === 'male' ? ', 남아' : childGender === 'female' ? ', 여아' : ''}) 아이의 양육자이고, ` : '';

    const systemPrompt = `당신은 아동 심리 및 기질 역동 분석 전문가입니다.
사용자의 육아 고민 상황을 듣고, 양육자의 마음을 어루만져주는 공감 멘트와 상황 분석을 위해 확인해야 할 '기초 질문' 정확히 4개를 생성하세요.

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

` : ''}${sessionContext ? `**[이전 상담 맥락 — 추가 상담]**
이 상담은 기존 세션 "${sessionContext.session?.title}"의 추가 상담입니다. 이전 상담 내용과 실천 기록을 참고하여 질문을 생성하세요.
${(sessionContext.consultations || []).slice(-2).map((c: any) => {
    const date = new Date(c.created_at).toLocaleDateString('ko-KR');
    return `[${date}] 고민: ${c.problem_description}${c.ai_prescription?.magicWord ? ` → 마법의 한마디: ${c.ai_prescription.magicWord}` : ''}`;
}).join('\n')}
${(sessionContext.practices || []).map((p: any) => {
    const logs = (sessionContext.logs || []).filter((l: any) => l.practice_id === p.id);
    const doneDays = logs.filter((l: any) => l.done).length;
    return `실천: ${p.title} | ${doneDays}/${p.duration}일 실천 (${p.status})`;
}).join('\n')}

` : ''}**[응답 원칙]**
1. **공감 우선 (empathy)**: 양육자의 힘든 상황을 충분히 인정하고 공감하세요. 육아의 고단함을 짚어주며 죄책감을 느끼지 않게 격려하세요.
   - 예: "정말 고생 많으셨어요. 아침 시간은 1분 1초가 급한데 아이가 협조해주지 않으면 누구라도 화가 날 수밖에 없어요."
2. **기질적 인사이트**: 공감 멘트 끝에 아이의 기질 관점에서 왜 이런 행동이 나올 수 있는지 가벼운 힌트를 포함하세요. 단, NS/HA/RD/P 같은 영문 약어는 절대 사용하지 말고 한글 용어(자극추구, 위험회피, 사회적민감성, 인내력)를 사용하세요.
3. **연령·성별 정보 활용**:
   - 아이의 연령/개월 수를 실제 질문 설계에 반영하세요. 어린 연령은 수면, 전환, 감각 과부하, 분리 불안, 기본 루틴 같은 맥락을 더 우선적으로 확인하고, 높은 연령은 또래 관계, 규칙 협상, 과제 지속, 자기표현 같은 맥락을 더 구체적으로 확인하세요.
   - 공감 멘트와 질문 표현은 아이의 현재 발달 단계에 맞는 현실적인 기대 수준을 전제로 작성하세요.
   - 성별은 고정관념을 강화하는 근거로 사용하지 마세요. "남자아이니까", "여자아이니까" 같은 일반화는 금지합니다.
   - 성별 정보는 생활 장면을 더 자연스럽게 구체화하는 보조 정보로만 활용하세요.
4. **질문 생성 (questions)**: 정확히 4개의 질문을 아래 순서로 생성하세요.
   - **질문 1~2 (객관식 CHOICE)**: 아이의 행동을 객관적으로 파악하는 질문 (상황, 빈도, 맥락 등). 질문 문두에 공감적 전제를 포함하세요 (예: "그럴 땐 정말 당황스러우셨겠어요. 혹시 아이가...")
   - **질문 3 (객관식 CHOICE)**: 부모의 감정 상태나 반응을 파악하는 질문. 부드럽고 비판단적인 톤으로 작성하세요.
   - **질문 4 (주관식 TEXT)**: 특정 상황에서의 구체적인 대처 방식이나 경험을 깊이 있게 묻는 질문.
   - 객관식 선택지로 대부분 커버되지만 양육자의 상황이 다를 수 있는 경우, 마지막 선택지에 "freeText": true를 추가하세요. 이 선택지를 탭하면 자유 텍스트 입력창이 열립니다.
   - 아이의 이름, 나이, 성별, 기질 유형 등 이미 제공된 정보를 다시 묻지 마세요. 질문은 고민 상황의 맥락을 파악하기 위한 것이어야 합니다.
   - 모든 질문은 상담사가 따뜻하게 대화하듯 작성하세요.
   - 질문은 각 연령에서 실제로 관찰 가능한 행동 단위로 작성하세요. 발달상 하기 어려운 행동을 전제한 질문은 금지합니다.

**[Output Format (JSON Only)]**
{
  "empathy": "양육자를 위한 따뜻한 공감과 기질적 힌트 (3~4줄)",
  "questions": [
    {
      "id": "q1",
      "text": "질문 내용 (객관식)",
      "type": "CHOICE",
      "options": [
        { "id": "opt1", "text": "선택지 1" },
        { "id": "opt2", "text": "선택지 2" },
        { "id": "opt3", "text": "기타 (직접 입력)", "freeText": true }
      ]
    },
    {
      "id": "q2",
      "text": "질문 내용 (주관식)",
      "type": "TEXT"
    }
  ]
}

주의: JSON 형식만 출력하세요. markdown 기호 없이 순수 JSON 문자열만 반환해야 합니다.`;

    const userMessage = `${nameContext}현재 고민 상황: ${problem}`;

    const model = await getConsultModel(session.user.id);

    const response = await openai.chat.completions.create({
      model,
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
