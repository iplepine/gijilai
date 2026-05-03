import type { Locale } from '@/i18n/config';

type AgeGroup = '0-2' | '3-5' | '6-9' | '10-13';
type Gender = 'male' | 'female';

export interface ConsultExample {
  label: string;
  text: string;
}

type ConsultExampleSet = Record<AgeGroup, Record<Gender, ConsultExample[]>>;

const examplesKo: ConsultExampleSet = {
  '0-2': {
    male: [
      { label: '높은 데서 뛰어내려요', text: '소파나 식탁에서 뛰어내리는 걸 즐기고, 하지 말라고 하면 더 신나서 해요' },
      { label: '잘 때 너무 뒤척여요', text: '밤잠을 잘 때 몸을 너무 많이 움직여서 침대 밑으로 떨어지기 일쑤예요' },
      { label: '밥 먹을 때 안 앉아요', text: '기저귀를 갈 때나 밥을 먹을 때 한곳에 가만히 있지 못하고 도망가요' },
      { label: '장난감을 세게 던져요', text: '장난감을 벽이나 바닥에 세게 던지는 습관이 생겼어요' },
      { label: '소근육 발달이 느려요', text: '24개월인데 블록 5개를 못 쌓아요. 소근육 발달이 느린 건 아닌지 걱정돼요' },
      { label: '뭐든 입으로 가져가요', text: '26개월인데 아직 모든 물건을 입으로 가져가요' },
      { label: '안 되면 바닥에 누워 울어요', text: '원하는 것이 안 되면 바닥에 드러누워 울고불고 난리가 나요' },
      { label: '층간소음이 심해요', text: '뒤꿈치로 쾅쾅 걷는 소리가 너무 커서 층간소음 때문에 매일이 전쟁이에요' },
      { label: '동생 생기고 퇴행해요', text: '여동생이 생기고 나서 갑자기 아기처럼 행동하고 젖병을 빨려고 해요' },
      { label: '낯선 사람 보면 숨어요', text: '낯선 사람을 보면 너무 심하게 경계하고 숨어버려요' },
    ],
    female: [
      { label: '엄마 말고 아무도 안 가요', text: '낯가림이 너무 심해서 엄마 외에는 아무에게도 안기려 하지 않아요' },
      { label: '큰 소리에 울어요', text: '청소기 소리나 초인종 소리에 자지러지게 울어서 집안일을 하기가 힘들어요' },
      { label: '분리 불안이 심해요', text: '엄마가 눈앞에서 1초만 사라지면 분리 불안이 심해져요' },
      { label: '이유식을 거부해요', text: '이유식을 먹을 때 입을 꾹 닫고 거부해요. 식사 시간이 고통이에요' },
      { label: '낯선 곳 적응을 못 해요', text: '낯선 공간에 가면 적응하는 데 1시간 이상 걸려요' },
      { label: '손가락을 너무 빨아요', text: '잘 때마다 손가락을 너무 심하게 빨아서 손가락이 짓무를 정도예요' },
      { label: '변기를 무서워해요', text: '변기 물 내려가는 소리를 무서워해서 배변 훈련이 안 돼요' },
      { label: '편식이 심해요', text: '편식이 너무 심해서 특정 반찬만 먹으려 해요' },
      { label: '애착 인형에 집착해요', text: '특정 애착 인형이 없으면 외출도 못 하고 잠도 못 자요' },
      { label: '밤에 갑자기 깨서 울어요', text: '밤에 자다가 갑자기 깨서 자지러지게 울어요. 이유를 모르겠어요' },
    ],
  },
  '3-5': {
    male: [
      { label: '친구를 밀쳐요', text: '유치원에서 친구를 밀치거나 장난감을 빼앗아서 선생님께 연락을 받았어요' },
      { label: '친구와 안 어울려요', text: '특정 장난감에만 과도하게 몰입하고 친구들과 어울려 노는 법을 몰라요' },
      { label: '지면 울고 난리나요', text: '승부욕이 너무 강해서 게임에서 지면 울고불고 난리가 나요' },
      { label: '화나면 손이 먼저 나가요', text: '화가 나면 말보다 손이 먼저 나가요. 나쁜 아이로 낙인찍힐까 봐 걱정이에요' },
      { label: '거짓말을 시작했어요', text: '자기한테 유리한 대로 뻔한 거짓말을 하기 시작했어요' },
      { label: '양보를 전혀 안 해요', text: '친구의 장난감을 무조건 뺏으려 하고 양보를 전혀 안 해요' },
      { label: '씻기면 매번 전쟁이에요', text: '씻길 때마다 전쟁이에요. 샤워기 소리를 너무 무서워해요' },
      { label: '거친 놀이만 해달라 해요', text: '혼자 놀지 못하고 하루 종일 거친 놀이만 요구해서 체력적으로 너무 힘들어요' },
      { label: '뜻대로 안 되면 부숴요', text: '블록이 마음대로 안 쌓아지면 짜증을 내며 다 부숴버려요' },
      { label: '유치원 적응이 느려요', text: '기관 생활 적응이 느린 편이라 유치원을 보내도 될지 고민이에요' },
    ],
    female: [
      { label: '친구에게 집착해요', text: '특정 친구와만 놀려고 하고, 그 친구가 다른 아이랑 놀면 심하게 질투해요' },
      { label: '양보를 힘들어해요', text: '자기 물건에 대한 소유욕이 강해서 친구에게 양보하는 걸 힘들어해요' },
      { label: '선생님 표정에 상처받아요', text: '선생님의 무표정에도 상처를 받고 유치원에 가기 싫다고 해요' },
      { label: '아침마다 옷으로 실랑이예요', text: '옷이나 머리 모양에 자기 주장이 너무 강해져서 아침마다 실랑이예요' },
      { label: '친구 사이 소외가 걱정돼요', text: '친구들 사이에 파벌이 생겨서 우리 아이가 소외될까 봐 걱정이에요' },
      { label: '매일 어린이집에서 울어요', text: '어린이집 문 앞만 가면 엄마랑 안 떨어지려고 울어요. 1년째 매일이에요' },
      { label: '자기 생각을 말 못 해요', text: '친구들 앞에서 자기 생각을 말을 못 하고 꾹 참기만 해요' },
      { label: '특정 옷만 고집해요', text: '분홍색, 드레스만 고집하고 다른 색깔이나 활동적인 옷은 거부해요' },
      { label: '친구가 가면 집착해요', text: '친구들이 먼저 가버리면 너무 아쉬워하고 집착하는 모습을 보여요' },
      { label: '동생에게 질투가 심해요', text: '동생이 태어난 뒤로 질투가 너무 심해요. 동생만 안아주면 엉엉 울어요' },
    ],
  },
  '6-9': {
    male: [
      { label: '수업 시간에 못 앉아 있어요', text: '수업 시간에 40분 동안 가만히 앉아 있는 걸 너무 힘들어해요' },
      { label: '준비물을 매일 잊어요', text: '알림장을 안 적어오고 준비물 챙기는 걸 매일 잊어버려요' },
      { label: '게임만 하려 해요', text: '게임에 너무 빠져서 공부하자고 하면 짜증부터 내요' },
      { label: '너무 거칠게 놀아요', text: '놀이터에서 형들과 너무 거칠게 놀아서 다칠까 봐 걱정돼요' },
      { label: '숙제 집중을 못 해요', text: '숙제를 하라고 하면 5분도 집중을 못 하고 자리를 떠요' },
      { label: '욕설을 따라 해요', text: '유튜브에서 본 욕설이나 거친 말투를 친구들과 주고받는 것 같아요' },
      { label: '규칙을 안 지켜요', text: '복도에서 뛰지 말라고 해도 매일 뛰어서 선생님께 지적을 받아요' },
      { label: '성적에 관심이 없어요', text: '받아쓰기 성적이 낮아도 전혀 속상해하지 않고 해맑기만 해요' },
      { label: '사소한 걸로 싸워요', text: '사소한 걸로 자꾸 대결 구도를 만들고 친구들과 싸워요' },
      { label: '글씨를 대충 써요', text: '손글씨가 너무 엉망이고 대충 휘갈겨 쓰고 넘어가 버려요' },
    ],
    female: [
      { label: '단톡방에서 빠져 있었어요', text: '친구들이 단톡방에서 우리 아이만 빼놓았다는데 상처받을까 봐 걱정이에요' },
      { label: '틀리면 울면서 자책해요', text: '받아쓰기 한 문제만 틀려도 울면서 자책해요. 완벽주의가 너무 심해요' },
      { label: '발표를 무서워해요', text: '집에서는 말을 잘하는데 학교에서 발표하는 걸 너무 무서워해요' },
      { label: '브랜드를 따져요', text: '친구들이 입는 옷이나 학용품 브랜드를 따지기 시작했어요' },
      { label: '선생님 편애가 속상해요', text: '담임 선생님이 다른 친구를 더 예뻐하는 것 같다며 학교 가기 싫다고 해요' },
      { label: '단짝이랑 크게 싸웠어요', text: '단짝 친구와 크게 싸우고 절교를 선언했어요. 하루 종일 울기만 해요' },
      { label: '스트레스로 배가 아파요', text: '학원 숙제가 많아지면 자꾸 배가 아프다고 해요. 심리적인 것 같아요' },
      { label: '친구 말에 밤새 고민해요', text: '친구들 쪽지 내용에 너무 민감해서 작은 말 한마디에 밤새 고민해요' },
      { label: '친구만 따라 해요', text: '방과 후 활동을 고를 때 친구가 하는 것만 따라 하려고 해요' },
      { label: '대화 시간이 부족해요', text: '동생 챙기느라 바쁜데 1대1 대화 시간이 부족하다고 서운해해요' },
    ],
  },
  '10-13': {
    male: [
      { label: '대화를 거부해요', text: '부모와 대화를 거부하고 방문을 쾅 닫아요. 물어보면 몰라만 반복해요' },
      { label: '유튜브만 봐요', text: '성적이 갑자기 떨어졌는데 하루 종일 유튜브 쇼츠만 보고 있어요' },
      { label: '거친 말투가 심해졌어요', text: '친구들과 욕설을 섞어 거칠게 대화하는 걸 들었어요' },
      { label: '몰래 게임 결제했어요', text: '밤새 몰래 게임을 하고 게임 아이템 결제까지 했어요' },
      { label: '씻는 걸 귀찮아해요', text: '사춘기인데 씻는 걸 너무 귀찮아해서 청결 문제로 매일 잔소리하게 돼요' },
      { label: '진로 갈등으로 공부를 안 해요', text: '진로에 대해 부모와 의견이 달라서 공부 의욕이 뚝 떨어졌어요' },
      { label: '밖에서 뭘 하는지 몰라요', text: '집에 오면 간식만 먹고 바로 밖으로 나가서 어디서 뭘 하는지 몰라요' },
      { label: '가족과 대화가 끊겼어요', text: '가족 일에 무관심해지고 혼자만의 시간만 원해서 대화가 끊겼어요' },
      { label: '용돈 절제를 못 해요', text: '용돈을 받으면 바로 다 써버리고 절제를 전혀 못 해요' },
      { label: '학원 빠지고 딴 데 갔어요', text: '학원을 빠지고 PC방에 갔다 온 걸 알게 됐는데 어떻게 대화해야 할지 모르겠어요' },
    ],
    female: [
      { label: '외모에 자신감을 잃었어요', text: '외모에 자신감이 없어서 사진 찍는 걸 피하고 거울도 안 보려 해요' },
      { label: 'SNS에 너무 민감해요', text: 'SNS 댓글 하나에 일희일비하고 친구들 눈치를 너무 많이 봐요' },
      { label: '사사건건 말대꾸해요', text: '엄마의 조언을 간섭으로만 받아들이고 사사건건 말대꾸를 해요' },
      { label: '또래만 따라 해요', text: '또래 문화를 너무 따라하려 해서 자기다움을 잃어가는 것 같아요' },
      { label: '속마음을 안 말해요', text: '친구 관계에서 상처를 받았는데 속마음을 말하지 않고 혼자 삭여요' },
      { label: '이성 친구에 몰입해요', text: '이성 친구에게 너무 몰입해서 공부에 집중을 못 해요' },
      { label: '시험 불안이 심해요', text: '시험 기간만 되면 불안해하고 잠을 잘 못 자요' },
      { label: '신체 변화를 부끄러워해요', text: '사춘기 신체 변화를 부끄러워하며 자신감이 떨어진 것 같아요' },
      { label: '방에만 있으려 해요', text: '자기 방에만 있으려 하고 가족과 함께하는 시간을 피해요' },
      { label: '감정 기복이 심해요', text: '감정 기복이 심해져서 사소한 일에도 화를 내거나 울어요' },
    ],
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
