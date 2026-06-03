import { supabase } from "@/lib/supabase";
import { Database } from "@/types/supabase";
import { getTrialStatus } from "@/lib/access";
import { getLocalDateString } from "@/lib/date";

// Type definitions mapped from Supabase types
export type UserProfile = Database["public"]["Tables"]["profiles"]["Row"];
export type ChildProfile = Database["public"]["Tables"]["children"]["Row"];
export type SurveyData = Database["public"]["Tables"]["surveys"]["Row"];
export type ReportData = Database["public"]["Tables"]["reports"]["Row"];
export type ObservationData =
  Database["public"]["Tables"]["observations"]["Row"];
export type SessionData =
  Database["public"]["Tables"]["consultation_sessions"]["Row"];
export type PracticeItemData =
  Database["public"]["Tables"]["practice_items"]["Row"];
export type PracticeLogData =
  Database["public"]["Tables"]["practice_logs"]["Row"];
export type PracticeReviewData =
  Database["public"]["Tables"]["practice_reviews"]["Row"];
export type SubscriptionData =
  Database["public"]["Tables"]["subscriptions"]["Row"];
export type PaymentData = Database["public"]["Tables"]["payments"]["Row"];

type PracticeLogInsert = Database["public"]["Tables"]["practice_logs"]["Insert"];

const PRACTICE_LOG_FEEDBACK_FIELDS = [
  "practice_attempt_type",
  "practice_attempt_note",
  "child_reaction_type",
  "child_reaction_note",
  "parent_impression_type",
  "ai_feedback",
  "ai_feedback_created_at",
  "ai_feedback_model",
  "ai_feedback_depth",
] as const;

function removeUndefinedFields(log: PracticeLogInsert): PracticeLogInsert {
  return Object.fromEntries(
    Object.entries(log).filter(([, value]) => value !== undefined),
  ) as PracticeLogInsert;
}

function isPracticeLogFeedbackColumnError(
  error: { code?: string; message?: string; details?: string | null; hint?: string | null },
  log: PracticeLogInsert,
) {
  const includesFeedbackField = PRACTICE_LOG_FEEDBACK_FIELDS.some((field) =>
    Object.prototype.hasOwnProperty.call(log, field),
  );
  if (!includesFeedbackField) return false;

  const errorText = [
    error.message,
    error.details,
    error.hint,
  ].filter(Boolean).join(" ");

  return (
    error.code === "PGRST204" ||
    PRACTICE_LOG_FEEDBACK_FIELDS.some((field) => errorText.includes(field))
  );
}

