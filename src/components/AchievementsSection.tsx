import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Clock,
  Flame,
  Headphones,
  Layers,
  Sparkles,
  Trophy,
  Zap,
} from 'lucide-react';
import type { AchievementItem, AchievementRarity, ImmersionLog } from '../types';
import { computeAchievements } from '../utils/stats';

interface AchievementsSectionProps {
  logs: ImmersionLog[];
}

const RARITY_STYLES: Record<
  AchievementRarity,
  { label: string; badge: string; iconBg: string }
> = {
  common: {
    label: 'Dasar',
    badge: 'bg-slate-100 text-slate-700 border-slate-200',
    iconBg: 'bg-slate-100 text-slate-600',
  },
  uncommon: {
    label: 'Rutin',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    iconBg: 'bg-emerald-50 text-emerald-600',
  },
  rare: {
    label: 'Lanjutan',
    badge: 'bg-sky-50 text-sky-700 border-sky-200',
    iconBg: 'bg-sky-50 text-sky-600',
  },
  epic: {
    label: 'Mahir',
    badge: 'bg-rose-50 text-rose-700 border-rose-200',
    iconBg: 'bg-rose-50 text-rose-600',
  },
  legendary: {
    label: 'Master',
    badge: 'bg-amber-50 text-amber-800 border-amber-200',
    iconBg: 'bg-amber-50 text-amber-600',
  },
};

function AchievementIcon({
  icon,
  className,
}: {
  icon: AchievementItem['icon'];
  className?: string;
}) {
  switch (icon) {
    case 'flame':
      return <Flame className={className} />;
    case 'book':
      return <BookOpen className={className} />;
    case 'headphones':
      return <Headphones className={className} />;
    case 'sparkles':
      return <Sparkles className={className} />;
    case 'trophy':
      return <Trophy className={className} />;
    case 'zap':
      return <Zap className={className} />;
    case 'layers':
      return <Layers className={className} />;
    default:
      return <Clock className={className} />;
  }
}

export const AchievementsSection: React.FC<AchievementsSectionProps> = ({
  logs,
}) => {
  const [rarityFilter, setRarityFilter] = useState<'all' | AchievementRarity>(
    'all'
  );

  const achievements = useMemo(() => computeAchievements(logs), [logs]);

  const earnedCount = achievements.filter((a) => a.unlocked).length;
  const remainingCount = achievements.length - earnedCount;
  const completionPct = Math.round(
    (earnedCount / Math.max(1, achievements.length)) * 100
  );

  const visible =
    rarityFilter === 'all'
      ? achievements
      : achievements.filter((a) => a.rarity === rarityFilter);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="card-pro p-4">
          <div className="text-xs text-slate-500">Tercapai</div>
          <div className="text-2xl font-bold font-mono text-slate-900 mt-1 tabular-nums">
            {earnedCount}{' '}
            <span className="text-sm font-normal text-slate-400">
              / {achievements.length}
            </span>
          </div>
        </div>
        <div className="card-pro p-4">
          <div className="text-xs text-slate-500">Sisa Pencapaian</div>
          <div className="text-2xl font-bold font-mono text-rose-600 mt-1 tabular-nums">
            {remainingCount}
          </div>
        </div>
        <div className="card-pro p-4">
          <div className="text-xs text-slate-500">Penyelesaian</div>
          <div className="text-2xl font-bold font-mono text-emerald-600 mt-1 tabular-nums">
            {completionPct}%
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        {(
          [
            { id: 'all', label: 'Semua' },
            { id: 'common', label: 'Dasar' },
            { id: 'uncommon', label: 'Rutin' },
            { id: 'rare', label: 'Lanjutan' },
            { id: 'epic', label: 'Mahir' },
            { id: 'legendary', label: 'Master' },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setRarityFilter(item.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              rarityFilter === item.id
                ? 'bg-rose-600 text-white'
                : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {visible.map((ach) => {
          const style = RARITY_STYLES[ach.rarity];
          return (
            <div
              key={ach.id}
              className={`card-pro p-4 flex flex-col justify-between gap-4 transition ${
                ach.unlocked ? '' : 'opacity-65 hover:opacity-100'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className={`p-2.5 rounded-xl ${style.iconBg}`}>
                    <AchievementIcon icon={ach.icon} className="w-5 h-5" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${style.badge}`}
                    >
                      {style.label}
                    </span>
                    {ach.unlocked && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-sm text-slate-900">
                    {ach.title}
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    {ach.description}
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-500">
                  <span>
                    {ach.currentLabel} / {ach.targetLabel}
                  </span>
                  <span className="text-rose-600 font-bold">
                    {ach.progressPct}%
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full animate-bar ${
                      ach.unlocked ? 'bg-emerald-600' : 'bg-rose-500'
                    }`}
                    style={{ width: `${ach.progressPct}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
