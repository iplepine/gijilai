'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { trackEvent } from '@/lib/analytics';
import { supabase } from '@/lib/supabase';

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

    const signInWithGoogle = async () => {
        setIsLoadingGoogle(true);
        try {
            await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}/auth/callback`,
                },
            });
        } catch (error) {
            console.error('Logout error:', error);
            setIsLoadingGoogle(false);
        }
    };

    const signInWithKakao = async () => {
        setIsLoadingKakao(true);
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'kakao',
                options: {
                    redirectTo: `${window.location.origin}/auth/callback`,
                    queryParams: {
                        scope: 'profile_nickname,profile_image'
                    }
                },
            });
            if (error) throw error;
        } catch (error) {
            console.error('Kakao sign in error:', error);
            setIsLoadingKakao(false);
        }
    };

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
