'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { DatePicker } from '@/components/ui/DatePicker';
import { useAppStore } from '@/store/useAppStore';
import { Concern, CONCERN_LABELS } from '@/types';

export default function IntakePage() {
  const router = useRouter();
  const { intake, setIntake, resetSurveyOnly } = useAppStore();
  const [errors, setErrors] = useState<Record<string, string>>({});

  const concerns: Concern[] = ['sleep', 'eating', 'tantrum', 'social', 'learning'];

  const toggleConcern = (concern: Concern) => {
    const current = intake.concerns;
    if (current.includes(concern)) {
      setIntake({ concerns: current.filter((c) => c !== concern) });
    } else if (current.length < 3) {
      setIntake({ concerns: [...current, concern] });
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!intake.childName.trim()) newErrors.childName = '이름을 입력해주세요';
    if (!intake.gender) newErrors.gender = '성별을 선택해주세요';
    if (!intake.birthDate) newErrors.birthDate = '생년월일을 입력해주세요';
    // birthTime and birthPlace can be optional for the simple test flow to reduce hurdle
    if (!intake.privacyAgreed) newErrors.privacy = '개인정보 처리 방침에 동의해주세요';
    if (!intake.disclaimerAgreed) newErrors.disclaimer = '면책 고지에 동의해주세요';

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      const firstErrorKey = Object.keys(newErrors)[0];
      const fieldMap: Record<string, string> = {
        childName: 'input-childName',
        gender: 'input-gender',
        birthDate: 'input-birthDate',
        privacy: 'input-privacy',
        disclaimer: 'input-disclaimer',
      };
      const elementId = fieldMap[firstErrorKey];
      const element = document.getElementById(elementId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }

    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      resetSurveyOnly();
      router.replace('/survey');
    }
  };

  return (
    <div className="bg-background-light dark:bg-background-dark text-text-main dark:text-gray-100 min-h-screen flex flex-col items-center font-body">
      <div className="w-full max-w-md bg-background-light dark:bg-background-dark h-full min-h-screen flex flex-col shadow-2xl overflow-x-hidden relative">
        <Navbar title="기본 정보" showBack />

        <div className="flex-1 overflow-y-auto px-6 py-10 space-y-12 w-full pb-32">
          {/* Intro */}
          <section className="text-center space-y-2">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">✨</span>
            </div>
            <h2 className="text-2xl font-bold text-text-main dark:text-white">우리 아이 기질을 알아볼까요?</h2>
            <p className="text-text-sub text-sm leading-relaxed">
              아이의 이름과 생일을 토대로<br />
              딱 맞는 맞춤형 양육 솔루션을 준비해드릴게요.
            </p>
          </section>

          {/* 아이 정보 섹션 */}
          <section className="space-y-6">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1 h-4 bg-primary rounded-full"></div>
              <h3 className="text-sm font-bold text-text-main dark:text-white">아이의 기본 정보를 알려주세요</h3>
            </div>

            <div className="space-y-5">
              {/* 이름 */}
              <div id="input-childName">
                <label className="block text-[11px] font-bold text-text-sub mb-2 uppercase tracking-wider">이름 또는 닉네임</label>
                <input
                  type="text"
                  value={intake.childName}
                  onChange={(e) => setIntake({ childName: e.target.value })}
                  placeholder="예: 하율이"
                  className={`w-full h-14 px-5 rounded-2xl border-2 bg-white dark:bg-surface-dark text-[15px] font-medium transition-all focus:outline-none focus:border-primary ${errors.childName ? 'border-red-400' : 'border-beige-main/20 dark:border-surface-dark/50 shadow-sm shadow-primary/5'}`}
                />
                {errors.childName && <p className="text-xs text-red-500 mt-1.5 ml-1 font-medium">{errors.childName}</p>}
              </div>

              {/* 성별 */}
              <div id="input-gender">
                <label className="block text-[11px] font-bold text-text-sub mb-2 uppercase tracking-wider">성별</label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIntake({ gender: 'male' })}
                    className={`flex-1 h-14 rounded-2xl border-2 text-[15px] font-bold transition-all ${intake.gender === 'male'
                      ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20'
                      : `bg-white dark:bg-surface-dark border-beige-main/20 dark:border-surface-dark/50 text-text-sub shadow-sm`
                      }`}
                  >
                    남아
                  </button>
                  <button
                    type="button"
                    onClick={() => setIntake({ gender: 'female' })}
                    className={`flex-1 h-14 rounded-2xl border-2 text-[15px] font-bold transition-all ${intake.gender === 'female'
                      ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20'
                      : `bg-white dark:bg-surface-dark border-beige-main/20 dark:border-surface-dark/50 text-text-sub shadow-sm`
                      }`}
                  >
                    여아
                  </button>
                </div>
                {errors.gender && <p className="text-xs text-red-500 mt-1.5 ml-1 font-medium">{errors.gender}</p>}
              </div>

              {/* 생년월일 */}
              <div id="input-birthDate">
                <DatePicker
                  label="생년월일"
                  value={intake.birthDate}
                  onChange={(date) => setIntake({ birthDate: date })}
                  error={errors.birthDate}
                />
              </div>
            </div>
          </section>

          {/* Optional Precision Data section removed (Saju no longer part of service) */}

          {/* 양육 고민 섹션 */}
          <section className="space-y-5">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1 h-4 bg-primary rounded-full"></div>
              <h3 className="text-sm font-bold text-text-main dark:text-white">최근 어떤 고민이 있으신가요?</h3>
            </div>
            <p className="text-xs text-text-sub">최대 3개까지 선택 가능해요. 고민에 맞는 솔루션을 먼저 준비해드립니다.</p>

            <div className="flex flex-wrap gap-2.5">
              {concerns.map((concern) => {
                const isActive = intake.concerns.includes(concern);
                return (
                  <button
                    key={concern}
                    type="button"
                    onClick={() => toggleConcern(concern)}
                    className={`px-5 py-3 rounded-2xl text-[14px] font-bold transition-all border-2 ${isActive
                      ? 'bg-primary/10 border-primary text-primary shadow-sm shadow-primary/10'
                      : 'bg-white dark:bg-surface-dark border-beige-main/20 dark:border-surface-dark/50 text-text-sub'
                      }`}
                  >
                    {CONCERN_LABELS[concern]}
                  </button>
                );
              })}
            </div>
          </section>

          {/* 약관 동의 섹션 */}
          <section className="space-y-4 pt-4 border-t border-beige-main/20 dark:border-surface-dark/50">
            <div id="input-privacy" className="group">
              <label className={`flex items-start gap-4 p-5 rounded-2xl bg-white dark:bg-surface-dark border-2 cursor-pointer transition-all ${errors.privacy ? 'border-red-400' : 'border-beige-main/5 dark:border-surface-dark/30 hover:border-primary/20'}`}>
                <div className="relative mt-1">
                  <input
                    type="checkbox"
                    checked={intake.privacyAgreed}
                    onChange={(e) => setIntake({ privacyAgreed: e.target.checked })}
                    className="peer w-6 h-6 opacity-0 absolute inset-0 cursor-pointer z-10"
                  />
                  <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${intake.privacyAgreed ? 'bg-primary border-primary' : 'border-beige-main/40'}`}>
                    {intake.privacyAgreed && <Icon name="check" size="sm" className="text-white" />}
                  </div>
                </div>
                <div>
                  <p className="text-[14px] font-bold text-text-main dark:text-white group-hover:text-primary transition-colors">[필수] 개인정보 처리 방침 동의</p>
                  <p className="text-[12px] text-text-sub mt-1 leading-relaxed">수집된 정보는 소아 심리 및 기질 기반 분석 목적으로만 활용됩니다.</p>
                </div>
              </label>
              {errors.privacy && <p className="text-xs text-red-500 mt-1.5 ml-1 font-medium">{errors.privacy}</p>}
            </div>

            <div id="input-disclaimer" className="group">
              <label className={`flex items-start gap-4 p-5 rounded-2xl bg-white dark:bg-surface-dark border-2 cursor-pointer transition-all ${errors.disclaimer ? 'border-red-400' : 'border-beige-main/5 dark:border-surface-dark/30 hover:border-primary/20'}`}>
                <div className="relative mt-1">
                  <input
                    type="checkbox"
                    checked={intake.disclaimerAgreed}
                    onChange={(e) => setIntake({ disclaimerAgreed: e.target.checked })}
                    className="peer w-6 h-6 opacity-0 absolute inset-0 cursor-pointer z-10"
                  />
                  <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${intake.disclaimerAgreed ? 'bg-primary border-primary' : 'border-beige-main/40'}`}>
                    {intake.disclaimerAgreed && <Icon name="check" size="sm" className="text-white" />}
                  </div>
                </div>
                <div>
                  <p className="text-[14px] font-bold text-text-main dark:text-white group-hover:text-primary transition-colors">[필수] 분석 면책 고지 확인</p>
                  <p className="text-[12px] text-text-sub mt-1 leading-relaxed">본 결과는 의학적 진단이 아니며, 양육에 도움을 주는 가이드임을 인지합니다.</p>
                </div>
              </label>
              {errors.disclaimer && <p className="text-xs text-red-500 mt-1.5 ml-1 font-medium">{errors.disclaimer}</p>}
            </div>
          </section>
        </div>

        {/* Submit Button */}
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-white/80 dark:bg-surface-dark/80 backdrop-blur-xl border-t border-beige-main/20 z-30">
          <Button variant="primary" size="lg" fullWidth onClick={handleSubmit} className="h-16 rounded-2xl text-lg font-bold shadow-glow">
            건강한 육아 시작하기
          </Button>
        </div>
      </div>
    </div>
  );
}
