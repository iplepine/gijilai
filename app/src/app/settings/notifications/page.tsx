'use client';

import { useEffect, useState } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { useLocale } from '@/i18n/LocaleProvider';

const STORAGE_KEY = 'gijilai_notification_settings';

interface NotificationSettings {
    pushEnabled: boolean;
    emailEnabled: boolean;
    marketingEnabled: boolean;
    practiceReminderEnabled: boolean;
    practiceReminderTime: string;
}

const DEFAULT_SETTINGS: NotificationSettings = {
    pushEnabled: true,
    emailEnabled: false,
    marketingEnabled: false,
    practiceReminderEnabled: true,
    practiceReminderTime: '20:00',
};

export default function NotificationsPage() {
    const { t } = useLocale();
    const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        try {
            const saved = window.localStorage.getItem(STORAGE_KEY);
            if (saved) {
                setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) });
            }
        } catch {
            setSettings(DEFAULT_SETTINGS);
        } finally {
            setLoaded(true);
        }
    }, []);

    useEffect(() => {
        if (!loaded) return;
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    }, [loaded, settings]);

    const updateSetting = <K extends keyof NotificationSettings>(key: K, value: NotificationSettings[K]) => {
        setSettings((current) => ({ ...current, [key]: value }));
    };

    return (
        <div className="bg-background-light dark:bg-background-dark min-h-screen">
            <div className="max-w-md mx-auto relative min-h-screen flex flex-col">
                <Navbar title={t('settings.notificationSettings')} />

                <main className="flex-1 px-4 py-8">
                    <div className="bg-white dark:bg-surface-dark rounded-3xl p-6 shadow-soft border border-gray-100 dark:border-gray-800 space-y-8">

                        <div className="flex items-center justify-between">
                            <div className="flex-1 pr-6 flex flex-col gap-1">
                                <h2 className="text-[15px] font-bold text-navy dark:text-white">{t('settings.pushNotifications')}</h2>
                                <p className="text-[13px] text-gray-500 break-keep">{t('settings.pushDescription')}</p>
                            </div>
                            <button
                                onClick={() => updateSetting('pushEnabled', !settings.pushEnabled)}
                                className={`w-12 h-6 rounded-full transition-colors flex items-center shrink-0 ${settings.pushEnabled ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'}`}
                            >
                                <div className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform ${settings.pushEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>

                        <hr className="border-gray-100 dark:border-gray-800" />

                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex-1 pr-6 flex flex-col gap-1">
                                    <h2 className="text-[15px] font-bold text-navy dark:text-white">{t('settings.practiceReminders')}</h2>
                                    <p className="text-[13px] text-gray-500 break-keep">{t('settings.practiceReminderDescription')}</p>
                                </div>
                                <button
                                    onClick={() => updateSetting('practiceReminderEnabled', !settings.practiceReminderEnabled)}
                                    className={`w-12 h-6 rounded-full transition-colors flex items-center shrink-0 ${settings.practiceReminderEnabled ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'}`}
                                >
                                    <div className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform ${settings.practiceReminderEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>

                            <label className="flex items-center justify-between gap-4 rounded-2xl bg-beige-main/20 dark:bg-white/5 px-4 py-3">
                                <span className="text-[13px] font-bold text-text-main dark:text-white">{t('settings.reminderTime')}</span>
                                <input
                                    type="time"
                                    value={settings.practiceReminderTime}
                                    disabled={!settings.practiceReminderEnabled}
                                    onChange={(event) => updateSetting('practiceReminderTime', event.target.value)}
                                    className="rounded-xl border border-primary/10 bg-white dark:bg-surface-dark px-3 py-2 text-[14px] font-bold text-text-main dark:text-white disabled:opacity-40"
                                />
                            </label>

                            <p className="text-[12px] text-gray-500 leading-relaxed break-keep">
                                {t('settings.practiceReminderLocalNote')}
                            </p>
                        </div>

                        <hr className="border-gray-100 dark:border-gray-800" />

                        <div className="flex items-center justify-between">
                            <div className="flex-1 pr-6 flex flex-col gap-1">
                                <h2 className="text-[15px] font-bold text-navy dark:text-white">{t('settings.emailNotifications')}</h2>
                                <p className="text-[13px] text-gray-500 break-keep">{t('settings.emailDescription')}</p>
                            </div>
                            <button
                                onClick={() => updateSetting('emailEnabled', !settings.emailEnabled)}
                                className={`w-12 h-6 rounded-full transition-colors flex items-center shrink-0 ${settings.emailEnabled ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'}`}
                            >
                                <div className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform ${settings.emailEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>

                        <hr className="border-gray-100 dark:border-gray-800" />

                        <div className="flex items-center justify-between">
                            <div className="flex-1 pr-6 flex flex-col gap-1">
                                <h2 className="text-[15px] font-bold text-navy dark:text-white">{t('settings.marketingNotifications')}</h2>
                                <p className="text-[13px] text-gray-500 break-keep">{t('settings.marketingDescription')}</p>
                            </div>
                            <button
                                onClick={() => updateSetting('marketingEnabled', !settings.marketingEnabled)}
                                className={`w-12 h-6 rounded-full transition-colors flex items-center shrink-0 ${settings.marketingEnabled ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'}`}
                            >
                                <div className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform ${settings.marketingEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>

                    </div>
                </main>
            </div>
        </div>
    );
}
