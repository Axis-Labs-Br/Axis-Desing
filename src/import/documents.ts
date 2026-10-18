import { unzipSync } from 'fflate';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import * as pdfjs from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { DesignDocument, DesignElement, DesignPage } from '../model';
import { blankPage, createDocument, element, parseDocument } from '../model';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

export interface ImportOptions {
  pages?: string;
  password?: string;
  pdfAppearanceOnly?: boolean;
}
export interface ImportResult {
  document: DesignDocument;
  warnings: string[];
  details: { pages: number; editableText: number; images: number; shapes: number };
}
const PAGE_W = 1000;
const PAGE_H = 1400;
const MAX_PAGES = 50;
const MAX_DIM = 8000;
const MAX_PIXELS = 36_000_000;
const MAX_PAGE_ELEMENTS = 2000;
const isSafeOfficeImage = (path: string) => /\.(png|jpe?g|gif|webp)$/i.test(path);

function safeXml(text: string) {
  const xml = new DOMParser().parseFromString(text, 'application/xml');
  if (xml.querySelector('parsererror')) throw new Error('O documento contém XML inválido.');
  return xml;
}
function getXml(zip: Record<string, Uint8Array>, path: string) {
  const data = zip[path];
  if (!data) return null;
  return safeXml(new TextDecoder().decode(data));
}
function safeUnzip(data: Uint8Array) {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const start = Math.max(0, data.length - 65_557);
  let end = -1;
  for (let i = data.length - 22; i >= start; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new Error('O arquivo compactado está incompleto ou inválido.');
  const entries = view.getUint16(end + 10, true);
  const directorySize = view.getUint32(end + 12, true);
  let offset = view.getUint32(end + 16, true);
  if (entries === 0xffff || directorySize === 0xffffffff || offset === 0xffffffff)
    throw new Error('Este arquivo Office usa um formato compactado ainda não suportado.');
  if (entries > 10_000 || offset + directorySize > end)
    throw new Error('O arquivo contém metadados compactados inválidos.');
  let expanded = 0;
  for (let i = 0; i < entries; i++) {
    if (offset + 46 > data.length || view.getUint32(offset, true) !== 0x02014b50)
      throw new Error('O arquivo compactado está incompleto ou inválido.');
    const uncompressed = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    expanded += uncompressed;
    if (uncompressed === 0xffffffff || expanded > 120 * 1024 * 1024)
      throw new Error('O conteúdo descompactado é grande demais para abrir com segurança.');
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return unzipSync(data);
}
function attr(el: Element | null | undefined, name: string) {
  return el?.getAttribute(name) ?? '';
}
function xmlColor(el: Element | null | undefined, fallback = '#191c2e') {
  const value = attr(el, 'val');
  return /^[\da-f]{6}$/i.test(value) ? `#${value}` : fallback;
}
function dataUrl(bytes: Uint8Array, mime: string) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${mime};base64,${btoa(binary)}`;
}
function mimeFor(path: string) {
  return (
    (
      {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml',
        '.bmp': 'image/bmp',
      } as Record<string, string>
    )[path.slice(path.lastIndexOf('.')).toLowerCase()] ?? 'application/octet-stream'
  );
}
function basename(file: string) {
  return (
    file
      .replace(/\\/g, '/')
      .split('/')
      .pop()
      ?.replace(/\.[^.]*$/, '') || 'Documento'
  );
}
function newPage(name: string, background = '#ffffff'): DesignPage {
  return { ...blankPage(), name, background, elements: [] };
}
function addText(
  page: DesignPage,
  text: string,
  x: number,
  y: number,
  width: number,
  size: number,
  style: Partial<DesignElement> = {},
) {
  if (!text.trim()) return;
  const lines = text.split('\n').length;
  page.elements.push(
    element('text', {
      name: text.replace(/\s+/g, ' ').slice(0, 70),
      text,
      x,
      y,
      width: Math.max(16, width),
      height: Math.max(size * 1.25, lines * size * 1.3),
      fontSize: size,
      fontFamily: style.fontFamily ?? 'Arial',
      fontWeight: style.fontWeight ?? 400,
      fontStyle: style.fontStyle ?? 'normal',
      fill: style.fill ?? '#191c2e',
      lineHeight: style.lineHeight ?? 1.25,
      textAlign: style.textAlign ?? 'left',
      ...style,
    }),
  );
}
function makeResult(
  title: string,
  width: number,
  height: number,
  pages: DesignPage[],
  warnings: string[],
  counts: ImportResult['details'],
): ImportResult {
  if (!pages.length) throw new Error('Não encontrei páginas ou conteúdo para importar.');
  if (pages.length > MAX_PAGES) throw new Error('O limite é de 50 páginas por importação.');
  if (pages.some((page) => page.elements.length > MAX_PAGE_ELEMENTS))
    throw new Error(
      'Uma página do arquivo tem mais de 2.000 elementos. Divida o documento e tente novamente.',
    );
  const doc = createDocument(title.slice(0, 200), width, height, pages[0]);
  doc.pages = pages;
  return {
    document: parseDocument(doc),
    warnings: [...new Set(warnings)],
    details: { ...counts, pages: pages.length },
  };
}
function parsePageRange(value: string, total: number) {
  if (!value.trim()) return Array.from({ length: Math.min(total, MAX_PAGES) }, (_, i) => i + 1);
  const selected = new Set<number>();
  for (const part of value.split(',')) {
    const match = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!match) throw new Error('Use páginas como 1-3,5.');
    const first = Number(match[1]),
      last = Number(match[2] ?? match[1]);
    if (first < 1 || last < first || last > total)
      throw new Error(`O PDF tem páginas de 1 a ${total}.`);
    for (let i = first; i <= last; i++) selected.add(i);
  }
  if (!selected.size || selected.size > MAX_PAGES) throw new Error('Selecione de 1 a 50 páginas.');
  return [...selected].sort((a, b) => a - b);
}

type PdfRun = {
  text: string;
  fill: string;
  mode: number;
};
type PdfOperatorList = { fnArray: number[]; argsArray: unknown[][] };
type PdfImageData = {
  width: number;
  height: number;
  kind: number;
  data?: Uint8Array;
  bitmap?: ImageBitmap;
};
type PdfImagePlacement = {
  opIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  flipX: boolean;
  src: string;
};
type PdfImagePage = { objs: { get(id: string): unknown } };
type PdfTextItem = {
  str: string;
  dir: string;
  hasEOL: boolean;
  fontName: string;
  transform: number[];
  width: number;
  height: number;
};
type PdfTextFragment = {
  text: string;
  x: number;
  y: number;
  baseline: number;
  width: number;
  size: number;
  rotation: number;
  fontFamily: string;
  fontWeight: number;
  fontStyle: 'normal' | 'italic';
  fill: string;
  direction: string;
  hasEOL: boolean;
};
type PdfTextLine = {
  text: string;
  x: number;
  y: number;
  baseline: number;
  width: number;
  size: number;
  rotation: number;
  fontFamily: string;
  fontWeight: number;
  fontStyle: 'normal' | 'italic';
  fill: string;
  direction: string;
  hasEOL: boolean;
};
type PdfTextBox = PdfTextLine & { height: number; lineHeight: number };

function multiplyPdfMatrix(a: number[], b: number[]): number[] {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}

function pdfImageSource(image: PdfImageData): string | null {
  const { width, height, kind, data } = image;
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > MAX_DIM ||
    height > MAX_DIM ||
    width * height > MAX_PIXELS
  )
    return null;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return null;
  if (image.bitmap) {
    context.drawImage(image.bitmap, 0, 0, width, height);
    return canvas.toDataURL('image/png');
  }
  if (!data) return null;
  const pixels = context.createImageData(width, height);
  if (kind === pdfjs.ImageKind.RGBA_32BPP && data.length >= width * height * 4) {
    pixels.data.set(data.subarray(0, width * height * 4));
  } else if (kind === pdfjs.ImageKind.RGB_24BPP && data.length >= width * height * 3) {
    for (let src = 0, dst = 0; dst < pixels.data.length; src += 3, dst += 4) {
      pixels.data[dst] = data[src];
      pixels.data[dst + 1] = data[src + 1];
      pixels.data[dst + 2] = data[src + 2];
      pixels.data[dst + 3] = 255;
    }
  } else if (kind === pdfjs.ImageKind.GRAYSCALE_1BPP && data.length >= Math.ceil((width * height) / 8)) {
    for (let index = 0, dst = 0; dst < pixels.data.length; index++, dst += 4) {
      const bit = (data[index >> 3] >> (7 - (index & 7))) & 1;
      const value = bit ? 255 : 0;
      pixels.data[dst] = value;
      pixels.data[dst + 1] = value;
      pixels.data[dst + 2] = value;
      pixels.data[dst + 3] = 255;
    }
  } else return null;
  context.putImageData(pixels, 0, 0);
  return canvas.toDataURL('image/png');
}

function extractPdfImages(
  ops: PdfOperatorList,
  page: PdfImagePage,
  viewportMatrix: number[],
  xOffset: number,
  yOffset: number,
): PdfImagePlacement[] {
  const placements: PdfImagePlacement[] = [];
  const stack: number[][] = [];
  let ctm = [1, 0, 0, 1, 0, 0];
  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i];
    const args = ops.argsArray[i] as unknown[] | null;
    if (fn === pdfjs.OPS.save) stack.push([...ctm]);
    else if (fn === pdfjs.OPS.restore) ctm = stack.pop() ?? ctm;
    else if (fn === pdfjs.OPS.transform && Array.isArray(args) && args.length >= 6)
      ctm = multiplyPdfMatrix(ctm, args.slice(0, 6).map(Number));
    else if (fn === pdfjs.OPS.paintImageXObject || fn === pdfjs.OPS.paintInlineImageXObject) {
      let image: PdfImageData | null = null;
      try {
        image =
          fn === pdfjs.OPS.paintImageXObject
            ? (page.objs.get(String(args?.[0])) as PdfImageData)
            : (args?.[0] as PdfImageData);
      } catch {
        image = null;
      }
      if (!image?.width || !image?.height) continue;
      const src = pdfImageSource(image);
      if (!src) continue;
      const imageTransform = multiplyPdfMatrix(
        multiplyPdfMatrix(viewportMatrix, ctm),
        [1 / image.width, 0, 0, -1 / image.height, 0, 1],
      );
      const originX = imageTransform[4] + xOffset;
      const originY = imageTransform[5] + yOffset;
      const xVector = [imageTransform[0] * image.width, imageTransform[1] * image.width];
      const yVector = [imageTransform[2] * image.height, imageTransform[3] * image.height];
      const width = Math.hypot(...xVector);
      const height = Math.hypot(...yVector);
      const dot = xVector[0] * yVector[0] + xVector[1] * yVector[1];
      const determinant = xVector[0] * yVector[1] - xVector[1] * yVector[0];
      if (
        width < 1 ||
        height < 1 ||
        Math.abs(dot) > width * height * 0.01 ||
        Math.abs(determinant) < width * height * 0.98
      )
        continue;
      const flipX = determinant < 0;
      const axisX = flipX ? [-xVector[0], -xVector[1]] : xVector;
      const topLeft = flipX
        ? [originX + xVector[0], originY + xVector[1]]
        : [originX, originY];
      const centerX = topLeft[0] + (axisX[0] + yVector[0]) / 2;
      const centerY = topLeft[1] + (axisX[1] + yVector[1]) / 2;
      placements.push({
        opIndex: i,
        x: centerX - width / 2,
        y: centerY - height / 2,
        width,
        height,
        rotation: (Math.atan2(axisX[1], axisX[0]) * 180) / Math.PI,
        flipX,
        src,
      });
    }
  }
  return placements;
}

function samePdfTextStyle(a: PdfTextFragment | PdfTextLine, b: PdfTextFragment | PdfTextLine) {
  return (
    Math.abs(a.size - b.size) <= Math.max(a.size, b.size) * 0.12 &&
    Math.abs(a.rotation - b.rotation) <= 1 &&
    a.fontFamily === b.fontFamily &&
    a.fontWeight === b.fontWeight &&
    a.fontStyle === b.fontStyle &&
    a.fill === b.fill &&
    a.direction === b.direction
  );
}

function groupPdfText(fragments: PdfTextFragment[]): PdfTextBox[] {
  const ordered = [...fragments].sort((a, b) => a.baseline - b.baseline || a.x - b.x);
  const lines: PdfTextLine[] = [];
  const lineEnds: number[] = [];
  for (const fragment of ordered) {
    let lineIndex = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      if (fragment.baseline - line.baseline > Math.max(fragment.size, line.size) * 0.32) break;
      if (line.hasEOL) continue;
      if (!samePdfTextStyle(fragment, line)) continue;
      const gap = fragment.x - lineEnds[i];
      const maxGap = Math.max(fragment.size * 1.9, 7);
      if (gap >= -fragment.size * 0.35 && gap <= maxGap) {
        lineIndex = i;
        break;
      }
    }
    if (lineIndex < 0) {
      lines.push({
        text: fragment.text.trimStart(),
        x: fragment.x,
        y: fragment.y,
        baseline: fragment.baseline,
        width: fragment.width,
        size: fragment.size,
        rotation: fragment.rotation,
        fontFamily: fragment.fontFamily,
        fontWeight: fragment.fontWeight,
        fontStyle: fragment.fontStyle,
        fill: fragment.fill,
        direction: fragment.direction,
        hasEOL: fragment.hasEOL,
      });
      lineEnds.push(fragment.x + fragment.width);
      continue;
    }

    const line = lines[lineIndex];
    const gap = fragment.x - lineEnds[lineIndex];
    const needsSpace =
      !/\s$/.test(line.text) &&
      !/^\s/.test(fragment.text) &&
      gap > Math.max(0.8, fragment.size * 0.12);
    line.text += `${needsSpace ? ' ' : ''}${fragment.text.trimStart()}`;
    line.width = Math.max(line.width, fragment.x + fragment.width - line.x);
    line.hasEOL = fragment.hasEOL;
    lineEnds[lineIndex] = Math.max(lineEnds[lineIndex], fragment.x + fragment.width);
  }

  const boxes: PdfTextBox[] = [];
  const boxLines: PdfTextLine[][] = [];
  for (const line of lines) {
    let target = -1;
    for (let i = boxes.length - 1; i >= 0; i--) {
      const previous = boxLines[i][boxLines[i].length - 1];
      const leading = line.baseline - previous.baseline;
      if (leading > Math.max(line.size, previous.size) * 2.15) break;
      if (
        leading >= Math.max(line.size, previous.size) * 0.68 &&
        samePdfTextStyle(line, previous) &&
        Math.abs(line.x - boxes[i].x) <= Math.max(line.size * 1.6, 8)
      ) {
        target = i;
        break;
      }
    }
    if (target < 0) {
      const box = {
        ...line,
        height: line.size * 1.35,
        lineHeight: 1.25,
      };
      boxes.push(box);
      boxLines.push([line]);
    } else {
      const box = boxes[target];
      const previous = boxLines[target][boxLines[target].length - 1];
      const lineHeight = (line.baseline - previous.baseline) / box.size;
      box.lineHeight = (box.lineHeight * (boxLines[target].length - 1) + lineHeight) /
        boxLines[target].length;
      boxLines[target].push(line);
      box.text += `\n${line.text}`;
      box.width = Math.max(box.width, line.x - box.x + line.width);
      box.height = Math.max(
        box.height,
        line.y - box.y + line.size * 1.35,
      );
    }
  }

  const measure = document.createElement('canvas').getContext('2d');
  for (const box of boxes) {
    if (measure)
      measure.font = `${box.fontStyle} ${box.fontWeight} ${box.size}px "${box.fontFamily}"`;
    const measuredWidth = Math.max(
      0,
      ...box.text.split('\n').map((line) => measure?.measureText(line).width ?? 0),
    );
    box.width = Math.max(box.width, measuredWidth) + 2;
    box.lineHeight = Math.max(0.8, Math.min(2.5, box.lineHeight));
  }
  return boxes;
}

function pdfRuns(ops: PdfOperatorList, lib: typeof pdfjs): PdfRun[] {
  const result: PdfRun[] = [];
  const stack: { fill: string; mode: number }[] = [];
  let fill = '#191c2e',
    mode = 0;
  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i];
    const args = ops.argsArray[i] as unknown[] | null;
    if (fn === lib.OPS.save) stack.push({ fill, mode });
    if (fn === lib.OPS.restore) {
      const previous = stack.pop();
      if (previous) ({ fill, mode } = previous);
    }
    if (fn === lib.OPS.setFillRGBColor && typeof args?.[0] === 'string') fill = args[0];
    if (fn === lib.OPS.setFillGray && typeof args?.[0] === 'number') {
      const gray = Math.round(Math.max(0, Math.min(1, args[0])) * 255)
        .toString(16)
        .padStart(2, '0');
      fill = `#${gray}${gray}${gray}`;
    }
    if (fn === lib.OPS.setFillCMYKColor && typeof args?.[0] === 'string') fill = args[0];
    if (
      fn === lib.OPS.setFillCMYKColor &&
      args &&
      args.length >= 4 &&
      typeof args[0] === 'number'
    ) {
      const [c, m, y, k] = args
        .slice(0, 4)
        .map((value) => Math.max(0, Math.min(1, Number(value) || 0)));
      fill = `#${[c, m, y]
        .map((value) =>
          Math.round((1 - Math.min(1, value + k)) * 255)
            .toString(16)
            .padStart(2, '0'),
        )
        .join('')}`;
    }
    if (fn === lib.OPS.setTextRenderingMode) mode = Number(args?.[0]) || 0;
    if (
      fn !== lib.OPS.showText &&
      fn !== lib.OPS.showSpacedText &&
      fn !== lib.OPS.nextLineShowText &&
      fn !== lib.OPS.nextLineSetSpacingShowText
    )
      continue;
    const chunks = fn === lib.OPS.showSpacedText ? (args?.[0] as unknown[]) : args;
    const glyphs = Array.isArray(chunks)
      ? chunks.flatMap((chunk) => (Array.isArray(chunk) ? chunk : []))
      : [];
    const text = glyphs
      .map((g) =>
        typeof g === 'object' && g && 'unicode' in g
          ? String((g as { unicode?: string }).unicode ?? '')
          : '',
      )
      .join('');
    if (text)
      result.push({
        text,
        fill,
        mode,
      });
  }
  return result;
}
const compact = (s: string) => s.normalize('NFKC').replace(/[\s\u200b\ufeff]+/g, '');
function mapTextRuns(raw: string, runs: PdfRun[]) {
  const whole = compact(raw);
  const output: { run: PdfRun; index: number }[] = [];
  let cursor = 0;
  for (let index = 0; index < runs.length; index++) {
    const run = runs[index];
    const key = compact(run.text);
    if (!key) continue;
    const at = whole.indexOf(key, cursor);
    if (at < 0) continue;
    output.push({ run, index });
    cursor = at + key.length;
  }
  return output;
}
function fontFallback(name: string) {
  const value = name.toLowerCase();
  if (/mono|courier|console|typewriter/.test(value)) return 'Courier New';
  if (/serif|times|roman|garamond|liberationserif/.test(value)) return 'Georgia';
  return 'Arial';
}

