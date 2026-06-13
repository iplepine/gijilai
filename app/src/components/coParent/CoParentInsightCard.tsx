'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { Icon } from '@/components/ui/Icon';
import {
  CAREGIVER_LABELS,
  formatCaregiverLabel,
  isCaregiverLabel,
  isCoParentInvitesEnabled,
  type CaregiverLabel,
} from '@/lib/coParent';
import { iGa } from '@/lib/koreanUtils';
import type { TemperamentScoreSet } from '@/lib/parentParentHarmony';

void CAREGIVER_LABELS;
void isCaregiverLabel;

type ParentProfile = {
  label: string;
  emoji?: string;
  keywords: string[];
  description: string;
  image?: string;
  scores: TemperamentScoreSet;
};

type Caregiver = {
  userId: string;
  role: 'OWNER' | 'CO_PARENT';
  label: CaregiverLabel | null;
  displayName: string | null;
  isCurrentUser: boolean;
  parentProfile: ParentProfile | null;
};

type DimensionDelta = {
  key: keyof TemperamentScoreSet;
  label: string;
  diff: number;
  desc: string;
  intensity: 'LOW' | 'MEDIUM' | 'HIGH';
};

type Harmony = {
  averageDiff: number;
  topDifference: DimensionDelta;
  deltas: DimensionDelta[];
  summary: string;
};

type CaregiversResponse = {
  child?: { id: string; name: string };
  caregivers?: Caregiver[];
  harmony?: Harmony | null;
  error?: string;
};

type Props = {
  childId: string;
};

const DIM_COLORS: Record<keyof TemperamentScoreSet, string> = {
  NS: '#E5A150',
  HA: '#6B9E8A',
  RD: '#7B8EC4',
  P: '#D4805E',
};

const DIM_NAMES: Record<keyof TemperamentScoreSet, string> = {
  NS: '자극추구',
  HA: '위험회피',
  RD: '사회적민감성',
  P: '인내력',
};

function intensityChipColor(intensity: DimensionDelta['intensity']) {
  if (intensity === 'HIGH') return 'bg-[#D4805E]/15 text-[#D4805E]';
  if (intensity === 'MEDIUM') return 'bg-[#E5A150]/15 text-[#A05E1E]';
  return 'bg-[#6B9E8A]/15 text-[#3E6B5A]';
}

function intensityLabel(intensity: DimensionDelta['intensity']) {
  if (intensity === 'HIGH') return '큰 차이';
  if (intensity === 'MEDIUM') return '중간 차이';
  return '비슷함';
}

export function CoParentInsightCard({ childId }: Props) {
  const featureOn = useMemo(() => isCoParentInvitesEnabled(), []);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CaregiversResponse | null>(null);

  useEffect(() => {
    if (!featureOn || !childId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/children/${encodeURIComponent(childId)}/caregivers`);
        const payload = (await res.json().catch(() => null)) as CaregiversResponse | null;
        if (cancelled) return;
        if (res.ok && payload) setData(payload);
      } catch (err) {
        console.warn('[CoParentInsightCard] load failed:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [childId, featureOn]);

  if (!featureOn) return null;
  if (loading) return null; // 로딩 중에는 빈 자리 차지하지 않음
  if (!data?.caregivers || data.caregivers.length < 2) return null; // 솔로 사용자는 카드 자체 표시 X

  const caregivers = data.caregivers;
  const harmony = data.harmony ?? null;
  const everyoneHasProfile = caregivers.every((c) => c.parentProfile != null);

  return (
    <section className="bg-white dark:bg-surface-dark rounded-2xl px-6 py-6 shadow-card border border-beige-main/10 space-y-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12px] font-black text-text-main dark:text-white flex items-center gap-1.5">
          <Icon name="diversity_3" size="sm" /> 함께 보는 분과의 양육자 케미
        </p>
        {harmony && (
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${intensityChipColor(harmony.topDifference.intensity)}`}>
            {intensityLabel(harmony.topDifference.intensity)}
          </span>
        )}
      </div>

      {/* 두 양육자 카드 */}
      <div className="grid grid-cols-2 gap-3">
        {caregivers.map((c) => (
          <CaregiverMiniCard key={c.userId} caregiver={c} />
        ))}
      </div>

      {!everyoneHasProfile && (
        <div className="rounded-xl bg-background-light dark:bg-background-dark p-4 text-[12px] text-text-sub leading-relaxed">
          {caregivers
            .filter((c) => !c.parentProfile)
            .map((c) => `${c.isCurrentUser ? '내가' : iGa(formatCaregiverLabel(c.label))} 아직 양육자 기질 검사를 마치지 않았어요.`)
            .join(' ')}
          {' '}양쪽이 모두 검사를 마쳐야 두 분의 케미를 분석할 수 있어요.
        </div>
      )}

      {/* 차원별 비교 + 궁합 한 줄 */}
      {harmony && everyoneHasProfile && (
        <>
          <div className="rounded-xl bg-background-light dark:bg-background-dark p-4">
            <p className="text-[13px] text-text-main dark:text-white leading-relaxed">
              {harmony.summary}
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-[11px] font-bold text-text-sub uppercase tracking-wide">차원별 차이</p>
            {harmony.deltas
              .slice()
              .sort((a, b) => b.diff - a.diff)
              .map((d) => (
                <DimensionRow key={d.key} delta={d} caregivers={caregivers} />
              ))}
          </div>

          <div className="rounded-xl border border-primary/15 bg-primary/5 px-4 py-3.5 space-y-1.5">
            <p className="text-[11px] font-bold text-primary flex items-center gap-1">
              <Icon name="lightbulb" size="sm" /> 가장 큰 차이 — {harmony.topDifference.label}
            </p>
            <p className="text-[12.5px] text-text-main dark:text-slate-200 leading-relaxed">
              {harmony.topDifference.desc}
            </p>
          </div>
        </>
      )}
    </section>
  );
}

