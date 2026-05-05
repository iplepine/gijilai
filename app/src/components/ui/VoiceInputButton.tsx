'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale } from '@/i18n/LocaleProvider';
import {
    appendTranscript,
    SpeechRecognitionEventLike,
    transcriptFromSegments,
    updateSpeechTranscriptSegments,
} from '@/lib/voiceInput';

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

interface SpeechRecognitionLike {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onresult: ((event: SpeechRecognitionEventLike) => void) | null;
    onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
    onend: (() => void) | null;
    start: () => void;
    stop: () => void;
}

interface SpeechRecognitionErrorEventLike {
    error: string;
}

type VoiceInputErrorCode =
    | 'not-allowed'
    | 'audio-capture'
    | 'network'
    | 'service-not-allowed'
    | 'language-not-supported'
    | 'no-speech'
    | 'aborted'
    | 'unknown';

interface VoiceInputButtonProps {
    value: string;
    onChange: (value: string) => void;
    maxLength?: number;
    className?: string;
}

function getSpeechRecognition(): SpeechRecognitionConstructor | null {
    if (typeof window === 'undefined') return null;
    const speechWindow = window as Window & {
        SpeechRecognition?: SpeechRecognitionConstructor;
        webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

function normalizeMediaError(error: unknown): VoiceInputErrorCode {
    if (error instanceof DOMException) {
        if (error.name === 'NotAllowedError' || error.name === 'SecurityError') return 'not-allowed';
        if (
            error.name === 'NotFoundError'
            || error.name === 'DevicesNotFoundError'
            || error.name === 'NotReadableError'
            || error.name === 'TrackStartError'
            || error.name === 'OverconstrainedError'
        ) return 'audio-capture';
        if (error.name === 'AbortError') return 'aborted';
    }

    return 'unknown';
}

function normalizeSpeechRecognitionError(error: string): VoiceInputErrorCode {
    if (
        error === 'not-allowed'
        || error === 'audio-capture'
        || error === 'network'
        || error === 'service-not-allowed'
        || error === 'language-not-supported'
        || error === 'no-speech'
        || error === 'aborted'
    ) {
        return error;
    }

    return 'unknown';
}

function getVoiceErrorMessage(t: (key: string) => string, code: VoiceInputErrorCode) {
    if (code === 'not-allowed') return t('voice.errorPermissionDenied');
    if (code === 'audio-capture') return t('voice.errorAudioCapture');
    if (code === 'network') return t('voice.errorNetwork');
    if (code === 'service-not-allowed') return t('voice.errorServiceNotAllowed');
    if (code === 'language-not-supported') return t('voice.errorLanguageNotSupported');
    if (code === 'no-speech') return t('voice.errorNoSpeech');
    if (code === 'aborted') return t('voice.errorAborted');
    return t('voice.errorUnknown');
}

async function requestMicrophoneAccess(): Promise<{ ok: true } | { ok: false; code: VoiceInputErrorCode }> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        return { ok: true };
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
        return { ok: true };
    } catch (error) {
        const code = normalizeMediaError(error);
        console.warn('Voice input getUserMedia failed:', code, error);
        return { ok: false, code };
    }
}

