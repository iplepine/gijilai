import { supabase } from '@/lib/supabase';
import { Database } from '@/types/supabase';

// Type definitions mapped from Supabase types
export type UserProfile = Database['public']['Tables']['profiles']['Row'];
export type ChildProfile = Database['public']['Tables']['children']['Row'];
export type SurveyData = Database['public']['Tables']['surveys']['Row'];
export type ReportData = Database['public']['Tables']['reports']['Row'];
export type ObservationData = Database['public']['Tables']['observations']['Row'];
export type SessionData = Database['public']['Tables']['consultation_sessions']['Row'];
export type PracticeItemData = Database['public']['Tables']['practice_items']['Row'];
export type PracticeLogData = Database['public']['Tables']['practice_logs']['Row'];
export type PracticeReviewData = Database['public']['Tables']['practice_reviews']['Row'];


export const db = {
    // --- Profile ---
    getUserProfile: async (userId: string) => {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
        if (error) throw error;
        return data as UserProfile;
    },

    updateUserProfile: async (userId: string, updates: Partial<UserProfile>) => {
        const { data, error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', userId)
            .select()
            .single();
        if (error) throw error;
        return data as UserProfile;
    },

    // --- Children ---
    getChildren: async (userId: string) => {
        const { data, error } = await supabase
            .from('children')
            .select('*')
            .eq('parent_id', userId)
            .order('birth_date', { ascending: false });
        if (error) throw error;
        return data as ChildProfile[];
    },

    createChild: async (child: Omit<ChildProfile, 'id' | 'created_at'>) => {
        const { data, error } = await supabase
            .from('children')
            .insert(child)
            .select()
            .single();
        if (error) throw error;
        return data as ChildProfile;
    },

    updateChildProfile: async (childId: string, updates: Partial<ChildProfile>) => {
        const { data, error } = await supabase
            .from('children')
            .update(updates)
            .eq('id', childId)
            .select()
            .single();
        if (error) throw error;
        return data as ChildProfile;
    },

    // --- Surveys ---
    saveSurvey: async (survey: Partial<SurveyData>) => {
        const { data, error } = await supabase
            .from('surveys')
            .upsert(survey)
            .select()
            .single();
        if (error) throw error;
        return data as SurveyData;
    },

    getSurveys: async (userId: string) => {
        const { data, error } = await supabase
            .from('surveys')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data as SurveyData[];
    },

    // --- Survey Responses Sync ---
    saveSurveyResponses: async (
        userId: string,
        type: 'CHILD' | 'PARENT' | 'PARENTING_STYLE',
        answers: Record<string, number>,
        status: 'IN_PROGRESS' | 'COMPLETED' = 'IN_PROGRESS'
    ) => {
        // 기존 레코드 찾기
        const { data: existing } = await supabase
            .from('surveys')
            .select('id')
            .eq('user_id', userId)
            .eq('type', type)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (existing) {
            const { error } = await supabase
                .from('surveys')
                .update({ answers, status, step: Object.keys(answers).length })
                .eq('id', existing.id);
            if (error) throw error;
        } else {
            const { error } = await supabase
                .from('surveys')
                .insert({ user_id: userId, type, answers, status, step: Object.keys(answers).length });
            if (error) throw error;
        }
    },

    getLatestSurveyResponses: async (userId: string) => {
        // 각 type별 최신 레코드 하나씩 가져오기
        const { data, error } = await supabase
            .from('surveys')
            .select('*')
            .eq('user_id', userId)
            .in('type', ['CHILD', 'PARENT', 'PARENTING_STYLE'])
            .order('created_at', { ascending: false });
        if (error) throw error;

        // type별 최신 1건만 추출
        const latest: Record<string, any> = {};
        for (const row of (data || [])) {
            if (!latest[row.type]) {
                latest[row.type] = row;
            }
        }
        return latest;
    },

    // --- Reports ---
    saveReport: async (report: Partial<ReportData>) => {
        const { data, error } = await supabase
            .from('reports')
            .insert(report)
            .select()
            .single();
        if (error) throw error;
        return data as ReportData;
    },

    getReports: async (userId: string) => {
        const { data, error } = await supabase
            .from('reports')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data as ReportData[];
    },

    updateReportPaymentStatus: async (reportId: string, isPaid: boolean) => {
        const { data, error } = await supabase
            .from('reports')
            .update({ is_paid: isPaid })
            .eq('id', reportId)
            .select()
            .single();
        if (error) throw error;
        return data as ReportData;
    },

    // --- Dashboard Data Aggregation ---
    getDashboardData: async (userId: string) => {
        const [profile, children, reports, surveys] = await Promise.all([
            db.getUserProfile(userId).catch(() => null),
            db.getChildren(userId).catch(() => []),
            db.getReports(userId).catch(() => []),
            db.getSurveys(userId).catch(() => []),
        ]);

        return {
            profile,
            children,
            reports,
            surveys,
            latestSurvey: surveys.find(s => s.type === 'CHILD') || null,
            parentSurvey: surveys.find(s => s.type === 'PARENT') || null
        };
    },

    // --- Storage ---
    uploadChildAvatar: async (file: File) => {
        let uploadData: File | Blob = file;

        // 브라우저 환경에서만 리사이징 수행
        if (typeof window !== 'undefined') {
            try {
                const { resizeImage } = await import('@/lib/imageUtils');
                uploadData = await resizeImage(file, 800, 800, 0.8);
            } catch (e) {
                console.warn('Failed to resize image, uploading original:', e);
            }
        }

        const fileExt = 'jpg'; // 리사이징 후 jpeg로 변환됨
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `child-avatars/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(filePath, uploadData, {
                contentType: 'image/jpeg'
            });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
        return data.publicUrl;
    },

    uploadUserAvatar: async (file: File, userId: string) => {
        let uploadData: File | Blob = file;

        if (typeof window !== 'undefined') {
            try {
                const { resizeImage } = await import('@/lib/imageUtils');
                uploadData = await resizeImage(file, 800, 800, 0.8);
            } catch (e) {
                console.warn('Failed to resize image, uploading original:', e);
            }
        }

        const fileExt = 'jpg';
        const fileName = `${userId}-${Date.now()}.${fileExt}`;
        const filePath = `user-avatars/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(filePath, uploadData, {
                contentType: 'image/jpeg',
                upsert: true
            });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
        return data.publicUrl;
    },

    // --- Referrals ---
    getReferralCode: async (userId: string): Promise<string> => {
        // Check if user already has a referral code
        const { data: existing } = await supabase
            .from('referrals')
            .select('code')
            .eq('referrer_id', userId)
            .limit(1)
            .single();

        if (existing?.code) return existing.code;

        // Generate new code: GIJILAI-<8chars>
        const code = 'GIJILAI-' + userId.substring(0, 8).toUpperCase();
        const { error } = await supabase
            .from('referrals')
            .insert({ referrer_id: userId, code });

        if (error && error.code !== '23505') throw error; // Ignore duplicate
        return code;
    },

    applyReferralCode: async (referredUserId: string, code: string) => {
        // Find referral by code
        const { data: referral, error: findError } = await supabase
            .from('referrals')
            .select('*')
            .eq('code', code)
            .eq('status', 'PENDING')
            .is('referred_id', null)
            .single();

        if (findError || !referral) return null;

        // Don't allow self-referral
        if (referral.referrer_id === referredUserId) return null;

        // Mark referral as completed
        await supabase
            .from('referrals')
            .update({ referred_id: referredUserId, status: 'COMPLETED' })
            .eq('id', referral.id);

        // Issue coupons to both users (990 won discount, expires in 30 days)
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);
        const expiresAtStr = expiresAt.toISOString();

        await supabase.from('coupons').insert([
            {
                user_id: referral.referrer_id,
                referral_id: referral.id,
                discount_amount: 990,
                expires_at: expiresAtStr,
            },
            {
                user_id: referredUserId,
                referral_id: referral.id,
                discount_amount: 990,
                expires_at: expiresAtStr,
            },
        ]);

        return referral;
    },

    getAvailableCoupons: async (userId: string) => {
        const { data, error } = await supabase
            .from('coupons')
            .select('*')
            .eq('user_id', userId)
            .eq('is_used', false)
            .gte('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    },

    useCoupon: async (couponId: string) => {
        const { data, error } = await supabase
            .from('coupons')
            .update({ is_used: true, used_at: new Date().toISOString() })
            .eq('id', couponId)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    // --- Observations ---
    createObservation: async (observation: Omit<ObservationData, 'id' | 'created_at'>) => {
        const { data, error } = await supabase
            .from('observations')
            .insert(observation)
            .select()
            .single();
        if (error) throw error;
        return data as ObservationData;
    },

    getObservations: async (userId: string, childId?: string) => {
        let query = supabase
            .from('observations')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
        if (childId) {
            query = query.eq('child_id', childId);
        }
        const { data, error } = await query;
        if (error) throw error;
        return data as ObservationData[];
    },

    deleteObservation: async (observationId: string) => {
        const { error } = await supabase
            .from('observations')
            .delete()
            .eq('id', observationId);
        if (error) throw error;
    },

    getRecentObservations: async (userId: string, limit: number = 5) => {
        const { data, error } = await supabase
            .from('observations')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit);
        if (error) throw error;
        return data as ObservationData[];
    },

    // --- Consultation Sessions ---
    createSession: async (session: { user_id: string; child_id: string | null; title: string }) => {
        const { data, error } = await supabase
            .from('consultation_sessions')
            .insert(session)
            .select()
            .single();
        if (error) throw error;
        return data as SessionData;
    },

    getSessions: async (userId: string, childId?: string, status?: string) => {
        let query = supabase
            .from('consultation_sessions')
            .select('*')
            .eq('user_id', userId)
            .order('updated_at', { ascending: false });
        if (childId) query = query.eq('child_id', childId);
        if (status) query = query.eq('status', status);
        const { data, error } = await query;
        if (error) throw error;
        return data as SessionData[];
    },

    getActiveSessionCount: async (userId: string) => {
        const { count, error } = await supabase
            .from('consultation_sessions')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('status', 'ACTIVE');
        if (error) throw error;
        return count || 0;
    },

    updateSession: async (sessionId: string, updates: Partial<SessionData>) => {
        const { data, error } = await supabase
            .from('consultation_sessions')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', sessionId)
            .select()
            .single();
        if (error) throw error;
        return data as SessionData;
    },

    getSessionWithConsultations: async (sessionId: string) => {
        const [sessionRes, consultsRes, practicesRes] = await Promise.all([
            supabase.from('consultation_sessions').select('*').eq('id', sessionId).single(),
            supabase.from('consultations').select('*').eq('session_id', sessionId).order('created_at', { ascending: true }),
            supabase.from('practice_items').select('*').eq('session_id', sessionId).order('created_at', { ascending: true }),
        ]);
        if (sessionRes.error) throw sessionRes.error;

        // 실천 로그도 가져오기
        const practiceIds = (practicesRes.data || []).map(p => p.id);
        let logs: PracticeLogData[] = [];
        let reviews: PracticeReviewData[] = [];
        if (practiceIds.length > 0) {
            const [logsRes, reviewsRes] = await Promise.all([
                supabase.from('practice_logs').select('*').in('practice_id', practiceIds).order('date', { ascending: true }),
                supabase.from('practice_reviews').select('*').in('practice_id', practiceIds),
            ]);
            logs = (logsRes.data || []) as PracticeLogData[];
            reviews = (reviewsRes.data || []) as PracticeReviewData[];
        }

        return {
            session: sessionRes.data as SessionData,
            consultations: (consultsRes.data || []),
            practices: (practicesRes.data || []) as PracticeItemData[],
            logs,
            reviews,
        };
    },

    // --- Practice Items ---
    createPracticeItem: async (item: Omit<PracticeItemData, 'id' | 'created_at' | 'status'>) => {
        const { data, error } = await supabase
            .from('practice_items')
            .insert(item)
            .select()
            .single();
        if (error) throw error;
        return data as PracticeItemData;
    },

    getActivePracticeItems: async (userId: string, childId?: string) => {
        let query = supabase
            .from('practice_items')
            .select('*, consultation_sessions!inner(id, user_id, child_id, title, status)')
            .eq('consultation_sessions.user_id', userId)
            .eq('status', 'ACTIVE');
        if (childId) query = query.eq('consultation_sessions.child_id', childId);
        const { data, error } = await query;
        if (error) throw error;
        return data as (PracticeItemData & { consultation_sessions: SessionData })[];
    },

    getActivePracticeCount: async (userId: string) => {
        const { count, error } = await supabase
            .from('practice_items')
            .select('*, consultation_sessions!inner(user_id)', { count: 'exact', head: true })
            .eq('consultation_sessions.user_id', userId)
            .eq('status', 'ACTIVE');
        if (error) throw error;
        return count || 0;
    },

    updatePracticeItem: async (itemId: string, updates: Partial<PracticeItemData>) => {
        const { data, error } = await supabase
            .from('practice_items')
            .update(updates)
            .eq('id', itemId)
            .select()
            .single();
        if (error) throw error;
        return data as PracticeItemData;
    },

    // --- Practice Logs ---
    createPracticeLog: async (log: Omit<PracticeLogData, 'id' | 'created_at'>) => {
        const { data, error } = await supabase
            .from('practice_logs')
            .upsert(log, { onConflict: 'practice_id,date' })
            .select()
            .single();
        if (error) throw error;
        return data as PracticeLogData;
    },

    getPracticeLogs: async (practiceId: string) => {
        const { data, error } = await supabase
            .from('practice_logs')
            .select('*')
            .eq('practice_id', practiceId)
            .order('date', { ascending: true });
        if (error) throw error;
        return data as PracticeLogData[];
    },

    getTodayPracticeLogs: async (userId: string) => {
        const today = new Date().toISOString().split('T')[0];
        const { data, error } = await supabase
            .from('practice_logs')
            .select('*')
            .eq('user_id', userId)
            .eq('date', today);
        if (error) throw error;
        return data as PracticeLogData[];
    },

    // --- Practice Reviews ---
    createPracticeReview: async (review: Omit<PracticeReviewData, 'id' | 'created_at'>) => {
        const { data, error } = await supabase
            .from('practice_reviews')
            .insert(review)
            .select()
            .single();
        if (error) throw error;
        return data as PracticeReviewData;
    },

    getPracticeReview: async (practiceId: string) => {
        const { data } = await supabase
            .from('practice_reviews')
            .select('*')
            .eq('practice_id', practiceId)
            .single();
        return data as PracticeReviewData | null;
    },

    resetUserData: async (userId: string) => {
        // 개발용 데이터 초기화 - profiles는 삭제하지 않음 (로그인 상태 유지)
        const results = await Promise.allSettled([
            supabase.from('children').delete().eq('parent_id', userId),
            supabase.from('surveys').delete().eq('user_id', userId),
            supabase.from('reports').delete().eq('user_id', userId),

            supabase.from('consultations').delete().eq('user_id', userId), // 테이블 없으면 무시
        ]);

        results.forEach((result) => {
            if (result.status === 'fulfilled' && result.value.error) {
                // consultations 테이블이 없는 경우 등 무시
                console.warn('Reset partial error (ignored):', result.value.error.message);
            }
        });
    }
};
