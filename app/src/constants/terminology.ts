/**
 * 서비스 전반에서 사용되는 기질(TCI) 관련 표준 용어 정의
 */

export const TCI_TERMINOLOGY = {
    // 4대 기질 차원
    DIMENSIONS: {
        NS: {
            code: 'NS',
            name: '자극 추구',
            en: 'Novelty Seeking',
            desc: '새로운 자극에 대해 끌리고 반응하는 성향'
        },
        HA: {
            code: 'HA',
            name: '위험 회피',
            en: 'Harm Avoidance',
            desc: '위험이나 처벌을 피하려는 성향과 조심성'
        },
        RD: {
            code: 'RD',
            name: '사회적 민감성',
            en: 'Reward Dependence',
            desc: '타인의 반응과 사회적 보상에 민감하게 반응하는 성향'
        },
        P: {
            code: 'P',
            name: '지속성',
            en: 'Persistence',
            desc: '보상이 없어도 한 가지 일을 꾸준히 해내는 성향'
        }
    },

    // 분석 리포트 및 UI 레이블
    REPORT: {
        CHILD_NAME: '아이 기질',
        PARENT_NAME: '부모 기질',
        CHILD_TITLE: '아이 기질 분석',
        PARENT_TITLE: '부모 기질 분석',
        HARMONY_TITLE: '기질 조화 역동',
        SOIL_CONCEPT: '마음 토양 (부모 기질)',
        PLANT_CONCEPT: '기질 새싹 (아이 기질)',
        CHEMISTRY: '기질 케미스트리'
    }
} as const;

export type TCIDimensionKey = keyof typeof TCI_TERMINOLOGY.DIMENSIONS;
