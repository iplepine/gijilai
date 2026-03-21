import { supabase } from '@/lib/supabase';
import { Database } from '@/types/supabase';

// Type definitions mapped from Supabase types
export type UserProfile = Database['public']['Tables']['profiles']['Row'];
export type ChildProfile = Database['public']['Tables']['children']['Row'];
export type SurveyData = Database['public']['Tables']['surveys']['Row'];
export type ReportData = Database['public']['Tables']['reports']['Row'];
export type ActionItem = Database['public']['Tables']['action_items']['Row'];

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

    // --- Actions ---
    getActionItems: async (userId: string) => {
        const { data, error } = await supabase
            .from('action_items')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(10);
        if (error) throw error;
        return data as ActionItem[];
    },

    toggleActionItem: async (itemId: string, isCompleted: boolean) => {
        const { data, error } = await supabase
            .from('action_items')
            .update({
                is_completed: isCompleted,
                completed_at: isCompleted ? new Date().toISOString() : null
            })
            .eq('id', itemId)
            .select()
            .single();
        if (error) throw error;
        return data as ActionItem;
    },

    // --- Dashboard Data Aggregation ---
    getDashboardData: async (userId: string) => {
        const [profile, children, reports, surveys, actionItems] = await Promise.all([
            db.getUserProfile(userId).catch(() => null),
            db.getChildren(userId).catch(() => []),
            db.getReports(userId).catch(() => []),
            db.getSurveys(userId).catch(() => []),
            db.getActionItems(userId).catch(() => [])
        ]);

        return {
            profile,
            children,
            reports,
            surveys,
            actionItems,
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

    resetUserData: async (userId: string) => {
        // 개발용 데이터 초기화 - profiles는 삭제하지 않음 (로그인 상태 유지)
        const results = await Promise.allSettled([
            supabase.from('children').delete().eq('parent_id', userId),
            supabase.from('surveys').delete().eq('user_id', userId),
            supabase.from('reports').delete().eq('user_id', userId),
            supabase.from('action_items').delete().eq('user_id', userId),
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
