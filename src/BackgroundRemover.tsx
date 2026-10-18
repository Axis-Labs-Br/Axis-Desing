import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { Eraser, LoaderCircle, RotateCcw, Sparkles, Undo2 } from 'lucide-react';
import { Modal } from './ui';
import { detectCornerBackground } from './backgroundRemoval';
import type { BackgroundColor } from './backgroundRemoval';

interface Props {
  src: string;
  onClose: () => void;
  onApply: (src: string) => Promise<boolean>;
}

interface SourceImage {
  image: HTMLImageElement;
  width: number;
  height: number;
  fit: { x: number; y: number; width: number; height: number };
  inputPixels: Uint8ClampedArray;
  previewPixels: Uint8ClampedArray;
}

type WorkerMessage =
  | { type: 'progress'; id: number; stage: 'download' | 'model' | 'inference'; progress: number }
  | { type: 'result'; id: number; mask: ArrayBuffer }
  | { type: 'error'; id: number; message: string };
type ColorWorkerMessage =
  | { type: 'ready' }
  | { type: 'mask'; id: number; mask: ArrayBuffer }
  | { type: 'error'; id: number };

const MODEL_SIDE = 1024;
const MAX_PREVIEW_SIDE = 1200;
const MAX_OUTPUT_PIXELS = 30_000_000;

