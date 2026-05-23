'use client';

import { TabLoadingScreen } from '@/components/ui/TabLoadingScreen';
import { useLocale } from '@/i18n/LocaleProvider';

export function HomeLoadingScreen() {
    const { t } = useLocale();
    // 5개 메인 탭 공통 로딩 쉘. 라벨은 홈 맥락에 맞게.
    return <TabLoadingScreen label={t('home.loadingLabel')} />;
}
