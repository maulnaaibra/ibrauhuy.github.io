import React, { useMemo, useState } from 'react';
import {
  Award,
  BookOpen,
  Check,
  Clock,
  Flame,
  Headphones,
  Layers,
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
  { label: string; tag: string; iconTone: string }
> = {
  common: {
    label: 'Common',
    tag: 'text-[#9aa0ac] bg-[#1b1e23] border-[#282c35]',
    iconTone: 'text-[#9aa0ac]',
  },
  uncommon: {
    label: 'Uncommon',
    tag: 'text-[#5cd697] bg-[#14291f] border-[#214a36]',
    iconTone: 'text-[#5cd697]',
  },
  rare: {
    label: 'Rare',
    tag: 'text-[#7db0ef] bg-[#162233] border-[#243957]',
    iconTone: 'text-[#7db0ef]',
  },
  epic: {
    label: 'Epic',
    tag: 'text-[#b69ee6] bg-[#211b2e] border-[#352a4d]',
    iconTone: 'text-[#b69ee6]',
  },
  legendary: {
    label: 'Legendary',
    tag: 'text-[#e5b55c] bg-[#262013] border-[#3d331d]',
    iconTone: 'text-[#e5b55c]',
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
      return <Award className={className} />;
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
      {/* Unified summary strip */}
      <div className="surface grid grid-cols-3 divide-x divide-[#242730]">
        <div className="p-4 sm:p-5">
          <div className="text-xs text-[#9aa0ac]">Tercapai</div>
          <div className="text-xl font-semibold font-mono text-[#ededef] mt-1 tabular-nums">
            {earnedCount}{' '}
            <span className="text-sm font-normal text-[#6c727f]">
              / {achievements.length}
            </span>
          </div>
        </div>
        <div className="p-4 sm:p-5">
          <div className="text-xs text-[#9aa0ac]">Poin</div>
          <div className="text-xl font-semibold font-mono text-[#ededef] mt-1 tabular-nums">
            {earnedPoints}
          </div>
        </div>
        <div className="p-4 sm:p-5">
          <div className="text-xs text-[#9aa0ac]">Penyelesaian</div>
          <div className="text-xl font-semibold font-mono text-[#5cd697] mt-1 tabular-nums">
            {completionPct}%
          </div>
        </div>
      </div>

      {/* Rarity filter */}
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
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              rarityFilter === item.id
                ? 'bg-[#ededef] text-[#111215]'
                : 'bg-[#16181c] text-[#9aa0ac] hover:text-[#ededef] border border-[#242730]'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Achievement cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {visible.map((ach) => {
          const style = RARITY_STYLES[ach.rarity];
          return (
            <div
              key={ach.id}
              className={`surface p-4 flex flex-col justify-between gap-4 ${
                ach.unlocked ? '' : 'opacity-65'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-8 h-8 rounded-lg bg-[#1b1e23] border border-[#282c35] flex items-center justify-center ${style.iconTone}`}
                    >
                      <AchievementIcon icon={ach.icon} className="w-4 h-4" />
                    </div>
                    <span
                      className={`text-[11px] font-medium px-2 py-0.5 rounded border ${style.tag}`}
                    >
                      {style.label}
                    </span>
                  </div>
                  {ach.unlocked && (
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#14291f] border border-[#214a36] text-[#5cd697]">
                      <Check className="w-3 h-3" />
                    </span>
                  )}
                </div>

                <div>
                  <h4 className="font-semibold text-sm text-[#ededef]">
                    {ach.title}
                  </h4>
                  <p className="text-xs text-[#9aa0ac] mt-1 leading-relaxed">
                    {ach.description}
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-mono text-[#6c727f] tabular-nums">
                  <span>
                    {ach.currentLabel} / {ach.targetLabel}
                  </span>
                  <span className="text-[#9aa0ac]">+{ach.points} pt</span>
                </div>
                <div className="progress-track h-1">
                  <div
                    className={`h-full rounded-full ${
                      ach.unlocked ? 'bg-[#2eb872]' : 'bg-[#4b5263]'
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