export function VoiceInputButton({ value, onChange, maxLength, className = '' }: VoiceInputButtonProps) {
    const { locale, t } = useLocale();
    const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
    const baseValueRef = useRef(value);
    const transcriptSegmentsRef = useRef<string[]>([]);
    const isListeningRef = useRef(false);
    const isStartingRef = useRef(false);
    const isMountedRef = useRef(true);
    const [isSupported, setIsSupported] = useState(false);
    const [isMobileInput, setIsMobileInput] = useState(false);
    const [isStarting, setIsStarting] = useState(false);
    const [isListening, setIsListening] = useState(false);

    useEffect(() => {
        const id = window.setTimeout(() => {
            setIsMobileInput(window.matchMedia('(pointer: coarse)').matches);
            setIsSupported(Boolean(getSpeechRecognition()));
        }, 0);
        return () => window.clearTimeout(id);
    }, []);

    useEffect(() => {
        if (!isListeningRef.current) baseValueRef.current = value;
    }, [value]);

    useEffect(() => {
        isMountedRef.current = true;

        return () => {
            isMountedRef.current = false;
            const recognition = recognitionRef.current;
            recognitionRef.current = null;
            isListeningRef.current = false;
            isStartingRef.current = false;
            transcriptSegmentsRef.current = [];

            if (recognition) {
                recognition.onresult = null;
                recognition.onerror = null;
                recognition.onend = null;
                recognition.stop();
            }
        };
    }, []);

    const setListening = (listening: boolean) => {
        isListeningRef.current = listening;
        setIsListening(listening);
    };

    const stopListening = () => {
        const recognition = recognitionRef.current;
        recognitionRef.current = null;
        setListening(false);
        recognition?.stop();
    };

    const startListening = async () => {
        if (isStartingRef.current || isListeningRef.current) return;

        const SpeechRecognition = getSpeechRecognition();
        if (!SpeechRecognition) {
            alert(t('voice.unsupported'));
            return;
        }

        isStartingRef.current = true;
        setIsStarting(true);
        const microphoneAccess = await requestMicrophoneAccess();
        if (!isMountedRef.current) {
            isStartingRef.current = false;
            return;
        }

        if (!microphoneAccess.ok) {
            isStartingRef.current = false;
            setIsStarting(false);
            alert(getVoiceErrorMessage(t, microphoneAccess.code));
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = locale === 'ko' ? 'ko-KR' : 'en-US';
        baseValueRef.current = value;
        transcriptSegmentsRef.current = [];

        recognition.onresult = (event) => {
            const segments = updateSpeechTranscriptSegments(transcriptSegmentsRef.current, event);
            transcriptSegmentsRef.current = segments;
            const transcript = transcriptFromSegments(segments);
            onChange(appendTranscript(baseValueRef.current, transcript, maxLength));
        };

        recognition.onerror = (event) => {
            const code = normalizeSpeechRecognitionError(event.error);
            console.warn('SpeechRecognition error:', event.error);
            alert(getVoiceErrorMessage(t, code));
            stopListening();
        };

        recognition.onend = () => {
            if (recognitionRef.current === recognition) {
                recognitionRef.current = null;
            }
            transcriptSegmentsRef.current = [];
            setListening(false);
        };

        recognitionRef.current = recognition;
        isListeningRef.current = true;
        try {
            recognition.start();
            setIsListening(true);
        } catch {
            isListeningRef.current = false;
            recognitionRef.current = null;
            console.warn('SpeechRecognition start failed');
            alert(t('voice.errorUnknown'));
        } finally {
            isStartingRef.current = false;
            setIsStarting(false);
        }
    };

    if (!isMobileInput) return null;

    return (
        <button
            type="button"
            onClick={isListening ? stopListening : () => void startListening()}
            disabled={!isSupported || isStarting}
            aria-label={isListening ? t('voice.stop') : t('voice.start')}
            title={isSupported ? (isListening ? t('voice.stop') : t('voice.start')) : t('voice.unsupported')}
            className={`inline-flex h-10 w-10 items-center justify-center rounded-full border text-[18px] transition-all active:scale-95 ${
                isListening
                    ? 'border-red-200 bg-red-50 text-red-500 shadow-lg shadow-red-100'
                    : 'border-primary/15 bg-white/95 text-primary shadow-sm hover:bg-primary/5 dark:bg-surface-dark'
            } ${!isSupported || isStarting ? 'cursor-not-allowed opacity-40' : ''} ${className}`}
        >
            <span className="material-symbols-outlined text-[20px] leading-none">
                {isListening ? 'stop_circle' : 'mic'}
            </span>
            <span className="sr-only">{isListening ? t('voice.listening') : t('voice.start')}</span>
        </button>
    );
}
