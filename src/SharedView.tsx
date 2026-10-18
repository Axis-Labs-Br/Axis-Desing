import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CopyPlus,
  ExternalLink,
  Globe2,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
  X,
} from 'lucide-react';
import { getPublicDesign, getSession, getSharedDesign, saveDesign } from './accountApi';
import type { AxisUser } from './accountApi';
import { duplicateDocument, parseDocument } from './model';
import type { DesignDocument } from './model';
import { Scene } from './Scene';
import { LoadingScreen, Logo } from './ui';

export function SharedView({ pathname = location.pathname }: { pathname?: string }) {
  const isPublic = pathname.startsWith('/public/');
  const key = decodeURIComponent(pathname.split('/').filter(Boolean).at(-1) ?? '');
  const [doc, setDoc] = useState<DesignDocument | null>(null);
  const [page, setPage] = useState(0);
  const [error, setError] = useState('');
  const [importError, setImportError] = useState('');
  const [importing, setImporting] = useState(false);
  const [user, setUser] = useState<AxisUser | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const canvasAreaRef = useRef<HTMLDivElement>(null);
  const [canvasArea, setCanvasArea] = useState(() => ({
    width: Math.max(1, window.innerWidth - 80),
    height: Math.max(1, window.innerHeight - 220),
  }));

  useEffect(() => {
    let canceled = false;
    (isPublic ? getPublicDesign(key) : getSharedDesign(key))
      .then(({ document }) => {
        const safe = parseDocument(document);
        if (!canceled) setDoc(safe);
      })
      .catch((reason: unknown) => {
        if (!canceled)
          setError(reason instanceof Error ? reason.message : 'Este design não está disponível.');
      });
    return () => {
      canceled = true;
    };
  }, [isPublic, key]);

  useEffect(() => {
    let canceled = false;
    getSession()
      .then(({ user: current }) => {
        if (!canceled) setUser(current);
      })
      .catch(() => {
        if (!canceled) setUser(null);
      })
      .finally(() => {
        if (!canceled) setSessionReady(true);
      });
    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    const element = canvasAreaRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setCanvasArea({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [doc]);

  const importCopy = async () => {
    if (!doc || !isPublic || !sessionReady || importing) return;
    setImportError('');
    setImporting(true);
    if (!user) {
      try {
        sessionStorage.setItem('axis-pending-public-copy', key);
        location.assign('/?importPublic=1');
      } catch {
        setImportError('Não foi possível iniciar o login neste navegador.');
        setImporting(false);
      }
      return;
    }

    try {
      const copy = duplicateDocument(doc);
      copy.title = `${doc.title} (cópia)`;
      delete copy.ownerId;
      delete copy.visibility;
      delete copy.shareId;
      const { document: saved } = await saveDesign(copy);
      location.assign(`/?open=${encodeURIComponent(saved.id)}`);
    } catch (reason) {
      setImportError(reason instanceof Error ? reason.message : 'Não foi possível criar sua cópia.');
      setImporting(false);
    }
  };

  if (error)
    return (
      <main className="share-missing">
        <Logo />
        <div>
          <LockKeyhole size={24} />
          <h1>Este link não está disponível</h1>
          <p>{error} O acesso pode ter sido revogado pelo proprietário.</p>
          <a href="/">Ir para AxisDesign <ArrowRight size={15} /></a>
        </div>
      </main>
    );

  if (!doc || !sessionReady)
    return <LoadingScreen label="Abrindo visualização segura" />;

  const current = doc.pages[page];
  const scale = Math.min(canvasArea.width / doc.width, canvasArea.height / doc.height);
  const artboardWidth = Math.max(1, Math.floor(doc.width * scale));
  const artboardHeight = Math.max(1, Math.floor(doc.height * scale));
  return (
    <main className="shared-page">
      <header className="shared-header">
        <a className="shared-brand" href="/" aria-label="AxisDesign início">
          <Logo />
        </a>
        <div className="shared-title">
          <span className="shared-eyebrow">{isPublic ? 'DESIGN PÚBLICO' : 'LINK COMPARTILHADO'}</span>
          <strong title={doc.title}>{doc.title}</strong>
          <span className="shared-readonly"><LockKeyhole size={12} /> Visualização somente leitura</span>
        </div>
        <div className="shared-header-actions">
          {isPublic && (
            <div className="shared-import-wrap">
              <a
                className="shared-import-link"
                href={user ? '#import-copy' : '/?importPublic=1'}
                onClick={(event) => {
                  event.preventDefault();
                  void importCopy();
                }}
                aria-disabled={!sessionReady || importing}
                aria-busy={importing}
                title="Cria uma cópia privada que você pode editar"
              >
                {importing ? <LoaderCircle className="spin" size={17} /> : <CopyPlus size={17} />}
                {importing ? 'Preparando cópia…' : 'Editar uma cópia'}
              </a>
              {importError && <span className="shared-import-error" role="alert">{importError}</span>}
            </div>
          )}
          <a className="shared-home-link" href="/" aria-label="Voltar ao AxisDesign">
            <ExternalLink size={16} />
            <span>AxisDesign</span>
          </a>
        </div>
      </header>

      <section className="shared-stage" aria-label="Prévia do design">
        <div className="shared-stage-meta">
          <span><Globe2 size={14} /> PRÉVIA DO DESIGN</span>
          <span>{doc.width} × {doc.height} px <i /> {doc.pages.length} {doc.pages.length === 1 ? 'página' : 'páginas'}</span>
        </div>
        <div className="shared-canvas-area">
          <div
            ref={canvasAreaRef}
            className="shared-canvas-fit"
          >
            <div
              className="shared-artboard"
              style={{ width: artboardWidth, height: artboardHeight }}
            >
              <Scene page={current} width={doc.width} height={doc.height} className="shared-scene" />
            </div>
          </div>
        </div>
        <div className="shared-stage-note">
          <ShieldCheck size={15} />
          <span>{isPublic ? 'Este design é público. Use uma cópia para personalizar sem alterar o original.' : 'Esta prévia foi compartilhada em modo somente leitura.'}</span>
        </div>
      </section>

      <footer className={`shared-footer${doc.pages.length > 1 ? ' shared-footer-paged' : ''}`}>
        <span className="shared-footer-note"><LockKeyhole size={14} /> O design original permanece com o criador</span>
        {doc.pages.length > 1 && (
          <nav aria-label="Navegação das páginas">
            <button aria-label="Página anterior" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>
              <ArrowLeft size={17} />
            </button>
            <span>{page + 1} <i>/</i> {doc.pages.length}</span>
            <button aria-label="Próxima página" disabled={page === doc.pages.length - 1} onClick={() => setPage((value) => value + 1)}>
              <ArrowRight size={17} />
            </button>
          </nav>
        )}
        <a href="/" aria-label="Fechar visualização"><X size={16} /> Fechar</a>
      </footer>
    </main>
  );
}
