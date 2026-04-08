/** Shared chart utility functions used by weight chart and clinical benchmark chart. */

/** Generate a smooth cubic Bézier SVG path through the given points. */
export function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const cp1x = pts[i].x + (pts[i + 1].x - pts[i].x) / 3;
    const cp1y = pts[i].y;
    const cp2x = pts[i + 1].x - (pts[i + 1].x - pts[i].x) / 3;
    const cp2y = pts[i + 1].y;
    d += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${pts[i + 1].x} ${pts[i + 1].y}`;
  }
  return d;
}

/** Generate evenly-spaced Y-axis tick values rounded to a nice step. */
export function niceYTicks(minW: number, maxW: number, count = 4): number[] {
  const range = maxW - minW || 10;
  const step = Math.ceil(range / (count - 1) / 5) * 5;
  const start = Math.floor(minW / 5) * 5;
  return Array.from({ length: count }, (_, i) => start + i * step).filter(v => v <= maxW + step);
}
