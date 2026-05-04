import type { Locale } from '@/i18n/config';

type AgeGroup = '0-2' | '3-5' | '6-9' | '10-13';
type Gender = 'male' | 'female';

export interface ConsultExample {
  label: string;
  text: string;
}

type ConsultExampleSet = Record<AgeGroup, Record<Gender, ConsultExample[]>>;

const koCommonExamples: Record<AgeGroup, ConsultExample[]> = {
  '0-2': [
    { label: '잠투정이 심해요', text: '졸린 것 같은데 재우려고 하면 안 자겠다고 울고 몸부림쳐요' },
    { label: '밤에 자주 깨요', text: '밤에 여러 번 깨서 안아달라고 울고 다시 잠드는 데 오래 걸려요' },
    { label: '낮잠을 거부해요', text: '낮잠 시간이 되면 졸려 보여도 계속 놀겠다고 버텨요' },
    { label: '밥 먹다 돌아다녀요', text: '밥을 먹을 때 한자리에 앉아 있지 못하고 계속 돌아다녀요' },
    { label: '새 음식을 거부해요', text: '새로운 반찬을 주면 냄새만 맡고 입을 꾹 닫아버려요' },
    { label: '우유만 찾으려 해요', text: '밥보다 우유나 간식만 찾고 식사 시간이 매번 실랑이가 돼요' },
    { label: '숟가락을 던져요', text: '밥 먹다 마음에 안 들면 숟가락이나 그릇을 바닥에 던져요' },
    { label: '컵을 일부러 엎어요', text: '물을 마시다가 일부러 컵을 엎고 제 반응을 살피는 것 같아요' },
    { label: '기저귀 갈기 싫어해요', text: '기저귀를 갈려고 눕히면 도망가고 발버둥쳐서 너무 힘들어요' },
    { label: '변기에 앉기 싫어해요', text: '배변 훈련을 시작했는데 변기에 앉는 것부터 강하게 거부해요' },
    { label: '양치할 때 울어요', text: '칫솔만 보면 입을 다물고 울어서 양치 시간이 매일 전쟁이에요' },
    { label: '머리 감기 싫어해요', text: '머리에 물이 닿기만 해도 자지러지게 울고 씻기 싫어해요' },
    { label: '손 씻기 거부해요', text: '외출 후 손을 씻기려 하면 싫다고 빼고 도망가요' },
    { label: '옷 갈아입기 싫어해요', text: '외출복이나 잠옷으로 갈아입히려 하면 몸을 비틀며 거부해요' },
    { label: '외출 준비가 힘들어요', text: '신발 신기, 옷 입기, 문 밖으로 나가기까지 매번 오래 걸려요' },
    { label: '카시트에서 울어요', text: '차에 타서 카시트에 앉히면 바로 울고 벨트를 빼려고 해요' },
    { label: '유모차를 거부해요', text: '유모차에 앉기 싫어해서 외출하면 안아달라고만 해요' },
    { label: '안아달라고만 해요', text: '집에서도 밖에서도 계속 안아달라고 해서 제 팔과 허리가 너무 힘들어요' },
    { label: '엄마가 가면 울어요', text: '제가 화장실만 가도 문 앞에서 울고 떨어지지 않으려 해요' },
    { label: '낯선 곳에서 얼어요', text: '새로운 장소에 가면 품에서 내려오지 않고 주변만 가만히 봐요' },
    { label: '큰 소리에 놀라요', text: '청소기나 초인종처럼 큰 소리가 나면 깜짝 놀라 울어요' },
    { label: '새로운 사람을 피해요', text: '낯선 사람이 말을 걸면 고개를 돌리고 제 뒤로 숨어요' },
    { label: '장난감 뺏기면 울어요', text: '다른 아이가 장난감을 만지기만 해도 크게 울고 빼앗으려 해요' },
    { label: '친구를 때리거나 물어요', text: '놀다가 마음에 안 들면 친구를 때리거나 무는 일이 생겨요' },
    { label: '물건을 계속 던져요', text: '장난감이나 책을 던지는 행동이 반복돼서 다칠까 봐 걱정돼요' },
    { label: '높은 곳에 올라가요', text: '소파나 의자 위로 자꾸 올라가서 내려오라고 해도 반복해요' },
    { label: '위험한 곳만 가요', text: '막아둔 서랍이나 현관처럼 위험한 곳에만 자꾸 가려고 해요' },
    { label: '소파에서 뛰어요', text: '소파 위에서 뛰고 구르는 걸 너무 좋아해서 다칠까 봐 불안해요' },
    { label: '말이 늦은 것 같아요', text: '또래보다 말이 늦은 것 같고 원하는 걸 울음으로 표현해요' },
    { label: '원하는 걸 말 못 해요', text: '원하는 게 있어도 말로 못 하고 손으로 끌고 가거나 울어요' },
    { label: '이름 불러도 안 봐요', text: '놀이에 빠지면 이름을 여러 번 불러도 잘 돌아보지 않아요' },
    { label: '자기 뜻대로만 해요', text: '원하는 순서대로 안 되면 바로 화내고 다시 하자고 해요' },
    { label: '안 되면 드러누워요', text: '원하는 걸 못 하게 하면 바닥에 드러누워 한참 울어요' },
    { label: '전환할 때 울어요', text: '놀이를 끝내고 밥 먹거나 씻으러 가자고 하면 크게 울어요' },
    { label: '손가락을 빨아요', text: '졸리거나 불안할 때 손가락을 오래 빨아서 걱정돼요' },
    { label: '애착 물건만 찾아요', text: '특정 담요나 인형이 없으면 잠도 못 자고 외출도 힘들어요' },
    { label: '놀이가 너무 짧아요', text: '장난감을 하나 꺼내도 금방 싫증 내고 다른 걸 계속 찾아요' },
    { label: '혼자 놀지 못해요', text: '제가 옆에 없으면 잠깐도 혼자 놀지 못하고 계속 불러요' },
    { label: '동생 생기고 퇴행해요', text: '동생이 태어난 뒤 갑자기 아기처럼 행동하고 젖병을 찾으려 해요' },
    { label: '어린이집 적응이 느려요', text: '어린이집에 간 지 꽤 됐는데도 등원 때마다 울고 떨어지지 않아요' },
  ],
  '3-5': [
    { label: '유치원 가기 싫대요', text: '아침마다 유치원에 가기 싫다고 울고 준비가 너무 오래 걸려요' },
    { label: '등원 때 떨어지지 않아요', text: '교실 앞에서 제 다리를 붙잡고 떨어지지 않으려고 해요' },
    { label: '친구 장난감을 뺏어요', text: '친구가 갖고 노는 장난감을 기다리지 못하고 바로 뺏으려 해요' },
    { label: '차례 기다리기 어려워요', text: '줄을 서거나 순서를 기다릴 때 계속 앞으로 나가려고 해요' },
    { label: '지면 울고 난리나요', text: '게임이나 놀이에서 지면 크게 울고 다시 하자고 떼를 써요' },
    { label: '규칙이 바뀌면 화내요', text: '놀이 규칙이 조금만 바뀌어도 아니라고 화내며 처음부터 하자고 해요' },
    { label: '놀이를 끝내기 힘들어요', text: '재밌는 놀이를 끝내자고 하면 소리를 지르며 더 하겠다고 해요' },
    { label: '역할놀이 대본을 고집해요', text: '제가 역할놀이에서 다른 말을 하면 틀렸다고 다시 하자고 해요' },
    { label: '같은 질문을 반복해요', text: '이미 대답한 질문을 계속 반복해서 저도 지치고 화가 나요' },
    { label: '거짓말을 시작했어요', text: '혼날 것 같으면 안 했다고 뻔한 거짓말을 해서 어떻게 반응해야 할지 모르겠어요' },
    { label: '혼자 놀지 못해요', text: '제가 옆에서 계속 같이 놀아주지 않으면 바로 심심하다고 해요' },
    { label: '양보를 전혀 안 해요', text: '자기 물건도 친구 물건도 다 자기 뜻대로 해야 해서 자주 싸워요' },
    { label: '화나면 소리 질러요', text: '마음대로 안 되면 말보다 소리부터 지르고 한참 진정이 안 돼요' },
    { label: '손이 먼저 나가요', text: '화가 나면 친구나 동생에게 말보다 손이 먼저 나가요' },
    { label: '물거나 밀쳐요', text: '친구와 놀다가 답답하면 물거나 밀치는 일이 생겨 걱정이에요' },
    { label: '사과를 안 하려 해요', text: '잘못한 걸 알아도 미안하다는 말을 끝까지 안 하려고 버텨요' },
    { label: '밥상에서 장난쳐요', text: '식사 시간마다 장난치고 일어나서 밥 먹이는 게 너무 힘들어요' },
    { label: '편식이 심해요', text: '먹는 음식만 먹고 새로운 반찬은 냄새만 맡아도 싫다고 해요' },
    { label: '간식만 먹으려 해요', text: '밥은 안 먹고 과자나 음료만 찾으려고 해서 매일 실랑이예요' },
    { label: '씻기면 매번 전쟁이에요', text: '씻자고 하면 도망가고 울어서 목욕 시간이 매번 전쟁이에요' },
    { label: '양치하기 싫어해요', text: '양치하자고 하면 입을 꾹 닫고 도망가서 충치가 걱정돼요' },
    { label: '잠자리 루틴이 길어요', text: '잘 시간이 되면 물 달라, 책 더 읽자 하며 계속 시간을 끌어요' },
    { label: '밤에 혼자 못 자요', text: '혼자 자는 걸 무서워해서 매일 부모 옆에서만 자려고 해요' },
    { label: '악몽 꾸고 울어요', text: '밤에 무서운 꿈을 꿨다며 깨서 울고 다시 잠들기 어려워해요' },
    { label: '배변 실수가 늘었어요', text: '최근에 팬티에 실수하는 일이 늘어서 혼내야 할지 고민돼요' },
    { label: '변기 물을 무서워해요', text: '변기 물 내려가는 소리를 무서워해서 화장실 가기를 피하려 해요' },
    { label: '옷 고집이 심해요', text: '아침마다 특정 옷만 입겠다고 해서 등원 준비가 늦어져요' },
    { label: '새 옷을 거부해요', text: '새 옷을 사줘도 불편하다며 입기 싫다고 울어요' },
    { label: '소리에 민감해요', text: '청소기나 핸드드라이어 소리를 들으면 귀를 막고 울어요' },
    { label: '모래나 물감 싫어해요', text: '모래, 풀, 물감 같은 촉감 놀이를 싫어하고 손에 묻으면 울어요' },
    { label: '낯선 활동을 안 해요', text: '새로운 체험 활동이 있으면 해보기 전부터 싫다고 물러서요' },
    { label: '발표를 피하려 해요', text: '친구들 앞에서 말하거나 발표하는 상황을 너무 피하려 해요' },
    { label: '선생님 말에 얼어요', text: '선생님이 부르면 대답을 못 하고 얼어붙는다고 들었어요' },
    { label: '친구들과 안 어울려요', text: '친구들이 같이 놀자고 해도 혼자 장난감만 갖고 노는 것 같아요' },
    { label: '특정 친구에게 집착해요', text: '한 친구하고만 놀려고 하고 그 친구가 없으면 놀이에 참여하지 않아요' },
    { label: '동생을 밀어내요', text: '동생을 안아주거나 챙기면 와서 밀치고 자기만 봐달라고 해요' },
    { label: '아기처럼 행동해요', text: '혼자 하던 것도 갑자기 못 하겠다고 하고 아기처럼 말해요' },
    { label: '할머니 집에서 떼써요', text: '할머니 집에 가면 평소보다 떼를 더 쓰고 말을 잘 안 들어요' },
    { label: '마트에서 드러누워요', text: '마트에서 원하는 걸 못 사주면 바닥에 드러누워 울어요' },
    { label: '화면 끄면 폭발해요', text: '영상이나 게임을 끄자고 하면 바로 소리 지르고 울어요' },
  ],
  '6-9': [
    { label: '아침 등교가 힘들어요', text: '아침마다 학교 가기 싫다고 늦장을 부려서 지각할까 봐 조마조마해요' },
    { label: '수업 시간에 못 앉아 있어요', text: '수업 시간에 가만히 앉아 있기 힘들어해서 선생님께 연락을 받았어요' },
    { label: '숙제 시작을 미뤄요', text: '숙제를 해야 하는데 계속 나중에 하겠다며 시작을 미뤄요' },
    { label: '숙제 집중을 못 해요', text: '숙제를 시작해도 5분마다 딴짓을 해서 옆에 붙어 있어야 해요' },
    { label: '준비물을 자주 잊어요', text: '알림장이나 준비물을 자주 빠뜨려서 아침마다 급하게 챙겨요' },
    { label: '알림장을 안 적어와요', text: '학교에서 해야 할 일을 안 적어와서 부모가 매번 확인해야 해요' },
    { label: '글씨를 대충 써요', text: '글씨를 너무 급하게 써서 본인도 다시 못 읽을 때가 많아요' },
    { label: '읽기를 싫어해요', text: '책 읽기나 긴 문장을 읽는 걸 싫어해서 학습이 걱정돼요' },
    { label: '틀리면 울어요', text: '문제를 하나만 틀려도 울거나 다시는 안 하겠다고 해요' },
    { label: '발표를 무서워해요', text: '집에서는 말이 많은데 학교 발표만 앞두면 너무 긴장해요' },
    { label: '친구와 자주 다퉈요', text: '학교나 놀이터에서 친구와 사소한 일로 자주 다툰다고 해요' },
    { label: '단짝이 바뀌면 힘들어해요', text: '친하던 친구가 다른 친구와 놀면 하루 종일 속상해해요' },
    { label: '놀림받을까 걱정해요', text: '친구들이 놀릴까 봐 발표나 새로운 활동을 피하려고 해요' },
    { label: '규칙을 안 지켜요', text: '교실이나 복도 규칙을 알면서도 자꾸 어겨서 지적을 받아요' },
    { label: '차례를 못 기다려요', text: '순서가 올 때까지 기다리는 걸 힘들어하고 계속 끼어들어요' },
    { label: '사소한 걸로 경쟁해요', text: '작은 일도 누가 이겼는지 따지며 친구나 형제와 싸워요' },
    { label: '지면 승복을 못 해요', text: '게임이나 운동에서 지면 억울하다며 다시 하자고 버텨요' },
    { label: '동생과 계속 싸워요', text: '동생과 장난감, 자리, 간식 문제로 하루에도 여러 번 싸워요' },
    { label: '부모 말에 말대꾸해요', text: '해야 할 일을 말하면 바로 변명하거나 말대꾸부터 해요' },
    { label: '혼내면 문을 닫아요', text: '혼내거나 설명하려고 하면 방문을 닫고 대화를 끊어버려요' },
    { label: '게임만 하려 해요', text: '학교 다녀오면 게임이나 영상만 하려고 해서 공부와 생활이 밀려요' },
    { label: '영상 끄면 화내요', text: '정해진 시간이 끝나도 영상을 끄면 화내고 더 보겠다고 해요' },
    { label: '스마트폰을 계속 찾아요', text: '잠깐만 시간이 나도 스마트폰부터 찾고 다른 놀이를 싫어해요' },
    { label: '잠자기 전 화면을 봐요', text: '자기 전에도 영상을 보려고 해서 잠드는 시간이 자꾸 늦어져요' },
    { label: '아침에 늦게 일어나요', text: '밤에 늦게 자고 아침마다 못 일어나서 등교 준비가 힘들어요' },
    { label: '밥 먹는 속도가 느려요', text: '밥 먹는 데 너무 오래 걸려서 아침과 저녁 루틴이 계속 밀려요' },
    { label: '편식이 계속돼요', text: '초등학생이 됐는데도 먹는 반찬만 먹으려고 해서 걱정이에요' },
    { label: '운동을 싫어해요', text: '체육 시간이나 몸을 쓰는 활동을 싫어하고 피하려고 해요' },
    { label: '너무 거칠게 놀아요', text: '놀다 보면 힘 조절이 안 돼서 친구가 다칠까 봐 걱정돼요' },
    { label: '감정 표현이 서툴러요', text: '속상한 일이 있어도 말로 설명하지 못하고 짜증으로만 표현해요' },
    { label: '속상한 일을 숨겨요', text: '학교에서 무슨 일이 있어도 괜찮다고만 하고 자세히 말하지 않아요' },
    { label: '배가 아프다고 해요', text: '학교나 학원 가기 전만 되면 배가 아프다고 해서 걱정돼요' },
    { label: '학교 가기 싫다고 해요', text: '특별한 이유를 말하지 않고 학교 가기 싫다는 말을 자주 해요' },
    { label: '선생님 지적에 예민해요', text: '선생님이 한 번만 지적해도 크게 속상해하고 위축돼요' },
    { label: '학원 숙제가 버거워요', text: '학원 숙제가 쌓이면 짜증을 내고 아예 손대기 싫어해요' },
    { label: '칭찬에 너무 매달려요', text: '칭찬을 못 받으면 금방 실망하고 더는 안 하겠다고 해요' },
    { label: '용돈을 바로 써요', text: '용돈을 받으면 계획 없이 바로 써버리고 또 사달라고 해요' },
    { label: '거짓말로 피하려 해요', text: '숙제나 준비물을 안 했을 때 했다고 둘러대는 일이 생겼어요' },
    { label: '약속을 자주 잊어요', text: '몇 번이나 말한 약속도 금방 잊고 지키지 않아 매번 확인해야 해요' },
    { label: '혼자 준비를 못 해요', text: '가방 챙기기나 옷 입기처럼 혼자 해야 할 일을 계속 도와달라고 해요' },
  ],
  '10-13': [
    { label: '대화를 피하려 해요', text: '무슨 일이 있었는지 물어보면 몰라요, 됐어요만 반복해요' },
    { label: '방문을 닫고만 있어요', text: '집에 오면 방에 들어가 문을 닫고 가족과 거의 말하지 않아요' },
    { label: '사사건건 말대꾸해요', text: '걱정돼서 한 말도 간섭으로 듣고 사사건건 말대꾸해요' },
    { label: '가족 시간을 거부해요', text: '같이 밥 먹거나 외출하자는 말도 귀찮다며 피하려 해요' },
    { label: '비밀이 많아졌어요', text: '예전과 달리 핸드폰이나 친구 이야기를 숨기는 일이 많아졌어요' },
    { label: '친구 얘기를 안 해요', text: '누구와 지내는지 물어도 대충 넘기고 자세히 말하지 않아요' },
    { label: '친구 관계에 예민해요', text: '친구가 보낸 말이나 표정 하나에 기분이 크게 흔들려요' },
    { label: '단톡방 반응에 흔들려요', text: '단톡방에서 답장이 늦거나 반응이 없으면 하루 종일 신경 써요' },
    { label: 'SNS 댓글에 울어요', text: 'SNS 댓글이나 좋아요 수 때문에 울거나 예민해지는 일이 있어요' },
    { label: '스마트폰을 못 놔요', text: '밥 먹을 때도 자기 전에도 스마트폰을 손에서 놓지 않으려 해요' },
    { label: '쇼츠만 계속 봐요', text: '짧은 영상만 계속 보고 공부나 잠자는 시간이 자꾸 밀려요' },
    { label: '게임 시간을 숨겨요', text: '정해진 시간보다 더 게임하고도 안 했다고 말하는 일이 생겼어요' },
    { label: '밤늦게까지 깨어 있어요', text: '밤늦게까지 핸드폰을 보거나 뒤척여서 아침에 너무 힘들어해요' },
    { label: '아침에 못 일어나요', text: '늦게 자고 아침마다 못 일어나서 학교 준비가 매일 전쟁이에요' },
    { label: '공부 의욕이 떨어졌어요', text: '예전보다 공부에 관심이 줄고 해야 할 일을 자꾸 미뤄요' },
    { label: '시험 불안이 심해요', text: '시험 기간만 되면 예민해지고 잠도 잘 못 자서 걱정돼요' },
    { label: '성적 얘기만 하면 닫혀요', text: '성적이나 공부 이야기를 꺼내면 바로 표정이 굳고 대화를 끊어요' },
    { label: '학원 가기 싫어해요', text: '학원 시간이 다가오면 배가 아프다거나 너무 힘들다고 해요' },
    { label: '진로 얘기를 피해요', text: '앞으로 뭘 하고 싶은지 물어보면 모르겠다며 짜증을 내요' },
    { label: '숙제를 숨겨요', text: '과제나 수행평가가 있었는데 끝까지 말하지 않아 뒤늦게 알게 돼요' },
    { label: '거친 말을 써요', text: '친구들과 쓰는 말투가 집에서도 나와서 듣고 있으면 놀랄 때가 있어요' },
    { label: '감정 기복이 커졌어요', text: '조금 전까지 괜찮다가도 갑자기 화내거나 울어서 따라가기 힘들어요' },
    { label: '사소한 일에 폭발해요', text: '작은 지적에도 크게 화를 내고 한참 방에서 나오지 않아요' },
    { label: '우울해 보일 때가 있어요', text: '별일 없다고 하지만 표정이 어둡고 무기력해 보이는 날이 많아요' },
    { label: '몸 변화가 불편해 보여요', text: '사춘기 몸 변화 이야기를 꺼내면 불편해하고 피하려 해요' },
    { label: '외모에 자신감이 없어요', text: '사진 찍기나 거울 보기를 싫어하고 외모 이야기에 예민해졌어요' },
    { label: '사진 찍기를 피해요', text: '가족 사진이나 친구 사진에도 안 나오려고 해서 걱정돼요' },
    { label: '체중 얘기에 예민해요', text: '체중이나 몸매 이야기가 나오면 바로 화내거나 표정이 굳어요' },
    { label: '씻는 걸 귀찮아해요', text: '청결을 챙겨야 하는 나이인데 씻는 문제로 매일 실랑이예요' },
    { label: '방 정리를 안 해요', text: '방이 너무 어질러져 있는데 치우라고 하면 간섭하지 말라고 해요' },
    { label: '용돈을 바로 써요', text: '용돈을 받으면 계획 없이 바로 쓰고 부족하다고 다시 달라고 해요' },
    { label: '몰래 결제했어요', text: '부모 동의 없이 앱이나 게임에서 결제한 걸 뒤늦게 알았어요' },
    { label: '약속 시간을 안 지켜요', text: '귀가 시간이나 학원 시간을 자주 어겨서 신뢰가 흔들려요' },
    { label: '어디 가는지 말 안 해요', text: '나갈 때 누구를 만나는지 어디 가는지 말하기 싫어해요' },
    { label: '위험한 친구가 걱정돼요', text: '요즘 어울리는 친구들이 걱정되는데 물어보면 화부터 내요' },
    { label: '부모 기준을 간섭으로 느껴요', text: '안전을 위해 정한 규칙도 자신을 못 믿는 거냐며 반발해요' },
    { label: '동생에게 차갑게 대해요', text: '동생이 말을 걸면 귀찮아하고 차갑게 대하는 일이 늘었어요' },
    { label: '가족 규칙을 무시해요', text: '집안 규칙을 알면서도 자기 마음대로 하려는 일이 많아졌어요' },
    { label: '이성 친구에 몰입해요', text: '이성 친구와 연락하는 데 너무 몰입해서 생활 리듬이 흔들려요' },
    { label: '혼자 삭이는 것 같아요', text: '힘든 일이 있어 보이는데 말하지 않고 혼자 삭이는 것 같아요' },
  ],
};

