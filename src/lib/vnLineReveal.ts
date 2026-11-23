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

type CollectedUnit =
  | { kind: 'element'; node: HTMLElement }
  | { kind: 'text'; node: Text };

interface MeasuredUnit {
  kind: 'element' | 'text-slice';
  el?: HTMLElement;
  textNode?: Text;
  start: number;
  end: number;
  primaryCenter: number;
  crossCenter: number;
  thickness: number;
}

interface TextSegmentSpec {
  start: number;
  end: number;
  revealAtMs: number;
  transitionCss: string;
}

interface DirectElementRestore {
  el: HTMLElement;
  prevOpacity: string;
  prevTransition: string;
  prevWillChange: string;
}

interface RevealEntry {
  target: HTMLElement;
  revealAtMs: number;
}

function getCodepointOffsets(text: string): number[] {
  const offsets: number[] = [0];
  for (let i = 0; i < text.length; ) {
    const code = text.charCodeAt(i);
    i += code >= 0xd800 && code <= 0xdbff && i + 1 < text.length ? 2 : 1;
    offsets.push(i);
  }
  return offsets;
}

function getRectMetrics(
  rect: DOMRect,
  writingMode: 'horizontal' | 'vertical'
): { primaryCenter: number; crossCenter: number; thickness: number } {
  if (writingMode === 'horizontal') {
    return {
      primaryCenter: (rect.top + rect.bottom) / 2,
      crossCenter: (rect.left + rect.right) / 2,
      thickness: rect.height,
    };
  }
  return {
    primaryCenter: (rect.left + rect.right) / 2,
    crossCenter: (rect.top + rect.bottom) / 2,
    thickness: rect.width,
  };
}

