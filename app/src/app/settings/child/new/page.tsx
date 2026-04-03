'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { db } from '@/lib/db';
import { useAppStore } from '@/store/useAppStore';
import { Icon } from '@/components/ui/Icon';
import { DatePicker } from '@/components/ui/DatePicker';
import { Navbar } from '@/components/layout/Navbar';
import { useLocale } from '@/i18n/LocaleProvider';

export default function RegisterChildPage() {
    const { t } = useLocale();
    const router = useRouter();
    const setSelectedChildId = useAppStore((s) => s.setSelectedChildId);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        gender: '',
        birthdate: '',
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

            if (!user) throw new Error(t('settings.loginRequired'));

            let imageUrl = null;
            if (avatarFile) {
                try {
                    imageUrl = await db.uploadChildAvatar(avatarFile, user.id);
                } catch (uploadError) {
                    console.error('Avatar upload failed:', uploadError);
                    alert(t('settings.photoUploadFailedContinue'));
                }
            }

            const { data: newChild, error } = await supabase
                .from('children')
                .insert({
                    parent_id: user.id,
                    name: formData.name,
                    gender: formData.gender.toLowerCase(),
                    birth_date: formData.birthdate,
                    birth_time: null,
                    image_url: imageUrl
                })
                .select('id')
                .single();

            if (error) {
                console.error('Supabase Insert Error:', error);
                throw error;
            }

            if (newChild) {
                setSelectedChildId(newChild.id);
            }

            router.refresh();
            router.replace('/');
        } catch (error: any) {
            console.error('Error registering child:', error);
            alert(`${t('settings.registerFailed')}\n${error.message || error.details || t('common.error')}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-background-light dark:bg-background-dark min-h-screen flex flex-col items-center font-body">
            <div className="w-full max-w-md bg-background-light dark:bg-background-dark min-h-screen flex flex-col shadow-2xl overflow-x-hidden relative">
                <Navbar title={t('settings.registerChild')} />

                <main className="flex-1 px-6 pb-32">
                    {/* Avatar Upload Section */}
                    <div className="flex flex-col items-center mt-6 mb-8">
                        <label className="relative group cursor-pointer">
                            <div className="w-32 h-32 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center border-4 border-white dark:border-surface-dark shadow-md overflow-hidden">
                                {previewUrl ? (
                                    <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                                ) : (
                                    <span className="material-symbols-outlined text-[56px] text-primary/40 dark:text-primary/30">child_care</span>
                                )}
                            </div>
                            <div className="absolute bottom-0 right-0 bg-primary text-white p-2.5 rounded-full shadow-lg active:scale-90 transition-transform flex items-center justify-center">
                                <Icon name="photo_camera" size="sm" />
                            </div>
                            <input accept="image/*" className="hidden" type="file" onChange={handleFileChange} />
                        </label>
                        <p className="mt-4 text-text-main dark:text-white font-medium">{t('settings.registerChildPhoto')}</p>
                    </div>

                    <div className="space-y-6">
                        {/* Name Input */}
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-text-sub ml-1">{t('settings.childName')}</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="w-full h-14 px-4 bg-white dark:bg-surface-dark border border-primary/10 dark:border-white/10 rounded-2xl focus:ring-2 focus:ring-primary focus:border-primary transition-all placeholder:text-text-sub/50 shadow-sm outline-none"
                                placeholder={t('settings.childNamePlaceholder')}
                            />
                        </div>

                        {/* Birthdate */}
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-text-sub ml-1">{t('settings.birthDate')}</label>
                            <DatePicker
                                value={formData.birthdate}
                                onChange={(date) => setFormData({ ...formData, birthdate: date })}
                            />
                        </div>

                        {/* Gender Selection */}
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-text-sub ml-1">{t('settings.gender')}</label>
                            <div className="flex gap-3">
                                {['MALE', 'FEMALE'].map((gender) => (
                                    <button
                                        key={gender}
                                        onClick={() => setFormData({ ...formData, gender })}
                                        className={`flex-1 h-14 flex items-center justify-center gap-2 rounded-2xl border transition-all ${formData.gender === gender
                                            ? 'border-2 border-primary bg-primary/10 dark:bg-primary/20 text-primary font-bold shadow-sm'
                                            : 'border-primary/10 dark:border-white/10 bg-white dark:bg-surface-dark text-text-sub font-medium hover:border-primary/30'
                                            }`}
                                    >
                                        <Icon
                                            name={gender === 'MALE' ? 'boy' : 'girl'}
                                            className={formData.gender === gender ? 'fill-1' : ''}
                                        />
                                        {gender === 'MALE' ? t('settings.boy') : t('settings.girl')}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Info Box */}
                        <div className="p-4 bg-primary/5 dark:bg-primary/10 rounded-2xl border border-primary/10">
                            <p className="text-[13px] leading-relaxed text-primary text-center font-medium">
                                {t('settings.childInfoNote')}
                            </p>
                        </div>
                    </div>
                </main>

                {/* Submit Button */}
                <div className="fixed bottom-0 left-0 right-0 p-6 flex justify-center z-40 bg-gradient-to-t from-[#F9F8F6] via-[#F9F8F6]/90 to-transparent dark:from-[#161311] dark:via-[#161311]/90 pointer-events-none">
                    <div className="max-w-md w-full pointer-events-auto">
                        <button
                            onClick={handleSubmit}
                            disabled={!formData.name || !formData.birthdate || !formData.gender || loading}
                            className="w-full bg-primary text-white font-bold text-lg h-16 rounded-2xl shadow-card active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? t('settings.registering') : t('settings.registerComplete')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