function CaregiverMiniCard({ caregiver }: { caregiver: Caregiver }) {
  const labelText = formatCaregiverLabel(caregiver.label);
  const displayName = caregiver.displayName?.trim() || null;
  const profile = caregiver.parentProfile;

  return (
    <div className="rounded-xl bg-background-light dark:bg-background-dark p-3 flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary">
          {labelText}
        </span>
        {caregiver.isCurrentUser && (
          <span className="text-[9px] text-text-sub/70">나</span>
        )}
      </div>
      {displayName && (
        <p className="text-[11px] font-medium text-text-sub truncate">{displayName}</p>
      )}
      {profile ? (
        <>
          {profile.image && (
            <div className="w-full aspect-square rounded-lg overflow-hidden bg-beige-light/40">
              <Image
                src={profile.image}
                alt={profile.label}
                width={300}
                height={300}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <p className="text-[13px] font-bold text-text-main dark:text-white leading-tight">
            {profile.emoji ? `${profile.emoji} ` : ''}{profile.label}
          </p>
          <p className="text-[10px] text-text-sub leading-snug line-clamp-2">
            {profile.description}
          </p>
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-1.5 py-4 text-center min-h-[112px]">
          <Icon name="hourglass_empty" size="md" className="text-text-sub/40" />
          <p className="text-[11px] text-text-sub/80 leading-snug">양육자 기질 검사 미완료</p>
        </div>
      )}
    </div>
  );
}

function DimensionRow({
  delta,
  caregivers,
}: {
  delta: DimensionDelta;
  caregivers: Caregiver[];
}) {
  const [a, b] = caregivers;
  const aScore = a.parentProfile?.scores[delta.key] ?? null;
  const bScore = b.parentProfile?.scores[delta.key] ?? null;
  const color = DIM_COLORS[delta.key];
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-bold text-text-main dark:text-white">{DIM_NAMES[delta.key]}</span>
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${intensityChipColor(delta.intensity)}`}>
          {intensityLabel(delta.intensity)} · {Math.round(delta.diff)}점
        </span>
      </div>
      <div className="flex items-center gap-3 text-[10px]">
        <span className="text-text-sub w-10 truncate">
          {formatCaregiverLabel(a.label)}
        </span>
        <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${aScore ?? 0}%`, backgroundColor: color }} />
        </div>
        <span className="text-text-sub w-6 text-right tabular-nums">{aScore ?? '-'}</span>
      </div>
      <div className="flex items-center gap-3 text-[10px]">
        <span className="text-text-sub w-10 truncate">
          {formatCaregiverLabel(b.label)}
        </span>
        <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div className="h-full rounded-full opacity-70" style={{ width: `${bScore ?? 0}%`, backgroundColor: color }} />
        </div>
        <span className="text-text-sub w-6 text-right tabular-nums">{bScore ?? '-'}</span>
      </div>
    </div>
  );
}
