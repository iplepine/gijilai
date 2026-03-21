export class TemperamentClassifier {
    static analyzeChild(scores: { NS: number, HA: number, RD: number, P: number }) {
        const { NS, HA, RD } = scores;

        // NS-HA-RD 조합 8유형
        // 한국인 데이터 보정 기준 (방법 B) - 평균 점수를 0-100 스케일로 환산
        // NS > 3.2 → 64, HA > 2.8 → 56, RD > 3.0 → 60
        const isNS_H = NS > 64;
        const isHA_H = HA > 56;
        const isRD_H = RD > 60;

        if (isNS_H && !isHA_H && !isRD_H) {
            return { label: "자유로운 탐험가", emoji: "🦁", image: "/child_type/type_hll.jpg", desc: "새로운 것에 거침없이 도전하며 혼자서도 잘 노는 아이" };
        } else if (isNS_H && !isHA_H && isRD_H) {
            return { label: "인기쟁이 활동가", emoji: "⭐", image: "/child_type/type_hlh.jpg", desc: "사람을 좋아하고 활기차며 어디서나 주목받는 분위기 메이커" };
        } else if (isNS_H && isHA_H && !isRD_H) {
            return { label: "예민한 완벽주의자", emoji: "🎨", image: "/child_type/type_hhl.jpg", desc: "하고 싶은 건 많지만 겁도 많아 생각이 많고 신중한 아이" };
        } else if (isNS_H && isHA_H && isRD_H) {
            return { label: "감성 풍부한 예술가", emoji: "🦋", image: "/child_type/type_hhh.jpg", desc: "주변 자극과 감정에 민감하며 풍부한 감수성을 지닌 아이" };
        } else if (!isNS_H && isHA_H && !isRD_H) {
            return { label: "조용한 분석가", emoji: "🦉", image: "/child_type/type_lhl.jpg", desc: "낯선 상황을 충분히 관찰한 뒤에 움직이는 내실 있는 아이" };
        } else if (!isNS_H && isHA_H && isRD_H) {
            return { label: "다정한 평화주의자", emoji: "🕊️", image: "/child_type/type_lhh.jpg", desc: "갈등을 싫어하며 주변 사람의 기분을 잘 살피는 착한 아이" };
        } else if (!isNS_H && !isHA_H && !isRD_H) {
            return { label: "단단한 마이웨이", emoji: "⛰️", image: "/child_type/type_lll.jpg", desc: "감정 기복이 적고 남의 시선보다 자기 페이스가 중요한 아이" };
        } else {
            return { label: "성실한 조력자", emoji: "🌱", image: "/child_type/type_llh.jpg", desc: "정해진 규칙을 잘 지키며 주변을 돕는 것을 좋아하는 아이" };
        }
    }

    static analyzeHarmony(childScores: { NS: number, HA: number, RD: number, P: number }, parentScores: { NS: number, HA: number, RD: number, P: number }) {
        const diffs = [
            { key: 'NS', label: '에너지의 속도 차이', diff: Math.abs(childScores.NS - parentScores.NS), desc: "세상을 탐색하려는 아이의 호기심 속도와 보호자님의 속도가 달라서 생기는 마찰 혹은 시너지입니다." },
            { key: 'HA', label: '안전 거리 감각', diff: Math.abs(childScores.HA - parentScores.HA), desc: "아이의 발걸음과 보호자님이 생각하는 안전한 경계 사이의 거리를 조율하는 과정에 놓여있습니다." },
            { key: 'RD', label: '마음의 온도차', diff: Math.abs(childScores.RD - parentScores.RD), desc: "감정을 표현하고 칭찬과 보상을 주고받는 서로의 방식이 다르기 때문에 세심한 통역이 필요합니다." },
            { key: 'P', label: '성취의 호흡', diff: Math.abs(childScores.P - parentScores.P), desc: "한 가지에 몰입하는 아이의 호흡과 이를 기다려주는 보호자님의 리듬 차이를 맞추어가는 단계입니다." }
        ];
        const majorDiff = diffs.sort((a, b) => b.diff - a.diff)[0];

        return {
            title: majorDiff.label,
            desc: majorDiff.desc,
            score: majorDiff.diff
        };
    }
}
