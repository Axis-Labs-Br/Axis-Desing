import { useEffect, useMemo, useState } from 'react';
import { Search, Star, ChevronDown, LoaderCircle, Shapes, Palette } from 'lucide-react';
import { element, palettes } from './model';
import type { DesignElement, ElementKind } from './model';
import type { VectorPath } from './vectorTypes';
import { Shape } from './Scene';
import './library.css';

interface CatalogElement {
  id: string;
  name: string;
  category: string;
  tags: string[];
  paths: VectorPath[];
  viewBox?: [number, number];
  style?: 'outline' | 'solid';
  source?: 'icon' | 'graphic';
}
let catalogPromise: Promise<CatalogElement[]> | null = null;
const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
const baseShapes: Array<{ kind: ElementKind; name: string }> = [
  { kind: 'rect', name: 'Retângulo' },
  { kind: 'ellipse', name: 'Círculo' },
  { kind: 'triangle', name: 'Triângulo' },
  { kind: 'star', name: 'Estrela' },
  { kind: 'line', name: 'Linha' },
];
function readFavorites(): string[] {
  try {
    const list = JSON.parse(localStorage.getItem('axis-favorite-elements') ?? '[]');
    return Array.isArray(list) ? list.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}
function loadCatalog() {
  return (catalogPromise ??= Promise.all(
    ['/elements/lucide.json', '/elements/graphics.json'].map((url) =>
      fetch(url).then((r) => {
        if (!r.ok) throw new Error('Catálogo indisponível.');
        return r.json() as Promise<CatalogElement[]>;
      }),
    ),
  )
    .then(([icons, graphics]) => [
      ...graphics.map((e) => ({ ...e, id: `graphic:${e.id}`, source: 'graphic' as const })),
      ...icons.map((e) => ({ ...e, id: `icon:${e.id}`, source: 'icon' as const })),
    ])
    .catch((error) => {
      catalogPromise = null;
      throw error;
    }));
}
export function ElementsLibrary({
  width,
  height,
  onAdd,
  onBackground,
  background,
  toast,
}: {
  width: number;
  height: number;
  onAdd: (e: DesignElement) => void;
  onBackground: (color: string) => void;
  background: string;
  toast: (s: string) => void;
}) {
  const [catalog, setCatalog] = useState<CatalogElement[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  const [query, setQuery] = useState(''),
    [tab, setTab] = useState('Todos'),
    [category, setCategory] = useState('Todas as categorias'),
    [limit, setLimit] = useState(48),
    [favorites, setFavorites] = useState(readFavorites);
  useEffect(() => {
    let active = true;
    loadCatalog()
      .then((list) => {
        if (active) setCatalog(list);
      })
      .catch(() => {
        if (active)
          setError(
            'Não foi possível carregar os elementos. Reabra o painel para tentar novamente.',
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => setLimit(48), [tab, category, query]);
  const items = useMemo(
    () =>
      catalog.filter(
        (e) =>
          (tab === 'Todos' ||
            (tab === 'Ícones' && e.source === 'icon') ||
            (tab === 'Favoritos' && favorites.includes(e.id)) ||
            e.category === tab) &&
          (category === 'Todas as categorias' || e.category === category) &&
          normalize(`${e.name} ${e.id} ${e.tags.join(' ')} ${e.category}`).includes(
            normalize(query),
          ),
      ),
    [catalog, tab, category, query, favorites],
  );
  const categories = [
    ...new Set(
      catalog.filter((e) => tab !== 'Ícones' || e.source === 'icon').map((e) => e.category),
    ),
  ].sort();
  const addShape = (kind: ElementKind) => {
    const size = Math.min(width, height) * 0.28,
      w = kind === 'line' ? width * 0.45 : size,
      h = kind === 'line' ? 8 : size;
    onAdd(
      element(kind, {
        x: (width - w) / 2,
        y: (height - h) / 2,
        width: w,
        height: h,
        fill: '#5965df',
        ...(kind === 'line' ? { strokeWidth: 6 } : {}),
      }),
    );
  };
  const addVector = (asset: CatalogElement) => {
    const size = Math.min(width, height) * 0.22,
      [vw, vh] = asset.viewBox ?? [24, 24],
      w = size,
      h = (size * vh) / vw;
    onAdd(
      element('vector', {
        name: asset.name,
        x: (width - w) / 2,
        y: (height - h) / 2,
        width: w,
        height: h,
        fill: asset.source === 'icon' ? '#4b57db' : '#a7b979',
        vectorPaths: structuredClone(asset.paths),
        vectorViewBox: [vw, vh],
        vectorStyle: asset.style ?? 'outline',
        strokeWidth: w / 12,
      }),
    );
  };
  const toggleFavorite = (id: string) => {
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try {
        localStorage.setItem('axis-favorite-elements', JSON.stringify(next));
      } catch {
        toast('Favorito guardado nesta sessão.');
      }
      return next;
    });
  };
  return (
    <div className="elements-library">
      <label className="panel-search">
        <Search size={17} />
        <input
          aria-label="Buscar elementos"
          placeholder="Coração, folha, seta..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <button aria-label="Limpar busca de elementos" onClick={() => setQuery('')}>
            ×
          </button>
        )}
      </label>
      <div className="element-catalog-intro">
        <span>
          <Shapes size={15} />
          {catalog.length.toLocaleString('pt-BR')} elementos vetoriais
        </span>
        <small>Todos editáveis. Todos do seu jeito.</small>
      </div>
      <div className="library-chips element-tabs" aria-label="Tipos de elementos">
        {['Todos', 'Formas', 'Ícones', 'Adesivos', 'Abstratos', 'Molduras', 'Favoritos'].map(
          (t) => (
            <button
              key={t}
              className={tab === t ? 'active' : ''}
              aria-pressed={tab === t}
              onClick={() => {
                setTab(t);
                setCategory('Todas as categorias');
              }}
            >
              {t === 'Favoritos' && <Star size={11} />} {t}
            </button>
          ),
        )}
      </div>
      {(tab === 'Todos' || tab === 'Ícones') && (
        <label className="element-category-select">
          <select
            aria-label="Categoria de elementos"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option>Todas as categorias</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      )}
      {(tab === 'Todos' || tab === 'Formas') && category === 'Todas as categorias' && (
        <>
          <h3 className="panel-section-label">Formas essenciais</h3>
          <div className="panel-shape-grid">
            {baseShapes
              .filter((s) => normalize(s.name).includes(normalize(query)))
              .map((s) => (
                <button
                  key={s.kind}
                  title={`Adicionar ${s.name.toLowerCase()}`}
                  onClick={() => addShape(s.kind)}
                >
                  <svg viewBox="-4 -4 88 72" aria-hidden="true">
                    <Shape
                      e={element(s.kind, {
                        width: 80,
                        height: s.kind === 'line' ? 6 : 64,
                        fill: '#5965df',
                        strokeWidth: 4,
                      })}
                    />
                  </svg>
                  <span>{s.name}</span>
                </button>
              ))}
          </div>
        </>
      )}
      <div className="element-results-heading">
        <h3>
          {tab === 'Favoritos'
            ? 'Seus favoritos'
            : tab === 'Ícones'
              ? 'Um ícone para cada ideia'
              : 'Explore a biblioteca'}
        </h3>
        <span>{items.length.toLocaleString('pt-BR')}</span>
      </div>
      {loading ? (
        <div className="library-loading">
          <LoaderCircle className="spin" size={20} />
          Abrindo sua biblioteca...
        </div>
      ) : (
        <div className="element-catalog-grid">
          {items.slice(0, limit).map((asset) => (
            <div key={asset.id} className="element-asset">
              <button
                className="element-asset-add"
                data-testid={`asset-${asset.id}`}
                aria-label={`Adicionar elemento ${asset.name}`}
                title={asset.name}
                onClick={() => addVector(asset)}
              >
                <svg viewBox={`0 0 ${(asset.viewBox ?? [24, 24]).join(' ')}`} aria-hidden="true">
                  <Shape
                    e={element('vector', {
                      width: (asset.viewBox ?? [24, 24])[0],
                      height: (asset.viewBox ?? [24, 24])[1],
                      vectorViewBox: asset.viewBox ?? [24, 24],
                      vectorPaths: asset.paths,
                      vectorStyle: asset.style ?? 'outline',
                      fill: asset.source === 'icon' ? '#676d8d' : '#a1b47d',
                      strokeWidth: 2,
                    })}
                  />
                </svg>
                <span>{asset.name}</span>
              </button>
              <button
                className={`element-favorite ${favorites.includes(asset.id) ? 'active' : ''}`}
                aria-label={`${favorites.includes(asset.id) ? 'Desfavoritar' : 'Favoritar'} elemento ${asset.name}`}
                onClick={() => toggleFavorite(asset.id)}
              >
                <Star size={12} fill={favorites.includes(asset.id) ? 'currentColor' : 'none'} />
              </button>
            </div>
          ))}
        </div>
      )}
      {!loading && !items.length && (
        <div className="library-empty">
          <Search size={24} />
          <strong>
            {tab === 'Favoritos' ? 'Guarde suas próximas ideias' : 'Nenhum elemento encontrado'}
          </strong>
          <p>
            {tab === 'Favoritos'
              ? 'Toque na estrela de um elemento para guardá-lo aqui.'
              : 'Busque em português ou inglês e experimente outra categoria.'}
          </p>
        </div>
      )}
      {items.length > limit && (
        <button className="library-load-more" onClick={() => setLimit((n) => n + 48)}>
          Mostrar mais elementos <ChevronDown size={16} />
        </button>
      )}
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      <section className="element-background">
        <h3>
          <Palette size={14} />
          Cor da página
        </h3>
        <div className="panel-swatches">
          {palettes.map((c) => (
            <button
              key={c}
              className={`panel-swatch ${background === c ? 'active' : ''}`}
              style={{ background: c }}
              aria-label={`Usar cor ${c}`}
              onClick={() => onBackground(c)}
            />
          ))}
          <label className="panel-custom-color" title="Outra cor">
            +
            <input
              type="color"
              aria-label="Cor personalizada de fundo"
              value={background}
              onChange={(e) => onBackground(e.target.value)}
            />
          </label>
        </div>
      </section>
      <p className="panel-footnote">
        Biblioteca Lucide + gráficos originais. Os elementos usados acompanham seu arquivo .axis.
      </p>
    </div>
  );
}
