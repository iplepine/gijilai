'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Icon } from './Icon';
import { Button } from './Button';

type Step = 'year' | 'month' | 'day';

interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  error?: string;
}

export function DatePicker({ value, onChange, label, error }: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<Step>('year');
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const currentYear = new Date().getFullYear();
  // 연도 범위: 올해부터 15년 전까지
  const years = Array.from({ length: 16 }, (_, i) => currentYear - i);

  const selectedDate = value ? new Date(value) : null;

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const handleOpen = () => {
    if (value) {
      const d = new Date(value);
      setSelectedYear(d.getFullYear());
      setSelectedMonth(d.getMonth());
      setStep('day');
    } else {
      setSelectedYear(null);
      setSelectedMonth(null);
      setStep('year');
    }
    setIsOpen(true);
  };

  const handleYearSelect = (year: number) => {
    setSelectedYear(year);
    setStep('month');
  };

  const handleMonthSelect = (month: number) => {
    setSelectedMonth(month);
    setStep('day');
  };

  const handleDateClick = (day: number) => {
    if (selectedYear === null || selectedMonth === null) return;
    const yyyy = String(selectedYear);
    const mm = String(selectedMonth + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    const dateString = `${yyyy}-${mm}-${dd}`;
    onChange(dateString);
    setIsOpen(false);
  };

  const handleBack = () => {
    if (step === 'month') setStep('year');
    if (step === 'day') setStep('month');
  };

  // 달력 날짜 그리드 생성
  const renderDays = () => {
    if (selectedYear === null || selectedMonth === null) return null;
    const totalDays = daysInMonth(selectedYear, selectedMonth);
    const startDay = firstDayOfMonth(selectedYear, selectedMonth);
    const days = [];

    for (let i = 0; i < startDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-10 w-10" />);
    }

    for (let d = 1; d <= totalDays; d++) {
      const isSelected = selectedDate &&
        selectedDate.getFullYear() === selectedYear &&
        selectedDate.getMonth() === selectedMonth &&
        selectedDate.getDate() === d;

      const isToday = new Date().getFullYear() === selectedYear &&
        new Date().getMonth() === selectedMonth &&
        new Date().getDate() === d;

      days.push(
        <button
          key={d}
          type="button"
          onClick={() => handleDateClick(d)}
          className={`h-10 w-10 rounded-xl text-sm font-bold transition-all flex items-center justify-center
            ${isSelected ? 'bg-primary text-white shadow-md shadow-primary/20' :
              isToday ? 'bg-primary/10 text-primary' : 'text-text-main dark:text-gray-200 hover:bg-beige-main/10'}
          `}
        >
          {d}
        </button>
      );
    }
    return days;
  };

  const getTitle = () => {
    if (step === 'year') return '연도를 선택해주세요';
    if (step === 'month') return `${selectedYear}년`;
    return `${selectedYear}년 ${selectedMonth! + 1}월`;
  };

  // 모달 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative w-full">
      {label && <label className="block text-[11px] font-bold text-text-sub mb-2 uppercase tracking-wider">{label}</label>}

      <button
        type="button"
        onClick={handleOpen}
        className={`w-full h-14 px-5 rounded-2xl border-2 bg-white dark:bg-surface-dark flex items-center justify-between text-[15px] font-medium transition-all ${error ? 'border-red-400' : 'border-beige-main/20 dark:border-surface-dark/50 shadow-sm shadow-primary/5'}`}
      >
        <span className={value ? 'text-text-main dark:text-white' : 'text-text-sub'}>
          {value ? value.replace(/-/g, '. ') : '날짜를 선택해주세요'}
        </span>
        <Icon name="calendar_today" size="sm" className="text-primary/60" />
      </button>

      {error && <p className="text-xs text-red-500 mt-1.5 ml-1 font-medium">{error}</p>}

      {/* Custom Picker Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
          <div
            ref={modalRef}
            className="w-full max-w-sm bg-white dark:bg-surface-dark rounded-3xl shadow-2xl overflow-hidden animate-slide-up"
          >
            {/* Header */}
            <div className="p-6 border-b border-beige-main/10 dark:border-white/5 flex items-center justify-between bg-beige-main/5 dark:bg-white/5">
              <div className="flex items-center gap-2">
                {step !== 'year' && (
                  <button type="button" onClick={handleBack} className="p-2 hover:bg-white dark:hover:bg-slate-800 rounded-full transition-colors -ml-2">
                    <Icon name="chevron_left" size="sm" className="text-text-sub" />
                  </button>
                )}
                <h4 className="font-bold text-lg text-text-main dark:text-white">
                  {getTitle()}
                </h4>
              </div>
              {/* 스텝 인디케이터 */}
              <div className="flex gap-1.5">
                {(['year', 'month', 'day'] as Step[]).map((s) => (
                  <div
                    key={s}
                    className={`h-1.5 rounded-full transition-all ${
                      s === step ? 'w-5 bg-primary' : 'w-1.5 bg-beige-main/30 dark:bg-white/20'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              {/* 연도 선택 */}
              {step === 'year' && (
                <div className="grid grid-cols-3 gap-2">
                  {years.map((year) => {
                    const isSelected = selectedDate?.getFullYear() === year;
                    return (
                      <button
                        key={year}
                        type="button"
                        onClick={() => handleYearSelect(year)}
                        className={`h-12 rounded-xl text-[15px] font-bold transition-all
                          ${isSelected ? 'bg-primary text-white shadow-md shadow-primary/20' :
                            year === currentYear ? 'bg-primary/10 text-primary' : 'text-text-main dark:text-gray-200 hover:bg-beige-main/10'}
                        `}
                      >
                        {year}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* 월 선택 */}
              {step === 'month' && (
                <div className="grid grid-cols-3 gap-2">
                  {Array.from({ length: 12 }, (_, i) => i).map((month) => {
                    const isSelected = selectedDate?.getFullYear() === selectedYear && selectedDate?.getMonth() === month;
                    const isFuture = selectedYear === currentYear && month > new Date().getMonth();
                    return (
                      <button
                        key={month}
                        type="button"
                        disabled={isFuture}
                        onClick={() => handleMonthSelect(month)}
                        className={`h-12 rounded-xl text-[15px] font-bold transition-all
                          ${isFuture ? 'text-text-sub/30 cursor-not-allowed' :
                            isSelected ? 'bg-primary text-white shadow-md shadow-primary/20' :
                            'text-text-main dark:text-gray-200 hover:bg-beige-main/10'}
                        `}
                      >
                        {month + 1}월
                      </button>
                    );
                  })}
                </div>
              )}

              {/* 일 선택 (달력) */}
              {step === 'day' && (
                <>
                  <div className="grid grid-cols-7 gap-1 mb-4 text-center">
                    {['일', '월', '화', '수', '목', '금', '토'].map((day, i) => (
                      <span key={day} className={`text-[10px] font-black uppercase tracking-tighter ${i === 0 ? 'text-red-400' : 'text-text-sub/50'}`}>
                        {day}
                      </span>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1 text-center">
                    {renderDays()}
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-beige-main/5 dark:bg-white/5 flex gap-3">
              <Button variant="secondary" fullWidth onClick={() => setIsOpen(false)}>취소</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
