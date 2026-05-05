import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { SurveyType } from '../types/survey';

interface SurveyState {
    currentStep: number;
    answers: Record<number, number>; // questionId -> score
    currentSurveyType: SurveyType;

    // Actions
    setAnswer: (questionId: number, score: number) => void;
    nextStep: () => void;
    prevStep: () => void;
    setStep: (step: number) => void;
    setSurveyType: (type: SurveyType) => void;
    resetSurvey: () => void;

    // Getters
    getProgress: (totalQuestions: number) => number;
}

export const useSurveyStore = create<SurveyState>()(
    persist(
        (set, get) => ({
            currentStep: 1, // 1-based index for questions within the current survey type
            answers: {},
            currentSurveyType: 'CHILD',

            setAnswer: (questionId, score) =>
                set((state) => ({
                    answers: { ...state.answers, [questionId]: score },
                })),

            nextStep: () => set((state) => ({ currentStep: state.currentStep + 1 })),

            prevStep: () => set((state) => ({ currentStep: Math.max(1, state.currentStep - 1) })),

            setStep: (step) => set({ currentStep: step }),

            setSurveyType: (type) => set({ currentSurveyType: type, currentStep: 1 }),

            resetSurvey: () => set({ currentStep: 1, answers: {}, currentSurveyType: 'CHILD' }),

            getProgress: (totalQuestions) => {
                const { currentStep } = get();
                return Math.min(100, Math.round(((currentStep - 1) / totalQuestions) * 100));
            },
        }),
        {
            name: 'survey-storage',
        }
    )
);
