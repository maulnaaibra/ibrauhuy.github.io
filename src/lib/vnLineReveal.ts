import type { VnAnimationStyle } from './epubReaderStore';

export interface VnRevealController {
  finishNow: () => void;
  cancel: () => void;
  isRunning: () => boolean;
}

export interface VnRevealOptions {
  style: VnAnimationStyle;
  writingMode: 'horizontal' | 'vertical';
  durationPerLineMs: number;
  onComplete?: () => void;
}

interface LineBand {
  /** Primary axis start in px relative to element border-box (top in horizontal, left in vertical). */
  sliceStart: number;
  /** Primary axis end in px relative to element border-box (bottom in horizontal, right in vertical). */
  sliceEnd: number;
  /** Cross axis start in px (left in horizontal, top in vertical), padded slightly for glyph overhangs. */
  crossStart: number;
  /** Cross axis end in px (right in horizontal, bottom in vertical), padded slightly for glyph overhangs. */
  crossEnd: number;
  /** Raw un-padded primary start used for boundary splitting. */
  bandStart: number;
  /** Raw un-padded primary end used for boundary splitting. */
  bandEnd: number;
  center: number;
}

interface ElementRevealPlan {
  el: HTMLElement;
  boxWidth: number;
  boxHeight: number;
  lines: LineBand[];
}

interface RawRect {
  primaryStart: number;
  primaryEnd: number;
  crossStart: number;
  crossEnd: number;
  thickness: number;
}

function clearElementRevealStyles(el: HTMLElement): void {
  el.style.opacity = '';
  el.style.maskImage = '';
  el.style.maskPosition = '';
  el.style.maskSize = '';
  el.style.maskRepeat = '';
  el.style.removeProperty('-webkit-mask-image');
  el.style.removeProperty('-webkit-mask-position');
  el.style.removeProperty('-webkit-mask-size');
  el.style.removeProperty('-webkit-mask-repeat');
}

function setElementMaskLayers(
  el: HTMLElement,
  images: string[],
  positions: string[],
  sizes: string[]
): void {
  const imageStr = images.join(', ');
  const posStr = positions.join(', ');
  const sizeStr = sizes.join(', ');
  const repeatStr = images.map(() => 'no-repeat').join(', ');

  el.style.maskImage = imageStr;
  el.style.maskPosition = posStr;
  el.style.maskSize = sizeStr;
  el.style.maskRepeat = repeatStr;

  el.style.setProperty('-webkit-mask-image', imageStr);
  el.style.setProperty('-webkit-mask-position', posStr);
  el.style.setProperty('-webkit-mask-size', sizeStr);
  el.style.setProperty('-webkit-mask-repeat', repeatStr);
}

