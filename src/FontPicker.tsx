import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  Star,
  Upload,
  Check,
  LoaderCircle,
  WifiOff,
  Type,
  ChevronDown,
} from 'lucide-react';
import { Modal } from './ui';
import { fonts } from './model';
import type { CatalogFont, EmbeddedFont } from './fontTypes';
import { ensureFont, getFontCatalog, importFont, savedFontFaces } from './fontLibrary';
import './library.css';

const categories = [
  { id: 'all', label: 'Todas' },
  { id: 'sans-serif', label: 'Sem serifa' },
  { id: 'serif', label: 'Serifadas' },
  { id: 'display', label: 'Destaque' },
  { id: 'handwriting', label: 'Manuscritas' },
  { id: 'monospace', label: 'Monoespaçadas' },
  { id: 'saved', label: 'No dispositivo' },
  { id: 'favorites', label: 'Favoritas' },
];
const popular = [
  'DM Sans',
  'Manrope',
  'Inter',
  'Montserrat',
  'Poppins',
  'Playfair Display',
  'Roboto',
  'Lato',
  'Oswald',
  'Nunito',
  'Raleway',
  'Merriweather',
  'Bebas Neue',
  'Dancing Script',
  'Pacifico',
  'Anton',
  'Lora',
  'Space Grotesk',
];
const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
function storedFavorites(): string[] {
  try {
    const list = JSON.parse(localStorage.getItem('axis-favorite-fonts') ?? '[]');
    return Array.isArray(list) ? list.filter((x) => typeof x === 'string').slice(0, 300) : [];
  } catch {
    return [];
  }
}
export function FontPicker({
  value,
  weight = 400,
  style = 'normal',
  embedded = [],
  onChoose,
  onClose,
}: {
  value: string;
  weight?: number;
  style?: 'normal' | 'italic';
  embedded?: EmbeddedFont[];
  onChoose: (family: string, face: EmbeddedFont | null) => void;
  onClose: () => void;
}) {
  const [catalog, setCatalog] = useState<CatalogFont[]>([]),
    [saved, setSaved] = useState<EmbeddedFont[]>([]);
  const [query, setQuery] = useState(''),
    [category, setCategory] = useState('all'),
    [preview, setPreview] = useState('A sua próxima ideia começa aqui.');
  const [limit, setLimit] = useState(40),
    [favorites, setFavorites] = useState(storedFavorites);
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(''),
    [error, setError] = useState('');
  const upload = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let active = true;
    getFontCatalog()
      .then((list) => {
        if (active) setCatalog(list);
      })
      .catch(() => {
        if (active) setError('Não foi possível abrir o catálogo de fontes.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    const refresh = () =>
      void savedFontFaces()
        .then((list) => {
          if (active) setSaved(list);
        })
        .catch(() => {});
    refresh();
    window.addEventListener('axis-font-library-change', refresh);
    return () => {
      active = false;
      window.removeEventListener('axis-font-library-change', refresh);
    };
  }, []);
  useEffect(() => setLimit(40), [query, category]);
  const savedNames = useMemo(
    () =>
      new Set([
        ...popular,
        ...saved.map((f) => f.family),
        ...embedded.map((f) => f.family),
        ...fonts,
      ]),
    [saved, embedded],
  );
  const rows = useMemo(() => {
    const list = new Map(catalog.map((f) => [f.family, f]));
    for (const name of [...fonts, ...saved.map((f) => f.family), ...embedded.map((f) => f.family)])
      if (!list.has(name))
        list.set(name, {
          id: name,
          family: name,
          category: 'custom',
          weights: [400],
          styles: ['normal'],
          subsets: ['latin'],
          defSubset: 'latin',
        });
    return [...list.values()]
      .filter(
        (f) =>
          normalize(f.family).includes(normalize(query)) &&
          (category === 'all' ||
            (category === 'saved' && savedNames.has(f.family)) ||
            (category === 'favorites' && favorites.includes(f.family)) ||
            f.category === category),
      )
      .sort((a, b) => {
        const ai = popular.indexOf(a.family),
          bi = popular.indexOf(b.family);
        return (ai < 0 ? 1000 : ai) - (bi < 0 ? 1000 : bi) || a.family.localeCompare(b.family);
      });
  }, [catalog, saved, embedded, query, category, favorites, savedNames]);
  const choose = async (family: string) => {
    setBusy(family);
    setError('');
    try {
      const face = await ensureFont(family, weight, style, embedded);
      onChoose(family, face);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'A fonte não pôde ser carregada.');
    } finally {
      setBusy('');
    }
  };
  const toggleFavorite = (family: string) =>
    setFavorites((prev) => {
      const next = prev.includes(family) ? prev.filter((f) => f !== family) : [...prev, family];
      try {
        localStorage.setItem('axis-favorite-fonts', JSON.stringify(next));
      } catch {
        /* Favorite still works this session. */
      }
      return next;
    });
  return (
    <Modal
      wide
      title="Encontre a voz da sua ideia"
      subtitle={`${catalog.length.toLocaleString('pt-BR')} famílias de fontes abertas, e espaço para as suas.`}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <div className="font-library-controls">
        <label className="library-search">
          <Search size={18} />
          <input
            autoFocus
            placeholder="Buscar uma fonte..."
            aria-label="Buscar fontes"
            data-autofocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <button
          className="secondary font-upload-button"
          disabled={!!busy}
          onClick={() => upload.current?.click()}
        >
          <Upload size={16} />
          <span>Enviar fonte</span>
        </button>
        <input
          ref={upload}
          type="file"
          accept=".woff2,.woff,.ttf,.otf"
          hidden
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setBusy(file.name);
            setError('');
            try {
              const face = await importFont(file);
              onChoose(face.family, face);
              onClose();
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Arquivo de fonte inválido.');
            } finally {
              setBusy('');
              e.target.value = '';
            }
          }}
        />
      </div>
      <div className="library-chips font-category-chips" aria-label="Categorias de fontes">
        {categories.map((c) => (
          <button
            key={c.id}
            className={category === c.id ? 'active' : ''}
            aria-pressed={category === c.id}
            onClick={() => setCategory(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>
      <label className="font-preview-field">
        <Type size={16} />
        <input
          aria-label="Texto de prévia das fontes"
          maxLength={80}
          value={preview}
          onChange={(e) => setPreview(e.target.value)}
        />
      </label>
      <div className="font-list-heading">
        <span>
          {rows.length.toLocaleString('pt-BR')} {rows.length === 1 ? 'fonte' : 'fontes'}
        </span>
        <span>Português · Aa 123</span>
      </div>
      <div className="font-library-list" aria-busy={loading}>
        {loading ? (
          <div className="library-loading">
            <LoaderCircle className="spin" />
            Preparando suas fontes...
          </div>
        ) : (
          rows
            .slice(0, limit)
            .map((font) => (
              <FontRow
                key={font.family}
                font={font}
                preview={preview}
                selected={value === font.family}
                favorite={favorites.includes(font.family)}
                embedded={embedded}
                busy={!!busy}
                choosing={busy === font.family}
                onChoose={() => void choose(font.family)}
                onFavorite={() => toggleFavorite(font.family)}
              />
            ))
        )}
        {!loading && rows.length === 0 && (
          <div className="library-empty">
            <Search size={28} />
            <strong>Nenhuma fonte encontrada</strong>
            <p>Experimente outro nome ou categoria.</p>
          </div>
        )}
        {rows.length > limit && (
          <button className="library-load-more" onClick={() => setLimit((n) => n + 40)}>
            Mostrar mais fontes <ChevronDown size={16} />
          </button>
        )}
      </div>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      <div className="font-library-footer">
        <span>
          <WifiOff size={14} />
          16 famílias prontas para usar offline. As outras são baixadas ao usar.
        </span>
        <small>WOFF2, WOFF, TTF ou OTF · até 10 MB por fonte</small>
      </div>
    </Modal>
  );
}
function FontRow({
  font,
  preview,
  selected,
  favorite,
  embedded,
  busy,
  choosing,
  onChoose,
  onFavorite,
}: {
  font: CatalogFont;
  preview: string;
  selected: boolean;
  favorite: boolean;
  embedded: EmbeddedFont[];
  busy: boolean;
  choosing: boolean;
  onChoose: () => void;
  onFavorite: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false),
    [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          observer.disconnect();
          void ensureFont(font.family, 400, 'normal', embedded)
            .then(() => {
              if (active) setReady(true);
            })
            .catch(() => {
              if (active) setFailed(true);
            });
        }
      },
      { root: ref.current?.closest('.font-library-list') ?? null, rootMargin: '30px' },
    );
    if (ref.current) observer.observe(ref.current);
    return () => {
      active = false;
      observer.disconnect();
    };
  }, [font.family, embedded]);
  return (
    <div ref={ref} className={`font-library-row ${selected ? 'selected' : ''}`}>
      <button
        className="font-choice"
        disabled={busy}
        onClick={onChoose}
        aria-label={`Usar fonte ${font.family}`}
      >
        <span className="font-row-meta">
          <strong>{font.family}</strong>
          <small>
            {selected ? (
              <>
                <Check size={12} />
                Em uso
              </>
            ) : failed ? (
              'Baixar ao selecionar'
            ) : font.category === 'custom' ? (
              'Sua fonte'
            ) : (
              font.category.replace('sans-serif', 'sem serifa').replace('handwriting', 'manuscrita')
            )}
          </small>
        </span>
        <span
          className="font-row-sample"
          style={{ fontFamily: ready ? `"${font.family}"` : 'inherit' }}
        >
          {preview || 'A sua próxima ideia começa aqui.'}
        </span>
      </button>
      <button
        className={`font-favorite ${favorite ? 'active' : ''}`}
        aria-label={`${favorite ? 'Desfavoritar' : 'Favoritar'} fonte ${font.family}`}
        title={favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
        onClick={onFavorite}
        disabled={busy}
      >
        {choosing ? (
          <LoaderCircle size={17} className="spin" />
        ) : (
          <Star size={17} fill={favorite ? 'currentColor' : 'none'} />
        )}
      </button>
    </div>
  );
}