async function importPdf(file: File, options: ImportOptions): Promise<ImportResult> {
  const task = pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    password: options.password || undefined,
    fontExtraProperties: true,
    standardFontDataUrl: '/pdfjs/standard_fonts/',
    cMapUrl: '/pdfjs/cmaps/',
    cMapPacked: true,
    wasmUrl: '/pdfjs/wasm/',
    useSystemFonts: true,
  });
  let pdf: Awaited<typeof task.promise>;
  try {
    pdf = await task.promise;
  } catch (error) {
    void task.destroy();
    const message = error instanceof Error ? error.message : '';
    if (/password/i.test(message))
      throw new Error('Este PDF está protegido. Informe a senha correta para abrir.');
    throw new Error(
      'Não foi possível ler o PDF. Confira se o arquivo está íntegro e sem senha incorreta.',
    );
  }
  try {
    const preserveAppearance = options.pdfAppearanceOnly ?? false;
    const indices = parsePageRange(options.pages ?? '', pdf.numPages);
    const rawSizes = await Promise.all(
      indices.map(async (n) => {
        const page = await pdf.getPage(n),
          view = page.getViewport({ scale: 1 });
        return { n, w: view.width, h: view.height };
      }),
    );
    const largestWidth = Math.max(...rawSizes.map((p) => p.w));
    const largestHeight = Math.max(...rawSizes.map((p) => p.h));
    const fitScale = Math.min(
      1,
      MAX_DIM / largestWidth,
      MAX_DIM / largestHeight,
      Math.sqrt(MAX_PIXELS / (largestWidth * largestHeight)),
    );
    const scale = (4 / 3) * fitScale;
    const sizes = rawSizes.map((p) => ({
      n: p.n,
      w: Math.ceil(p.w * scale),
      h: Math.ceil(p.h * scale),
    }));
    const width = Math.min(MAX_DIM, Math.max(...sizes.map((p) => p.w))),
      height = Math.min(MAX_DIM, Math.max(...sizes.map((p) => p.h)));
    const pageScale = Math.min(
      1.5,
      Math.sqrt(MAX_PIXELS / sizes.reduce((sum, p) => sum + p.w * p.h, 0)),
    );
    const warnings: string[] = [],
      pages: DesignPage[] = [];
    const counts = { pages: 0, editableText: 0, images: 0, shapes: 0 };
    for (const dimensions of sizes) {
      const pageProxy = await pdf.getPage(dimensions.n);
      const viewport = pageProxy.getViewport({ scale });
      const xOffset = (width - dimensions.w) / 2,
        yOffset = (height - dimensions.h) / 2;
      const textContent = await pageProxy.getTextContent();
      const items = textContent.items.filter(
        (item): item is PdfTextItem => 'str' in item && !!item.str.trim(),
      );
      const ops = await pageProxy.getOperatorList();
      const textOps = new Set([
        pdfjs.OPS.showText,
        pdfjs.OPS.showSpacedText,
        pdfjs.OPS.nextLineShowText,
        pdfjs.OPS.nextLineSetSpacingShowText,
      ]);
      let renderMode = 0;
      const hasTextClip = ops.fnArray.some((fn, i) => {
        if (fn === pdfjs.OPS.setTextRenderingMode)
          renderMode = Number((ops.argsArray[i] as unknown[])?.[0]) || 0;
        return textOps.has(fn) && renderMode >= 4;
      });
      const runs = pdfRuns(ops, pdfjs);
      const textFragments: PdfTextFragment[] = [];
      let runIndex = 0;
      for (const item of items) {
        const transform = item.transform as number[];
        const size = Math.max(5, Math.hypot(transform[2] ?? 0, transform[3] ?? 0) * scale);
        const pointX = transform[4] * scale + xOffset;
        const pointY = dimensions.h - transform[5] * scale + yOffset;
        const found = mapTextRuns(item.str, runs.slice(runIndex)).map((part) => ({
          ...part,
          index: part.index + runIndex,
        }));
        if (found.length) runIndex = found[found.length - 1].index + 1;
        const visible = found.filter(({ run }) => run.mode !== 3 && run.mode < 4);
        if (found.length && !visible.length) continue;
        const pdfFontName =
          (pageProxy.commonObjs.get(item.fontName) as { name?: string }).name ?? 'Arial';
        const family = fontFallback(pdfFontName);
        const runStart = found[0]?.index ?? runIndex;
        const run =
          visible[0]?.run ??
          runs.slice(runStart).find(
            (candidate) =>
              candidate.mode !== 3 &&
              candidate.mode < 4 &&
              compact(candidate.text) &&
              compact(item.str).includes(compact(candidate.text)),
          );
        if (
          !run &&
          runs.length &&
          runs.every((candidate) => candidate.mode === 3 || candidate.mode >= 4)
        )
          continue;
        const angle = (-Math.atan2(transform[1] ?? 0, transform[0] ?? 1) * 180) / Math.PI;
        textFragments.push({
          text: item.str,
          x: pointX,
          y: pointY - size * 0.86,
          baseline: pointY,
          width: Math.max(size * 0.25, Math.abs(item.width * scale)),
          size,
          rotation: angle,
          fontFamily: family,
          fontWeight: /bold|black|heavy/i.test(pdfFontName) ? 700 : 400,
          fontStyle: /italic|oblique/i.test(pdfFontName) ? 'italic' : 'normal',
          fill: run?.fill ?? '#191c2e',
          direction: item.dir,
          hasEOL: item.hasEOL,
        });
      }
      const textBoxes = groupPdfText(textFragments);
      const imagePlacements =
        !preserveAppearance && !hasTextClip
          ? extractPdfImages(ops, pageProxy, viewport.transform, xOffset, yOffset)
          : [];
      const extractedImages =
        imagePlacements.length + 1 <= MAX_PAGE_ELEMENTS ? imagePlacements : [];
      if (imagePlacements.length && !extractedImages.length)
        warnings.push(
          `Página ${dimensions.n}: contém imagens demais para separar com segurança; o visual foi preservado na página.`,
        );
      const pageTooComplex =
        !preserveAppearance && textBoxes.length + extractedImages.length + 1 > MAX_PAGE_ELEMENTS;
      if (pageTooComplex)
        warnings.push(
          `Página ${dimensions.n}: contém mais de ${MAX_PAGE_ELEMENTS} trechos; foi preservada como imagem para permitir abrir o restante do documento.`,
        );
      if (hasTextClip && !preserveAppearance)
        warnings.push(
          `Página ${dimensions.n}: o texto participa de um recorte especial; foi preservado como imagem para evitar alterar o visual.`,
        );
      const canEditText =
        !preserveAppearance && !hasTextClip && !pageTooComplex && textBoxes.length > 0;
      const extractedImageOps = new Set(extractedImages.map((image) => image.opIndex));
      const filterOperations = canEditText || extractedImageOps.size > 0;
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(viewport.width * pageScale));
      canvas.height = Math.max(1, Math.round(viewport.height * pageScale));
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Não foi possível preparar a página do PDF no navegador.');
      const renderViewport = pageProxy.getViewport({ scale: scale * pageScale });
      const canvasFactory = canvas;
      const renderTask = pageProxy.render({
        canvas: canvasFactory,
        canvasContext: ctx,
        viewport: renderViewport,
        background: '#ffffff',
        operationsFilter: filterOperations
          ? (i, list) =>
              !(canEditText && textOps.has(list.fnArray[i])) && !extractedImageOps.has(i)
          : undefined,
      });
      canvasFactory.width = canvas.width;
      canvasFactory.height = canvas.height;
      await renderTask.promise;
      const docPage = newPage(`Página ${dimensions.n}`);
      docPage.elements.push(
        element('image', {
          name: `Fundo da página ${dimensions.n}`,
          x: xOffset,
          y: yOffset,
          width: dimensions.w,
          height: dimensions.h,
          src: canvas.toDataURL('image/png'),
          locked: true,
        }),
      );
      counts.images++;
      for (const [index, image] of extractedImages.entries()) {
        docPage.elements.push(
          element('image', {
            name: `Imagem ${index + 1} do PDF`,
            x: image.x,
            y: image.y,
            width: image.width,
            height: image.height,
            rotation: image.rotation,
            flipX: image.flipX,
            imageFit: 'stretch',
            src: image.src,
          }),
        );
        counts.images++;
      }
      if (!canEditText) {
        if (preserveAppearance || hasTextClip)
          warnings.push(
            `Página ${dimensions.n}: importada visualmente como uma imagem; seus textos e desenhos não ficam separados para edição.`,
          );
        pages.push(docPage);
        continue;
      }
      const editableBefore = counts.editableText;
      for (const box of textBoxes) {
        addText(docPage, box.text, box.x, box.y, box.width, box.size, {
          height: box.height,
          rotation: box.rotation,
          fontFamily: box.fontFamily,
          fontWeight: box.fontWeight,
          fontStyle: box.fontStyle,
          lineHeight: box.lineHeight,
          fill: box.fill,
        });
        counts.editableText++;
      }
      if (counts.editableText === editableBefore)
        warnings.push(
          `Página ${dimensions.n}: sem texto visível selecionável; a página entrou como imagem e você pode inserir texto por cima.`,
        );
      else if (!warnings.some((warning) => warning.startsWith('As fontes do PDF')))
        warnings.push(
          'As fontes do PDF foram associadas a fontes comuns próximas para manter os textos editáveis.',
        );
      pages.push(docPage);
    }
    if (pages.length > 1 && new Set(sizes.map((p) => `${p.w}x${p.h}`)).size > 1)
      warnings.push(
        'As páginas tinham tamanhos diferentes; foram centralizadas em uma tela comum para facilitar a edição.',
      );
    return makeResult(basename(file.name), width, height, pages, warnings, counts);
  } finally {
    await task.destroy();
  }
}