function computeMedian(values: number[], fallback: number): number {
  if (values.length === 0) return fallback;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function measureElementLines(
  el: HTMLElement,
  writingMode: 'horizontal' | 'vertical'
): { boxWidth: number; boxHeight: number; lines: LineBand[] } {
  const box = el.getBoundingClientRect();
  const boxWidth = box.width;
  const boxHeight = box.height;

  if (boxWidth <= 0 || boxHeight <= 0) {
    return { boxWidth: 0, boxHeight: 0, lines: [] };
  }

  const rawRects: RawRect[] = [];
  const doc = el.ownerDocument;
  const range = doc.createRange();

  const walker = doc.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue || !node.nodeValue.trim()) {
        return NodeFilter.FILTER_REJECT;
      }
      const parent = node.parentElement;
      if (parent && parent.closest('rt, rp')) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let textNode = walker.nextNode();
  while (textNode) {
    range.selectNodeContents(textNode);
    const rects = range.getClientRects();
    for (let i = 0; i < rects.length; i += 1) {
      const r = rects[i];
      if (r.width <= 0.5 || r.height <= 0.5) continue;
      if (writingMode === 'horizontal') {
        rawRects.push({
          primaryStart: r.top - box.top,
          primaryEnd: r.bottom - box.top,
          crossStart: r.left - box.left,
          crossEnd: r.right - box.left,
          thickness: r.height,
        });
      } else {
        rawRects.push({
          primaryStart: r.left - box.left,
          primaryEnd: r.right - box.left,
          crossStart: r.top - box.top,
          crossEnd: r.bottom - box.top,
          thickness: r.width,
        });
      }
    }
    textNode = walker.nextNode();
  }

  const mediaNodes = el.querySelectorAll('img, svg');
  mediaNodes.forEach((node) => {
    const r = node.getBoundingClientRect();
    if (r.width <= 1 || r.height <= 1) return;
    if (writingMode === 'horizontal') {
      rawRects.push({
        primaryStart: r.top - box.top,
        primaryEnd: r.bottom - box.top,
        crossStart: r.left - box.left,
        crossEnd: r.right - box.left,
        thickness: r.height,
      });
    } else {
      rawRects.push({
        primaryStart: r.left - box.left,
        primaryEnd: r.right - box.left,
        crossStart: r.top - box.top,
        crossEnd: r.bottom - box.top,
        thickness: r.width,
      });
    }
  });

  if (rawRects.length === 0) {
    return { boxWidth, boxHeight, lines: [] };
  }

  const medianThickness = computeMedian(
    rawRects.map((r) => r.thickness),
    18
  );
  const tolerance = Math.max(4, medianThickness * 0.45);
  const crossMax = writingMode === 'horizontal' ? boxWidth : boxHeight;
  const primaryMax = writingMode === 'horizontal' ? boxHeight : boxWidth;

  // Sort in natural reading order: top-to-bottom (horizontal) or right-to-left (vertical).
  const sortedRects = [...rawRects].sort((a, b) => {
    const ca = (a.primaryStart + a.primaryEnd) / 2;
    const cb = (b.primaryStart + b.primaryEnd) / 2;
    return writingMode === 'horizontal' ? ca - cb : cb - ca;
  });

  const clusters: Array<{
    bandStart: number;
    bandEnd: number;
    crossStart: number;
    crossEnd: number;
    centerSum: number;
    count: number;
    center: number;
  }> = [];

  for (const r of sortedRects) {
    const rectCenter = (r.primaryStart + r.primaryEnd) / 2;
    const last = clusters[clusters.length - 1];
    if (last && Math.abs(rectCenter - last.center) <= tolerance) {
      last.bandStart = Math.min(last.bandStart, r.primaryStart);
      last.bandEnd = Math.max(last.bandEnd, r.primaryEnd);
      last.crossStart = Math.min(last.crossStart, r.crossStart);
      last.crossEnd = Math.max(last.crossEnd, r.crossEnd);
      last.centerSum += rectCenter;
      last.count += 1;
      last.center = last.centerSum / last.count;
    } else {
      clusters.push({
        bandStart: r.primaryStart,
        bandEnd: r.primaryEnd,
        crossStart: r.crossStart,
        crossEnd: r.crossEnd,
        centerSum: rectCenter,
        count: 1,
        center: rectCenter,
      });
    }
  }

  const lines: LineBand[] = clusters.map((c) => ({
    sliceStart: 0,
    sliceEnd: primaryMax,
    crossStart: Math.max(0, c.crossStart - 6),
    crossEnd: Math.min(crossMax, c.crossEnd + 10),
    bandStart: c.bandStart,
    bandEnd: c.bandEnd,
    center: c.center,
  }));

  if (lines.length === 1) {
    lines[0].sliceStart = 0;
    lines[0].sliceEnd = primaryMax;
    return { boxWidth, boxHeight, lines };
  }

  // Split inter-line boundaries so furigana (<rt>) remains grouped with its own base line.
  if (writingMode === 'horizontal') {
    lines[0].sliceStart = 0;
    for (let i = 0; i < lines.length - 1; i += 1) {
      const prev = lines[i];
      const next = lines[i + 1];
      const rawCut = prev.bandEnd + (next.bandStart - prev.bandEnd) * 0.15;
      const clampedCut = Math.max(prev.sliceStart, Math.min(primaryMax, rawCut));
      prev.sliceEnd = clampedCut;
      next.sliceStart = clampedCut;
    }
    lines[lines.length - 1].sliceEnd = primaryMax;
  } else {
    // Vertical RTL: lines[0] is rightmost (up to boxWidth), lines[last] is leftmost (down to 0).
    // Furigana (<rt>) sits to the RIGHT of its base column, near next.bandEnd in the gap.
    lines[0].sliceEnd = primaryMax;
    for (let i = 0; i < lines.length - 1; i += 1) {
      const prev = lines[i];
      const next = lines[i + 1];
      const rawCut = prev.bandStart - (prev.bandStart - next.bandEnd) * 0.15;
      const clampedCut = Math.min(prev.sliceEnd, Math.max(0, rawCut));
      prev.sliceStart = clampedCut;
      next.sliceEnd = clampedCut;
    }
    lines[lines.length - 1].sliceStart = 0;
  }

  return { boxWidth, boxHeight, lines };
}