export function BackgroundRemover({ src, onClose, onApply }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sourceRef = useRef<SourceImage | null>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const manualRemoveRef = useRef<Uint8Array | null>(null);
  const manualRestoreRef = useRef<Uint8Array | null>(null);
  const lastBrushPointRef = useRef<{ x: number; y: number } | null>(null);
  const manualFrameRef = useRef<number | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const colorWorkerRef = useRef<Worker | null>(null);
  const requestId = useRef(0);
  const colorRequestId = useRef(0);
  const modeRef = useRef<'smart' | 'color'>('smart');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [previewReady, setPreviewReady] = useState(false);
  const [error, setError] = useState('');
  const [mask, setMask] = useState<Uint8Array | null>(null);
  const [manualMask, setManualMask] = useState<Uint8Array | null>(null);
  const [mode, setMode] = useState<'smart' | 'color'>('smart');
  const [color, setColor] = useState<BackgroundColor | null>(null);
  const [picking, setPicking] = useState(false);
  const [stage, setStage] = useState<'download' | 'model' | 'inference'>('download');
  const [progress, setProgress] = useState(0);
  const [manualEditing, setManualEditing] = useState(false);
  const [brushAction, setBrushAction] = useState<'remove' | 'restore'>('remove');
  const [brushSize, setBrushSize] = useState(34);
  const [manualRevision, setManualRevision] = useState(0);
  const [applying, setApplying] = useState(false);
  const [sensitivity, setSensitivity] = useState(50);
  const [feather, setFeather] = useState(18);
  modeRef.current = mode;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setProcessing(true);
    setError('');
    setMask(null);
    setManualMask(null);
    setPreviewReady(false);
    setManualEditing(false);
    setApplying(false);
    setProgress(0);
    const image = new Image();
    image.onload = () => {
      if (!active) return;
      try {
        const scale = Math.min(1, MAX_PREVIEW_SIDE / Math.max(image.naturalWidth, image.naturalHeight));
        const width = Math.max(1, Math.round(image.naturalWidth * scale));
        const height = Math.max(1, Math.round(image.naturalHeight * scale));
        const preview = document.createElement('canvas');
        preview.width = width;
        preview.height = height;
        const previewContext = preview.getContext('2d', { willReadFrequently: true });
        if (!previewContext) throw new Error('Não foi possível preparar a imagem para edição.');
        previewContext.drawImage(image, 0, 0, width, height);

        const fitScale = Math.min(MODEL_SIDE / image.naturalWidth, MODEL_SIDE / image.naturalHeight);
        const fitWidth = Math.max(1, Math.round(image.naturalWidth * fitScale));
        const fitHeight = Math.max(1, Math.round(image.naturalHeight * fitScale));
        const fit = {
          x: Math.floor((MODEL_SIDE - fitWidth) / 2),
          y: Math.floor((MODEL_SIDE - fitHeight) / 2),
          width: fitWidth,
          height: fitHeight,
        };
        const input = document.createElement('canvas');
        input.width = MODEL_SIDE;
        input.height = MODEL_SIDE;
        const inputContext = input.getContext('2d', { willReadFrequently: true });
        if (!inputContext) throw new Error('Não foi possível preparar a imagem para a IA.');
        inputContext.fillStyle = 'rgb(127, 127, 127)';
        inputContext.fillRect(0, 0, MODEL_SIDE, MODEL_SIDE);
        inputContext.drawImage(image, fit.x, fit.y, fit.width, fit.height);
        const inputPixels = inputContext.getImageData(0, 0, MODEL_SIDE, MODEL_SIDE).data;
        const previewPixels = previewContext.getImageData(0, 0, width, height).data;
        sourceRef.current = { image, width, height, fit, inputPixels, previewPixels };
        manualRemoveRef.current = new Uint8Array(width * height).fill(255);
        manualRestoreRef.current = new Uint8Array(width * height);
        setManualRevision((revision) => revision + 1);
        setColor(detectCornerBackground(previewPixels, width, height));
        const canvas = canvasRef.current;
        if (canvas) {
          canvas.width = width;
          canvas.height = height;
          canvas.getContext('2d')?.drawImage(preview, 0, 0);
        }
        setLoading(false);
        const colorWorker = new Worker(new URL('./backgroundRemoval.worker.ts', import.meta.url), { type: 'module' });
        const colorPixels = new Uint8ClampedArray(previewPixels).buffer;
        colorWorker.postMessage({ type: 'init', width, height, pixels: colorPixels }, [colorPixels]);
        colorWorker.onmessage = (event: MessageEvent<ColorWorkerMessage>) => {
          if (event.data.type === 'mask' && event.data.id === colorRequestId.current) {
            setManualMask(new Uint8Array(event.data.mask));
          } else if (event.data.type === 'error' && event.data.id === colorRequestId.current && modeRef.current === 'color') {
            setError('O recorte por cor não pôde ser concluído. Selecione outra cor do fundo.');
          }
        };
        colorWorkerRef.current?.terminate();
        colorWorkerRef.current = colorWorker;
      } catch (caught) {
        setError(
          caught instanceof Error && caught.name === 'SecurityError'
            ? 'O navegador bloqueou esta imagem para processamento. Envie uma cópia do arquivo.'
            : caught instanceof Error
              ? caught.message
              : 'Não foi possível abrir esta imagem.',
        );
        setLoading(false);
        setProcessing(false);
      }
    };
    image.onerror = () => {
      if (!active) return;
      setError('Não foi possível abrir esta imagem para remover o fundo.');
      setLoading(false);
      setProcessing(false);
    };
    image.src = src;
    return () => {
      active = false;
      workerRef.current?.terminate();
      workerRef.current = null;
      colorWorkerRef.current?.terminate();
      colorWorkerRef.current = null;
      sourceRef.current = null;
      maskCanvasRef.current = null;
      manualRemoveRef.current = null;
      manualRestoreRef.current = null;
      if (manualFrameRef.current !== null) cancelAnimationFrame(manualFrameRef.current);
      manualFrameRef.current = null;
    };
  }, [src]);

  useEffect(() => {
    const source = sourceRef.current;
    if (loading || mode !== 'smart' || !source || mask) return;
    let active = true;
    setError('');
    setProcessing(true);
    const id = ++requestId.current;
    const worker = new Worker(new URL('./backgroundRemoval.ai.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      if (!active || event.data.id !== requestId.current) return;
      if (event.data.type === 'progress') {
        setStage(event.data.stage);
        setProgress(event.data.progress);
      } else if (event.data.type === 'result') {
        setMask(new Uint8Array(event.data.mask));
        setProcessing(false);
      } else {
        setError(event.data.message || 'O recorte inteligente não pôde ser concluído.');
        setProcessing(false);
      }
    };
    worker.onerror = () => {
      if (active) {
        setError('A IA de recorte não carregou. Confira a conexão e tente novamente.');
        setProcessing(false);
      }
    };
    workerRef.current?.terminate();
    workerRef.current = worker;
    const pixels = new Uint8ClampedArray(source.inputPixels).buffer;
    worker.postMessage({ type: 'segment', id, pixels }, [pixels]);
    return () => {
      active = false;
      worker.terminate();
      if (workerRef.current === worker) workerRef.current = null;
      setProcessing(false);
    };
  }, [loading, mask, mode, src]);

  useEffect(() => {
    if (mode !== 'color' || !color || loading || !colorWorkerRef.current) return;
    setError('');
    const id = ++colorRequestId.current;
    const timer = window.setTimeout(() => {
      colorWorkerRef.current?.postMessage({ type: 'process', id, color, sensitivity: sensitivity * 1.5, feather: feather * 0.75 });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [color, feather, loading, mode, sensitivity]);

  useEffect(() => {
    const source = sourceRef.current;
    const canvas = canvasRef.current;
    if (!source || !canvas) return;
    if (canvas.width !== source.width) canvas.width = source.width;
    if (canvas.height !== source.height) canvas.height = source.height;
    const context = canvas.getContext('2d');
    if (!context) return;
    setPreviewReady(false);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(source.image, 0, 0, source.width, source.height);
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = source.width;
    maskCanvas.height = source.height;
    const maskContext = maskCanvas.getContext('2d', { willReadFrequently: true });
    if (!maskContext) return;

    if (mode === 'color') {
      if (!manualMask || manualMask.length !== source.width * source.height) {
        maskCanvasRef.current = null;
        return;
      }
      const alpha = new Uint8ClampedArray(manualMask.length * 4);
      for (let pixel = 0; pixel < manualMask.length; pixel++) {
        const offset = pixel * 4;
        alpha[offset] = alpha[offset + 1] = alpha[offset + 2] = 255;
        alpha[offset + 3] = manualMask[pixel];
      }
      maskContext.putImageData(new ImageData(alpha, source.width, source.height), 0, 0);
    } else {
      if (!mask || mask.length !== MODEL_SIDE * MODEL_SIDE) {
        maskCanvasRef.current = null;
        return;
      }
      const modelCanvas = document.createElement('canvas');
      modelCanvas.width = MODEL_SIDE;
      modelCanvas.height = MODEL_SIDE;
      const modelContext = modelCanvas.getContext('2d');
      if (!modelContext) return;
      const alpha = new Uint8ClampedArray(mask.length * 4);
      const threshold = Math.max(25, Math.min(225, 90 + (sensitivity - 50) * 1.45));
      const softness = 1 + feather * 1.15;
      const low = threshold - softness;
      const high = threshold + softness;
      for (let pixel = 0; pixel < mask.length; pixel++) {
        const value = mask[pixel];
        const t = Math.max(0, Math.min(1, (value - low) / (high - low)));
        const smooth = t * t * (3 - 2 * t);
        const offset = pixel * 4;
        alpha[offset] = alpha[offset + 1] = alpha[offset + 2] = 255;
        alpha[offset + 3] = Math.round(smooth * 255);
      }
      modelContext.putImageData(new ImageData(alpha, MODEL_SIDE, MODEL_SIDE), 0, 0);
      maskContext.drawImage(
        modelCanvas,
        source.fit.x,
        source.fit.y,
        source.fit.width,
        source.fit.height,
        0,
        0,
        source.width,
        source.height,
      );
    }

    const maskPixels = maskContext.getImageData(0, 0, source.width, source.height);
    const remove = manualRemoveRef.current;
    const restore = manualRestoreRef.current;
    if (remove && restore && remove.length === source.width * source.height) {
      for (let pixel = 0; pixel < remove.length; pixel++) {
        const offset = pixel * 4 + 3;
        maskPixels.data[offset] = Math.max(
          Math.round((maskPixels.data[offset] * remove[pixel]) / 255),
          restore[pixel],
        );
      }
      maskContext.putImageData(maskPixels, 0, 0);
    }

    maskCanvasRef.current = maskCanvas;
    context.globalCompositeOperation = 'destination-in';
    context.drawImage(maskCanvas, 0, 0);
    context.globalCompositeOperation = 'source-over';
    setPreviewReady(true);
  }, [feather, loading, manualMask, manualRevision, mask, mode, sensitivity]);

  const apply = async () => {
    const source = sourceRef.current;
    const maskCanvas = maskCanvasRef.current;
    if (!source || !maskCanvas || !previewReady || (mode === 'smart' ? !mask : !manualMask) || (mode === 'smart' && processing)) return;
    const width = source.image.naturalWidth;
    const height = source.image.naturalHeight;
    if (width * height > MAX_OUTPUT_PIXELS) {
      setError('Esta imagem é grande demais para criar o recorte. Reduza a imagem e tente novamente.');
      return;
    }
    const output = document.createElement('canvas');
    output.width = width;
    output.height = height;
    const context = output.getContext('2d');
    if (!context) {
      setError('Não foi possível criar a imagem final.');
      return;
    }
    context.drawImage(source.image, 0, 0, width, height);
    context.globalCompositeOperation = 'destination-in';
    context.drawImage(maskCanvas, 0, 0, width, height);
    try {
      setApplying(true);
      setError('');
      const applied = await onApply(output.toDataURL('image/png'));
      if (!applied) setError('A imagem processada não foi aplicada. Confira se o elemento continua selecionado e tente novamente.');
    } catch {
      setError('O navegador não conseguiu guardar a imagem processada. Tente usar uma imagem menor.');
    } finally {
      setApplying(false);
    }
  };

  const paintPoint = (point: { x: number; y: number }, radius: number) => {
    const source = sourceRef.current;
    const remove = manualRemoveRef.current;
    const restore = manualRestoreRef.current;
    if (!source || !remove || !restore) return;
    const edge = Math.max(1, radius * 0.24);
    const left = Math.max(0, Math.floor(point.x - radius - edge));
    const right = Math.min(source.width - 1, Math.ceil(point.x + radius + edge));
    const top = Math.max(0, Math.floor(point.y - radius - edge));
    const bottom = Math.min(source.height - 1, Math.ceil(point.y + radius + edge));
    for (let y = top; y <= bottom; y++) {
      for (let x = left; x <= right; x++) {
        const distance = Math.hypot(x - point.x, y - point.y);
        const coverage = Math.max(0, Math.min(255, Math.round(((radius + edge - distance) / edge) * 255)));
        if (!coverage) continue;
        const pixel = y * source.width + x;
        if (brushAction === 'remove') {
          remove[pixel] = Math.min(remove[pixel], 255 - coverage);
          restore[pixel] = Math.round((restore[pixel] * (255 - coverage)) / 255);
        } else {
          restore[pixel] = Math.max(restore[pixel], coverage);
          remove[pixel] = 255 - Math.round(((255 - remove[pixel]) * (255 - coverage)) / 255);
        }
      }
    }
    scheduleManualPreview();
  };

  const scheduleManualPreview = () => {
    if (manualFrameRef.current !== null) return;
    manualFrameRef.current = requestAnimationFrame(() => {
      manualFrameRef.current = null;
      setManualRevision((revision) => revision + 1);
    });
  };

  const canvasPoint = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const source = sourceRef.current;
    const rect = event.currentTarget.getBoundingClientRect();
    return source
      ? {
          x: Math.max(0, Math.min(source.width - 1, ((event.clientX - rect.left) / rect.width) * source.width)),
          y: Math.max(0, Math.min(source.height - 1, ((event.clientY - rect.top) / rect.height) * source.height)),
          radius: (brushSize * source.width) / rect.width / 2,
        }
      : null;
  };

  const startBrush = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!manualEditing) return;
    const point = canvasPoint(event);
    if (!point) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    lastBrushPointRef.current = point;
    paintPoint(point, point.radius);
  };

  const moveBrush = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const previous = lastBrushPointRef.current;
    if (!manualEditing || !previous) return;
    const point = canvasPoint(event);
    if (!point) return;
    const distance = Math.hypot(point.x - previous.x, point.y - previous.y);
    const steps = Math.max(1, Math.ceil(distance / Math.max(1, point.radius * 0.32)));
    for (let step = 1; step <= steps; step++) {
      const ratio = step / steps;
      paintPoint(
        { x: previous.x + (point.x - previous.x) * ratio, y: previous.y + (point.y - previous.y) * ratio },
        point.radius,
      );
    }
    lastBrushPointRef.current = point;
  };

  const finishBrush = () => {
    if (!lastBrushPointRef.current) return;
    lastBrushPointRef.current = null;
    scheduleManualPreview();
  };

  const resetManualBrush = () => {
    const source = sourceRef.current;
    if (!source) return;
    manualRemoveRef.current = new Uint8Array(source.width * source.height).fill(255);
    manualRestoreRef.current = new Uint8Array(source.width * source.height);
    if (manualFrameRef.current !== null) cancelAnimationFrame(manualFrameRef.current);
    manualFrameRef.current = null;
    setManualRevision((revision) => revision + 1);
    setManualEditing(false);
  };

  const pickColor = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const source = sourceRef.current;
    if (!source || !picking || mode !== 'color' || manualEditing) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(source.width - 1, Math.floor(((event.clientX - rect.left) / rect.width) * source.width)));
    const y = Math.max(0, Math.min(source.height - 1, Math.floor(((event.clientY - rect.top) / rect.height) * source.height)));
    const offset = (y * source.width + x) * 4;
    setColor({ r: source.previewPixels[offset], g: source.previewPixels[offset + 1], b: source.previewPixels[offset + 2], sampleX: x, sampleY: y });
    setPicking(false);
  };

  const activeMask = mode === 'smart' ? mask : manualMask;

  const status =
    stage === 'download'
      ? progress > 0
        ? `Baixando o modelo de recorte… ${progress}%`
        : 'Baixando o modelo de recorte (cerca de 46 MB)…'
      : stage === 'model'
        ? 'Preparando o modelo de IA…'
        : 'Analisando a imagem…';

  return (
    <Modal
      title="Remover fundo da imagem"
      subtitle="A IA identifica pessoas e objetos mesmo com sombras e degradês; sua imagem é processada no navegador. No primeiro uso, o navegador carrega cerca de 46 MB do modelo e 27 MB do runtime."
      onClose={onClose}
      wide
    >
      <div className="background-remover">
        <div className="background-remover-preview checkerboard">
          {loading ? (
            <div className="background-remover-state"><LoaderCircle className="spin" /> Abrindo imagem…</div>
          ) : (
            <canvas
              ref={canvasRef}
              aria-label="Prévia do recorte inteligente com transparência"
              className={`${picking ? 'picking' : ''}${manualEditing ? ' painting' : ''}`}
              onClick={pickColor}
              onPointerDown={startBrush}
              onPointerMove={moveBrush}
              onPointerUp={finishBrush}
              onPointerCancel={finishBrush}
            />
          )}
        </div>
        <div className="background-remover-controls">
          <div className="background-remover-mode-tabs" role="tablist" aria-label="Modo de remoção de fundo">
            <button type="button" role="tab" aria-selected={mode === 'smart'} className={mode === 'smart' ? 'active' : ''} onClick={() => { setMode('smart'); setError(''); setPicking(false); }}><Sparkles size={14} /> Inteligente</button>
            <button type="button" role="tab" aria-selected={mode === 'color'} className={mode === 'color' ? 'active' : ''} onClick={() => { setMode('color'); setError(''); setPicking(false); }}><Eraser size={14} /> Cor uniforme</button>
          </div>
          <div className="background-remover-heading">{mode === 'smart' ? <><Sparkles size={16} /> Recorte inteligente</> : <><Eraser size={16} /> Recorte por cor</>}</div>
          <p className="background-remover-copy">
            {manualEditing
              ? brushAction === 'remove'
                ? 'Pinte sobre as partes da imagem que ainda devem sair. Solte o mouse para atualizar a prévia.'
                : 'Pinte sobre detalhes do objeto que a IA removeu para recuperá-los.'
              : mode === 'smart'
              ? 'A segmentação separa o primeiro plano do fundo por forma e contexto, sem depender de uma cor uniforme.'
              : picking
                ? 'Clique na área do fundo que você quer remover.'
                : 'Ideal para fundos de cor uniforme. Selecione outra cor caso o fundo tenha tons diferentes.'}
          </p>
          {mode === 'color' && (
            <>
              <button type="button" className="secondary background-remover-sample" onClick={() => setPicking(true)} disabled={loading}>
                {picking ? 'Clique no fundo da imagem' : 'Selecionar cor do fundo'}
              </button>
              {color && <div className="background-remover-color"><span style={{ backgroundColor: `rgb(${color.r}, ${color.g}, ${color.b})` }} /> Cor selecionada <code>#{[color.r, color.g, color.b].map((v) => v.toString(16).padStart(2, '0')).join('')}</code></div>}
            </>
          )}
          <div className="background-remover-brush-tools">
            <div className="background-remover-brush-actions" role="group" aria-label="Pincel manual">
              <button type="button" className={manualEditing && brushAction === 'remove' ? 'active' : ''} onClick={() => { setBrushAction('remove'); setManualEditing(true); setPicking(false); }} disabled={loading}>
                <Eraser size={14} /> Marcar para remover
              </button>
              <button type="button" className={manualEditing && brushAction === 'restore' ? 'active' : ''} onClick={() => { setBrushAction('restore'); setManualEditing(true); setPicking(false); }} disabled={loading}>
                <Undo2 size={14} /> Restaurar área
              </button>
            </div>
            {manualEditing && <>
              <label className="background-remover-slider">
                Tamanho do pincel <strong>{brushSize}px</strong>
                <input aria-label="Tamanho do pincel manual" type="range" min="8" max="120" value={brushSize} onChange={(event) => setBrushSize(Number(event.target.value))} />
              </label>
              <button type="button" className="text-button background-remover-reset" onClick={resetManualBrush}>
                <RotateCcw size={14} /> Limpar marcações
              </button>
            </>}
          </div>
          <label className="background-remover-slider">
            Sensibilidade <strong>{sensitivity}</strong>
            <input
              aria-label="Sensibilidade do recorte"
              type="range"
              min="0"
              max="100"
              value={sensitivity}
              onChange={(event) => setSensitivity(Number(event.target.value))}
              disabled={mode === 'smart' ? !mask : !manualMask}
            />
            <span>{mode === 'smart' ? 'Aumente se sobrar fundo; diminua para recuperar detalhes do objeto.' : 'Aumente para incluir tons de fundo próximos à cor escolhida.'}</span>
          </label>
          <label className="background-remover-slider">
            Suavizar bordas <strong>{feather}</strong>
            <input
              aria-label="Suavização das bordas"
              type="range"
              min="0"
              max="48"
              value={feather}
              onChange={(event) => setFeather(Number(event.target.value))}
              disabled={mode === 'smart' ? !mask : !manualMask}
            />
            <span>Suaviza cabelos e contornos para reduzir o halo.</span>
          </label>
          <button
            type="button"
            className="text-button background-remover-reset"
            onClick={() => {
              setSensitivity(50);
              setFeather(18);
              resetManualBrush();
              const source = sourceRef.current;
              if (source && mode === 'color') setColor(detectCornerBackground(source.previewPixels, source.width, source.height));
              setError('');
            }}
          >
            <RotateCcw size={14} /> Restaurar ajustes
          </button>
        </div>
      </div>
      {(error || (processing && mode === 'smart')) && (
        <p className={error ? 'error-message' : 'background-remover-status'} role={error ? 'alert' : 'status'}>
          {error ? (
            error
          ) : (
            <><LoaderCircle size={14} className="spin" /> {status}</>
          )}
        </p>
      )}
      <div className="modal-footer">
        <span className="background-remover-local-note"><Eraser size={14} /> Imagem processada localmente</span>
        <button className="secondary" onClick={onClose}>Cancelar</button>
        <button className="primary" onClick={() => void apply()} disabled={loading || applying || (processing && mode === 'smart') || !previewReady || !activeMask || Boolean(error)}>
          {applying || (processing && mode === 'smart') ? <LoaderCircle size={16} className="spin" /> : <Eraser size={16} />}
          {applying ? 'Aplicando recorte…' : 'Aplicar recorte'}
        </button>
      </div>
    </Modal>
  );
}