export const db = {
  // --- Profile ---
  getUserProfile: async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    if (error) throw error;
    return data as UserProfile;
  },

  updateUserProfile: async (
    userId: string,
    updates: Partial<UserProfile> & Record<string, unknown>,
  ) => {
    const { data, error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", userId)
      .select()
      .single();
    if (error) throw error;
    return data as UserProfile;
  },

  // --- Children ---
  // owner의 아이 + co-parent로 연결된 아이를 모두 반환한다.
  // 가시성 경계는 RLS가 처리하므로 userId 인자는 호환을 위해 받기만 한다.
  getChildren: async (userId: string) => {
    void userId;
    const { data, error } = await supabase
      .from("children")
      .select("*")
      .order("birth_date", { ascending: false });
    if (error) throw error;
    return data as ChildProfile[];
  },

  createChild: async (child: Omit<ChildProfile, "id" | "created_at">) => {
    const { data, error } = await supabase
      .from("children")
      .insert(child)
      .select()
      .single();
    if (error) throw error;
    return data as ChildProfile;
  },

  updateChildProfile: async (
    childId: string,
    updates: Partial<ChildProfile>,
  ) => {
    const { data, error } = await supabase
      .from("children")
      .update(updates)
      .eq("id", childId)
      .select()
      .single();
    if (error) throw error;
    return data as ChildProfile;
  },

  // --- Surveys ---
  saveSurvey: async (survey: Partial<SurveyData>) => {
    const { data, error } = await supabase
      .from("surveys")
      .upsert(survey)
      .select()
      .single();
    if (error) throw error;
    return data as SurveyData;
  },

  // owner의 설문 + co-parent로 연결된 아이의 CHILD 설문 + 본인 PARENT/STYLE 설문을 모두 반환.
  // 가시성 경계는 RLS가 처리 (owner는 본인 user_id 매치, co-parent는 child_id 매치).
  getSurveys: async (userId: string) => {
    void userId;
    const { data, error } = await supabase
      .from("surveys")
      .select("*")
      .order("updated_at", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data as SurveyData[];
  },

  // --- Survey Responses Sync ---
  saveSurveyResponses: async (
    userId: string,
    type: "CHILD" | "PARENT" | "PARENTING_STYLE",
    answers: Record<string, number>,
    status: "IN_PROGRESS" | "COMPLETED" = "IN_PROGRESS",
    childId?: string | null,
  ) => {
    // 기존 레코드 찾기
    let existingQuery = supabase
      .from("surveys")
      .select("id")
      .eq("user_id", userId)
      .eq("type", type);

    if (type === "CHILD" || type === "PARENTING_STYLE") {
      existingQuery = childId
        ? existingQuery.eq("child_id", childId)
        : existingQuery.is("child_id", null);
    } else {
      existingQuery = existingQuery.is("child_id", null);
    }

    const { data: existing, error: existingError } = await existingQuery
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingError) throw existingError;

    const surveyPayload = {
      answers,
      status,
      step: Object.keys(answers).length,
      child_id: type === "PARENT" ? null : childId ?? null,
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      const { error } = await supabase
        .from("surveys")
        .update(surveyPayload)
        .eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("surveys").insert({
        user_id: userId,
        type,
        ...surveyPayload,
      });
      if (error) throw error;
    }
  },

  startFreshSurveyResponses: async (
    userId: string,
    childId?: string | null,
    types: Array<"CHILD" | "PARENT" | "PARENTING_STYLE"> = ["CHILD", "PARENT", "PARENTING_STYLE"],
  ) => {
    const blankSurvey = {
      answers: {},
      scores: {},
      step: 1,
      status: "IN_PROGRESS" as const,
    };

    const rows = types.map((type) => ({
      user_id: userId,
      child_id: type === "PARENT" ? null : childId ?? null,
      type,
      ...blankSurvey,
    }));

    const { error } = await supabase.from("surveys").insert(rows);

    if (error) throw error;
  },

  getLatestSurveyResponses: async (userId: string) => {
    // 각 type별 최신 레코드 하나씩 가져오기
    const { data, error } = await supabase
      .from("surveys")
      .select("*")
      .eq("user_id", userId)
      .in("type", ["CHILD", "PARENT", "PARENTING_STYLE"])
      .order("updated_at", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw error;

    // type별 최신 1건만 추출
    const latest: Partial<Record<SurveyData["type"], SurveyData>> = {};
    const surveyRows = (data ?? []) as SurveyData[];
    for (const row of surveyRows) {
      if (!latest[row.type]) {
        latest[row.type] = row;
      }
    }
    return latest;
  },

  // --- Reports ---
  saveReport: async (report: Partial<ReportData>) => {
    const { data, error } = await supabase
      .from("reports")
      .insert(report)
      .select()
      .single();
    if (error) throw error;
    return data as ReportData;
  },

  // owner의 리포트 + co-parent로 연결된 아이의 리포트를 모두 반환한다.
  // 가시성 경계는 RLS가 처리.
  getReports: async (userId: string) => {
    void userId;
    const { data, error } = await supabase
      .from("reports")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data as ReportData[];
  },

  updateReportPaymentStatus: async (reportId: string, isPaid: boolean) => {
    const { data, error } = await supabase
      .from("reports")
      .update({ is_paid: isPaid })
      .eq("id", reportId)
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
      latestSurvey: surveys.find((s) => s.type === "CHILD") || null,
      parentSurvey: surveys.find((s) => s.type === "PARENT") || null,
    };
  },

  // --- Storage ---
  uploadChildAvatar: async (file: File, userId: string) => {
    let uploadData: File | Blob = file;

    // 브라우저 환경에서만 리사이징 수행
    if (typeof window !== "undefined") {
      try {
        const { resizeImage } = await import("@/lib/imageUtils");
        uploadData = await resizeImage(file, 800, 800, 0.8);
      } catch (e) {
        console.warn("Failed to resize image, uploading original:", e);
      }
    }

    const fileExt = "jpg"; // 리사이징 후 jpeg로 변환됨
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `${userId}/child-avatars/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, uploadData, {
        contentType: "image/jpeg",
      });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
    return data.publicUrl;
  },

  uploadUserAvatar: async (file: File, userId: string) => {
    let uploadData: File | Blob = file;

    if (typeof window !== "undefined") {
      try {
        const { resizeImage } = await import("@/lib/imageUtils");
        uploadData = await resizeImage(file, 800, 800, 0.8);
      } catch (e) {
        console.warn("Failed to resize image, uploading original:", e);
      }
    }

    const fileExt = "jpg";
    const fileName = `${userId}-${Date.now()}.${fileExt}`;
    const filePath = `${userId}/user-avatars/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, uploadData, {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
    return data.publicUrl;
  },

  // --- Referrals ---
  getReferralCode: async (userId: string): Promise<string> => {
    // Check if user already has a referral code
    const { data: existing } = await supabase
      .from("referrals")
      .select("code")
      .eq("referrer_id", userId)
      .limit(1)
      .single();

    if (existing?.code) return existing.code;

    // Generate new code: GIJILAI-<8chars>
    const code = "GIJILAI-" + userId.substring(0, 8).toUpperCase();
    const { error } = await supabase
      .from("referrals")
      .insert({ referrer_id: userId, code });

    if (error && error.code !== "23505") throw error; // Ignore duplicate
    return code;
  },

  applyReferralCode: async (referredUserId: string, code: string) => {
    // Find referral by code
    const { data: referral, error: findError } = await supabase
      .from("referrals")
      .select("*")
      .eq("code", code)
      .eq("status", "PENDING")
      .is("referred_id", null)
      .single();

    if (findError || !referral) return null;

    // Don't allow self-referral
    if (referral.referrer_id === referredUserId) return null;

    // Mark referral as completed
    await supabase
      .from("referrals")
      .update({ referred_id: referredUserId, status: "COMPLETED" })
      .eq("id", referral.id);

    // Issue coupons to both users (1980 won discount, expires in 30 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    const expiresAtStr = expiresAt.toISOString();

    await supabase.from("coupons").insert([
      {
        user_id: referral.referrer_id,
        referral_id: referral.id,
        discount_amount: 1980,
        expires_at: expiresAtStr,
      },
      {
        user_id: referredUserId,
        referral_id: referral.id,
        discount_amount: 1980,
        expires_at: expiresAtStr,
      },
    ]);

    return referral;
  },

  getAvailableCoupons: async (userId: string) => {
    const { data, error } = await supabase
      .from("coupons")
      .select("*")
      .eq("user_id", userId)
      .eq("is_used", false)
      .gte("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  },

  useCoupon: async (couponId: string) => {
    const { data, error } = await supabase
      .from("coupons")
      .update({ is_used: true, used_at: new Date().toISOString() })
      .eq("id", couponId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // --- Observations ---
  createObservation: async (
    observation: Omit<ObservationData, "id" | "created_at">,
  ) => {
    const { data, error } = await supabase
      .from("observations")
      .insert(observation)
      .select()
      .single();
    if (error) throw error;
    return data as ObservationData;
  },

  getObservations: async (userId: string, childId?: string) => {
    let query = supabase
      .from("observations")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (childId) {
      query = query.eq("child_id", childId);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data as ObservationData[];
  },

  deleteObservation: async (observationId: string) => {
    const { error } = await supabase
      .from("observations")
      .delete()
      .eq("id", observationId);
    if (error) throw error;
  },

  getRecentObservations: async (
    userId: string,
    limit: number = 5,
    childId?: string,
  ) => {
    let query = supabase
      .from("observations")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (childId) query = query.eq("child_id", childId);
    const { data, error } = await query.limit(limit);
    if (error) throw error;
    return data as ObservationData[];
  },

  // --- Consultation Sessions ---
  createSession: async (session: {
    user_id: string;
    child_id: string | null;
    title: string;
  }) => {
    const { data, error } = await supabase
      .from("consultation_sessions")
      .insert(session)
      .select()
      .single();
    if (error) throw error;
    return data as SessionData;
  },

  // owner의 세션 + co-parent로 연결된 아이의 세션을 모두 노출.
  // 가시성 경계는 RLS가 처리.
  // 기본은 CHILD 타입만 — 양육자 자기 상담(SELF_PARENT)은 별도 화면에서 다룬다.
  getSessions: async (userId: string, childId?: string, status?: string) => {
    void userId;
    let query = supabase
      .from("consultation_sessions")
      .select("*")
      .eq("type", "CHILD")
      .order("updated_at", { ascending: false });
    if (childId) query = query.eq("child_id", childId);
    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    if (error) throw error;
    return data as SessionData[];
  },

  // 활성 세션 3개 제한은 아이 상담(CHILD)에만 적용. SELF_PARENT는 제외.
  getActiveSessionCount: async (userId: string) => {
    const { count, error } = await supabase
      .from("consultation_sessions")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "ACTIVE")
      .eq("type", "CHILD");
    if (error) throw error;
    return count || 0;
  },

  updateSession: async (sessionId: string, updates: Partial<SessionData>) => {
    const { data, error } = await supabase
      .from("consultation_sessions")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", sessionId)
      .select()
      .single();
    if (error) throw error;
    return data as SessionData;
  },

  deleteSession: async (sessionId: string) => {
    const { error } = await supabase
      .from("consultation_sessions")
      .delete()
      .eq("id", sessionId);
    if (error) throw error;
  },

  deleteConsultation: async (consultationId: string) => {
    const { error } = await supabase
      .from("consultations")
      .delete()
      .eq("id", consultationId);
    if (error) throw error;
  },

  getSessionWithConsultations: async (sessionId: string) => {
    const [sessionRes, consultsRes, practicesRes] = await Promise.all([
      supabase
        .from("consultation_sessions")
        .select("*")
        .eq("id", sessionId)
        .single(),
      supabase
        .from("consultations")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true }),
      supabase
        .from("practice_items")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true }),
    ]);
    if (sessionRes.error) throw sessionRes.error;

    // 실천 로그도 가져오기
    const practiceIds = (practicesRes.data || []).map((p) => p.id);
    let logs: PracticeLogData[] = [];
    let reviews: PracticeReviewData[] = [];
    if (practiceIds.length > 0) {
      const [logsRes, reviewsRes] = await Promise.all([
        supabase
          .from("practice_logs")
          .select("*")
          .in("practice_id", practiceIds)
          .order("date", { ascending: true }),
        supabase
          .from("practice_reviews")
          .select("*")
          .in("practice_id", practiceIds),
      ]);
      logs = (logsRes.data || []) as PracticeLogData[];
      reviews = (reviewsRes.data || []) as PracticeReviewData[];
    }

    return {
      session: sessionRes.data as SessionData,
      consultations: consultsRes.data || [],
      practices: (practicesRes.data || []) as PracticeItemData[],
      logs,
      reviews,
    };
  },

  // --- Practice Items ---
  createPracticeItem: async (
    item: Omit<PracticeItemData, "id" | "created_at" | "status">,
  ) => {
    const { data, error } = await supabase
      .from("practice_items")
      .insert(item)
      .select()
      .single();
    if (error) throw error;
    return data as PracticeItemData;
  },

  // owner의 실천 + co-parent로 연결된 아이의 실천을 모두 노출.
  // 가시성 경계는 RLS가 처리.
  // 기본은 CHILD 타입만 — 양육자 자기 실천(SELF_PARENT)은 별도로 다룬다.
  getActivePracticeItems: async (userId: string, childId?: string) => {
    void userId;
    let query = supabase
      .from("practice_items")
      .select(
        "*, consultation_sessions!inner(id, user_id, child_id, title, status)",
      )
      .eq("status", "ACTIVE")
      .eq("type", "CHILD");
    if (childId) {
      query = query.eq("consultation_sessions.child_id", childId);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data as (PracticeItemData & {
      consultation_sessions: SessionData;
    })[];
  },

  // 활성 실천 5개 제한도 아이 상담(CHILD)에만 적용. SELF_PARENT는 제외.
  getActivePracticeCount: async (userId: string) => {
    const { count, error } = await supabase
      .from("practice_items")
      .select("*, consultation_sessions!inner(user_id)", {
        count: "exact",
        head: true,
      })
      .eq("consultation_sessions.user_id", userId)
      .eq("status", "ACTIVE")
      .eq("type", "CHILD");
    if (error) throw error;
    return count || 0;
  },

  updatePracticeItem: async (
    itemId: string,
    updates: Partial<PracticeItemData>,
  ) => {
    const { data, error } = await supabase
      .from("practice_items")
      .update(updates)
      .eq("id", itemId)
      .select()
      .single();
    if (error) throw error;
    return data as PracticeItemData;
  },

  // --- Self-Parent (양육자 자신을 위한 상담) ---
  // 진행 중인 자기 돌봄 실천. 아이 실천(CHILD)과 분리. 데일리 체크 없이 부드러운 단일 항목.
  getActiveSelfParentPractices: async (userId: string) => {
    const { data, error } = await supabase
      .from("practice_items")
      .select("*, consultation_sessions!inner(id, user_id, title, created_at)")
      .eq("type", "SELF_PARENT")
      .eq("status", "ACTIVE")
      .eq("consultation_sessions.user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []) as (PracticeItemData & { consultation_sessions: SessionData })[];
  },

  // 지난 self-parent 상담 기록 (acknowledgment/magicWord 등 ai_prescription 포함)
  getSelfParentConsultations: async (userId: string, limit = 30) => {
    const { data, error } = await supabase
      .from("consultations")
      .select("*")
      .eq("user_id", userId)
      .eq("type", "SELF_PARENT")
      .eq("status", "COMPLETED")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data || []) as Database["public"]["Tables"]["consultations"]["Row"][];
  },

  // --- Practice Logs ---
  createPracticeLog: async (log: PracticeLogInsert) => {
    const cleanedLog = removeUndefinedFields(log);
    const { data, error } = await supabase
      .from("practice_logs")
      .upsert(cleanedLog, { onConflict: "practice_id,date" })
      .select()
      .single();
    if (error) {
      if (!isPracticeLogFeedbackColumnError(error, cleanedLog)) {
        throw error;
      }

      console.warn(
        "Practice log feedback columns are unavailable; retrying basic practice log save.",
        error,
      );

      const basicLog = removeUndefinedFields({
        practice_id: log.practice_id,
        user_id: log.user_id,
        date: log.date,
        done: log.done,
        memo: log.memo ?? null,
      });
      const { data: retryData, error: retryError } = await supabase
        .from("practice_logs")
        .upsert(basicLog, { onConflict: "practice_id,date" })
        .select()
        .single();
      if (retryError) throw retryError;
      return retryData as PracticeLogData;
    }
    return data as PracticeLogData;
  },

  getPracticeLogs: async (practiceId: string) => {
    const { data, error } = await supabase
      .from("practice_logs")
      .select("*")
      .eq("practice_id", practiceId)
      .order("date", { ascending: true });
    if (error) throw error;
    return data as PracticeLogData[];
  },

  getTodayPracticeLogs: async (userId: string) => {
    const today = getLocalDateString();
    const { data, error } = await supabase
      .from("practice_logs")
      .select("*")
      .eq("user_id", userId)
      .eq("date", today);
    if (error) throw error;
    return data as PracticeLogData[];
  },

  // --- Practice Reviews ---
  createPracticeReview: async (
    review: Omit<PracticeReviewData, "id" | "created_at">,
  ) => {
    const { data, error } = await supabase
      .from("practice_reviews")
      .insert(review)
      .select()
      .single();
    if (error) throw error;
    return data as PracticeReviewData;
  },

  getPracticeReview: async (practiceId: string) => {
    const { data } = await supabase
      .from("practice_reviews")
      .select("*")
      .eq("practice_id", practiceId)
      .single();
    return data as PracticeReviewData | null;
  },

  // --- Subscriptions ---
  getActiveSubscription: async (userId: string) => {
    const { data } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .in("status", ["ACTIVE", "PAST_DUE"])
      .gte("current_period_end", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data as SubscriptionData | null;
  },

  getSubscriptionHistory: async (userId: string) => {
    const { data, error } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data as SubscriptionData[];
  },

  // --- Payments ---
  getPaymentHistory: async (userId: string, limit: number = 20) => {
    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data as PaymentData[];
  },

  getMonthlyConsultCount: async (userId: string) => {
    const now = new Date();
    const startOfMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      1,
    ).toISOString();
    const { count, error } = await supabase
      .from("consultations")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "COMPLETED")
      .gte("created_at", startOfMonth);
    if (error) throw error;
    return count || 0;
  },

  /**
   * 7일 리버스 트라이얼 상태 확인
   * 가입일로부터 7일 이내면 트라이얼 활성, 이후는 만료
   */
  getTrialStatus,

  getTotalConsultCount: async (userId: string) => {
    const { count, error } = await supabase
      .from("consultation_sessions")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);
    if (error) throw error;
    return count || 0;
  },

  resetUserData: async (userId: string) => {
    // 회원 탈퇴 시 모든 사용자 데이터 삭제
    // consultation_sessions 삭제 시 CASCADE로 practice_items, practice_logs, practice_reviews 자동 삭제
    // 순서 중요: FK 의존성 있는 테이블 먼저 삭제
    const deletions = [
      {
        name: "observations",
        query: supabase.from("observations").delete().eq("user_id", userId),
      },
      {
        name: "consultations",
        query: supabase.from("consultations").delete().eq("user_id", userId),
      },
      {
        name: "consultation_sessions",
        query: supabase
          .from("consultation_sessions")
          .delete()
          .eq("user_id", userId),
      },
      {
        name: "reports",
        query: supabase.from("reports").delete().eq("user_id", userId),
      },
      {
        name: "surveys",
        query: supabase.from("surveys").delete().eq("user_id", userId),
      },
      {
        name: "children",
        query: supabase.from("children").delete().eq("parent_id", userId),
      },
    ];

    const errors: string[] = [];
    for (const { name, query } of deletions) {
      const { error } = await query;
      if (error) {
        console.error(`Failed to delete ${name}:`, error.message);
        errors.push(name);
      }
    }

    if (errors.length > 0) {
      throw new Error(`데이터 삭제 실패: ${errors.join(", ")}`);
    }
  },
};
