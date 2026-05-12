'use client';

import {
    useEffect,
    useRef,
    useState,
    type MouseEvent,
    type PointerEvent,
} from 'react';
import { useLocale } from '@/i18n/LocaleProvider';
import { getNativeCapabilities } from '@/lib/nativeCapabilities';
import {
    appendTranscript,
    buildSpeechRecognitionTranscript,
    mergeSpeechRecognitionResults,
    type SpeechRecognitionEventLike,
    type SpeechRecognitionTranscriptSegment,
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

interface NativeVoiceInputBridge {
    postMessage: (message: string) => void;
}

interface NativeVoiceInputWindow extends Window {
    VoiceInputBridge?: NativeVoiceInputBridge;
}

interface NativeVoiceInputResult {
    requestId?: string;
    status?: 'ok' | 'cancelled' | 'error';
    transcript?: string;
    code?: VoiceInputErrorCode;
}

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

function getNativeVoiceInputBridge(): NativeVoiceInputBridge | null {
    if (typeof window === 'undefined') return null;
    const nativeWindow = window as NativeVoiceInputWindow;
    if (getNativeCapabilities()?.voiceInput !== true) return null;
    return nativeWindow.VoiceInputBridge ?? null;
}

function supportsNativeVoiceInput() {
    return Boolean(getNativeVoiceInputBridge());
}

function supportsVoiceInput() {
    return Boolean(getSpeechRecognition()) || supportsNativeVoiceInput();
}

function isCoarsePointer() {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(pointer: coarse)').matches;
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

function requestNativeVoiceInput(languageTag: string): Promise<NativeVoiceInputResult> {
    const bridge = getNativeVoiceInputBridge();
    if (!bridge) {
        return Promise.resolve({ status: 'error', code: 'service-not-allowed' });
    }

    const requestId = `voice-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    return new Promise((resolve) => {
        const cleanup = () => {
            window.clearTimeout(timeoutId);
            window.removeEventListener('gijilai:nativeVoiceInputResult', handleResult);
        };

        const handleResult = (event: Event) => {
            const detail = (event as CustomEvent<NativeVoiceInputResult>).detail;
            if (detail?.requestId !== requestId) return;
            cleanup();
            resolve(detail);
        };

        const timeoutId = window.setTimeout(() => {
            cleanup();
            resolve({ requestId, status: 'error', code: 'aborted' });
        }, 90000);

        window.addEventListener('gijilai:nativeVoiceInputResult', handleResult);

        try {
            bridge.postMessage(JSON.stringify({
                type: 'VOICE_INPUT_REQUEST',
                requestId,
                languageTag,
            }));
        } catch (error) {
            console.warn('Native voice input request failed:', error);
            cleanup();
            resolve({ requestId, status: 'error', code: 'unknown' });
        }
    });
}

export function VoiceInputButton({ value, onChange, maxLength, className = '' }: VoiceInputButtonProps) {
    const { locale, t } = useLocale();
    const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
    const baseValueRef = useRef(value);
    const transcriptSegmentsRef = useRef<SpeechRecognitionTranscriptSegment[]>([]);
    const isStartingRef = useRef(false);
    const lastPointerPressAtRef = useRef(0);
    const [isSupported, setIsSupported] = useState(false);
    const [isMobileInput, setIsMobileInput] = useState(false);
    const [isStarting, setIsStarting] = useState(false);
    const [isListening, setIsListening] = useState(false);

    const setStarting = (next: boolean) => {
        isStartingRef.current = next;
        setIsStarting(next);
    };

    useEffect(() => {
        const updateSupport = () => {
            setIsMobileInput(isCoarsePointer() || supportsNativeVoiceInput());
            setIsSupported(supportsVoiceInput());
        };

        const timeoutIds = [0, 250, 1000].map((delay) => window.setTimeout(updateSupport, delay));
        window.addEventListener('gijilai:nativeContextReady', updateSupport);

        return () => {
            timeoutIds.forEach((id) => window.clearTimeout(id));
            window.removeEventListener('gijilai:nativeContextReady', updateSupport);
        };
    }, []);

    useEffect(() => {
        if (!isListening) baseValueRef.current = value;
    }, [isListening, value]);

    const stopListening = () => {
        recognitionRef.current?.stop();
        recognitionRef.current = null;
        transcriptSegmentsRef.current = [];
        setIsListening(false);
    };

    const startListening = async () => {
        if (isStartingRef.current) return;

        const languageTag = locale === 'ko' ? 'ko-KR' : 'en-US';
        if (supportsNativeVoiceInput()) {
            setStarting(true);
            try {
                const result = await requestNativeVoiceInput(languageTag);
                if (result.status === 'ok') {
                    onChange(appendTranscript(value, result.transcript ?? '', maxLength));
                    return;
                }
                if (result.status !== 'cancelled') {
                    alert(getVoiceErrorMessage(t, result.code ?? 'unknown'));
                }
            } finally {
                setStarting(false);
            }
            return;
        }

        const SpeechRecognition = getSpeechRecognition();
        if (!SpeechRecognition) {
            alert(t('voice.unsupported'));
            return;
        }

        setStarting(true);
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = languageTag;
        baseValueRef.current = value;
        transcriptSegmentsRef.current = [];

        recognition.onresult = (event) => {
            transcriptSegmentsRef.current = mergeSpeechRecognitionResults(
                transcriptSegmentsRef.current,
                event,
            );
            const transcript = buildSpeechRecognitionTranscript(transcriptSegmentsRef.current);
            onChange(appendTranscript(baseValueRef.current, transcript, maxLength));
        };

        recognition.onerror = (event) => {
            const code = normalizeSpeechRecognitionError(event.error);
            console.warn('SpeechRecognition error:', event.error);
            alert(getVoiceErrorMessage(t, code));
            stopListening();
        };

        recognition.onend = () => {
            recognitionRef.current = null;
            transcriptSegmentsRef.current = [];
            setIsListening(false);
        };

        recognitionRef.current = recognition;
        try {
            recognition.start();
            setIsListening(true);
        } catch {
            recognitionRef.current = null;
            console.warn('SpeechRecognition start failed');
            alert(t('voice.errorUnknown'));
        } finally {
            setStarting(false);
        }
    };

    const handlePress = () => {
        if (isStartingRef.current) return;
        if (isListening) {
            stopListening();
            return;
        }
        void startListening();
    };

    const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.stopPropagation();
        lastPointerPressAtRef.current = Date.now();
        handlePress();
    };

    const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.stopPropagation();
        if (Date.now() - lastPointerPressAtRef.current < 1500) return;
        handlePress();
    };

    if (!isMobileInput) return null;

    return (
        <button
            type="button"
            onPointerDown={handlePointerDown}
            onClick={handleClick}
            disabled={isStarting}
            aria-label={isListening ? t('voice.stop') : t('voice.start')}
            title={isSupported ? (isListening ? t('voice.stop') : t('voice.start')) : t('voice.unsupported')}
            className={`z-10 inline-flex h-10 w-10 touch-manipulation select-none items-center justify-center rounded-full border text-[18px] transition-all active:scale-95 ${
                isListening
                    ? 'border-red-200 bg-red-50 text-red-500 shadow-lg shadow-red-100'
                    : 'border-primary/15 bg-white/95 text-primary shadow-sm hover:bg-primary/5 dark:bg-surface-dark'
            } ${isStarting ? 'cursor-wait opacity-40' : ''} ${className}`}
        >
            <span className="material-symbols-outlined text-[20px] leading-none">
                {isListening ? 'stop_circle' : 'mic'}
            </span>
            <span className="sr-only">{isListening ? t('voice.listening') : t('voice.start')}</span>
        </button>
    );
}