function easeOutCubic(p: number): number {
  const inv = 1 - p;
  return 1 - inv * inv * inv;
}

function easeInOutQuad(p: number): number {
  return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
}

function buildActiveLineGradient(
  style: VnAnimationStyle,
  writingMode: 'horizontal' | 'vertical',
  line: LineBand,
  progress: number
): string {
  const p = Math.max(0, Math.min(1, progress));
  const dir = writingMode === 'horizontal' ? 'to right' : 'to bottom';
  const span = Math.max(1, line.crossEnd - line.crossStart);

  if (style === 'typewriter') {
    const headPx = line.crossStart + span * p;
    const solidEnd = Math.max(0, headPx - 4);
    const fadeEnd = headPx + 2;
    return `linear-gradient(${dir}, #000 0px, #000 ${solidEnd.toFixed(1)}px, rgba(0,0,0,0) ${fadeEnd.toFixed(1)}px)`;
  }

  if (style === 'slide') {
    const t = easeOutCubic(p);
    const feather = Math.min(56, Math.max(24, span * 0.18));
    const travelEnd = line.crossEnd + feather;
    const headPx = line.crossStart + (travelEnd - line.crossStart) * t;
    const solidEnd = Math.max(0, headPx - feather);
    return `linear-gradient(${dir}, #000 0px, #000 ${solidEnd.toFixed(1)}px, rgba(0,0,0,0) ${headPx.toFixed(1)}px)`;
  }

  if (style === 'blur-in') {
    const alpha = easeInOutQuad(p);
    const feather = Math.min(96, Math.max(36, span * 0.28));
    const headPx = line.crossStart + (line.crossEnd + feather - line.crossStart) * alpha;
    const solidEnd = Math.max(0, headPx - feather);
    const peakAlpha = Math.min(1, alpha * 1.15).toFixed(3);
    const tailAlpha = Math.max(0, (alpha - 0.35) / 0.65).toFixed(3);
    return `linear-gradient(${dir}, rgba(0,0,0,${peakAlpha}) 0px, rgba(0,0,0,${peakAlpha}) ${solidEnd.toFixed(1)}px, rgba(0,0,0,${tailAlpha}) ${headPx.toFixed(1)}px)`;
  }

  // 'fade-up' default: soft smooth line fade across active slice band
  const alpha = easeOutCubic(p).toFixed(3);
  if (writingMode === 'horizontal') {
    const leadAlpha = Math.max(0, easeOutCubic(Math.min(1, p * 1.15))).toFixed(3);
    return `linear-gradient(to top, rgba(0,0,0,${alpha}) 0%, rgba(0,0,0,${leadAlpha}) 100%)`;
  }
  return `linear-gradient(to left, rgba(0,0,0,${alpha}) 0%, rgba(0,0,0,${alpha}) 100%)`;
}

function applyMaskFrame(
  plan: ElementRevealPlan,
  activeLineIdx: number,
  progress: number,
  style: VnAnimationStyle,
  writingMode: 'horizontal' | 'vertical'
): void {
  const { el, boxWidth, boxHeight, lines } = plan;
  el.style.opacity = '';

  const line = lines[activeLineIdx];
  if (!line) {
    clearElementRevealStyles(el);
    return;
  }

  const images: string[] = [];
  const positions: string[] = [];
  const sizes: string[] = [];

  if (writingMode === 'horizontal') {
    if (activeLineIdx > 0 && line.sliceStart > 0) {
      images.push('linear-gradient(#000, #000)');
      positions.push('0px 0px');
      sizes.push(`100% ${line.sliceStart.toFixed(1)}px`);
    }
    const bandHeight = Math.max(1, line.sliceEnd - line.sliceStart);
    images.push(buildActiveLineGradient(style, writingMode, line, progress));
    positions.push(`0px ${line.sliceStart.toFixed(1)}px`);
    sizes.push(`100% ${bandHeight.toFixed(1)}px`);
  } else {
    if (activeLineIdx > 0 && line.sliceEnd < boxWidth) {
      const finishedWidth = Math.max(0, boxWidth - line.sliceEnd);
      if (finishedWidth > 0.5) {
        images.push('linear-gradient(#000, #000)');
        positions.push(`${line.sliceEnd.toFixed(1)}px 0px`);
        sizes.push(`${finishedWidth.toFixed(1)}px ${boxHeight.toFixed(1)}px`);
      }
    }
    const bandWidth = Math.max(1, line.sliceEnd - line.sliceStart);
    images.push(buildActiveLineGradient(style, writingMode, line, progress));
    positions.push(`${line.sliceStart.toFixed(1)}px 0px`);
    sizes.push(`${bandWidth.toFixed(1)}px 100%`);
  }

  setElementMaskLayers(el, images, positions, sizes);
}

