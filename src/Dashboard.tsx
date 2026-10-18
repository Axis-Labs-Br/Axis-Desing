import { useEffect, useRef, useState } from 'react';
import {
  Search,
  Plus,
  Home,
  FolderOpen,
  LayoutTemplate,
  Star,
  Trash2,
  ChevronDown,
  ArrowUpRight,
  SlidersHorizontal,
  MoreHorizontal,
  Copy,
  Pencil,
  RotateCcw,
  Image,
  Presentation,
  Smartphone,
  RectangleVertical,
  Youtube,
  CreditCard,
  Upload,
  Sparkles,
  ArrowRight,
  Check,
  Grid2X2,
  CircleHelp,
  HardDrive,
  X,
  Share2,
  LogOut,
  LockKeyhole,
} from 'lucide-react';
import type { DesignDocument, Template } from './model';
import type { AxisUser } from './accountApi';
import { formats } from './model';
import { templates } from './templates';
import { presentationTemplates } from './presentationTemplates';
import { Scene } from './Scene';
import { pageFontFaces } from './fontLibrary';
import { EmptyState, IconButton, Logo, Modal } from './ui';

type Section = 'home' | 'projects' | 'templates' | 'favorites' | 'trash';
interface Props {
  projects: DesignDocument[];
  user: AxisUser;
  onOpen: (doc: DesignDocument) => void;
  onCreate: () => void;
  onFormat: (width: number, height: number, title: string) => void;
  onTemplate: (t: Template) => void;
  onImport: (file: File) => void;
  onImportDocument: () => void;
  onUpdate: (doc: DesignDocument) => void;
  onDuplicate: (doc: DesignDocument) => void;
  onDelete: (doc: DesignDocument) => void;
  onShare: (doc: DesignDocument) => void;
  onLogout: () => void;
  toast: (message: string) => void;
}
const formatIcons = [Image, Presentation, Smartphone, RectangleVertical, Youtube, CreditCard];
const normalizeSearch = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim();
export function Dashboard({
  projects,
  user,
  onOpen,
  onCreate,
  onFormat,
  onTemplate,
  onImport,
  onImportDocument,
  onUpdate,
  onDuplicate,
  onDelete,
  onShare,
  onLogout,
  toast,
}: Props) {
  const [section, setSection] = useState<Section>('home');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Todos');
  const [sort, setSort] = useState('recent');
  const [menu, setMenu] = useState<string | null>(null);
  const [rename, setRename] = useState<DesignDocument | null>(null);
  const [newName, setNewName] = useState('');
  const [help, setHelp] = useState(false);
  const [accountMenu, setAccountMenu] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DesignDocument | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [, refreshTemplateFonts] = useState(0);
  useEffect(() => {
    let active = true;
    void pageFontFaces([...templates, ...presentationTemplates].map((template) => template.page))
      .catch(() => [])
      .then(() => { if (active) refreshTemplateFonts((revision) => revision + 1); });
    return () => { active = false; };
  }, []);
  const visible = projects
    .filter(
      (d) =>
        (section === 'trash' ? !!d.deletedAt : !d.deletedAt) &&
        (section !== 'favorites' || d.favorite) &&
        normalizeSearch(d.title).includes(normalizeSearch(search)),
    )
    .sort((a, b) =>
      sort === 'name'
        ? a.title.localeCompare(b.title)
        : sort === 'old'
          ? a.updatedAt - b.updatedAt
          : b.updatedAt - a.updatedAt,
    );
  const templateList = [...templates, ...presentationTemplates].filter(
    (t) =>
      (category === 'Todos' || category === 'Modelos' || t.category === category) &&
      normalizeSearch(`${t.title} ${t.category}`).includes(normalizeSearch(search)),
  );
  const nav = [
    { id: 'home', label: 'Início', icon: Home },
    { id: 'projects', label: 'Meus projetos', icon: FolderOpen },
    { id: 'templates', label: 'Modelos', icon: LayoutTemplate },
    { id: 'favorites', label: 'Favoritos', icon: Star },
    { id: 'trash', label: 'Lixeira', icon: Trash2 },
  ] as const;
  const sectionName = {
    home: 'Seu espaço criativo',
    projects: 'Meus projetos',
    templates: 'Encontre seu próximo começo',
    favorites: 'Seus favoritos',
    trash: 'Lixeira',
  }[section];
  const navigate = (s: Section) => {
    setSection(s);
    setSearch('');
    setCategory('Todos');
    setMenu(null);
  };
  return (
    <div
      className="dashboard"
      onClick={() => {
        if (menu) setMenu(null);
      }}
    >
      <aside className="sidebar">
        <button
          className="logo-button"
          onClick={() => navigate('home')}
          aria-label="Axis Design início"
        >
          <Logo />
        </button>
        <div className="workspace-card">
          <div className="workspace-avatar">{user.username.slice(0, 1).toUpperCase()}</div>
          <div>
            <strong>{user.username}</strong>
            <small>Espaço pessoal</small>
          </div>
          <ChevronDown size={14} />
        </div>
        <button className="primary create-sidebar" onClick={onCreate}>
          <Plus size={19} /> Criar um design
        </button>
        <nav aria-label="Navegação principal">
          {nav.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              aria-label={label}
              className={`nav-item ${section === id ? 'active' : ''}`}
              onClick={() => navigate(id)}
            >
              <Icon size={19} />
              <span>{label}</span>
              {id === 'favorites' &&
                projects.filter((p) => p.favorite && !p.deletedAt).length > 0 && (
                  <small className="nav-count">
                    {projects.filter((p) => p.favorite && !p.deletedAt).length}
                  </small>
                )}
            </button>
          ))}
        </nav>
        <div className="sidebar-divider" />
        <div className="sidebar-bottom">
          <div className="local-note">
            <span className="local-note-icon">
              <LockKeyhole size={19} />
            </span>
            <strong>Seu trabalho, sua conta.</strong>
            <p>Seus projetos ficam privados e separados por usuário.</p>
            <button onClick={() => setHelp(true)}>
              Como funciona <ArrowUpRight size={14} />
            </button>
          </div>
          <button className="nav-item help-link" onClick={() => setHelp(true)}>
            <CircleHelp size={18} /> Ajuda e atalhos
          </button>
          <div className="profile">
            <span className="avatar" aria-hidden="true">
              {user.username.slice(0, 2).toUpperCase()}
            </span>
            <div className="profile-identity">
              <strong title={`@${user.username}`}>@{user.username}</strong>
              <small title={user.email}>{user.email}</small>
            </div>
            <button
              className="account-logout"
              aria-label="Sair da conta"
              title="Sair da conta"
              onClick={onLogout}
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>
      <main className="dashboard-main">
        <header className="dashboard-header">
          <button
            className="dashboard-mobile-brand"
            aria-label="Axis Design início"
            onClick={() => navigate('home')}
          >
            <Logo />
          </button>
          <div className="breadcrumb">
            Meu espaço <span>/</span>{' '}
            <strong>
              {section === 'home' ? 'Início' : section === 'templates' ? 'Modelos' : sectionName}
            </strong>
          </div>
          <label className="workspace-search">
            <Search size={18} />
            <input
              aria-label="Buscar no meu espaço"
              placeholder={
                section === 'templates'
                  ? 'Encontre o modelo da sua próxima ideia...'
                  : 'Busque seus designs e suas ideias...'
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search ? (
              <button aria-label="Limpar pesquisa do espaço" onClick={() => setSearch('')}>
                <X size={15} />
              </button>
            ) : (
              <kbd>⌕</kbd>
            )}
          </label>
          <div className="header-actions">
            <button
              className="primary mobile-create-button"
              onClick={onCreate}
              aria-label="Criar um design"
            >
              <Plus size={18} />
              <span>Criar</span>
            </button>
            <button
              aria-label="Importar projeto"
              className="text-button import-button"
              onClick={() => inputRef.current?.click()}
            >
              <Upload size={16} />
              <span>Importar projeto</span>
            </button>
            <button
              aria-label="Importar documento"
              className="text-button import-button document-import-button"
              onClick={onImportDocument}
            >
              <Upload size={16} />
              <span>Importar documento</span>
            </button>
            <span className="header-divider" />
            <div className="account-menu-wrap">
              <button
                className="avatar avatar-button"
                aria-label={`Conta @${user.username}`}
                aria-expanded={accountMenu}
                onClick={() => setAccountMenu((open) => !open)}
              >
                {user.username.slice(0, 2).toUpperCase()}
              </button>
              {accountMenu && (
                <div className="dropdown account-menu">
                  <strong>@{user.username}</strong>
                  <small>{user.email}</small>
                  <div className="dropdown-line" />
                  <button onClick={() => { setAccountMenu(false); onLogout(); }}>
                    <LogOut size={16} /> Sair da conta
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <input
          ref={inputRef}
          type="file"
          accept=".axis,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onImport(f);
            e.target.value = '';
          }}
        />
        <div className="dashboard-content">
          {section === 'home' && !search ? (
            <>
              <div className="greeting">
                <div>
                  <div className="eyebrow">
                    <span /> UM NOVO DIA, NOVAS IDEIAS
                  </div>
                  <h1>
                    O que vamos criar hoje<span>?</span>
                  </h1>
                  <p>Da primeira ideia ao último detalhe. Seu próximo design começa aqui.</p>
                </div>
                <div className="greeting-doodle">
                  <svg viewBox="0 0 100 65" fill="none">
                    <path
                      d="M8 43c17-21 31-27 40-18 13 14-26 29-28 15C16 10 66 10 74 27"
                      stroke="#777d9b"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                    <path
                      d="m65 24 10 5-1-11"
                      stroke="#777d9b"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                  <span>deixe a ideia fluir</span>
                </div>
              </div>
              <section className="hero">
                <div className="hero-copy">
                  <span className="hero-pill">
                    <Sparkles size={13} /> IDEIAS GANHAM FORMA AQUI
                  </span>
                  <h2>
                    Você imagina.
                    <br />O resto é <em>criação.</em>
                  </h2>
                  <p>
                    Comece com um modelo ou uma tela em branco.
                    <br />O espaço é seu. As possibilidades também.
                  </p>
                  <button className="dark-button" onClick={onCreate}>
                    Começar a criar <ArrowUpRight size={17} />
                  </button>
                </div>
                <div className="hero-art" aria-hidden="true">
                  <div className="hero-orbit" />
                  <span className="art-star">✳</span>
                  <div className="hero-design design-back">
                    <Scene page={templates[4].page} width={1080} height={1080} />
                  </div>
                  <div className="hero-design design-front">
                    <Scene page={templates[0].page} width={1080} height={1080} />
                  </div>
                  <span className="hero-sticker">
                    <span /> feito por você
                  </span>
                  <div className="art-small-star">✦</div>
                </div>
              </section>
              <div className="format-list">
                {formats.map((f, i) => {
                  const Icon = formatIcons[i];
                  return (
                    <button
                      key={f.name}
                      className="format-card"
                      onClick={() => onFormat(f.width, f.height, f.name)}
                    >
                      <span className="format-icon" style={{ background: f.color }}>
                        <Icon size={24} strokeWidth={1.6} />
                      </span>
                      <strong>{f.label}</strong>
                      <small>
                        {f.width} × {f.height} px
                      </small>
                    </button>
                  );
                })}
                <button className="format-card custom-format" onClick={onCreate}>
                  <span className="format-icon">
                    <Plus size={25} strokeWidth={1.5} />
                  </span>
                  <strong>Tamanho livre</strong>
                  <small>Do seu jeito</small>
                </button>
              </div>
            </>
          ) : (
            <div className="page-intro">
              <span className="eyebrow">SEU ESPAÇO, SUAS IDEIAS</span>
              <h1>{section === 'home' && search ? 'Encontre a sua próxima ideia' : sectionName}</h1>
              <p>
                {section === 'trash'
                  ? 'Projetos excluídos ficam aqui até você decidir removê-los permanentemente.'
                  : section === 'templates'
                    ? 'Um ponto de partida para cada ideia. Todos os detalhes são editáveis.'
                    : 'Ideias guardadas para continuar de onde você parou.'}
              </p>
            </div>
          )}

          <div className="content-toolbar">
            <div className="content-tabs">
              {section === 'home' ? (
                <>
                  <button
                    className={category === 'Todos' ? 'selected' : ''}
                    onClick={() => setCategory('Todos')}
                  >
                    Designs recentes
                  </button>
                  <button
                    className={category === 'Modelos' ? 'selected' : ''}
                    onClick={() => setCategory('Modelos')}
                  >
                    Modelos para você <span className="tiny-dot" />
                  </button>
                </>
              ) : (
                <h2>
                  {section === 'templates'
                    ? 'Feitos para inspirar'
                    : section === 'trash'
                      ? 'Projetos excluídos'
                      : `${visible.length} ${visible.length === 1 ? 'design' : 'designs'}`}
                </h2>
              )}
            </div>
            <div className="content-tools">
              <label className="search-box">
                <Search size={17} />
                <input
                  aria-label="Buscar designs"
                  placeholder={section === 'templates' ? 'Buscar modelos...' : 'Buscar designs...'}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {search && (
                  <button aria-label="Limpar busca" onClick={() => setSearch('')}>
                    <X size={14} />
                  </button>
                )}
              </label>
              {section !== 'templates' && (
                <label className="sort-control">
                  <SlidersHorizontal size={16} />
                  <select
                    aria-label="Ordenar projetos"
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                  >
                    <option value="recent">Mais recentes</option>
                    <option value="old">Mais antigos</option>
                    <option value="name">Nome A–Z</option>
                  </select>
                </label>
              )}
            </div>
          </div>

          {section === 'templates' || (section === 'home' && category === 'Modelos') ? (
            <>
              {section === 'templates' && (
                <div className="category-chips">
                  {[
                    'Todos',
                    'Redes sociais',
                    'Apresentações',
                    'Stories',
                    'Cartazes',
                    'Cartões',
                    'YouTube',
                  ].map((c) => (
                    <button
                      className={category === c ? 'active' : ''}
                      key={c}
                      onClick={() => setCategory(c)}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
              <div className="project-grid template-grid">
                {templateList.map((t) => (
                  <button className="template-card" key={t.id} onClick={() => onTemplate(t)}>
                    <div className="project-preview" style={{ background: t.color }}>
                      <Scene page={t.page} width={t.width} height={t.height} />
                      <span className="template-use">
                        Usar modelo <ArrowUpRight size={16} />
                      </span>
                    </div>
                    <div className="template-info">
                      <strong>{t.title}</strong>
                      <small>
                        {t.category} · {t.width} × {t.height}
                        {t.pages && t.pages.length > 1 && ` · ${t.pages.length} slides`}
                      </small>
                    </div>
                  </button>
                ))}
              </div>
              {templateList.length === 0 && (
                <EmptyState
                  icon={<Search size={30} />}
                  title="Ainda não encontramos esse modelo"
                  description="Experimente outra palavra ou categoria."
                />
              )}
            </>
          ) : (
            <>
              <div className="project-grid">
                {section === 'home' && !search && (
                  <button className="new-project-card" onClick={onCreate}>
                    <span>
                      <Plus size={28} strokeWidth={1.5} />
                    </span>
                    <strong>Uma nova ideia</strong>
                    <small>Comece com uma tela em branco</small>
                    <span className="new-project-arrow">
                      <ArrowUpRight size={18} />
                    </span>
                  </button>
                )}
                {visible.slice(0, section === 'home' ? 7 : undefined).map((doc) => (
                  <article className="project-card" key={doc.id}>
                    <button
                      className="project-open"
                      onClick={() => {
                        if (!doc.deletedAt) onOpen(doc);
                      }}
                      aria-label={`Abrir ${doc.title}`}
                    >
                      <div className="project-preview">
                        <Scene page={doc.pages[0]} width={doc.width} height={doc.height} />
                        {doc.pages.length > 1 && (
                          <span className="pages-badge">
                            <Copy size={12} />
                            {doc.pages.length} páginas
                          </span>
                        )}
                      </div>
                    </button>
                    <div className="project-info">
                      <div>
                        <button
                          className="project-title"
                          onClick={() => !doc.deletedAt && onOpen(doc)}
                        >
                          {doc.title}
                        </button>
                        <small>
                          {doc.deletedAt
                            ? 'Excluído'
                            : doc.width === doc.height
                              ? 'Post para redes sociais'
                              : doc.width > doc.height
                                ? 'Design horizontal'
                                : 'Design vertical'}
                          <span>·</span>
                          {relativeDate(doc.updatedAt)}
                        </small>
                      </div>
                      <div className="project-actions">
                        {doc.favorite && !doc.deletedAt && (
                          <Star size={14} fill="#d9ac52" color="#d9ac52" />
                        )}
                        <IconButton
                          label={`Opções de ${doc.title}`}
                          className={menu === doc.id ? 'active' : ''}
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenu(menu === doc.id ? null : doc.id);
                          }}
                        >
                          <MoreHorizontal size={19} />
                        </IconButton>
                      </div>
                      {menu === doc.id && (
                        <div className="dropdown project-menu" onClick={(e) => e.stopPropagation()}>
                          {doc.deletedAt ? (
                            <>
                              <button
                                onClick={() => {
                                  onUpdate({ ...doc, deletedAt: undefined });
                                  toast('Projeto restaurado.');
                                  setMenu(null);
                                }}
                              >
                                <RotateCcw size={16} />
                                Restaurar
                              </button>
                              <button
                                className="danger-text"
                                onClick={() => {
                                  setDeleteTarget(doc);
                                  setMenu(null);
                                }}
                              >
                                <Trash2 size={16} />
                                Excluir permanentemente
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => {
                                  onShare(doc);
                                  setMenu(null);
                                }}
                              >
                                <Share2 size={16} />
                                Compartilhar e definir acesso
                              </button>
                              <div className="dropdown-line" />
                              <button
                                onClick={() => {
                                  setRename(doc);
                                  setNewName(doc.title);
                                  setMenu(null);
                                }}
                              >
                                <Pencil size={16} />
                                Renomear
                              </button>
                              <button
                                onClick={() => {
                                  onDuplicate(doc);
                                  setMenu(null);
                                }}
                              >
                                <Copy size={16} />
                                Fazer uma cópia
                              </button>
                              <button
                                onClick={() => {
                                  onUpdate({ ...doc, favorite: !doc.favorite });
                                  setMenu(null);
                                }}
                              >
                                <Star size={16} />
                                {doc.favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                              </button>
                              <div className="dropdown-line" />
                              <button
                                className="danger-text"
                                onClick={() => {
                                  onUpdate({ ...doc, deletedAt: Date.now() });
                                  toast('Projeto movido para a lixeira.');
                                  setMenu(null);
                                }}
                              >
                                <Trash2 size={16} />
                                Mover para a lixeira
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>
              {visible.length === 0 && (section !== 'home' || !!search) && (
                <EmptyState
                  icon={
                    section === 'favorites' ? (
                      <Star size={30} />
                    ) : section === 'trash' ? (
                      <Trash2 size={30} />
                    ) : (
                      <FolderOpen size={30} />
                    )
                  }
                  title={
                    search
                      ? 'Nenhum design encontrado'
                      : section === 'favorites'
                        ? 'Suas ideias favoritas moram aqui'
                        : section === 'trash'
                          ? 'Tudo em seu lugar'
                          : 'Seu próximo projeto começa aqui'
                  }
                  description={
                    search
                      ? 'Tente buscar por outro nome.'
                      : section === 'favorites'
                        ? 'Marque a estrela nas opções de um projeto para encontrá-lo aqui.'
                        : section === 'trash'
                          ? 'Você ainda não tem projetos na lixeira.'
                          : 'Crie um design e transforme sua primeira ideia em realidade.'
                  }
                  action={
                    section === 'projects' ? (
                      <button className="primary" onClick={onCreate}>
                        <Plus size={16} />
                        Criar meu primeiro design
                      </button>
                    ) : undefined
                  }
                />
              )}
            </>
          )}
          {section === 'home' && category === 'Todos' && !search && (
            <div className="inspiration-banner">
              <span className="inspiration-icon">
                <LayoutTemplate size={24} />
              </span>
              <div>
                <h3>Uma ajudinha para sair do branco.</h3>
                <p>Modelos originais, prontos para ganhar a sua personalidade.</p>
              </div>
              <button className="text-button" onClick={() => navigate('templates')}>
                Explorar modelos <ArrowRight size={17} />
              </button>
            </div>
          )}
          <footer className="dashboard-footer">
            <span>
              <span className="tiny-dot" /> Feito para suas ideias ganharem o mundo.
            </span>
            <span>
              Axis Design <span className="footer-star">✳</span> Crie do seu jeito.
            </span>
          </footer>
        </div>
      </main>
      {rename && (
        <Modal title="Um novo nome para sua ideia" onClose={() => setRename(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (newName.trim()) {
                onUpdate({ ...rename, title: newName.trim(), updatedAt: Date.now() });
                setRename(null);
              }
            }}
          >
            <label className="field-label">
              Nome do design
              <input
                autoFocus
                className="text-input"
                value={newName}
                maxLength={200}
                onChange={(e) => setNewName(e.target.value)}
              />
            </label>
            <div className="modal-footer">
              <button type="button" className="secondary" onClick={() => setRename(null)}>
                Cancelar
              </button>
              <button className="primary" disabled={!newName.trim()}>
                <Check size={16} />
                Salvar nome
              </button>
            </div>
          </form>
        </Modal>
      )}
      {deleteTarget && (
        <Modal
          title="Excluir este projeto permanentemente?"
          subtitle={`“${deleteTarget.title}” será removido deste navegador. Essa ação não pode ser desfeita.`}
          onClose={() => setDeleteTarget(null)}
        >
          <div className="modal-footer">
            <button className="secondary" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </button>
            <button
              className="danger-button"
              onClick={() => {
                onDelete(deleteTarget);
                setDeleteTarget(null);
              }}
            >
              Excluir projeto
            </button>
          </div>
        </Modal>
      )}
      {help && (
        <Modal
          title="Um espaço que é seu"
          subtitle="Tudo que você precisa para começar no Axis Design."
          onClose={() => setHelp(false)}
        >
          <div className="help-content">
            <div>
              <HardDrive size={22} />
              <p>
                <strong>Salvamento automático local</strong>Seus projetos ficam no navegador deste
                computador. Limpar os dados do site remove esses arquivos. Exporte um arquivo .axis
                para guardar uma cópia ou continuar em outro navegador.
              </p>
            </div>
            <div>
              <Grid2X2 size={22} />
              <p>
                <strong>Um editor, muitas possibilidades</strong>Adicione textos, fotos e formas.
                Ajuste cada detalhe, organize camadas e crie várias páginas no mesmo projeto.
              </p>
            </div>
            <div>
              <Upload size={22} />
              <p>
                <strong>Leve suas ideias com você</strong>Exporte em PNG, JPG, SVG ou PDF. Importe
                arquivos .axis para continuar editando.
              </p>
            </div>
            <div className="shortcut-grid">
              <span>Desfazer</span>
              <kbd>Ctrl Z</kbd>
              <span>Refazer</span>
              <kbd>Ctrl Shift Z</kbd>
              <span>Duplicar elemento</span>
              <kbd>Ctrl D</kbd>
              <span>Selecionar tudo</span>
              <kbd>Ctrl A</kbd>
              <span>Copiar / colar elementos</span>
              <kbd>Ctrl C / V</kbd>
              <span>Mover com precisão</span>
              <kbd>↑ ↓ ← →</kbd>
              <span>Movimento de 10 px</span>
              <kbd>Shift + seta</kbd>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
function relativeDate(timestamp: number) {
  const days = Math.floor((Date.now() - timestamp) / 86400000);
  if (days < 1) return 'hoje';
  if (days === 1) return 'ontem';
  if (days < 7) return `há ${days} dias`;
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(timestamp);
}
