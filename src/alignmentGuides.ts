export interface AlignmentBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AlignmentGuide {
  value: number;
  from: number;
  to: number;
  gap?: { start: number; end: number };
}

export interface AlignmentGuides {
  x?: AlignmentGuide;
  y?: AlignmentGuide;
}

// All measurements use document coordinates; the caller supplies a screen-scaled tolerance.
export function snapAlignment(
  moving: AlignmentBox,
  others: (AlignmentBox & { kind: string })[],
  width: number,
  height: number,
  tolerance: number,
  axis?: 'x' | 'y',
) {
  const guides: AlignmentGuides = {};
  const correction = { x: 0, y: 0 };
  for (const direction of ['x', 'y'] as const) {
    if (axis && direction !== axis) continue;
    const perpendicular = direction === 'x' ? 'y' : 'x';
    const size = direction === 'x' ? 'width' : 'height';
    const crossSize = direction === 'x' ? 'height' : 'width';
    const extent = direction === 'x' ? width : height;
    const crossExtent = direction === 'x' ? height : width;
    const start = moving[direction];
    const length = moving[size];
    const center = start + length / 2;
    let best: { delta: number; guide: AlignmentGuide; priority: number } | undefined;
    const offer = (anchor: number, value: number, guide: AlignmentGuide, priority: number) => {
      const delta = value - anchor;
      if (Math.abs(delta) > tolerance) return;
      if (!best || Math.abs(delta) < Math.abs(best.delta) - 0.001 ||
        (Math.abs(Math.abs(delta) - Math.abs(best.delta)) <= 0.001 && priority > best.priority))
        best = { delta, guide, priority };
    };

    for (const value of [0, extent / 2, extent]) {
      const anchor = value === 0 ? start : value === extent ? start + length : center;
      offer(anchor, value, { value, from: 0, to: crossExtent }, 1);
    }
    let gapStart = 0;
    let gapEnd = extent;
    for (const other of others) {
      const from = Math.min(moving[perpendicular], other[perpendicular]);
      const to = Math.max(moving[perpendicular] + moving[crossSize], other[perpendicular] + other[crossSize]);
      const anchors = [start, center, start + length];
      const values = [other[direction], other[direction] + other[size] / 2, other[direction] + other[size]];
      // Match like edges and centers, avoiding unrelated edge-to-center snapping.
      anchors.forEach((anchor, index) => {
        const value = values[index];
        offer(anchor, value, { value, from, to }, 0);
      });
      const overlapsCrossAxis = other[perpendicular] < moving[perpendicular] + moving[crossSize] &&
        other[perpendicular] + other[crossSize] > moving[perpendicular];
      if (other.kind === 'text' || !overlapsCrossAxis) continue;
      const otherEnd = other[direction] + other[size];
      if (otherEnd <= start) gapStart = Math.max(gapStart, otherEnd);
      if (other[direction] >= start + length) gapEnd = Math.min(gapEnd, other[direction]);
    }
    if ((gapStart > 0 || gapEnd < extent) && gapEnd - gapStart >= length) {
      const value = (gapStart + gapEnd) / 2;
      offer(center, value, { value, from: 0, to: crossExtent, gap: { start: gapStart, end: gapEnd } }, 2);
    }
    if (best) {
      correction[direction] = best.delta;
      guides[direction] = best.guide;
    }
  }
  return { ...correction, guides };
}
