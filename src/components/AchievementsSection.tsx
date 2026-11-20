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
  { label: string; badge: string; ring: string; iconBg: string }
> = {
  common: {
    label: 'Common',
    badge: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
    ring: 'border-white/[0.08]',
    iconBg: 'bg-slate-500/15 text-slate-300',
  },
  uncommon: {
    label: 'Uncommon',
    badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    ring: 'border-emerald-500/25',
    iconBg: 'bg-emerald-500/15 text-emerald-300',
  },
  rare: {
    label: 'Rare',
    badge: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    ring: 'border-cyan-500/25',
    iconBg: 'bg-cyan-500/15 text-cyan-300',
  },
  epic: {
    label: 'Epic',
    badge: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
    ring: 'border-violet-500/30',
    iconBg: 'bg-violet-500/15 text-violet-300',
  },
  legendary: {
    label: 'Legendary',
    badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    ring: 'border-amber-500/35',
    iconBg: 'bg-amber-500/15 text-amber-300',
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
  const earnedPoints = achievements
    .filter((a) => a.unlocked)
    .reduce((sum, a) => sum + a.points, 0);
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
        <div className="p-4 rounded-2xl bg-[#171c26] border border-white/[0.08]">
          <div className="text-xs text-slate-400">Tercapai</div>
          <div className="text-2xl font-bold font-mono text-white mt-1 tabular-nums">
            {earnedCount}{' '}
            <span className="text-sm font-normal text-slate-500">
              / {achievements.length}
            </span>
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-[#171c26] border border-white/[0.08]">
          <div className="text-xs text-slate-400">Poin Achievement</div>
          <div className="text-2xl font-bold font-mono text-amber-400 mt-1 tabular-nums">
            {earnedPoints}
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-[#171c26] border border-white/[0.08]">
          <div className="text-xs text-slate-400">Penyelesaian</div>
          <div className="text-2xl font-bold font-mono text-emerald-400 mt-1 tabular-nums">
            {completionPct}%
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        {(
          [
            { id: 'all', label: 'Semua' },
            { id: 'common', label: 'Common' },
            { id: 'uncommon', label: 'Uncommon' },
            { id: 'rare', label: 'Rare' },
            { id: 'epic', label: 'Epic' },
            { id: 'legendary', label: 'Legendary' },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setRarityFilter(item.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer ${
              rarityFilter === item.id
                ? 'bg-indigo-600 text-white'
                : 'bg-[#171c26] text-slate-400 hover:text-white border border-white/[0.08]'
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
              className={`p-4 rounded-2xl bg-[#171c26] border flex flex-col justify-between gap-4 transition ${
                ach.unlocked
                  ? style.ring
                  : 'border-white/[0.05] opacity-70 hover:opacity-100'
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
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-sm text-slate-100">
                    {ach.title}
                  </h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    {ach.description}
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span>
                    {ach.currentLabel} / {ach.targetLabel}
                  </span>
                  <span className="text-amber-300 font-semibold">
                    +{ach.points} pt
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-[#11151c] overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      ach.unlocked ? 'bg-emerald-400' : 'bg-indigo-500'
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