function flowPages(
  blocks: { text: string; size: number; style?: Partial<DesignElement> }[],
  title: string,
) {
  const pages = [newPage('Página 1')];
  let y = 72;
  for (const block of blocks) {
    const roughLines = Math.max(
      1,
      Math.ceil(block.text.length / Math.max(22, Math.floor(850 / (block.size * 0.55)))),
    );
    const height = Math.max(block.size * 1.4, roughLines * block.size * 1.3);
    if (y + height > PAGE_H - 56) {
      if (pages.length >= MAX_PAGES)
        throw new Error('Este arquivo ultrapassa o limite de 50 páginas de texto.');
      pages.push(newPage(`Página ${pages.length + 1}`));
      y = 72;
    }
    addText(pages[pages.length - 1], block.text, 76, y, 848, block.size, block.style);
    y += height + 24;
  }
  if (pages[0].elements.length) pages[0].name = title.slice(0, 60);
  return pages;
}
function htmlBlocks(html: string) {
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'p',
      'li',
      'blockquote',
      'pre',
      'code',
      'strong',
      'b',
      'em',
      'i',
      'br',
      'ul',
      'ol',
      'table',
      'tr',
      'td',
      'th',
    ],
    ALLOWED_ATTR: [],
  });
  const dom = new DOMParser().parseFromString(clean, 'text/html');
  const nodes = Array.from(dom.body.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li,blockquote,pre,tr'));
  return nodes
    .map((node) => {
      const tag = node.tagName.toLowerCase();
      const content = node.cloneNode(true) as Element;
      content.querySelectorAll('br').forEach((lineBreak) => lineBreak.replaceWith('\n'));
      const text = (content.textContent ?? '')
        .replace(/[ \t\f\v]+/g, ' ')
        .replace(/\s*\n\s*/g, '\n')
        .trim();
      const size = /^h1$/.test(tag)
        ? 40
        : /^h2$/.test(tag)
          ? 32
          : /^h[3-6]$/.test(tag)
            ? 25
            : tag === 'pre'
              ? 15
              : 19;
      return {
        text,
        size,
        style: {
          fontWeight: /^h[1-3]$/.test(tag) ? 700 : 400,
          fontFamily: tag === 'pre' ? 'Courier New' : 'Arial',
        },
      };
    })
    .filter((block) => block.text);
}
function relationshipTarget(base: string, target: string) {
  const parts = `${base}/${target}`.replace(/\\/g, '/').split('/');
  const output: string[] = [];
  for (const part of parts) {
    if (!part || part === '.') continue;
    if (part === '..') output.pop();
    else output.push(part);
  }
  return output.join('/');
}
function readWordParagraphs(zip: Record<string, Uint8Array>, warnings: string[]) {
  const xml = getXml(zip, 'word/document.xml');
  if (!xml) throw new Error('Não encontrei o conteúdo principal do Word.');
  const rels = getXml(zip, 'word/_rels/document.xml.rels');
  const relations = new Map(
    Array.from(rels?.querySelectorAll('Relationship') ?? []).map((r) => [
      attr(r, 'Id'),
      attr(r, 'Target'),
    ]),
  );
  const blocks: {
    text: string;
    size: number;
    style?: Partial<DesignElement>;
    image?: { src: string; w: number; h: number };
  }[] = [];
  for (const p of Array.from(xml.getElementsByTagNameNS('*', 'p'))) {
    const text = Array.from(p.getElementsByTagNameNS('*', 't'))
      .map((n) => n.textContent ?? '')
      .join('')
      .trim();
    const prop = p.getElementsByTagNameNS('*', 'rPr')[0];
    const bold = prop?.getElementsByTagNameNS('*', 'b').length ? 700 : 400;
    const italic = prop?.getElementsByTagNameNS('*', 'i').length ? 'italic' : 'normal';
    const font =
      attr(prop?.getElementsByTagNameNS('*', 'rFonts')[0], 'ascii') ||
      attr(prop?.getElementsByTagNameNS('*', 'rFonts')[0], 'hAnsi') ||
      'Arial';
    const color = xmlColor(prop?.getElementsByTagNameNS('*', 'color')[0]);
    const halfPoints = Number(attr(prop?.getElementsByTagNameNS('*', 'sz')[0], 'val'));
    const outline = p.getElementsByTagNameNS('*', 'pStyle')[0];
    const heading = /^Heading([1-6])$/i.exec(attr(outline, 'val'));
    const size = heading
      ? Math.max(19, 42 - Number(heading[1]) * 4)
      : halfPoints
        ? halfPoints / 2
        : 19;
    const style = {
      fontFamily: /^[\p{L}\p{N} ._-]{1,80}$/u.test(font) ? font : 'Arial',
      fontWeight: bold,
      fontStyle: italic as 'normal' | 'italic',
      fill: color,
    };
    let image: { src: string; w: number; h: number } | undefined;
    const blip = p.getElementsByTagNameNS('*', 'blip')[0];
    if (blip) {
      const id =
        blip.getAttributeNS(
          'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
          'embed',
        ) || attr(blip, 'r:embed');
      const target = relations.get(id ?? ''),
        path = target ? relationshipTarget('word', target) : '';
      const bytes = zip[path];
      if (bytes && isSafeOfficeImage(path)) {
        const extent = p.getElementsByTagNameNS('*', 'extent')[0];
        image = {
          src: dataUrl(bytes, mimeFor(path)),
          w: Number(attr(extent, 'cx')) / 9525 || 420,
          h: Number(attr(extent, 'cy')) / 9525 || 280,
        };
      } else if (bytes)
        warnings.push(
          'Uma imagem vetorial ou em formato especial do Word foi omitida por segurança.',
        );
      else warnings.push('Uma imagem do Word não pôde ser localizada no arquivo.');
    }
    if (text || image) blocks.push({ text, size, style, image });
  }
  return blocks;
}
async function importWord(file: File) {
  const zip = safeUnzip(new Uint8Array(await file.arrayBuffer())),
    warnings: string[] = [];
  const blocks = readWordParagraphs(zip, warnings),
    pages = [newPage('Página 1')];
  let imageIndex = 0,
    y = 72;
  for (const block of blocks) {
    const roughLines = Math.max(
      1,
      Math.ceil(block.text.length / Math.max(22, Math.floor(850 / (block.size * 0.55)))),
    );
    const textHeight = block.text ? roughLines * block.size * 1.3 : 0;
    const imageScale = block.image ? Math.min(1, 848 / block.image.w, 560 / block.image.h) : 0;
    const imageWidth = block.image ? block.image.w * imageScale : 0;
    const imageHeight = block.image ? block.image.h * imageScale : 0;
    const blockHeight = textHeight + (block.image ? imageHeight + (block.text ? 8 : 0) : 0);
    if (y + blockHeight > PAGE_H - 56) {
      if (pages.length >= MAX_PAGES)
        throw new Error('Este Word ultrapassa o limite de 50 páginas.');
      pages.push(newPage(`Página ${pages.length + 1}`));
      y = 72;
    }
    const page = pages[pages.length - 1];
    if (block.text) addText(page, block.text, 76, y, 848, block.size, block.style);
    if (block.image) {
      page.elements.push(
        element('image', {
          name: 'Imagem importada do Word',
          x: 76,
          y: y + textHeight + (block.text ? 8 : 0),
          width: imageWidth,
          height: imageHeight,
          src: block.image.src,
        }),
      );
      imageIndex++;
    }
    y += blockHeight + 22;
  }
  if (blocks.some((b) => b.text))
    warnings.push(
      'O texto e as imagens foram trazidos para o editor. Paginação e espaçamentos originais do Word podem mudar.',
    );
  const count = pages.reduce(
    (sum, p) => sum + p.elements.filter((e) => e.kind === 'text').length,
    0,
  );
  return makeResult(basename(file.name), PAGE_W, PAGE_H, pages, warnings, {
    pages: 0,
    editableText: count,
    images: imageIndex,
    shapes: 0,
  });
}

