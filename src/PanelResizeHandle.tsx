import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

interface Props {
  panelRef: RefObject<HTMLDivElement | null>;
  onResize: (height: number) => void;
  onClose: () => void;
}

export function PanelResizeHandle({ panelRef, onResize, onClose }: Props) {
  const [height, setHeight] = useState(240);
  const drag = useRef<{ pointerId: number; y: number; height: number } | null>(null);
  const frame = useRef(0);
  const pending = useRef<number | null>(null);
  const maximum = () => {
    const body = panelRef.current?.closest('.editor-body');
    const rail = body?.querySelector('.editor-rail');
    return Math.max(120, (body?.clientHeight ?? innerHeight - 96) - (rail?.clientHeight ?? 72) - 64);
  };
  const resize = (height: number) => onResize(Math.max(72, Math.min(maximum(), height)));
  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const observer = new ResizeObserver(() => setHeight(Math.round(panel.clientHeight)));
    observer.observe(panel);
    return () => observer.disconnect();
  }, [panelRef]);
  return (
    <div className="panel-resize-handle" role="separator" aria-orientation="horizontal"
      aria-label="Ajustar altura do painel" tabIndex={0}
      aria-valuemin={72} aria-valuemax={Math.round(maximum())} aria-valuenow={height}
      title="Arraste para cima ou para baixo para ajustar o painel"
      onPointerDown={(event) => {
        if (!event.isPrimary || event.button !== 0) return;
        event.preventDefault();
        drag.current = { pointerId: event.pointerId, y: event.clientY, height: panelRef.current?.clientHeight ?? 240 };
        event.currentTarget.setPointerCapture(event.pointerId);
        event.currentTarget.classList.add('dragging');
      }}
      onPointerMove={(event) => {
        if (drag.current?.pointerId !== event.pointerId) return;
        pending.current = drag.current.height + drag.current.y - event.clientY;
        if (!frame.current) frame.current = requestAnimationFrame(() => {
          frame.current = 0;
          if (pending.current !== null) resize(pending.current);
        });
      }}
      onPointerUp={(event) => {
        if (drag.current?.pointerId !== event.pointerId) return;
        cancelAnimationFrame(frame.current);
        frame.current = 0;
        const height = drag.current.height + drag.current.y - event.clientY;
        drag.current = null;
        pending.current = null;
        event.currentTarget.classList.remove('dragging');
        event.currentTarget.releasePointerCapture(event.pointerId);
        if (height < 110) onClose();
        else resize(height);
      }}
      onPointerCancel={(event) => {
        if (!drag.current) return;
        cancelAnimationFrame(frame.current);
        frame.current = 0;
        resize(drag.current.height);
        drag.current = null;
        pending.current = null;
        event.currentTarget.classList.remove('dragging');
      }}
      onKeyDown={(event) => {
        const height = panelRef.current?.clientHeight ?? 240;
        if (!['ArrowUp', 'ArrowDown', 'Home', 'End', 'Escape'].includes(event.key)) return;
        event.preventDefault();
        event.stopPropagation();
        if (event.key === 'Escape') onClose();
        else resize(event.key === 'Home' ? 160 : event.key === 'End' ? maximum() : height + (event.key === 'ArrowUp' ? 40 : -40));
      }}>
      <span aria-hidden="true" />
    </div>
  );
}
