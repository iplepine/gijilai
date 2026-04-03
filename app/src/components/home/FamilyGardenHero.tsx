'use client';

import { Icon } from '@/components/ui/Icon';
import Link from 'next/link';
import { useLocale } from '@/i18n/LocaleProvider';

interface FamilyGardenHeroProps {
    childId?: string;
    childName: string;
    childTrait: string;
    childImage?: string | null;
    parentName: string;
    parentTrait: string;
    hasChild?: boolean;
}

export function FamilyGardenHero({
    childId,
    childName: childNameProp,
    childTrait: childTraitProp,
    childImage,
    parentName: parentNameProp,
    parentTrait: parentTraitProp,
    hasChild = false
}: Partial<FamilyGardenHeroProps>) {
    const { t } = useLocale();
    const childName = childNameProp || t('home.defaultChildName');
    const childTrait = childTraitProp || t('home.preAnalysis');
    const parentName = parentNameProp || t('home.defaultParentName');
    const parentTrait = parentTraitProp || t('home.preAnalysis');
    return (
        <section className="px-6 pt-6 pb-10 text-center">
            <p className="text-sm font-medium text-garden-green mb-2 tracking-widest uppercase">Our Family Garden</p>
            <h2 className="font-display text-2xl font-bold mb-8 text-[var(--navy)]">{t('home.familyGarden')}</h2>

            <div className="relative w-full aspect-square max-w-[320px] mx-auto bg-white/40 rounded-full border border-white/60 shadow-sm flex flex-col items-center justify-end pb-8">

                {/* Child Section */}
                <div className="absolute bottom-24 flex flex-col items-center w-full">
                    <Link
                        href={hasChild && childId ? `/settings/child/${childId}` : "/settings/child/new"}
                        className="relative group flex flex-col items-center"
                    >
                        <div className="relative">
                            {hasChild ? (
                                <>
                                    <span className="material-symbols-outlined text-[140px] text-garden-petal fill-1 leading-none drop-shadow-sm transition-transform group-hover:scale-105" style={{ fontVariationSettings: "'FILL' 1" }}>local_florist</span>
                                    <div className="absolute inset-0 flex items-center justify-center pt-2">
                                        {childImage ? (
                                            <div className="w-16 h-16 shrink-0 aspect-square rounded-full overflow-hidden border-4 border-white shadow-md bg-white">
                                                <img src={childImage} alt={childName} className="w-full h-full object-cover" />
                                            </div>
                                        ) : (
                                            <Icon name="child_care" className="text-white/40 text-5xl" />
                                        )}
                                    </div>
                                </>
                            ) : (
                                <div className="w-24 h-24 rounded-full border-2 border-dashed border-garden-accent/50 flex items-center justify-center text-garden-accent mb-2 hover:bg-white/50 transition-colors">
                                    <Icon name="add" size="lg" />
                                </div>
                            )}
                        </div>

                        <div className="mt-2 text-xs font-bold px-3 py-1 bg-white/80 rounded-full text-garden-brown shadow-sm flex items-center gap-1">
                            {hasChild ? `${childTrait} ${childName}` : t('home.registerChild')}
                        </div>
                    </Link>
                </div>

                {/* Parent Section */}
                <Link href="/settings/profile" className="w-48 h-16 bg-garden-brown/20 rounded-[50%] flex items-center justify-center border-t-2 border-garden-brown/30 active:scale-95 transition-transform">
                    <div className="text-center">
                        <p className="text-[10px] text-garden-brown/60 uppercase font-bold tracking-tighter flex items-center justify-center gap-1">
                            {parentTrait} {parentName}{t('home.parentSuffix')} <Icon name="edit" className="text-[10px]" />
                        </p>
                    </div>
                </Link>

                {/* Decorative Elements */}
                <span className="absolute top-12 left-12 material-symbols-outlined text-garden-soft-green/40 text-3xl">eco</span>
                <span className="absolute top-20 right-10 material-symbols-outlined text-yellow-600/20 text-4xl">light_mode</span>
            </div>
        </section>
    );
}
