import type { DesignDocument, DesignPage } from './model';
import type { CatalogFont, EmbeddedFont } from './fontTypes';
import { fontKey, validEmbeddedFont, safeFontFamily } from './fontTypes';

const native = new Set([
  'DM Sans',
  'Manrope',
  'Arial',
  'Georgia',
  'Courier New',
  'Impact',
  'Verdana',
]);
const installed = new Map<string, EmbeddedFont>();
const registeredFaces = new Map<string, FontFace>();
const pending = new Map<string, Promise<EmbeddedFont | null>>();
const actualLoads = new Map<string, Promise<EmbeddedFont>>();
let catalogPromise: Promise<CatalogFont[]> | null = null;
let manifestPromise: Promise<
  Array<{ family: string; weight: string | number; style: 'normal' | 'italic'; url: string }>
> | null = null;
let databasePromise: Promise<IDBDatabase> | null = null;
const details = new Map<string, Promise<{ npmVersion: string }>>();

export const getFontCatalog = () =>
  (catalogPromise ??= import('./data/fonts.json').then((m) => m.default as CatalogFont[]));
function database() {
  return (databasePromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open('axis-font-library', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('faces', { keyPath: 'key' });
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => {
      databasePromise = null;
      reject(r.error);
    };
  }));
}
export async function savedFontFaces(): Promise<EmbeddedFont[]> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const r = db.transaction('faces').objectStore('faces').getAll();
    r.onsuccess = () => resolve(r.result.filter(validEmbeddedFont));
    r.onerror = () => reject(r.error);
  });
}
async function cache(face: EmbeddedFont) {
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('faces', 'readwrite');
    tx.objectStore('faces').put({ ...face, key: fontKey(face) });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  window.dispatchEvent(new Event('axis-font-library-change'));
}
async function cached(key: string): Promise<EmbeddedFont | null> {
  try {
    const db = await database();
    return await new Promise((resolve) => {
      const r = db.transaction('faces').objectStore('faces').get(key);
      r.onsuccess = () => resolve(validEmbeddedFont(r.result) ? r.result : null);
      r.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}
async function register(face: EmbeddedFont): Promise<EmbeddedFont> {
  const key = fontKey(face);
  if (installed.get(key)?.data === face.data) return installed.get(key)!;
  if (!validEmbeddedFont(face)) throw new Error('O arquivo de fonte é inválido.');
  const font = new FontFace(face.family, `url("${face.data}")`, {
    weight: face.weight,
    style: face.style,
  });
  await font.load();
  const previous = registeredFaces.get(key);
  if (previous) document.fonts.delete(previous);
  document.fonts.add(font);
  registeredFaces.set(key, font);
  installed.set(key, face);
  return face;
}
export async function installDocumentFonts(faces: EmbeddedFont[] = []) {
  await Promise.all(faces.map(register));
}
async function fontData(url: string) {
  const response = await fetch(url);
  if (!response.ok)
    throw new Error('A fonte não pôde ser baixada. Verifique sua conexão e tente novamente.');
  const blob = await response.blob();
  if (blob.size > 10000000) throw new Error('O arquivo de fonte ultrapassa 10 MB.');
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).replace(/^data:[^;]*;/, 'data:font/woff2;'));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}
export async function ensureFont(
  family: string,
  weight = 400,
  style: 'normal' | 'italic' = 'normal',
  embedded: EmbeddedFont[] = [],
): Promise<EmbeddedFont | null> {
  const own = embedded.filter((f) => f.family === family);
  if (own.length) {
    await installDocumentFonts(own);
    const exact = own.find((f) => {
      const parts = f.weight.split(' ').map(Number);
      return (
        f.style === style &&
        (parts.length === 1 ? parts[0] === weight : weight >= parts[0] && weight <= parts[1])
      );
    });
    if (exact) return exact;
    if (native.has(family)) return own[0];
  }
  if (native.has(family)) {
    if (family === 'DM Sans' || family === 'Manrope')
      await document.fonts.load(`${style} ${weight} 48px "${family}"`);
    return null;
  }
  const requestKey = `${family}:${weight}:${style}`;
  if (!pending.has(requestKey))
    pending.set(
      requestKey,
      (async () => {
        const existing = await savedFontFaces().catch(() => []);
        const custom = existing.filter((f) => f.family === family);
        const catalog = await getFontCatalog();
        const font = catalog.find((f) => f.family === family);
        if (!font) {
          const pool = [...own, ...custom];
          if (pool.length) return register(pool.find((f) => f.style === style) ?? pool[0]);
          throw new Error('Esta fonte não está disponível. Importe o arquivo original da fonte.');
        }
        const chosenWeight = font.weights.reduce(
          (a, b) => (Math.abs(a - weight) <= Math.abs(b - weight) ? a : b),
          font.weights[0] ?? 400,
        );
        const chosenStyle = font.styles.includes(style)
          ? style
          : font.styles.includes('normal')
            ? 'normal'
            : 'italic';
        const key = fontKey({ family, weight: String(chosenWeight), style: chosenStyle });
        const stored = installed.get(key) ?? (await cached(key));
        if (stored) return register(stored);
        manifestPromise ??= fetch('/fonts/manifest.json').then((r) => {
          if (!r.ok) throw new Error('Catálogo local de fontes indisponível.');
          return r.json();
        });
        const manifest = await manifestPromise;
        const local = manifest.find(
          (f) =>
            f.family === family && Number(f.weight) === chosenWeight && f.style === chosenStyle,
        );
        let url = local?.url;
        if (!url) {
          if (!details.has(font.id))
            details.set(
              font.id,
              fetch(`https://api.fontsource.org/v1/fonts/${encodeURIComponent(font.id)}`)
                .then((r) => {
                  if (!r.ok) throw new Error('A fonte está temporariamente indisponível.');
                  return r.json();
                })
                .catch((error) => {
                  details.delete(font.id);
                  throw error;
                }),
            );
          const detail = await details.get(font.id)!;
          if (!/^\d+\.\d+\.\d+(?:-[\w.]+)?$/.test(detail.npmVersion))
            throw new Error('Versão da fonte indisponível.');
          const subset = font.subsets.includes('latin') ? 'latin' : font.defSubset;
          url = `https://cdn.jsdelivr.net/fontsource/fonts/${font.id}@${detail.npmVersion}/${subset}-${chosenWeight}-${chosenStyle}.woff2`;
        }
        if (!actualLoads.has(key))
          actualLoads.set(
            key,
            (async () => {
              const face: EmbeddedFont = {
                family,
                weight: String(chosenWeight),
                style: chosenStyle,
                data: await fontData(url),
              };
              await register(face);
              await cache(face).catch(() => {});
              return face;
            })().catch((error) => {
              actualLoads.delete(key);
              throw error;
            }),
          );
        return actualLoads.get(key)!;
      })().catch((error) => {
        pending.delete(requestKey);
        if (own.length) return register(own.find((f) => f.style === style) ?? own[0]);
        throw error;
      }),
    );
  return pending.get(requestKey)!;
}
export function mergeFonts(...groups: EmbeddedFont[][]): EmbeddedFont[] {
  return [...new Map(groups.flat().map((f) => [fontKey(f), f])).values()];
}
export async function pageFontFaces(
  pages: DesignPage[],
  embedded: EmbeddedFont[] = [],
): Promise<EmbeddedFont[]> {
  const requests = new Map<
    string,
    { family: string; weight: number; style: 'normal' | 'italic' }
  >();
  for (const page of pages)
    for (const e of page.elements)
      if (e.kind === 'text' && !e.hidden) {
        const family = e.fontFamily ?? 'DM Sans',
          weight = e.fontWeight ?? 400,
          style = e.fontStyle ?? 'normal';
        requests.set(`${family}:${weight}:${style}`, { family, weight, style });
      }
  const faces = await Promise.all(
    [...requests.values()].map((f) => ensureFont(f.family, f.weight, f.style, embedded)),
  );
  await document.fonts.ready;
  return mergeFonts(faces.filter((f): f is EmbeddedFont => f !== null));
}
export async function prepareDocumentFonts(doc: DesignDocument) {
  await installDocumentFonts(doc.fonts);
  return pageFontFaces(doc.pages, doc.fonts);
}
export async function importFont(file: File): Promise<EmbeddedFont> {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (!ext || !['woff2', 'woff', 'ttf', 'otf'].includes(ext) || file.size > 10000000)
    throw new Error('Use um arquivo WOFF2, WOFF, TTF ou OTF de até 10 MB.');
  const family = file.name
    .replace(/\.[^.]+$/, '')
    .replace(/[^\p{L}\p{N} ._+()-]/gu, '')
    .trim()
    .slice(0, 100);
  if (!safeFontFamily(family)) throw new Error('Dê um nome válido ao arquivo de fonte.');
  const data = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).replace(/^data:[^;]*;/, `data:font/${ext};`));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
  const face: EmbeddedFont = { family, weight: '400', style: 'normal', data };
  try {
    await register(face);
  } catch {
    throw new Error('Este arquivo não contém uma fonte válida.');
  }
  await cache(face).catch(() => {});
  return face;
}
export function embeddedFontCss(faces: EmbeddedFont[]) {
  return faces
    .map(
      (f) =>
        `@font-face{font-family:${JSON.stringify(f.family)};src:url('${f.data}');font-weight:${f.weight};font-style:${f.style}}`,
    )
    .join('');
}
