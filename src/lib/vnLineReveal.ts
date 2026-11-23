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
  el.style.clipPath = '';
  el.style.transform = '';
  el.style.willChange = '';
  el.style.contain = '';
  el.style.removeProperty('-webkit-clip-path');
  el.style.maskImage = '';
  el.style.maskPosition = '';
  el.style.maskSize = '';
  el.style.maskRepeat = '';
  el.style.removeProperty('-webkit-mask-image');
  el.style.removeProperty('-webkit-mask-position');
  el.style.removeProperty('-webkit-mask-size');
  el.style.removeProperty('-webkit-mask-repeat');
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

function buildHorizontalStaircasePolygon(
  W: number,
  y1: number,
  y2: number,
  x: number
): string {
  const cy1 = y1.toFixed(1);
  const cy2 = y2.toFixed(1);
  const cx = Math.max(0, Math.min(W, x)).toFixed(1);
  return `polygon(0px 0px, ${W}px 0px, ${W}px ${cy1}px, ${cx}px ${cy1}px, ${cx}px ${cy2}px, 0px ${cy2}px)`;
}

function buildVerticalStaircasePolygon(
  W: number,
  H: number,
  x1: number,
  x2: number,
  y: number
): string {
  const cx1 = Math.max(0, Math.min(W, x1)).toFixed(1);
  const cx2 = Math.max(0, Math.min(W, x2)).toFixed(1);
  const cy = Math.max(0, Math.min(H, y)).toFixed(1);
  return `polygon(${cx1}px 0px, ${W}px 0px, ${W}px ${H}px, ${cx2}px ${H}px, ${cx2}px ${cy}px, ${cx1}px ${cy}px)`;
}

function buildLineKeyframes(
  plan: ElementRevealPlan,
  style: Exclude<VnAnimationStyle, 'none'>,
  writingMode: 'horizontal' | 'vertical'
): Keyframe[] {
  const { boxWidth, boxHeight, lines } = plan;
  const count = lines.length;
  const W = Math.max(2, Math.ceil(boxWidth) + 2);
  const H = Math.max(2, Math.ceil(boxHeight) + 2);

  if (style === 'fade-up') {
    const keyframes: Keyframe[] = [];
    if (writingMode === 'horizontal') {
      keyframes.push({
        offset: 0,
        clipPath: `inset(0px 0px ${H}px 0px)`,
        opacity: 0.35,
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      });
      for (let i = 0; i < count; i += 1) {
        const bottomClip =
          i === count - 1
            ? 0
            : Math.max(0, Math.ceil(H - lines[i].sliceEnd));
        keyframes.push({
          offset: i === count - 1 ? 1 : (i + 1) / count,
          clipPath: `inset(0px 0px ${bottomClip}px 0px)`,
          opacity: 1,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        });
      }
    } else {
      keyframes.push({
        offset: 0,
        clipPath: `inset(0px 0px 0px ${W}px)`,
        opacity: 0.35,
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      });
      for (let i = 0; i < count; i += 1) {
        const leftClip =
          i === count - 1 ? 0 : Math.max(0, Math.floor(lines[i].sliceStart));
        keyframes.push({
          offset: i === count - 1 ? 1 : (i + 1) / count,
          clipPath: `inset(0px 0px 0px ${leftClip}px)`,
          opacity: 1,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        });
      }
    }
    return keyframes;
  }

  const lineEasing =
    style === 'typewriter'
      ? 'linear'
      : style === 'slide'
        ? 'cubic-bezier(0.22, 1, 0.36, 1)'
        : 'cubic-bezier(0.37, 0, 0.63, 1)';

  const keyframes: Keyframe[] = [];
  for (let i = 0; i < count; i += 1) {
    const line = lines[i];
    const startOffset = i === 0 ? 0 : i / count;
    const endOffset = i === count - 1 ? 1 : (i + 1) / count;
    const crossMax = writingMode === 'horizontal' ? W : H;
    const startCross = line.crossStart;
    const endCross =
      i === count - 1 ? crossMax : Math.min(crossMax, line.crossEnd);

    const startPoly =
      writingMode === 'horizontal'
        ? buildHorizontalStaircasePolygon(
            W,
            line.sliceStart,
            i === count - 1 ? H : line.sliceEnd,
            startCross
          )
        : buildVerticalStaircasePolygon(
            W,
            H,
            i === count - 1 ? 0 : line.sliceStart,
            line.sliceEnd,
            startCross
          );

    const endPoly =
      writingMode === 'horizontal'
        ? buildHorizontalStaircasePolygon(
            W,
            line.sliceStart,
            i === count - 1 ? H : line.sliceEnd,
            endCross
          )
        : buildVerticalStaircasePolygon(
            W,
            H,
            i === count - 1 ? 0 : line.sliceStart,
            line.sliceEnd,
            endCross
          );

    const startFrame: Keyframe = {
      offset: startOffset,
      clipPath: startPoly,
      easing: lineEasing,
    };
    const endFrame: Keyframe = {
      offset: endOffset,
      clipPath: endPoly,
    };

    if (style === 'blur-in') {
      startFrame.opacity = i === 0 ? 0.2 : 1;
      endFrame.opacity = 1;
    } else if (style === 'slide') {
      startFrame.transform =
        i === 0
          ? writingMode === 'horizontal'
            ? 'translate3d(10px, 0, 0)'
            : 'translate3d(0, -10px, 0)'
          : 'translate3d(0, 0, 0)';
      endFrame.transform = 'translate3d(0, 0, 0)';
    }

    keyframes.push(startFrame, endFrame);
  }

  return keyframes;
}

