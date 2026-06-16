'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { trackEvent } from '@/lib/analytics';
import type { NativeAuthProvider } from '@/lib/nativeCapabilities';
import { createPerfTracker } from '@/lib/perf';
import { supabase } from '@/lib/supabase';

declare global {
    interface Window {
        AuthBridge?: {
            postMessage: (message: string) => void;
        };
        __authLoadingDone?: () => void;
        __startNativeOAuthProvider?: (provider: NativeAuthProvider) => Promise<void>;
    }
}

type SocialOAuthProvider = NativeAuthProvider;

interface AuthContextType {
    session: Session | null;
    user: User | null;
    loading: boolean;
    signInWithApple: () => Promise<void>;
    signInWithGoogle: () => Promise<void>;
    signInWithKakao: () => Promise<void>;
    signInWithEmail: (email: string, password: string) => Promise<void>;
    signUpWithEmail: (email: string, password: string) => Promise<void>;
    isLoadingApple: boolean;
    isLoadingGoogle: boolean;
    isLoadingKakao: boolean;
    isLoadingEmail: boolean;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const isAppWebView = () => (
    typeof window !== 'undefined' &&
    window.navigator.userAgent.includes('gijilai_app')
);

const getRedirectTo = () => {
    if (isAppWebView()) return 'gijilai://auth/callback';
    return `${window.location.origin}/auth/callback`;
};

export function AuthProvider({ children }: { children: ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    // login_success를 "진짜 로그인"에서만 집계하기 위한 추적 ref.
    // onAuthStateChange의 SIGNED_IN은 새로고침·토큰갱신·기존세션 복원에서도 재발화하므로,
    // 첫 콜백(수화)은 건너뛰고 "세션 없음→있음" 전환일 때만 쏜다.
    const authHydratedRef = useRef(false);
    const prevUserIdRef = useRef<string | null>(null);

    useEffect(() => {
        const perf = createPerfTracker('AuthProvider');

        // 1. Initial Session Check
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);
            perf.mark('initial_session_loaded', {
                hasSession: !!session,
                userId: session?.user?.id ?? null,
            });
        });

        // 2. Listen for Auth Changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);
            console.log(
                `[Perf] AuthProvider auth_state_change event=${event} context=${JSON.stringify({
                    hasSession: !!session,
                    userId: session?.user?.id ?? null,
                })}`
            );

            const nextUserId = session?.user?.id ?? null;

            // 첫 콜백(INITIAL_SESSION 또는 기존 세션 복원)은 인터랙티브 로그인이 아니므로
            // 수화(hydration)로만 처리하고 집계하지 않는다 — login_success 과다발화 방지.
            if (!authHydratedRef.current) {
                authHydratedRef.current = true;
                prevUserIdRef.current = nextUserId;
                return;
            }

            const prevUserId = prevUserIdRef.current;
            prevUserIdRef.current = nextUserId;

            // 진짜 로그인 = 세션 없음 → 있음 전환. 토큰 갱신/재포커스(id→id)는 제외.
            if (event === 'SIGNED_IN' && !prevUserId && nextUserId) {
                trackEvent('login_success', {
                    provider: session?.user?.app_metadata?.provider ?? 'unknown',
                });
            } else if (event === 'SIGNED_OUT') {
                trackEvent('logout');
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const [isLoadingApple, setIsLoadingApple] = useState(false);
    const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);
    const [isLoadingKakao, setIsLoadingKakao] = useState(false);
    const [isLoadingEmail, setIsLoadingEmail] = useState(false);

    const signInWithOAuthProvider = useCallback(async (
        provider: SocialOAuthProvider,
        setProviderLoading: (loading: boolean) => void,
        options?: {
            scopes?: string;
            queryParams?: Record<string, string>;
        }
    ) => {
        setProviderLoading(true);
        try {
            const useNativeHandoff = isAppWebView();
            const { data, error } = await supabase.auth.signInWithOAuth({
                provider,
                options: {
                    redirectTo: getRedirectTo(),
                    skipBrowserRedirect: useNativeHandoff,
                    scopes: options?.scopes,
                    queryParams: options?.queryParams,
                },
            });
            if (error) throw error;

            if (useNativeHandoff) {
                if (!data.url) throw new Error('OAuth URL was not returned');
                window.AuthBridge?.postMessage(JSON.stringify({
                    type: 'OAUTH_URL',
                    provider,
                    url: data.url,
                }));
            }
        } catch (error) {
            console.error(`${provider} sign in error:`, error);
            trackEvent('login_failed', {
                provider,
                reason: 'oauth_error',
            });
            setProviderLoading(false);
        }
    }, []);

    const signInWithApple = useCallback(async () => {
        await signInWithOAuthProvider('apple', setIsLoadingApple, {
            scopes: 'name email',
        });
    }, [signInWithOAuthProvider]);

    const signInWithGoogle = useCallback(async () => {
        await signInWithOAuthProvider('google', setIsLoadingGoogle);
    }, [signInWithOAuthProvider]);

    const signInWithKakao = useCallback(async () => {
        await signInWithOAuthProvider('kakao', setIsLoadingKakao, {
            scopes: 'profile_nickname account_email',
        });
    }, [signInWithOAuthProvider]);

    useEffect(() => {
        window.__authLoadingDone = () => {
            setIsLoadingApple(false);
            setIsLoadingGoogle(false);
            setIsLoadingKakao(false);
        };

        window.__startNativeOAuthProvider = async (provider) => {
            if (provider === 'kakao') {
                await signInWithKakao();
                return;
            }
            if (provider === 'apple') {
                await signInWithApple();
                return;
            }
            await signInWithGoogle();
        };

        return () => {
            window.__authLoadingDone = undefined;
            window.__startNativeOAuthProvider = undefined;
        };
    }, [signInWithApple, signInWithGoogle, signInWithKakao]);

    const signInWithEmail = async (email: string, password: string) => {
        setIsLoadingEmail(true);
        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });
            if (error) throw error;
        } catch (error) {
            console.error('Email sign in error:', error);
            throw error;
        } finally {
            setIsLoadingEmail(false);
        }
    };

    const signUpWithEmail = async (email: string, password: string) => {
        setIsLoadingEmail(true);
        try {
            const { error } = await supabase.auth.signUp({
                email,
                password,
            });
            if (error) throw error;
        } catch (error) {
            console.error('Email sign up error:', error);
            throw error;
        } finally {
            setIsLoadingEmail(false);
        }
    };

    const signOut = async () => {
        await supabase.auth.signOut();
    };

    return (
        <AuthContext.Provider value={{
            session,
            user,
            loading,
            signInWithApple,
            signInWithGoogle,
            signInWithKakao,
            signInWithEmail,
            signUpWithEmail,
            isLoadingApple,
            isLoadingGoogle,
            isLoadingKakao,
            isLoadingEmail,
            signOut
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
