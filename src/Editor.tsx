import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  ArrowLeft,
  ChevronDown,
  Cloud,
  Undo2,
  Redo2,
  Download,
  Play,
  Plus,
  Eraser,
  LayoutTemplate,
  Shapes,
  Type,
  Upload,
  Image,
  Palette,
  Layers,
  Copy,
  Trash2,
  Lock,
  Unlock,
  Bold,
  Italic,
  AlignLeft,
  AlignCenter,
  AlignRight,
  SlidersHorizontal,
  Maximize,
  Grid2X2,
  ChevronLeft,
  ChevronRight,
  X,
  MoveUp,
  MoveDown,
  ArrowUpToLine,
  ArrowDownToLine,
  FlipHorizontal,
  LoaderCircle,
  FileDown,
  FilePlus2,
  MousePointer2,
  CircleHelp,
  CheckCircle2,
  AlertCircle,
  Save,
  RectangleHorizontal,
  Minus,
  Group,
  Ungroup,
  ClipboardList,
  Pencil,
  Share2,
} from 'lucide-react';
import type { DesignDocument, DesignElement, DrawingTool, ElementKind, Template } from './model';
import { blankPage, clonePage, cloneElements, element, uid } from './model';
import { useHistory } from './history';
import { Scene, fitNote } from './Scene';
import { CanvasStage } from './CanvasStage';
import { EditorPanel } from './EditorPanels';
import type { PanelId } from './EditorPanels';
import { IconButton, Logo, Modal } from './ui';
import { exportDocument } from './export';
import type { ExportFormat } from './export';
import { FontPicker } from './FontPicker';
import { BackgroundRemover } from './BackgroundRemover';
import { prepareDocumentFonts, mergeFonts } from './fontLibrary';
import { createNote, createDrawingTable } from './drawingAssets';
import { DrawingToolbar } from './DrawingToolbar';
import { SignaturePanel } from './SignaturePanel';
import { PanelResizeHandle } from './PanelResizeHandle';

