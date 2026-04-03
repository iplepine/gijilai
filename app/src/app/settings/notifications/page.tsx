'use client';

import { useState } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { useLocale } from '@/i18n/LocaleProvider';

export default function NotificationsPage() {
    const { t } = useLocale();
    const [pushEnabled, setPushEnabled] = useState(true);
    const [emailEnabled, setEmailEnabled] = useState(false);
    const [marketingEnabled, setMarketingEnabled] = useState(false);

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
                                onClick={() => setPushEnabled(!pushEnabled)}
                                className={`w-12 h-6 rounded-full transition-colors flex items-center shrink-0 ${pushEnabled ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'}`}
                            >
                                <div className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform ${pushEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>

                        <hr className="border-gray-100 dark:border-gray-800" />

                        <div className="flex items-center justify-between">
                            <div className="flex-1 pr-6 flex flex-col gap-1">
                                <h2 className="text-[15px] font-bold text-navy dark:text-white">{t('settings.emailNotifications')}</h2>
                                <p className="text-[13px] text-gray-500 break-keep">{t('settings.emailDescription')}</p>
                            </div>
                            <button
                                onClick={() => setEmailEnabled(!emailEnabled)}
                                className={`w-12 h-6 rounded-full transition-colors flex items-center shrink-0 ${emailEnabled ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'}`}
                            >
                                <div className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform ${emailEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>

                        <hr className="border-gray-100 dark:border-gray-800" />

                        <div className="flex items-center justify-between">
                            <div className="flex-1 pr-6 flex flex-col gap-1">
                                <h2 className="text-[15px] font-bold text-navy dark:text-white">{t('settings.marketingNotifications')}</h2>
                                <p className="text-[13px] text-gray-500 break-keep">{t('settings.marketingDescription')}</p>
                            </div>
                            <button
                                onClick={() => setMarketingEnabled(!marketingEnabled)}
                                className={`w-12 h-6 rounded-full transition-colors flex items-center shrink-0 ${marketingEnabled ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'}`}
                            >
                                <div className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform ${marketingEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>

                    </div>
                </main>
            </div>
        </div>
    );
}
