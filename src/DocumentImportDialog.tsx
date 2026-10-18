import { useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FileUp,
  LoaderCircle,
  LockKeyhole,
  UploadCloud,
  X,
} from 'lucide-react';
import { Modal } from './ui';
import type { ImportOptions, ImportResult } from './import/documents';
import './document-import.css';

const formats =
  '.axis,.json,.pdf,.docx,.pptx,.odt,.txt,.md,.markdown,.html,.htm,.svg,.png,.jpg,.jpeg,.webp,.gif';
const pdf = (file: File | null) => file?.name.toLowerCase().endsWith('.pdf') ?? false;

export function DocumentImportDialog({
  file: initialFile = null,
  onClose,
  onOpen,
}: {
  file?: File | null;
  onClose: () => void;
  onOpen: (result: ImportResult) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(initialFile);
  const [pages, setPages] = useState('');
  const [password, setPassword] = useState('');
  const [appearanceOnly, setAppearanceOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);
  const prepare = async () => {
    if (!file) {
      input.current?.click();
      return;
    }
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const { importDocument } = await import('./import/documents');
      const options: ImportOptions = { pages, password, pdfAppearanceOnly: appearanceOnly };
      setResult(await importDocument(file, options));
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'Não foi possível preparar esse arquivo.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      wide
      title="Importar documento"
      subtitle="Escolha um arquivo e transforme suas páginas em um design do Axis."
      onClose={onClose}
    >
      <div className="document-import">
        <input
          ref={input}
          type="file"
          accept={formats}
          hidden
          onChange={(event) => {
            const chosen = event.target.files?.[0] ?? null;
            setFile(chosen);
            setResult(null);
            setError('');
            event.target.value = '';
          }}
        />
        <button
          className={`document-drop ${file ? 'has-file' : ''}`}
          onClick={() => input.current?.click()}
        >
          <span className="document-drop-icon">
            <UploadCloud size={23} />
          </span>
          <span className="document-drop-copy">
            <strong>{file?.name ?? 'Escolha um arquivo para importar'}</strong>
            <small>
              {file
                ? `${(file.size / 1024 / 1024).toFixed(2)} MB · clique para trocar`
                : 'PDF, Word, PowerPoint, ODT, texto, imagem ou projeto Axis'}
            </small>
          </span>
          {file ? <CheckCircle2 size={20} /> : <FileUp size={20} />}
        </button>
        {file && pdf(file) && !result && (
          <div className="document-import-options">
            <label className="field-label">
              Páginas do PDF
              <input
                className="text-input"
                placeholder="Todas (ou 1-3,5)"
                value={pages}
                onChange={(event) => setPages(event.target.value)}
              />
            </label>
            <label className="field-label">
              Senha do PDF, se houver
              <input
                className="text-input"
                type="password"
                autoComplete="off"
                placeholder="Opcional"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <label className="document-check">
              <input
                type="checkbox"
                checked={appearanceOnly}
                onChange={(event) => setAppearanceOnly(event.target.checked)}
              />
              <span>Importar como imagem, preservando a aparência original da página</span>
            </label>
            <p className="document-import-note">
              <LockKeyhole size={14} />
              {appearanceOnly
                ? 'Preservação visual ativada: cada página mantém exatamente a aparência do PDF. Você ainda pode adicionar elementos por cima, mas o texto original não fica separado para edição.'
                : 'Texto editável ativado: o Axis mantém os trechos separados para edição. PDFs com fontes incorporadas ou efeitos especiais podem precisar de ajustes; marque a opção acima para preservar a página como imagem.'}
            </p>
          </div>
        )}
        {error && (
          <div role="alert" className="document-import-error">
            <AlertCircle size={18} />
            {error}
          </div>
        )}
        {result && (
          <div className="document-import-result">
            <div>
              <CheckCircle2 size={20} />
              <strong>Arquivo preparado para edição</strong>
            </div>
            <p>
              {result.details.pages} {pdf(file) ? 'páginas' : 'páginas'} ·{' '}
              {result.details.editableText} textos editáveis · {result.details.images} imagens ·{' '}
              {result.details.shapes} formas
            </p>
            {result.warnings.map((warning) => (
              <small key={warning}>
                <AlertCircle size={14} />
                {warning}
              </small>
            ))}
          </div>
        )}
        <div className="document-import-footer">
          <button className="secondary" onClick={onClose}>
            Cancelar
          </button>
          {result ? (
            <button className="primary" onClick={() => onOpen(result)}>
              Abrir no editor <FileUp size={16} />
            </button>
          ) : (
            <button className="primary" disabled={busy} onClick={() => void prepare()}>
              {busy ? (
                <>
                  <LoaderCircle className="spin" size={17} /> Preparando…
                </>
              ) : (
                'Preparar importação'
              )}
            </button>
          )}
        </div>
        <p className="document-import-formats">
          <X size={13} /> Até 50 MB e 50 páginas por arquivo. Formatos: PDF, DOCX, PPTX, ODT, TXT,
          Markdown, HTML, SVG, PNG, JPG, WebP, GIF e Axis.
        </p>
      </div>
    </Modal>
  );
}
