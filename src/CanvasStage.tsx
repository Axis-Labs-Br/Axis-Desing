import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type {
  CSSProperties,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from 'react';
import { Copy, CopyPlus, Trash2, X } from 'lucide-react';
import type { DesignDocument, DesignElement, DrawingTool } from './model';
import { element } from './model';
import { ElementView, fitNote, noteHeight, notePadding } from './Scene';
import { smoothStroke } from './drawingAssets';
import { snapAlignment } from './alignmentGuides';
import type { AlignmentBox, AlignmentGuide, AlignmentGuides } from './alignmentGuides';
import './canvas.css';

interface Props {
  doc: DesignDocument;
  pageIndex: number;
  selected: string[];
  onSelect: (ids: string[]) => void;
  onChangeElements: (elements: DesignElement[], commit?: boolean) => void;
  onCheckpoint: () => void;
  onCopyElements: (ids: string[]) => void;
  onDuplicateElements: (ids: string[]) => void;
  onDeleteElements: (ids: string[]) => void;
  zoom: number;
  onFitZoom: (zoom: number) => void;
  showGrid: boolean;
  drawingTool: DrawingTool;
  drawColor: string;
  drawWidth: number;
  onDrawElement: (element: DesignElement) => void;
  onDrawingComplete: (cancelled?: boolean) => void;
  toolbar?: ReactNode;
  placement?: DesignElement | null;
  onPlaceElement?: (element: DesignElement) => void;
  onCancelPlacement?: () => void;
  preview: boolean;
}
type Point = { x: number; y: number };
type TouchNavigation =
  | { type: 'pan'; pointerId: number; start: Point; scrollLeft: number; scrollTop: number }
  | {
      type: 'pinch';
      pointerIds: [number, number];
      startDistance: number;
      startZoom: number;
      anchorX: number;
      anchorY: number;
      anchorLeft: number;
      anchorTop: number;
      anchorZoom: number;
    };
type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
type TextTap = { id: string; time: number; clientX: number; clientY: number; pointerType: string };
type Gesture = {
  type: 'drag' | 'marquee' | 'resize' | 'rotate';
  pointerId: number;
  start: Point;
  base: DesignElement[];
  ids: string[];
  handle?: Handle;
  initialAngle?: number;
  checkpointed: boolean;
  additive?: boolean;
  capture: Element;
  box?: ReturnType<typeof bounds>;
  textTap?: { id: string; startedAt: number; clientX: number; clientY: number;
    pointerType: string; moved: boolean; previous: TextTap | null };
};
const rotate = (p: Point, angle: number): Point => {
  const a = (angle * Math.PI) / 180;
  return { x: p.x * Math.cos(a) - p.y * Math.sin(a), y: p.x * Math.sin(a) + p.y * Math.cos(a) };
};
const resizeCursor = (handle: Handle, rotation: number) => {
  const angle =
    ({ e: 0, se: 45, s: 90, sw: 135, w: 180, nw: 225, n: 270, ne: 315 }[handle] +
      rotation +
      36000) %
    180;
  return ['ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize'][Math.round(angle / 45) % 4];
};
function bounds(elements: DesignElement[]) {
  const corners = elements.flatMap((e) => {
    const cx = e.x + e.width / 2,
      cy = e.y + e.height / 2;
    return [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].map(([x, y]) => {
      const p = rotate({ x: (x * e.width) / 2, y: (y * e.height) / 2 }, e.rotation);
      return { x: cx + p.x, y: cy + p.y };
    });
  });
  const x = Math.min(...corners.map((p) => p.x)),
    y = Math.min(...corners.map((p) => p.y));
  return {
    x,
    y,
    width: Math.max(...corners.map((p) => p.x)) - x,
    height: Math.max(...corners.map((p) => p.y)) - y,
  };
}

function GapGuide({ axis, guide, box, zoom }: {
  axis: 'x' | 'y'; guide: AlignmentGuide; box: AlignmentBox; zoom: number;
}) {
  if (!guide.gap) return null;
  const horizontal = axis === 'x';
  const start = horizontal ? box.x : box.y;
  const end = start + (horizontal ? box.width : box.height);
  const cross = horizontal ? box.y + box.height / 2 : box.x + box.width / 2;
  const segments = [[guide.gap.start, start], [end, guide.gap.end]];
  return (
    <g data-testid={`gap-guide-${axis}`} stroke="#e75bb1" strokeWidth={1 / zoom} pointerEvents="none">
      {segments.map(([from, to], index) => (
        <g key={index}>
          <line x1={horizontal ? from : cross} x2={horizontal ? to : cross}
            y1={horizontal ? cross : from} y2={horizontal ? cross : to} />
          {(to - from) * zoom >= 38 && (
            <text data-testid="gap-distance"
              x={horizontal ? (from + to) / 2 : cross + 7 / zoom}
              y={horizontal ? cross - 7 / zoom : (from + to) / 2}
              textAnchor={horizontal ? 'middle' : 'start'}
              dominantBaseline={horizontal ? 'auto' : 'middle'}
              fill="#a72d79" stroke="#fff" strokeWidth={3 / zoom} paintOrder="stroke"
              fontSize={10 / zoom} fontWeight={600}>
              {Math.round(to - from)} px
            </text>
          )}
        </g>
      ))}
      {[guide.gap.start, guide.gap.end].map((position) => (
        <line key={position}
          x1={horizontal ? position : cross - 4 / zoom}
          x2={horizontal ? position : cross + 4 / zoom}
          y1={horizontal ? cross - 4 / zoom : position}
          y2={horizontal ? cross + 4 / zoom : position} />
      ))}
    </g>
  );
}

export function CanvasStage({
  doc,
  pageIndex,
  selected,
  onSelect,
  onChangeElements,
  onCheckpoint,
  onCopyElements,
  onDuplicateElements,
  onDeleteElements,
  zoom,
  onFitZoom,
  showGrid,
  drawingTool,
  drawColor,
  drawWidth,
  onDrawElement,
  onDrawingComplete,
  toolbar,
  placement,
  onPlaceElement,
  onCancelPlacement,
  preview,
}: Props) {
  const page = doc.pages[pageIndex] ?? doc.pages[0];
  const stageRoot = useRef<HTMLDivElement>(null);
  const workspace = useRef<HTMLDivElement>(null);
  const stageSurface = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const lastTextTap = useRef<TextTap | null>(null);
  const doubleClickText = useRef<{ id: string; time: number } | null>(null);
  const drawing = useRef<{ pointerId: number; capture: Element; points: Point[]; tool: DrawingTool;
    base?: DesignElement[]; checkpointed?: boolean; lastClient?: Point } | null>(null);
  const [placementPoint, setPlacementPoint] = useState<Point | null>(null);
  const touchPoints = useRef(new Map<number, Point>());
  const touchNavigation = useRef<TouchNavigation | null>(null);
  const touchZoomActive = useRef(false);
  const touchZoomCommitting = useRef(false);
  const [drawPreview, setDrawPreview] = useState<Point[]>([]);
  const callbacks = useRef({ onFitZoom, onChangeElements, onCheckpoint, onSelect });
  callbacks.current = { onFitZoom, onChangeElements, onCheckpoint, onSelect };
  const zoomRef = useRef(zoom);
  const visualZoomRef = useRef(zoom);
  const pendingWheelZoom = useRef<{
    nextZoom: number;
    clientX: number;
    clientY: number;
    anchorLeft: number;
    anchorTop: number;
    anchorWidth: number;
    anchorHeight: number;
    anchorZoom: number;
    frame: number;
    timer: number;
    committing: boolean;
  } | null>(null);
  const [marquee, setMarquee] = useState<{ start: Point; end: Point } | null>(null);
  const [guides, setGuides] = useState<AlignmentGuides>({});
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const editingRef = useRef(editing);
  editingRef.current = editing;
  const [moving, setMoving] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; ids: string[] } | null>(
    null,
  );
  const elementsRef = useRef(page.elements);
  elementsRef.current = page.elements;
  const clipId = useId().replaceAll(':', '');
  const gridId = `${clipId}-grid`;
  const editable = page.elements.filter((e) => selected.includes(e.id) && !e.locked && !e.hidden);
  const single = editable.length === 1 ? editable[0] : null;
  const groupBounds = editable.length > 1 ? bounds(editable) : null;
  const frame = single ?? groupBounds;
  const originalTextElement = editing ? page.elements.find((e) => e.id === editing.id) : undefined;
  const textElement = originalTextElement?.note && editing
    ? { ...originalTextElement, height: noteHeight(originalTextElement, editing.text) } : originalTextElement;
  const placementAt = (location: Point) => placement ? { ...placement,
    x: Math.max(0, Math.min(doc.width - placement.width, location.x - placement.width / 2)),
    y: Math.max(0, Math.min(doc.height - placement.height, location.y - placement.height / 2)),
  } : null;
  useEffect(() => { setPlacementPoint(null); }, [placement?.id, page.id]);
  const guideBox = single ? bounds([single]) : groupBounds;
  const restingGuides = !moving && !editing && !preview && guideBox
    ? snapAlignment(
        guideBox,
        page.elements.filter((item) => !selected.includes(item.id) && !item.hidden)
          .map((item) => ({ ...bounds([item]), kind: item.kind })),
        doc.width, doc.height, 0.5 / zoom,
      ).guides
    : {};
  const visibleGuides = moving ? guides : {
    x: restingGuides.x?.gap ? restingGuides.x : undefined,
    y: restingGuides.y?.gap ? restingGuides.y : undefined,
  };

  const zoomWithWheel = (event: WheelEvent) => {
    if (preview || !event.ctrlKey || !event.deltaY) return;
    const node = workspace.current;
    const canvas = svg.current;
    if (!node || !canvas) return;
    event.preventDefault();
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? node.clientHeight : 1;
    const delta = Math.max(-240, Math.min(240, event.deltaY * unit));
    const currentZoom = zoomRef.current;
    const nextZoom = Math.max(0.05, Math.min(2, currentZoom * Math.exp(-delta * 0.0015)));
    if (Math.abs(nextZoom - currentZoom) < 0.0001) return;

    let pending = pendingWheelZoom.current;
    if (!pending) {
      const rect = canvas.getBoundingClientRect();
      pending = {
        nextZoom,
        clientX: event.clientX,
        clientY: event.clientY,
        anchorLeft: rect.left,
        anchorTop: rect.top,
        anchorWidth: rect.width,
        anchorHeight: rect.height,
        anchorZoom: visualZoomRef.current,
        frame: 0,
        timer: 0,
        committing: false,
      };
      pendingWheelZoom.current = pending;
    } else {
      pending.nextZoom = nextZoom;
      pending.clientX = event.clientX;
      pending.clientY = event.clientY;
      pending.committing = false;
      const rect = canvas.getBoundingClientRect();
      pending.anchorLeft = rect.left;
      pending.anchorTop = rect.top;
      pending.anchorWidth = rect.width;
      pending.anchorHeight = rect.height;
      pending.anchorZoom = visualZoomRef.current;
    }
    zoomRef.current = nextZoom;
    if (!pending.frame)
      pending.frame = requestAnimationFrame(() => {
        const queued = pendingWheelZoom.current;
        const surfaceNode = stageSurface.current;
        const canvasNode = svg.current;
        const workspaceNode = workspace.current;
        if (queued && surfaceNode && canvasNode && workspaceNode) {
          surfaceNode.style.width = `${doc.width * queued.nextZoom}px`;
          surfaceNode.style.height = `${doc.height * queued.nextZoom}px`;
          canvasNode.style.transformOrigin = 'top left';
          canvasNode.style.transform = `scale(${queued.nextZoom / zoom})`;
          const nextRect = canvasNode.getBoundingClientRect();
          const scale = queued.nextZoom / queued.anchorZoom;
          workspaceNode.scrollLeft +=
            nextRect.left + (queued.clientX - queued.anchorLeft) * scale - queued.clientX;
          workspaceNode.scrollTop +=
            nextRect.top + (queued.clientY - queued.anchorTop) * scale - queued.clientY;
          visualZoomRef.current = queued.nextZoom;
          queued.frame = 0;
          window.clearTimeout(queued.timer);
          queued.timer = window.setTimeout(() => {
            const latest = pendingWheelZoom.current;
            if (!latest) return;
            latest.committing = true;
            callbacks.current.onFitZoom(latest.nextZoom);
          }, 120);
        }
      });
  };

  useEffect(() => {
    const node = workspace.current;
    if (!node) return;
    // Ctrl + wheel controls the design instead of the browser's page zoom.
    node.addEventListener('wheel', zoomWithWheel, { passive: false });
    return () => node.removeEventListener('wheel', zoomWithWheel);
  }, [zoomWithWheel]);

  useLayoutEffect(() => {
    if (touchZoomCommitting.current) {
      clearTemporaryZoom();
      touchZoomCommitting.current = false;
      zoomRef.current = zoom;
      visualZoomRef.current = zoom;
    }
    const pending = pendingWheelZoom.current;
    if (pending?.committing) {
      const surfaceNode = stageSurface.current;
      const canvasNode = svg.current;
      if (surfaceNode) {
        surfaceNode.style.width = `${doc.width * zoom}px`;
        surfaceNode.style.height = `${doc.height * zoom}px`;
      }
      if (canvasNode) {
        canvasNode.style.removeProperty('transform');
        canvasNode.style.removeProperty('transform-origin');
      }
      window.clearTimeout(pending.timer);
      pendingWheelZoom.current = null;
      zoomRef.current = zoom;
      visualZoomRef.current = zoom;
    } else if (!pending) {
      zoomRef.current = zoom;
      visualZoomRef.current = zoom;
    }
  }, [zoom, doc.width, doc.height]);

  useEffect(
    () => () => {
      const pending = pendingWheelZoom.current;
      if (pending) {
        if (pending.frame) cancelAnimationFrame(pending.frame);
        window.clearTimeout(pending.timer);
      }
      stageSurface.current?.style.removeProperty('width');
      stageSurface.current?.style.removeProperty('height');
      svg.current?.style.removeProperty('transform');
      svg.current?.style.removeProperty('transform-origin');
      touchPoints.current.clear();
      touchNavigation.current = null;
      touchZoomActive.current = false;
      touchZoomCommitting.current = false;
      pendingWheelZoom.current = null;
    },
    [],
  );

  const openContextMenu = (event: ReactMouseEvent<SVGGElement>, item: DesignElement) => {
    if (preview) return;
    event.preventDefault();
    event.stopPropagation();
    finishText(true);
    const target = item;
    const ids = selected.includes(target.id) ? selected : [target.id];
    if (!selected.includes(target.id)) onSelect(ids);
    const rect = stageRoot.current?.getBoundingClientRect();
    if (!rect) return;
    setContextMenu({
      x: Math.max(8, Math.min(event.clientX - rect.left, rect.width - 208)),
      y: Math.max(8, Math.min(event.clientY - rect.top, rect.height - 148)),
      ids,
    });
  };

  const runContextAction = (action: 'copy' | 'duplicate' | 'delete') => {
    if (!contextMenu) return;
    const ids = contextMenu.ids;
    setContextMenu(null);
    if (action === 'copy') onCopyElements(ids);
    else if (action === 'duplicate') onDuplicateElements(ids);
    else onDeleteElements(ids);
  };

  useEffect(() => {
    const node = stageRoot.current;
    if (!node) return;
    let lastWidth = -1,
      lastHeight = -1;
    const fit = () => {
      const width = node.clientWidth,
        height = node.clientHeight;
      if (!width || !height || (width === lastWidth && height === lastHeight)) return;
      lastWidth = width;
      lastHeight = height;
      const padding = getComputedStyle(workspace.current ?? node);
      const horizontalPadding = parseFloat(padding.paddingLeft) + parseFloat(padding.paddingRight);
      const verticalPadding = parseFloat(padding.paddingTop) + parseFloat(padding.paddingBottom);
      const next = Math.min((width - horizontalPadding) / doc.width, (height - verticalPadding) / doc.height);
      callbacks.current.onFitZoom(Math.max(0.05, Math.min(2, next)));
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(node);
    return () => observer.disconnect();
  }, [doc.id, doc.width, doc.height, page.id]);

  useEffect(() => {
    gesture.current = null;
    lastTextTap.current = null;
    doubleClickText.current = null;
    setMarquee(null);
    setGuides({});
    setMoving(false);
    editingRef.current = null;
    setEditing(null);
  }, [page.id, preview]);

  useEffect(() => {
    if (editing) {
      textarea.current?.focus();
      textarea.current?.select();
    }
  }, [editing?.id]);

  const point = (event: { clientX: number; clientY: number }): Point => {
    const rect = svg.current!.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) * doc.width) / rect.width,
      y: ((event.clientY - rect.top) * doc.height) / rect.height,
    };
  };
  const clearTemporaryZoom = () => {
    stageSurface.current?.style.removeProperty('width');
    stageSurface.current?.style.removeProperty('height');
    svg.current?.style.removeProperty('transform');
    svg.current?.style.removeProperty('transform-origin');
  };
  const commitTouchZoom = () => {
    if (!touchZoomActive.current) return;
    touchZoomActive.current = false;
    if (Math.abs(zoomRef.current - zoom) < 0.0001) {
      clearTemporaryZoom();
      visualZoomRef.current = zoom;
      zoomRef.current = zoom;
      return;
    }
    touchZoomCommitting.current = true;
    callbacks.current.onFitZoom(zoomRef.current);
  };
  const beginTouchPinch = (pointerIds: [number, number], node: HTMLDivElement) => {
    lastTextTap.current = null;
    doubleClickText.current = null;
    const first = touchPoints.current.get(pointerIds[0]);
    const second = touchPoints.current.get(pointerIds[1]);
    const canvas = svg.current;
    if (!first || !second || !canvas) return;

    const currentGesture = gesture.current;
    if (currentGesture) {
      if (currentGesture.checkpointed)
        callbacks.current.onChangeElements(currentGesture.base, false);
      gesture.current = null;
      if (currentGesture.capture.hasPointerCapture(currentGesture.pointerId))
        currentGesture.capture.releasePointerCapture(currentGesture.pointerId);
    }
    const currentDrawing = drawing.current;
    if (currentDrawing) {
      if (currentDrawing.checkpointed && currentDrawing.base)
        callbacks.current.onChangeElements(currentDrawing.base, false);
      drawing.current = null;
      setDrawPreview([]);
      if (currentDrawing.capture.hasPointerCapture(currentDrawing.pointerId))
        currentDrawing.capture.releasePointerCapture(currentDrawing.pointerId);
    }
    finishText(true);
    setMarquee(null);
    setGuides({});
    setMoving(true);

    const center = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
    const rect = canvas.getBoundingClientRect();
    const distance = Math.max(1, Math.hypot(first.x - second.x, first.y - second.y));
    const startZoom = visualZoomRef.current;
    touchNavigation.current = {
      type: 'pinch',
      pointerIds,
      startDistance: distance,
      startZoom,
      anchorX: center.x,
      anchorY: center.y,
      anchorLeft: rect.left,
      anchorTop: rect.top,
      anchorZoom: startZoom,
    };
    for (const pointerId of pointerIds) {
      try {
        node.setPointerCapture(pointerId);
      } catch {
        // A pointer may have ended between the second touch and capture.
      }
    }
  };
  const handleTouchPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (preview || event.pointerType !== 'touch') return false;
    const node = workspace.current;
    if (!node) return false;
    touchPoints.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const activeIds = [...touchPoints.current.keys()];
    if (activeIds.length >= 2) {
      beginTouchPinch([activeIds[0], activeIds[1]], node);
      event.preventDefault();
      event.stopPropagation();
      return true;
    }

    const target = event.target instanceof Element ? event.target : null;
    const onDesignElement = Boolean(
      target?.closest('.stage-element, .stage-handle, .stage-rotate, .stage-text-editor'),
    );
    if (drawingTool === 'select' && !placement && !onDesignElement) {
      lastTextTap.current = null;
      touchNavigation.current = {
        type: 'pan',
        pointerId: event.pointerId,
        start: { x: event.clientX, y: event.clientY },
        scrollLeft: node.scrollLeft,
        scrollTop: node.scrollTop,
      };
      onSelect([]);
      setMoving(true);
      node.setPointerCapture(event.pointerId);
      event.preventDefault();
      event.stopPropagation();
      return true;
    }
    return false;
  };
  const handleTouchPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'touch' || !touchPoints.current.has(event.pointerId)) return;
    touchPoints.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const navigation = touchNavigation.current;
    const node = workspace.current;
    if (!navigation || !node) return;

    if (navigation.type === 'pan') {
      if (navigation.pointerId !== event.pointerId) return;
      node.scrollLeft = navigation.scrollLeft - (event.clientX - navigation.start.x);
      node.scrollTop = navigation.scrollTop - (event.clientY - navigation.start.y);
      event.preventDefault();
      return;
    }

    if (!navigation.pointerIds.includes(event.pointerId)) return;
    const first = touchPoints.current.get(navigation.pointerIds[0]);
    const second = touchPoints.current.get(navigation.pointerIds[1]);
    const surface = stageSurface.current;
    const canvas = svg.current;
    if (!first || !second || !surface || !canvas) return;
    const center = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
    const distance = Math.max(1, Math.hypot(first.x - second.x, first.y - second.y));
    const nextZoom = Math.max(0.05, Math.min(2, navigation.startZoom * distance / navigation.startDistance));
    if (Math.abs(nextZoom - zoomRef.current) < 0.0001) return;

    surface.style.width = `${doc.width * nextZoom}px`;
    surface.style.height = `${doc.height * nextZoom}px`;
    canvas.style.transformOrigin = 'top left';
    canvas.style.transform = `scale(${nextZoom / zoom})`;
    const nextRect = canvas.getBoundingClientRect();
    const anchorPageX = (navigation.anchorX - navigation.anchorLeft) / navigation.anchorZoom;
    const anchorPageY = (navigation.anchorY - navigation.anchorTop) / navigation.anchorZoom;
    const desiredLeft = center.x - anchorPageX * nextZoom;
    const desiredTop = center.y - anchorPageY * nextZoom;
    node.scrollLeft += nextRect.left - desiredLeft;
    node.scrollTop += nextRect.top - desiredTop;
    zoomRef.current = nextZoom;
    visualZoomRef.current = nextZoom;
    touchZoomActive.current = true;
    event.preventDefault();
  };
  const handleTouchPointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'touch' || !touchPoints.current.has(event.pointerId)) return;
    touchPoints.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    touchPoints.current.delete(event.pointerId);
    const navigation = touchNavigation.current;
    if (!navigation) return;
    if (navigation.type === 'pan') {
      if (navigation.pointerId === event.pointerId) {
        touchNavigation.current = null;
        setMoving(false);
      }
      return;
    }

    if (!navigation.pointerIds.includes(event.pointerId)) return;
    const remaining = navigation.pointerIds.find((pointerId) => touchPoints.current.has(pointerId));
    commitTouchZoom();
    if (remaining !== undefined) {
      const position = touchPoints.current.get(remaining)!;
      const node = workspace.current;
      touchNavigation.current = node
        ? {
            type: 'pan',
            pointerId: remaining,
            start: position,
            scrollLeft: node.scrollLeft,
            scrollTop: node.scrollTop,
          }
        : null;
    } else {
      touchNavigation.current = null;
      setMoving(false);
    }
  };
  const finishText = (save: boolean) => {
    const current = editingRef.current;
    if (!current) return;
    editingRef.current = null;
    setEditing(null);
    const original = page.elements.find((e) => e.id === current.id);
    if (save && original && current.text !== original.text) {
      const next = page.elements.map((e) =>
        e.id === current.id ? fitNote({ ...e, text: current.text }) : e,
      );
      elementsRef.current = next;
      onChangeElements(next);
    }
  };
  const startGesture = (
    event: ReactPointerEvent,
    type: Gesture['type'],
    ids: string[],
    handle?: Handle,
  ) => {
    if (preview || event.button !== 0) return;
    if (type !== 'drag') { lastTextTap.current = null; doubleClickText.current = null; }
    event.preventDefault();
    event.stopPropagation();
    const start = point(event);
    const targets = elementsRef.current.filter((e) => ids.includes(e.id) && !e.locked && !e.hidden);
    const element = targets[0];
    const box = targets.length > 1 ? bounds(targets) : undefined;
    const center = box
      ? { x: box.x + box.width / 2, y: box.y + box.height / 2 }
      : element
        ? { x: element.x + element.width / 2, y: element.y + element.height / 2 }
        : start;
    gesture.current = {
      type,
      pointerId: event.pointerId,
      start,
      ids,
      base: elementsRef.current.map((e) => ({ ...e })),
      handle,
      checkpointed: false,
      additive: event.shiftKey,
      capture: event.currentTarget,
      box,
      initialAngle: Math.atan2(start.y - center.y, start.x - center.x),
    };
    // Capture on the originating SVG element so click and dblclick retain their target.
    // Captured move/up events still bubble to the workspace outside the page bounds.
    event.currentTarget.setPointerCapture(event.pointerId);
    workspace.current?.focus({ preventScroll: true });
    if (type === 'marquee') setMarquee({ start, end: start });
    else setMoving(true);
  };
  const selectElement = (event: ReactPointerEvent, e: DesignElement) => {
    // SVG hit testing already resolves the frontmost element in paint order.
    const target = e;
    if (preview || target.hidden || event.button !== 0) return;
    finishText(true);
    if (target.locked) {
      lastTextTap.current = null;
      event.preventDefault();
      event.stopPropagation();
      workspace.current?.focus({ preventScroll: true });
      onSelect(event.shiftKey ? [...new Set([...selected, target.id])] : [target.id]);
      return;
    }
    const previousTap = lastTextTap.current;
    lastTextTap.current = null;
    doubleClickText.current = null;
    const clicked = target.groupId
      ? page.elements
          .filter((item) => item.groupId === target.groupId && !item.hidden && !item.locked)
          .map((item) => item.id)
      : [target.id];
    const ids = event.shiftKey
      ? clicked.every((id) => selected.includes(id))
        ? selected.filter((id) => !clicked.includes(id))
        : [...new Set([...selected, ...clicked])]
      : selected.includes(target.id)
        ? [...new Set([...selected, ...clicked])]
        : clicked;
    onSelect(ids);
    if (ids.includes(target.id)) {
      startGesture(event, 'drag', ids);
      if (target.kind === 'text' && !event.shiftKey && gesture.current)
        gesture.current.textTap = {
          id: target.id, startedAt: performance.now(), clientX: event.clientX, clientY: event.clientY,
          pointerType: event.pointerType, moved: false, previous: previousTap,
        };
    }
    else {
      event.stopPropagation();
      event.preventDefault();
    }
  };
  const changeDuringGesture = (g: Gesture, elements: DesignElement[]) => {
    if (!g.checkpointed) {
      onCheckpoint();
      g.checkpointed = true;
    }
    onChangeElements(elements, false);
  };
  const eraseAt = (event: { clientX: number; clientY: number }) => {
    const current = drawing.current;
    if (!current || current.tool !== 'eraser') return;
    const previous = current.lastClient ?? { x: event.clientX, y: event.clientY };
    current.lastClient = { x: event.clientX, y: event.clientY };
    const steps = Math.min(64, Math.max(1, Math.ceil(Math.hypot(event.clientX - previous.x, event.clientY - previous.y) / 8)));
    const affected = new Set<string>();
    const offsets = [[0, 0], [-7, 0], [7, 0], [0, -7], [0, 7], [-5, -5], [5, 5], [-5, 5], [5, -5]];
    for (const item of elementsRef.current) {
      if (item.locked || item.hidden || item.kind !== 'vector' ||
        !(item.drawing || item.name === 'Desenho' || item.name === 'Marca-texto')) continue;
      const paths = svg.current?.querySelector(`[data-element-id="${CSS.escape(item.id)}"]`)?.querySelectorAll('path');
      if (!paths) continue;
      for (const path of paths) {
        const matrix = path.getScreenCTM();
        if (!matrix) continue;
        const inverse = matrix.inverse();
        for (let i = 0; i <= steps && !affected.has(item.id); i++) for (const [ox, oy] of offsets) {
          const point = new DOMPoint(previous.x + (event.clientX - previous.x) * i / steps + ox,
            previous.y + (event.clientY - previous.y) * i / steps + oy).matrixTransform(inverse);
          if (path.isPointInStroke(point)) { affected.add(item.id); break; }
        }
      }
    }
    if (!affected.size) return;
    if (!current.checkpointed) { onCheckpoint(); current.checkpointed = true; }
    const next = elementsRef.current.filter(item => !affected.has(item.id));
    elementsRef.current = next;
    onChangeElements(next, false);
  };
  const move = (event: ReactPointerEvent) => {
    const drawingGesture = drawing.current;
    if (drawingGesture && drawingGesture.pointerId === event.pointerId && !preview) {
      if (drawingGesture.tool === 'eraser') { eraseAt(event); event.preventDefault(); return; }
      const next = point(event);
      const previous = drawingGesture.points[drawingGesture.points.length - 1];
      if (!previous || Math.hypot(next.x - previous.x, next.y - previous.y) >= Math.max(1, 1.2 / zoom)) {
        if (drawingGesture.tool === 'line') drawingGesture.points = [drawingGesture.points[0], next];
        else drawingGesture.points.push(next);
        setDrawPreview([...drawingGesture.points]);
      }
      event.preventDefault();
      return;
    }
    const g = gesture.current;
    if (!g || g.pointerId !== event.pointerId || preview) return;
    if (g.textTap && Math.hypot(event.clientX - g.textTap.clientX, event.clientY - g.textTap.clientY) >=
      (g.textTap.pointerType === 'touch' ? 6 : 2)) {
      g.textTap.moved = true;
      lastTextTap.current = null;
      doubleClickText.current = null;
    }
    const p = point(event);
    let dx = p.x - g.start.x,
      dy = p.y - g.start.y;
    if (g.type === 'marquee') {
      setMarquee({ start: g.start, end: p });
      const box = {
        x: Math.min(p.x, g.start.x),
        y: Math.min(p.y, g.start.y),
        width: Math.abs(dx),
        height: Math.abs(dy),
      };
      const ids = g.base
        .filter((e) => {
          if (e.locked || e.hidden) return false;
          const b = bounds([e]);
          return (
            b.x + b.width >= box.x &&
            b.y + b.height >= box.y &&
            b.x <= box.x + box.width &&
            b.y <= box.y + box.height
          );
        })
        .map((e) => e.id);
      onSelect(g.additive ? [...new Set([...g.ids, ...ids])] : ids);
      return;
    }
    if (!g.checkpointed && Math.hypot(dx, dy) * zoom < (event.pointerType === 'touch' ? 6 : 2)) return;
    const targets = g.base.filter((e) => g.ids.includes(e.id) && !e.locked && !e.hidden);
    if (!targets.length) return;
    if (g.type === 'drag') {
      if (event.shiftKey) {
        if (Math.abs(dx) > Math.abs(dy)) dy = 0;
        else dx = 0;
      }
      const box = bounds(targets);
      const aligned = snapAlignment(
        { ...box, x: box.x + dx, y: box.y + dy },
        g.base.filter((item) => !g.ids.includes(item.id) && !item.hidden)
          .map((item) => ({ ...bounds([item]), kind: item.kind })),
        doc.width,
        doc.height,
        6 / zoom,
        event.shiftKey ? (Math.abs(dx) > Math.abs(dy) ? 'x' : 'y') : undefined,
      );
      dx += aligned.x;
      dy += aligned.y;
      setGuides(aligned.guides);
      changeDuringGesture(
        g,
        g.base.map((e) =>
          targets.some((t) => t.id === e.id) ? { ...e, x: e.x + dx, y: e.y + dy } : e,
        ),
      );
    } else if (g.type === 'rotate') {
      const e = targets[0];
      const center = g.box
        ? { x: g.box.x + g.box.width / 2, y: g.box.y + g.box.height / 2 }
        : { x: e.x + e.width / 2, y: e.y + e.height / 2 };
      const angle = Math.atan2(p.y - center.y, p.x - center.x);
      let delta = ((angle - (g.initialAngle ?? 0)) * 180) / Math.PI;
      if (event.shiftKey)
        delta = g.box
          ? Math.round(delta / 15) * 15
          : Math.round((e.rotation + delta) / 15) * 15 - e.rotation;
      changeDuringGesture(
        g,
        g.base.map((item) => {
          if (!targets.some((target) => target.id === item.id)) return item;
          const offset = rotate(
            { x: item.x + item.width / 2 - center.x, y: item.y + item.height / 2 - center.y },
            delta,
          );
          return {
            ...item,
            x: center.x + offset.x - item.width / 2,
            y: center.y + offset.y - item.height / 2,
            rotation: item.rotation + delta,
          };
        }),
      );
    } else if (g.box) {
      // Scale a multiple selection as a unit; uniform scale preserves rotated artwork and text.
      const box = g.box,
        h = g.handle!;
      const west = h.includes('w'),
        east = h.includes('e'),
        north = h.includes('n'),
        south = h.includes('s');
      const sx = (box.width + (east ? dx : west ? -dx : 0)) / box.width;
      const sy = (box.height + (south ? dy : north ? -dy : 0)) / box.height;
      let scale =
        (east || west) && !(north || south)
          ? sx
          : (north || south) && !(east || west)
            ? sy
            : Math.abs(sx - 1) > Math.abs(sy - 1)
              ? sx
              : sy;
      scale = Math.max(scale, ...targets.map((item) => Math.max(2 / item.width, 2 / item.height)));
      const x = box.x + (west ? box.width * (1 - scale) : east ? 0 : (box.width * (1 - scale)) / 2);
      const y =
        box.y + (north ? box.height * (1 - scale) : south ? 0 : (box.height * (1 - scale)) / 2);
      changeDuringGesture(
        g,
        g.base.map((item) =>
          targets.some((target) => target.id === item.id)
            ? {
                ...item,
                x: x + (item.x - box.x) * scale,
                y: y + (item.y - box.y) * scale,
                width: item.width * scale,
                height: item.height * scale,
                ...(item.fontSize !== undefined ? { fontSize: item.fontSize * scale } : {}),
                ...(item.radius !== undefined ? { radius: item.radius * scale } : {}),
                ...(item.strokeWidth !== undefined
                  ? { strokeWidth: item.strokeWidth * scale }
                  : {}),
                ...(item.letterSpacing !== undefined
                  ? { letterSpacing: item.letterSpacing * scale }
                  : {}),
                ...(item.note ? { note: { ...item.note, minHeight: item.note.minHeight * scale } } : {}),
              }
            : item,
        ),
      );
    } else {
      const e = targets[0],
        h = g.handle!;
      const local = rotate({ x: dx, y: dy }, -e.rotation);
      const west = h.includes('w'),
        east = h.includes('e'),
        north = h.includes('n'),
        south = h.includes('s');
      let width = Math.max(2, e.width + (east ? local.x : west ? -local.x : 0));
      let height = Math.max(2, e.height + (south ? local.y : north ? -local.y : 0));
      if (event.shiftKey) {
        const ratio = e.width / e.height;
        if ((east || west) && !(north || south)) height = width / ratio;
        else if ((north || south) && !(east || west)) width = height * ratio;
        else if (Math.abs(width / e.width - 1) > Math.abs(height / e.height - 1))
          height = width / ratio;
        else width = height * ratio;
        const scale = Math.max(width / e.width, 2 / e.width, 2 / e.height);
        width = e.width * scale;
        height = e.height * scale;
      }
      const offset = rotate(
        {
          x: ((east ? 1 : west ? -1 : 0) * (width - e.width)) / 2,
          y: ((south ? 1 : north ? -1 : 0) * (height - e.height)) / 2,
        },
        e.rotation,
      );
      const x = e.x + e.width / 2 + offset.x - width / 2;
      const y = e.y + e.height / 2 + offset.y - height / 2;
      changeDuringGesture(
        g,
        g.base.map((item) => (item.id === e.id ? fitNote({ ...item, x, y, width, height,
          ...(item.note && (north || south) ? { note: { ...item.note, minHeight: height } } : {}),
        }) : item)),
      );
    }
  };
  const endGesture = (event?: ReactPointerEvent) => {
    const drawingGesture = drawing.current;
    if (drawingGesture && (!event || drawingGesture.pointerId === event.pointerId)) {
      const last = event ? point(event) : drawingGesture.points.at(-1);
      if (last) drawingGesture.points.push(last);
      const points = drawingGesture.points;
      drawing.current = null;
      if (drawingGesture.capture.hasPointerCapture(drawingGesture.pointerId))
        drawingGesture.capture.releasePointerCapture(drawingGesture.pointerId);
      setDrawPreview([]);
      if (event?.type === 'pointercancel') {
        if (drawingGesture.checkpointed && drawingGesture.base) onChangeElements(drawingGesture.base, false);
        return;
      }
      if (drawingGesture.tool === 'eraser') return;
      if (points.length > 1) {
        const padding = Math.max(2, drawWidth * 1.5);
        const minX = Math.min(...points.map((p) => p.x)) - padding;
        const minY = Math.min(...points.map((p) => p.y)) - padding;
        const width = Math.max(4, Math.max(...points.map((p) => p.x)) - minX + padding);
        const height = Math.max(4, Math.max(...points.map((p) => p.y)) - minY + padding);
        const factor = Math.max(1, width / 4096, height / 4096);
        const normalized = points.map(p => ({ x: (p.x - minX) / factor, y: (p.y - minY) / factor }));
        const d = drawingGesture.tool === 'line'
          ? `M${normalized[0].x} ${normalized[0].y}L${normalized.at(-1)!.x} ${normalized.at(-1)!.y}`
          : smoothStroke(normalized);
        onDrawElement(element('vector', {
          name: drawingGesture.tool === 'marker' ? 'Marca-texto' : drawingGesture.tool === 'line' ? 'Linha desenhada' : 'Desenho',
          drawing: true,
          x: minX,
          y: minY,
          width,
          height,
          fill: drawColor,
          opacity: drawingGesture.tool === 'marker' ? 0.55 : 1,
          strokeWidth: drawingGesture.tool === 'marker' ? drawWidth * 3 : drawWidth,
          vectorViewBox: [width / factor, height / factor],
          vectorPaths: [{ tag: 'path', attrs: { d } }],
          vectorStyle: 'outline',
        }));
      }
      onDrawingComplete();
      return;
    }
    const g = gesture.current;
    if (!g || (event && g.pointerId !== event.pointerId)) return;
    let editOnRelease: DesignElement | undefined;
    if (g.textTap) {
      const tap = g.textTap;
      const now = performance.now();
      const touch = tap.pointerType === 'touch';
      const cleanTap = event?.type === 'pointerup' && !g.checkpointed && !tap.moved &&
        (!touch || now - tap.startedAt <= 400) &&
        Math.hypot(event.clientX - tap.clientX, event.clientY - tap.clientY) < (touch ? 6 : 2);
      lastTextTap.current = cleanTap
        ? { id: tap.id, time: now, clientX: event!.clientX, clientY: event!.clientY, pointerType: tap.pointerType }
        : null;
      doubleClickText.current = null;
      const previous = tap.previous;
      if (cleanTap && previous?.id === tap.id && previous.pointerType === tap.pointerType &&
        tap.startedAt - previous.time <= (touch ? 450 : 2000) &&
        Math.hypot(tap.clientX - previous.clientX, tap.clientY - previous.clientY) <= 24) {
        if (touch) editOnRelease = elementsRef.current.find(e => e.id === tap.id && e.kind === 'text' && !e.locked && !e.hidden);
        else doubleClickText.current = { id: tap.id, time: now };
      }
    }
    gesture.current = null;
    if (g.capture.hasPointerCapture(g.pointerId)) g.capture.releasePointerCapture(g.pointerId);
    setMarquee(null);
    setGuides({});
    setMoving(false);
    if (editOnRelease) {
      // A completed, unmoved second tap distinguishes editing from a second-tap drag.
      // Focus synchronously in pointerup to keep the mobile keyboard user-activated.
      lastTextTap.current = null;
      event?.preventDefault();
      const next = { id: editOnRelease.id, text: editOnRelease.text ?? '' };
      flushSync(() => { onSelect([next.id]); editingRef.current = next; setEditing(next); });
      textarea.current?.focus({ preventScroll: true });
      textarea.current?.select();
    }
  };
  useEffect(() => {
    const cancel = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (drawing.current) {
        const draw = drawing.current;
        drawing.current = null;
        if (draw.checkpointed && draw.base) callbacks.current.onChangeElements(draw.base, false);
        if (draw.capture.hasPointerCapture(draw.pointerId)) draw.capture.releasePointerCapture(draw.pointerId);
        setDrawPreview([]);
        onDrawingComplete(true);
        return;
      }
      if (!gesture.current) return;
      const g = gesture.current;
      if (g.checkpointed) callbacks.current.onChangeElements(g.base, false);
      gesture.current = null;
      if (g.capture.hasPointerCapture(g.pointerId)) g.capture.releasePointerCapture(g.pointerId);
      setMarquee(null);
      setGuides({});
      setMoving(false);
    };
    window.addEventListener('keydown', cancel);
    return () => window.removeEventListener('keydown', cancel);
  }, [onDrawingComplete]);
  const handlePoints: [Handle, number, number][] = frame
    ? [
        ['nw', 0, 0],
        ['n', frame.width / 2, 0],
        ['ne', frame.width, 0],
        ['e', frame.width, frame.height / 2],
        ['se', frame.width, frame.height],
        ['s', frame.width / 2, frame.height],
        ['sw', 0, frame.height],
        ['w', 0, frame.height / 2],
      ]
    : [];
  const contextItems = contextMenu
    ? page.elements.filter((item) => contextMenu.ids.includes(item.id))
    : [];
  const canDuplicate = contextItems.some((item) => !item.locked && !item.hidden);
  const canDelete = contextItems.some((item) => !item.locked);

  return (
    <div
      ref={stageRoot}
      className={`canvas-stage${preview ? ' stage-preview' : ''}`}
      onPointerDownCapture={(event) => {
        const target = event.target instanceof Element ? event.target : null;
        if (!target?.closest('.stage-element, .stage-element-locked')) {
          lastTextTap.current = null;
          doubleClickText.current = null;
        }
        if (!target?.closest('.stage-context-menu'))
          setContextMenu(null);
        if (
          !preview &&
          editingRef.current &&
          !target?.closest('.stage-text-editor, .stage-context-menu')
        ) {
          finishText(true);
          if (!target?.closest('.stage-element, .stage-element-locked, .stage-handle, .stage-rotate'))
            onSelect([]);
        }
      }}
    >
      {toolbar}
      {placement && !preview && <div className="placement-hint">
        <span>Clique na página para colocar {placement.note ? 'a nota' : 'a assinatura'}</span>
        <button aria-label="Cancelar posicionamento" onClick={onCancelPlacement}><X size={14} /></button>
      </div>}
      <div
        ref={workspace}
        tabIndex={-1}
        className={`canvas-workspace${moving ? ' stage-moving' : ''}${drawingTool !== 'select' ? ' stage-drawing' : ''}${placement ? ' stage-placing' : ''}`}
        onPointerMoveCapture={(event) => {
          if (placement && svg.current) setPlacementPoint(point(event));
          handleTouchPointerMove(event);
        }}
        onPointerLeave={() => { if (placement) setPlacementPoint(null); }}
        onPointerUpCapture={handleTouchPointerEnd}
        onPointerCancelCapture={handleTouchPointerEnd}
        onPointerMove={move}
        onPointerUp={endGesture}
        onPointerCancel={endGesture}
        onLostPointerCapture={() => endGesture()}
        onPointerDownCapture={(event) => {
          if (handleTouchPointerDown(event)) return;
          if (!preview && placement && onPlaceElement && event.button === 0 && svg.current) {
            const location = point(event);
            if (location.x < 0 || location.x > doc.width || location.y < 0 || location.y > doc.height) return;
            event.preventDefault(); event.stopPropagation(); finishText(true);
            const placed = placementAt(location)!;
            flushSync(() => onPlaceElement(placed));
            if (placed.note) {
              const next = { id: placed.id, text: placed.text ?? '' };
              flushSync(() => { editingRef.current = next; setEditing(next); });
              textarea.current?.focus({ preventScroll: true });
            }
            return;
          }
          if (preview || drawingTool === 'select' || event.button !== 0) return;
          event.preventDefault();
          event.stopPropagation();
          finishText(true);
          onSelect([]);
          setContextMenu(null);
          const start = point(event);
          drawing.current = {
            pointerId: event.pointerId,
            capture: event.currentTarget,
            points: [start],
            tool: drawingTool,
            ...(drawingTool === 'eraser' ? { base: [...elementsRef.current], checkpointed: false } : {}),
          };
          if (drawingTool === 'eraser') eraseAt(event);
          else setDrawPreview([start]);
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerDown={(event) => {
          if (event.target === event.currentTarget && !preview) {
            finishText(true);
            onSelect([]);
            event.currentTarget.focus({ preventScroll: true });
          }
        }}
      >
        <div
          ref={stageSurface}
          className="stage-surface"
          style={{ width: doc.width * zoom, height: doc.height * zoom }}
        >
          <svg
            ref={svg}
            xmlns="http://www.w3.org/2000/svg"
            className="stage-canvas"
            data-testid="design-canvas"
            viewBox={`0 0 ${doc.width} ${doc.height}`}
            width={doc.width * zoom}
            height={doc.height * zoom}
            role="img"
            aria-label={`${page.name}, ${doc.width} por ${doc.height} pixels`}
            style={{ background: page.background }}
            onPointerDown={(event) => {
              if (preview || event.button !== 0) return;
              finishText(true);
              if (!event.shiftKey) onSelect([]);
              startGesture(event, 'marquee', event.shiftKey ? selected : []);
            }}
          >
            <defs>
              <clipPath id={clipId}>
                <rect width={doc.width} height={doc.height} />
              </clipPath>
              <pattern id={gridId} width="40" height="40" patternUnits="userSpaceOnUse">
                <path
                  d="M 40 0 L 0 0 0 40"
                  fill="none"
                  stroke="#807b96"
                  strokeOpacity=".17"
                  strokeWidth={1 / zoom}
                />
              </pattern>
            </defs>
            <g clipPath={`url(#${clipId})`}>
              <rect width={doc.width} height={doc.height} fill={page.background} />
              {page.elements
                .filter((e) => !e.hidden)
                .map((e) => (
                  <g
                    key={e.id}
                    id={e.id}
                    data-element-id={e.id}
                    data-kind={e.kind}
                    data-note={e.note ? 'true' : undefined}
                    data-locked={e.locked ? 'true' : 'false'}
                    className={
                      !preview ? (e.locked ? 'stage-element-locked' : 'stage-element') : undefined
                    }
                    onPointerDown={(event) => {
                      selectElement(event, e);
                    }}
                    onContextMenu={(event) => openContextMenu(event, e)}
                    onDoubleClick={(event) => {
                      const target = e;
                      if (preview || target.locked || target.kind !== 'text') return;
                      event.stopPropagation();
                      if (editingRef.current?.id === target.id) return;
                      if (doubleClickText.current?.id !== target.id ||
                        performance.now() - doubleClickText.current.time > 1000) return;
                      doubleClickText.current = null;
                      lastTextTap.current = null;
                      endGesture();
                      onSelect([target.id]);
                      setEditing({ id: target.id, text: target.text ?? '' });
                    }}
                  >
                    <g visibility={editing?.id === e.id && !e.note ? 'hidden' : 'visible'}>
                      <ElementView e={editing?.id === e.id && e.note ? textElement! : e}
                        hideText={editing?.id === e.id && !!e.note} />
                    </g>
                    {!preview && (
                      <rect
                        x={e.x}
                        y={e.y}
                        width={e.width}
                        height={editing?.id === e.id && e.note ? textElement!.height : e.height}
                        transform={`rotate(${e.rotation} ${e.x + e.width / 2} ${e.y + e.height / 2})`}
                        fill="transparent"
                        className="stage-hitarea"
                      />
                    )}
                  </g>
                ))}
              {drawPreview.length > 0 && (
                <path
                  d={drawingTool === 'line'
                    ? drawPreview.map((p, index) => `${index ? 'L' : 'M'}${p.x} ${p.y}`).join(' ')
                    : smoothStroke(drawPreview)}
                  fill="none"
                  stroke={drawColor}
                  strokeWidth={drawingTool === 'marker' ? drawWidth * 3 : drawWidth}
                  strokeOpacity={drawingTool === 'marker' ? 0.55 : 1}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  pointerEvents="none"
                />
              )}
              {showGrid && !preview && (
                <rect
                  width={doc.width}
                  height={doc.height}
                  fill={`url(#${gridId})`}
                  pointerEvents="none"
                />
              )}
              {placement && !preview && <g opacity={0.62} pointerEvents="none">
                <ElementView e={placementAt(placementPoint ?? { x: doc.width / 2, y: doc.height / 2 })!} />
              </g>}
            </g>
            {!preview && !editing && (
              <g className="stage-selection" fill="none" stroke="#7955e8" strokeWidth={1.5 / zoom}>
                {page.elements
                  .filter((e) => selected.includes(e.id) && e.locked && !e.hidden)
                  .map((e) => (
                    <g
                      key={e.id}
                      transform={`translate(${e.x} ${e.y}) rotate(${e.rotation} ${e.width / 2} ${e.height / 2})`}
                    >
                      <rect
                        width={e.width}
                        height={e.height}
                        stroke="#8c95aa"
                        strokeDasharray={`${5 / zoom} ${4 / zoom}`}
                        strokeWidth={1.5 / zoom}
                      />
                      <g
                        role="button"
                        tabIndex={0}
                        aria-label={`Desbloquear ${e.name} pela tela`}
                        transform={`translate(${Math.max(0, e.width - 22 / zoom)} ${-28 / zoom}) scale(${1 / zoom})`}
                        fill="#ffffff"
                        stroke="#8c95aa"
                        strokeWidth="1.5"
                        style={{ cursor: 'pointer', pointerEvents: 'all' }}
                        onPointerDown={(event) => {
                          event.stopPropagation();
                          event.preventDefault();
                          onChangeElements(
                            page.elements.map((item) =>
                              item.id === e.id ? { ...item, locked: false } : item,
                            ),
                          );
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            onChangeElements(
                              page.elements.map((item) =>
                                item.id === e.id ? { ...item, locked: false } : item,
                              ),
                            );
                          }
                        }}
                      >
                        <rect width="22" height="22" rx="5" />
                        <path d="M7 10V7a4 4 0 0 1 8 0v3M6 10h10v8H6z" fill="none" />
                      </g>
                    </g>
                  ))}
                {editable.length > 1 &&
                  editable.map((e) => (
                    <rect
                      key={e.id}
                      x={e.x}
                      y={e.y}
                      width={e.width}
                      height={e.height}
                      transform={`rotate(${e.rotation} ${e.x + e.width / 2} ${e.y + e.height / 2})`}
                      strokeOpacity=".45"
                      pointerEvents="none"
                    />
                  ))}
                {frame && (
                  <g
                    transform={`translate(${frame.x} ${frame.y}) rotate(${single?.rotation ?? 0} ${frame.width / 2} ${frame.height / 2})`}
                  >
                    <rect width={frame.width} height={frame.height} pointerEvents="none" />
                    <path d={`M ${frame.width / 2} 0 V ${-36 / zoom}`} pointerEvents="none" />
                    <g
                      transform={`translate(${frame.width / 2} ${-36 / zoom})`}
                      className="stage-rotate"
                      aria-label="Girar seleção"
                      data-testid="rotate-handle"
                      onPointerDown={(event) =>
                        startGesture(
                          event,
                          'rotate',
                          editable.map((item) => item.id),
                        )
                      }
                    >
                      <circle r={12 / zoom} fill="transparent" stroke="none" className="stage-control-hit stage-control-mouse" />
                      <circle r={18 / zoom} fill="transparent" stroke="none" className="stage-control-hit stage-control-touch" />
                      <circle r={6 / zoom} fill="white" className="stage-control-dot" pointerEvents="none" />
                    </g>
                    {handlePoints.map(([handle, x, y]) => (
                      <g
                        key={handle}
                        transform={`translate(${x} ${y})`}
                        className={`stage-handle stage-handle-${handle}`}
                        style={{ cursor: resizeCursor(handle, single?.rotation ?? 0) }}
                        aria-label={`Redimensionar ${handle}`}
                        onPointerDown={(event) =>
                          startGesture(
                            event,
                            'resize',
                            editable.map((item) => item.id),
                            handle,
                          )
                        }
                      >
                        {/* Grow outward from the border, keeping the interior easy to select and drag. */}
                        {([['mouse', 20], ['touch', 36]] as const).map(([device, size]) => {
                          const radiusX = Math.min(size / (2 * zoom), frame.width / 4);
                          const radiusY = Math.min(size / (2 * zoom), frame.height / 4);
                          const insideX = Math.min(5 / zoom, radiusX);
                          const insideY = Math.min(5 / zoom, radiusY);
                          const left = handle.includes('e') ? insideX : radiusX;
                          const right = handle.includes('w') ? insideX : radiusX;
                          const top = handle.includes('s') ? insideY : radiusY;
                          const bottom = handle.includes('n') ? insideY : radiusY;
                          return <rect key={device} x={-left} y={-top}
                            width={left + right} height={top + bottom} fill="transparent" stroke="none"
                            className={`stage-control-hit stage-control-${device}`} />;
                        })}
                        <rect x={-5 / zoom} y={-5 / zoom} width={10 / zoom} height={10 / zoom}
                          rx={2 / zoom} fill="white" className="stage-control-dot" pointerEvents="none"
                          data-testid={`resize-${handle}`} />
                      </g>
                    ))}
                  </g>
                )}
                {visibleGuides.x && (
                  <line
                    data-testid="alignment-guide-x"
                    x1={visibleGuides.x.value}
                    x2={visibleGuides.x.value}
                    y1={visibleGuides.x.from}
                    y2={visibleGuides.x.to}
                    stroke="#e75bb1"
                    strokeDasharray={`${5 / zoom} ${4 / zoom}`}
                    pointerEvents="none"
                  />
                )}
                {visibleGuides.y && (
                  <line
                    data-testid="alignment-guide-y"
                    x1={visibleGuides.y.from}
                    x2={visibleGuides.y.to}
                    y1={visibleGuides.y.value}
                    y2={visibleGuides.y.value}
                    stroke="#e75bb1"
                    strokeDasharray={`${5 / zoom} ${4 / zoom}`}
                    pointerEvents="none"
                  />
                )}
                {visibleGuides.x?.gap && guideBox && (
                  <GapGuide axis="x" guide={visibleGuides.x} box={guideBox} zoom={zoom} />
                )}
                {visibleGuides.y?.gap && guideBox && (
                  <GapGuide axis="y" guide={visibleGuides.y} box={guideBox} zoom={zoom} />
                )}
                {marquee && (
                  <rect
                    x={Math.min(marquee.start.x, marquee.end.x)}
                    y={Math.min(marquee.start.y, marquee.end.y)}
                    width={Math.abs(marquee.end.x - marquee.start.x)}
                    height={Math.abs(marquee.end.y - marquee.start.y)}
                    fill="#7955e8"
                    fillOpacity=".09"
                    strokeWidth={1 / zoom}
                    pointerEvents="none"
                  />
                )}
              </g>
            )}
          </svg>
          {textElement && editing && (
            <textarea
              ref={textarea}
              className="stage-text-editor"
              aria-label={textElement.note ? 'Editar nota adesiva' : 'Editar texto no design'}
              placeholder={textElement.note ? 'Adicionar texto' : undefined}
              maxLength={textElement.note ? 10000 : 100000}
              spellCheck={false}
              value={editing.text}
              style={
                {
                  left: textElement.x * zoom,
                  top: textElement.y * zoom,
                  width: textElement.width * zoom,
                  height: textElement.height * zoom,
                  transform: `rotate(${textElement.rotation}deg)`,
                  color: textElement.fill,
                  fontSize: (textElement.fontSize ?? 48) * zoom,
                  fontFamily: textElement.fontFamily ?? 'DM Sans',
                  fontWeight: textElement.fontWeight ?? 400,
                  fontStyle: textElement.fontStyle,
                  lineHeight: textElement.lineHeight ?? 1.2,
                  letterSpacing: (textElement.letterSpacing ?? 0) * zoom,
                  textAlign: textElement.textAlign ?? 'left',
                  ...(textElement.note ? {
                    padding: `${notePadding(textElement) * zoom}px`,
                    paddingBottom: (notePadding(textElement) * 2 + (textElement.fontSize ?? 20) * 1.2 + 12) * zoom,
                    background: 'transparent', overflowWrap: 'anywhere',
                  } : {}),
                } as CSSProperties
              }
              onChange={(event) => {
                const next = { id: editing.id, text: event.target.value };
                editingRef.current = next;
                setEditing(next);
              }}
              onBlur={() => finishText(true)}
              onPointerDown={(event) => event.stopPropagation()}
              onKeyDown={(event) => {
                event.stopPropagation();
                if (event.key === 'Escape') {
                  event.preventDefault();
                  finishText(false);
                }
                if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                  event.preventDefault();
                  finishText(true);
                }
              }}
            />
          )}
        </div>
      </div>
      {contextMenu && !preview && (
        <div
          className="stage-context-menu"
          role="menu"
          aria-label="Ações do elemento"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onPointerDown={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
        >
          <button role="menuitem" onClick={() => runContextAction('copy')}>
            <Copy size={15} />
            <span>Copiar</span>
            <kbd>Ctrl+C</kbd>
          </button>
          <button
            role="menuitem"
            disabled={!canDuplicate}
            onClick={() => runContextAction('duplicate')}
          >
            <CopyPlus size={15} />
            <span>Duplicar</span>
            <kbd>Ctrl+D</kbd>
          </button>
          <div className="stage-context-divider" />
          <button
            role="menuitem"
            className="stage-context-danger"
            disabled={!canDelete}
            onClick={() => runContextAction('delete')}
          >
            <Trash2 size={15} />
            <span>Excluir</span>
            <kbd>Del</kbd>
          </button>
        </div>
      )}
    </div>
  );
}
