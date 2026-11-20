import React from 'react';
import { useMediaCover } from '../lib/mediaCovers';
import type { ImmersionCategory } from '../types';

interface MediaCoverProps {
  title: string;
  category: ImmersionCategory | string;
  className?: string;
}

export const MediaCover: React.FC<MediaCoverProps> = ({
  title,
  category,
  className = 'w-12 h-16 rounded-xl',
}) => {
  const { coverUrl, fallbackUrl } = useMediaCover(title, category);

  return (
    <div
      className={`relative overflow-hidden shrink-0 bg-slate-100 border border-slate-200 shadow-xs ${className}`}
    >
      <img
        src={coverUrl}
        alt={title}
        loading="lazy"
        onError={(e) => {
          if (e.currentTarget.src !== fallbackUrl) {
            e.currentTarget.src = fallbackUrl;
          }
        }}
        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
      />
      <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-black/[0.04] rounded-[inherit]" />
    </div>
  );
};
