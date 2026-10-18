import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent, ReactNode } from 'react';
import {
  Search,
  Plus,
  UploadCloud,
  ClipboardPaste,
  ImageIcon,
  Type,
  Eye,
  EyeOff,
  LockKeyhole,
  LockKeyholeOpen,
  ArrowUp,
  ArrowDown,
  Trash2,
  Palette,
  Layers,
  LoaderCircle,
  X,
} from 'lucide-react';
import { element, uid } from './model';
import type { DesignDocument, DesignElement, ElementKind, Template } from './model';
import { templates, formTemplates, photos } from './templates';
import { ensureFont } from './fontLibrary';
import { Scene, Shape } from './Scene';
import './panels.css';
import { ElementsLibrary } from './ElementsLibrary';
import { Modal } from './ui';
import { textPresets } from './textPresets';
import type { TextPreset } from './textPresets';

export type PanelId = 'design' | 'elements' | 'text' | 'forms' | 'tools' | 'uploads' | 'photos' | 'brand' | 'layers';
interface Props {
  panel: PanelId;
  onClose: () => void;
  resizeHandle?: ReactNode;
  doc: DesignDocument;
  pageIndex: number;
  selected: string[];
  onAdd: (element: DesignElement) => void;
  onAddMany: (elements: DesignElement[]) => void;
  onApplyTemplate: (template: Template) => void;
  onSelect: (ids: string[]) => void;
  onChangeElements: (elements: DesignElement[], commit?: boolean) => void;
  onBackground: (color: string) => void;
  onImportDocument: () => void;
  replaceImageOpen: boolean;
  onCloseReplaceImage: () => void;
  onReplaceImage: (src: string, name: string) => void;
  onPasteImage: () => void;
  toast: (message: string) => void;
}
type Upload = { id: string; name: string; src: string; width: number; height: number };
const titles: Record<PanelId, string> = {
  design: 'Design',
  elements: 'Elementos',
  text: 'Texto',
  forms: 'Formulários',
  tools: 'Ferramentas',
  uploads: 'Uploads',
  photos: 'Fotos',
  brand: 'Sua marca',
  layers: 'Camadas',
};
const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
const matches = (value: string, query: string) =>
  normalize(value).includes(normalize(query.trim()));
const singlePageTemplates = templates.filter((template) => !template.pages?.length || template.pages.length === 1);
function readBrand(): { name: string; colors: string[] } {
  try {
    const value = JSON.parse(localStorage.getItem('axis-brand') || 'null');
    return {
      name: typeof value?.name === 'string' ? value.name.slice(0, 60) : 'Minha marca',
      colors: Array.isArray(value?.colors)
        ? value.colors
            .filter((v: unknown) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v))
            .slice(0, 16)
        : ['#4b57db', '#c5e8a7', '#191c2e'],
    };
  } catch {
    return { name: 'Minha marca', colors: ['#4b57db', '#c5e8a7', '#191c2e'] };
  }
}
function decodeImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Não foi possível abrir esta imagem.'));
    image.src = src;
  });
}
function scaleTemplate(template: Template, width: number, height: number): Template {
  const scale = Math.min(width / template.width, height / template.height),
    dx = (width - template.width * scale) / 2,
    dy = (height - template.height * scale) / 2;
  return {
    ...template,
    width,
    height,
    page: {
      ...template.page,
      elements: template.page.elements.map((e) => ({
        ...e,
        id: uid(),
        x: e.x * scale + dx,
        y: e.y * scale + dy,
        width: e.width * scale,
        height: e.height * scale,
        fontSize: e.fontSize === undefined ? undefined : e.fontSize * scale,
        letterSpacing: e.letterSpacing === undefined ? undefined : e.letterSpacing * scale,
        radius: e.radius === undefined ? undefined : e.radius * scale,
        strokeWidth: e.strokeWidth === undefined ? undefined : e.strokeWidth * scale,
      })),
    },
  };
}

