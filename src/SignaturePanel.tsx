import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowLeft, Check, LoaderCircle, RotateCcw, Trash2, UploadCloud, X } from 'lucide-react';
import type { DesignElement } from './model';
import { element } from './model';
import { ElementView } from './Scene';
import { ensureFont } from './fontLibrary';
import { drawnSignature, savedSignatures, signatureCopy, signatureFonts, smoothStroke, typedSignature } from './drawingAssets';
import type { StrokePoint } from './drawingAssets';
import './drawing.css';

interface Props {
  account: string; onClose: () => void; onInsert: (asset: DesignElement) => void;
  resizeHandle?: ReactNode; toast: (message: string) => void;
}
export function SignaturePanel({ account, onClose, onInsert, resizeHandle, toast }: Props) {
  const [tab, setTab] = useState<'text' | 'draw' | 'upload'>('text');
  const [name, setName] = useState(account.replace(/[_.]/g, ' '));
  const [fontIndex, setFontIndex] = useState(0);
  const [color, setColor] = useState('#181b22');
  const [fontReady, setFontReady] = useState(false);
  const [strokes, setStrokes] = useState<StrokePoint[][]>([]);
  const stroke = useRef<{ id: number; points: StrokePoint[] } | null>(null);
  const [draft, setDraft] = useState<StrokePoint[]>([]);
  const [uploaded, setUploaded] = useState<DesignElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [save, setSave] = useState(true);
  const [saved, setSaved] = useState(() => savedSignatures(account));
  const [, refreshSavedFonts] = useState(0);
  const upload = useRef<HTMLInputElement>(null);
  const font = signatureFonts[fontIndex];
  useEffect(() => {
    let active = true;
    setFontReady(false); setError('');
    void ensureFont(font.family, font.weight, font.style).then(() => { if (active) setFontReady(true); })
      .catch(() => { if (active) setError('Não foi possível carregar esta fonte. Escolha outra.'); });
    return () => { active = false; };
  }, [font]);
  useEffect(() => {
    let active = true;
    void Promise.all(saved.filter(e => e.kind === 'text').map(e =>
      ensureFont(e.fontFamily ?? 'DM Sans', e.fontWeight ?? 400, e.fontStyle ?? 'normal').catch(() => null)))
      .then(() => { if (active) refreshSavedFonts(n => n + 1); });
    return () => { active = false; };
  }, [saved]);
  const asset = tab === 'text' ? (fontReady ? typedSignature(name.slice(0, 120), fontIndex, color) : null)
    : tab === 'draw' ? drawnSignature(strokes, color) : uploaded;
  const insert = (value: DesignElement, remember = save) => {
    if (remember) {
      const next = [signatureCopy(value), ...saved].slice(0, 8);
      try { localStorage.setItem(`axis-signatures:${account}`, JSON.stringify(next)); setSaved(next); }
      catch { toast('Assinatura pronta. Não houve espaço no navegador para salvar um atalho.'); }
    }
    onInsert(signatureCopy(value));
  };
  const point = (event: React.PointerEvent<SVGSVGElement>): StrokePoint => {
    const matrix = event.currentTarget.getScreenCTM();
    const location = matrix ? new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse()) : { x: 0, y: 0 };
    return { x: Math.max(0, Math.min(600, location.x)), y: Math.max(0, Math.min(240, location.y)) };
  };
  const receiveUpload = async (file?: File) => {
    if (!file || busy) return;
    setError(''); setBusy(true);
    try {
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024)
        throw new Error('Escolha PNG, JPG ou WebP de até 5 MB.');
      let src = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Não foi possível ler a assinatura.')); reader.readAsDataURL(file);
      });
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image(); img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Esta imagem não pôde ser aberta.')); img.src = src;
      });
      let width = image.naturalWidth, height = image.naturalHeight;
      if (!width || !height) throw new Error('Esta imagem não pôde ser aberta.');
      if (Math.max(width, height) > 1200) {
        const scale = 1200 / Math.max(width, height);
        width = Math.max(1, Math.round(width * scale)); height = Math.max(1, Math.round(height * scale));
        const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Não foi possível preparar a imagem.');
        context.drawImage(image, 0, 0, width, height); src = canvas.toDataURL('image/png');
      }
      setUploaded(element('image', { name: 'Assinatura enviada', src, x: 0, y: 0, width, height }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível abrir a assinatura.'); }
    finally { setBusy(false); if (upload.current) upload.current.value = ''; }
  };
  return <aside className="editor-panel signature-panel" aria-label="Criar assinatura">
    {resizeHandle}
    <header className="signature-heading">
      <button aria-label="Voltar às ferramentas de desenho" onClick={onClose}><ArrowLeft size={18} /></button>
      <h2>Criar assinatura</h2><button aria-label="Fechar assinatura" onClick={onClose}><X size={19} /></button>
    </header>
    <div className="signature-tabs" role="tablist" aria-label="Tipo de assinatura">
      {([['text', 'Texto'], ['draw', 'Desenho'], ['upload', 'Fazer upload']] as const).map(([id, label]) =>
        <button key={id} id={`signature-tab-${id}`} role="tab" aria-selected={tab === id}
          aria-controls="signature-tab-content" className={tab === id ? 'active' : ''}
          onClick={() => { setTab(id); setError(''); }}>{label}</button>)}
    </div>
    <div className="signature-content" id="signature-tab-content" role="tabpanel" aria-labelledby={`signature-tab-${tab}`}>
      {tab === 'draw' ? <>
        <svg className="signature-preview signature-pad" viewBox="0 0 600 240" aria-label="Área para desenhar assinatura"
          onPointerDown={event => {
            if (event.button !== 0 || stroke.current) return;
            event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
            stroke.current = { id: event.pointerId, points: [point(event)] }; setDraft([...stroke.current.points]);
          }}
          onPointerMove={event => {
            if (stroke.current?.id !== event.pointerId) return;
            stroke.current.points.push(point(event)); setDraft([...stroke.current.points]);
          }}
          onPointerUp={event => {
            if (stroke.current?.id !== event.pointerId) return;
            stroke.current.points.push(point(event));
            const completed = [...stroke.current.points];
            setStrokes(previous => [...previous, completed]); stroke.current = null; setDraft([]);
            event.currentTarget.releasePointerCapture(event.pointerId);
          }}
          onPointerCancel={() => { stroke.current = null; setDraft([]); }}>
          {!strokes.length && !draft.length && <text x="300" y="130" textAnchor="middle" fontSize="24" fill="#8790a0">Assine aqui com o mouse ou o dedo</text>}
          <path d="M40 196H560" stroke="#cdd3de" strokeDasharray="6 6" fill="none" />
          {[...strokes, draft].filter(s => s.length).map((s, i) =>
            <path key={i} d={smoothStroke(s)} fill="none" stroke={color} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />)}
        </svg>
        <div className="signature-pad-actions">
          <button disabled={!strokes.length} onClick={() => setStrokes(previous => previous.slice(0, -1))}><RotateCcw size={15} /> Desfazer traço</button>
          <button disabled={!strokes.length} onClick={() => setStrokes([])}><Trash2 size={15} /> Limpar</button>
        </div>
      </> : <div className="signature-preview" aria-label="Prévia da assinatura">
        {asset ? <svg viewBox={`-12 -12 ${asset.width + 24} ${asset.height + 24}`}><ElementView e={asset} /></svg>
          : busy || (tab === 'text' && !fontReady) ? <LoaderCircle className="spin" size={24} />
          : <span>{tab === 'text' ? 'Digite seu nome para começar' : 'Envie uma imagem da sua assinatura'}</span>}
      </div>}
      {tab === 'text' && <>
        <label className="signature-field">Nome completo<input aria-label="Nome completo da assinatura" maxLength={120} value={name} onChange={e => setName(e.target.value)} /></label>
        <label className="signature-field">Fonte<select aria-label="Fonte da assinatura" value={fontIndex} onChange={e => setFontIndex(Number(e.target.value))}>
          {signatureFonts.map((f, i) => <option key={f.label} value={i}>{f.label}</option>)}
        </select></label>
      </>}
      {tab === 'upload' && <>
        <input ref={upload} hidden type="file" aria-label="Enviar imagem da assinatura" accept="image/png,image/jpeg,image/webp" onChange={e => void receiveUpload(e.target.files?.[0])} />
        <button className="signature-upload" disabled={busy} onClick={() => upload.current?.click()}><UploadCloud size={19} /> {uploaded ? 'Substituir imagem' : 'Escolher imagem'}</button>
        <p className="signature-hint">PNG com transparência funciona melhor. Também aceita JPG e WebP.</p>
      </>}
      {tab !== 'upload' && <div className="signature-field">Cor
        <div className="signature-colors">{['#181b22', '#275cb6', '#7e4145'].map(c =>
          <button key={c} aria-label={`Cor da assinatura ${c}`} aria-pressed={color === c} style={{ background: c }} onClick={() => setColor(c)} />)}
          <label className="signature-custom-color" title="Escolher outra cor"><input type="color" aria-label="Cor personalizada da assinatura" value={color} onChange={e => setColor(e.target.value)} /></label>
        </div>
      </div>}
      {error && <p role="alert" className="signature-error">{error}</p>}
      <label className="signature-save"><input type="checkbox" checked={save} onChange={e => setSave(e.target.checked)} /><span>Salvar assinatura para usar novamente<small>Disponível nesta conta e neste navegador.</small></span></label>
      <button className="primary signature-insert" disabled={!asset || busy} onClick={() => asset && insert(asset)}><Check size={18} /> Usar assinatura</button>
      {!!saved.length && <section className="saved-signatures"><h3>Suas assinaturas</h3>
        {saved.map((value, i) => <div className="saved-signature" key={value.id}>
          <button aria-label={`Usar assinatura salva ${i + 1}`} onClick={() => insert(value, false)}>
            <svg viewBox={`-8 -8 ${value.width + 16} ${value.height + 16}`}><ElementView e={value} /></svg>
          </button>
          <button aria-label={`Excluir assinatura salva ${i + 1}`} onClick={() => {
            const next = saved.filter((_, index) => i !== index);
            try { localStorage.setItem(`axis-signatures:${account}`, JSON.stringify(next)); setSaved(next); }
            catch { toast('Não foi possível atualizar as assinaturas salvas.'); }
          }}><Trash2 size={15} /></button>
        </div>)}
      </section>}
    </div>
  </aside>;
}