interface Props {
  initial: DesignDocument;
  onSave: (doc: DesignDocument) => Promise<void>;
  onExit: () => void;
  onNew: () => void;
  onImport: () => void;
  onShare: (doc: DesignDocument) => void;
  accountName: string;
  toast: (message: string) => void;
}
export function Editor({ initial, onSave, onExit, onNew, onImport, onShare, accountName, toast }: Props) {
  const { doc, update, checkpoint, undo, redo, canUndo, canRedo, current } = useHistory(initial);
  const [pageIndex, setPageIndex] = useState(0);
  const index = Math.min(pageIndex, doc.pages.length - 1),
    page = doc.pages[index];
  const [selected, setSelected] = useState<string[]>([]);
  const [panel, setPanel] = useState<PanelId | null>('design');
  const lastPanel = useRef<PanelId>('design');
  const panelHolder = useRef<HTMLDivElement>(null);
  const [mobilePanelHeight, setMobilePanelHeight] = useState<number | null>(null);
  const [replacePickerOpen, setReplacePickerOpen] = useState(false);
  const [replaceTargetId, setReplaceTargetId] = useState<string | null>(null);
  const [backgroundRemoverOpen, setBackgroundRemoverOpen] = useState(false);
  const [drawingTool, setDrawingTool] = useState<DrawingTool>('select');
  const [drawingToolsOpen, setDrawingToolsOpen] = useState(false);
  const [placement, setPlacement] = useState<DesignElement | null>(null);
  const [drawColor, setDrawColor] = useState('#29324a');
  const [drawWidth, setDrawWidth] = useState(5);
  if (panel && panel !== 'tools') lastPanel.current = panel;
  const [zoom, setZoom] = useState(0.4);
  const [showGrid, setShowGrid] = useState(false);
  const [inspector, setInspector] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [fileMenu, setFileMenu] = useState(false);
  const [resize, setResize] = useState(false);
  const [replace, setReplace] = useState<Template | null>(null);
  const [deletePage, setDeletePage] = useState(false);
  const [help, setHelp] = useState(false);
  const [fontPicker, setFontPicker] = useState(false);
  const [, setFontRevision] = useState(0);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const lastSaved = useRef(initial);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const clipboard = useRef<DesignElement[]>([]);
  const pendingElementPaste = useRef(false);
  const pendingElementPasteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const items = page.elements.filter((e) => selected.includes(e.id));
  const single = items.length === 1 ? items[0] : undefined;
  const changing = useRef(false);
  const persist = useCallback(
    async (value: DesignDocument) => {
      setSaveStatus('saving');
      const request = queue.current.catch(() => {}).then(() => onSave(value));
      queue.current = request;
      try {
        await request;
        lastSaved.current = value;
        if (current.current === value) setSaveStatus('saved');
      } catch (error) {
        setSaveStatus('error');
        throw error;
      }
    },
    [onSave, current],
  );
  useEffect(() => {
    if (doc === lastSaved.current) return;
    setSaveStatus('saving');
    const timer = setTimeout(() => void persist(doc).catch(() => {}), 650);
    return () => clearTimeout(timer);
  }, [doc, persist]);
  useEffect(() => {
    const handle = (e: BeforeUnloadEvent) => {
      if (current.current !== lastSaved.current) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handle);
    return () => window.removeEventListener('beforeunload', handle);
  }, [current]);
  useEffect(() => {
    setSelected((prev) => prev.filter((id) => page.elements.some((e) => e.id === id)));
  }, [page.id, page.elements]);
  useEffect(() => {
    let active = true;
    prepareDocumentFonts(doc)
      .then((faces) => {
        if (!active) return;
        const latest = current.current;
        const merged = mergeFonts(latest.fonts ?? [], faces);
        const notesChanged = latest.pages.some(p => p.elements.some(e => e.note && fitNote(e).height !== e.height));
        if (merged.length !== (latest.fonts?.length ?? 0) || notesChanged)
          update((d) => ({ ...d, fonts: mergeFonts(d.fonts ?? [], faces),
            pages: d.pages.map(p => ({ ...p, elements: p.elements.map(fitNote) })),
          }), false);
        else setFontRevision((n) => n + 1);
      })
      .catch((error) => {
        if (active)
          toast(
            error instanceof Error
              ? error.message
              : 'Não foi possível carregar uma fonte do projeto.',
          );
      });
    return () => {
      active = false;
    };
  }, [
    doc.id,
    JSON.stringify(
      doc.pages.flatMap((p) =>
        p.elements
          .filter((e) => e.kind === 'text')
          .map((e) => [e.fontFamily, e.fontWeight, e.fontStyle]),
      ),
    ),
    doc.fonts,
    update,
    toast,
  ]);
  const changeElements = useCallback(
    (elements: DesignElement[], commit = true) =>
      update(
        (d) => ({ ...d, pages: d.pages.map((p, i) => (i === index ? { ...p, elements: elements.map(fitNote) } : p)) }),
        commit,
      ),
    [update, index],
  );
  const patch = (props: Partial<DesignElement>, commit = true) =>
    changeElements(
      page.elements.map((e) => (selected.includes(e.id) && !e.locked ? { ...e, ...props } : e)),
      commit,
    );
  const addMany = (elements: DesignElement[]) => {
    if (!elements.length) return;
    changeElements([...page.elements, ...elements]);
    setSelected(elements.map((e) => e.id));
    if (window.innerWidth <= 720) setPanel(null);
  };
  const add = (e: DesignElement) => addMany([e]);
  const preparePlacement = (asset: DesignElement) => {
    const scale = asset.note ? 1 : Math.min(1, doc.width * 0.46 / asset.width, doc.height * 0.3 / asset.height);
    setPlacement({ ...asset, width: asset.width * scale, height: asset.height * scale,
      ...(asset.fontSize ? { fontSize: asset.fontSize * scale } : {}),
      ...(asset.strokeWidth ? { strokeWidth: asset.strokeWidth * scale } : {}),
    });
    setDrawingTool('select'); setPanel(null); setSelected([]);
  };
  const addKind = (kind: ElementKind) => {
    const w = doc.width * 0.35,
      h =
        kind === 'text'
          ? doc.height * 0.15
          : kind === 'line'
            ? Math.max(8, doc.height * 0.01)
            : doc.height * 0.3;
    add(
      element(kind, {
        x: (doc.width - w) / 2,
        y: (doc.height - h) / 2,
        width: w,
        height: h,
        ...(kind === 'text'
          ? {
              text: 'Sua ideia começa aqui',
              fontSize: Math.round(doc.width * 0.055),
              fontFamily: 'DM Sans',
              fontWeight: 600,
              fill: '#202334',
              lineHeight: 1.2,
            }
          : {}),
        ...(kind === 'ellipse' ? { height: w, y: (doc.height - w) / 2 } : {}),
        ...(kind === 'line' ? { strokeWidth: 6 } : {}),
        ...(kind === 'rect' ? { radius: 12 } : {}),
      }),
    );
  };
  const copyElements = (ids: string[]) => {
    const copied = page.elements.filter((e) => ids.includes(e.id));
    if (!copied.length) return;
    clipboard.current = structuredClone(copied);
    toast(`${copied.length} ${copied.length === 1 ? 'elemento copiado' : 'elementos copiados'}.`);
  };
  const duplicateElements = (ids: string[]) => {
    const copies = cloneElements(
      page.elements.filter((e) => ids.includes(e.id) && !e.locked && !e.hidden),
    ).map((e) => ({
      ...e,
      x: e.x + 24,
      y: e.y + 24,
    }));
    if (copies.length) {
      changeElements([...page.elements, ...copies]);
      setSelected(copies.map((e) => e.id));
    }
  };
  const deleteElements = (ids: string[]) => {
    const removable = new Set(
      page.elements.filter((e) => ids.includes(e.id) && !e.locked).map((e) => e.id),
    );
    if (!removable.size) return;
    changeElements(page.elements.filter((e) => !removable.has(e.id)));
    setSelected((previous) => previous.filter((id) => !removable.has(id)));
  };
  const remove = () => deleteElements(selected);
  const duplicate = () => duplicateElements(selected);
  const replaceImageSource = async (
    src: string,
    name: string,
    imageId: string | null,
    successMessage?: string,
  ): Promise<boolean> => {
    if (!imageId) return false;
    const target = page.elements.find((item) => item.id === imageId);
    if (target?.kind !== 'image' || target.locked) return false;
    try {
      await new Promise<void>((resolve, reject) => {
        const image = new window.Image();
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('A imagem escolhida não pôde ser aberta.'));
        image.src = src;
      });
      changeElements(
        page.elements.map((item) =>
          item.id === imageId && !item.locked ? { ...item, src, name: name.slice(0, 80) } : item,
        ),
      );
      if (successMessage) toast(successMessage);
      return true;
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Não foi possível substituir a imagem.');
      return false;
    }
  };
  const replaceImageFile = async (file: File, imageId: string | null, successMessage = 'Imagem substituída.') => {
    if (!imageId) return;
    if (
      !['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type) ||
      file.size > 15 * 1024 * 1024
    ) {
      toast('Escolha uma imagem PNG, JPG, WebP ou GIF de até 15 MB.');
      return;
    }
    try {
      const src = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () =>
          typeof reader.result === 'string'
            ? resolve(reader.result)
            : reject(new Error('Não foi possível ler a imagem.'));
        reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
        reader.readAsDataURL(file);
      });
      await replaceImageSource(src, file.name || 'Imagem colada', imageId, successMessage);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Não foi possível substituir a imagem.');
    }
  };
  const importPastedImage = async (file: File) => {
    const imageId = replacePickerOpen
      ? replaceTargetId
      : single?.kind === 'image' && !single.locked
        ? single.id
        : null;
    const successMessage = imageId ? 'Imagem substituída.' : 'Imagem adicionada ao design.';
    if (
      !['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type) ||
      file.size > 15 * 1024 * 1024
    ) {
      toast('Escolha uma imagem PNG, JPG, WebP ou GIF de até 15 MB.');
      return;
    }
    if (imageId) {
      await replaceImageFile(file, imageId, successMessage);
      if (replacePickerOpen) closeReplacePicker();
      return;
    }
    try {
      const src = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () =>
          typeof reader.result === 'string'
            ? resolve(reader.result)
            : reject(new Error('Não foi possível ler a imagem.'));
        reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
        reader.readAsDataURL(file);
      });
      const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
        const image = new window.Image();
        image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
        image.onerror = () => reject(new Error('A imagem copiada não pôde ser aberta.'));
        image.src = src;
      });
      const scale = Math.min(
        (doc.width * 0.72) / dimensions.width,
        (doc.height * 0.72) / dimensions.height,
        1,
      );
      const width = Math.max(1, dimensions.width * scale);
      const height = Math.max(1, dimensions.height * scale);
      const extension = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1];
      addMany([
        element('image', {
          src,
          name: file.name || `Imagem colada.${extension}`,
          width,
          height,
          x: (doc.width - width) / 2,
          y: (doc.height - height) / 2,
        }),
      ]);
      toast(successMessage);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Não foi possível importar a imagem copiada.');
    }
  };
  const closeReplacePicker = () => {
    setReplacePickerOpen(false);
    setReplaceTargetId(null);
  };
  const pasteImageFromClipboard = async (quiet = false, targetId = replaceTargetId) => {
    const imageId = targetId;
    const clipboard = navigator.clipboard as Clipboard & { read?: () => Promise<ClipboardItems> };
    if (!imageId || !clipboard.read) {
      if (!quiet) toast('Copie uma imagem e pressione Ctrl+V para substituir.');
      return false;
    }
    try {
      const clipboardItems = await clipboard.read();
      for (const item of clipboardItems) {
        const imageType = item.types.find((type) => type.startsWith('image/'));
        if (imageType) {
          const blob = await item.getType(imageType);
          const extension = imageType === 'image/jpeg' ? 'jpg' : imageType.split('/')[1];
          await replaceImageFile(
            new File([blob], `imagem-colada.${extension}`, { type: imageType }),
            imageId,
          );
          closeReplacePicker();
          return true;
        }
        if (item.types.includes('text/html')) {
          const html = await (await item.getType('text/html')).text();
          const src = new DOMParser().parseFromString(html, 'text/html').querySelector('img')?.src;
          if (!src) continue;
          const response = await fetch(src);
          if (!response.ok || !response.headers.get('content-type')?.startsWith('image/'))
            throw new Error('O navegador não liberou a imagem copiada. Use “Copiar imagem”.');
          const blob = await response.blob();
          const type = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(blob.type)
            ? blob.type
            : '';
          if (!type) throw new Error('A imagem copiada precisa ser PNG, JPG, WebP ou GIF.');
          const extension = type === 'image/jpeg' ? 'jpg' : type.split('/')[1];
          await replaceImageFile(new File([blob], `imagem-copiada.${extension}`, { type }), imageId);
          closeReplacePicker();
          return true;
        }
      }
      if (!quiet)
        toast('Não encontrei uma imagem na área de transferência. Copie a imagem e tente novamente.');
      return false;
    } catch (error) {
      if (!quiet)
        toast(
          error instanceof Error
            ? error.message
            : 'Acesso à área de transferência negado. Pressione Ctrl+V para colar a imagem.',
        );
      return false;
    }
  };
  const pasteCopiedElements = () => {
    if (!clipboard.current.length) return;
    const copies = cloneElements(clipboard.current).map((el) => ({
      ...el,
      x: el.x + 24,
      y: el.y + 24,
    }));
    changeElements([...page.elements, ...copies]);
    setSelected(copies.map((el) => el.id));
    clipboard.current = structuredClone(copies);
  };
  const groupSelection = () => {
    if (items.filter((e) => !e.locked).length < 2) return;
    const groupId = uid();
    changeElements(
      page.elements.map((e) => (selected.includes(e.id) && !e.locked ? { ...e, groupId } : e)),
    );
    toast('Elementos agrupados.');
  };
  const ungroupSelection = () => {
    const groups = new Set(items.map((e) => e.groupId).filter(Boolean));
    changeElements(
      page.elements.map((e) =>
        e.groupId && groups.has(e.groupId) ? { ...e, groupId: undefined } : e,
      ),
    );
    toast('Grupo desfeito.');
  };
  const reorder = (mode: 'front' | 'back' | 'up' | 'down') => {
    const ids = new Set(selected);
    let elements = [...page.elements];
    if (mode === 'front')
      elements = [
        ...elements.filter((e) => !ids.has(e.id)),
        ...elements.filter((e) => ids.has(e.id)),
      ];
    else if (mode === 'back')
      elements = [
        ...elements.filter((e) => ids.has(e.id)),
        ...elements.filter((e) => !ids.has(e.id)),
      ];
    else if (mode === 'up')
      for (let i = elements.length - 2; i >= 0; i--) {
        if (ids.has(elements[i].id) && !ids.has(elements[i + 1].id))
          [elements[i], elements[i + 1]] = [elements[i + 1], elements[i]];
      }
    else
      for (let i = 1; i < elements.length; i++) {
        if (ids.has(elements[i].id) && !ids.has(elements[i - 1].id))
          [elements[i], elements[i - 1]] = [elements[i - 1], elements[i]];
      }
    changeElements(elements);
  };
  const background = (color: string) =>
    update((d) => ({
      ...d,
      pages: d.pages.map((p, i) => (i === index ? { ...p, background: color } : p)),
    }));
  const newPage = () => {
    update((d) => ({
      ...d,
      pages: [...d.pages.slice(0, index + 1), blankPage(), ...d.pages.slice(index + 1)],
    }));
    setPageIndex(index + 1);
    setSelected([]);
  };
  const copyPage = () => {
    update((d) => ({
      ...d,
      pages: [...d.pages.slice(0, index + 1), clonePage(page), ...d.pages.slice(index + 1)],
    }));
    setPageIndex(index + 1);
    setSelected([]);
  };
  const applyTemplate = (t: Template) => {
    update((d) => ({
      ...d,
      pages: d.pages.map((p, i) => (i === index ? { ...clonePage(t.page), id: p.id } : p)),
    }));
    setSelected([]);
    setReplace(null);
    if (window.innerWidth <= 720) setPanel(null);
    toast('Modelo aplicado. Agora deixe com a sua cara.');
  };
  const goHome = async () => {
    try {
      await persist(current.current);
      onExit();
    } catch {
      toast('Não foi possível salvar. Exporte um arquivo .axis antes de sair.');
    }
  };
  const doNew = async () => {
    try {
      await persist(current.current);
      setFileMenu(false);
      onNew();
    } catch {
      toast('Não foi possível salvar o projeto atual.');
    }
  };
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (presenting) {
        if (e.key === 'Escape') setPresenting(false);
        if (e.key === 'ArrowRight' || e.key === ' ') {
          e.preventDefault();
          setPageIndex((i) => Math.min(doc.pages.length - 1, i + 1));
        }
        if (e.key === 'ArrowLeft') setPageIndex((i) => Math.max(0, i - 1));
        return;
      }
      if (
        target.closest('input,textarea,select,[contenteditable="true"],[role="dialog"]') ||
        document.querySelector('[role="dialog"]')
      )
        return;
      const cmd = e.ctrlKey || e.metaKey;
      if (cmd && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
      } else if (cmd && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      } else if (cmd && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setSelected(page.elements.filter((e) => !e.locked && !e.hidden).map((e) => e.id));
      } else if (cmd && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        duplicate();
      } else if (cmd && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        e.shiftKey ? ungroupSelection() : groupSelection();
      } else if (cmd && (e.key.toLowerCase() === 'c' || e.key.toLowerCase() === 'x')) {
        if (items.length) {
          e.preventDefault();
          copyElements(selected);
          if (e.key.toLowerCase() === 'x') remove();
        }
      } else if (cmd && e.key.toLowerCase() === 'v') {
        if (clipboard.current.length) {
          pendingElementPaste.current = true;
          if (pendingElementPasteTimer.current) clearTimeout(pendingElementPasteTimer.current);
          pendingElementPasteTimer.current = setTimeout(() => {
            pendingElementPasteTimer.current = null;
            if (!pendingElementPaste.current) return;
            pendingElementPaste.current = false;
            pasteCopiedElements();
          }, 250);
        }
      } else if (cmd && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void persist(current.current)
          .then(() => toast('Projeto salvo neste navegador.'))
          .catch(() => toast('Erro ao salvar.'));
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && items.length) {
        e.preventDefault();
        remove();
      } else if (e.key === 'Escape') {
        setSelected([]);
        setFileMenu(false);
        setPlacement(null);
        setDrawingTool('select');
      } else if (
        ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key) &&
        items.length
      ) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        changeElements(
          page.elements.map((el) =>
            selected.includes(el.id) && !el.locked
              ? {
                  ...el,
                  x: el.x + (e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0),
                  y: el.y + (e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0),
                }
              : el,
          ),
        );
      } else if (!cmd && !e.altKey && e.key.toLowerCase() === 't') addKind('text');
      else if (!cmd && !e.altKey && e.key.toLowerCase() === 'r') addKind('rect');
      else if (!cmd && !e.altKey && e.key.toLowerCase() === 'c') addKind('ellipse');
      else if (!cmd && !e.altKey && e.key.toLowerCase() === 'l') addKind('line');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });
  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const focused = event.target;
      if (
        focused instanceof Element &&
        focused.closest('input,textarea,select,[contenteditable="true"]')
      )
        return;
      const clearPendingElementPaste = () => {
        pendingElementPaste.current = false;
        if (pendingElementPasteTimer.current) clearTimeout(pendingElementPasteTimer.current);
        pendingElementPasteTimer.current = null;
      };
      const imageItem = Array.from(event.clipboardData?.items ?? []).find((item) =>
        item.type.startsWith('image/'),
      );
      const file = imageItem?.getAsFile();
      if (file) {
        event.preventDefault();
        clearPendingElementPaste();
        void importPastedImage(file);
        return;
      }
      const html = event.clipboardData?.getData('text/html') ?? '';
      const src = html
        ? new DOMParser().parseFromString(html, 'text/html').querySelector('img')?.src
        : '';
      if (src) {
        event.preventDefault();
        clearPendingElementPaste();
        void (async () => {
          try {
            const response = await fetch(src);
            const blob = await response.blob();
            const type = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(blob.type)
              ? blob.type
              : '';
            if (!response.ok || !type)
              throw new Error('O navegador não liberou essa imagem. Copie a imagem em vez do link.');
            const extension = type === 'image/jpeg' ? 'jpg' : type.split('/')[1];
            await importPastedImage(new File([blob], `imagem-copiada.${extension}`, { type }));
          } catch (error) {
            toast(error instanceof Error ? error.message : 'Não foi possível baixar a imagem copiada.');
          }
        })();
        return;
      }
      if (pendingElementPaste.current && clipboard.current.length) {
        event.preventDefault();
        clearPendingElementPaste();
        pasteCopiedElements();
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
      if (pendingElementPasteTimer.current) clearTimeout(pendingElementPasteTimer.current);
    };
  });
  const rails = [
    { id: 'design', name: 'Design', icon: LayoutTemplate },
    { id: 'elements', name: 'Elementos', icon: Shapes },
    { id: 'text', name: 'Texto', icon: Type },
    { id: 'forms', name: 'Formulários', icon: ClipboardList },
    { id: 'tools', name: 'Desenho', icon: Pencil },
    { id: 'uploads', name: 'Uploads', icon: Upload },
    { id: 'photos', name: 'Fotos', icon: Image },
    { id: 'brand', name: 'Marca', icon: Palette },
    { id: 'layers', name: 'Camadas', icon: Layers },
  ] as const;
  const textSelected = single?.kind === 'text';
  return (
    <div className="editor" style={mobilePanelHeight === null ? undefined : {
      '--mobile-panel-height': `${mobilePanelHeight}px`,
    } as CSSProperties}>
      <header className="editor-header">
        <div className="editor-header-left">
          <IconButton label="Voltar ao início" onClick={() => void goHome()}>
            <ArrowLeft size={19} />
          </IconButton>
          <button
            className="editor-logo"
            onClick={() => void goHome()}
            aria-label="Axis Design início"
          >
            <Logo compact />
          </button>
          <div className="editor-header-divider" />
          <div className="file-menu-wrap">
            <button
              className={`header-text-button ${fileMenu ? 'active' : ''}`}
              onClick={() => setFileMenu(!fileMenu)}
            >
              Arquivo <ChevronDown size={13} />
            </button>
            {fileMenu && (
              <div className="dropdown file-menu">
                <button
                  onClick={() =>
                    void persist(current.current)
                      .then(() => {
                        setFileMenu(false);
                        onImport();
                      })
                      .catch(() => toast('Salve o projeto atual antes de importar.'))
                  }
                >
                  <Upload size={16} /> Importar documento
                </button>
                <button onClick={() => void doNew()}>
                  <FilePlus2 size={16} />
                  Criar outro design
                </button>
                <button
                  onClick={() => {
                    setResize(true);
                    setFileMenu(false);
                  }}
                >
                  <Maximize size={16} />
                  Redimensionar
                </button>
                <button
                  onClick={() =>
                    void persist(current.current)
                      .then(() => {
                        toast('Projeto salvo.');
                        setFileMenu(false);
                      })
                      .catch(() => toast('Erro ao salvar.'))
                  }
                >
                  <Save size={16} />
                  Salvar agora<span>Ctrl S</span>
                </button>
                <button
                  onClick={() => {
                    void exportDocument(doc, 'axis', [], 1)
                      .then(() => toast('Cópia editável exportada.'))
                      .catch((e) => toast(e.message));
                    setFileMenu(false);
                  }}
                >
                  <FileDown size={16} />
                  Salvar cópia .axis
                </button>
                <div className="dropdown-line" />
                <button
                  onClick={() => {
                    setHelp(true);
                    setFileMenu(false);
                  }}
                >
                  <CircleHelp size={16} />
                  Atalhos de teclado
                </button>
              </div>
            )}
          </div>
          <button className="header-text-button resize-button" onClick={() => setResize(true)}>
            Redimensionar <Maximize size={13} />
          </button>
          <div className="editor-header-divider" />
          <div className="history-controls" role="group" aria-label="Histórico de alterações">
            <button
              type="button"
              className="history-button"
              aria-label="Desfazer"
              title="Desfazer a última alteração (Ctrl+Z)"
              onClick={undo}
              disabled={!canUndo}
            >
              <Undo2 size={17} />
              <span>Desfazer</span>
            </button>
            <button
              type="button"
              className="history-button"
              aria-label="Refazer"
              title="Refazer a alteração (Ctrl+Shift+Z)"
              onClick={redo}
              disabled={!canRedo}
            >
              <Redo2 size={17} />
              <span>Refazer</span>
            </button>
          </div>
        </div>
        <div className="editor-document-name">
          <input
            aria-label="Nome do design"
            value={doc.title}
            maxLength={200}
            onChange={(e) => update((d) => ({ ...d, title: e.target.value }))}
            onBlur={() => {
              if (!doc.title.trim()) update((d) => ({ ...d, title: 'Design sem título' }));
            }}
          />
          <span
            className={`save-status ${saveStatus}`}
            title={
              saveStatus === 'saved'
                ? 'Salvo na sua conta'
                : saveStatus === 'saving'
                  ? 'Salvando...'
                  : 'Erro ao salvar'
            }
          >
            {saveStatus === 'saved' ? (
              <CheckCircle2 size={15} />
            ) : saveStatus === 'saving' ? (
              <LoaderCircle size={15} className="spin" />
            ) : (
              <AlertCircle size={15} />
            )}
          </span>
        </div>
        <div className="editor-header-right">
          <button
            aria-label="Compartilhar design"
            className="secondary share-editor-button"
            onClick={() => onShare(doc)}
          >
            <Share2 size={16} />
            <span>Compartilhar</span>
          </button>
          <button
            aria-label="Visualizar"
            className="preview-button secondary"
            onClick={() => setPresenting(true)}
          >
            <Play size={15} />
            <span>Visualizar</span>
          </button>
          <button
            aria-label="Exportar"
            className="primary export-button"
            onClick={() => setExporting(true)}
          >
            <Download size={17} />
            <span>Exportar</span>
          </button>
          <span className="editor-avatar" title={`@${accountName}`}>{accountName.slice(0, 2).toUpperCase()}</span>
        </div>
      </header>
      <div className={`editor-body${panel ? ' panel-open' : ''}`}>
        <nav className="editor-rail" aria-label="Ferramentas do editor">
          {rails.map(({ id, name, icon: Icon }) => (
            <button
              key={id}
              className={(id === 'tools' ? drawingToolsOpen : panel === id) ? 'active' : ''}
              aria-label={name}
              aria-pressed={id === 'tools' ? drawingToolsOpen : panel === id}
              onClick={() => {
                setPlacement(null); setDrawingTool('select');
                if (id === 'tools') { setDrawingToolsOpen(!drawingToolsOpen); setPanel(null); }
                else { setDrawingToolsOpen(false); setPanel(panel === id ? null : id); }
              }}
            >
              <span>
                <Icon size={22} strokeWidth={1.7} />
              </span>
              <small>{name}</small>
            </button>
          ))}
          <button className="rail-help" aria-label="Ajuda do editor" onClick={() => setHelp(true)}>
            <CircleHelp size={21} />
          </button>
        </nav>
        <div ref={panelHolder} className={`panel-holder ${panel ? '' : 'collapsed'}`}>
          {panel === 'tools' ? <SignaturePanel account={accountName} onClose={() => setPanel(null)}
            resizeHandle={<PanelResizeHandle panelRef={panelHolder} onResize={setMobilePanelHeight} onClose={() => setPanel(null)} />}
            onInsert={preparePlacement} toast={toast} /> : <EditorPanel
            panel={panel ?? lastPanel.current}
            onClose={() => setPanel(null)}
            resizeHandle={<PanelResizeHandle panelRef={panelHolder} onResize={setMobilePanelHeight} onClose={() => setPanel(null)} />}
            doc={doc}
            pageIndex={index}
            selected={selected}
            onAdd={add}
            onAddMany={addMany}
            onApplyTemplate={(t) => (page.elements.length ? setReplace(t) : applyTemplate(t))}
            onSelect={setSelected}
            onChangeElements={changeElements}
            onBackground={background}
            onImportDocument={() =>
              void persist(current.current)
                .then(onImport)
                .catch(() => toast('Não foi possível salvar o projeto atual.'))
            }
            replaceImageOpen={replacePickerOpen}
            onCloseReplaceImage={closeReplacePicker}
            onReplaceImage={(src, name) =>
              void replaceImageSource(src, name, replaceTargetId)
            }
            onPasteImage={() => void pasteImageFromClipboard()}
            toast={toast}
          />}
        </div>
        <div className="editor-center">
          <div className="editor-toolbar">
            {single?.locked ? (
              <>
                <Lock size={17} />
                <span className="toolbar-hint">Elemento bloqueado</span>
                <button
                  className="text-button"
                  onClick={() =>
                    changeElements(
                      page.elements.map((e) => (e.id === single.id ? { ...e, locked: false } : e)),
                    )
                  }
                >
                  <Unlock size={17} />
                  Desbloquear elemento
                </button>
              </>
            ) : single ? (
              <>
                <span className="toolbar-element-type">
                  {textSelected ? (
                    <Type size={16} />
                  ) : single.kind === 'image' ? (
                    <Image size={16} />
                  ) : (
                    <Shapes size={16} />
                  )}
                </span>
                {textSelected && (
                  <>
                    <button
                      className="font-picker-trigger"
                      aria-label="Fonte"
                      aria-haspopup="dialog"
                      onClick={() => setFontPicker(true)}
                    >
                      <span>{single.fontFamily ?? 'DM Sans'}</span>
                      <ChevronDown size={13} />
                    </button>
                    <NumberField
                      label="Tamanho da fonte"
                      value={single.fontSize ?? 48}
                      min={1}
                      max={1000}
                      onChange={(n) => patch({ fontSize: n })}
                      small
                    />
                    <span className="toolbar-divider" />
                  </>
                )}
                {single.kind !== 'image' && (
                  <label className="color-button" title="Cor do elemento">
                    <span style={{ background: single.fill }} />
                    <input
                      aria-label="Cor do elemento"
                      type="color"
                      value={single.fill.startsWith('#') ? single.fill : '#000000'}
                      onChange={(e) => patch({ fill: e.target.value })}
                    />
                  </label>
                )}
                {single.note && <label className="color-button" title="Cor da nota">
                  <span style={{ background: single.note.color }} />
                  <input aria-label="Cor da nota" type="color" value={single.note.color}
                    onChange={event => patch({ note: { ...single.note!, color: event.target.value } })} />
                </label>}
                {textSelected && (
                  <>
                    <IconButton
                      label="Negrito"
                      className={(single.fontWeight ?? 400) >= 600 ? 'active' : ''}
                      onClick={() =>
                        patch({ fontWeight: (single.fontWeight ?? 400) >= 600 ? 400 : 700 })
                      }
                    >
                      <Bold size={17} />
                    </IconButton>
                    <IconButton
                      label="Itálico"
                      className={single.fontStyle === 'italic' ? 'active' : ''}
                      onClick={() =>
                        patch({ fontStyle: single.fontStyle === 'italic' ? 'normal' : 'italic' })
                      }
                    >
                      <Italic size={17} />
                    </IconButton>
                    <span className="toolbar-divider" />
                    {(
                      [
                        { align: 'left', Icon: AlignLeft, label: 'Alinhar texto à esquerda' },
                        { align: 'center', Icon: AlignCenter, label: 'Centralizar texto' },
                        { align: 'right', Icon: AlignRight, label: 'Alinhar texto à direita' },
                      ] as const
                    ).map(({ align, Icon, label }) => (
                      <IconButton
                        key={align}
                        label={label}
                        className={(single.textAlign ?? 'left') === align ? 'active' : ''}
                        onClick={() => patch({ textAlign: align })}
                      >
                        <Icon size={17} />
                      </IconButton>
                    ))}
                  </>
                )}
                {single.kind === 'image' && (
                  <>
                    <IconButton
                      label="Remover fundo"
                      onClick={() => setBackgroundRemoverOpen(true)}
                    >
                      <Eraser size={17} />
                    </IconButton>
                    <IconButton
                      label="Substituir imagem"
                      onClick={() => {
                        setReplaceTargetId(single.id);
                        setReplacePickerOpen(true);
                      }}
                    >
                      <Upload size={17} />
                    </IconButton>
                    <IconButton
                      label="Espelhar imagem"
                      onClick={() => patch({ flipX: !single.flipX })}
                    >
                      <FlipHorizontal size={18} />
                    </IconButton>
                  </>
                )}
                <span className="toolbar-divider" />
                <IconButton label="Duplicar elemento" onClick={duplicate}>
                  <Copy size={17} />
                </IconButton>
                <IconButton
                  label={single.locked ? 'Desbloquear elemento' : 'Bloquear elemento'}
                  className={single.locked ? 'active' : ''}
                  onClick={() =>
                    changeElements(
                      page.elements.map((e) =>
                        e.id === single.id ? { ...e, locked: !e.locked } : e,
                      ),
                    )
                  }
                >
                  {single.locked ? <Lock size={17} /> : <Unlock size={17} />}
                </IconButton>
                <IconButton label="Excluir elemento" onClick={remove} disabled={single.locked}>
                  <Trash2 size={17} />
                </IconButton>
              </>
            ) : items.length > 1 ? (
              <>
                <span className="selection-summary">
                  <MousePointer2 size={16} />
                  {items.length} elementos selecionados
                </span>
                {items[0].groupId && items.every((e) => e.groupId === items[0].groupId) ? (
                  <button className="text-button" onClick={ungroupSelection}>
                    <Ungroup size={16} />
                    Desagrupar
                  </button>
                ) : (
                  <button className="text-button" onClick={groupSelection}>
                    <Group size={16} />
                    Agrupar
                  </button>
                )}
                <IconButton label="Duplicar elementos" onClick={duplicate}>
                  <Copy size={17} />
                </IconButton>
                <IconButton label="Excluir elementos" onClick={remove}>
                  <Trash2 size={17} />
                </IconButton>
              </>
            ) : (
              <>
                <label className="color-button background-color" title="Cor da página">
                  <span style={{ background: page.background }} />
                  <input
                    aria-label="Cor da página"
                    type="color"
                    value={page.background}
                    onChange={(e) => background(e.target.value)}
                  />
                </label>
                <span className="toolbar-hint">Cor da página</span>
                <span className="toolbar-divider" />
                <span className="toolbar-hint muted">Sua ideia tem espaço para acontecer.</span>
              </>
            )}
            <div className="toolbar-right">
              {items.length > 0 && (
                <button
                  className={`text-button position-button ${inspector ? 'active' : ''}`}
                  onClick={() => setInspector(!inspector)}
                  disabled={single?.locked}
                >
                  <SlidersHorizontal size={16} />
                  <span>Ajustar</span>
                </button>
              )}
              <IconButton
                label="Mostrar grade"
                className={showGrid ? 'active' : ''}
                onClick={() => setShowGrid(!showGrid)}
              >
                <Grid2X2 size={17} />
              </IconButton>
            </div>
          </div>
          <div className="stage-with-inspector">
            <CanvasStage
              doc={doc}
              pageIndex={index}
              selected={selected}
              onSelect={setSelected}
              onChangeElements={changeElements}
              onCheckpoint={checkpoint}
              onCopyElements={copyElements}
              onDuplicateElements={duplicateElements}
              onDeleteElements={deleteElements}
              zoom={zoom}
              onFitZoom={setZoom}
              showGrid={showGrid}
              drawingTool={drawingTool}
              drawColor={drawColor}
              drawWidth={drawWidth}
              onDrawElement={add}
              onDrawingComplete={(cancelled) => { if (cancelled) setDrawingTool('select'); }}
              placement={placement}
              onPlaceElement={(asset) => { add(asset); setPlacement(null); }}
              onCancelPlacement={() => setPlacement(null)}
              toolbar={drawingToolsOpen && <DrawingToolbar tool={drawingTool} color={drawColor} width={drawWidth}
                placement={placement} onTool={tool => { setDrawingTool(tool); setPlacement(null); setPanel(null); }}
                onColor={setDrawColor} onWidth={setDrawWidth}
                onNote={color => preparePlacement(createNote(color, accountName, doc.width))}
                onText={() => { setDrawingTool('select'); setPlacement(null); addKind('text'); }}
                onSignature={() => { setDrawingTool('select'); setPlacement(null); setPanel('tools'); }}
                onTable={() => { setDrawingTool('select'); setPlacement(null); addMany(createDrawingTable(doc.width, doc.height)); }}
                onClose={() => { setDrawingToolsOpen(false); setPlacement(null); setDrawingTool('select'); if (panel === 'tools') setPanel(null); }} />}
              preview={false}
            />
            {inspector && single && !single.locked && (
              <aside className="properties-panel">
                <div className="properties-heading">
                  <h3>Ajustar elemento</h3>
                  <IconButton label="Fechar ajustes" onClick={() => setInspector(false)}>
                    <X size={16} />
                  </IconButton>
                </div>
                <label className="field-label">
                  Nome
                  <input
                    className="text-input"
                    value={single.name}
                    onChange={(e) => patch({ name: e.target.value })}
                  />
                </label>
                {single.kind === 'text' && (
                  <label className="field-label">
                    Conteúdo
                    <textarea
                      className="text-input content-textarea"
                      aria-label="Conteúdo do texto"
                      value={single.text ?? ''}
                      onChange={(e) => patch({ text: e.target.value })}
                    />
                  </label>
                )}
                <h4>Posição e tamanho</h4>
                <div className="properties-grid">
                  <NumberField
                    label="X"
                    value={single.x}
                    min={-32000}
                    max={32000}
                    onChange={(n) => patch({ x: n })}
                  />
                  <NumberField
                    label="Y"
                    value={single.y}
                    min={-32000}
                    max={32000}
                    onChange={(n) => patch({ y: n })}
                  />
                  <NumberField
                    label="Largura"
                    value={single.width}
                    min={1}
                    max={32000}
                    onChange={(n) => patch({ width: n })}
                  />
                  <NumberField
                    label="Altura"
                    value={single.height}
                    min={1}
                    max={32000}
                    onChange={(n) => patch({ height: n })}
                  />
                </div>
                <NumberField
                  label="Rotação (°)"
                  value={single.rotation}
                  min={-360}
                  max={360}
                  onChange={(n) => patch({ rotation: n })}
                />
                <label className="field-label">
                  Opacidade <span>{Math.round(single.opacity * 100)}%</span>
                  <input
                    aria-label="Opacidade"
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(single.opacity * 100)}
                    onPointerDown={() => {
                      checkpoint();
                      changing.current = true;
                    }}
                    onPointerUp={() => {
                      changing.current = false;
                    }}
                    onChange={(e) =>
                      patch({ opacity: Number(e.target.value) / 100 }, !changing.current)
                    }
                  />
                </label>
                {['rect', 'image'].includes(single.kind) && (
                  <label className="field-label">
                    Cantos arredondados
                    <span>
                      {Math.round(
                        ((single.radius ?? 0) / (Math.min(single.width, single.height) / 2)) * 100,
                      )}%
                    </span>
                    <input
                      aria-label="Arredondamento dos cantos"
                      type="range"
                      min={0}
                      max={100}
                      value={Math.min(
                        100,
                        Math.round(
                          ((single.radius ?? 0) / (Math.min(single.width, single.height) / 2)) *
                            100,
                        ),
                      )}
                      onPointerDown={() => {
                        checkpoint();
                        changing.current = true;
                      }}
                      onPointerUp={() => {
                        changing.current = false;
                      }}
                      onPointerCancel={() => {
                        changing.current = false;
                      }}
                      onChange={(event) =>
                        patch(
                          {
                            radius:
                              (Math.min(single.width, single.height) / 2) *
                              (Number(event.target.value) / 100),
                          },
                          !changing.current,
                        )
                      }
                    />
                  </label>
                )}
                {textSelected && (
                  <>
                    <NumberField
                      label="Entrelinhas"
                      value={single.lineHeight ?? 1.2}
                      min={0.5}
                      max={3}
                      step={0.1}
                      onChange={(n) => patch({ lineHeight: n })}
                    />
                    <NumberField
                      label="Entre letras"
                      value={single.letterSpacing ?? 0}
                      min={-20}
                      max={50}
                      step={1}
                      onChange={(n) => patch({ letterSpacing: n })}
                    />
                  </>
                )}
                <h4>Organização</h4>
                <div className="layer-order-buttons">
                  <button className="secondary" onClick={() => reorder('up')}>
                    <MoveUp size={15} />
                    Avançar
                  </button>
                  <button className="secondary" onClick={() => reorder('down')}>
                    <MoveDown size={15} />
                    Recuar
                  </button>
                  <button className="secondary" onClick={() => reorder('front')}>
                    <ArrowUpToLine size={15} />
                    Para frente
                  </button>
                  <button className="secondary" onClick={() => reorder('back')}>
                    <ArrowDownToLine size={15} />
                    Para trás
                  </button>
                </div>
                <h4>Alinhar à página</h4>
                <div className="align-to-page">
                  <IconButton label="Alinhar à esquerda da página" onClick={() => patch({ x: 0 })}>
                    <AlignLeft size={17} />
                  </IconButton>
                  <IconButton
                    label="Centralizar na página"
                    onClick={() => patch({ x: (doc.width - single.width) / 2 })}
                  >
                    <AlignCenter size={17} />
                  </IconButton>
                  <IconButton
                    label="Alinhar à direita da página"
                    onClick={() => patch({ x: doc.width - single.width })}
                  >
                    <AlignRight size={17} />
                  </IconButton>
                  <IconButton
                    label="Centralizar verticalmente"
                    onClick={() => patch({ y: (doc.height - single.height) / 2 })}
                  >
                    <RectangleHorizontal size={17} />
                  </IconButton>
                </div>
              </aside>
            )}
          </div>
          <div className="pages-strip">
            <div className="page-thumbnails">
              {doc.pages.map((p, i) => (
                <button
                  key={p.id}
                  className={`page-thumbnail ${i === index ? 'active' : ''}`}
                  aria-label={`Ir para página ${i + 1}`}
                  onClick={() => {
                    setPageIndex(i);
                    setSelected([]);
                  }}
                >
                  <span className="page-thumb-number">{i + 1}</span>
                  <Scene page={p} width={doc.width} height={doc.height} />
                </button>
              ))}
              <button className="add-page-thumb" onClick={newPage} aria-label="Adicionar página">
                <Plus size={19} />
              </button>
            </div>
            <div className="page-strip-actions">
              <IconButton label="Duplicar página" onClick={copyPage}>
                <Copy size={16} />
              </IconButton>
              <IconButton
                label="Excluir página"
                disabled={doc.pages.length === 1}
                onClick={() => setDeletePage(true)}
              >
                <Trash2 size={16} />
              </IconButton>
            </div>
          </div>
          <footer className="editor-footer">
            <div className="page-footer-label">
              <Layers size={15} />
              <span>
                Página {index + 1} de {doc.pages.length}
              </span>
              <span className="footer-dimensions">
                {doc.width} × {doc.height} px
              </span>
            </div>
            <div className="editor-zoom">
              <IconButton
                label="Diminuir zoom"
                onClick={() => setZoom((z) => Math.max(0.05, z - 0.1))}
              >
                <Minus size={15} />
              </IconButton>
              <input
                aria-label="Zoom"
                type="range"
                min={5}
                max={200}
                value={Math.round(zoom * 100)}
                onChange={(e) => setZoom(Number(e.target.value) / 100)}
              />
              <IconButton
                label="Aumentar zoom"
                onClick={() => setZoom((z) => Math.min(2, z + 0.1))}
              >
                <Plus size={15} />
              </IconButton>
              <span>{Math.round(zoom * 100)}%</span>
              <IconButton
                label="Ajustar à tela"
                onClick={() => {
                  const target = document.querySelector('.canvas-stage');
                  if (target) {
                    const bounds = target.getBoundingClientRect();
                    setZoom(
                      Math.min(
                        (bounds.width - 100) / doc.width,
                        (bounds.height - 100) / doc.height,
                        1,
                      ),
                    );
                  }
                }}
              >
                <Maximize size={16} />
              </IconButton>
            </div>
          </footer>
        </div>
      </div>
      {fontPicker && single && (
        <FontPicker
          value={single.fontFamily ?? 'DM Sans'}
          weight={single.fontWeight ?? 400}
          style={single.fontStyle ?? 'normal'}
          embedded={doc.fonts}
          onClose={() => setFontPicker(false)}
          onChoose={(family, face) => {
            update((d) => ({
              ...d,
              ...(face ? { fonts: mergeFonts(d.fonts ?? [], [face]) } : {}),
              pages: d.pages.map((p, i) =>
                i === index
                  ? {
                      ...p,
                      elements: p.elements.map((e) =>
                        selected.includes(e.id) && !e.locked ? { ...e, fontFamily: family } : e,
                      ),
                    }
                  : p,
              ),
            }));
          }}
        />
      )}
      {backgroundRemoverOpen && single?.kind === 'image' && (
        <BackgroundRemover
          src={single.src ?? ''}
          onClose={() => setBackgroundRemoverOpen(false)}
          onApply={async (src) => {
            const name = `${single.name.replace(/ sem fundo$/i, '') || 'Imagem'} sem fundo`;
            const applied = await replaceImageSource(src, name, single.id, 'Fundo removido. Você pode desfazer a alteração.');
            if (applied) setBackgroundRemoverOpen(false);
            return applied;
          }}
        />
      )}
      {exporting && (
        <ExportDialog
          doc={doc}
          pageIndex={index}
          onClose={() => setExporting(false)}
          toast={toast}
        />
      )}
      {resize && (
        <ResizeDialog
          doc={doc}
          onClose={() => setResize(false)}
          onResize={(w, h, scale) => {
            const sx = w / doc.width,
              sy = h / doc.height;
            update((d) => ({
              ...d,
              width: w,
              height: h,
              pages: scale
                ? d.pages.map((p) => ({
                    ...p,
                    elements: p.elements.map((e) => ({
                      ...e,
                      x: e.x * sx,
                      y: e.y * sy,
                      width: Math.max(1, e.width * sx),
                      height: Math.max(1, e.height * sy),
                      fontSize: e.fontSize ? Math.max(1, e.fontSize * Math.min(sx, sy)) : undefined,
                      radius: e.radius ? e.radius * Math.min(sx, sy) : undefined,
                      strokeWidth:
                        e.strokeWidth != null ? e.strokeWidth * Math.min(sx, sy) : undefined,
                      letterSpacing:
                        e.letterSpacing != null ? e.letterSpacing * Math.min(sx, sy) : undefined,
                    })),
                  }))
                : d.pages,
            }));
            setResize(false);
            toast('Design redimensionado.');
          }}
        />
      )}
      {replace && (
        <Modal
          title="Usar este modelo na página?"
          subtitle="Os elementos atuais serão substituídos. Você pode desfazer essa alteração a qualquer momento."
          onClose={() => setReplace(null)}
        >
          <div className="modal-footer">
            <button className="secondary" onClick={() => setReplace(null)}>
              Cancelar
            </button>
            <button className="primary" onClick={() => applyTemplate(replace)}>
              Aplicar modelo
            </button>
          </div>
        </Modal>
      )}
      {deletePage && (
        <Modal
          title={`Excluir a página ${index + 1}?`}
          subtitle="Você pode recuperar a página usando Desfazer."
          onClose={() => setDeletePage(false)}
        >
          <div className="modal-footer">
            <button className="secondary" onClick={() => setDeletePage(false)}>
              Cancelar
            </button>
            <button
              className="danger-button"
              onClick={() => {
                update((d) => ({ ...d, pages: d.pages.filter((_, i) => i !== index) }));
                setPageIndex(Math.max(0, index - 1));
                setSelected([]);
                setDeletePage(false);
              }}
            >
              Excluir página
            </button>
          </div>
        </Modal>
      )}
      {help && (
        <Modal title="Mais espaço para criar, menos cliques" onClose={() => setHelp(false)}>
          <div className="shortcut-grid">
            <span>Adicionar texto / retângulo</span>
            <kbd>T / R</kbd>
            <span>Adicionar círculo / linha</span>
            <kbd>C / L</kbd>
            <span>Editar texto</span>
            <kbd>Duplo clique</kbd>
            <span>Selecionar vários</span>
            <kbd>Shift + clique</kbd>
            <span>Desfazer / refazer</span>
            <kbd>Ctrl Z / Ctrl Shift Z</kbd>
            <span>Duplicar / selecionar tudo</span>
            <kbd>Ctrl D / Ctrl A</kbd>
            <span>Copiar / colar no editor</span>
            <kbd>Ctrl C / Ctrl V</kbd>
            <span>Mover / mover 10 px</span>
            <kbd>Setas / Shift + setas</kbd>
            <span>Salvar agora</span>
            <kbd>Ctrl S</kbd>
            <span>Excluir / limpar seleção</span>
            <kbd>Delete / Esc</kbd>
          </div>
          <p className="help-note">
            Seus projetos são salvos neste navegador. Para guardar uma cópia editável, escolha
            Arquivo → Salvar cópia .axis.
          </p>
        </Modal>
      )}
      {presenting && (
        <div
          className="presentation-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Visualização do design"
        >
          <div className="presentation-top">
            <Logo />
            <span>{doc.title}</span>
            <IconButton label="Fechar visualização" onClick={() => setPresenting(false)}>
              <X size={23} />
            </IconButton>
          </div>
          <div className="presentation-stage">
            <Scene page={page} width={doc.width} height={doc.height} />
          </div>
          <div className="presentation-controls">
            <IconButton
              label="Página anterior"
              disabled={index === 0}
              onClick={() => setPageIndex(index - 1)}
            >
              <ChevronLeft size={23} />
            </IconButton>
            <span>
              {index + 1} / {doc.pages.length}
            </span>
            <IconButton
              label="Próxima página"
              disabled={index === doc.pages.length - 1}
              onClick={() => setPageIndex(index + 1)}
            >
              <ChevronRight size={23} />
            </IconButton>
            <span className="presentation-tip">Use as setas para navegar · Esc para sair</span>
          </div>
        </div>
      )}
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  small = false,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  step?: number;
  small?: boolean;
}) {
  const [draft, setDraft] = useState(String(Math.round(value * 100) / 100));
  useEffect(() => setDraft(String(Math.round(value * 100) / 100)), [value]);
  const commit = () => {
    const n = Number(draft);
    if (draft !== '' && Number.isFinite(n)) {
      const next = Math.max(min, Math.min(max, n));
      if (next !== value) onChange(next);
      else setDraft(String(Math.round(value * 100) / 100));
    } else setDraft(String(Math.round(value * 100) / 100));
  };
  return (
    <label className={small ? 'small-number-field' : 'field-label'}>
      {!small && label}
      <input
        aria-label={label}
        className={small ? 'small-number-input' : 'text-input'}
        type="number"
        step={step}
        min={min}
        max={max}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
      />
    </label>
  );
}

