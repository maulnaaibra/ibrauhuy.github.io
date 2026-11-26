import React, { useEffect } from 'react';
import {
  Headphones,
  Search,
  Volume2,
  X,
} from 'lucide-react';
import type {
  JapanesePosCategory,
  PitchAccentPattern,
} from '../lib/japaneseCoreLexicon';
import { buildMoraPitchDiagram } from '../lib/japaneseTextAnalyzer';
import type { VocabStatus } from '../lib/vocabTrackerStore';

export interface ActiveInspectedWord {
  surface: string;
  lemma: string;
  reading: string;
  pos: JapanesePosCategory;
  pitchPattern: PitchAccentPattern;
  pitchNum?: number;
  meaning?: string;
  currentStatus: VocabStatus | 'particle';
  anchorRect: { top: number; left: number; bottom: number; width: number };
  syncChapter?: number;
  syncPara?: number;
}

interface ReaderWordPopoverProps {
  word: ActiveInspectedWord;
  panelClassName: string;
  subtleBtnClass: string;
  mutedTextClass: string;
  canJumpAudio: boolean;
  onSetStatus: (lemmaOrSurface: string, status: VocabStatus) => void;
  onSetPitch: (
    lemmaOrSurface: string,
    pattern: PitchAccentPattern,
    pitchNum?: number
  ) => void;
  onSpeakWord: (text: string) => void;
  onJumpAudioPara?: (chapterIndex: number, paraIndex: number) => void;
  onClose: () => void;
}

const POS_LABELS: Record<JapanesePosCategory, string> = {
  noun: 'Kata Benda (名詞)',
  verb: 'Kata Kerja (動詞)',
  adj: 'Kata Sifat (形容詞)',
  particle: 'Partikel (助詞)',
  adverb: 'Keterangan (副詞)',
  other: 'Lainnya',
};

const PITCH_LABELS: Record<PitchAccentPattern, string> = {
  heiban: 'Heiban (平板)',
  atamadaka: 'Atamadaka (頭高)',
  nakadaka: 'Nakadaka (中高)',
  odaka: 'Odaka (尾高)',
  unknown: 'Belum terdata',
};

const STATUS_BUTTONS: Array<{
  id: VocabStatus;
  label: string;
  activeClass: string;
}> = [
  {
    id: 'new',
    label: 'Baru',
    activeClass: 'bg-teal-400 text-slate-950 border-teal-300',
  },
  {
    id: 'learning',
    label: 'Belajar',
    activeClass: 'bg-indigo-400 text-slate-950 border-indigo-300',
  },
  {
    id: 'due',
    label: 'Due',
    activeClass: 'bg-orange-400 text-slate-950 border-orange-300',
  },
  {
    id: 'known',
    label: 'Hafal',
    activeClass: 'bg-emerald-400 text-slate-950 border-emerald-300',
  },
  {
    id: 'ignored',
    label: 'Abaikan',
    activeClass: 'bg-slate-400 text-slate-950 border-slate-300',
  },
];

