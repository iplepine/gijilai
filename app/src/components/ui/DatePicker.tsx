'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Icon } from './Icon';
import { Button } from './Button';

interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  error?: string;
}

export function DatePicker({ value, onChange, label, error }: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(value ? new Date(value) : new Date());
  const modalRef = useRef<HTMLDivElement>(null);

  // 현재 선택된 날짜 (없을 경우 오늘)
  const selectedDate = value ? new Date(value) : null;

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const handlePrevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  const handleDateClick = (day: number) => {
    const newDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    const dateString = newDate.toISOString().split('T')[0];
    onChange(dateString);
    setIsOpen(false);
  };

  const days = [];
  const totalDays = daysInMonth(viewDate.getFullYear(), viewDate.getMonth());
  const startDay = firstDayOfMonth(viewDate.getFullYear(), viewDate.getMonth());

  // 빈 칸 추가
  for (let i = 0; i < startDay; i++) {
    days.push(<div key={`empty-${i}`} className="h-10 w-10" />);
  }

  // 날짜 추가
  for (let d = 1; d <= totalDays; d++) {
    const isSelected = selectedDate && 
      selectedDate.getFullYear() === viewDate.getFullYear() && 
      selectedDate.getMonth() === viewDate.getMonth() && 
      selectedDate.getDate() === d;
    
    const isToday = new Date().getFullYear() === viewDate.getFullYear() && 
      new Date().getMonth() === viewDate.getMonth() && 
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
        onClick={() => setIsOpen(true)}
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
              <h4 className="font-bold text-lg text-text-main dark:text-white">
                {viewDate.getFullYear()}년 {viewDate.getMonth() + 1}월
              </h4>
              <div className="flex gap-2">
                <button onClick={handlePrevMonth} className="p-2 hover:bg-white dark:hover:bg-slate-800 rounded-full transition-colors">
                  <Icon name="chevron_left" size="sm" className="text-text-sub" />
                </button>
                <button onClick={handleNextMonth} className="p-2 hover:bg-white dark:hover:bg-slate-800 rounded-full transition-colors">
                  <Icon name="chevron_right" size="sm" className="text-text-sub" />
                </button>
              </div>
            </div>

            {/* Calendar Grid */}
            <div className="p-6">
              <div className="grid grid-cols-7 gap-1 mb-4 text-center">
                {['일', '월', '화', '수', '목', '금', '토'].map((day, i) => (
                  <span key={day} className={`text-[10px] font-black uppercase tracking-tighter ${i === 0 ? 'text-red-400' : 'text-text-sub/50'}`}>
                    {day}
                  </span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1 text-center">
                {days}
              </div>
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
