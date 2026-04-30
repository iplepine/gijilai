'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { db, UserProfile, ChildProfile } from '@/lib/db';
import { useAppStore } from '@/store/useAppStore';
import { useSurveyStore } from '@/store/surveyStore';
import BottomNav from '@/components/layout/BottomNav';
import { Navbar } from '@/components/layout/Navbar';
import Link from 'next/link';
import { useLocale } from '@/i18n/LocaleProvider';

export default function ProfilePage() {
    const { t } = useLocale();
    const router = useRouter();
    const { user, loading: authLoading, signOut } = useAuth();
    const resetAppStore = useAppStore((s) => s.resetAll);
    const resetSurveyStore = useSurveyStore((s) => s.resetSurvey);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [children, setChildren] = useState<ChildProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        async function fetchData() {
            if (authLoading) return;
            if (!user) {
                router.replace('/login');
                return;
            }

            try {
                const data = await db.getDashboardData(user.id);
                setProfile(data.profile);
                setChildren(data.children);
            } catch (error) {
                console.error('Failed to fetch profile data:', error);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, [user, authLoading]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleLogout = async () => {
        if (confirm(t('settings.logoutConfirm'))) {
            await signOut();
            router.replace('/login');
        }
    };

    const handleDeleteAccount = async () => {
        if (confirm(t('settings.deleteAccountConfirm'))) {
            try {
                if (user) {
                    setDeleting(true);
                    const res = await fetch('/api/account/delete', { method: 'DELETE' });
                    if (!res.ok) {
                        const data = await res.json();
                        throw new Error(data.error || t('settings.deleteAccountFailed'));
                    }
                    // 로컬 스토어 초기화 (persist된 설문 데이터 제거)
                    resetAppStore();
                    resetSurveyStore();
                    // auth 유저가 이미 삭제된 상태이므로 signOut 에러 무시
                    await signOut().catch(() => {});
                    router.replace('/login');
                }
            } catch (error) {
                setDeleting(false);
                console.error("Failed to delete account:", error);
                alert(t('settings.deleteAccountError'));
            }
        }
    };

    if (loading || authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark">
                <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="bg-background-light dark:bg-background-dark text-text-main dark:text-gray-100 min-h-screen flex flex-col items-center justify-center font-body pb-0">
            <div className="w-full max-w-md bg-background-light dark:bg-background-dark h-full min-h-screen flex flex-col shadow-2xl overflow-hidden relative">
                {deleting && (
                    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm">
                        <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                        <p className="mt-4 text-white font-bold text-sm">{t('settings.deleteAccountProcessing')}</p>
                    </div>
                )}
                {/* Sticky Header */}
                <Navbar title={t('settings.myInfo')} />

                <main className="app-bottom-nav-scroll flex-1 px-4 py-6 space-y-8">
                    {/* User Profile Card */}
                    <section className="bg-white dark:bg-surface-dark rounded-3xl p-6 shadow-soft border border-gray-100 dark:border-gray-800">
                        <div className="flex items-center gap-4">
                            <div className="size-20 shrink-0 rounded-full bg-primary/10 flex items-center justify-center text-primary border-4 border-white dark:border-gray-800 shadow-sm overflow-hidden">
                                {user?.user_metadata?.avatar_url ? (
                                    <div
                                        role="img"
                                        aria-label={t('settings.myInfo')}
                                        className="w-full h-full bg-cover bg-center"
                                        style={{ backgroundImage: `url("${user.user_metadata.avatar_url}")` }}
                                    />
                                ) : (
                                    <span className="material-symbols-outlined text-4xl">person</span>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h2 className="text-xl font-bold text-navy dark:text-white truncate">
                                    {profile?.full_name || user?.user_metadata?.full_name || t('settings.defaultUser')}
                                </h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
                            </div>
                            <Link href="/settings/profile/edit">
                                <button className="size-10 rounded-full bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-gray-400 active:scale-90 transition-all">
                                    <span className="material-symbols-outlined text-[20px]">edit</span>
                                </button>
                            </Link>
                        </div>
                    </section>

                    {/* Children Management Section */}
                    <section className="space-y-4">
                        <div className="flex items-center justify-between px-2">
                            <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">{t('settings.childManagement')}</h3>
                            <Link href="/settings/child/new" className="text-xs font-bold text-primary flex items-center gap-1">
                                <span className="material-symbols-outlined text-[16px]">add</span>
                                {t('settings.addChildRegister')}
                            </Link>
                        </div>
                        <div className="space-y-3">
                            {children.map((child) => (
                                <Link key={child.id} href={`/settings/child/${child.id}`} className="block">
                                    <div className="flex items-center gap-4 p-4 rounded-2xl bg-white dark:bg-surface-dark border border-gray-100 dark:border-gray-800 hover:shadow-md transition-all active:scale-[0.99]">
                                        <div className="size-12 rounded-xl bg-primary/5 flex items-center justify-center overflow-hidden">
                                            {child.image_url ? (
                                                <div
                                                    role="img"
                                                    aria-label={child.name}
                                                    className="w-full h-full bg-cover bg-center"
                                                    style={{ backgroundImage: `url("${child.image_url}")` }}
                                                />
                                            ) : (
                                                <span className="material-symbols-outlined text-primary">face</span>
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-bold text-navy dark:text-white">{child.name}</p>
                                            <p className="text-xs text-gray-500">{child.gender === 'male' ? t('settings.boy') : t('settings.girl')} · {child.birth_date}</p>
                                        </div>
                                        <span className="material-symbols-outlined text-gray-300">chevron_right</span>
                                    </div>
                                </Link>
                            ))}
                            {children.length === 0 && (
                                <div className="text-center py-8 bg-gray-50 dark:bg-gray-800/30 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
                                    <p className="text-sm text-gray-400">{t('settings.noChildren')}</p>
                                    <Link href="/settings/child/new" className="text-xs font-bold text-primary mt-2 inline-block">
                                        {t('settings.registerFirstChild')}
                                    </Link>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* General Settings Section */}
                    <section className="space-y-4">
                        <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest px-2">{t('settings.appSettings')}</h3>
                        <div className="bg-white dark:bg-surface-dark rounded-3xl overflow-hidden border border-gray-100 dark:border-gray-800 shadow-soft">
                            {[
                                { icon: 'notifications', label: t('settings.notificationSettings'), href: '/settings/notifications' },
                                { icon: 'description', label: t('settings.terms'), href: '/legal/terms' },
                                { icon: 'privacy_tip', label: t('settings.privacy'), href: '/legal/privacy' },
                                { icon: 'receipt_long', label: t('settings.refund'), href: '/legal/refund' },
                                { icon: 'support_agent', label: t('settings.support'), href: '/legal/support' },
                                { icon: 'apartment', label: t('settings.about'), href: '/legal/about' },
                            ].map((item, idx, arr) => (
                                <Link key={idx} href={item.href} className={`flex items-center gap-4 p-5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${idx !== arr.length - 1 ? 'border-b border-gray-50 dark:border-gray-800' : ''}`}>
                                    <div className="size-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 dark:text-gray-400">
                                        <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                                    </div>
                                    <span className="flex-1 text-sm font-bold text-navy dark:text-white">{item.label}</span>
                                    <span className="material-symbols-outlined text-gray-300 text-[20px]">chevron_right</span>
                                </Link>
                            ))}
                        </div>
                    </section>

                    {/* Account Actions Section */}
                    <section className="pt-4 pb-12 flex flex-col gap-2">
                        <button
                            onClick={handleLogout}
                            className="w-full h-14 bg-white dark:bg-surface-dark text-gray-500 dark:text-gray-400 font-bold rounded-2xl border border-gray-100 dark:border-gray-800 active:scale-[0.98] transition-all"
                        >
                            {t('common.logout')}
                        </button>
                        <button
                            onClick={handleDeleteAccount}
                            disabled={deleting}
                            className="w-full py-4 text-xs text-gray-300 dark:text-gray-600 font-medium hover:text-red-400 transition-colors disabled:opacity-50"
                        >
                            {t('settings.deleteAccount')}
                        </button>
                    </section>
                </main>

                <BottomNav />
            </div>
        </div>
    );
}
