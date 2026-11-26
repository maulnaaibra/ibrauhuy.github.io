import React, { useState } from 'react';
import {
  Check,
  Palette,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Trash2,
  Underline,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  buildWordMarkerCssVars,
  DEFAULT_PITCH_COLORS,
  DEFAULT_POS_COLORS,
  DEFAULT_VOCAB_COLORS,
  DEFAULT_VOCAB_UNDERLINES,
  READER_WORD_COLOR_PRESETS,
  type PitchColorPalette,
  type PosColorPalette,
  type ReaderPreferences,
  type ReaderTextColorMode,
  type ReaderUnderlineStyle,
  type ReaderWordClickAction,
  type VocabColorPalette,
  type VocabUnderlinePalette,
  type WordUnderlineRule,
} from '../lib/epubReaderStore';
import {
  clearVocabStore,
  getVocabStats,
  markCoreParticlesKnown,
  syncVocabFromAnki,
  type VocabDictionaryMap,
} from '../lib/vocabTrackerStore';

interface ThemeStyleLite {
  subtleBtn: string;
  mutedText: string;
  accentText: string;
}

interface ReaderWordColorPanelProps {
  prefs: ReaderPreferences;
  updatePrefs: (patch: Partial<ReaderPreferences>) => void;
  themeStyle: ThemeStyleLite;
  vocabMap: VocabDictionaryMap;
}

const HEX_SHORT_OR_FULL_RE = /^#?[0-9a-fA-F]{6}$/;

interface SwatchRowProps {
  label: string;
  sublabel: string;
  value: string;
  defaultHex: string;
  onChange: (next: string) => void;
  subtleBtnClass: string;
  mutedTextClass: string;
}

const WordCategoryColorRow: React.FC<SwatchRowProps> = ({
  label,
  sublabel,
  value,
  defaultHex,
  onChange,
  subtleBtnClass,
  mutedTextClass,
}) => {
  const effectivePickerHex = value || defaultHex || '#d8dcdc';
  const [hexDraft, setHexDraft] = useState(value);

  React.useEffect(() => {
    setHexDraft(value);
  }, [value]);

  const commitHex = (raw: string) => {
    const clean = raw.trim();
    if (!clean) {
      onChange('');
      return;
    }
    if (HEX_SHORT_OR_FULL_RE.test(clean)) {
      const normalized = clean.startsWith('#')
        ? clean.toLowerCase()
        : `#${clean.toLowerCase()}`;
      onChange(normalized);
      setHexDraft(normalized);
    }
  };

  return (
    <div className="flex items-center justify-between gap-2 py-1.5 border-b border-current/10 last:border-b-0">
      <div className="min-w-0 flex items-center gap-2">
        <span
          className="w-3.5 h-3.5 rounded-full shrink-0 border border-white/25"
          style={{
            backgroundColor: value ? value : 'transparent',
            backgroundImage: value
              ? undefined
              : 'linear-gradient(135deg, rgba(255,255,255,0.22) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.22) 50%, rgba(255,255,255,0.22) 75%, transparent 75%)',
            backgroundSize: value ? undefined : '6px 6px',
          }}
        />
        <div className="min-w-0">
          <div className="text-[11px] font-bold leading-tight truncate">
            {label}
          </div>
          <div className={`text-[10px] leading-tight truncate ${mutedTextClass}`}>
            {sublabel}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <label
          title={`Pilih warna ${label}`}
          className="relative w-6 h-6 rounded-lg overflow-hidden border border-white/20 cursor-pointer shrink-0"
          style={{ backgroundColor: effectivePickerHex }}
        >
          <input
            type="color"
            value={effectivePickerHex}
            onChange={(e) => {
              const next = e.target.value.toLowerCase();
              setHexDraft(next);
              onChange(next);
            }}
            className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
          />
        </label>
        <input
          type="text"
          value={hexDraft}
          placeholder="Tema"
          maxLength={7}
          onChange={(e) => {
            setHexDraft(e.target.value);
            if (/^#[0-9a-fA-F]{6}$/.test(e.target.value.trim())) {
              onChange(e.target.value.trim().toLowerCase());
            }
          }}
          onBlur={() => commitHex(hexDraft)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              commitHex(hexDraft);
            }
          }}
          className="w-[4.4rem] px-1.5 py-1 rounded-lg bg-black/25 border border-current/15 text-[10px] font-mono focus:outline-none focus:border-sky-400"
        />
        <button
          type="button"
          onClick={() => onChange('')}
          title="Ikuti warna default teks tema baca"
          className={`px-1.5 py-1 rounded-lg border text-[10px] font-bold cursor-pointer ${subtleBtnClass}`}
        >
          Auto
        </button>
      </div>
    </div>
  );
};

