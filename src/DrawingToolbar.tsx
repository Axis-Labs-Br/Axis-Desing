import { useState } from 'react';
import type { CSSProperties } from 'react';
import { MousePointer2, Pencil, Highlighter, Eraser, Minus, StickyNote, Type, Signature, Table2, X } from 'lucide-react';
import type { DesignElement, DrawingTool } from './model';
import { noteColors } from './drawingAssets';
import './drawing.css';

interface Props {
  tool: DrawingTool; color: string; width: number; placement: DesignElement | null;
  onTool: (tool: DrawingTool) => void; onColor: (color: string) => void;
  onWidth: (width: number) => void; onNote: (color: string) => void;
  onText: () => void; onSignature: () => void; onTable: () => void; onClose: () => void;
}
export function DrawingToolbar({ tool, color, width, placement, onTool, onColor, onWidth,
  onNote, onText, onSignature, onTable, onClose }: Props) {
  const [popup, setPopup] = useState<'pen' | 'notes' | null>(null);
  const chooseTool = (next: DrawingTool) => {
    onTool(next);
    setPopup(next === 'select' || next === 'eraser' ? null : 'pen');
  };
  return <div className="floating-tools" onWheel={event => event.stopPropagation()}
    onPointerDown={event => event.stopPropagation()}>
    <button className="floating-tools-close" aria-label="Fechar ferramentas de desenho" onClick={onClose}><X size={16} /></button>
    <div className="drawing-rail" role="toolbar" aria-label="Ferramentas de desenho">
      {([
        ['select', 'Selecionar', MousePointer2], ['pencil', 'Lápis', Pencil],
        ['marker', 'Marca-texto', Highlighter], ['eraser', 'Borracha de desenho', Eraser], ['line', 'Linha', Minus],
      ] as const).map(([value, label, Icon]) => <button key={value} title={label} aria-label={label}
        aria-pressed={tool === value && !placement} className={tool === value && !placement ? 'active' : ''}
        onClick={() => chooseTool(value)}><Icon size={22} className={`drawing-icon-${value}`} /></button>)}
      <span className="drawing-rail-divider" />
      <button title="Nota adesiva" aria-label="Nota adesiva" aria-expanded={popup === 'notes'}
        className={placement?.note || popup === 'notes' ? 'active' : ''}
        onClick={() => setPopup(popup === 'notes' ? null : 'notes')}><StickyNote size={23} fill="#ffe335" color="#ffe335" /></button>
      <button title="Adicionar texto" aria-label="Adicionar texto" onClick={onText}><Type size={23} color="#ce8eff" /></button>
      <button title="Criar assinatura" aria-label="Criar assinatura" onClick={() => { setPopup(null); onSignature(); }}><Signature size={24} /></button>
      <button title="Tabela 2 × 3" aria-label="Tabela 2 × 3" onClick={onTable}><Table2 size={21} /></button>
    </div>
    {popup === 'notes' && <div className="drawing-note-palette" role="group" aria-label="Cores de notas adesivas">
      {noteColors.map((value, i) => <button key={value} aria-label={`Criar nota ${['amarela', 'laranja', 'rosa', 'azul', 'verde', 'lilás'][i]}`}
        aria-pressed={placement?.note?.color === value} onClick={() => onNote(value)}
        style={{ '--note-swatch': value } as CSSProperties}><StickyNote size={25} fill={value} color={value} /></button>)}
    </div>}
    {popup === 'pen' && <div className="drawing-settings" role="group" aria-label="Ajustes do desenho">
      <div className="drawing-settings-heading"><strong>{tool === 'marker' ? 'Marca-texto' : tool === 'line' ? 'Linha' : 'Lápis'}</strong>
        <button aria-label="Fechar ajustes do desenho" onClick={() => setPopup(null)}><X size={15} /></button></div>
      <label>Cor do traço <input aria-label="Cor do traço" type="color" value={color} onChange={e => onColor(e.target.value)} /></label>
      <label>Espessura <span>{width}px</span></label>
      <input aria-label="Espessura do traço" type="range" min="1" max="48" value={width} onChange={e => onWidth(Number(e.target.value))} />
      <div className="drawing-color-presets">{['#253041', '#e94756', '#376ee8', '#43aa73', '#f3c84f'].map(c =>
        <button key={c} aria-label={`Usar cor ${c}`} style={{ background: c }} onClick={() => onColor(c)} />)}</div>
    </div>}
  </div>;
}
