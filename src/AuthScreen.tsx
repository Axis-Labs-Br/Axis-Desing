import { useState } from 'react';
import { ArrowRight, Check, Eye, EyeOff, Fingerprint, LockKeyhole, Mail, Sparkles, UserRound } from 'lucide-react';
import { Logo } from './ui';

interface Props {
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (username: string, email: string, password: string) => Promise<void>;
  pendingPublicImport?: boolean;
}

export function AuthScreen({ onLogin, onRegister, pendingPublicImport = false }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (mode === 'register') await onRegister(username, email, password);
      else await onLogin(email, password);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível entrar. Tente novamente.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="auth-page">
      <section className="auth-showcase" aria-label="AxisDesign">
        <div className="auth-showcase-top">
          <Logo />
          <span className="auth-secure">
            <span className="auth-secure-icon"><LockKeyhole size={13} /></span>
            Seu espaço, suas regras
          </span>
        </div>
        <div className="auth-showcase-copy">
          <span className="auth-kicker"><Sparkles size={15} /> CRIATIVIDADE COM IDENTIDADE</span>
          <h1>Suas ideias merecem um espaço só delas.</h1>
          <p>Crie, organize e compartilhe seus designs com a privacidade no seu controle.</p>
        </div>
        <div className="auth-art" aria-hidden="true">
          <div className="auth-art-card auth-art-one"><span>APRESENTAÇÃO</span><strong>Ideias que<br />movem o futuro.</strong><i /></div>
          <div className="auth-art-card auth-art-two"><div><span>STUDIO / 026</span><b>FORMA<br />&amp; FUNÇÃO</b></div><i /></div>
          <div className="auth-art-card auth-art-three"><i /><strong>Design<br />com propósito.</strong></div>
          <span className="auth-art-spark">✦</span>
          <span className="auth-art-caption">IDENTIDADE EM MOVIMENTO</span>
        </div>
        <div className="auth-showcase-bottom">
          <span><i className="auth-status-icon"><Check size={10} /></i>Privado desde o primeiro projeto</span>
          <span>AXISDESIGN · 2026</span>
        </div>
      </section>
      <section className="auth-form-side">
        <div className="auth-form-wrap">
          <div className="auth-mobile-logo"><Logo /></div>
          <div className="auth-heading">
            <span className="auth-form-kicker">{mode === 'register' ? 'COMECE POR AQUI' : 'BEM-VINDO DE VOLTA'}</span>
            <h2>{mode === 'register' ? 'Crie sua conta' : 'Entre na sua conta'}</h2>
            <p>{mode === 'register' ? 'Seu espaço criativo fica pronto em instantes.' : 'Acesse seus designs e continue de onde parou.'}</p>
          </div>
          <div className="auth-mode-switch" role="tablist" aria-label="Acesso à conta">
            <button role="tab" aria-selected={mode === 'register'} className={mode === 'register' ? 'active' : ''} onClick={() => { setMode('register'); setError(''); }}>Criar conta</button>
            <button role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setError(''); }}>Entrar</button>
          </div>
          <form className="auth-form" onSubmit={(event) => void submit(event)}>
            {mode === 'register' && <label>Nome de usuário<div className="auth-input"><UserRound size={17} /><span>@</span><input aria-label="Nome de usuário" autoComplete="username" minLength={3} maxLength={24} required value={username} onChange={(event) => setUsername(event.target.value)} placeholder="seuusuario" /></div><small>Esse nome identifica seu espaço no AxisDesign.</small></label>}
            <label>E-mail<div className="auth-input"><Mail size={17} /><input aria-label="E-mail" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="voce@exemplo.com" /></div></label>
            <label>Senha<div className="auth-input"><Fingerprint size={17} /><input aria-label="Senha" type={visible ? 'text' : 'password'} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} minLength={mode === 'register' ? 10 : undefined} maxLength={128} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder={mode === 'register' ? 'Pelo menos 10 caracteres' : 'Sua senha'} /><button type="button" aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>{mode === 'register' && <small>Use 10 ou mais caracteres para proteger sua conta.</small>}</label>
            {error && <div role="alert" className="auth-error">{error}</div>}
            <button className="primary auth-submit" disabled={busy}>{busy ? 'Aguarde…' : mode === 'register' ? 'Criar minha conta' : 'Entrar'}<ArrowRight size={17} /></button>
          </form>
          <div className="auth-trust"><LockKeyhole size={15} /><span>{pendingPublicImport ? 'Depois de entrar, sua cópia editável será aberta automaticamente.' : 'Seus projetos são privados e separados por conta.'}</span></div>
          <p className="auth-terms">Ao continuar, você concorda em usar o AxisDesign de forma responsável. O compartilhamento de cada design fica sob seu controle.</p>
        </div>
      </section>
    </main>
  );
}
