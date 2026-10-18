import fontNames from './data/font-names.json';
import type { EmbeddedFont } from './fontTypes';
import { validEmbeddedFont } from './fontTypes';
import type { VectorPath } from './vectorTypes';
import { validVectorPaths } from './vectorTypes';
export type ElementKind =
  | 'text'
  | 'rect'
  | 'ellipse'
  | 'triangle'
  | 'star'
  | 'line'
  | 'image'
  | 'vector';
export type DrawingTool = 'select' | 'pencil' | 'marker' | 'line' | 'eraser';
export interface DesignElement {
  id: string;
  kind: ElementKind;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  fill: string;
  opacity: number;
  locked: boolean;
  hidden: boolean;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: number;
  fontStyle?: 'normal' | 'italic';
  textAlign?: 'left' | 'center' | 'right';
  lineHeight?: number;
  letterSpacing?: number;
  /** Preserve the measured advance of an imported PDF text run. */
  textWidth?: number;
  radius?: number;
  stroke?: string;
  strokeWidth?: number;
  src?: string;
  imageFit?: 'cover' | 'stretch';
  flipX?: boolean;
  groupId?: string;
  vectorPaths?: VectorPath[];
  vectorViewBox?: [number, number];
  vectorStyle?: 'outline' | 'solid';
  /** A sticky note is one editable text object, including its paper and author. */
  note?: { color: string; author: string; minHeight: number };
  drawing?: boolean;
}
export interface DesignPage {
  id: string;
  name: string;
  background: string;
  elements: DesignElement[];
}
export interface DesignDocument {
  id: string;
  version: 1;
  title: string;
  width: number;
  height: number;
  pages: DesignPage[];
  createdAt: number;
  updatedAt: number;
  favorite: boolean;
  deletedAt?: number;
  fonts?: EmbeddedFont[];
  /** Account and sharing fields are added by the Axis account API. */
  ownerId?: string;
  visibility?: 'private' | 'link' | 'public';
  shareId?: string;
}
export interface Template {
  id: string;
  title: string;
  category: string;
  width: number;
  height: number;
  color: string;
  page: DesignPage;
  /** Complete multi-slide template decks. `page` is the cover used by previews. */
  pages?: DesignPage[];
}
export const uid = () => crypto.randomUUID();
export function element(kind: ElementKind, props: Partial<DesignElement> = {}): DesignElement {
  return {
    id: uid(),
    kind,
    name: {
      text: 'Texto',
      rect: 'Retângulo',
      ellipse: 'Círculo',
      triangle: 'Triângulo',
      star: 'Estrela',
      line: 'Linha',
      image: 'Imagem',
      vector: 'Elemento vetorial',
    }[kind],
    x: 100,
    y: 100,
    width: 240,
    height: 160,
    rotation: 0,
    fill: '#5965df',
    opacity: 1,
    locked: false,
    hidden: false,
    ...props,
  };
}
export const blankPage = (): DesignPage => ({
  id: uid(),
  name: 'Página',
  background: '#ffffff',
  elements: [],
});
export function createDocument(
  title = 'Design sem título',
  width = 1080,
  height = 1080,
  page?: DesignPage,
): DesignDocument {
  return {
    id: uid(),
    version: 1,
    title,
    width,
    height,
    pages: [page ? clonePage(page) : blankPage()],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    favorite: false,
  };
}
export function cloneElements(elements: DesignElement[]): DesignElement[] {
  const groups = new Map<string, string>();
  return elements.map((e) => {
    if (e.groupId && !groups.has(e.groupId)) groups.set(e.groupId, uid());
    return {
      ...structuredClone(e),
      id: uid(),
      groupId: e.groupId ? groups.get(e.groupId) : undefined,
    };
  });
}
export const clonePage = (page: DesignPage): DesignPage => ({
  ...structuredClone(page),
  id: uid(),
  elements: cloneElements(page.elements),
});
export const duplicateDocument = (doc: DesignDocument): DesignDocument => ({
  ...structuredClone(doc),
  id: uid(),
  title: `${doc.title} (cópia)`,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  favorite: false,
  pages: doc.pages.map(clonePage),
});
export const palettes = [
  '#4b57db',
  '#a9bafa',
  '#c5e8a7',
  '#fbccba',
  '#eea6ba',
  '#f2d769',
  '#ece8e0',
  '#191c2e',
  '#ffffff',
  '#000000',
];
export const fonts = ['DM Sans', 'Manrope', 'Arial', 'Georgia', 'Courier New', 'Impact', 'Verdana'];
const catalogFamilies = new Set([...fonts, ...fontNames]);
export const formats = [
  {
    name: 'Post para Instagram',
    label: 'Post',
    width: 1080,
    height: 1080,
    color: '#f5e8ef',
    icon: 'instagram',
  },
  {
    name: 'Apresentação',
    label: 'Apresentação',
    width: 1920,
    height: 1080,
    color: '#e9e9fa',
    icon: 'presentation',
  },
  {
    name: 'Story para Instagram',
    label: 'Story',
    width: 1080,
    height: 1920,
    color: '#f9eedf',
    icon: 'smartphone',
  },
  { name: 'Cartaz', label: 'Cartaz', width: 1240, height: 1754, color: '#e7f0e7', icon: 'poster' },
  {
    name: 'Capa para YouTube',
    label: 'YouTube',
    width: 2560,
    height: 1440,
    color: '#f7e4e2',
    icon: 'youtube',
  },
  {
    name: 'Cartão de visita',
    label: 'Cartão de visita',
    width: 1050,
    height: 600,
    color: '#e4eef5',
    icon: 'card',
  },
];

