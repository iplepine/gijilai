'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PARENT_REPORT_PROMPT, CHILD_REPORT_PROMPT } from '@/lib/prompts';

export default function LLMConnectionTestPage() {
    const router = useRouter();

    useEffect(() => {
        if (process.env.NODE_ENV !== 'development') {
            router.replace('/');
        }
    }, [router]);

    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'PARENT' | 'CHILD'>('PARENT');
    const [customPrompt, setCustomPrompt] = useState<string>(PARENT_REPORT_PROMPT);
    const [model, setModel] = useState<string>('gpt-4o');
    const [includeAnswers, setIncludeAnswers] = useState(false);

    const [formData, setFormData] = useState({
        userName: '테스트 유저',
        NS: 50,
        HA: 50,
        RD: 50,
        P: 50,
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: name === 'userName' ? value : Number(value),
        }));
    };

    const handleTabChange = (type: 'PARENT' | 'CHILD') => {
        setActiveTab(type);
        // Automatically switch prompt when tab changes, unless user modified it?
        // For simplicity, let's just reset to default for that type.
        if (type === 'PARENT') {
            setCustomPrompt(PARENT_REPORT_PROMPT);
        } else {
            setCustomPrompt(CHILD_REPORT_PROMPT);
        }
    };

    const generateMockAnswers = (type: 'PARENT' | 'CHILD') => {
        // Generate some random answers for testing
        // ID prefix: cbq_ for CHILD, atq_ for PARENT (based on surveyQuestions.ts)
        const prefix = type === 'CHILD' ? 'cbq_' : 'atq_';
        const mockAnswers = [];
        for (let i = 1; i <= 10; i++) {
            mockAnswers.push({
                questionId: `${prefix}${i}`,
                score: Math.floor(Math.random() * 5) + 1 // 1-5 score
            });
        }
        return mockAnswers;
    };

    const handleTest = async () => {
        setLoading(true);
        setResult(null);
        setError(null);

        const answers = includeAnswers ? generateMockAnswers(activeTab) : undefined;

        try {
            const response = await fetch('/api/llm/report', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userName: formData.userName,
                    type: activeTab,
                    systemPrompt: customPrompt,
                    model: model,
                    scores: {
                        NS: formData.NS,
                        HA: formData.HA,
                        RD: formData.RD,
                        P: formData.P,
                    },
                    answers: answers,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to fetch');
            }

            setResult(data.report);
        } catch (err: any) {
            setError(err.message || 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-8 max-w-4xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold">OpenAI API Connection Test</h1>

            {/* Type Selection */}
            <div className="flex justify-between items-center border-b pb-2">
                <div className="flex space-x-4">
                    <button
                        className={`pb-2 px-4 ${activeTab === 'PARENT' ? 'border-b-2 border-blue-600 font-bold' : 'text-gray-500'}`}
                        onClick={() => handleTabChange('PARENT')}
                    >
                        양육자 리포트 (Parent)
                    </button>
                    <button
                        className={`pb-2 px-4 ${activeTab === 'CHILD' ? 'border-b-2 border-green-600 font-bold' : 'text-gray-500'}`}
                        onClick={() => handleTabChange('CHILD')}
                    >
                        아이 리포트 (Child)
                    </button>
                </div>

                <div className="flex items-center space-x-4">
                    <label className="flex items-center space-x-2 text-sm cursor-pointer">
                        <input
                            type="checkbox"
                            checked={includeAnswers}
                            onChange={(e) => setIncludeAnswers(e.target.checked)}
                            className="rounded"
                        />
                        <span>Include Mock Answers</span>
                    </label>

                    <div className="flex items-center space-x-2">
                        <label className="text-sm font-medium">Model:</label>
                        <select
                            value={model}
                            onChange={(e) => setModel(e.target.value)}
                            className="p-1 border rounded"
                        >
                            <option value="gpt-4o">gpt-4o</option>
                            <option value="gpt-4-turbo">gpt-4-turbo</option>
                            <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column: Form Inputs */}
                <div className="space-y-4">
                    <div className="p-4 border rounded bg-gray-50 space-y-4">
                        <h3 className="font-semibold text-lg">Input Data</h3>
                        <div>
                            <label className="block text-sm font-medium mb-1">User Name</label>
                            <input
                                type="text"
                                name="userName"
                                value={formData.userName}
                                onChange={handleChange}
                                className="w-full p-2 border rounded"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">NS (자극추구)</label>
                                <input
                                    type="number"
                                    name="NS"
                                    value={formData.NS}
                                    onChange={handleChange}
                                    className="w-full p-2 border rounded"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">HA (위험회피)</label>
                                <input
                                    type="number"
                                    name="HA"
                                    value={formData.HA}
                                    onChange={handleChange}
                                    className="w-full p-2 border rounded"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">RD (사회적민감성)</label>
                                <input
                                    type="number"
                                    name="RD"
                                    value={formData.RD}
                                    onChange={handleChange}
                                    className="w-full p-2 border rounded"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">P (인내력)</label>
                                <input
                                    type="number"
                                    name="P"
                                    value={formData.P}
                                    onChange={handleChange}
                                    className="w-full p-2 border rounded"
                                />
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleTest}
                        disabled={loading}
                        className={`w-full text-white p-3 rounded font-bold shadow transition-colors ${activeTab === 'PARENT' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'
                            } disabled:opacity-50`}
                    >
                        {loading ? 'Generating Report...' : `Generate ${activeTab} Report`}
                    </button>

                    {error && (
                        <div className="p-4 bg-red-50 text-red-700 rounded border border-red-200">
                            <strong>Error:</strong> {error}
                        </div>
                    )}
                </div>

                {/* Right Column: Prompt Editor */}
                <div className="space-y-2">
                    <div className="flex justify-between items-end">
                        <label className="block font-semibold">System Prompt Editor</label>
                        <span className="text-xs text-gray-500">Edit to test different instructions</span>
                    </div>
                    <textarea
                        value={customPrompt}
                        onChange={(e) => setCustomPrompt(e.target.value)}
                        className="w-full h-[400px] p-3 text-xs font-mono border rounded bg-gray-900 text-green-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        spellCheck={false}
                    />
                </div>
            </div>

            {/* Result Section */}
            {result && (
                <div className="space-y-2 pt-6 border-t">
                    <h2 className="font-bold text-xl">Result Preview (Markdown)</h2>
                    <div className="p-6 bg-white border rounded shadow whitespace-pre-wrap font-sans leading-relaxed">
                        {result}
                    </div>
                </div>
            )}
        </div>
    );
}
