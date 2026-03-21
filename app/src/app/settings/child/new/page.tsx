'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { db } from '@/lib/db';
import { Icon } from '@/components/ui/Icon';
import { DatePicker } from '@/components/ui/DatePicker';

export default function RegisterChildPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        gender: '',
        birthdate: '',
        birthtime: '',
    });
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setAvatarFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const handleSubmit = async () => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) throw new Error('로그인이 필요합니다.');

            let imageUrl = null;
            if (avatarFile) {
                try {
                    imageUrl = await db.uploadChildAvatar(avatarFile);
                } catch (uploadError) {
                    console.error('Avatar upload failed:', uploadError);
                    alert('사진 업로드에 실패했지만, 나머지 정보는 계속 저장합니다.');
                }
            }

            const { error } = await supabase
                .from('children')
                .insert({
                    parent_id: user.id,
                    name: formData.name,
                    gender: formData.gender.toLowerCase(),
                    birth_date: formData.birthdate,
                    birth_time: formData.birthtime || null,
                    image_url: imageUrl
                });

            if (error) {
                console.error('Supabase Insert Error:', error);
                throw error;
            }

            router.refresh();
            router.replace('/');
        } catch (error: any) {
            console.error('Error registering child:', error);
            alert(`아이 등록에 실패했습니다.\n${error.message || error.details || '알 수 없는 오류가 발생했습니다.'}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#FAFCFA] dark:bg-[#0F170F] text-[#1A2E1A] dark:text-gray-100 font-sans flex justify-center">
            <div className="relative flex h-full min-h-screen w-full max-w-[480px] flex-col overflow-x-hidden bg-[#FAFCFA] dark:bg-[#0F170F]">
                {/* Header */}
                <header className="flex items-center p-4 justify-between sticky top-0 z-30 bg-[#FAFCFA]/90 dark:bg-[#0F170F]/90 backdrop-blur-xl">
                    <button
                        onClick={() => router.back()}
                        className="flex w-10 h-10 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                    >
                        <Icon name="arrow_back_ios_new" className="text-gray-700 dark:text-gray-300" />
                    </button>
                    <h1 className="text-lg font-bold tracking-tight text-gray-900 dark:text-white">아이 등록하기</h1>
                    <div className="w-10 h-10"></div>
                </header>

                <main className="flex-1 px-6 pb-32">
                    {/* Avatar Upload Section */}
                    <div className="flex flex-col items-center mt-6 mb-8">
                        <div className="relative group cursor-pointer">
                            <div className="w-32 h-32 rounded-full bg-[#E8F5E9] dark:bg-green-900/30 flex items-center justify-center border-4 border-white dark:border-gray-800 shadow-[0_10px_25px_-5px_rgba(76,175,80,0.15)] overflow-hidden">
                                {previewUrl ? (
                                    <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                                ) : (
                                    <Icon name="child_care" className="text-[#4CAF50]/40 dark:text-[#4CAF50]/20 text-6xl" size="lg" />
                                )}
                            </div>
                            <label className="absolute bottom-0 right-0 bg-[#4CAF50] text-white p-2.5 rounded-full cursor-pointer shadow-lg active:scale-90 transition-transform flex items-center justify-center">
                                <Icon name="photo_camera" size="sm" />
                                <input accept="image/*" className="hidden" type="file" onChange={handleFileChange} />
                            </label>
                        </div>
                        <p className="mt-4 text-gray-900 dark:text-gray-100 font-medium">우리 아이의 소중한 모습을 등록해주세요</p>
                    </div>

                    <div className="space-y-6">
                        {/* Name Input */}
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">아이 이름</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="w-full h-14 px-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-[#4CAF50] focus:border-[#4CAF50] transition-all placeholder:text-gray-400 dark:placeholder:text-gray-500 shadow-sm outline-none"
                                placeholder="아이의 이름을 입력해주세요"
                            />
                        </div>

                        {/* Birthdate & Time */}
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">생년월일 및 태어난 시간</label>
                            <div className="grid grid-cols-2 gap-3">
                                <DatePicker
                                    value={formData.birthdate}
                                    onChange={(date) => setFormData({ ...formData, birthdate: date })}
                                />
                                <div className="relative">
                                    <input
                                        type="time"
                                        value={formData.birthtime}
                                        onChange={(e) => setFormData({ ...formData, birthtime: e.target.value })}
                                        className="w-full h-14 px-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-[#4CAF50] focus:border-[#4CAF50] transition-all text-sm outline-none"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Gender Selection */}
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">성별</label>
                            <div className="flex gap-3">
                                {['MALE', 'FEMALE'].map((gender) => (
                                    <button
                                        key={gender}
                                        onClick={() => setFormData({ ...formData, gender })}
                                        className={`flex-1 h-14 flex items-center justify-center gap-2 rounded-2xl border transition-all ${formData.gender === gender
                                            ? 'border-2 border-[#4CAF50] bg-[#E8F5E9]/50 dark:bg-[#4CAF50]/10 text-[#2E7D32] dark:text-[#4CAF50] font-bold shadow-sm'
                                            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-medium hover:border-[#4CAF50]'
                                            }`}
                                    >
                                        <Icon
                                            name={gender === 'MALE' ? 'boy' : 'girl'}
                                            className={formData.gender === gender ? 'fill-1' : ''}
                                        />
                                        {gender === 'MALE' ? '남아' : '여아'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Info Box */}
                        <div className="p-4 bg-[#E8F5E9]/30 dark:bg-green-900/10 rounded-2xl border border-[#E8F5E9] dark:border-green-900/20">
                            <p className="text-[13px] leading-relaxed text-[#2E7D32] dark:text-[#4CAF50]/80 text-center font-medium">
                                등록하신 정보와 사진은 아이만을 위한<br />
                                맞춤형 분석 리포트와 맞춤형 코칭에 사용됩니다.
                            </p>
                        </div>
                    </div>
                </main>

                {/* Submit Button */}
                <div className="fixed bottom-0 left-0 right-0 p-6 flex justify-center z-40 bg-gradient-to-t from-[#FAFCFA] via-[#FAFCFA]/90 to-transparent dark:from-[#0F170F] dark:via-[#0F170F]/90 pointer-events-none">
                    <div className="max-w-[480px] w-full pointer-events-auto">
                        <button
                            onClick={handleSubmit}
                            disabled={!formData.name || !formData.birthdate || !formData.gender || loading}
                            className="w-full bg-[#2E7D32] dark:bg-[#4CAF50] text-white font-bold text-lg h-16 rounded-2xl shadow-xl shadow-[#2E7D32]/10 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? '등록 중...' : '아이 등록 완료'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
