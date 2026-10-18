import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Plus, ArrowUpRight, X, Upload } from 'lucide-react';
import { Dashboard } from './Dashboard';
import { AuthScreen } from './AuthScreen';
import { LoadingScreen, Modal } from './ui';
import { clonePage, createDocument, duplicateDocument, formats, parseDocument } from './model';
import type { DesignDocument, Template } from './model';
import { allProjects } from './storage';
import { deleteDesign, getPublicDesign, getSession, listDesigns, loginAccount, logoutAccount, registerAccount, saveDesign } from './accountApi';
import type { AxisUser } from './accountApi';
import { ShareDialog } from './ShareDialog';
import { SharedView } from './SharedView';
import { DocumentImportDialog } from './DocumentImportDialog';
import type { ImportResult } from './import/documents';
const Editor = lazy(() => import('./Editor').then((module) => ({ default: module.Editor })));

function WorkspaceApp() {
  const [projects, setProjects] = useState<DesignDocument[]>([]);
  const [active, setActive] = useState<DesignDocument | null>(null);
  const [user, setUser] = useState<AxisUser | null>(null);
  const userIdRef = useRef<string | null>(null);
  userIdRef.current = user?.id ?? null;
  const [sessionReady, setSessionReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pendingPublicCopy, setPendingPublicCopy] = useState(() => {
    try {
      return sessionStorage.getItem('axis-pending-public-copy') ?? '';
    } catch {
      return '';
    }
  });
  const pendingCopyInProgress = useRef(false);
  const requestedOpenId = useRef(new URLSearchParams(location.search).get('open'));
  const [fatal, setFatal] = useState('');
  const [shareTarget, setShareTarget] = useState<DesignDocument | null>(null);
  const [create, setCreate] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [message, setMessage] = useState('');
  const [custom, setCustom] = useState(false);
  const [width, setWidth] = useState('1080');
  const [height, setHeight] = useState('1080');
  const [title, setTitle] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toast = useCallback((text: string) => {
    setMessage(text);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(''), 4500);
  }, []);
  useEffect(() => {
    let canceled = false;
    getSession()
      .then(({ user: current }) => {
        if (!canceled) {
          setUser(current);
          setSessionReady(true);
          if (!current) setLoading(false);
        }
      })
      .catch(() => {
        if (!canceled) {
          setFatal('Não foi possível conectar ao serviço de contas. Verifique se o AxisDesign está iniciado e tente novamente.');
          setSessionReady(true);
          setLoading(false);
        }
      });
    return () => {
      canceled = true;
    };
  }, []);
  useEffect(() => {
    if (!user) return;
    let canceled = false;
    setLoading(true);
    setProjects([]);
    setFatal('');
    (async () => {
      const { designs } = await listDesigns();
      let items = designs.filter((doc) => doc.ownerId === user.id);
      if (!localStorage.getItem('axis-legacy-projects-owner')) {
        if (items.length === 0) {
          const legacy = await allProjects().catch(() => []);
          for (const doc of legacy) {
            const { document } = await saveDesign({ ...doc, visibility: 'private' });
            items = [...items.filter((entry) => entry.id !== document.id), document];
          }
        }
        localStorage.setItem('axis-legacy-projects-owner', user.id);
      }
      if (!canceled) {
        setProjects(items);
        setLoading(false);
      }
    })().catch(() => {
      if (!canceled) {
        setFatal('Não foi possível carregar seus projetos. Verifique a conexão com o AxisDesign.');
        setLoading(false);
      }
    });
    return () => { canceled = true; };
  }, [user]);
  useEffect(() => {
    if (!user || loading || !pendingPublicCopy || pendingCopyInProgress.current) return;
    let canceled = false;
    const ownerId = user.id;
    pendingCopyInProgress.current = true;
    void (async () => {
      try {
        const { document: source } = await getPublicDesign(pendingPublicCopy);
        const copy = duplicateDocument(source);
        copy.title = `${source.title} (cópia)`;
        delete copy.ownerId;
        delete copy.visibility;
        delete copy.shareId;
        const { document: saved } = await saveDesign(copy);
        if (canceled || userIdRef.current !== ownerId) return;
        setProjects((previous) => [...previous.filter((entry) => entry.id !== saved.id), saved]);
        setActive(saved);
        toast('Cópia criada na sua conta. Você já pode editar.');
        sessionStorage.removeItem('axis-pending-public-copy');
        setPendingPublicCopy('');
        const url = new URL(location.href);
        url.searchParams.delete('importPublic');
        history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
      } catch (reason) {
        if (canceled) return;
        toast(reason instanceof Error ? reason.message : 'Não foi possível importar este design público.');
        sessionStorage.removeItem('axis-pending-public-copy');
        setPendingPublicCopy('');
      } finally {
        pendingCopyInProgress.current = false;
      }
    })();
    return () => {
      canceled = true;
    };
  }, [loading, pendingPublicCopy, toast, user]);
  useEffect(() => {
    if (!user || loading || !requestedOpenId.current) return;
    const design = projects.find((entry) => entry.id === requestedOpenId.current);
    if (!design) return;
    setActive(design);
    requestedOpenId.current = null;
    const url = new URL(location.href);
    url.searchParams.delete('open');
    history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  }, [loading, projects, user]);
  const persist = useCallback(async (doc: DesignDocument) => {
    const ownerId = user?.id;
    if (!ownerId) throw new Error('Entre na sua conta para salvar este projeto.');
    const { document } = await saveDesign(doc);
    if (userIdRef.current === ownerId && document.ownerId === ownerId)
      setProjects((prev) => [...prev.filter((p) => p.id !== document.id), document]);
  }, [user?.id]);
  const login = async (email: string, password: string) => {
    const { user: current } = await loginAccount({ email, password });
    userIdRef.current = current.id;
    setProjects([]);
    setActive(null);
    setUser(current);
    setLoading(true);
  };
  const register = async (username: string, email: string, password: string) => {
    const { user: current } = await registerAccount({ username, email, password });
    userIdRef.current = current.id;
    setProjects([]);
    setActive(null);
    setUser(current);
    setLoading(true);
  };
  const logout = async () => {
    try {
      await logoutAccount();
      userIdRef.current = null;
      setUser(null);
      setProjects([]);
      setActive(null);
      setShareTarget(null);
      setLoading(false);
    } catch {
      toast('Não foi possível sair agora. Tente novamente.');
    }
  };
  const openNew = async (doc: DesignDocument) => {
    try {
      await persist(doc);
      setActive(doc);
      setCreate(false);
    } catch {
      toast('Não foi possível salvar o projeto. Verifique o espaço do navegador.');
    }
  };
  const fromTemplate = (t: Template) => {
    const doc = createDocument(t.title, t.width, t.height, t.page);
    if (t.pages?.length) doc.pages = t.pages.map(clonePage);
    void openNew(doc);
  };
  const importProject = async (file: File) => {
    try {
      if (file.size > 50 * 1024 * 1024) throw new Error('O arquivo deve ter até 50 MB.');
      const doc = parseDocument(JSON.parse(await file.text()));
      const { prepareDocumentFonts } = await import('./fontLibrary');
      await prepareDocumentFonts(doc);
      await openNew(doc);
      toast('Projeto importado. Tudo pronto para continuar!');
    } catch (error) {
      toast(
        error instanceof Error ? error.message : 'Arquivo inválido. Selecione um projeto .axis.',
      );
    }
  };
  const openImport = () => {
    setImportFile(null);
    setImportOpen(true);
  };
  const openImportFile = (file: File) => {
    setImportFile(file);
    setImportOpen(true);
  };
  const finishImport = async (result: ImportResult) => {
    try {
      const { prepareDocumentFonts } = await import('./fontLibrary');
      await prepareDocumentFonts(result.document);
      await persist(result.document);
      setActive(result.document);
      setCreate(false);
      setImportOpen(false);
      setImportFile(null);
      const count = result.warnings.length;
      toast(
        count
          ? `Documento aberto. ${count} observação${count === 1 ? '' : 'ões'} sobre a importação.`
          : 'Documento aberto no editor.',
      );
    } catch {
      toast(
        'Não foi possível salvar o documento importado. Libere espaço no navegador e tente novamente.',
      );
    }
  };
  const validDimensions =
    Number(width) >= 100 &&
    Number(width) <= 8000 &&
    Number(height) >= 100 &&
    Number(height) <= 8000 &&
    Number.isInteger(Number(width)) &&
    Number.isInteger(Number(height));
  if (!sessionReady || loading)
    return <LoadingScreen label="Preparando seu espaço criativo" />;
  if (fatal)
    return (
      <div className="app-loading">
        <h1>Não foi possível abrir seu espaço</h1>
        <p>{fatal}</p>
        <button className="primary" onClick={() => location.reload()}>
          Tentar novamente
        </button>
      </div>
    );
  return (
    <>
      {!user ? (
        <AuthScreen
          onLogin={login}
          onRegister={register}
          pendingPublicImport={new URLSearchParams(location.search).get('importPublic') === '1'}
        />
      ) : active ? (
        <Suspense
          fallback={<LoadingScreen label="Abrindo seu design" />}
        >
          <Editor
            key={active.id}
            initial={active}
            onSave={persist}
            onExit={() => setActive(null)}
            onNew={() => setCreate(true)}
            onImport={openImport}
            onShare={setShareTarget}
            accountName={user.username}
            toast={toast}
          />
        </Suspense>
      ) : (
        <Dashboard
          projects={projects}
          user={user}
          onOpen={setActive}
          onCreate={() => setCreate(true)}
          onFormat={(w, h, t) => void openNew(createDocument(t, w, h))}
          onTemplate={fromTemplate}
          onImport={(file) => void importProject(file)}
          onImportDocument={openImport}
          onUpdate={(doc) =>
            void persist(doc).catch(() => toast('Não foi possível salvar a alteração.'))
          }
          onDuplicate={(doc) =>
            void persist(duplicateDocument(doc))
              .then(() => toast('Cópia criada.'))
              .catch(() => toast('Não foi possível duplicar.'))
          }
          onDelete={(doc) =>
            void deleteDesign(doc.id)
              .then(() => {
                setProjects((prev) => prev.filter((p) => p.id !== doc.id));
                toast('Projeto excluído.');
              })
              .catch(() => toast('Não foi possível excluir.'))
          }
          onShare={setShareTarget}
          onLogout={() => void logout()}
          toast={toast}
        />
      )}
      {shareTarget && (
        <ShareDialog
          document={shareTarget}
          onClose={() => setShareTarget(null)}
          onUpdated={(doc) => {
            if (doc.ownerId !== userIdRef.current) return;
            setShareTarget(doc);
            setProjects((prev) => [...prev.filter((entry) => entry.id !== doc.id), doc]);
            if (active?.id === doc.id) setActive(doc);
          }}
          toast={toast}
        />
      )}
      {create && (
        <Modal
          wide
          title="Vamos dar forma à sua ideia?"
          subtitle="Escolha um formato. A tela em branco é só o começo."
          onClose={() => {
            setCreate(false);
            setCustom(false);
          }}
        >
          <div className="create-formats">
            {formats.map((f) => (
              <button
                key={f.name}
                onClick={() => void openNew(createDocument(f.name, f.width, f.height))}
              >
                <span className="create-format-symbol" style={{ background: f.color }}>
                  <span style={{ aspectRatio: `${f.width}/${f.height}` }} />
                </span>
                <strong>{f.name}</strong>
                <small>
                  {f.width} × {f.height} px
                </small>
                <ArrowUpRight size={17} />
              </button>
            ))}
          </div>
          <button
            className={`custom-size-toggle ${custom ? 'active' : ''}`}
            onClick={() => setCustom(!custom)}
          >
            <Plus size={17} />
            Usar tamanho personalizado<span>px</span>
          </button>
          {custom && (
            <form
              className="custom-size-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (validDimensions)
                  void openNew(
                    createDocument(
                      title.trim() || 'Design sem título',
                      Number(width),
                      Number(height),
                    ),
                  );
              }}
            >
              <label className="field-label">
                Nome do design
                <input
                  className="text-input"
                  placeholder="Minha próxima ideia"
                  maxLength={200}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
              <div className="dimension-fields">
                <label className="field-label">
                  Largura
                  <input
                    aria-label="Largura do design"
                    className="text-input"
                    type="number"
                    min="100"
                    max="8000"
                    value={width}
                    onChange={(e) => setWidth(e.target.value)}
                  />
                </label>
                <X size={17} />
                <label className="field-label">
                  Altura
                  <input
                    aria-label="Altura do design"
                    className="text-input"
                    type="number"
                    min="100"
                    max="8000"
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                  />
                </label>
                <button className="primary" disabled={!validDimensions}>
                  Criar design <ArrowUpRight size={16} />
                </button>
              </div>
              <small className="field-hint">Entre 100 e 8.000 px em cada dimensão.</small>
            </form>
          )}
          <div className="create-import">
            <Upload size={16} />
            <span>Já tem um projeto Axis?</span>
            <label>
              Importar arquivo
              <input
                type="file"
                accept=".axis,.json"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void importProject(f);
                }}
              />
            </label>
          </div>
          <div className="create-import">
            <Upload size={16} />
            <span>Trazer um PDF ou outro documento para editar</span>
            <label>
              Escolher arquivo
              <input
                type="file"
                accept=".pdf,.docx,.pptx,.odt,.txt,.md,.markdown,.html,.htm,.svg,.png,.jpg,.jpeg,.webp,.gif"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) openImportFile(f);
                  e.target.value = '';
                }}
              />
            </label>
          </div>
        </Modal>
      )}
      {importOpen && (
        <DocumentImportDialog
          file={importFile}
          onClose={() => {
            setImportOpen(false);
            setImportFile(null);
          }}
          onOpen={(result) => void finishImport(result)}
        />
      )}
      {message && (
        <div role="status" className="toast">
          <CheckCircle2 size={19} />
          <span>{message}</span>
          <button onClick={() => setMessage('')} aria-label="Fechar notificação">
            <X size={16} />
          </button>
        </div>
      )}
    </>
  );
}

export default function App() {
  if (location.pathname.startsWith('/share/') || location.pathname.startsWith('/public/'))
    return <SharedView />;
  return <WorkspaceApp />;
}