function importPptx(file: File) {
  return file.arrayBuffer().then((buffer) => {
    const zip = safeUnzip(new Uint8Array(buffer));
    const presentation = getXml(zip, 'ppt/presentation.xml');
    if (!presentation) throw new Error('Não encontrei os slides desta apresentação.');
    const size = presentation.getElementsByTagNameNS('*', 'sldSz')[0];
    const width = Math.min(MAX_DIM, Math.max(100, Math.round(Number(attr(size, 'cx')) / 9525)));
    const height = Math.min(MAX_DIM, Math.max(100, Math.round(Number(attr(size, 'cy')) / 9525)));
    const rels = getXml(zip, 'ppt/_rels/presentation.xml.rels');
    const targets = new Map(
      Array.from(rels?.querySelectorAll('Relationship') ?? []).map((r) => [
        attr(r, 'Id'),
        attr(r, 'Target'),
      ]),
    );
    const ids = Array.from(presentation.getElementsByTagNameNS('*', 'sldId'));
    if (!ids.length) throw new Error('A apresentação não contém slides.');
    if (ids.length > MAX_PAGES) throw new Error('O limite é de 50 slides por importação.');
    const warnings: string[] = [],
      pages: DesignPage[] = [];
    const counts = { pages: 0, editableText: 0, images: 0, shapes: 0 };
    ids.forEach((id, pageIndex) => {
      const target = targets.get(attr(id, 'r:id'));
      const slidePath = target ? relationshipTarget('ppt', target) : '';
      const slide = getXml(zip, slidePath);
      if (!slide) {
        warnings.push(`O slide ${pageIndex + 1} não pôde ser lido.`);
        return;
      }
      const page = newPage(`Slide ${pageIndex + 1}`);
      const relPath = slidePath.replace(/([^/]+)$/, '_rels/$1.rels');
      const slideRels = getXml(zip, relPath);
      const relationMap = new Map(
        Array.from(slideRels?.querySelectorAll('Relationship') ?? []).map((r) => [
          attr(r, 'Id'),
          attr(r, 'Target'),
        ]),
      );
      for (const shape of Array.from(slide.getElementsByTagNameNS('*', 'sp'))) {
        const xfrm = shape.getElementsByTagNameNS('*', 'xfrm')[0];
        const off = xfrm?.getElementsByTagNameNS('*', 'off')[0],
          ext = xfrm?.getElementsByTagNameNS('*', 'ext')[0];
        const x = Number(attr(off, 'x')) / 9525,
          y = Number(attr(off, 'y')) / 9525,
          w = Number(attr(ext, 'cx')) / 9525,
          h = Number(attr(ext, 'cy')) / 9525;
        if (![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0) continue;
        const transform = xfrm?.getAttribute('rot');
        const rotation = transform ? -Number(transform) / 60000 : 0;
        const shapePr = shape.getElementsByTagNameNS('*', 'spPr')[0];
        const fillNode = shapePr?.getElementsByTagNameNS('*', 'solidFill')[0]?.firstElementChild;
        const fill = fillNode ? xmlColor(fillNode, 'none') : 'none';
        const preset = attr(shapePr?.getElementsByTagNameNS('*', 'prstGeom')[0], 'prst');
        if (fill !== 'none' && w > 1 && h > 1) {
          const kind = preset === 'ellipse' ? 'ellipse' : 'rect';
          page.elements.push(
            element(kind, {
              name: 'Forma do PowerPoint',
              x,
              y,
              width: w,
              height: h,
              fill,
              rotation,
            }),
          );
          counts.shapes++;
        }
        const paragraphs = Array.from(shape.getElementsByTagNameNS('*', 'p'))
          .map((p) =>
            Array.from(p.getElementsByTagNameNS('*', 't'))
              .map((t) => t.textContent ?? '')
              .join(''),
          )
          .filter(Boolean);
        if (paragraphs.length) {
          const run =
            shape.getElementsByTagNameNS('*', 'rPr')[0] ??
            shape.getElementsByTagNameNS('*', 'defRPr')[0];
          const colorNode = run?.getElementsByTagNameNS('*', 'solidFill')[0]?.firstElementChild;
          const font = attr(run?.getElementsByTagNameNS('*', 'latin')[0], 'typeface');
          const size = Number(attr(run, 'sz')) / 100;
          addText(page, paragraphs.join('\n'), x + 10, y + 6, Math.max(20, w - 20), size || 22, {
            fill: colorNode ? xmlColor(colorNode) : '#191c2e',
            fontFamily: /^[\p{L}\p{N} ._-]{1,80}$/u.test(font) ? font : 'Arial',
            fontWeight: run?.hasAttribute('b') ? 700 : 400,
            rotation,
          });
          counts.editableText++;
        }
      }
      for (const picture of Array.from(slide.getElementsByTagNameNS('*', 'pic'))) {
        const blip = picture.getElementsByTagNameNS('*', 'blip')[0];
        const id =
          blip?.getAttributeNS(
            'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
            'embed',
          ) || attr(blip, 'r:embed');
        const targetPath = relationMap.get(id ?? ''),
          path = targetPath
            ? relationshipTarget(slidePath.slice(0, slidePath.lastIndexOf('/')), targetPath)
            : '';
        const bytes = zip[path],
          xfrm = picture.getElementsByTagNameNS('*', 'xfrm')[0];
        const off = xfrm?.getElementsByTagNameNS('*', 'off')[0],
          ext = xfrm?.getElementsByTagNameNS('*', 'ext')[0];
        const x = Number(attr(off, 'x')) / 9525,
          y = Number(attr(off, 'y')) / 9525,
          w = Number(attr(ext, 'cx')) / 9525,
          h = Number(attr(ext, 'cy')) / 9525;
        if (bytes && isSafeOfficeImage(path) && w > 0 && h > 0) {
          page.elements.push(
            element('image', {
              name: 'Imagem do slide',
              x,
              y,
              width: w,
              height: h,
              src: dataUrl(bytes, mimeFor(path)),
            }),
          );
          counts.images++;
        } else if (bytes)
          warnings.push(
            'Uma imagem vetorial ou em formato especial do PowerPoint foi omitida por segurança.',
          );
      }
      pages.push(page);
    });
    if (pages.some((p) => p.elements.length === 0))
      warnings.push('Slides vazios ou efeitos avançados podem não ser reproduzidos.');
    warnings.push(
      'Textos, formas básicas e imagens são editáveis. Transições, animações, gráficos avançados e SmartArt podem perder efeitos.',
    );
    return makeResult(basename(file.name), width, height, pages, warnings, counts);
  });
}

function importOdt(file: File) {
  return file.arrayBuffer().then((buffer) => {
    const zip = safeUnzip(new Uint8Array(buffer)),
      xml = getXml(zip, 'content.xml');
    if (!xml) throw new Error('Não encontrei o texto do documento ODT.');
    const blocks: { text: string; size: number; style?: Partial<DesignElement> }[] = [];
    const textNodes = [
      ...Array.from(
        xml.getElementsByTagNameNS('urn:oasis:names:tc:opendocument:xmlns:text:1.0', 'h'),
      ),
      ...Array.from(
        xml.getElementsByTagNameNS('urn:oasis:names:tc:opendocument:xmlns:text:1.0', 'p'),
      ),
      ...Array.from(xml.querySelectorAll('h,p')),
    ];
    for (const node of textNodes) {
      const text = node.textContent?.replace(/\s+/g, ' ').trim() ?? '';
      if (!text) continue;
      const heading = node.localName === 'h' || /^Heading/i.test(attr(node, 'text:style-name'));
      blocks.push({ text, size: heading ? 30 : 18, style: { fontWeight: heading ? 700 : 400 } });
    }
    const pages = flowPages(blocks, basename(file.name)),
      count = pages.reduce((n, p) => n + p.elements.length, 0);
    return makeResult(
      basename(file.name),
      PAGE_W,
      PAGE_H,
      pages,
      [
        'O texto e os títulos foram importados; layouts, tabelas complexas e estilos do ODT podem ser simplificados.',
        ...(xml.getElementsByTagNameNS('urn:oasis:names:tc:opendocument:xmlns:drawing:1.0', 'image')
          .length
          ? ['As imagens incorporadas neste ODT ainda não são importadas.']
          : []),
      ],
      { pages: 0, editableText: count, images: 0, shapes: 0 },
    );
  });
}

async function importImage(file: File) {
  const blobUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = blobUrl;
    await image.decode();
    const scale = Math.min(
      1,
      MAX_DIM / image.width,
      MAX_DIM / image.height,
      Math.sqrt(MAX_PIXELS / (image.width * image.height)),
      Math.sqrt(MAX_PIXELS / (image.width * image.height)),
    );
    const width = Math.max(100, Math.round(image.width * scale)),
      height = Math.max(100, Math.round(image.height * scale));
    const page = newPage('Página 1');
    page.elements.push(
      element('image', {
        name: file.name,
        x: 0,
        y: 0,
        width,
        height,
        src: await fileDataUrl(file),
      }),
    );
    return makeResult(
      basename(file.name),
      width,
      height,
      [page],
      file.type === 'image/gif' ? ['GIFs animados usam o primeiro quadro da animação.'] : [],
      { pages: 0, editableText: 0, images: 1, shapes: 0 },
    );
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}
function fileDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
    reader.readAsDataURL(file);
  });
}
async function importText(file: File) {
  const raw = await file.text();
  const plain = raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const html = /\.md$/i.test(file.name)
    ? await marked.parse(raw)
    : /\.html?$/i.test(file.name)
      ? raw
      : `<p>${plain
          .split(/\r?\n/)
          .map((line) => line || '&nbsp;')
          .join('<br>')}</p>`;
  const blocks = htmlBlocks(html),
    pages = flowPages(blocks, basename(file.name));
  return makeResult(
    basename(file.name),
    PAGE_W,
    PAGE_H,
    pages,
    /\.html?$/i.test(file.name)
      ? ['Conteúdo ativo, scripts e estilos externos foram removidos por segurança.']
      : [],
    {
      pages: 0,
      editableText: pages.reduce((n, p) => n + p.elements.length, 0),
      images: 0,
      shapes: 0,
    },
  );
}

