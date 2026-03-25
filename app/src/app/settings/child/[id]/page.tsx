'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { db } from '@/lib/db'; // Import db
import { Icon } from '@/components/ui/Icon';
import { DatePicker } from '@/components/ui/DatePicker';
import { Navbar } from '@/components/layout/Navbar';

export default function EditChildPage() {
    const router = useRouter();
    const params = useParams();
    const childId = params.id as string;

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        gender: '',
        birthdate: '',
    });
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    useEffect(() => {
        const fetchChild = async () => {
            try {
                const { data, error } = await supabase
                    .from('children')
                    .select('*')
                    .eq('id', childId)
                    .single();

                if (error) throw error;
                if (data) {
                    setFormData({
                        name: data.name,
                        gender: data.gender.toUpperCase(),
                        birthdate: data.birth_date,
                    });
                    if (data.image_url) {
                        setPreviewUrl(data.image_url);
                    }
                }
            } catch (error) {
                console.error('Error fetching child:', error);
                alert('아이 정보를 불러오는데 실패했습니다.');
                router.back();
            } finally {
                setLoading(false);
            }
        };

        if (childId) {
            fetchChild();
        }
    }, [childId, router]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setAvatarFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const handleSubmit = async () => {
        try {
            setSaving(true);
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) throw new Error('로그인이 필요합니다.');

            let imageUrl = previewUrl; // Keep existing URL if no new file
            if (avatarFile) {
                try {
                    // Force upload new file
                    imageUrl = await db.uploadChildAvatar(avatarFile, user.id);
                } catch (uploadError: any) {
                    console.error('Avatar upload failed:', uploadError);
                    alert(`사진 업로드 실패: ${uploadError.message || '알 수 없는 오류'}`);
                    return;
                }
            }

            const { error } = await supabase
                .from('children')
                .update({
                    name: formData.name,
                    gender: formData.gender.toLowerCase(),
                    birth_date: formData.birthdate,
                    birth_time: null,
                    image_url: imageUrl // Update image_url
                })
                .eq('id', childId);

            if (error) throw error;

            router.refresh();
            router.replace('/');
        } catch (error: any) {
            console.error('Error updating child:', error);
            alert(`수정에 실패했습니다.\n${error.message}`);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm('정말로 삭제하시겠습니까? 모든 분석 기록이 함께 삭제됩니다.')) return;

        try {
            setSaving(true);
            const { error } = await supabase
                .from('children')
                .delete()
                .eq('id', childId);

            if (error) throw error;

            router.refresh();
            router.replace('/');
        } catch (error: any) {
            console.error('Error deleting child:', error);
            alert('삭제에 실패했습니다.');
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#FAFCFA] dark:bg-[#0F170F]">
                <div className="loading-dots text-[#4CAF50]">Loading...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#FAFCFA] dark:bg-[#0F170F] text-[#1A2E1A] dark:text-gray-100 font-sans flex justify-center">
            <div className="relative flex h-full min-h-screen w-full max-w-[480px] flex-col overflow-x-hidden bg-[#FAFCFA] dark:bg-[#0F170F]">
                {/* Header */}
                <Navbar
                    title="아이 정보 수정"
                    rightElement={
                        <button onClick={handleDelete} className="text-red-500 font-medium text-sm">
                            삭제
                        </button>
                    }
                />

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
                            />
                        </div>

                        {/* Birthdate */}
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">생년월일</label>
                            <DatePicker
                                value={formData.birthdate}
                                onChange={(date) => setFormData({ ...formData, birthdate: date })}
                            />
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
                    </div>
                </main>

                {/* Submit Button */}
                <div className="fixed bottom-0 left-0 right-0 p-6 flex justify-center z-40 bg-gradient-to-t from-[#FAFCFA] via-[#FAFCFA]/90 to-transparent dark:from-[#0F170F] dark:via-[#0F170F]/90 pointer-events-none">
                    <div className="max-w-[480px] w-full pointer-events-auto">
                        <button
                            onClick={handleSubmit}
                            disabled={!formData.name || !formData.birthdate || !formData.gender || saving}
                            className="w-full bg-[#2E7D32] dark:bg-[#4CAF50] text-white font-bold text-lg h-16 rounded-2xl shadow-xl shadow-[#2E7D32]/10 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {saving ? '저장 중...' : '수정 완료'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