const UNDERLINE_STYLE_OPTIONS: Array<{
  id: ReaderUnderlineStyle;
  label: string;
}> = [
  { id: 'solid', label: 'Solid' },
  { id: 'dotted', label: 'Titik' },
  { id: 'dashed', label: 'Putus' },
  { id: 'none', label: 'Mati' },
];

const UNDERLINE_CATEGORIES: Array<{
  key: keyof VocabUnderlinePalette;
  label: string;
  sublabel: string;
}> = [
  {
    key: 'new',
    label: 'Kata Baru',
    sublabel: 'Belum dikenal (cth: 本能 / ボタン)',
  },
  {
    key: 'learning',
    label: 'Sedang Belajar',
    sublabel: 'Dalam proses belajar (cth: 俺 / 従う)',
  },
  {
    key: 'due',
    label: 'Perlu Review (Due)',
    sublabel: 'Kartu Anki / prioritas ulang',
  },
  {
    key: 'known',
    label: 'Sudah Hafal',
    sublabel: 'Kata sudah dikuasai',
  },
  {
    key: 'particle',
    label: 'Partikel',
    sublabel: 'は, が, を, に, の',
  },
  {
    key: 'ignored',
    label: 'Diabaikan',
    sublabel: 'Nama tokoh / SFX',
  },
];

interface UnderlineRuleRowProps {
  label: string;
  sublabel: string;
  rule: WordUnderlineRule;
  onChange: (next: WordUnderlineRule) => void;
  subtleBtnClass: string;
  mutedTextClass: string;
}