export async function importDocument(
  file: File,
  options: ImportOptions = {},
): Promise<ImportResult> {
  if (file.size > 50 * 1024 * 1024) throw new Error('O arquivo deve ter até 50 MB.');
  const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  if (extension === '.pdf') return importPdf(file, options);
  if (extension === '.docx') return importWord(file);
  if (extension === '.pptx') return importPptx(file);
  if (extension === '.odt') return importOdt(file);
  if (['.txt', '.md', '.markdown', '.html', '.htm'].includes(extension)) return importText(file);
  if (['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(extension)) return importImage(file);
  if (extension === '.svg') {
    const safe = DOMPurify.sanitize(await file.text(), {
      USE_PROFILES: { svg: true, svgFilters: true },
    });
    const url = URL.createObjectURL(new Blob([safe], { type: 'image/svg+xml' }));
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      const scale = Math.min(
        1,
        MAX_DIM / (image.naturalWidth || PAGE_W),
        MAX_DIM / (image.naturalHeight || PAGE_H),
        Math.sqrt(MAX_PIXELS / ((image.naturalWidth || PAGE_W) * (image.naturalHeight || PAGE_H))),
      );
      const width = Math.min(
          MAX_DIM,
          Math.max(100, Math.round((image.naturalWidth || PAGE_W) * scale)),
        ),
        height = Math.min(
          MAX_DIM,
          Math.max(100, Math.round((image.naturalHeight || PAGE_H) * scale)),
        );
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Não foi possível preparar o SVG.');
      context.drawImage(image, 0, 0, width, height);
      const page = newPage('Página 1');
      page.elements.push(
        element('image', {
          name: file.name,
          x: 0,
          y: 0,
          width,
          height,
          src: canvas.toDataURL('image/png'),
        }),
      );
      return makeResult(
        basename(file.name),
        width,
        height,
        [page],
        [
          'SVG importado como imagem para preservar sua aparência; scripts e conteúdo externo foram removidos.',
        ],
        { pages: 0, editableText: 0, images: 1, shapes: 0 },
      );
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  if (extension === '.axis' || extension === '.json') {
    const document = parseDocument(JSON.parse(await file.text()));
    return {
      document,
      warnings: [],
      details: {
        pages: document.pages.length,
        editableText: document.pages.reduce(
          (n, p) => n + p.elements.filter((e) => e.kind === 'text').length,
          0,
        ),
        images: document.pages.reduce(
          (n, p) => n + p.elements.filter((e) => e.kind === 'image').length,
          0,
        ),
        shapes: 0,
      },
    };
  }
  throw new Error(
    'Formato não suportado. Escolha PDF, DOCX, PPTX, ODT, TXT, Markdown, HTML, SVG, PNG, JPG, WebP, GIF ou projeto Axis.',
  );
}