const koGenderExamples: Record<AgeGroup, Record<Gender, ConsultExample[]>> = {
  '0-2': {
    male: [
      { label: '자동차 놀이만 해요', text: '자동차 장난감만 찾고 다른 놀이는 금방 밀어내요' },
      { label: '몸으로 부딪혀 놀아요', text: '놀 때 자꾸 몸으로 부딪히고 올라타서 힘 조절이 걱정돼요' },
      { label: '공을 세게 던져요', text: '공이나 장난감을 너무 세게 던져서 집안 물건이 자주 맞아요' },
      { label: '뛰느라 밥을 못 먹어요', text: '식사 중에도 뛰어다니고 다시 앉히면 바로 일어나요' },
      { label: '목욕탕에서 물을 튀겨요', text: '목욕할 때 물을 계속 튀겨서 멈추게 하면 더 신나 해요' },
      { label: '손잡고 걷기 싫어해요', text: '밖에서 손잡고 걷자고 하면 손을 빼고 혼자 뛰어가려 해요' },
      { label: '장난감 차를 줄 세워요', text: '장난감 차를 줄 세워야 하고 누가 건드리면 크게 화내요' },
      { label: '아빠랑만 놀려 해요', text: '퇴근 후에는 아빠랑만 놀겠다고 해서 잠자리 루틴이 자꾸 밀려요' },
      { label: '힘 조절이 안 돼요', text: '안기거나 장난칠 때 힘 조절이 안 돼서 제가 아플 때가 많아요' },
      { label: '장난이 너무 커져요', text: '재밌어지면 장난이 금방 커져서 멈추는 신호를 잘 못 받아들여요' },
    ],
    female: [
      { label: '엄마 말고 안 가요', text: '엄마 외에는 잘 안기지 않으려 해서 돌봄을 맡기기가 어려워요' },
      { label: '인형 없으면 못 자요', text: '늘 찾는 인형이 없으면 잠들지 못하고 한참 울어요' },
      { label: '머리 묶기를 싫어해요', text: '머리를 묶거나 빗기려고 하면 불편하다며 고개를 돌려요' },
      { label: '옷 촉감에 예민해요', text: '옷 태그나 솔기 느낌이 싫다며 갈아입기를 반복해요' },
      { label: '낯선 어른 눈치를 봐요', text: '낯선 어른이 말을 걸면 제 표정을 먼저 살피고 뒤로 숨어요' },
      { label: '아기 인형만 찾아요', text: '아기 인형 놀이만 하려고 하고 다른 장난감은 밀어내요' },
      { label: '조용한 곳만 찾아요', text: '사람 많은 곳에 가면 힘들어하며 조용한 곳으로 가자고 해요' },
      { label: '엄마 품에서만 먹어요', text: '낯선 곳에서는 엄마 품에 있어야 간식이나 밥을 먹으려 해요' },
      { label: '동생에게 질투가 심해요', text: '동생을 안아주면 울면서 자기도 안아달라고 매달려요' },
      { label: '친구 옆에 못 다가가요', text: '또래가 있어도 다가가지 못하고 멀리서 지켜보기만 해요' },
    ],
  },
  '3-5': {
    male: [
      { label: '거친 놀이만 원해요', text: '하루 종일 뛰고 구르는 놀이만 원해서 부모 체력이 너무 힘들어요' },
      { label: '히어로 흉내가 과해요', text: '히어로 흉내를 내며 때리거나 발차기해서 친구가 놀라요' },
      { label: '친구를 밀치고 웃어요', text: '친구를 밀친 뒤 장난이라고 웃어서 어떻게 알려줘야 할지 모르겠어요' },
      { label: '블록 안 되면 부숴요', text: '블록이 마음대로 안 쌓이면 화내며 전부 무너뜨려요' },
      { label: '공룡 놀이만 반복해요', text: '공룡 놀이만 반복하고 다른 놀이로 넘어가려 하지 않아요' },
      { label: '뛰지 말라면 더 뛰어요', text: '뛰지 말라고 하면 더 크게 뛰고 제 반응을 보는 것 같아요' },
      { label: '힘센 척을 많이 해요', text: '친구들 앞에서 힘센 척을 하며 센 말과 행동을 자주 해요' },
      { label: '장난감을 무기로 써요', text: '막대나 블록을 무기처럼 들고 놀아서 친구가 다칠까 봐 걱정돼요' },
      { label: '형들을 따라 위험하게 놀아요', text: '놀이터에서 큰아이들을 따라 위험한 놀이를 하려 해요' },
      { label: '지면 물건을 던져요', text: '경기에서 지면 억울하다며 공이나 장난감을 던져요' },
    ],
    female: [
      { label: '친구에게 집착해요', text: '특정 친구와만 놀려고 하고 그 친구가 없으면 놀이를 거부해요' },
      { label: '친구가 안 놀아주면 울어요', text: '친구가 다른 아이와 놀면 서운해하며 한참 울어요' },
      { label: '선생님 표정에 상처받아요', text: '선생님 표정이 조금만 무뚝뚝해도 자기 때문이라며 속상해해요' },
      { label: '옷과 머리로 실랑이예요', text: '아침마다 옷과 머리 모양이 마음에 안 든다며 준비가 늦어져요' },
      { label: '특정 옷만 고집해요', text: '좋아하는 옷만 입겠다고 해서 날씨와 활동에 맞추기가 어려워요' },
      { label: '친구 사이 소외가 걱정돼요', text: '친구들끼리만 속닥이면 자기가 빠진 것 같다며 불안해해요' },
      { label: '자기 생각을 말 못 해요', text: '친구들 앞에서 싫다고 말하지 못하고 꾹 참는 것 같아요' },
      { label: '놀이에서 주인공만 해요', text: '역할놀이를 하면 늘 주인공을 해야 해서 친구와 다투곤 해요' },
      { label: '칭찬 못 받으면 속상해요', text: '선생님이나 부모가 바로 칭찬해주지 않으면 금방 시무룩해져요' },
      { label: '친구 말투를 따라 해요', text: '친구가 쓰는 말투나 행동을 그대로 따라 하며 자기 뜻은 잘 말하지 않아요' },
    ],
  },
  '6-9': {
    male: [
      { label: '축구하다 자주 싸워요', text: '축구나 운동을 하다가 규칙 문제로 친구들과 자주 싸워요' },
      { label: '욕설을 따라 해요', text: '친구나 영상에서 들은 욕설을 따라 해서 깜짝 놀랄 때가 있어요' },
      { label: '몸싸움 놀이가 과해요', text: '장난으로 시작한 몸싸움이 금방 세져서 친구가 다칠까 봐 걱정돼요' },
      { label: '게임 지면 폭발해요', text: '게임에서 지면 소리를 지르거나 기기를 내려놓지 못해요' },
      { label: '형들을 따라 거칠어져요', text: '큰아이들 말투와 놀이를 따라 하며 집에서도 거칠어졌어요' },
      { label: '수업 중 장난이 많아요', text: '수업 중 친구를 웃기려고 장난쳐서 선생님께 지적을 받아요' },
      { label: '위험한 장난을 해요', text: '높은 곳에서 뛰거나 친구를 놀라게 하는 장난을 계속해요' },
      { label: '승부욕이 너무 강해요', text: '작은 놀이도 반드시 이겨야 해서 친구들이 부담스러워해요' },
      { label: '실수해도 대충 넘겨요', text: '글씨나 숙제를 대충 하고 실수해도 별일 아니라고 넘겨요' },
      { label: '운동 못한다는 말에 화내요', text: '친구가 운동을 못한다고 말하면 크게 화내고 대결하려 해요' },
    ],
    female: [
      { label: '단짝과 크게 싸웠어요', text: '단짝 친구와 크게 싸운 뒤 학교 가기 싫다고 울어요' },
      { label: '친구 말에 밤새 고민해요', text: '친구가 한 말 한마디를 계속 떠올리며 밤까지 걱정해요' },
      { label: '단톡방에서 빠졌어요', text: '친구들 단톡방에서 자기만 빠졌다는 걸 알고 많이 속상해해요' },
      { label: '브랜드를 따지기 시작해요', text: '친구들이 쓰는 학용품이나 옷 브랜드를 자꾸 비교해요' },
      { label: '친구만 따라 하려 해요', text: '방과 후 활동이나 옷차림을 친구가 하는 대로만 고르려 해요' },
      { label: '선생님 편애가 속상해요', text: '선생님이 다른 친구를 더 좋아하는 것 같다며 학교 가기 싫어해요' },
      { label: '발표 전 배가 아프대요', text: '발표가 있는 날이면 아침부터 배가 아프다고 해요' },
      { label: '틀리면 자책이 심해요', text: '문제를 틀리면 자기가 못한다고 심하게 자책해요' },
      { label: '친구 표정에 눈치 봐요', text: '친구 표정이 조금만 달라져도 자기가 뭘 잘못했는지 걱정해요' },
      { label: '1대1 시간이 부족하다 해요', text: '동생 때문에 엄마와 둘만의 시간이 없다며 서운해해요' },
    ],
  },
  '10-13': {
    male: [
      { label: '몰래 게임 결제했어요', text: '게임 아이템을 부모 허락 없이 결제한 걸 뒤늦게 알았어요' },
      { label: '밤새 게임을 해요', text: '자야 할 시간에 몰래 게임을 해서 아침마다 너무 힘들어해요' },
      { label: 'PC방에 몰래 갔어요', text: '학원 간다고 하고 PC방에 다녀온 걸 알게 됐어요' },
      { label: '운동부 친구들과만 다녀요', text: '운동하는 친구들과만 어울리며 다른 생활은 신경 쓰지 않아요' },
      { label: '욕설 말투가 심해졌어요', text: '친구들과 쓰는 욕설 섞인 말투가 집에서도 자주 나와요' },
      { label: '씻기 문제로 매일 싸워요', text: '사춘기인데도 씻기 싫어해서 냄새와 청결 문제로 매일 싸워요' },
      { label: '힘으로 밀어붙여요', text: '동생이나 부모에게 자기 뜻을 힘으로 밀어붙이려 할 때가 있어요' },
      { label: '성적이 떨어져도 무심해요', text: '성적이 떨어졌는데도 괜찮다며 전혀 이야기하려 하지 않아요' },
      { label: '밖에서 뭘 하는지 몰라요', text: '집에 오면 바로 나가고 어디서 뭘 하는지 말하지 않아요' },
      { label: '아빠 말은 더 거부해요', text: '아빠가 말하면 더 강하게 반발해서 대화가 금방 싸움이 돼요' },
    ],
    female: [
      { label: '외모 비교가 심해졌어요', text: '친구나 SNS 속 사람들과 자기 외모를 자꾸 비교해요' },
      { label: '화장품을 몰래 써요', text: '화장품을 몰래 쓰고 지우라고 하면 자기만 못 하게 한다고 해요' },
      { label: 'SNS 사진에 집착해요', text: '사진이 마음에 안 들면 계속 다시 찍고 올릴지 말지 고민해요' },
      { label: '친구 무리가 불안해요', text: '친구 무리에서 빠질까 봐 눈치를 많이 보는 것 같아요' },
      { label: '속마음을 안 말해요', text: '친구 관계에서 상처받은 것 같은데 괜찮다고만 하고 말하지 않아요' },
      { label: '몸 변화 얘기를 피해요', text: '생리나 몸 변화 이야기를 꺼내면 부끄러워하며 바로 피하려 해요' },
      { label: '생리 전후 감정이 커요', text: '생리 전후로 예민함과 짜증이 커져서 서로 부딪히는 일이 많아요' },
      { label: '이성 친구 연락에 몰입해요', text: '이성 친구와 연락하는 데 마음이 너무 쏠려 공부와 수면이 흔들려요' },
      { label: '엄마 말을 간섭으로 들어요', text: '엄마가 조언하면 다 간섭이라며 대화를 끊어버려요' },
      { label: '방에서 혼자 울어요', text: '가끔 방에서 혼자 우는 것 같은데 물어보면 아무 일 아니라고 해요' },
    ],
  },
};