export function EditorPanel({
  panel,
  onClose,
  resizeHandle,
  doc,
  pageIndex,
  selected,
  onAdd,
  onAddMany,
  onApplyTemplate,
  onSelect,
  onChangeElements,
  onBackground,
  onImportDocument,
  replaceImageOpen,
  onCloseReplaceImage,
  onReplaceImage,
  onPasteImage,
  toast,
}: Props) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Todos');
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [brand, setBrand] = useState(readBrand);
  const [brandColor, setBrandColor] = useState('#4b57db');
  const [, refreshFontPreviews] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const replaceFileRef = useRef<HTMLInputElement>(null);
  const [replaceTab, setReplaceTab] = useState<'uploads' | 'photos' | 'upload'>('uploads');
  const page = doc.pages[pageIndex] ?? doc.pages[0];
  useEffect(() => {
    setQuery('');
    setCategory('Todos');
  }, [panel]);
  useEffect(() => {
    if (!['text', 'forms', 'design'].includes(panel)) return;
    let active = true;
    const pages = panel === 'text' ? textPresets.map((preset) => preset.page)
      : (panel === 'forms' ? formTemplates : singlePageTemplates).map((template) => template.page);
    const faces = new Map(pages.flatMap((page) => page.elements.filter((item) => item.kind === 'text')
      .map((item) => [
        `${item.fontFamily}:${item.fontWeight}:${item.fontStyle}`,
        { family: item.fontFamily ?? 'DM Sans', weight: item.fontWeight ?? 400, style: item.fontStyle ?? 'normal' },
      ] as const)));
    void Promise.all([...faces.values()].map((face) =>
      ensureFont(face.family, face.weight, face.style, doc.fonts).catch(() => null)))
      .then(() => { if (active) refreshFontPreviews((value) => value + 1); });
    return () => { active = false; };
  }, [doc.fonts, panel]);
  useEffect(() => {
    try {
      localStorage.setItem('axis-brand', JSON.stringify(brand));
    } catch {
      /* Branding remains editable if storage is unavailable. */
    }
  }, [brand]);
  const centered = (kind: ElementKind, props: Partial<DesignElement> = {}) => {
    const size = Math.min(doc.width, doc.height) * 0.28;
    const width = props.width ?? size,
      height = props.height ?? size;
    onAdd(
      element(kind, {
        ...props,
        width,
        height,
        x: (doc.width - width) / 2,
        y: (doc.height - height) / 2,
      }),
    );
  };
  const addText = (
    text: string,
    size: number,
    weight = 400,
    fontFamily = 'DM Sans',
    fill = '#191c2e',
  ) => {
    const fontSize = Math.round(Math.min(doc.width, doc.height) * size);
    centered('text', {
      name: text,
      text,
      width: doc.width * 0.76,
      height: fontSize * 1.35,
      fontSize,
      fontFamily,
      fontWeight: weight,
      fill,
      lineHeight: 1.2,
      textAlign: 'center',
    });
  };
  const addImage = (src: string, name: string, width: number, height: number) => {
    const scale = Math.min((doc.width * 0.72) / width, (doc.height * 0.72) / height, 1);
    centered('image', {
      src,
      name,
      width: Math.max(1, width * scale),
      height: Math.max(1, height * scale),
    });
  };
  const addPhoto = async (id: string, name: string) => {
    try {
      const src = `/photos/${id}.jpg`,
        image = await decodeImage(src);
      addImage(src, name, image.naturalWidth, image.naturalHeight);
    } catch {
      toast('Esta foto não está disponível. Tente outra.');
    }
  };
  const addTextPreset = (preset: TextPreset) => {
    const scale = Math.min(doc.width * 0.78 / 800, doc.height * 0.54 / 500);
    const left = (doc.width - 800 * scale) / 2;
    const top = (doc.height - 500 * scale) / 2;
    const groupId = uid();
    onAddMany(preset.page.elements.map((item) => ({
      ...structuredClone(item), id: uid(), groupId,
      x: left + item.x * scale, y: top + item.y * scale,
      width: item.width * scale, height: item.height * scale,
      fontSize: item.fontSize ? item.fontSize * scale : undefined,
      letterSpacing: item.letterSpacing ? item.letterSpacing * scale : undefined,
    })));
  };
  const addFormTemplate = (form: Template) =>
    onApplyTemplate(scaleTemplate(form, doc.width, doc.height));
  const prepareUpload = async (file: File): Promise<Upload> => {
    if (
      !['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type) ||
      file.size > 15 * 1024 * 1024
    )
      throw new Error('Use PNG, JPG, WebP ou GIF de até 15 MB.');
    let src = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const img = await decodeImage(src);
    if (!img.naturalWidth || !img.naturalHeight) throw new Error('Imagem inválida');
    let width = img.naturalWidth,
      height = img.naturalHeight;
    if (Math.max(width, height) > 3000) {
      const scale = 3000 / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas indisponível');
      ctx.drawImage(img, 0, 0, width, height);
      src = canvas.toDataURL('image/png');
    }
    return { id: uid(), name: file.name.slice(0, 80), src, width, height };
  };
  const receiveFiles = async (files: FileList | null) => {
    if (!files?.length || busy) return;
    setBusy(true);
    const added: Upload[] = [];
    let rejected = 0;
    for (const file of Array.from(files).slice(0, 12)) {
      try {
        added.push(await prepareUpload(file));
      } catch {
        rejected++;
      }
    }
    setUploads((old) => [...added, ...old].slice(0, 40));
    setBusy(false);
    if (added.length)
      toast(
        `${added.length} ${added.length === 1 ? 'imagem pronta' : 'imagens prontas'} para usar.`,
      );
    if (rejected)
      toast(`${rejected} arquivo(s) não importado(s). Use PNG, JPG, WebP ou GIF até 15 MB.`);
    if (files.length > 12) toast('Importe até 12 imagens por vez.');
    if (fileRef.current) fileRef.current.value = '';
  };
  const receiveReplacementFile = async (file?: File) => {
    if (!file || busy) return;
    setBusy(true);
    try {
      const asset = await prepareUpload(file);
      setUploads((old) => [asset, ...old].slice(0, 40));
      onReplaceImage(asset.src, asset.name);
      onCloseReplaceImage();
      toast('Imagem enviada e substituída.');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Não foi possível abrir esta imagem.');
    } finally {
      setBusy(false);
      if (replaceFileRef.current) replaceFileRef.current.value = '';
    }
  };
  const chooseReplacement = (src: string, name: string) => {
    onReplaceImage(src, name);
    onCloseReplaceImage();
  };
  const changeLayer = (id: string, patch: Partial<DesignElement>) =>
    onChangeElements(page.elements.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  const moveLayer = (id: string, direction: 1 | -1) => {
    const elements = [...page.elements],
      index = elements.findIndex((e) => e.id === id),
      next = index + direction;
    if (index < 0 || next < 0 || next >= elements.length) return;
    [elements[index], elements[next]] = [elements[next], elements[index]];
    onChangeElements(elements);
  };
  const search = (placeholder: string) => (
    <label className="panel-search">
      <Search size={17} />
      <input
        aria-label={placeholder}
        placeholder={placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {query && (
        <button title="Limpar busca" aria-label="Limpar busca" onClick={() => setQuery('')}>
          ×
        </button>
      )}
    </label>
  );
  const empty = (message: string) => (
    <div className="panel-empty">
      <Search size={25} />
      <p>{message}</p>
    </div>
  );
  return (
    <aside className="editor-panel" aria-label={titles[panel]}>
      {resizeHandle}
      <div className="panel-heading">
        <h2>{titles[panel]}</h2>
        {panel === 'design' && <span className="panel-tag">Feito para criar</span>}
        <button type="button" className="panel-close" aria-label="Fechar painel de ferramentas" onClick={onClose}>
          <X size={19} />
        </button>
      </div>
      <div className="panel-content">
        {panel === 'design' && (
          <>
            {search('Buscar modelos')}
            <div className="panel-chips" aria-label="Categorias de modelos">
              {['Todos', ...new Set(singlePageTemplates.map((t) => t.category))].map((c) => (
                <button
                  key={c}
                  className={category === c ? 'active' : ''}
                  aria-pressed={category === c}
                  onClick={() => setCategory(c)}
                >
                  {c}
                </button>
              ))}
            </div>
            <div className="panel-section-title">
              <h3>Um começo inspirador</h3>
              <span>
                {
                  singlePageTemplates.filter(
                    (t) =>
                      (category === 'Todos' || t.category === category) &&
                      matches(`${t.title} ${t.category}`, query),
                  ).length
                }
              </span>
            </div>
            <p className="panel-help">Escolha um modelo e deixe com a sua cara.</p>
            <div className="panel-template-grid">
              {singlePageTemplates
                .filter(
                  (t) =>
                    (category === 'Todos' || t.category === category) &&
                    matches(`${t.title} ${t.category}`, query),
                )
                .map((t) => (
                  <button
                    key={t.id}
                    className="panel-template"
                    onClick={() => onApplyTemplate(scaleTemplate(t, doc.width, doc.height))}
                    title={`Aplicar modelo ${t.title}`}
                  >
                    <div className="panel-template-preview" style={{ background: t.color }}>
                      <Scene page={t.page} width={t.width} height={t.height} />
                    </div>
                    <span>{t.title}</span>
                    <small>{t.category}</small>
                  </button>
                ))}
            </div>
            {!singlePageTemplates.some(
              (t) =>
                (category === 'Todos' || t.category === category) &&
                matches(`${t.title} ${t.category}`, query),
            ) && empty('Nenhum modelo encontrado. Experimente outra palavra.')}
          </>
        )}
        {panel === 'elements' && (
          <ElementsLibrary
            width={doc.width}
            height={doc.height}
            onAdd={onAdd}
            onBackground={onBackground}
            background={page.background}
            toast={toast}
          />
        )}
        {panel === 'text' && (
          <>
            <p className="panel-help">Comece um texto ou escolha uma composição pronta.</p>
            <button className="panel-primary" onClick={() => addText('Seu texto aqui', 0.055)}>
              <Plus size={18} />
              Adicionar caixa de texto
            </button>
            <div className="panel-text-options">
              <button aria-label="Adicione um título" onClick={() => addText('Adicione um título', 0.075, 700)}>
                Título
              </button>
              <button aria-label="Adicione um subtítulo" onClick={() => addText('Adicione um subtítulo', 0.045, 500)}>
                Subtítulo
              </button>
              <button aria-label="Adicione um texto" onClick={() => addText('Escreva um pouco sobre a sua ideia.', 0.028)}>
                Corpo
              </button>
            </div>
            <h3 className="panel-section-label">Composições de texto</h3>
            <p className="panel-help">Tipografia, proporções e detalhes prontos para editar. A composição entra como aparece na prévia.</p>
            {search('Buscar estilos de texto')}
            <div className="panel-chips" aria-label="Estilos de texto">
              {['Todos', ...new Set(textPresets.map((preset) => preset.category))].map((style) => (
                <button key={style} type="button" className={category === style ? 'active' : ''}
                  aria-pressed={category === style} onClick={() => setCategory(style)}>{style}</button>
              ))}
            </div>
            <div className="typography-preset-grid">
              {textPresets.filter((preset) => (category === 'Todos' || category === preset.category) &&
                matches(`${preset.title} ${preset.category} ${preset.page.elements.map((item) => item.text ?? '').join(' ')}`, query))
                .map((preset) => (
                  <button key={preset.id} type="button" className="typography-preset-card"
                    aria-label={`Inserir composição ${preset.title}`} onClick={() => addTextPreset(preset)}>
                    <div style={{ background: preset.page.background }}>
                      <Scene page={preset.page} width={800} height={500} />
                    </div>
                    <strong>{preset.title}</strong>
                    <small>{preset.category} · Editável</small>
                  </button>
                ))}
            </div>
            {!textPresets.some((preset) => (category === 'Todos' || category === preset.category) &&
              matches(`${preset.title} ${preset.category} ${preset.page.elements.map((item) => item.text ?? '').join(' ')}`, query)) &&
              empty('Nenhuma composição encontrada. Experimente outro estilo.')}

          </>
        )}
        {panel === 'forms' && (
          <>
            {search('Buscar formulários')}
            <p className="panel-help">Modelos editáveis para capturar respostas, organizar atividades e receber confirmações.</p>
            <div className="panel-chips" aria-label="Categorias de formulários">
              {['Todos', ...new Set(formTemplates.map((form) => form.category))].map((item) => (
                <button key={item} className={category === item ? 'active' : ''} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>
              ))}
            </div>
            <div className="forms-grid">
              {formTemplates.filter((form) => (category === 'Todos' || form.category === category) && matches(`${form.title} ${form.category}`, query)).map((form) => (
                <button key={form.id} type="button" className="form-template-card" onClick={() => addFormTemplate(form)} title={`Usar ${form.title}`}>
                  <div className="form-template-preview" style={{ background: form.color }}><Scene page={form.page} width={form.width} height={form.height} /></div>
                  <strong>{form.title}</strong><small>{form.category}</small>
                </button>
              ))}
            </div>
            {!formTemplates.some((form) => (category === 'Todos' || form.category === category) && matches(`${form.title} ${form.category}`, query)) && empty('Nenhum formulário encontrado.')}
          </>
        )}
        {panel === 'photos' && (
          <>
            {search('Buscar fotos')}
            <p className="panel-help">Um olhar novo para a sua próxima ideia.</p>
            <div className="panel-photo-grid">
              {photos
                .filter((p) => matches(`${p.title} ${p.author} ${p.id}`, query))
                .map((p) => (
                  <button
                    key={p.id}
                    title={`Adicionar foto: ${p.title}`}
                    onClick={() => void addPhoto(p.id, p.title)}
                  >
                    <img loading="lazy" src={`/photos/${p.id}.jpg`} alt={p.title} />
                    <span>{p.title}</span>
                  </button>
                ))}
            </div>
            {!photos.some((p) => matches(`${p.title} ${p.author} ${p.id}`, query)) &&
              empty('Nenhuma foto encontrada. Tente natureza, casa ou retrato.')}
            <p className="panel-footnote">
              Fotografias e imagens editoriais. Disponíveis neste dispositivo.
            </p>
          </>
        )}
        {panel === 'uploads' && (
          <>
            <button className="secondary" onClick={onImportDocument}>
              <UploadCloud size={17} /> Importar PDF ou documento
            </button>
            <p className="panel-help">
              Abra PDF, Word, PowerPoint ou texto em um novo design editável.
            </p>
            <input
              ref={fileRef}
              className="panel-hidden-input"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              multiple
              onChange={(e: ChangeEvent<HTMLInputElement>) => void receiveFiles(e.target.files)}
            />
            <button
              className="panel-primary"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
            >
              {busy ? <LoaderCircle className="panel-spinner" size={18} /> : <Plus size={18} />}{' '}
              {busy ? 'Preparando imagens…' : 'Enviar imagens'}
            </button>
            <div
              className={`panel-dropzone ${dragging ? 'dragging' : ''}`}
              onDragOver={(e: DragEvent) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                void receiveFiles(e.dataTransfer.files);
              }}
            >
              <UploadCloud size={31} />
              <strong>Suas ideias começam aqui</strong>
              <span>Arraste imagens para esta área</span>
              <small>PNG, JPG, WebP ou GIF · até 15 MB</small>
            </div>
            <h3 className="panel-section-label">
              Suas imagens {uploads.length > 0 && <span>({uploads.length})</span>}
            </h3>
            {uploads.length ? (
              <div className="panel-photo-grid">
                {uploads.map((upload) => (
                  <div className="panel-upload-item" key={upload.id}>
                    <button
                      title={`Adicionar ${upload.name}`}
                      onClick={() => addImage(upload.src, upload.name, upload.width, upload.height)}
                    >
                      <img src={upload.src} alt={upload.name} />
                      <span>{upload.name}</span>
                    </button>
                    <button
                      className="panel-upload-delete"
                      title={`Remover ${upload.name} dos uploads`}
                      aria-label={`Remover ${upload.name} dos uploads`}
                      onClick={() => setUploads((old) => old.filter((u) => u.id !== upload.id))}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="panel-help">
                As imagens enviadas aparecem aqui. Clique em uma para adicioná-la ao design.
              </p>
            )}
            <p className="panel-footnote">
              Uploads ficam nesta sessão. Imagens usadas são salvas com o projeto. GIFs grandes são
              convertidos em imagem estática.
            </p>
          </>
        )}
        {panel === 'brand' && (
          <>
            <div className="panel-brand-card">
              <Palette size={26} />
              <strong>Um estilo que é só seu.</strong>
              <span>Guarde suas cores para criar com consistência.</span>
            </div>
            <label className="panel-field">
              Nome da marca
              <input
                maxLength={60}
                value={brand.name}
                placeholder="Minha marca"
                onChange={(e) => setBrand((b) => ({ ...b, name: e.target.value }))}
              />
            </label>
            <h3 className="panel-section-label">Paleta da marca</h3>
            <div className="panel-brand-colors">
              {brand.colors.map((c, i) => (
                <div key={`${c}-${i}`}>
                  <button
                    className="panel-brand-color"
                    style={{ background: c }}
                    title={`Aplicar ${c} ao fundo`}
                    aria-label={`Aplicar ${c} ao fundo`}
                    onClick={() => onBackground(c)}
                  />
                  <span>{c.toUpperCase()}</span>
                  <button
                    title={`Remover cor ${c}`}
                    aria-label={`Remover cor ${c}`}
                    onClick={() =>
                      setBrand((b) => ({
                        ...b,
                        colors: b.colors.filter((_, index) => index !== i),
                      }))
                    }
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
            <div className="panel-color-add">
              <input
                type="color"
                value={brandColor}
                aria-label="Nova cor da marca"
                onChange={(e) => setBrandColor(e.target.value)}
              />
              <button
                disabled={brand.colors.length >= 16 || brand.colors.includes(brandColor)}
                onClick={() => setBrand((b) => ({ ...b, colors: [...b.colors, brandColor] }))}
              >
                <Plus size={16} />
                Adicionar cor
              </button>
            </div>
            <h3 className="panel-section-label">Leve sua marca ao design</h3>
            <button
              className="panel-secondary"
              onClick={() =>
                addText(
                  brand.name.trim() || 'Minha marca',
                  0.065,
                  700,
                  'Manrope',
                  brand.colors[0] || '#191c2e',
                )
              }
            >
              <Type size={17} />
              Adicionar nome da marca
            </button>
            <button
              className="panel-secondary"
              disabled={!brand.colors.length}
              onClick={() => onBackground(brand.colors[0])}
            >
              <Palette size={17} />
              Usar cor principal no fundo
            </button>
            <p className="panel-footnote">
              Sua marca é guardada neste navegador, neste dispositivo.
            </p>
          </>
        )}
        {panel === 'layers' && (
          <>
            <p className="panel-help">
              A camada no topo aparece à frente. Use Shift para selecionar mais de uma.
            </p>
            {!page.elements.length ? (
              <div className="panel-empty">
                <Layers size={30} />
                <strong>Um espaço para suas ideias</strong>
                <p>Adicione texto, formas ou fotos para começar.</p>
              </div>
            ) : (
              <div className="panel-layer-list">
                {[...page.elements].reverse().map((e) => {
                  const index = page.elements.findIndex((item) => item.id === e.id);
                  return (
                    <div
                      key={e.id}
                      className={`panel-layer ${selected.includes(e.id) ? 'selected' : ''} ${e.hidden ? 'hidden-layer' : ''}`}
                    >
                      <button
                        className="panel-layer-select"
                        title={`Selecionar ${e.name}`}
                        aria-pressed={selected.includes(e.id)}
                        onClick={(event) =>
                          onSelect(
                            event.shiftKey
                              ? selected.includes(e.id)
                                ? selected.filter((id) => id !== e.id)
                                : [...selected, e.id]
                              : [e.id],
                          )
                        }
                      >
                        <span className="panel-layer-thumb">
                          {e.kind === 'image' ? (
                            <ImageIcon size={17} />
                          ) : e.kind === 'text' ? (
                            <Type size={18} />
                          ) : (
                            <svg viewBox="-5 -5 90 74" aria-hidden="true">
                              <Shape
                                e={{ ...e, id: `layer-${e.id}`, width: 80, height: 64, x: 0, y: 0 }}
                              />
                            </svg>
                          )}
                        </span>
                        <span>{e.name || e.text?.slice(0, 30) || 'Elemento'}</span>
                      </button>
                      <div className="panel-layer-actions">
                        <button
                          title={e.hidden ? 'Mostrar camada' : 'Ocultar camada'}
                          aria-label={e.hidden ? 'Mostrar camada' : 'Ocultar camada'}
                          onClick={() => changeLayer(e.id, { hidden: !e.hidden })}
                        >
                          {e.hidden ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                        <button
                          title={e.locked ? 'Desbloquear camada' : 'Bloquear camada'}
                          aria-label={e.locked ? 'Desbloquear camada' : 'Bloquear camada'}
                          onClick={() => changeLayer(e.id, { locked: !e.locked })}
                        >
                          {e.locked ? <LockKeyhole size={14} /> : <LockKeyholeOpen size={14} />}
                        </button>
                        <button
                          disabled={index === page.elements.length - 1}
                          title="Mover camada para frente"
                          aria-label="Mover camada para frente"
                          onClick={() => moveLayer(e.id, 1)}
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button
                          disabled={index === 0}
                          title="Mover camada para trás"
                          aria-label="Mover camada para trás"
                          onClick={() => moveLayer(e.id, -1)}
                        >
                          <ArrowDown size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="panel-background-row">
              <span className="panel-background-swatch" style={{ background: page.background }} />
              <span>Fundo da página</span>
              <LockKeyhole size={13} />
            </div>
          </>
        )}
      </div>
      {replaceImageOpen && (
        <Modal
          title="Substituir imagem"
          subtitle="Escolha um upload, uma foto ou use uma imagem copiada. O quadro da arte será mantido."
          onClose={onCloseReplaceImage}
          wide
        >
          <div className="replacement-tabs" role="tablist" aria-label="Origem da imagem">
            {(
              [
                ['uploads', 'Uploads'],
                ['photos', 'Fotos'],
                ['upload', 'Do computador'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={replaceTab === id}
                className={replaceTab === id ? 'active' : ''}
                onClick={() => setReplaceTab(id)}
              >
                {label}
              </button>
            ))}
          </div>
          {replaceTab === 'uploads' && (
            uploads.length ? (
              <div className="replacement-grid">
                {uploads.map((upload) => (
                  <button
                    type="button"
                    className="replacement-asset"
                    key={upload.id}
                    aria-label={`Usar upload ${upload.name}`}
                    onClick={() => chooseReplacement(upload.src, upload.name)}
                  >
                    <img src={upload.src} alt="" />
                    <span>{upload.name}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="replacement-empty">
                <ImageIcon size={27} />
                <strong>Nenhum upload nesta sessão</strong>
                <span>Envie uma imagem ou escolha uma foto para adicioná-la aos uploads.</span>
                <button type="button" className="secondary" onClick={() => setReplaceTab('upload')}>
                  Enviar uma imagem
                </button>
              </div>
            )
          )}
          {replaceTab === 'photos' && (
            <div className="replacement-grid">
              {photos.map((photo) => (
                <button
                  type="button"
                  className="replacement-asset"
                  key={photo.id}
                  aria-label={`Usar foto ${photo.title}`}
                  onClick={() => chooseReplacement(`/photos/${photo.id}.jpg`, photo.title)}
                >
                  <img loading="lazy" src={`/photos/${photo.id}.jpg`} alt="" />
                  <span>{photo.title}</span>
                </button>
              ))}
            </div>
          )}
          {replaceTab === 'upload' && (
            <div className="replacement-upload">
              <input
                ref={replaceFileRef}
                hidden
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                aria-label="Arquivo de imagem para substituir"
                onChange={(event) => void receiveReplacementFile(event.currentTarget.files?.[0])}
              />
              <UploadCloud size={32} />
              <strong>Escolha uma imagem do seu dispositivo</strong>
              <span>PNG, JPG, WebP ou GIF · até 15 MB</span>
              <button
                type="button"
                className="panel-primary"
                disabled={busy}
                onClick={() => replaceFileRef.current?.click()}
              >
                {busy ? <LoaderCircle className="panel-spinner" size={18} /> : <Plus size={18} />}
                {busy ? 'Preparando imagem…' : 'Enviar e substituir'}
              </button>
              <div className="replacement-paste">
                <button type="button" className="secondary" onClick={onPasteImage}>
                  <ClipboardPaste size={16} /> Colar imagem copiada
                </button>
                <small>Ou copie uma imagem no navegador e pressione Ctrl+V aqui.</small>
              </div>
            </div>
          )}
        </Modal>
      )}
    </aside>
  );
}
