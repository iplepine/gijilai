'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale } from '@/i18n/LocaleProvider';

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

interface SpeechRecognitionEventLike {
    results: SpeechRecognitionResultListLike;
}

interface SpeechRecognitionResultListLike {
    length: number;
    item: (index: number) => SpeechRecognitionResultLike;
    [index: number]: SpeechRecognitionResultLike;
}

interface SpeechRecognitionResultLike {
    isFinal: boolean;
    item: (index: number) => SpeechRecognitionAlternativeLike;
    [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionAlternativeLike {
    transcript: string;
}

interface SpeechRecognitionErrorEventLike {
    error: string;
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

function appendTranscript(baseValue: string, transcript: string, maxLength?: number) {
    const cleanTranscript = transcript.replace(/\s+/g, ' ').trim();
    if (!cleanTranscript) return baseValue;

    const separator = baseValue.trim().length > 0 && !/\s$/.test(baseValue) ? ' ' : '';
    const nextValue = `${baseValue}${separator}${cleanTranscript}`;
    return typeof maxLength === 'number' ? nextValue.slice(0, maxLength) : nextValue;
}

async function requestMicrophoneAccess() {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        return true;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
        return true;
    } catch {
        return false;
    }
}

export function VoiceInputButton({ value, onChange, maxLength, className = '' }: VoiceInputButtonProps) {
    const { locale, t } = useLocale();
    const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
    const baseValueRef = useRef(value);
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
        if (!isListening) baseValueRef.current = value;
    }, [isListening, value]);

    const stopListening = () => {
        recognitionRef.current?.stop();
        recognitionRef.current = null;
        setIsListening(false);
    };

    const startListening = async () => {
        if (isStarting) return;

        const SpeechRecognition = getSpeechRecognition();
        if (!SpeechRecognition) {
            alert(t('voice.unsupported'));
            return;
        }

        setIsStarting(true);
        const hasMicrophoneAccess = await requestMicrophoneAccess();
        if (!hasMicrophoneAccess) {
            setIsStarting(false);
            alert(t('voice.error'));
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = locale === 'ko' ? 'ko-KR' : 'en-US';
        baseValueRef.current = value;

        recognition.onresult = (event) => {
            let transcript = '';
            for (let i = 0; i < event.results.length; i += 1) {
                transcript += event.results[i][0].transcript;
            }
            onChange(appendTranscript(baseValueRef.current, transcript, maxLength));
        };

        recognition.onerror = (event) => {
            if (event.error !== 'no-speech') {
                alert(t('voice.error'));
            }
            stopListening();
        };

        recognition.onend = () => {
            recognitionRef.current = null;
            setIsListening(false);
        };

        recognitionRef.current = recognition;
        try {
            recognition.start();
            setIsListening(true);
        } catch {
            recognitionRef.current = null;
            alert(t('voice.error'));
        } finally {
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