function ExportDialog({
  doc,
  pageIndex,
  onClose,
  toast,
}: {
  doc: DesignDocument;
  pageIndex: number;
  onClose: () => void;
  toast: (s: string) => void;
}) {
  const [format, setFormat] = useState<ExportFormat>('png');
  const [scale, setScale] = useState(doc.width * doc.height > 32000000 ? 0.5 : 1);
  const [all, setAll] = useState(false);
  const [transparent, setTransparent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const download = async () => {
    setBusy(true);
    setError('');
    try {
      await exportDocument(
        doc,
        format,
        all ? doc.pages.map((_, i) => i) : [pageIndex],
        scale,
        transparent,
      );
      toast('Arquivo pronto. Sua ideia vai ganhar o mundo!');
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível exportar.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title="Pronto para ganhar o mundo?"
      subtitle="Escolha como levar seu design com você."
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <div className="export-summary">
        <div>
          <Scene page={doc.pages[pageIndex]} width={doc.width} height={doc.height} />
        </div>
        <span>
          <strong>{doc.title}</strong>
          <small>
            {doc.width} × {doc.height} px · {doc.pages.length}{' '}
            {doc.pages.length === 1 ? 'página' : 'páginas'}
          </small>
        </span>
      </div>
      <label className="field-label">
        Formato do arquivo
        <select
          aria-label="Formato do arquivo"
          className="text-input"
          value={format}
          onChange={(e) => {
            setFormat(e.target.value as ExportFormat);
            setError('');
          }}
        >
          <option value="png">PNG — imagem em alta qualidade</option>
          <option value="jpg">JPG — arquivo leve para compartilhar</option>
          <option value="svg">SVG — vetor para edição e ampliação</option>
          <option value="pdf">PDF — documento com múltiplas páginas</option>
          <option value="axis">AXIS — projeto editável com imagens incluídas</option>
        </select>
      </label>
      {['png', 'jpg', 'pdf'].includes(format) && (
        <label className="field-label">
          Resolução
          <select
            aria-label="Resolução"
            className="text-input"
            value={scale}
            onChange={(e) => setScale(Number(e.target.value))}
          >
            {[0.25, 0.5, 1, 2, 3].map((value) => (
              <option
                key={value}
                value={value}
                disabled={doc.width * doc.height * value * value > 32000000}
              >
                {value}× — {Math.round(doc.width * value)} × {Math.round(doc.height * value)} px
                {doc.width * doc.height * value * value > 32000000 ? ' (acima do limite)' : ''}
              </option>
            ))}
          </select>
        </label>
      )}
      {format !== 'axis' && doc.pages.length > 1 && (
        <div className="export-pages">
          <span className="field-label">Páginas</span>
          <label>
            <input type="radio" name="pages" checked={!all} onChange={() => setAll(false)} />
            Página atual <small>({pageIndex + 1})</small>
          </label>
          <label>
            <input type="radio" name="pages" checked={all} onChange={() => setAll(true)} />
            Todas as páginas <small>({doc.pages.length})</small>
          </label>
        </div>
      )}
      {(format === 'png' || format === 'svg') && (
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={transparent}
            onChange={(e) => setTransparent(e.target.checked)}
          />
          Fundo transparente
        </label>
      )}
      {all && ['png', 'jpg', 'svg'].includes(format) && (
        <p className="field-hint">
          Cada página será baixada como um arquivo separado. Seu navegador pode pedir para permitir
          vários downloads.
        </p>
      )}
      {format === 'axis' && (
        <p className="export-info">
          <CheckCircle2 size={17} />
          Uma cópia completa e editável, com todas as páginas e imagens. Importe em qualquer
          navegador com Axis Design.
        </p>
      )}
      {error && (
        <p role="alert" className="error-message">
          <AlertCircle size={16} />
          {error}
        </p>
      )}
      <div className="modal-footer">
        <span className="export-local-note">
          <HardDriveIcon />
          Exportação no seu dispositivo
        </span>
        <button className="primary" onClick={() => void download()} disabled={busy}>
          {busy ? <LoaderCircle size={17} className="spin" /> : <Download size={17} />}{' '}
          {busy ? 'Preparando...' : 'Baixar arquivo'}
        </button>
      </div>
    </Modal>
  );
}
function HardDriveIcon() {
  return <Cloud size={14} />;
}
function ResizeDialog({
  doc,
  onClose,
  onResize,
}: {
  doc: DesignDocument;
  onClose: () => void;
  onResize: (w: number, h: number, scale: boolean) => void;
}) {
  const [w, setW] = useState(doc.width),
    [h, setH] = useState(doc.height),
    [scale, setScale] = useState(true);
  const valid =
    Number.isInteger(w) && Number.isInteger(h) && w >= 100 && w <= 8000 && h >= 100 && h <= 8000;
  return (
    <Modal
      title="Um novo tamanho para sua ideia"
      subtitle="Ajuste as dimensões de todas as páginas do design."
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) onResize(w, h, scale);
        }}
      >
        <div className="dimension-fields">
          <label className="field-label">
            Largura
            <input
              className="text-input"
              aria-label="Nova largura"
              type="number"
              min={100}
              max={8000}
              value={w}
              onChange={(e) => setW(Number(e.target.value))}
            />
          </label>
          <X size={16} />
          <label className="field-label">
            Altura
            <input
              className="text-input"
              aria-label="Nova altura"
              type="number"
              min={100}
              max={8000}
              value={h}
              onChange={(e) => setH(Number(e.target.value))}
            />
          </label>
          <span>px</span>
        </div>
        <label className="checkbox-field">
          <input type="checkbox" checked={scale} onChange={(e) => setScale(e.target.checked)} />
          Ajustar elementos ao novo tamanho
        </label>
        <p className="field-hint">Entre 100 e 8.000 px. Você pode desfazer depois.</p>
        <div className="modal-footer">
          <button className="secondary" type="button" onClick={onClose}>
            Cancelar
          </button>
          <button className="primary" disabled={!valid}>
            <Maximize size={16} />
            Redimensionar
          </button>
        </div>
      </form>
    </Modal>
  );
}
