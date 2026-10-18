export type VectorTag = 'path' | 'circle' | 'rect' | 'ellipse' | 'line' | 'polyline' | 'polygon';
export interface VectorPath {
  tag: VectorTag;
  attrs: Record<string, string | number>;
}
export function validVectorPaths(paths: unknown): paths is VectorPath[] {
  if (!Array.isArray(paths) || !paths.length || paths.length > 1000) return false;
  const tags = new Set(['path', 'circle', 'rect', 'ellipse', 'line', 'polyline', 'polygon']);
  const numeric = new Set([
    'x',
    'y',
    'width',
    'height',
    'rx',
    'ry',
    'cx',
    'cy',
    'r',
    'x1',
    'y1',
    'x2',
    'y2',
    'strokeWidth',
    'opacity',
  ]);
  return paths.every(
    (p) =>
      p &&
      tags.has(p.tag) &&
      p.attrs &&
      typeof p.attrs === 'object' &&
      !Array.isArray(p.attrs) &&
      Object.entries(p.attrs).every(([key, value]) => {
        if (numeric.has(key))
          return (
            (typeof value === 'number' || typeof value === 'string') &&
            value !== '' &&
            Number.isFinite(Number(value)) &&
            Math.abs(Number(value)) <= 1000000
          );
        if (key === 'd')
          return (
            typeof value === 'string' &&
            value.length <= 250000 &&
            /^[MmZzLlHhVvCcSsQqTtAaEe\d.,+\-\s]+$/.test(value)
          );
        if (key === 'points')
          return (
            typeof value === 'string' && value.length <= 250000 && /^[Ee\d.,+\-\s]+$/.test(value)
          );
        if (key === 'fillRule' || key === 'clipRule')
          return value === 'evenodd' || value === 'nonzero';
        if (key === 'fill' || key === 'stroke')
          return (
            typeof value === 'string' &&
            /^(none|currentColor|transparent|#[0-9a-f]{3,8})$/i.test(value)
          );
        return false;
      }),
  );
}
