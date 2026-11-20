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
  className = 'w-11 h-15 rounded-md',
}) => {
  const { coverUrl, fallbackUrl } = useMediaCover(title, category);

  return (
    <div
      className={`relative overflow-hidden shrink-0 bg-[#1b1e23] border border-[#282c35] ${className}`}
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
        className="w-full h-full object-cover"
      />
    </div>
  );
};
