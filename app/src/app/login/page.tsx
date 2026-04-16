'use client';

import Image from 'next/image';
import { useAuth } from '@/components/auth/AuthProvider';
import { Icon } from '@/components/ui/Icon';
import { trackEvent } from '@/lib/analytics';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useLocale } from '@/i18n/LocaleProvider';

export default function LoginPage() {
    const { t } = useLocale();
    const { user, signInWithGoogle, signInWithKakao, signInWithEmail, isLoadingGoogle, isLoadingKakao, isLoadingEmail } = useAuth();
    const router = useRouter();

    const [showEmailLogin, setShowEmailLogin] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [emailError, setEmailError] = useState('');

    const getErrorMessage = (error: unknown) => {
        if (error instanceof Error) return error.message;
        return t('auth.loginFailed');
    };

    const handleEmailLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setEmailError('');
        try {
            trackEvent('login_attempt', { provider: 'email' });
            await signInWithEmail(email, password);
        } catch (error) {
            setEmailError(getErrorMessage(error));
        }
    };

    useEffect(() => {
        if (user) {
            router.replace('/');
        }
    }, [user, router]);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-background-dark p-6">
            <div className="w-full max-w-sm text-center">
                <div className="mb-8 flex justify-center">
                    <Image src="/gijilai_icon.png" alt={t('common.appName')} width={64} height={64} className="w-16 h-16 rounded-2xl object-contain" />
                </div>

                <h1 className="text-2xl font-bold text-[var(--text-main)] dark:text-white mb-2">
                    {t('common.appName')}
                </h1>
                <p className="text-gray-500 dark:text-gray-400 mb-10">
                    {t('auth.tagline')}
                </p>

                <button
                    onClick={() => {
                        trackEvent('login_attempt', { provider: 'kakao' });
                        signInWithKakao();
                    }}
                    disabled={isLoadingKakao}
                    className="w-full bg-[#FEE500] text-[#191919] py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-[#FADA0A] transition-all active:scale-[0.98] disabled:opacity-50"
                >
                    {isLoadingKakao ? (
                        <div className="w-5 h-5 border-2 border-[#191919]/20 border-t-[#191919] rounded-full animate-spin" />
                    ) : (
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path fillRule="evenodd" clipRule="evenodd" d="M9 3C5.13401 3 2 5.313 2 8.166C2 10 3.23 11.616 5.093 12.56L4.417 14.881C4.385 14.992 4.453 15.106 4.568 15.131C4.606 15.14 4.646 15.138 4.683 15.125L7.545 13.905C8.016 14.004 8.502 14.056 9 14.056C12.866 14.056 16 11.743 16 8.89C16 6.037 12.866 3.724 9 3.724V3Z" fill="#191919" />
                        </svg>
                    )}
                    {isLoadingKakao ? t('auth.loggingIn') : t('auth.continueWithKakao')}
                </button>

                <div className="mt-4 flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => setShowEmailLogin(!showEmailLogin)}
                        className="flex-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark px-4 py-3 text-sm font-medium text-gray-600 dark:text-gray-300 transition-all active:scale-[0.98]"
                    >
                        {t('auth.emailLogin')}
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            trackEvent('login_attempt', { provider: 'google' });
                            signInWithGoogle();
                        }}
                        disabled={isLoadingGoogle}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-3 text-xs font-medium text-gray-400 transition-colors hover:text-gray-600 disabled:opacity-50 dark:hover:text-gray-300"
                    >
                        {isLoadingGoogle ? (
                            <div className="w-4 h-4 border-2 border-gray-200 dark:border-gray-600 border-t-gray-500 dark:border-t-gray-300 rounded-full animate-spin" />
                        ) : (
                            <Icon name="g_translate" size="sm" />
                        )}
                        {isLoadingGoogle ? t('auth.loggingIn') : t('auth.continueWithGoogle')}
                    </button>
                </div>

                {showEmailLogin && (
                    <form onSubmit={handleEmailLogin} className="mt-4 space-y-3">
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder={t('auth.email')}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark text-sm text-text-main dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
                            required
                        />
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder={t('auth.password')}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark text-sm text-text-main dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
                            required
                        />
                        {emailError && (
                            <p className="text-red-500 text-xs">{emailError}</p>
                        )}
                        <button
                            type="submit"
                            disabled={isLoadingEmail}
                            className="w-full bg-gray-800 dark:bg-gray-700 text-white py-3 rounded-xl font-medium text-sm disabled:opacity-50 transition-all active:scale-[0.98]"
                        >
                            {isLoadingEmail ? t('auth.loggingIn') : t('common.login')}
                        </button>
                    </form>
                )}

                <p className="mt-8 text-xs text-gray-400 dark:text-gray-500">
                    {t('auth.termsNotice')}
                </p>
            </div>
        </div>
    );
}