/**
 * Reveals one or more Japanese text elements strictly line-by-line (top-to-bottom for
 * horizontal writing mode, right-to-left for vertical writing mode) without injecting
 * wrapper spans so Yomitan popup lookups remain completely intact.
 */
export function startLineByLineReveal(
  elements: HTMLElement[],
  options: VnRevealOptions
): VnRevealController {
  const { style, writingMode, durationPerLineMs, onComplete } = options;

  if (elements.length === 0 || style === 'none' || durationPerLineMs <= 0) {
    elements.forEach(clearElementRevealStyles);
    onComplete?.();
    return {
      finishNow: () => {},
      cancel: () => {},
      isRunning: () => false,
    };
  }

  const plans: ElementRevealPlan[] = elements.map((el) => {
    // Ensure accurate measurement before hiding waiting elements
    clearElementRevealStyles(el);
    const measured = measureElementLines(el, writingMode);
    return {
      el,
      boxWidth: measured.boxWidth,
      boxHeight: measured.boxHeight,
      lines: measured.lines,
    };
  });

  // Build sequential timeline across elements and lines
  const stepMs = Math.max(40, durationPerLineMs);
  interface LineStep {
    planIndex: number;
    lineIndex: number;
    startMs: number;
    endMs: number;
  }
  const steps: LineStep[] = [];
  let cursorMs = 0;

  plans.forEach((plan, planIndex) => {
    if (plan.lines.length === 0) return;
    plan.lines.forEach((_, lineIndex) => {
      steps.push({
        planIndex,
        lineIndex,
        startMs: cursorMs,
        endMs: cursorMs + stepMs,
      });
      cursorMs += stepMs;
    });
  });

  if (steps.length === 0) {
    elements.forEach(clearElementRevealStyles);
    onComplete?.();
    return {
      finishNow: () => {},
      cancel: () => {},
      isRunning: () => false,
    };
  }

  // Synchronously hide waiting elements & apply frame 0 mask before browser paints
  const firstStep = steps[0];
  plans.forEach((plan, idx) => {
    if (idx === firstStep.planIndex) {
      applyMaskFrame(plan, firstStep.lineIndex, 0, style, writingMode);
    } else if (plan.lines.length > 0) {
      plan.el.style.opacity = '0';
    }
  });

  let rafId: number | null = null;
  let startTime: number | null = null;
  let running = true;
  let lastCompletedPlan = -1;

  const cleanupAll = () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    elements.forEach(clearElementRevealStyles);
    running = false;
  };

  const finishNow = () => {
    if (!running) return;
    cleanupAll();
    onComplete?.();
  };

  const cancel = () => {
    if (!running) return;
    cleanupAll();
  };

  const tick = (now: number) => {
    if (!running) return;
    if (startTime === null) {
      startTime = now;
    }
    const elapsed = now - startTime;

    if (elapsed >= cursorMs) {
      cleanupAll();
      onComplete?.();
      return;
    }

    // Find current active step
    let currentIdx = Math.min(steps.length - 1, Math.floor(elapsed / stepMs));
    while (currentIdx < steps.length - 1 && elapsed >= steps[currentIdx].endMs) {
      currentIdx += 1;
    }
    while (currentIdx > 0 && elapsed < steps[currentIdx].startMs) {
      currentIdx -= 1;
    }

    const active = steps[currentIdx];

    // Reveal fully completed prior elements cleanly without masks
    while (lastCompletedPlan + 1 < active.planIndex) {
      lastCompletedPlan += 1;
      clearElementRevealStyles(plans[lastCompletedPlan].el);
    }

    const stepElapsed = Math.max(0, elapsed - active.startMs);
    const p = Math.min(1, stepElapsed / stepMs);
    applyMaskFrame(
      plans[active.planIndex],
      active.lineIndex,
      p,
      style,
      writingMode
    );

    rafId = requestAnimationFrame(tick);
  };

  rafId = requestAnimationFrame(tick);

  return {
    finishNow,
    cancel,
    isRunning: () => running,
  };
}
