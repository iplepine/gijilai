'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { db, UserProfile } from '@/lib/db';
import { supabase } from '@/lib/supabase';
import { Navbar } from '@/components/layout/Navbar';
import { useLocale } from '@/i18n/LocaleProvider';

export default function ProfileEditPage() {
    const { t } = useLocale();
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [fullName, setFullName] = useState('');
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [avatarError, setAvatarError] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!authLoading && !user) {
            router.replace('/login');
            return;
        }

        if (user) {
            db.getUserProfile(user.id).then((data) => {
                setProfile(data);
                setFullName(data.full_name || user.user_metadata?.full_name || '');
                setAvatarUrl(user.user_metadata?.avatar_url || null);
            });
        }
    }, [user, authLoading]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0 || !user) return;
        const file = e.target.files[0];

        try {
            setIsSaving(true);
            const url = await db.uploadUserAvatar(file, user.id);
            setAvatarUrl(url);

            // auth metadata update
            await supabase.auth.updateUser({
                data: { avatar_url: url }
            });
        } catch (error) {
            console.error('Failed to upload image:', error);
            alert(t('settings.imageUploadFailed'));
        } finally {
            setIsSaving(false);
        }
    };

    const handleSave = async () => {
        if (!user || !fullName.trim()) return;

        try {
            setIsSaving(true);
            await db.updateUserProfile(user.id, { full_name: fullName.trim() });

            // update auth metadata as well
            await supabase.auth.updateUser({
                data: { full_name: fullName.trim() }
            });

            alert(t('settings.profileUpdated'));
            router.push('/settings/profile');
        } catch (error) {
            console.error('Failed to update profile:', error);
            alert(t('settings.profileUpdateError'));
        } finally {
            setIsSaving(false);
        }
    };

    if (authLoading || !profile) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark">
                <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="bg-background-light dark:bg-background-dark min-h-screen">
            <div className="max-w-md mx-auto relative min-h-screen flex flex-col">
                <Navbar title={t('settings.editProfile')} />

                <main className="flex-1 px-6 py-8">
                    <div className="flex flex-col items-center mb-10 relative">
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className="size-28 shrink-0 rounded-full bg-primary/10 flex items-center justify-center text-primary border-4 border-white dark:border-gray-800 shadow-sm overflow-hidden cursor-pointer relative group"
                        >
                            {!avatarError && avatarUrl ? (
                                <img
                                    src={avatarUrl}
                                    alt=""
                                    className="w-full h-full object-cover"
                                    referrerPolicy="no-referrer"
                                    onError={() => setAvatarError(true)}
                                />
                            ) : (
                                <span className="material-symbols-outlined text-[48px]">person</span>
                            )}
                            <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="material-symbols-outlined text-white">photo_camera</span>
                            </div>
                        </div>
                        <input
                            type="file"
                            accept="image/*"
                            ref={fileInputRef}
                            className="hidden"
                            onChange={handleImageChange}
                        />
                        <p className="text-xs text-gray-400 mt-4 leading-relaxed text-center break-keep">
                            {t('settings.profileImageHint')}
                        </p>
                    </div>

                    <div className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-navy dark:text-white ml-2">{t('settings.nameOrNickname')}</label>
                            <input
                                type="text"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                placeholder={t('settings.namePlaceholder')}
                                className="w-full h-14 bg-white dark:bg-surface-dark border border-gray-100 dark:border-gray-800 rounded-2xl px-5 text-navy dark:text-white font-medium focus:outline-none focus:border-primary/30 transition-colors shadow-sm"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-navy dark:text-white ml-2">{t('settings.accountEmail')}</label>
                            <input
                                type="text"
                                value={user?.email || ''}
                                disabled
                                className="w-full h-14 bg-gray-50 dark:bg-surface-dark/50 border border-gray-100 dark:border-gray-800 rounded-2xl px-5 text-gray-500 font-medium opacity-70"
                            />
                            <p className="text-[11px] text-gray-400 ml-2">{t('settings.emailCannotChange')}</p>
                        </div>
                    </div>
                </main>

                <div className="p-6 pb-12 mt-auto">
                    <button
                        onClick={handleSave}
                        disabled={isSaving || !fullName.trim()}
                        className="w-full h-14 bg-primary text-white font-bold rounded-2xl active:scale-[0.98] transition-all disabled:opacity-50 disabled:active:scale-100 shadow-md flex items-center justify-center gap-2"
                    >
                        {isSaving ? (
                            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                        ) : (
                            t('settings.saveButton')
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
