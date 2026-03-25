export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Database {
    public: {
        Tables: {
            profiles: {
                Row: {
                    id: string
                    email: string | null
                    full_name: string | null
                    role: string
                    created_at: string
                }
                Insert: {
                    id: string
                    email?: string | null
                    full_name?: string | null
                    role?: string
                    created_at?: string
                }
                Update: {
                    id?: string
                    email?: string | null
                    full_name?: string | null
                    role?: string
                    created_at?: string
                }
            }
            children: {
                Row: {
                    id: string
                    parent_id: string
                    name: string
                    gender: 'male' | 'female'
                    birth_date: string
                    birth_time: string | null
                    image_url: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    parent_id: string
                    name: string
                    gender: 'male' | 'female'
                    birth_date: string
                    birth_time?: string | null
                    image_url?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    parent_id?: string
                    name?: string
                    gender?: 'male' | 'female'
                    birth_date?: string
                    birth_time?: string | null
                    image_url?: string | null
                    created_at?: string
                }
            }
            surveys: {
                Row: {
                    id: string
                    user_id: string
                    child_id: string | null
                    type: 'PARENT' | 'CHILD' | 'PARENTING_STYLE'
                    answers: Json
                    scores: Json
                    step: number
                    status: 'IN_PROGRESS' | 'COMPLETED'
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    child_id?: string | null
                    type: 'PARENT' | 'CHILD' | 'PARENTING_STYLE'
                    answers?: Json
                    scores?: Json
                    step?: number
                    status?: 'IN_PROGRESS' | 'COMPLETED'
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    child_id?: string | null
                    type?: 'PARENT' | 'CHILD' | 'PARENTING_STYLE'
                    answers?: Json
                    scores?: Json
                    step?: number
                    status?: 'IN_PROGRESS' | 'COMPLETED'
                    created_at?: string
                    updated_at?: string
                }
            }
            reports: {
                Row: {
                    id: string
                    survey_id: string
                    user_id: string
                    child_id: string | null
                    type: 'PARENT' | 'CHILD' | 'HARMONY'
                    content: string | null
                    analysis_json: Json | null
                    model_used: string | null
                    is_paid: boolean
                    created_at: string
                }
                Insert: {
                    id?: string
                    survey_id: string
                    user_id: string
                    child_id?: string | null
                    type: 'PARENT' | 'CHILD' | 'HARMONY'
                    content?: string | null
                    analysis_json?: Json | null
                    model_used?: string | null
                    is_paid?: boolean
                    created_at?: string
                }
                Update: {
                    id?: string
                    survey_id?: string
                    user_id?: string
                    child_id?: string | null
                    type?: 'PARENT' | 'CHILD' | 'HARMONY'
                    content?: string | null
                    analysis_json?: Json | null
                    model_used?: string | null
                    is_paid?: boolean
                    created_at?: string
                }
            }
            consultations: {
                Row: {
                    id: string
                    user_id: string
                    child_id: string | null
                    session_id: string | null
                    category: string | null
                    problem_description: string | null
                    ai_options: Json | null
                    user_response: Json | null
                    selected_reaction_id: string | null
                    ai_prescription: Json | null
                    status: 'DRAFT' | 'AWAITING_REACTION' | 'COMPLETED'
                    created_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    child_id?: string | null
                    session_id?: string | null
                    category?: string | null
                    problem_description?: string | null
                    ai_options?: Json | null
                    user_response?: Json | null
                    selected_reaction_id?: string | null
                    ai_prescription?: Json | null
                    status?: 'DRAFT' | 'AWAITING_REACTION' | 'COMPLETED'
                    created_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    child_id?: string | null
                    session_id?: string | null
                    category?: string | null
                    problem_description?: string | null
                    ai_options?: Json | null
                    user_response?: Json | null
                    selected_reaction_id?: string | null
                    ai_prescription?: Json | null
                    status?: 'DRAFT' | 'AWAITING_REACTION' | 'COMPLETED'
                    created_at?: string
                }
            }
            referrals: {
                Row: {
                    id: string
                    referrer_id: string
                    referred_id: string | null
                    code: string
                    status: 'PENDING' | 'COMPLETED'
                    created_at: string
                }
                Insert: {
                    id?: string
                    referrer_id: string
                    referred_id?: string | null
                    code: string
                    status?: 'PENDING' | 'COMPLETED'
                    created_at?: string
                }
                Update: {
                    id?: string
                    referrer_id?: string
                    referred_id?: string | null
                    code?: string
                    status?: 'PENDING' | 'COMPLETED'
                    created_at?: string
                }
            }
            coupons: {
                Row: {
                    id: string
                    user_id: string
                    referral_id: string | null
                    discount_amount: number
                    is_used: boolean
                    used_at: string | null
                    expires_at: string
                    created_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    referral_id?: string | null
                    discount_amount?: number
                    is_used?: boolean
                    used_at?: string | null
                    expires_at: string
                    created_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    referral_id?: string | null
                    discount_amount?: number
                    is_used?: boolean
                    used_at?: string | null
                    expires_at?: string
                    created_at?: string
                }
            }
            consultation_sessions: {
                Row: {
                    id: string
                    user_id: string
                    child_id: string | null
                    title: string
                    status: 'ACTIVE' | 'RESOLVED' | 'ARCHIVED'
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    child_id?: string | null
                    title: string
                    status?: 'ACTIVE' | 'RESOLVED' | 'ARCHIVED'
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    child_id?: string | null
                    title?: string
                    status?: 'ACTIVE' | 'RESOLVED' | 'ARCHIVED'
                    created_at?: string
                    updated_at?: string
                }
            }
            practice_items: {
                Row: {
                    id: string
                    session_id: string
                    consultation_id: string
                    title: string
                    description: string
                    duration: number
                    encouragement: string | null
                    status: 'ACTIVE' | 'COMPLETED' | 'DROPPED'
                    created_at: string
                }
                Insert: {
                    id?: string
                    session_id: string
                    consultation_id: string
                    title: string
                    description: string
                    duration: number
                    encouragement?: string | null
                    status?: 'ACTIVE' | 'COMPLETED' | 'DROPPED'
                    created_at?: string
                }
                Update: {
                    id?: string
                    session_id?: string
                    consultation_id?: string
                    title?: string
                    description?: string
                    duration?: number
                    encouragement?: string | null
                    status?: 'ACTIVE' | 'COMPLETED' | 'DROPPED'
                    created_at?: string
                }
            }
            practice_logs: {
                Row: {
                    id: string
                    practice_id: string
                    user_id: string
                    date: string
                    done: boolean
                    memo: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    practice_id: string
                    user_id: string
                    date: string
                    done: boolean
                    memo?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    practice_id?: string
                    user_id?: string
                    date?: string
                    done?: boolean
                    memo?: string | null
                    created_at?: string
                }
            }
            practice_reviews: {
                Row: {
                    id: string
                    practice_id: string
                    user_id: string
                    content: string
                    created_at: string
                }
                Insert: {
                    id?: string
                    practice_id: string
                    user_id: string
                    content: string
                    created_at?: string
                }
                Update: {
                    id?: string
                    practice_id?: string
                    user_id?: string
                    content?: string
                    created_at?: string
                }
            }
            observations: {
                Row: {
                    id: string
                    user_id: string
                    child_id: string | null
                    consultation_id: string | null
                    situation: string
                    my_action: string
                    child_reaction: string
                    note: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    child_id?: string | null
                    consultation_id?: string | null
                    situation: string
                    my_action: string
                    child_reaction: string
                    note?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    child_id?: string | null
                    consultation_id?: string | null
                    situation?: string
                    my_action?: string
                    child_reaction?: string
                    note?: string | null
                    created_at?: string
                }
            }
            subscriptions: {
                Row: {
                    id: string
                    user_id: string
                    plan: 'MONTHLY' | 'YEARLY'
                    status: 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'EXPIRED'
                    billing_key: string | null
                    portone_customer_id: string | null
                    currency: string
                    amount: number
                    current_period_start: string
                    current_period_end: string
                    cancelled_at: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    plan: 'MONTHLY' | 'YEARLY'
                    status?: 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'EXPIRED'
                    billing_key?: string | null
                    portone_customer_id?: string | null
                    currency?: string
                    amount: number
                    current_period_start: string
                    current_period_end: string
                    cancelled_at?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    plan?: 'MONTHLY' | 'YEARLY'
                    status?: 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'EXPIRED'
                    billing_key?: string | null
                    portone_customer_id?: string | null
                    currency?: string
                    amount?: number
                    current_period_start?: string
                    current_period_end?: string
                    cancelled_at?: string | null
                    created_at?: string
                    updated_at?: string
                }
            }
            payments: {
                Row: {
                    id: string
                    user_id: string
                    subscription_id: string | null
                    type: 'ONE_TIME' | 'SUBSCRIPTION' | 'RENEWAL'
                    portone_payment_id: string | null
                    status: 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED' | 'REFUNDED'
                    currency: string
                    amount: number
                    pg_provider: string | null
                    pay_method: string | null
                    paid_at: string | null
                    failed_reason: string | null
                    metadata: Json | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    subscription_id?: string | null
                    type: 'ONE_TIME' | 'SUBSCRIPTION' | 'RENEWAL'
                    portone_payment_id?: string | null
                    status?: 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED' | 'REFUNDED'
                    currency?: string
                    amount: number
                    pg_provider?: string | null
                    pay_method?: string | null
                    paid_at?: string | null
                    failed_reason?: string | null
                    metadata?: Json | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    subscription_id?: string | null
                    type?: 'ONE_TIME' | 'SUBSCRIPTION' | 'RENEWAL'
                    portone_payment_id?: string | null
                    status?: 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED' | 'REFUNDED'
                    currency?: string
                    amount?: number
                    pg_provider?: string | null
                    pay_method?: string | null
                    paid_at?: string | null
                    failed_reason?: string | null
                    metadata?: Json | null
                    created_at?: string
                }
            }
        }
    }
}
