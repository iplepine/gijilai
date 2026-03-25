import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { IntakeFormData, SurveyResponse, AnalysisResult } from '@/types';

interface AppState {
  // Intake Form
  intake: IntakeFormData;
  setIntake: (data: Partial<IntakeFormData>) => void;
  resetIntake: () => void;

  // Survey
  surveyProgress: number;
  cbqResponses: Record<string, number>;
  atqResponses: Record<string, number>;
  parentingResponses: Record<string, number>; // Added parenting responses
  setCbqResponse: (questionId: string, score: number) => void;
  setAtqResponse: (questionId: string, score: number) => void;
  setParentingResponse: (questionId: string, score: number) => void; // Added action
  setSurveyProgress: (progress: number) => void;

  // Analysis Result
  analysisResult: AnalysisResult | null;
  setAnalysisResult: (result: AnalysisResult) => void;

  // Payment
  isPaid: boolean;
  setIsPaid: (paid: boolean) => void;

  // Subscription
  subscriptionTier: 'free' | 'single' | 'premium';
  setSubscriptionTier: (tier: 'free' | 'single' | 'premium') => void;

  // Selected Child
  selectedChildId: string | null;
  setSelectedChildId: (id: string | null) => void;

  // Restore from DB
  restoreSurveyFromDB: (data: {
    cbqResponses?: Record<string, number>;
    atqResponses?: Record<string, number>;
    parentingResponses?: Record<string, number>;
  }) => void;

  // Reset all
  resetAll: () => void;
  resetSurveyOnly: () => void;
}

const initialIntake: IntakeFormData = {
  privacyAgreed: false,
  disclaimerAgreed: false,
  childName: '',
  gender: '',
  birthDate: '',

  birthPlace: '',
  concerns: [],
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Intake
      intake: initialIntake,
      setIntake: (data) =>
        set((state) => ({
          intake: { ...state.intake, ...data },
        })),
      resetIntake: () => set({ intake: initialIntake }),

      // Survey
      surveyProgress: 0,
      cbqResponses: {},
      atqResponses: {},
      parentingResponses: {}, // Initial state
      setCbqResponse: (questionId, score) =>
        set((state) => ({
          cbqResponses: { ...state.cbqResponses, [questionId]: score },
        })),
      setAtqResponse: (questionId, score) =>
        set((state) => ({
          atqResponses: { ...state.atqResponses, [questionId]: score },
        })),
      setSurveyProgress: (progress) => set({ surveyProgress: progress }),


      setParentingResponse: (questionId, score) =>
        set((state) => ({
          parentingResponses: { ...state.parentingResponses, [questionId]: score },
        })),

      // Selected Child
      selectedChildId: null,
      setSelectedChildId: (id) => set({ selectedChildId: id }),

      // Analysis
      analysisResult: null,
      setAnalysisResult: (result) => set({ analysisResult: result }),

      // Payment
      isPaid: false,
      setIsPaid: (paid) => set({ isPaid: paid }),

      // Subscription
      subscriptionTier: 'free',
      setSubscriptionTier: (tier) => set({ subscriptionTier: tier }),

      // Restore from DB
      restoreSurveyFromDB: (data) =>
        set((state) => ({
          cbqResponses: data.cbqResponses ?? state.cbqResponses,
          atqResponses: data.atqResponses ?? state.atqResponses,
          parentingResponses: data.parentingResponses ?? state.parentingResponses,
        })),

      // Reset
      resetAll: () =>
        set({
          intake: initialIntake,
          surveyProgress: 0,
          cbqResponses: {},
          atqResponses: {},
          parentingResponses: {},
          analysisResult: null,
          isPaid: false,
        }),
      resetSurveyOnly: () =>
        set({
          surveyProgress: 0,
          cbqResponses: {},
          atqResponses: {},
          parentingResponses: {},
          analysisResult: null,
        }),
    }),
    {
      name: 'temperament-storage',
      partialize: (state) => ({
        intake: state.intake,
        cbqResponses: state.cbqResponses,
        atqResponses: state.atqResponses,
        parentingResponses: state.parentingResponses,
        surveyProgress: state.surveyProgress,
        isPaid: state.isPaid,
        subscriptionTier: state.subscriptionTier,
        selectedChildId: state.selectedChildId,
      }),
    }
  )
);