/**
 * Reveals one or more Japanese text elements strictly line-by-line (top-to-bottom for
 * horizontal writing mode, right-to-left for vertical writing mode) using GPU-composited
 * Web Animations API clip-path with zero per-frame JS work and zero wrapper spans so
 * Yomitan popup lookups stay 100% intact.
 */
export function startLineByLineReveal(
  elements: HTMLElement[],
  options: VnRevealOptions
): VnRevealController {
  const { style, writingMode, durationPerLineMs, onComplete } = options;

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (
    elements.length === 0 ||
    style === 'none' ||
    durationPerLineMs <= 0 ||
    prefersReducedMotion ||
    typeof elements[0]?.animate !== 'function'
  ) {
    elements.forEach(clearElementRevealStyles);
    onComplete?.();
    return {
      finishNow: () => {},
      cancel: () => {},
      isRunning: () => false,
    };
  }

  const plans: ElementRevealPlan[] = elements.map((el) => {
    clearElementRevealStyles(el);
    const measured = measureElementLines(el, writingMode);
    return {
      el,
      boxWidth: measured.boxWidth,
      boxHeight: measured.boxHeight,
      lines: measured.lines,
    };
  });

  const activePlans = plans.filter((p) => p.lines.length > 0);
  if (activePlans.length === 0) {
    elements.forEach(clearElementRevealStyles);
    onComplete?.();
    return {
      finishNow: () => {},
      cancel: () => {},
      isRunning: () => false,
    };
  }

  const stepMs = Math.max(40, durationPerLineMs);
  const animations: Animation[] = [];
  let cursorMs = 0;
  let running = true;

  const cancelAllAnimations = () => {
    for (const anim of animations) {
      try {
        anim.onfinish = null;
        anim.cancel();
      } catch {
        // ignore Web Animations cleanup errors
      }
    }
    animations.length = 0;
    elements.forEach(clearElementRevealStyles);
    running = false;
  };

  activePlans.forEach((plan, idx) => {
    const planDurationMs = plan.lines.length * stepMs;
    const planDelayMs = cursorMs;
    cursorMs += planDurationMs;

    const keyframes = buildLineKeyframes(plan, style, writingMode);
    plan.el.style.willChange = 'clip-path, opacity, transform';
    plan.el.style.contain = 'paint';

    const anim = plan.el.animate(keyframes, {
      duration: planDurationMs,
      delay: planDelayMs,
      fill: 'both',
    });

    const isLastPlan = idx === activePlans.length - 1;
    anim.onfinish = () => {
      try {
        anim.onfinish = null;
        anim.cancel();
      } catch {
        // ignore
      }
      clearElementRevealStyles(plan.el);
      if (isLastPlan && running) {
        running = false;
        onComplete?.();
      }
    };

    animations.push(anim);
  });

  const finishNow = () => {
    if (!running) return;
    cancelAllAnimations();
    onComplete?.();
  };

  const cancel = () => {
    if (!running) return;
    cancelAllAnimations();
  };

  return {
    finishNow,
    cancel,
    isRunning: () => running,
  };
}
