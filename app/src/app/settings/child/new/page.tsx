'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { db } from '@/lib/db';
import { useAppStore } from '@/store/useAppStore';
import { Icon } from '@/components/ui/Icon';
import { DatePicker } from '@/components/ui/DatePicker';
import { Navbar } from '@/components/layout/Navbar';
import { useLocale } from '@/i18n/LocaleProvider';
import { CHILD_PROFILE_LIMIT_REACHED_CODE, type ChildProfileAccess } from '@/lib/access';

type ChildAccessPayload = {
    access?: Pick<ChildProfileAccess,
        | 'canCreateChild'
        | 'canDeleteChild'
        | 'canDeleteLastChild'
        | 'childCount'
        | 'lifetimeChildSlots'
        | 'freeChildProfileLimit'
        | 'hasFullChildProfileAccess'
        | 'hasSubscription'
    >;
    code?: string;
    error?: string;
    child?: { id: string };
};

export default function RegisterChildPage() {
    const { t } = useLocale();
    const router = useRouter();
    const setSelectedChildId = useAppStore((s) => s.setSelectedChildId);
    const [loading, setLoading] = useState(false);
    const [accessLoading, setAccessLoading] = useState(true);
    const [childAccess, setChildAccess] = useState<ChildAccessPayload['access'] | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        gender: '',
        birthdate: '',
    });
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    const getErrorMessage = (error: unknown) => {
        if (error instanceof Error) return error.message;
        if (typeof error === 'object' && error !== null) {
            const record = error as Record<string, unknown>;
            if (typeof record.details === 'string') return record.details;
            if (typeof record.message === 'string') return record.message;
            if (typeof record.error === 'string') return record.error;
        }
        return t('common.error');
    };

    const loadChildAccess = useCallback(async () => {
        try {
            const response = await fetch('/api/children');
            const payload = await response.json().catch(() => null) as ChildAccessPayload | null;
            if (response.ok && payload?.access) {
                setChildAccess(payload.access);
            }
            return payload?.access ?? null;
        } catch (error) {
            console.error('Error loading child access:', error);
            return null;
        } finally {
            setAccessLoading(false);
        }
    }, []);

    useEffect(() => {
        loadChildAccess();
    }, [loadChildAccess]);

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

            const latestAccess = await loadChildAccess();
            if (latestAccess && !latestAccess.canCreateChild) {
                alert(t('settings.childProfileLimitReached'));
                router.push('/pricing');
                return;
            }

            let imageUrl = null;
            if (avatarFile) {
                try {
                    imageUrl = await db.uploadChildAvatar(avatarFile, user.id);
                } catch (uploadError) {
                    console.error('Avatar upload failed:', uploadError);
                    alert(t('settings.photoUploadFailedContinue'));
                }
            }

            const response = await fetch('/api/children', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: formData.name,
                    gender: formData.gender.toLowerCase(),
                    birthDate: formData.birthdate,
                    birthTime: null,
                    imageUrl,
                }),
            });
            const payload = await response.json().catch(() => null) as ChildAccessPayload | null;

            if (!response.ok) {
                if (payload?.code === CHILD_PROFILE_LIMIT_REACHED_CODE || payload?.error === CHILD_PROFILE_LIMIT_REACHED_CODE) {
                    alert(t('settings.childProfileLimitReached'));
                    router.push('/pricing');
                    return;
                }
                throw new Error(getErrorMessage(payload));
            }

            if (payload?.child?.id) {
                setSelectedChildId(payload.child.id);
            }

            router.refresh();
            router.replace('/');
        } catch (error) {
            console.error('Error registering child:', error);
            alert(`${t('settings.registerFailed')}\n${getErrorMessage(error)}`);
        } finally {
            setLoading(false);
        }
    };

    const childLimitBlocked = childAccess?.canCreateChild === false;
    const formDisabled = loading || accessLoading || childLimitBlocked;

    return (
        <div className="bg-background-light dark:bg-background-dark min-h-screen flex flex-col items-center font-body">
            <div className="w-full max-w-md bg-background-light dark:bg-background-dark min-h-screen flex flex-col shadow-2xl overflow-x-hidden relative">
                <Navbar title={t('settings.registerChild')} />

                <main className="app-page-scroll flex-1 px-6">
                    {/* Avatar Upload Section */}
                    <div className="flex flex-col items-center mt-6 mb-8">
                        <label className={`relative group ${childLimitBlocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
                            <div className="w-32 h-32 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center border-4 border-white dark:border-surface-dark shadow-md overflow-hidden">
                                {previewUrl ? (
                                    <div
                                        role="img"
                                        aria-label="Preview"
                                        className="w-full h-full bg-cover bg-center"
                                        style={{ backgroundImage: `url("${previewUrl}")` }}
                                    />
                                ) : (
                                    <span className="material-symbols-outlined text-[56px] text-primary/40 dark:text-primary/30">child_care</span>
                                )}
                            </div>
                            <div className="absolute bottom-0 right-0 bg-primary text-white p-2.5 rounded-full shadow-lg active:scale-90 transition-transform flex items-center justify-center">
                                <Icon name="photo_camera" size="sm" />
                            </div>
                            <input accept="image/*" className="hidden" type="file" onChange={handleFileChange} disabled={formDisabled} />
                        </label>
                        <p className="mt-4 text-text-main dark:text-white font-medium">{t('settings.registerChildPhoto')}</p>
                    </div>

                    <div className="space-y-6">
                        {childLimitBlocked && (
                            <div className="p-4 bg-amber-50 dark:bg-amber-500/10 rounded-2xl border border-amber-200/80 dark:border-amber-400/20">
                                <div className="flex gap-3">
                                    <div className="w-9 h-9 shrink-0 rounded-full bg-white dark:bg-white/10 flex items-center justify-center text-amber-700 dark:text-amber-200">
                                        <Icon name="lock" size="sm" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="font-bold text-sm text-amber-950 dark:text-amber-100">{t('settings.childProfileLimitTitle')}</p>
                                        <p className="mt-1 text-[13px] leading-relaxed text-amber-900/80 dark:text-amber-100/80">{t('settings.childProfileLimitDesc')}</p>
                                        <button
                                            type="button"
                                            onClick={() => router.push('/pricing')}
                                            className="mt-3 h-10 px-4 rounded-xl bg-primary text-white text-sm font-bold active:scale-[0.98] transition-transform"
                                        >
                                            {t('settings.childProfileLimitCta')}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Name Input */}
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-text-sub ml-1">{t('settings.childName')}</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                disabled={formDisabled}
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
                                disabled={formDisabled}
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
                                        disabled={formDisabled}
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

                        {/* Submit Button */}
                        <div className="pt-2">
                            <button
                                onClick={handleSubmit}
                                disabled={!formData.name || !formData.birthdate || !formData.gender || formDisabled}
                                className="w-full bg-primary text-white font-bold text-lg h-16 rounded-2xl shadow-card active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? t('settings.registering') : t('settings.registerComplete')}
                            </button>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
