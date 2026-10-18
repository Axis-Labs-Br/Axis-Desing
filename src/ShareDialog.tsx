import { useMemo, useState } from 'react';
import { Check, Copy, Globe2, Link2, LockKeyhole, ShieldCheck, UsersRound } from 'lucide-react';
import type { DesignDocument } from './model';
import { setDesignVisibility } from './accountApi';
import { Modal } from './ui';

type Visibility = 'private' | 'link' | 'public';
interface Props {
  document: DesignDocument;
  onClose: () => void;
  onUpdated: (doc: DesignDocument) => void;
  toast: (message: string) => void;
}

export function ShareDialog({ document, onClose, onUpdated, toast }: Props) {
  const [visibility, setVisibility] = useState<Visibility>(document.visibility ?? 'private');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const url = useMemo(() => {
    if (visibility === 'link' && document.shareId) return `${location.origin}/share/${document.shareId}`;
    if (visibility === 'public') return `${location.origin}/public/${document.id}`;
    return '';
  }, [visibility, document.id, document.shareId]);
  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const result = await setDesignVisibility(document.id, visibility);
      onUpdated(result.document);
      toast(visibility === 'private' ? 'Design definido como privado.' : 'Acesso ao design atualizado.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível atualizar o compartilhamento.');
    } finally {
      setBusy(false);
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError('O navegador não permitiu copiar. Selecione e copie o link manualmente.');
    }
  };
  return (
    <Modal title="Compartilhar design" subtitle={document.title} onClose={onClose}>
      <div className="share-choices" role="radiogroup" aria-label="Quem pode ver este design">
        <button className={`share-choice ${visibility === 'private' ? 'selected' : ''}`} role="radio" aria-checked={visibility === 'private'} onClick={() => setVisibility('private')}>
          <span className="share-choice-icon private"><LockKeyhole size={18} /></span><span><strong>Privado</strong><small>Só você pode abrir este design.</small></span><i />
        </button>
        <button className={`share-choice ${visibility === 'link' ? 'selected' : ''}`} role="radio" aria-checked={visibility === 'link'} onClick={() => setVisibility('link')}>
          <span className="share-choice-icon link"><Link2 size={18} /></span><span><strong>Qualquer pessoa com o link</strong><small>Quem receber o link pode visualizar, sem editar.</small></span><i />
        </button>
        <button className={`share-choice ${visibility === 'public' ? 'selected' : ''}`} role="radio" aria-checked={visibility === 'public'} onClick={() => setVisibility('public')}>
          <span className="share-choice-icon public"><Globe2 size={18} /></span><span><strong>Público</strong><small>Disponível por um endereço público, só para visualização.</small></span><i />
        </button>
      </div>
      <div className="share-security"><ShieldCheck size={17} /><span>O link abre uma prévia protegida contra edição. Você pode revogar o acesso quando quiser.</span></div>
      {url && <div className="share-link-box"><label htmlFor="share-url">Link de visualização</label><div><input id="share-url" readOnly value={url} onFocus={(event) => event.currentTarget.select()} /><button className="secondary" onClick={() => void copy()}>{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? 'Copiado' : 'Copiar'}</button></div></div>}
      {error && <p role="alert" className="share-error">{error}</p>}
      <div className="share-footer"><div><UsersRound size={16} /><span>{visibility === 'private' ? 'Acesso restrito à sua conta' : 'Acesso somente para visualização'}</span></div><button className="primary" disabled={busy || visibility === (document.visibility ?? 'private')} onClick={() => void save()}>{busy ? 'Salvando…' : 'Salvar acesso'}</button></div>
    </Modal>
  );
}
