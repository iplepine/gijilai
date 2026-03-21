import React from 'react';
import { Question } from '../../types/survey';

interface QuestionCardProps {
    question: Question;
    currentAnswer?: number;
    onAnswer: (score: number) => void;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({ question, currentAnswer, onAnswer }) => {
    // BARS-specific rendering logic
    const isBARS = !!question.context;

    const getThemeColor = () => {
        if (question.type === 'CHILD') return '#FFD700'; // Soft Yellow
        if (question.type === 'PARENT') return '#4A90E2'; // Calm Blue
        if (question.type === 'PARENTING_STYLE') return '#8BC34A'; // Sage Green
        return '#6C5CE7'; // Primary fallback
    };

    const themeColor = getThemeColor();

    const renderOptionContent = (value: number, label: string) => {
        // If choices array exists, use the text at index (value - 1)
        if (question.choices && question.choices[value - 1]) {
            return (
                <div className="flex items-center w-full">
                    <div className="flex-1 text-left">
                        <div className="font-bold text-gray-800 text-sm mb-0.5">
                            {value}. {question.choices[value - 1]}
                        </div>
                    </div>
                </div>
            );
        }

        // Fallback for generic legacy questions if any
        return (
            <div className="flex items-center w-full">
                <div className="flex-1 text-left">
                    <div className="font-bold text-gray-800 text-sm mb-0.5">
                        {value}. {label}
                    </div>
                </div>
            </div>
        );
    };

    const options = [
        { value: 1, label: '매우 그렇지 않다' }, // Or specific label if needed
        { value: 2, label: '그렇지 않다' },
        { value: 3, label: '보통이다' },
        { value: 4, label: '그렇다' },
        { value: 5, label: '매우 그렇다' },
    ];

    // Using inline style for dynamic hex colors since Tailwind arbitrary values can't be computed fully dynamically this simply in standard strings without safelists
    return (
        <div className="flex flex-col items-center justify-center p-6 bg-white rounded-2xl shadow-lg border border-gray-100 min-h-[500px] w-full max-w-md mx-auto animate-fadeIn">
            <div className="mb-6 text-center">

                <h3 className="text-xl font-bold text-gray-900 leading-tight">
                    {isBARS ? question.context : question.text}
                </h3>
                {isBARS && (
                    <p className="text-sm text-gray-400 mt-2">
                        {question.type === 'CHILD'
                            ? "다음 상황에서 아이는 어떻게 행동하나요?"
                            : question.type === 'PARENT'
                                ? "다음 상황에서 나는 어떻게 행동하나요?"
                                : "다음 상황에서 양육자로서 어떻게 대처하나요?"
                        }
                    </p>
                )}
            </div>

            <div className="flex flex-col w-full gap-3">
                {options.map((option) => {
                    const isSelected = currentAnswer === option.value;
                    return (
                        <button
                            key={option.value}
                            onClick={() => onAnswer(option.value)}
                            className={`
                                w-full py-3 px-4 rounded-xl border-2 transition-all duration-200
                                ${isSelected
                                    ? 'bg-opacity-10'
                                    : 'bg-white border-gray-100 hover:bg-gray-50'
                                }
                            `}
                            style={{
                                borderColor: isSelected ? themeColor : undefined,
                                backgroundColor: isSelected ? `${themeColor}1A` : undefined, // 1A is ~10% opacity
                                boxShadow: isSelected ? `0 0 0 1px ${themeColor}` : undefined
                            }}
                        >
                            {renderOptionContent(option.value, option.label)}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
