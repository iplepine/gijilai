'use client';

import { Icon } from '@/components/ui/Icon';
import { ReportData } from '@/lib/db';
import Link from 'next/link';
import { useLocale } from '@/i18n/LocaleProvider';

interface GardenRecordsProps {
    reports?: ReportData[];
}

export function GardenRecords({ reports = [] }: GardenRecordsProps) {
    const { t } = useLocale();
    return (
        <section className="mb-12">
            <div className="flex items-center justify-between px-6 mb-4">
                <h3 className="font-display font-bold text-lg text-[var(--navy)]">{t('home.growthRecords')}</h3>
                <Link href="/reports" className="text-xs font-bold text-gray-400">{t('home.viewAll')}</Link>
            </div>

            <div className="flex overflow-x-auto gap-4 px-6 pb-4 hide-scrollbar">
                {reports.length > 0 ? (
                    reports.map((report) => (
                        <Link
                            key={report.id}
                            href={`/reports/${report.id}`}
                            className="flex-shrink-0 w-[260px] bg-white rounded-3xl p-5 border border-gray-100 shadow-sm active:scale-[0.98] transition-transform"
                        >
                            <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center mb-4 text-green-600">
                                <Icon name="menu_book" />
                            </div>
                            <p className="text-xs text-gray-400 mb-1">
                                {new Date(report.created_at).toLocaleDateString()}
                            </p>
                            <h4 className="font-bold text-base text-[var(--navy)] mb-3 leading-snug line-clamp-2">
                                {report.type === 'CHILD' ? t('home.temperamentReport') : t('home.parentReport')}
                            </h4>
                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-green-600 bg-green-50 w-fit px-2 py-1 rounded-md">
                                <Icon name="check_circle" size="sm" className="text-[14px]" />
                                {t('home.analysisComplete')}
                            </div>
                        </Link>
                    ))
                ) : (
                    <div className="flex-shrink-0 w-[260px] bg-white/50 rounded-3xl p-5 border border-gray-100 shadow-sm flex flex-col justify-center items-center text-center">
                        <p className="text-sm font-bold text-gray-600 mb-2">{t('home.noRecords')}</p>
                        <Link href="/survey/intro" className="text-xs text-green-600 underline decoration-1 underline-offset-2">
                            {t('home.startFirstAnalysis')}
                        </Link>
                    </div>
                )}

                {/* Visual Placeholder for Past Records */}
                <div className="flex-shrink-0 w-[260px] bg-white rounded-3xl p-5 border border-gray-100 shadow-sm opacity-60">
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mb-4 text-gray-400">
                        <Icon name="history" />
                    </div>
                    <p className="text-xs text-gray-400 mb-1">{t('home.sampleReportDate')}</p>
                    <h4 className="font-bold text-base text-gray-500 mb-3 leading-snug whitespace-pre-line">
                        {t('home.sampleReportTitle')}
                    </h4>
                    <div className="text-[11px] font-bold text-gray-400 px-2 py-1 rounded-md border border-gray-100 inline-block">
                        {t('home.pastRecord')}
                    </div>
                </div>
            </div>
        </section>
    );
}