// Validate untrusted JSON before it can enter the editor or export pipeline.
export function parseDocument(input: unknown): DesignDocument {
  if (!input || typeof input !== 'object') throw new Error('Arquivo de projeto inválido.');
  const d = structuredClone(input) as DesignDocument;
  const finite = (n: unknown, min: number, max: number) =>
    typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
  if (
    d.version !== 1 ||
    typeof d.title !== 'string' ||
    !finite(d.width, 100, 8000) ||
    !finite(d.height, 100, 8000) ||
    !Array.isArray(d.pages) ||
    d.pages.length < 1 ||
    d.pages.length > 100
  )
    throw new Error('Dimensões ou páginas inválidas.');
  if (
    d.fonts != null &&
    (!Array.isArray(d.fonts) || d.fonts.length > 256 || !d.fonts.every(validEmbeddedFont))
  )
    throw new Error('O projeto contém uma fonte inválida.');
  const embeddedFamilies = new Set(d.fonts?.map((f) => f.family) ?? []);
  const kinds = new Set(['text', 'rect', 'ellipse', 'triangle', 'star', 'line', 'image', 'vector']);
  for (const p of d.pages) {
    if (
      !p ||
      typeof p.background !== 'string' ||
      !/^#[0-9a-f]{3,8}$/i.test(p.background) ||
      !Array.isArray(p.elements) ||
      p.elements.length > 2000
    )
      throw new Error('Página inválida.');
    for (const e of p.elements) {
      if (
        !e ||
        !kinds.has(e.kind) ||
        !finite(e.x, -32000, 32000) ||
        !finite(e.y, -32000, 32000) ||
        !finite(e.width, 1, 32000) ||
        !finite(e.height, 1, 32000) ||
        !finite(e.rotation, -36000, 36000) ||
        !finite(e.opacity, 0, 1) ||
        typeof e.fill !== 'string' ||
        !/^(#[0-9a-f]{3,8}|none|transparent)$/i.test(e.fill) ||
        typeof e.name !== 'string' ||
        typeof e.hidden !== 'boolean' ||
        typeof e.locked !== 'boolean'
      )
        throw new Error('Elemento inválido.');
      if (
        e.src &&
        !/^data:image\/(png|jpeg|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(e.src) &&
        !/^\/photos\/[a-z-]+\.jpg$/.test(e.src)
      )
        throw new Error('O projeto contém uma imagem externa não permitida.');
      if (e.text != null && (typeof e.text !== 'string' || e.text.length > 100000))
        throw new Error('Texto inválido.');
      if (e.note != null && (e.kind !== 'text' || typeof e.note !== 'object' ||
        !/^#[0-9a-f]{6}$/i.test(e.note.color) || typeof e.note.author !== 'string' ||
        e.note.author.length > 100 || !finite(e.note.minHeight, 1, 32000)))
        throw new Error('Nota adesiva inválida.');
      if (e.drawing != null && typeof e.drawing !== 'boolean')
        throw new Error('Traço inválido.');
      if (
        e.fontFamily != null &&
        !catalogFamilies.has(e.fontFamily) &&
        !embeddedFamilies.has(e.fontFamily)
      )
        e.fontFamily = 'DM Sans';
      if (
        e.kind === 'vector' &&
        (!validVectorPaths(e.vectorPaths) ||
          !Array.isArray(e.vectorViewBox) ||
          e.vectorViewBox.length !== 2 ||
          !e.vectorViewBox.every((n) => finite(n, 1, 4096)) ||
          !['outline', 'solid'].includes(e.vectorStyle ?? 'outline'))
      )
        throw new Error('Elemento vetorial inválido.');
      if (e.fontSize != null && !finite(e.fontSize, 1, 4000))
        throw new Error('Tamanho de texto inválido.');
      if (e.textWidth != null && !finite(e.textWidth, 0.01, 32000))
        throw new Error('Largura de texto inválida.');
      if (e.lineHeight != null && !finite(e.lineHeight, 0.1, 10))
        throw new Error('Espaçamento inválido.');
      if (e.letterSpacing != null && !finite(e.letterSpacing, -1000, 1000))
        throw new Error('Espaçamento inválido.');
      if (e.radius != null && !finite(e.radius, 0, 32000))
        throw new Error('Arredondamento inválido.');
      if (e.strokeWidth != null && !finite(e.strokeWidth, 0, 32000))
        throw new Error('Espessura inválida.');
      if (e.fontWeight != null && !finite(e.fontWeight, 100, 1000))
        throw new Error('Peso da fonte inválido.');
      if (e.stroke != null && !/^(#[0-9a-f]{3,8}|none|transparent)$/i.test(e.stroke))
        throw new Error('Contorno inválido.');
      if (e.textAlign != null && !['left', 'center', 'right'].includes(e.textAlign))
        throw new Error('Alinhamento inválido.');
      if (e.fontStyle != null && !['normal', 'italic'].includes(e.fontStyle))
        throw new Error('Estilo inválido.');
      if (e.flipX != null && typeof e.flipX !== 'boolean')
        throw new Error('Transformação inválida.');
      if (e.imageFit != null && !['cover', 'stretch'].includes(e.imageFit))
        throw new Error('Ajuste de imagem inválido.');
      if (
        e.groupId != null &&
        (typeof e.groupId !== 'string' || !/^[a-z0-9-]{1,100}$/i.test(e.groupId))
      )
        throw new Error('Grupo inválido.');
    }
  }
  return {
    ...structuredClone(d),
    id: uid(),
    title: d.title.slice(0, 200),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    favorite: false,
    deletedAt: undefined,
    pages: d.pages.map(clonePage),
  };
}
