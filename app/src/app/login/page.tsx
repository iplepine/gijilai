'use client';

import Image from 'next/image';
import { useAuth } from '@/components/auth/AuthProvider';
import { trackEvent } from '@/lib/analytics';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useLocale } from '@/i18n/LocaleProvider';

function KakaoLoginSymbol() {
    return (
        <svg width="20" height="20" viewBox="0 0 256 256" aria-hidden="true" focusable="false">
            <path
                d="M128 36C70.6 36 24 72.4 24 116.8c0 28.9 19.2 54.2 48.1 68.6l-9.8 36.2c-.8 2.9 2.6 5.2 5.1 3.5l42.5-28.4c5.9.8 12 1.3 18.1 1.3 57.4 0 104-36.4 104-80.8S185.4 36 128 36z"
                fill="#000000"
            />
        </svg>
    );
}

function GoogleLoginSymbol() {
    return (
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <path d="M18.48 10.2c0-.64-.06-1.25-.16-1.84H10v3.48h4.76c-.21 1.12-.83 2.07-1.76 2.71v2.26h2.84c1.66-1.53 2.64-3.78 2.64-6.61z" fill="#4285F4" />
            <path d="M10 19c2.38 0 4.38-.79 5.84-2.14L13 14.6c-.79.53-1.8.84-3 .84-2.3 0-4.25-1.55-4.95-3.64H2.1v2.33C3.55 17.01 6.53 19 10 19z" fill="#34A853" />
            <path d="M5.05 11.8c-.18-.53-.28-1.1-.28-1.69s.1-1.16.28-1.69V6.09H2.1C1.5 7.28 1.16 8.62 1.16 10.11s.34 2.83.94 4.02l2.95-2.33z" fill="#FBBC05" />
            <path d="M10 4.77c1.29 0 2.45.44 3.36 1.31l2.52-2.52C14.37 2.15 12.37 1.29 10 1.29 6.53 1.29 3.55 3.28 2.1 6.16l2.95 2.33C5.75 6.32 7.7 4.77 10 4.77z" fill="#EA4335" />
        </svg>
    );
}

function AppleLoginSymbol() {
    return (
        <svg width="20" height="20" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            <path
                fill="currentColor"
                d="M11.182.008c-.748-.086-1.508.313-2.036.953-.495.598-.848 1.488-.736 2.362.82.064 1.62-.337 2.12-.952.49-.593.85-1.485.652-2.363ZM13.72 12.42c-.3.69-.655 1.326-1.067 1.91-.562.8-1.022 1.804-1.92 1.804-.807 0-1.016-.513-1.94-.513-.923 0-1.162.498-1.94.528-.866.033-1.526-.87-2.093-1.667-1.15-1.62-2.03-4.57-.85-6.62.585-1.02 1.63-1.665 2.766-1.682.769-.014 1.495.53 1.94.53.443 0 1.277-.654 2.152-.558.366.015 1.394.148 2.054 1.113-.053.033-1.226.717-1.214 2.141.014 1.7 1.49 2.264 1.506 2.271-.013.039-.235.8-.694 1.743Z"
            />
        </svg>
    );
}

export default function LoginPage() {
    const { t } = useLocale();
    const {
        user,
        signInWithApple,
        signInWithGoogle,
        signInWithKakao,
        signInWithEmail,
        signUpWithEmail,
        isLoadingApple,
        isLoadingGoogle,
        isLoadingKakao,
        isLoadingEmail,
    } = useAuth();
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
                            <KakaoLoginSymbol />
                        )}
                        {isLoadingKakao ? t('auth.loggingIn') : t('auth.continueWithKakao')}
                    </button>

                    <button
                        onClick={() => {
                            trackEvent('login_attempt', { provider: 'apple' });
                            signInWithApple();
                        }}
                        disabled={isLoadingApple}
                        className="w-full bg-black text-white py-4 rounded-xl font-medium flex items-center justify-center gap-2 disabled:opacity-50 transition-all active:scale-[0.98]"
                    >
                        {isLoadingApple ? (
                            <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        ) : (
                            <AppleLoginSymbol />
                        )}
                        {isLoadingApple ? t('auth.loggingIn') : t('auth.continueWithApple')}
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
                            <GoogleLoginSymbol />
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
