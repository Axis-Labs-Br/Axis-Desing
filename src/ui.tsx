import { useEffect, useRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { X, ArrowUpRight } from 'lucide-react';

export function Logo({ compact = false, monochrome = false }: { compact?: boolean; monochrome?: boolean }) {
  return (
    <span className={`logo${monochrome ? ' logo-monochrome' : ''}`} role="img" aria-label="Axis Design">
      <svg width="30" height="30" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <rect width="32" height="32" rx="9" fill={monochrome ? 'transparent' : '#242735'} />
        <path
          d="m7 24.5 7.65-16.1a1.48 1.48 0 0 1 2.68 0L25 24.5M10.5 18.5h11"
          stroke={monochrome ? '#000000' : 'white'}
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="23.5" cy="8" r="2" fill={monochrome ? '#000000' : '#6674f5'} />
      </svg>
      {!compact && (
        <span className="logo-word">
          axis<span className="logo-light">design</span>
          <span className="logo-dot">.</span>
        </span>
      )}
    </span>
  );
}
export function LoadingScreen({ label }: { label: string }) {
  return (
    <main className="app-loading" role="status" aria-label={label} aria-busy="true">
      <Logo monochrome />
    </main>
  );
}
export function IconButton({
  label,
  children,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; children: ReactNode }) {
  return (
    <button
      type="button"
      className={`icon-button ${className}`}
      aria-label={label}
      title={label}
      {...props}
    >
      {children}
    </button>
  );
}
export function Modal({
  title,
  subtitle,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const focusables = () =>
      Array.from(
        el?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input,select,textarea,[tabindex="0"]',
        ) ?? [],
      ).filter((e) => e.offsetParent !== null);
    const timer = setTimeout(
      () => (el?.querySelector<HTMLElement>('[data-autofocus]') ?? focusables()[0])?.focus(),
      0,
    );
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current();
      }
      if (event.key === 'Tab') {
        const list = focusables(),
          first = list[0],
          last = list[list.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        }
        if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', handler, true);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', handler, true);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`modal ${wide ? 'wide' : ''}`}
      >
        <div className="modal-heading">
          <div>
            <h2 id="modal-title">{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <IconButton label="Fechar janela" onClick={onClose}>
            <X size={20} />
          </IconButton>
        </div>
        {children}
      </div>
    </div>
  );
}
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export const externalIcon = <ArrowUpRight size={16} />;
