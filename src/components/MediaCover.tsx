import React, { useEffect, useRef, useState } from 'react';
import { useMediaCover } from '../lib/mediaCovers';
import type { ImmersionCategory } from '../types';

interface MediaCoverProps {
  title: string;
  category: ImmersionCategory | string;
  coverImage?: string;
  className?: string;
}

export const MediaCover: React.FC<MediaCoverProps> = ({
  title,
  category,
  coverImage,
  className = 'w-12 h-16 rounded-xl',
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(
    () => Boolean(coverImage) || typeof IntersectionObserver === 'undefined'
  );

  useEffect(() => {
    if (inView || !containerRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [inView]);

  const { coverUrl, fallbackUrl } = useMediaCover(
    title,
    category,
    inView,
    coverImage
  );

  return (
    <div
      ref={containerRef}
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
        className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
      />
      <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-black/[0.04] rounded-[inherit]" />
    </div>
  );
};
