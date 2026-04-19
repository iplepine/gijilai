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
    const { user, signInWithGoogle, signInWithKakao, signInWithEmail, signUpWithEmail, isLoadingGoogle, isLoadingKakao, isLoadingEmail } = useAuth();
    const router = useRouter();

    const [showEmailLogin, setShowEmailLogin] = useState(false);
    const [emailMode, setEmailMode] = useState<'login' | 'signup'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [emailError, setEmailError] = useState('');
    const [emailMessage, setEmailMessage] = useState('');

    const getErrorMessage = (error: unknown) => {
        if (error instanceof Error) {
            const message = error.message.toLowerCase();
            if (message.includes('rate limit') || message.includes('too many')) {
                return t('auth.emailRateLimit');
            }
            if (message.includes('already registered') || message.includes('already been registered') || message.includes('user already registered')) {
                return t('auth.emailAlreadyRegistered');
            }
            return error.message;
        }
        return t('auth.loginFailed');
    };

    const handleEmailLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setEmailError('');
        setEmailMessage('');
        try {
            if (emailMode === 'signup') {
                trackEvent('signup_attempt', { provider: 'email' });
                await signUpWithEmail(email, password);
                setEmailMessage(t('auth.signupSuccess'));
                return;
            }

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
                <p className="text-gray-500 dark:text-gray-400 mb-10 whitespace-pre-line">
                    {t('auth.tagline')}
                </p>

                <div className="space-y-3">
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

                    <button
                        onClick={() => {
                            trackEvent('login_attempt', { provider: 'google' });
                            signInWithGoogle();
                        }}
                        disabled={isLoadingGoogle}
                        className="w-full bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 py-4 rounded-xl font-medium flex items-center justify-center gap-2 disabled:opacity-50 transition-all active:scale-[0.98]"
                    >
                        {isLoadingGoogle ? (
                            <div className="w-5 h-5 border-2 border-gray-200 dark:border-gray-600 border-t-gray-800 dark:border-t-gray-200 rounded-full animate-spin" />
                        ) : (
                            <Icon name="g_translate" size="sm" />
                        )}
                        {isLoadingGoogle ? t('auth.loggingIn') : t('auth.continueWithGoogle')}
                    </button>
                </div>

                <div className="mt-6 flex items-center gap-3">
                    <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                    <button
                        type="button"
                        onClick={() => setShowEmailLogin(!showEmailLogin)}
                        className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                        {t('auth.emailAuth')}
                    </button>
                    <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                </div>

                {showEmailLogin && (
                    <form onSubmit={handleEmailLogin} className="mt-4 space-y-3">
                        <div className="grid grid-cols-2 gap-2 rounded-xl bg-gray-100 dark:bg-surface-dark p-1">
                            <button
                                type="button"
                                onClick={() => {
                                    setEmailMode('login');
                                    setEmailError('');
                                    setEmailMessage('');
                                }}
                                className={`py-2 rounded-lg text-xs font-bold transition-all ${
                                    emailMode === 'login'
                                        ? 'bg-white dark:bg-gray-700 text-text-main dark:text-white shadow-sm'
                                        : 'text-gray-500'
                                }`}
                            >
                                {t('common.login')}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setEmailMode('signup');
                                    setEmailError('');
                                    setEmailMessage('');
                                }}
                                className={`py-2 rounded-lg text-xs font-bold transition-all ${
                                    emailMode === 'signup'
                                        ? 'bg-white dark:bg-gray-700 text-text-main dark:text-white shadow-sm'
                                        : 'text-gray-500'
                                }`}
                            >
                                {t('auth.signup')}
                            </button>
                        </div>
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
                        {emailMessage && (
                            <p className="text-primary text-xs leading-relaxed">{emailMessage}</p>
                        )}
                        <button
                            type="submit"
                            disabled={isLoadingEmail}
                            className="w-full bg-gray-800 dark:bg-gray-700 text-white py-3 rounded-xl font-medium text-sm disabled:opacity-50 transition-all active:scale-[0.98]"
                        >
                            {isLoadingEmail
                                ? emailMode === 'signup' ? t('auth.signingUp') : t('auth.loggingIn')
                                : emailMode === 'signup' ? t('auth.signup') : t('common.login')}
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