export const ReaderWordPopover: React.FC<ReaderWordPopoverProps> = ({
  word,
  panelClassName,
  subtleBtnClass,
  mutedTextClass,
  canJumpAudio,
  onSetStatus,
  onSetPitch,
  onSpeakWord,
  onJumpAudioPara,
  onClose,
}) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 768;
  const popWidth = Math.min(340, vw - 24);
  const preferBelow = word.anchorRect.bottom + 255 < vh;
  const top = preferBelow
    ? Math.min(vh - 245, word.anchorRect.bottom + 8)
    : Math.max(12, word.anchorRect.top - 245);
  const left = Math.max(
    12,
    Math.min(
      vw - popWidth - 12,
      word.anchorRect.left + word.anchorRect.width / 2 - popWidth / 2
    )
  );

  const keyTarget = word.lemma || word.surface;
  const pitchDiagram = buildMoraPitchDiagram(
    word.reading || word.surface,
    word.pitchNum
  );

  return (
    <div
      data-reader-word-popover="true"
      onClick={(e) => e.stopPropagation()}
      style={{ top, left, width: popWidth }}
      className={`fixed z-[130] rounded-2xl border shadow-2xl p-3.5 space-y-2.5 animate-scale-in ${panelClassName}`}
    >
      {/* Header: Surface + Reading + Close */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {word.reading && word.reading !== word.surface && (
            <div className={`text-[11px] font-medium leading-none mb-0.5 ${mutedTextClass}`}>
              {word.reading}
            </div>
          )}
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-lg font-black leading-tight">
              {word.surface}
            </span>
            {word.lemma && word.lemma !== word.surface && (
              <span className={`text-[11px] font-bold ${mutedTextClass}`}>
                (Dasar: {word.lemma})
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup detail kata"
          className="p-1 rounded-lg opacity-70 hover:opacity-100 cursor-pointer shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Meaning + POS + Pitch Badges */}
      <div className="space-y-1.5">
        {word.meaning && (
          <div className="text-xs font-semibold leading-snug">
            {word.meaning}
          </div>
        )}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold border border-current/15 bg-white/5">
            {POS_LABELS[word.pos]}
          </span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold border border-sky-400/30 bg-sky-500/15 text-sky-300">
            {PITCH_LABELS[word.pitchPattern]}
            {typeof word.pitchNum === 'number' ? ` [${word.pitchNum}]` : ''}
          </span>
        </div>
      </div>

      {/* Visual Pitch Accent Mora Diagram + Manual Pitch Selector */}
      <div className="rounded-xl border border-current/12 bg-black/20 p-2 space-y-1.5">
        {pitchDiagram.length > 0 && typeof word.pitchNum === 'number' ? (
          <div className="flex items-end gap-0.5 overflow-x-auto pb-0.5">
            {pitchDiagram.map((step, idx) => (
              <div
                key={`${step.mora}-${idx}`}
                className="flex flex-col items-center min-w-[1.25rem]"
              >
                <div
                  className={`w-full h-3 border-sky-400 ${
                    step.high ? 'border-t-2' : 'border-b-2 opacity-60'
                  } ${step.dropAfter ? 'border-r-2' : ''}`}
                />
                <span className="text-[11px] font-bold leading-none mt-1">
                  {step.mora}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className={`text-[10px] ${mutedTextClass}`}>
            Pola pitch kata ini belum ada di kamus dasar — bisa dipilih manual:
          </div>
        )}

        <div className="grid grid-cols-4 gap-1">
          {(
            [
              { p: 'heiban', n: 0, label: '0 平板' },
              { p: 'atamadaka', n: 1, label: '1 頭高' },
              { p: 'nakadaka', n: 2, label: '2+ 中高' },
              { p: 'odaka', n: undefined, label: '尾高' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.p}
              type="button"
              onClick={() => onSetPitch(keyTarget, opt.p, opt.n)}
              className={`py-1 px-1 rounded-lg text-[10px] font-bold border transition cursor-pointer ${
                word.pitchPattern === opt.p
                  ? 'bg-sky-500 text-slate-950 border-sky-400'
                  : subtleBtnClass
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 5 Vocab Status Buttons */}
      <div className="space-y-1">
        <span className={`block text-[10px] font-bold ${mutedTextClass}`}>
          Tandai Status Kata ({keyTarget}):
        </span>
        <div className="grid grid-cols-5 gap-1">
          {STATUS_BUTTONS.map((btn) => {
            const active =
              word.currentStatus === btn.id ||
              (btn.id === 'new' && word.currentStatus === 'particle');
            return (
              <button
                key={btn.id}
                type="button"
                onClick={() => onSetStatus(keyTarget, btn.id)}
                className={`py-1.5 px-1 rounded-xl text-[10px] font-extrabold border transition cursor-pointer ${
                  active ? btn.activeClass : subtleBtnClass
                }`}
              >
                {btn.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex items-center justify-between gap-1.5 pt-0.5">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onSpeakWord(word.surface)}
            className={`px-2.5 py-1 rounded-xl border text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer ${subtleBtnClass}`}
          >
            <Volume2 className="w-3 h-3" />
            <span>Dengar</span>
          </button>
          {canJumpAudio &&
            onJumpAudioPara &&
            typeof word.syncChapter === 'number' &&
            typeof word.syncPara === 'number' && (
              <button
                type="button"
                onClick={() => {
                  onJumpAudioPara(word.syncChapter!, word.syncPara!);
                  onClose();
                }}
                className={`px-2.5 py-1 rounded-xl border text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer ${subtleBtnClass}`}
              >
                <Headphones className="w-3 h-3 text-sky-400" />
                <span>Audio Sini</span>
              </button>
            )}
        </div>
        <a
          href={`https://jisho.org/search/${encodeURIComponent(keyTarget)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="px-2.5 py-1 rounded-xl bg-sky-500 text-slate-950 text-[11px] font-extrabold inline-flex items-center gap-1"
        >
          <Search className="w-3 h-3" />
          <span>Jisho</span>
        </a>
      </div>
    </div>
  );
};
