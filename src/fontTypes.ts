export interface EmbeddedFont {
  family: string;
  weight: string;
  style: 'normal' | 'italic';
  data: string;
}
export interface CatalogFont {
  id: string;
  family: string;
  category: string;
  weights: number[];
  styles: string[];
  subsets: string[];
  defSubset: string;
}
export const fontKey = (font: Pick<EmbeddedFont, 'family' | 'weight' | 'style'>) =>
  `${font.family}:${font.weight}:${font.style}`;
export const safeFontFamily = (name: unknown): name is string =>
  typeof name === 'string' &&
  name.length > 0 &&
  name.length <= 100 &&
  /^[\p{L}\p{N} ._+()-]+$/u.test(name);
export function validEmbeddedFont(value: unknown): value is EmbeddedFont {
  if (!value || typeof value !== 'object') return false;
  const f = value as EmbeddedFont;
  return (
    safeFontFamily(f.family) &&
    typeof f.weight === 'string' &&
    /^(?:[1-9]\d{0,2}|1000)(?: (?:[1-9]\d{0,2}|1000))?$/.test(f.weight) &&
    ['normal', 'italic'].includes(f.style) &&
    typeof f.data === 'string' &&
    f.data.length < 15000000 &&
    /^data:font\/(woff2?|ttf|otf|sfnt);base64,[a-z0-9+/=]+$/i.test(f.data)
  );
}
