import React, { useState } from 'react';
import {
  Check,
  Palette,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  DEFAULT_PITCH_COLORS,
  DEFAULT_POS_COLORS,
  DEFAULT_VOCAB_COLORS,
  READER_WORD_COLOR_PRESETS,
  type PitchColorPalette,
  type PosColorPalette,
  type ReaderPreferences,
  type ReaderTextColorMode,
  type ReaderWordClickAction,
  type VocabColorPalette,
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

      {/* Live Preview Strip */}
      <div className="rounded-xl p-3 border border-current/15 bg-[#232729] text-[#d8dcdc]">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center justify-between">
          <span>Pratinjau Warna Kata</span>
          <span className="font-mono text-[9px] text-slate-400">
            {prefs.textColorMode === 'off'
              ? 'OFF'
              : prefs.textColorMode.toUpperCase()}
          </span>
        </div>
        <div
          className="text-sm leading-loose tracking-wide font-medium"
          data-text-color-mode={prefs.textColorMode}
          data-color-particles={prefs.colorParticlesInVocab ? 'true' : 'false'}
          style={
            {
              '--jp-vocab-new': prefs.vocabColors.new || '#74d4b7',
              '--jp-vocab-learning': prefs.vocabColors.learning || '#797ab5',
              '--jp-vocab-due': prefs.vocabColors.due || '#d9684e',
              '--jp-vocab-known': prefs.vocabColors.known || 'inherit',
              '--jp-vocab-ignored': prefs.vocabColors.ignored || '#8b949e',
              '--jp-vocab-particle': prefs.vocabColors.particle || '#797ab5',
              '--jp-pos-noun': prefs.posColors.noun || '#d9684e',
              '--jp-pos-verb': prefs.posColors.verb || '#74d4b7',
              '--jp-pos-adj': prefs.posColors.adj || '#f0b35e',
              '--jp-pos-particle': prefs.posColors.particle || '#797ab5',
              '--jp-pos-adverb': prefs.posColors.adverb || '#c58be6',
              '--jp-pos-other': prefs.posColors.other || 'inherit',
              '--jp-pitch-heiban': prefs.pitchColors.heiban || '#5cb8ff',
              '--jp-pitch-atamadaka': prefs.pitchColors.atamadaka || '#e06c58',
              '--jp-pitch-nakadaka': prefs.pitchColors.nakadaka || '#f0aa4f',
              '--jp-pitch-odaka': prefs.pitchColors.odaka || '#63cfa5',
              '--jp-pitch-unknown': prefs.pitchColors.unknown || 'inherit',
            } as React.CSSProperties
          }
        >
          <span
            className="jp-tok"
            data-jp-status="due"
            data-jp-pos="noun"
            data-jp-pitch="odaka"
          >
            <ruby>
              尻尾<rt>しっぽ</rt>
            </ruby>
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
            data-jp-status="new"
            data-jp-pos="verb"
            data-jp-pitch="nakadaka"
          >
            ちぎれた
          </span>
          <span
            className="jp-tok"
            data-jp-status="known"
            data-jp-pos="noun"
            data-jp-pitch="atamadaka"
          >
            <ruby>
              彼女<rt>かのじょ</rt>
            </ruby>
          </span>
          <span
            className="jp-tok"
            data-jp-status="learning"
            data-jp-pos="particle"
            data-jp-pitch="heiban"
          >
            は
          </span>
          <span>、</span>
          <span
            className="jp-tok"
            data-jp-status="new"
            data-jp-pos="adj"
            data-jp-pitch="nakadaka"
          >
            <ruby>
              低<rt>ひく</rt>
            </ruby>
            い
          </span>
          <span
            className="jp-tok"
            data-jp-status="new"
            data-jp-pos="noun"
            data-jp-pitch="heiban"
          >
            テーブル
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
