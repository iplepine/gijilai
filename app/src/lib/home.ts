import type { Json, Database } from '@/types/supabase';

export type TemperamentScores = {
    NS: number;
    HA: number;
    RD: number;
    P: number;
};

export type HomeMagicWord = {
    word: string;
    date: string;
    childId?: string;
    childName?: string;
};

type ConsultationPrescription = Database['public']['Tables']['consultations']['Row']['ai_prescription'];

type JsonRecord = Record<string, Json | undefined>;

function isJsonRecord(value: Json | null | undefined): value is JsonRecord {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function isTemperamentScores(value: Json | null | undefined): value is TemperamentScores {
    if (!isJsonRecord(value)) return false;
    return ['NS', 'HA', 'RD', 'P'].every((key) => typeof value[key] === 'number');
}

export function parseTemperamentScores(value: Json | null | undefined): TemperamentScores | null {
    return isTemperamentScores(value) ? value : null;
}

export function parseAnswerMap(value: Json | null | undefined): Record<string, number> | null {
    if (!isJsonRecord(value)) return null;

    const entries = Object.entries(value).filter(([, answer]) => typeof answer === 'number');
    if (entries.length === 0) return null;

    return Object.fromEntries(entries) as Record<string, number>;
}

export function extractReportScores(value: Json | null | undefined): TemperamentScores | null {
    if (!isJsonRecord(value)) return null;
    return parseTemperamentScores(value.scores);
}

export function extractMagicWord(value: ConsultationPrescription): string | null {
    if (!isJsonRecord(value)) return null;
    return typeof value.magicWord === 'string' ? value.magicWord : null;
}