const WordUnderlineRuleRow: React.FC<UnderlineRuleRowProps> = ({
  label,
  sublabel,
  rule,
  onChange,
  subtleBtnClass,
  mutedTextClass,
}) => (
  <div className="py-1.5 border-b border-current/10 last:border-b-0 space-y-1.5">
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <div className="text-[11px] font-bold leading-tight truncate">{label}</div>
        <div className={`text-[10px] leading-tight truncate ${mutedTextClass}`}>
          {sublabel}
        </div>
      </div>
      <label
        title={`Pilih warna garis ${label}`}
        className={`relative w-6 h-6 rounded-lg overflow-hidden border border-white/20 cursor-pointer shrink-0 ${
          rule.style === 'none' ? 'opacity-40' : ''
        }`}
        style={{ backgroundColor: rule.color }}
      >
        <input
          type="color"
          value={rule.color}
          onChange={(e) =>
            onChange({ ...rule, color: e.target.value.toLowerCase() })
          }
          className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
        />
      </label>
    </div>

    <div className="grid grid-cols-4 gap-1">
      {UNDERLINE_STYLE_OPTIONS.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange({ ...rule, style: opt.id })}
          className={`py-1 px-1.5 rounded-lg text-[10px] font-bold border transition cursor-pointer ${
            rule.style === opt.id
              ? 'bg-sky-500 text-slate-950 border-sky-400'
              : subtleBtnClass
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  </div>
);

export const ReaderWordColorPanel: React.FC<ReaderWordColorPanelProps> = ({
  prefs,
  updatePrefs,
  themeStyle,
  vocabMap,
}) => {
  const [syncingAnki, setSyncingAnki] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const stats = getVocabStats(vocabMap);

  const handleSetMode = (mode: ReaderTextColorMode) => {
    updatePrefs({ textColorMode: mode });
  };

  const handlePatchVocabColor = (
    key: keyof VocabColorPalette,
    value: string
  ) => {
    updatePrefs({
      vocabColors: { ...prefs.vocabColors, [key]: value },
    });
  };

  const handlePatchPosColor = (key: keyof PosColorPalette, value: string) => {
    updatePrefs({
      posColors: { ...prefs.posColors, [key]: value },
    });
  };

  const handlePatchPitchColor = (
    key: keyof PitchColorPalette,
    value: string
  ) => {
    updatePrefs({
      pitchColors: { ...prefs.pitchColors, [key]: value },
    });
  };

  const handlePatchUnderlineRule = (
    key: keyof VocabUnderlinePalette,
    next: WordUnderlineRule
  ) => {
    updatePrefs({
      wordUnderlinePalette: { ...prefs.wordUnderlinePalette, [key]: next },
    });
  };

  const handleApplyMigakuUnderlinePreset = () => {
    updatePrefs({
      textColorMode: 'off',
      wordUnderline: true,
      wordUnderlineThickness: 2,
      wordUnderlineOffset: 3,
      wordUnderlinePalette: DEFAULT_VOCAB_UNDERLINES,
    });
    toast.success('Garis bawah kata (gaya contoh) diaktifkan!');
  };

  const handleMarkParticles = () => {
    const res = markCoreParticlesKnown();
    if (res.updatedCount > 0) {
      toast.success(`${res.updatedCount} partikel dasar ditandai Hafal!`);
    } else {
      toast('Semua partikel dasar sudah bertanda Hafal.');
    }
  };

  const handleSyncAnki = async () => {
    setSyncingAnki(true);
    try {
      const res = await syncVocabFromAnki();
      if (res.importedCount === 0) {
        toast('Tidak ditemukan kartu aktif di Anki (cek deck di Dashboard → Perangkat).');
      } else {
        toast.success(
          `Sinkron Anki selesai (${res.deckSummary}): ${res.knownCount} Hafal, ${res.learningCount} Belajar, ${res.dueCount} Due`
        );
      }
    } catch (err: unknown) {
      toast.error(
        err instanceof Error
          ? `AnkiConnect belum terhubung (${err.message})`
          : 'Pastikan Anki desktop & AnkiConnect aktif.'
      );
    } finally {
      setSyncingAnki(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Main Coloring Mode Selector */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className={`text-[11px] font-bold ${themeStyle.mutedText}`}>
            Mode Pewarnaan Kata (W)
          </span>
          {prefs.theme !== 'slate' && (
            <button
              type="button"
              onClick={() => updatePrefs({ theme: 'slate' })}
              className="text-[10px] font-bold text-sky-400 hover:underline cursor-pointer"
            >
              Pakai BG Contoh (#232729)
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {(
            [
              { id: 'off', label: 'Mati (Normal)', desc: 'Teks polos bawaan' },
              {
                id: 'vocab',
                label: 'Status Kosakata',
                desc: 'Baru / Belajar / Hafal',
              },
              {
                id: 'pos',
                label: 'Kelas Kata',
                desc: 'Benda / Kerja / Sifat / Partikel',
              },
              {
                id: 'pitch',
                label: 'Pitch Accent',
                desc: 'Heiban / Atama / Naka / Odaka',
              },
            ] as const
          ).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => handleSetMode(m.id)}
              className={`px-2.5 py-2 rounded-xl text-left border transition cursor-pointer ${
                prefs.textColorMode === m.id
                  ? 'bg-sky-500 text-slate-950 border-sky-400'
                  : themeStyle.subtleBtn
              }`}
            >
              <div className="text-[11px] font-extrabold leading-tight">
                {m.label}
              </div>
              <div
                className={`text-[9px] mt-0.5 leading-tight ${
                  prefs.textColorMode === m.id ? 'text-slate-900/80' : 'opacity-70'
                }`}
              >
                {m.desc}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Word Underline Tracker (Migaku / Yomitan style) */}
      <div className="space-y-2 rounded-xl border border-current/15 p-2.5 bg-black/15">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[11px] font-extrabold flex items-center gap-1.5">
              <Underline className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span>Garis Bawah Kata (U)</span>
            </div>
            <div className={`text-[10px] leading-tight ${themeStyle.mutedText}`}>
              Garis solid/titik penanda status kosakata seperti di foto
            </div>
          </div>
          <button
            type="button"
            onClick={() => updatePrefs({ wordUnderline: !prefs.wordUnderline })}
            className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold transition cursor-pointer shrink-0 ${
              prefs.wordUnderline
                ? 'bg-emerald-500 text-slate-950'
                : 'bg-white/10 opacity-80'
            }`}
          >
            {prefs.wordUnderline ? 'ON' : 'OFF'}
          </button>
        </div>

        <button
          type="button"
          onClick={handleApplyMigakuUnderlinePreset}
          className={`w-full px-2.5 py-1.5 rounded-xl border text-[11px] font-bold flex items-center justify-between gap-2 transition cursor-pointer ${themeStyle.subtleBtn}`}
        >
          <span>Pakai Gaya Contoh (Teks Polos + Garis Merah/Teal)</span>
          <span className="text-[10px] text-sky-400 font-extrabold shrink-0">
            Terapkan
          </span>
        </button>

        {prefs.wordUnderline && (
          <div className="space-y-2.5 pt-1 border-t border-current/10">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-bold opacity-80">
                  <span>Tebal Garis</span>
                  <span className="font-mono">{prefs.wordUnderlineThickness}px</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={4}
                  step={0.5}
                  value={prefs.wordUnderlineThickness}
                  onChange={(e) =>
                    updatePrefs({
                      wordUnderlineThickness: Number(e.target.value),
                    })
                  }
                  className="w-full accent-sky-400 cursor-pointer"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-bold opacity-80">
                  <span>Jarak Teks</span>
                  <span className="font-mono">{prefs.wordUnderlineOffset}px</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={8}
                  step={1}
                  value={prefs.wordUnderlineOffset}
                  onChange={(e) =>
                    updatePrefs({
                      wordUnderlineOffset: Number(e.target.value),
                    })
                  }
                  className="w-full accent-sky-400 cursor-pointer"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-0.5">
              <span className={`text-[10px] font-extrabold ${themeStyle.accentText}`}>
                Atur Garis per Status Kata
              </span>
              <button
                type="button"
                onClick={() =>
                  updatePrefs({
                    wordUnderlineThickness: 2,
                    wordUnderlineOffset: 3,
                    wordUnderlinePalette: DEFAULT_VOCAB_UNDERLINES,
                  })
                }
                className="text-[10px] font-bold opacity-80 hover:opacity-100 inline-flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-2.5 h-2.5" />
                <span>Default</span>
              </button>
            </div>

            <div>
              {UNDERLINE_CATEGORIES.map((cat) => (
                <WordUnderlineRuleRow
                  key={cat.key}
                  label={cat.label}
                  sublabel={cat.sublabel}
                  rule={prefs.wordUnderlinePalette[cat.key]}
                  onChange={(next) => handlePatchUnderlineRule(cat.key, next)}
                  subtleBtnClass={themeStyle.subtleBtn}
                  mutedTextClass={themeStyle.mutedText}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Live Preview Strip */}
      <div className="rounded-xl p-3 border border-current/15 bg-[#232729] text-[#d8dcdc]">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center justify-between">
          <span>Pratinjau Kata &amp; Garis</span>
          <span className="font-mono text-[9px] text-slate-400">
            {prefs.textColorMode === 'off'
              ? prefs.wordUnderline
                ? 'GARIS'
                : 'OFF'
              : prefs.wordUnderline
                ? `${prefs.textColorMode.toUpperCase()}+GARIS`
                : prefs.textColorMode.toUpperCase()}
          </span>
        </div>
        <div
          className="jp-novel-reader-content text-base leading-loose tracking-wide font-medium"
          data-text-color-mode={prefs.textColorMode}
          data-word-underline={prefs.wordUnderline ? 'true' : 'false'}
          data-color-particles={prefs.colorParticlesInVocab ? 'true' : 'false'}
          style={buildWordMarkerCssVars(prefs) as React.CSSProperties}
        >
          <span
            className="jp-tok"
            data-jp-status="learning"
            data-jp-pos="noun"
            data-jp-pitch="heiban"
          >
            俺
          </span>
          <span
            className="jp-tok"
            data-jp-status="particle"
            data-jp-pos="particle"
            data-jp-pitch="heiban"
          >
            は
          </span>
          <span
            className="jp-tok"
            data-jp-status="learning"
            data-jp-pos="adverb"
            data-jp-pitch="atamadaka"
          >
            ほぼ
          </span>
          <span
            className="jp-tok"
            data-jp-status="new"
            data-jp-pos="noun"
            data-jp-pitch="atamadaka"
          >
            <ruby>
              本能<rt>ほんのう</rt>
            </ruby>
          </span>
          <span
            className="jp-tok"
            data-jp-status="particle"
            data-jp-pos="particle"
            data-jp-pitch="heiban"
          >
            に
          </span>
          <span
            className="jp-tok"
            data-jp-status="learning"
            data-jp-pos="verb"
            data-jp-pitch="heiban"
          >
            従う
          </span>
          <span
            className="jp-tok"
            data-jp-status="due"
            data-jp-pos="noun"
            data-jp-pitch="odaka"
          >
            ブラウス
          </span>
          <span
            className="jp-tok"
            data-jp-status="particle"
            data-jp-pos="particle"
            data-jp-pitch="atamadaka"
          >
            の
          </span>
          <span
            className="jp-tok"
            data-jp-status="known"
            data-jp-pos="noun"
            data-jp-pitch="heiban"
          >
            <ruby>
              彼女<rt>かのじょ</rt>
            </ruby>
          </span>
          <span>。</span>
        </div>
      </div>

      {/* Word Click Interaction */}
      <div className="space-y-1.5">
        <span className={`block text-[11px] font-bold ${themeStyle.mutedText}`}>
          Saat Kata Diklik
        </span>
        <div className="grid grid-cols-3 gap-1.5">
          {(
            [
              { id: 'popover', label: 'Info & Status' },
              { id: 'cycle', label: '1-Klik Ganti' },
              { id: 'off', label: 'Mati (Seleksi)' },
            ] as Array<{ id: ReaderWordClickAction; label: string }>
          ).map((act) => (
            <button
              key={act.id}
              type="button"
              onClick={() => updatePrefs({ wordClickAction: act.id })}
              className={`px-2 py-1.5 rounded-xl text-[11px] font-bold border transition cursor-pointer ${
                prefs.wordClickAction === act.id
                  ? 'bg-sky-500 text-slate-950 border-sky-400'
                  : themeStyle.subtleBtn
              }`}
            >
              {act.label}
            </button>
          ))}
        </div>
      </div>

      {/* Furigana & Particle Toggles */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={() =>
            updatePrefs({ hideKnownFurigana: !prefs.hideKnownFurigana })
          }
          className={`w-full px-3 py-2 rounded-xl border text-xs font-bold flex items-center justify-between gap-2 cursor-pointer ${themeStyle.subtleBtn}`}
        >
          <span>Sembunyikan Furigana Kata Hafal</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
              prefs.hideKnownFurigana
                ? 'bg-emerald-500 text-slate-950'
                : 'bg-white/10 opacity-75'
            }`}
          >
            {prefs.hideKnownFurigana ? 'ON' : 'OFF'}
          </span>
        </button>

        {prefs.textColorMode === 'vocab' && (
          <button
            type="button"
            onClick={() =>
              updatePrefs({
                colorParticlesInVocab: !prefs.colorParticlesInVocab,
              })
            }
            className={`w-full px-3 py-2 rounded-xl border text-xs font-bold flex items-center justify-between gap-2 cursor-pointer ${themeStyle.subtleBtn}`}
          >
            <span>Warnai Partikel (の / は / に / を)</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                prefs.colorParticlesInVocab
                  ? 'bg-sky-500 text-slate-950'
                  : 'bg-white/10 opacity-75'
              }`}
            >
              {prefs.colorParticlesInVocab ? 'ON' : 'OFF'}
            </span>
          </button>
        )}
      </div>

      {/* Quick Color Presets */}
      <div className="space-y-1.5">
        <span
          className={`flex items-center gap-1 text-[11px] font-bold ${themeStyle.mutedText}`}
        >
          <Palette className="w-3.5 h-3.5" />
          <span>Preset Warna Cepat</span>
        </span>
        <div className="grid grid-cols-1 gap-1.5">
          {READER_WORD_COLOR_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => {
                updatePrefs({
                  vocabColors: preset.vocabColors,
                  posColors: preset.posColors,
                  pitchColors: preset.pitchColors,
                });
                toast.success(`Preset warna "${preset.label}" diterapkan!`);
              }}
              className={`px-2.5 py-2 rounded-xl border text-left flex items-center justify-between gap-2 transition cursor-pointer ${themeStyle.subtleBtn}`}
            >
              <div className="min-w-0">
                <div className="text-[11px] font-extrabold leading-tight">
                  {preset.label}
                </div>
                <div className={`text-[10px] leading-tight ${themeStyle.mutedText}`}>
                  {preset.desc}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span
                  className="w-3 h-3 rounded-full border border-white/25"
                  style={{ backgroundColor: preset.vocabColors.new }}
                />
                <span
                  className="w-3 h-3 rounded-full border border-white/25"
                  style={{ backgroundColor: preset.vocabColors.learning }}
                />
                <span
                  className="w-3 h-3 rounded-full border border-white/25"
                  style={{ backgroundColor: preset.vocabColors.due }}
                />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Per-Category Color Pickers based on active or selected mode */}
      <div className="space-y-1.5 rounded-xl border border-current/15 p-2.5 bg-black/15">
        <div className="flex items-center justify-between gap-2 pb-1">
          <span className={`text-[11px] font-extrabold ${themeStyle.accentText}`}>
            {prefs.textColorMode === 'pos'
              ? 'Warna Kelas Kata (Atur Bebas)'
              : prefs.textColorMode === 'pitch'
                ? 'Warna Pitch Accent (Atur Bebas)'
                : 'Warna Status Kosakata (Atur Bebas)'}
          </span>
          <button
            type="button"
            onClick={() => {
              if (prefs.textColorMode === 'pos') {
                updatePrefs({ posColors: DEFAULT_POS_COLORS });
              } else if (prefs.textColorMode === 'pitch') {
                updatePrefs({ pitchColors: DEFAULT_PITCH_COLORS });
              } else {
                updatePrefs({ vocabColors: DEFAULT_VOCAB_COLORS });
              }
            }}
            className="text-[10px] font-bold opacity-80 hover:opacity-100 inline-flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-2.5 h-2.5" />
            <span>Default</span>
          </button>
        </div>

        {prefs.textColorMode === 'pos' ? (
          <div>
            <WordCategoryColorRow
              label="Kata Benda (名詞)"
              sublabel="Nomina, tempat, kata ganti, katakana"
              value={prefs.posColors.noun}
              defaultHex={DEFAULT_POS_COLORS.noun}
              onChange={(v) => handlePatchPosColor('noun', v)}
              subtleBtnClass={themeStyle.subtleBtn}
              mutedTextClass={themeStyle.mutedText}
            />
            <WordCategoryColorRow
              label="Kata Kerja (動詞)"
              sublabel="Verba & konjugasi (-ます / -ている)"
              value={prefs.posColors.verb}
              defaultHex={DEFAULT_POS_COLORS.verb}
              onChange={(v) => handlePatchPosColor('verb', v)}
              subtleBtnClass={themeStyle.subtleBtn}
              mutedTextClass={themeStyle.mutedText}
            />
            <WordCategoryColorRow
              label="Kata Sifat (形容詞)"
              sublabel="Adjektiva-i & Adjektiva-na"
              value={prefs.posColors.adj}
              defaultHex={DEFAULT_POS_COLORS.adj}
              onChange={(v) => handlePatchPosColor('adj', v)}
              subtleBtnClass={themeStyle.subtleBtn}
              mutedTextClass={themeStyle.mutedText}
            />
            <WordCategoryColorRow
              label="Partikel (助詞・接続)"
              sublabel="は, が, を, に, の, で, konjungsi"
              value={prefs.posColors.particle}
              defaultHex={DEFAULT_POS_COLORS.particle}
              onChange={(v) => handlePatchPosColor('particle', v)}
              subtleBtnClass={themeStyle.subtleBtn}
              mutedTextClass={themeStyle.mutedText}
            />
            <WordCategoryColorRow
              label="Keterangan (副詞)"
              sublabel="Adverbia & onomatopoeia"
              value={prefs.posColors.adverb}
              defaultHex={DEFAULT_POS_COLORS.adverb}
              onChange={(v) => handlePatchPosColor('adverb', v)}
              subtleBtnClass={themeStyle.subtleBtn}
              mutedTextClass={themeStyle.mutedText}
            />
          </div>
        ) : prefs.textColorMode === 'pitch' ? (
          <div>
            <WordCategoryColorRow
              label="Heiban (平板 [0])"
              sublabel="Nada naik di mora 2 lalu datar"
              value={prefs.pitchColors.heiban}
              defaultHex={DEFAULT_PITCH_COLORS.heiban}
              onChange={(v) => handlePatchPitchColor('heiban', v)}
              subtleBtnClass={themeStyle.subtleBtn}
              mutedTextClass={themeStyle.mutedText}
            />
            <WordCategoryColorRow
              label="Atamadaka (頭高 [1])"
              sublabel="Nada tinggi di awal lalu turun"
              value={prefs.pitchColors.atamadaka}
              defaultHex={DEFAULT_PITCH_COLORS.atamadaka}
              onChange={(v) => handlePatchPitchColor('atamadaka', v)}
              subtleBtnClass={themeStyle.subtleBtn}
              mutedTextClass={themeStyle.mutedText}
            />
            <WordCategoryColorRow
              label="Nakadaka (中高 [2+])"
              sublabel="Turun di tengah kata"
              value={prefs.pitchColors.nakadaka}
              defaultHex={DEFAULT_PITCH_COLORS.nakadaka}
              onChange={(v) => handlePatchPitchColor('nakadaka', v)}
              subtleBtnClass={themeStyle.subtleBtn}
              mutedTextClass={themeStyle.mutedText}
            />
            <WordCategoryColorRow
              label="Odaka (尾高 [n])"
              sublabel="Turun tepat setelah kata"
              value={prefs.pitchColors.odaka}
              defaultHex={DEFAULT_PITCH_COLORS.odaka}
              onChange={(v) => handlePatchPitchColor('odaka', v)}
              subtleBtnClass={themeStyle.subtleBtn}
              mutedTextClass={themeStyle.mutedText}
            />
            <WordCategoryColorRow
              label="Belum Terdata"
              sublabel="Kata di luar kamus dasar"
              value={prefs.pitchColors.unknown}
              defaultHex="#9ca3af"
              onChange={(v) => handlePatchPitchColor('unknown', v)}
              subtleBtnClass={themeStyle.subtleBtn}
              mutedTextClass={themeStyle.mutedText}
            />
          </div>
        ) : (
          <div>
            <WordCategoryColorRow
              label="Kata Baru"
              sublabel="Kosakata yang belum ditandai"
              value={prefs.vocabColors.new}
              defaultHex={DEFAULT_VOCAB_COLORS.new}
              onChange={(v) => handlePatchVocabColor('new', v)}
              subtleBtnClass={themeStyle.subtleBtn}
              mutedTextClass={themeStyle.mutedText}
            />
            <WordCategoryColorRow
              label="Sedang Dipelajari"
              sublabel="Status Learning"
              value={prefs.vocabColors.learning}
              defaultHex={DEFAULT_VOCAB_COLORS.learning}
              onChange={(v) => handlePatchVocabColor('learning', v)}
              subtleBtnClass={themeStyle.subtleBtn}
              mutedTextClass={themeStyle.mutedText}
            />
            <WordCategoryColorRow
              label="Perlu Review (Due)"
              sublabel="Butuh diingat / prioritas ulang"
              value={prefs.vocabColors.due}
              defaultHex={DEFAULT_VOCAB_COLORS.due}
              onChange={(v) => handlePatchVocabColor('due', v)}
              subtleBtnClass={themeStyle.subtleBtn}
              mutedTextClass={themeStyle.mutedText}
            />
            <WordCategoryColorRow
              label="Sudah Hafal (Known)"
              sublabel="Kosong = ikut warna teks tema"
              value={prefs.vocabColors.known}
              defaultHex="#d8dcdc"
              onChange={(v) => handlePatchVocabColor('known', v)}
              subtleBtnClass={themeStyle.subtleBtn}
              mutedTextClass={themeStyle.mutedText}
            />
            <WordCategoryColorRow
              label="Partikel"
              sublabel="の, は, に, を, dll."
              value={prefs.vocabColors.particle}
              defaultHex={DEFAULT_VOCAB_COLORS.particle}
              onChange={(v) => handlePatchVocabColor('particle', v)}
              subtleBtnClass={themeStyle.subtleBtn}
              mutedTextClass={themeStyle.mutedText}
            />
            <WordCategoryColorRow
              label="Diabaikan"
              sublabel="Nama tokoh / efek suara"
              value={prefs.vocabColors.ignored}
              defaultHex={DEFAULT_VOCAB_COLORS.ignored}
              onChange={(v) => handlePatchVocabColor('ignored', v)}
              subtleBtnClass={themeStyle.subtleBtn}
              mutedTextClass={themeStyle.mutedText}
            />
          </div>
        )}
      </div>

      {/* Vocabulary Tracker Management */}
      <div className="space-y-2 rounded-xl border border-current/15 p-2.5 bg-black/15">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-extrabold flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Bank Kosakata Tersimpan</span>
          </span>
          <span className="text-[10px] font-mono opacity-80">
            {stats.total} kata
          </span>
        </div>

        <div className="grid grid-cols-4 gap-1 text-center">
          <div className="rounded-lg bg-emerald-500/10 border border-emerald-400/20 py-1 px-1">
            <div className="text-xs font-extrabold text-emerald-300">
              {stats.known}
            </div>
            <div className="text-[9px] opacity-75">Hafal</div>
          </div>
          <div className="rounded-lg bg-indigo-500/10 border border-indigo-400/20 py-1 px-1">
            <div className="text-xs font-extrabold text-indigo-300">
              {stats.learning}
            </div>
            <div className="text-[9px] opacity-75">Belajar</div>
          </div>
          <div className="rounded-lg bg-orange-500/10 border border-orange-400/20 py-1 px-1">
            <div className="text-xs font-extrabold text-orange-300">
              {stats.due}
            </div>
            <div className="text-[9px] opacity-75">Due</div>
          </div>
          <div className="rounded-lg bg-slate-500/10 border border-slate-400/20 py-1 px-1">
            <div className="text-xs font-extrabold text-slate-300">
              {stats.ignored}
            </div>
            <div className="text-[9px] opacity-75">Abaikan</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={handleMarkParticles}
            className={`px-2 py-1.5 rounded-xl border text-[11px] font-bold inline-flex items-center justify-center gap-1 cursor-pointer ${themeStyle.subtleBtn}`}
          >
            <Check className="w-3 h-3 text-emerald-400 shrink-0" />
            <span>Partikel Hafal</span>
          </button>
          <button
            type="button"
            disabled={syncingAnki}
            onClick={() => void handleSyncAnki()}
            className={`px-2 py-1.5 rounded-xl border text-[11px] font-bold inline-flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50 ${themeStyle.subtleBtn}`}
          >
            <RefreshCw
              className={`w-3 h-3 text-sky-400 shrink-0 ${syncingAnki ? 'animate-spin' : ''}`}
            />
            <span>{syncingAnki ? 'Menyinkron...' : 'Sinkron Anki'}</span>
          </button>
        </div>

        {stats.total > 0 && (
          <div>
            {!confirmClear ? (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className="text-[10px] font-bold text-red-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                <span>Reset Semua Status Kosakata</span>
              </button>
            ) : (
              <div className="flex items-center justify-between gap-2 pt-1 text-[10px]">
                <span className="text-red-300 font-bold">
                  Hapus {stats.total} status kata?
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      clearVocabStore();
                      setConfirmClear(false);
                      toast.success('Semua status kosakata direset.');
                    }}
                    className="px-2 py-0.5 rounded bg-red-500 text-white font-bold cursor-pointer"
                  >
                    Ya, Hapus
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClear(false)}
                    className={`px-2 py-0.5 rounded border font-bold cursor-pointer ${themeStyle.subtleBtn}`}
                  >
                    Batal
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
