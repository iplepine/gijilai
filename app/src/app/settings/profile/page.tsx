'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { db, UserProfile, ChildProfile } from '@/lib/db';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/store/useAppStore';
import { useSurveyStore } from '@/store/surveyStore';
import BottomNav from '@/components/layout/BottomNav';
import { Navbar } from '@/components/layout/Navbar';
import Link from 'next/link';

export default function ProfilePage() {
    const router = useRouter();
    const { user, loading: authLoading, signOut } = useAuth();
    const resetAppStore = useAppStore((s) => s.resetAll);
    const resetSurveyStore = useSurveyStore((s) => s.resetSurvey);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [children, setChildren] = useState<ChildProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [avatarError, setAvatarError] = useState(false);

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
    }, [user, authLoading, router]);

    const handleLogout = async () => {
        if (confirm('로그아웃 하시겠습니까?')) {
            await signOut();
            router.replace('/login');
        }
    };

    const handleDeleteAccount = async () => {
        if (confirm('정말로 회원 탈퇴를 진행하시겠습니까?\n프로필, 아이 기질 검사 결과 및 처방전 등 모든 데이터가 삭제되며 복구할 수 없습니다.')) {
            try {
                if (user) {
                    const res = await fetch('/api/account/delete', { method: 'DELETE' });
                    if (!res.ok) {
                        const data = await res.json();
                        throw new Error(data.error || '회원 탈퇴 실패');
                    }
                    // 로컬 스토어 초기화 (persist된 설문 데이터 제거)
                    resetAppStore();
                    resetSurveyStore();
                    // auth 유저가 이미 삭제된 상태이므로 signOut 에러 무시
                    await signOut().catch(() => {});
                    router.replace('/login');
                }
            } catch (error) {
                console.error("Failed to delete account:", error);
                alert("회원 탈퇴 중 문제가 발생했습니다.");
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
                {/* Sticky Header */}
                <Navbar title="내 정보" />

                <main className="flex-1 px-4 py-6 space-y-8 pb-32">
                    {/* User Profile Card */}
                    <section className="bg-white dark:bg-surface-dark rounded-3xl p-6 shadow-soft border border-gray-100 dark:border-gray-800">
                        <div className="flex items-center gap-4">
                            <div className="size-20 shrink-0 rounded-full bg-primary/10 flex items-center justify-center text-primary border-4 border-white dark:border-gray-800 shadow-sm overflow-hidden">
                                {!avatarError && user?.user_metadata?.avatar_url ? (
                                    <img
                                        src={user.user_metadata.avatar_url}
                                        alt=""
                                        className="w-full h-full object-cover"
                                        referrerPolicy="no-referrer"
                                        onError={() => setAvatarError(true)}
                                    />
                                ) : (
                                    <span className="material-symbols-outlined text-4xl">person</span>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h2 className="text-xl font-bold text-navy dark:text-white truncate">
                                    {profile?.full_name || user?.user_metadata?.full_name || '사용자'}
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
                            <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">자녀 관리</h3>
                            <Link href="/settings/child/new" className="text-xs font-bold text-primary flex items-center gap-1">
                                <span className="material-symbols-outlined text-[16px]">add</span>
                                추가 등록
                            </Link>
                        </div>
                        <div className="space-y-3">
                            {children.map((child) => (
                                <Link key={child.id} href={`/settings/child/${child.id}`} className="block">
                                    <div className="flex items-center gap-4 p-4 rounded-2xl bg-white dark:bg-surface-dark border border-gray-100 dark:border-gray-800 hover:shadow-md transition-all active:scale-[0.99]">
                                        <div className="size-12 rounded-xl bg-primary/5 flex items-center justify-center overflow-hidden">
                                            {child.image_url ? (
                                                <img src={child.image_url} alt={child.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="material-symbols-outlined text-primary">face</span>
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-bold text-navy dark:text-white">{child.name}</p>
                                            <p className="text-xs text-gray-500">{child.gender === 'male' ? '남아' : '여아'} · {child.birth_date}</p>
                                        </div>
                                        <span className="material-symbols-outlined text-gray-300">chevron_right</span>
                                    </div>
                                </Link>
                            ))}
                            {children.length === 0 && (
                                <div className="text-center py-8 bg-gray-50 dark:bg-gray-800/30 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
                                    <p className="text-sm text-gray-400">등록된 자녀가 없습니다.</p>
                                    <Link href="/settings/child/new" className="text-xs font-bold text-primary mt-2 inline-block">
                                        첫 아이 등록하기
                                    </Link>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* General Settings Section */}
                    <section className="space-y-4">
                        <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest px-2">앱 설정 및 정보</h3>
                        <div className="bg-white dark:bg-surface-dark rounded-3xl overflow-hidden border border-gray-100 dark:border-gray-800 shadow-soft">
                            {[
                                { icon: 'notifications', label: '알림 설정', href: '/settings/notifications' },
                                { icon: 'description', label: '서비스 이용약관', href: '/legal/terms' },
                                { icon: 'privacy_tip', label: '개인정보 처리방침', href: '/legal/privacy' },
                                { icon: 'receipt_long', label: '환불 정책', href: '/legal/refund' },
                                { icon: 'support_agent', label: '고객센터', href: '/legal/support' },
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
                            로그아웃
                        </button>
                        <button
                            onClick={handleDeleteAccount}
                            className="w-full py-4 text-xs text-gray-300 dark:text-gray-600 font-medium hover:text-red-400 transition-colors"
                        >
                            회원 탈퇴
                        </button>
                    </section>
                </main>

                <BottomNav />
            </div>
        </div>
    );
}