function computeMedian(values: number[], fallback: number): number {
  if (values.length === 0) return fallback;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function collectAtomicUnits(root: HTMLElement): CollectedUnit[] {
  const units: CollectedUnit[] = [];
  const doc = root.ownerDocument;
  const TEXT_NODE = doc.defaultView?.Node.TEXT_NODE ?? 3;
  const ELEMENT_NODE = doc.defaultView?.Node.ELEMENT_NODE ?? 1;

  const walk = (node: Node) => {
    const children = node.childNodes;
    for (let i = 0; i < children.length; i += 1) {
      const child = children[i];
      if (child.nodeType === TEXT_NODE) {
        const textNode = child as Text;
        if (textNode.data && textNode.data.trim().length > 0) {
          units.push({ kind: 'text', node: textNode });
        }
        continue;
      }
      if (child.nodeType === ELEMENT_NODE) {
        const el = child as HTMLElement;
        const tag = el.tagName.toUpperCase();
        if (tag === 'RT' || tag === 'RP' || tag === 'SCRIPT' || tag === 'STYLE') {
          continue;
        }
        if (tag === 'RUBY' || tag === 'IMG' || tag === 'SVG') {
          units.push({ kind: 'element', node: el });
          continue;
        }
        walk(el);
      }
    }
  };

  walk(root);
  return units;
}

function measureVisibleCodepoint(
  textNode: Text,
  range: Range,
  cpOffsets: number[],
  cpIndex: number,
  minCp: number,
  maxCp: number,
  writingMode: 'horizontal' | 'vertical'
): { primaryCenter: number; crossCenter: number; thickness: number } | null {
  const tryIdx = (idx: number): DOMRect | null => {
    range.setStart(textNode, cpOffsets[idx]);
    range.setEnd(textNode, cpOffsets[idx + 1]);
    const rect = range.getBoundingClientRect();
    return rect.width > 0.4 || rect.height > 0.4 ? rect : null;
  };

  const direct = tryIdx(cpIndex);
  if (direct) return getRectMetrics(direct, writingMode);

  const maxDist = Math.max(cpIndex - minCp, maxCp - cpIndex);
  for (let d = 1; d <= maxDist; d += 1) {
    if (cpIndex + d <= maxCp) {
      const r = tryIdx(cpIndex + d);
      if (r) return getRectMetrics(r, writingMode);
    }
    if (cpIndex - d >= minCp) {
      const r = tryIdx(cpIndex - d);
      if (r) return getRectMetrics(r, writingMode);
    }
  }
  return null;
}

function measureVisualRuns(
  root: HTMLElement,
  writingMode: 'horizontal' | 'vertical'
): MeasuredUnit[] {
  const collected = collectAtomicUnits(root);
  if (collected.length === 0) return [];

  const doc = root.ownerDocument;
  const range = doc.createRange();
  const measured: MeasuredUnit[] = [];

  for (const unit of collected) {
    if (unit.kind === 'element') {
      const r = unit.node.getBoundingClientRect();
      if (r.width <= 0.5 || r.height <= 0.5) continue;
      const metrics = getRectMetrics(r, writingMode);
      measured.push({
        kind: 'element',
        el: unit.node,
        start: 0,
        end: 0,
        ...metrics,
      });
      continue;
    }

    const textNode = unit.node;
    range.selectNodeContents(textNode);
    const rects = range.getClientRects();
    if (rects.length === 0) continue;

    if (rects.length === 1) {
      const r = rects[0];
      if (r.width <= 0.5 && r.height <= 0.5) continue;
      const metrics = getRectMetrics(r, writingMode);
      measured.push({
        kind: 'text-slice',
        textNode,
        start: 0,
        end: textNode.data.length,
        ...metrics,
      });
      continue;
    }

    // Split wrapped Text node along visual line breaks via binary search on codepoint bounds
    const cpOffsets = getCodepointOffsets(textNode.data);
    const cpCount = cpOffsets.length - 1;
    let curCp = 0;

    while (curCp < cpCount) {
      const firstMetrics = measureVisibleCodepoint(
        textNode,
        range,
        cpOffsets,
        curCp,
        curCp,
        cpCount - 1,
        writingMode
      );
      if (!firstMetrics) {
        curCp += 1;
        continue;
      }

      const splitTol = Math.max(6, firstMetrics.thickness * 0.5);
      let lo = curCp;
      let hi = cpCount - 1;
      let best = curCp;

      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const probe = measureVisibleCodepoint(
          textNode,
          range,
          cpOffsets,
          mid,
          curCp,
          hi,
          writingMode
        );
        if (
          !probe ||
          Math.abs(probe.primaryCenter - firstMetrics.primaryCenter) <= splitTol
        ) {
          best = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }

      const endCp = Math.max(curCp + 1, best + 1);
      const startOff = cpOffsets[curCp];
      const endOff = cpOffsets[endCp];
      const lastMetrics = measureVisibleCodepoint(
        textNode,
        range,
        cpOffsets,
        endCp - 1,
        curCp,
        endCp - 1,
        writingMode
      );
      const sliceCrossCenter = lastMetrics
        ? (firstMetrics.crossCenter + lastMetrics.crossCenter) / 2
        : firstMetrics.crossCenter;

      if (textNode.data.slice(startOff, endOff).length > 0) {
        measured.push({
          kind: 'text-slice',
          textNode,
          start: startOff,
          end: endOff,
          primaryCenter: firstMetrics.primaryCenter,
          crossCenter: sliceCrossCenter,
          thickness: firstMetrics.thickness,
        });
      }

      curCp = endCp;
    }
  }

  return measured;
}

function buildCodepointChunks(
  text: string,
  startOff: number,
  endOff: number,
  chunkSize: number
): Array<{ start: number; end: number }> {
  const sub = text.slice(startOff, endOff);
  const cpOffsets = getCodepointOffsets(sub);
  const totalCp = cpOffsets.length - 1;
  if (totalCp <= 0) return [];

  const chunks: Array<{ start: number; end: number }> = [];
  for (let i = 0; i < totalCp; i += chunkSize) {
    const nextCp = Math.min(totalCp, i + chunkSize);
    chunks.push({
      start: startOff + cpOffsets[i],
      end: startOff + cpOffsets[nextCp],
    });
  }
  return chunks;
}

/**
 * Reveals Japanese VN paragraphs strictly one visual line (horizontal) or
 * one column (vertical right-to-left) at a time using pure GPU opacity
 * transitions — zero CSS clip-path or mask-image — then unwraps back to
 * native pristine EPUB DOM so Yomitan lookups stay 100% intact.
 */
export function startLineByLineReveal(
  elements: HTMLElement[],
  options: VnRevealOptions
): VnRevealController {
  const { style, writingMode, durationPerLineMs, onComplete } = options;

  if (elements.length === 0 || style === 'none' || durationPerLineMs <= 0) {
    onComplete?.();
    return {
      finishNow: () => {},
      cancel: () => {},
      isRunning: () => false,
    };
  }

  const allMeasuredPerElement = elements.map((el) =>
    measureVisualRuns(el, writingMode)
  );
  const allUnitsFlat = allMeasuredPerElement.flat();

  if (allUnitsFlat.length === 0) {
    onComplete?.();
    return {
      finishNow: () => {},
      cancel: () => {},
      isRunning: () => false,
    };
  }

  const medianThickness = computeMedian(
    allUnitsFlat.map((u) => u.thickness).filter((v) => v > 0),
    18
  );
  const tolerance = Math.max(4, medianThickness * 0.45);

  const elementLineGroups: MeasuredUnit[][][] = allMeasuredPerElement.map(
    (units) => {
      if (units.length === 0) return [];
      const sortedPrimary = [...units].sort((a, b) =>
        writingMode === 'horizontal'
          ? a.primaryCenter - b.primaryCenter
          : b.primaryCenter - a.primaryCenter
      );

      const clusters: Array<{
        centerSum: number;
        count: number;
        center: number;
        items: MeasuredUnit[];
      }> = [];

      for (const u of sortedPrimary) {
        const last = clusters[clusters.length - 1];
        if (last && Math.abs(u.primaryCenter - last.center) <= tolerance) {
          last.items.push(u);
          last.centerSum += u.primaryCenter;
          last.count += 1;
          last.center = last.centerSum / last.count;
        } else {
          clusters.push({
            centerSum: u.primaryCenter,
            count: 1,
            center: u.primaryCenter,
            items: [u],
          });
        }
      }

      return clusters.map((c) =>
        c.items.sort((a, b) => a.crossCenter - b.crossCenter)
      );
    }
  );

  const flatLines: MeasuredUnit[][] = elementLineGroups.flat();
  if (flatLines.length === 0) {
    onComplete?.();
    return {
      finishNow: () => {},
      cancel: () => {},
      isRunning: () => false,
    };
  }

  const stepMs = Math.max(40, durationPerLineMs);
  const textNodeSpecs = new Map<Text, TextSegmentSpec[]>();
  const directRestores: DirectElementRestore[] = [];
  const entries: RevealEntry[] = [];

  const transitionTailMs =
    style === 'fade-up'
      ? stepMs
      : style === 'blur-in'
        ? Math.round(stepMs * 1.15)
        : style === 'slide'
          ? Math.min(220, Math.max(60, Math.round(stepMs * 0.45)))
          : 0;

  const isChunked = style === 'typewriter' || style === 'slide';

  flatLines.forEach((lineUnits, lineIdx) => {
    const lineStartMs = lineIdx * stepMs;

    if (!isChunked) {
      const transitionCss =
        style === 'blur-in'
          ? `opacity ${Math.round(stepMs * 1.15)}ms cubic-bezier(0.37, 0, 0.63, 1)`
          : `opacity ${stepMs}ms cubic-bezier(0.22, 1, 0.36, 1)`;

      for (const u of lineUnits) {
        if (u.kind === 'element' && u.el) {
          directRestores.push({
            el: u.el,
            prevOpacity: u.el.style.opacity,
            prevTransition: u.el.style.transition,
            prevWillChange: u.el.style.willChange,
          });
          u.el.style.willChange = 'opacity';
          u.el.style.transition = transitionCss;
          u.el.style.opacity = '0';
          entries.push({ target: u.el, revealAtMs: lineStartMs });
        } else if (u.kind === 'text-slice' && u.textNode) {
          const list = textNodeSpecs.get(u.textNode) ?? [];
          list.push({
            start: u.start,
            end: u.end,
            revealAtMs: lineStartMs,
            transitionCss,
          });
          textNodeSpecs.set(u.textNode, list);
        }
      }
      return;
    }

    // Chunked character/word sweep strictly along lineIdx
    const lineTotalChars = lineUnits.reduce(
      (sum, u) =>
        sum + (u.kind === 'element' ? 2 : Math.max(0, u.end - u.start)),
      0
    );
    const chunkSize =
      style === 'typewriter'
        ? Math.max(1, Math.ceil(lineTotalChars / 28))
        : Math.max(2, Math.ceil(lineTotalChars / 16));
    const transitionCss =
      style === 'slide'
        ? `opacity ${Math.min(220, Math.max(60, Math.round(stepMs * 0.45)))}ms ease-out`
        : '';

    const pendingChunks: Array<
      | { kind: 'element'; el: HTMLElement }
      | { kind: 'text'; textNode: Text; start: number; end: number }
    > = [];

    for (const u of lineUnits) {
      if (u.kind === 'element' && u.el) {
        pendingChunks.push({ kind: 'element', el: u.el });
      } else if (u.kind === 'text-slice' && u.textNode) {
        const subChunks = buildCodepointChunks(
          u.textNode.data,
          u.start,
          u.end,
          chunkSize
        );
        for (const ch of subChunks) {
          pendingChunks.push({
            kind: 'text',
            textNode: u.textNode,
            start: ch.start,
            end: ch.end,
          });
        }
      }
    }

    const totalChunks = Math.max(1, pendingChunks.length);
    pendingChunks.forEach((chunk, chunkIdx) => {
      const chunkDelayMs =
        lineStartMs + (chunkIdx / totalChunks) * (stepMs * 0.92);
      if (chunk.kind === 'element') {
        directRestores.push({
          el: chunk.el,
          prevOpacity: chunk.el.style.opacity,
          prevTransition: chunk.el.style.transition,
          prevWillChange: chunk.el.style.willChange,
        });
        chunk.el.style.willChange = 'opacity';
        if (transitionCss) chunk.el.style.transition = transitionCss;
        chunk.el.style.opacity = '0';
        entries.push({ target: chunk.el, revealAtMs: chunkDelayMs });
      } else {
        const list = textNodeSpecs.get(chunk.textNode) ?? [];
        list.push({
          start: chunk.start,
          end: chunk.end,
          revealAtMs: chunkDelayMs,
          transitionCss,
        });
        textNodeSpecs.set(chunk.textNode, list);
      }
    });
  });

  // Wrap text slices in-place right-to-left so earlier UTF-16 offsets stay exact
  const createdSpans: HTMLSpanElement[] = [];

  textNodeSpecs.forEach((specs, textNode) => {
    const parent = textNode.parentNode;
    if (!parent) return;
    const doc = textNode.ownerDocument;
    const sortedDesc = [...specs].sort((a, b) => b.start - a.start);

    for (const spec of sortedDesc) {
      if (spec.end <= spec.start || spec.start >= textNode.data.length) continue;

      let targetNode: Text;
      if (spec.start > 0) {
        targetNode = textNode.splitText(spec.start);
      } else {
        targetNode = textNode;
      }

      const len = spec.end - spec.start;
      if (len < targetNode.data.length) {
        targetNode.splitText(len);
      }

      const span = doc.createElement('span');
      span.setAttribute('data-vn-seg', '1');
      span.style.opacity = '0';
      if (spec.transitionCss) {
        span.style.willChange = 'opacity';
        span.style.transition = spec.transitionCss;
      }

      const targetParent = targetNode.parentNode;
      if (!targetParent) continue;
      targetParent.replaceChild(span, targetNode);
      span.appendChild(targetNode);
      createdSpans.push(span);
      entries.push({ target: span, revealAtMs: spec.revealAtMs });
    }
  });

  if (entries.length === 0) {
    onComplete?.();
    return {
      finishNow: () => {},
      cancel: () => {},
      isRunning: () => false,
    };
  }

  entries.sort((a, b) => a.revealAtMs - b.revealAtMs);

  let rafId: number | null = null;
  let startTime: number | null = null;
  let nextIdx = 0;
  let running = true;
  const finishAtMs = flatLines.length * stepMs + transitionTailMs + 30;

  const restoreAllDom = () => {
    for (const r of directRestores) {
      r.el.style.opacity = r.prevOpacity;
      r.el.style.transition = r.prevTransition;
      r.el.style.willChange = r.prevWillChange;
    }

    for (let i = createdSpans.length - 1; i >= 0; i -= 1) {
      const span = createdSpans[i];
      const parent = span.parentNode;
      if (!parent) continue;
      while (span.firstChild) {
        parent.insertBefore(span.firstChild, span);
      }
      parent.removeChild(span);
    }

    for (const rootEl of elements) {
      try {
        rootEl.normalize();
      } catch {
        // ignore detached elements
      }
    }
  };

  const cleanup = () => {
    running = false;
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    restoreAllDom();
  };

  const tick = (now: number) => {
    if (!running) return;
    // Frame 0 only anchors startTime so browsers commit initial opacity: 0 before transitioning
    if (startTime === null) {
      startTime = now;
      rafId = requestAnimationFrame(tick);
      return;
    }

    const elapsed = now - startTime;
    while (nextIdx < entries.length && elapsed >= entries[nextIdx].revealAtMs) {
      entries[nextIdx].target.style.opacity = '1';
      nextIdx += 1;
    }

    if (elapsed >= finishAtMs && nextIdx >= entries.length) {
      cleanup();
      onComplete?.();
      return;
    }

    rafId = requestAnimationFrame(tick);
  };

  rafId = requestAnimationFrame(tick);

  return {
    finishNow: () => {
      if (!running) return;
      cleanup();
      onComplete?.();
    },
    cancel: () => {
      if (!running) return;
      cleanup();
    },
    isRunning: () => running,
  };
}
