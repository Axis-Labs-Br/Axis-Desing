import { renderToStaticMarkup } from 'react-dom/server';
import { Scene } from './Scene';
import type { DesignDocument, DesignPage } from './model';
import type { EmbeddedFont } from './fontTypes';
import { embeddedFontCss, mergeFonts, pageFontFaces } from './fontLibrary';
import dmSansUrl from '@fontsource-variable/dm-sans/files/dm-sans-latin-wght-normal.woff2?url';
import dmSansItalicUrl from '@fontsource-variable/dm-sans/files/dm-sans-latin-wght-italic.woff2?url';
import manropeUrl from '@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2?url';

export type ExportFormat = 'png' | 'jpg' | 'svg' | 'pdf' | 'axis';
const dataCache = new Map<string, Promise<string>>();
async function dataUrl(url: string): Promise<string> {
  if (url.startsWith('data:')) return url;
  if (!dataCache.has(url))
    dataCache.set(
      url,
      fetch(url)
        .then((r) => {
          if (!r.ok) throw new Error('Uma imagem não pôde ser carregada.');
          return r.blob();
        })
        .then(
          (blob) =>
            new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = () => reject(reader.error);
              reader.readAsDataURL(blob);
            }),
        )
        .catch((error) => {
          dataCache.delete(url);
          throw error;
        }),
    );
  return dataCache.get(url)!;
}
export async function portableDocument(doc: DesignDocument): Promise<DesignDocument> {
  const copy = structuredClone(doc);
  const faces = await pageFontFaces(copy.pages, copy.fonts);
  if (faces.length || copy.fonts?.length) copy.fonts = mergeFonts(copy.fonts ?? [], faces);
  await Promise.all(
    copy.pages.flatMap((p) =>
      p.elements.map(async (e) => {
        if (e.src) e.src = await dataUrl(e.src);
      }),
    ),
  );
  return copy;
}
export async function svgSource(
  page: DesignPage,
  width: number,
  height: number,
  transparent = false,
  embedded: EmbeddedFont[] = [],
) {
  const faces = await pageFontFaces([page], embedded);
  const [dm, dmItalic, manrope] = await Promise.all([
    dataUrl(dmSansUrl),
    dataUrl(dmSansItalicUrl),
    dataUrl(manropeUrl),
  ]);
  const copy = structuredClone(page);
  await Promise.all(
    copy.elements.map(async (e) => {
      if (e.src) e.src = await dataUrl(e.src);
    }),
  );
  const fonts = `<defs><style>@font-face{font-family:'DM Sans';src:url('${dm}') format('woff2');font-weight:100 1000;font-style:normal}@font-face{font-family:'DM Sans';src:url('${dmItalic}') format('woff2');font-weight:100 1000;font-style:italic}@font-face{font-family:'Manrope';src:url('${manrope}') format('woff2');font-weight:200 800}${embeddedFontCss(faces)}</style></defs>`;
  let svg = renderToStaticMarkup(<Scene page={copy} width={width} height={height} />);
  if (transparent) svg = svg.replace(/<rect[^>]*fill="[^"]*"[^>]*><\/rect>/, '');
  svg = svg.replace('aria-hidden="true"', '').replace(/(<svg[^>]*>)/, `$1${fonts}`);
  return `<?xml version="1.0" encoding="UTF-8"?>${svg}`;
}
export async function rasterPage(
  page: DesignPage,
  width: number,
  height: number,
  scale = 1,
  transparent = false,
  embedded: EmbeddedFont[] = [],
) {
  if (width * height * scale * scale > 32000000)
    throw new Error('Escolha uma escala menor: o limite de exportação é 32 megapixels.');
  const svg = await svgSource(page, width, height, transparent, embedded);
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Não foi possível renderizar o design.'));
      i.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas indisponível.');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
export async function exportDocument(
  doc: DesignDocument,
  format: ExportFormat,
  pageIndexes: number[],
  scale = 1,
  transparent = false,
) {
  const name = doc.title.replace(/[<>:"/\\|?*\x00-\x1f]/g, '').trim() || 'Axis Design';
  if (format === 'axis') {
    download(
      new Blob([JSON.stringify(await portableDocument(doc), null, 2)], {
        type: 'application/json',
      }),
      `${name}.axis`,
    );
    return;
  }
  if (format === 'pdf') {
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF({
      orientation: doc.width > doc.height ? 'landscape' : 'portrait',
      unit: 'px',
      format: [doc.width, doc.height],
      hotfixes: ['px_scaling'],
    });
    for (let i = 0; i < pageIndexes.length; i++) {
      if (i)
        pdf.addPage([doc.width, doc.height], doc.width > doc.height ? 'landscape' : 'portrait');
      const canvas = await rasterPage(
        doc.pages[pageIndexes[i]],
        doc.width,
        doc.height,
        scale,
        false,
        doc.fonts,
      );
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, doc.width, doc.height);
    }
    pdf.save(`${name}.pdf`);
    return;
  }
  for (const index of pageIndexes) {
    const suffix = pageIndexes.length > 1 ? ` - ${index + 1}` : '';
    if (format === 'svg')
      download(
        new Blob(
          [await svgSource(doc.pages[index], doc.width, doc.height, transparent, doc.fonts)],
          {
            type: 'image/svg+xml',
          },
        ),
        `${name}${suffix}.svg`,
      );
    else {
      const canvas = await rasterPage(
        doc.pages[index],
        doc.width,
        doc.height,
        scale,
        format === 'png' && transparent,
        doc.fonts,
      );
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('Erro ao gerar imagem.'))),
          format === 'png' ? 'image/png' : 'image/jpeg',
          0.95,
        ),
      );
      download(blob, `${name}${suffix}.${format}`);
    }
  }
}
