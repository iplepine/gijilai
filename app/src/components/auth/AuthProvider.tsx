'use client';

import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { trackEvent } from '@/lib/analytics';
import { supabase } from '@/lib/supabase';

declare global {
    interface Window {
        AuthBridge?: {
            postMessage: (message: string) => void;
        };
        __authLoadingDone?: () => void;
        __startNativeOAuthProvider?: (provider: 'google' | 'kakao') => Promise<void>;
    }
}

interface AuthContextType {
    session: Session | null;
    user: User | null;
    loading: boolean;
    signInWithGoogle: () => Promise<void>;
    signInWithKakao: () => Promise<void>;
    signInWithEmail: (email: string, password: string) => Promise<void>;
    signUpWithEmail: (email: string, password: string) => Promise<void>;
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

    useEffect(() => {
        // 1. Initial Session Check
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);
        });

        // 2. Listen for Auth Changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);

            if (event === 'SIGNED_IN') {
                trackEvent('login_success', {
                    provider: session?.user?.app_metadata?.provider ?? 'unknown',
                });
            }

            if (event === 'SIGNED_OUT') {
                trackEvent('logout');
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);
    const [isLoadingKakao, setIsLoadingKakao] = useState(false);
    const [isLoadingEmail, setIsLoadingEmail] = useState(false);

    const signInWithOAuthProvider = useCallback(async (
        provider: 'google' | 'kakao',
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
            setProviderLoading(false);
        }
    }, []);

    const signInWithGoogle = useCallback(async () => {
        await signInWithOAuthProvider('google', setIsLoadingGoogle);
    }, [signInWithOAuthProvider]);

    const signInWithKakao = useCallback(async () => {
        await signInWithOAuthProvider('kakao', setIsLoadingKakao, {
            scopes: 'profile_nickname',
        });
    }, [signInWithOAuthProvider]);

    useEffect(() => {
        window.__authLoadingDone = () => {
            setIsLoadingGoogle(false);
            setIsLoadingKakao(false);
        };

        window.__startNativeOAuthProvider = async (provider) => {
            if (provider === 'kakao') {
                await signInWithKakao();
                return;
            }
            await signInWithGoogle();
        };

        return () => {
            window.__authLoadingDone = undefined;
            window.__startNativeOAuthProvider = undefined;
        };
    }, [signInWithGoogle, signInWithKakao]);

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
            signInWithGoogle,
            signInWithKakao,
            signInWithEmail,
            signUpWithEmail,
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
