import { createElement } from 'react';
import type { CSSProperties } from 'react';
import type { DesignElement, DesignPage } from './model';

let measureContext: CanvasRenderingContext2D | null = null;
export function wrapText(e: DesignElement): string[] {
  if (e.textWidth) return (e.text ?? '').split('\n');
  const size = e.fontSize ?? 48;
  if (!measureContext && typeof document !== 'undefined')
    measureContext = document.createElement('canvas').getContext('2d');
  if (measureContext)
    measureContext.font = `${e.fontStyle ?? 'normal'} ${e.fontWeight ?? 400} ${size}px "${e.fontFamily ?? 'DM Sans'}"`;
  const widthOf = (text: string) =>
    (measureContext?.measureText(text).width ?? text.length * size * 0.55) +
    Math.max(0, text.length - 1) * (e.letterSpacing ?? 0);
  const lines: string[] = [];
  const availableWidth = e.note ? Math.max(1, e.width - notePadding(e) * 2) : e.width;
  for (const paragraph of (e.text ?? '').split('\n')) {
    if (!paragraph) {
      lines.push('');
      continue;
    }
    let line = '';
    for (const word of paragraph.split(' ')) {
      const next = line ? `${line} ${word}` : word;
      if (widthOf(next) > availableWidth && line) {
        lines.push(line);
        line = word;
      } else line = next;
      // Notes wrap long URLs and unbroken words just like the live textarea.
      if (e.note && widthOf(line) > availableWidth) {
        let part = '';
        for (const character of Array.from(line)) {
          if (part && widthOf(part + character) > availableWidth) { lines.push(part); part = ''; }
          part += character;
        }
        line = part;
      }
    }
    lines.push(line);
  }
  return lines;
}
export const notePadding = (e: DesignElement) => Math.min(24, e.width * 0.075);
export function noteHeight(e: DesignElement, value = e.text ?? '') {
  if (!e.note) return e.height;
  const size = e.fontSize ?? 20;
  const padding = notePadding(e);
  const content = wrapText({ ...e, text: value }).length * size * (e.lineHeight ?? 1.35);
  return Math.min(32000, Math.max(e.note.minHeight,
    padding * 3 + content + (e.note.author ? size * 1.2 : 0) + 12));
}
export const fitNote = (e: DesignElement): DesignElement => e.note ? { ...e, height: noteHeight(e) } : e;
export function starPoints(w: number, h: number) {
  return Array.from({ length: 10 }, (_, i) => {
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    const r = i % 2 === 0 ? 0.5 : 0.23;
    return `${w / 2 + Math.cos(a) * w * r},${h / 2 + Math.sin(a) * h * r}`;
  }).join(' ');
}
export function Shape({ e, hideText = false, lines }: { e: DesignElement; hideText?: boolean; lines?: string[] }) {
  const w = e.width,
    h = e.height;
  if (e.kind === 'text' && e.note) {
    const padding = notePadding(e), fold = Math.min(14, w * 0.06);
    const size = e.fontSize ?? 20, authorSize = size * 0.62;
    const author = e.note.author.slice(0, Math.max(8, Math.floor((w - 2 * padding) / (authorSize * 0.6))));
    return <g>
      <rect y={3} width={w} height={h} fill="#263244" opacity={0.1} />
      <path d={`M0 0H${w}V${h - fold}L${w - fold} ${h}H0Z`} fill={e.note.color} />
      <path d={`M${w - fold} ${h}V${h - fold}H${w}Z`} fill="#000" opacity={0.1} />
      {!hideText && <g transform={`translate(${padding} ${padding})`}>
        <Shape e={{ ...e, note: undefined, width: w - padding * 2,
          text: e.text || 'Adicionar texto', fill: e.text ? e.fill : '#6f7055' }}
          lines={wrapText({ ...e, text: e.text || 'Adicionar texto' })} />
      </g>}
      {e.note.author && <text x={padding} y={h - padding - fold / 2} fontFamily="DM Sans"
        fontSize={authorSize} fill="#5f615b">{author}</text>}
    </g>;
  }
  const common = { fill: e.fill, stroke: e.stroke ?? 'none', strokeWidth: e.strokeWidth ?? 0 };
  switch (e.kind) {
    case 'vector': {
      const [vw, vh] = e.vectorViewBox ?? [24, 24];
      return (
        <svg
          width={w}
          height={h}
          viewBox={`0 0 ${vw} ${vh}`}
          preserveAspectRatio="none"
          fill={e.vectorStyle === 'solid' ? e.fill : 'none'}
          stroke={e.vectorStyle === 'solid' ? 'none' : e.fill}
          strokeWidth={(e.strokeWidth ?? w / 12) * Math.min(vw / w, vh / h)}
          strokeLinecap="round"
          strokeLinejoin="round"
          color={e.fill}
        >
          {e.vectorPaths?.map((path, i) => createElement(path.tag, { ...path.attrs, key: i }))}
        </svg>
      );
    }
    case 'rect':
      return <rect width={w} height={h} rx={e.radius ?? 0} {...common} />;
    case 'ellipse':
      return <ellipse cx={w / 2} cy={h / 2} rx={w / 2} ry={h / 2} {...common} />;
    case 'triangle':
      return <polygon points={`${w / 2},0 ${w},${h} 0,${h}`} {...common} />;
    case 'star':
      return <polygon points={starPoints(w, h)} {...common} />;
    case 'line':
      return (
        <line
          x1={0}
          y1={h / 2}
          x2={w}
          y2={h / 2}
          stroke={e.fill}
          strokeWidth={e.strokeWidth ?? 5}
          strokeLinecap="round"
        />
      );
    case 'image':
      return (
        <>
          <defs>
            <clipPath id={`clip-${e.id}`}>
              <rect width={w} height={h} rx={e.radius ?? 0} />
            </clipPath>
          </defs>
          <image
            href={e.src}
            width={w}
            height={h}
            preserveAspectRatio={e.imageFit === 'stretch' ? 'none' : 'xMidYMid slice'}
            clipPath={`url(#clip-${e.id})`}
            transform={e.flipX ? `translate(${w} 0) scale(-1 1)` : undefined}
          />
        </>
      );
    case 'text': {
      const align = e.textAlign ?? 'left',
        size = e.fontSize ?? 48;
      return (
        <text
          fill={e.fill}
          fontFamily={e.fontFamily ?? 'DM Sans'}
          fontSize={size}
          fontWeight={e.fontWeight ?? 400}
          fontStyle={e.fontStyle ?? 'normal'}
          textAnchor={align === 'center' ? 'middle' : align === 'right' ? 'end' : 'start'}
          letterSpacing={e.letterSpacing ?? 0}
          style={{ whiteSpace: 'pre', fontSynthesis: 'weight style' } as CSSProperties}
        >
          {(lines ?? wrapText(e)).map((line, i) => (
            <tspan
              key={i}
              x={align === 'center' ? w / 2 : align === 'right' ? w : 0}
              y={size * 0.84 + i * size * (e.lineHeight ?? 1.2)}
              textLength={e.textWidth || undefined}
              lengthAdjust={e.textWidth ? 'spacingAndGlyphs' : undefined}
            >
              {line || '\u00a0'}
            </tspan>
          ))}
        </text>
      );
    }
  }
}
export function ElementView({ e, hideText = false }: { e: DesignElement; hideText?: boolean }) {
  if (e.hidden) return null;
  return (
    <g
      transform={`translate(${e.x} ${e.y}) rotate(${e.rotation} ${e.width / 2} ${e.height / 2})`}
      opacity={e.opacity}
    >
      <Shape e={e} hideText={hideText} />
    </g>
  );
}
export function Scene({
  page,
  width,
  height,
  className,
  style,
}: {
  page: DesignPage;
  width: number;
  height: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={className}
      style={style}
      aria-hidden="true"
    >
      <rect width={width} height={height} fill={page.background} />
      {page.elements.map((e) => (
        <ElementView key={e.id} e={e} />
      ))}
    </svg>
  );
}