function buildKoExamples(ageGroup: AgeGroup, gender: Gender): ConsultExample[] {
  return [...koCommonExamples[ageGroup], ...koGenderExamples[ageGroup][gender]];
}

const examplesKo: ConsultExampleSet = {
  '0-2': {
    male: buildKoExamples('0-2', 'male'),
    female: buildKoExamples('0-2', 'female'),
  },
  '3-5': {
    male: buildKoExamples('3-5', 'male'),
    female: buildKoExamples('3-5', 'female'),
  },
  '6-9': {
    male: buildKoExamples('6-9', 'male'),
    female: buildKoExamples('6-9', 'female'),
  },
  '10-13': {
    male: buildKoExamples('10-13', 'male'),
    female: buildKoExamples('10-13', 'female'),
  },
};

const examplesEn: ConsultExampleSet = {
  '0-2': {
    male: [
      { label: 'Jumps from high places', text: 'He enjoys jumping off the sofa or table, and when I tell him not to, he gets even more excited.' },
      { label: 'Tosses and turns at night', text: 'He moves around so much while sleeping that he often falls off the bed.' },
      { label: 'Won\'t sit during meals', text: 'When changing diapers or eating, he cannot stay in one place and keeps running away.' },
      { label: 'Throws toys hard', text: 'He has started throwing toys hard at the wall or floor.' },
      { label: 'Fine motor feels delayed', text: 'He is 24 months old and cannot stack five blocks yet. I am worried his fine motor development may be delayed.' },
      { label: 'Puts everything in his mouth', text: 'He is 26 months old and still puts every object in his mouth.' },
      { label: 'Lies down and cries', text: 'When he cannot get what he wants, he lies on the floor and cries loudly.' },
      { label: 'Stomps too loudly', text: 'He stomps on his heels so loudly that floor noise has become a daily battle.' },
      { label: 'Regressed after sibling', text: 'After his baby sister was born, he suddenly started acting like a baby and wants to use a bottle.' },
      { label: 'Hides from strangers', text: 'When he sees strangers, he becomes very wary and hides.' },
    ],
    female: [
      { label: 'Only goes to mom', text: 'Her stranger anxiety is so strong that she refuses to be held by anyone except mom.' },
      { label: 'Cries at loud sounds', text: 'She cries intensely at sounds like the vacuum or doorbell, so it is hard to do things around the house.' },
      { label: 'Separation anxiety is strong', text: 'If mom disappears from view for even a second, her separation anxiety gets very intense.' },
      { label: 'Refuses solid food', text: 'She keeps her mouth shut and refuses solid food. Mealtime feels painful.' },
      { label: 'Struggles in new places', text: 'When we go somewhere unfamiliar, it takes her more than an hour to adjust.' },
      { label: 'Sucks her finger too much', text: 'She sucks her finger so hard every night that the skin becomes irritated.' },
      { label: 'Afraid of the toilet', text: 'She is scared of the flushing sound, so toilet training is not going well.' },
      { label: 'Very picky eating', text: 'Her picky eating is so strong that she only wants certain side dishes.' },
      { label: 'Attached to one toy', text: 'If she does not have a specific comfort toy, she cannot go out or fall asleep.' },
      { label: 'Wakes up crying at night', text: 'She suddenly wakes up at night and cries intensely. I do not know why.' },
    ],
  },
  '3-5': {
    male: [
      { label: 'Pushes friends', text: 'His preschool teacher contacted me because he pushes friends or takes toys from them.' },
      { label: 'Does not play with friends', text: 'He gets overly absorbed in one specific toy and does not seem to know how to play with other children.' },
      { label: 'Cries when he loses', text: 'He is so competitive that when he loses a game, he cries and melts down.' },
      { label: 'Hits when angry', text: 'When he gets angry, his hands move before his words. I worry people will label him as a bad child.' },
      { label: 'Started lying', text: 'He has started telling obvious lies that make things go his way.' },
      { label: 'Never yields', text: 'He always tries to take friends\' toys and does not yield at all.' },
      { label: 'Bath time is a battle', text: 'Every bath is a battle. He is very afraid of the shower sound.' },
      { label: 'Only wants rough play', text: 'He cannot play alone and asks for rough physical play all day, which is exhausting.' },
      { label: 'Breaks things when frustrated', text: 'When blocks do not stack the way he wants, he gets upset and knocks everything down.' },
      { label: 'Slow to adjust to preschool', text: 'He adjusts slowly to group settings, so I am wondering whether preschool is right for him.' },
    ],
    female: [
      { label: 'Clings to one friend', text: 'She only wants to play with one specific friend and gets very jealous when that friend plays with someone else.' },
      { label: 'Struggles to share', text: 'She has a strong sense of ownership over her things and finds it hard to share with friends.' },
      { label: 'Hurt by teacher\'s expression', text: 'Even a neutral expression from the teacher hurts her feelings, and she says she does not want to go to preschool.' },
      { label: 'Morning clothing battles', text: 'She has very strong opinions about clothes and hairstyles, so every morning becomes a struggle.' },
      { label: 'Worried about exclusion', text: 'I am worried she may be left out because cliques are forming among her friends.' },
      { label: 'Cries at daycare every day', text: 'She cries and refuses to separate from me at the daycare door. It has been every day for a year.' },
      { label: 'Cannot say what she thinks', text: 'She cannot speak up in front of friends and just holds everything in.' },
      { label: 'Insists on certain clothes', text: 'She insists on pink and dresses, and refuses other colors or active clothes.' },
      { label: 'Upset when friends leave', text: 'When friends leave first, she becomes very sad and clingy.' },
      { label: 'Very jealous of sibling', text: 'After her younger sibling was born, her jealousy became intense. She sobs whenever I hold the baby.' },
    ],
  },
  '6-9': {
    male: [
      { label: 'Cannot sit through class', text: 'He finds it very hard to sit still for 40 minutes during class.' },
      { label: 'Forgets supplies every day', text: 'He does not write in his planner and forgets to bring school supplies almost every day.' },
      { label: 'Only wants games', text: 'He is so into games that when I ask him to study, he gets irritated first.' },
      { label: 'Plays too roughly', text: 'He plays so roughly with older kids at the playground that I worry he will get hurt.' },
      { label: 'Cannot focus on homework', text: 'When I ask him to do homework, he cannot focus for even five minutes and leaves his seat.' },
      { label: 'Copies swear words', text: 'He seems to be using swear words and rough language with friends that he saw on YouTube.' },
      { label: 'Does not follow rules', text: 'Even when told not to run in the hallway, he runs every day and gets corrected by the teacher.' },
      { label: 'Does not care about grades', text: 'Even when his spelling test score is low, he does not seem upset at all and stays cheerful.' },
      { label: 'Fights over small things', text: 'He keeps turning small things into competitions and fights with friends.' },
      { label: 'Writes too carelessly', text: 'His handwriting is very messy, and he rushes through writing without care.' },
    ],
    female: [
      { label: 'Excluded from group chat', text: 'I heard her friends left only her out of a group chat, and I am worried she will be hurt.' },
      { label: 'Cries over one mistake', text: 'If she gets even one spelling word wrong, she cries and blames herself. Her perfectionism feels intense.' },
      { label: 'Afraid to present', text: 'She talks well at home, but she is very afraid of presenting at school.' },
      { label: 'Cares about brands', text: 'She has started caring about the brands her friends wear or use for school supplies.' },
      { label: 'Upset about teacher favoritism', text: 'She says her homeroom teacher likes another student more and does not want to go to school.' },
      { label: 'Big fight with best friend', text: 'She had a big fight with her best friend and declared the friendship over. She has been crying all day.' },
      { label: 'Stomachaches from stress', text: 'When tutoring homework increases, she keeps saying her stomach hurts. It seems psychological.' },
      { label: 'Worries all night over friends', text: 'She is so sensitive to notes from friends that one small comment keeps her worried all night.' },
      { label: 'Only follows friends', text: 'When choosing after-school activities, she only wants to do what her friends are doing.' },
      { label: 'Not enough one-on-one time', text: 'I have been busy caring for her younger sibling, and she says she misses one-on-one time with me.' },
    ],
  },
  '10-13': {
    male: [
      { label: 'Refuses to talk', text: 'He refuses to talk with us and slams his door. When I ask questions, he only says "I do not know."' },
      { label: 'Only watches YouTube', text: 'His grades suddenly dropped, and he spends all day watching YouTube Shorts.' },
      { label: 'Rough language got worse', text: 'I heard him using swear words and rough language when talking with friends.' },
      { label: 'Secret game purchases', text: 'He secretly played games all night and even bought game items without telling us.' },
      { label: 'Does not want to wash', text: 'He is entering puberty but finds washing so bothersome that hygiene becomes a daily argument.' },
      { label: 'Career conflict, no studying', text: 'Because we disagree about his future path, his motivation to study has dropped sharply.' },
      { label: 'I do not know where he goes', text: 'When he comes home, he eats a snack and immediately goes out again, and I do not know where or what he is doing.' },
      { label: 'Family talks stopped', text: 'He has become uninterested in family matters and only wants time alone, so family conversations have stopped.' },
      { label: 'Cannot control allowance', text: 'As soon as he receives allowance, he spends it all and cannot control his spending.' },
      { label: 'Skipped tutoring for PC room', text: 'I found out he skipped tutoring and went to a PC room. I do not know how to talk to him about it.' },
    ],
    female: [
      { label: 'Lost confidence in looks', text: 'She has lost confidence in her appearance, avoids photos, and does not want to look in the mirror.' },
      { label: 'Very sensitive to social media', text: 'One social media comment can change her whole mood, and she seems very conscious of what friends think.' },
      { label: 'Talks back constantly', text: 'She sees my advice only as interference and talks back about everything.' },
      { label: 'Only follows peers', text: 'She tries so hard to follow peer culture that I worry she is losing her own sense of self.' },
      { label: 'Does not share feelings', text: 'She was hurt in a friendship but does not talk about her feelings and keeps it all inside.' },
      { label: 'Too focused on a crush', text: 'She is so focused on someone she likes that she cannot concentrate on studying.' },
      { label: 'Test anxiety is strong', text: 'During exam periods, she becomes anxious and has trouble sleeping.' },
      { label: 'Embarrassed by body changes', text: 'She seems embarrassed by puberty-related body changes and has lost confidence.' },
      { label: 'Only stays in her room', text: 'She wants to stay only in her room and avoids spending time with the family.' },
      { label: 'Mood swings are intense', text: 'Her mood swings have become intense, and she gets angry or cries over small things.' },
    ],
  },
};

const examplesByLocale: Record<Locale, ConsultExampleSet> = {
  ko: examplesKo,
  en: examplesEn,
};

function getAgeGroup(birthDate: string): AgeGroup {
  const birth = new Date(birthDate);
  const now = new Date();
  const ageInMonths = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  const ageInYears = Math.floor(ageInMonths / 12);

  if (ageInYears <= 2) return '0-2';
  if (ageInYears <= 5) return '3-5';
  if (ageInYears <= 9) return '6-9';
  return '10-13';
}

function shuffle<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function getRandomExamples(
  birthDate?: string,
  gender?: string,
  count = 5,
  locale: Locale = 'ko'
): ConsultExample[] {
  const ageGroup = birthDate ? getAgeGroup(birthDate) : '3-5';
  const g: Gender = gender?.toLowerCase() === 'female' ? 'female' : 'male';

  const pool = examplesByLocale[locale][ageGroup][g];
  return shuffle(pool).slice(0, count);
}
