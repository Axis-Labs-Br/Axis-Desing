import { element, parseDocument, uid } from './model';
import type { DesignElement } from './model';

export type StrokePoint = { x: number; y: number };
export const noteColors = ['#fff9a8', '#ffd39b', '#ffb6cf', '#aedbff', '#bce9b4', '#dac0ff'];
export const signatureFonts = [
  { family: 'Dancing Script', weight: 700, style: 'normal' as const, label: 'Dancing Script · marcante' },
  { family: 'Dancing Script', weight: 400, style: 'normal' as const, label: 'Dancing Script · leve' },
  { family: 'Pacifico', weight: 400, style: 'normal' as const, label: 'Pacifico · expressiva' },
  { family: 'Lora', weight: 400, style: 'italic' as const, label: 'Lora · clássica' },
];
export function createNote(color: string, author: string, pageWidth: number) {
  const width = Math.min(320, Math.max(140, pageWidth * 0.28), pageWidth * 0.8);
  return element('text', { name: 'Nota adesiva', text: '', x: 0, y: 0, width, height: width,
    fontFamily: 'DM Sans', fontSize: Math.max(12, Math.round(width * 0.075)),
    fill: '#34372d', lineHeight: 1.35,
    note: { color, author: author.slice(0, 100), minHeight: width },
  });
}
export function smoothStroke(points: StrokePoint[]) {
  if (!points.length) return '';
  if (points.length === 1) return `M${points[0].x} ${points[0].y}l0.01 0`;
  let d = `M${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const point = points[i], next = points[i + 1];
    d += `Q${point.x} ${point.y} ${(point.x + next.x) / 2} ${(point.y + next.y) / 2}`;
  }
  return `${d}L${points.at(-1)!.x} ${points.at(-1)!.y}`;
}
export function drawnSignature(strokes: StrokePoint[][], color: string): DesignElement | null {
  const points = strokes.flat();
  if (!points.length) return null;
  const padding = 6;
  const left = Math.min(...points.map(p => p.x)) - padding;
  const top = Math.min(...points.map(p => p.y)) - padding;
  const width = Math.max(12, Math.max(...points.map(p => p.x)) - left + padding);
  const height = Math.max(12, Math.max(...points.map(p => p.y)) - top + padding);
  return element('vector', { name: 'Assinatura desenhada', x: 0, y: 0, width, height,
    fill: color, strokeWidth: 2.8, vectorStyle: 'outline', vectorViewBox: [width, height],
    vectorPaths: strokes.filter(s => s.length).map(stroke => ({ tag: 'path',
      attrs: { d: smoothStroke(stroke.map(p => ({ x: p.x - left, y: p.y - top }))) } })),
  });
}
export function typedSignature(name: string, fontIndex: number, color: string): DesignElement | null {
  const text = name.trim().replace(/\s+/g, ' ');
  if (!text) return null;
  const font = signatureFonts[fontIndex] ?? signatureFonts[0];
  const canvas = document.createElement('canvas').getContext('2d');
  if (!canvas) return null;
  const size = 64;
  canvas.font = `${font.style} ${font.weight} ${size}px "${font.family}"`;
  const width = Math.ceil(canvas.measureText(text).width + size * 0.28);
  return element('text', { name: 'Assinatura em texto', text, x: 0, y: 0, width, height: size * 1.5,
    fontFamily: font.family, fontWeight: font.weight, fontStyle: font.style, fontSize: size,
    lineHeight: 1.2, fill: color,
  });
}
export function savedSignatures(account: string): DesignElement[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(`axis-signatures:${account}`) ?? '[]');
    if (!Array.isArray(raw)) return [];
    return raw.slice(0, 8).flatMap(value => {
      try {
        const doc = parseDocument({ version: 1, title: 'Assinatura', width: 8000, height: 8000,
          pages: [{ background: '#ffffff', elements: [value] }] });
        return doc.pages[0].elements.filter(e => ['text', 'image', 'vector'].includes(e.kind) && !e.note);
      } catch { return []; }
    });
  } catch { return []; }
}
export function signatureCopy(value: DesignElement): DesignElement {
  return { ...structuredClone(value), id: uid(), x: 0, y: 0, locked: false, hidden: false };
}
export function createDrawingTable(pageWidth: number, pageHeight: number): DesignElement[] {
  const width = pageWidth * 0.7, height = pageHeight * 0.32;
  const left = (pageWidth - width) / 2, top = (pageHeight - height) / 2;
  const groupId = uid();
  return Array.from({ length: 6 }, (_, i) => {
    const row = Math.floor(i / 2), col = i % 2;
    const x = left + col * width / 2, y = top + row * height / 3;
    return [element('rect', { name: `Célula ${row + 1}, ${col + 1}`, groupId, x, y,
      width: width / 2, height: height / 3, fill: row === 0 ? '#dff2f4' : '#ffffff', stroke: '#394451', strokeWidth: 1.4 }),
    element('text', { name: 'Texto da célula', groupId, text: row === 0 ? `Coluna ${col + 1}` : 'Clique para editar',
      x: x + 8, y: y + height / 3 * 0.27, width: width / 2 - 16, height: height / 6,
      fontSize: Math.max(8, Math.round(Math.min(pageWidth, pageHeight) * 0.022)), fontFamily: 'DM Sans',
      fill: '#25313a', textAlign: 'center', lineHeight: 1.15 })];
  }).flat();
}
