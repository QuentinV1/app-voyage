import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { useEffect } from 'react';
import { MapPin, X } from 'lucide-react';
import { CATEGORIES } from '../lib/categories';
import type { Category } from '../lib/types';

export function CategoryIcon({ category, className = 'h-4 w-4' }: { category: Category; className?: string }) {
  const Icon = CATEGORIES[category]?.icon ?? MapPin;
  return <Icon className={className} aria-hidden="true" />;
}

export function Spinner({ full, label }: { full?: boolean; label?: string }) {
  const el = (
    <div className="flex flex-col items-center gap-3 text-slate-500">
      <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-rose-200 border-t-brand" />
      {label && <p className="text-sm font-medium text-slate-600">{label}</p>}
    </div>
  );
  return full ? <div className="flex h-full min-h-[240px] items-center justify-center">{el}</div> : el;
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-brand text-white shadow-xs hover:bg-brand-dark active:scale-[0.99] disabled:opacity-50 disabled:hover:bg-brand',
  secondary:
    'bg-white text-slate-800 border border-slate-200 shadow-2xs hover:bg-slate-50 hover:border-slate-300 active:bg-slate-100 disabled:opacity-50',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200/70',
  danger: 'bg-red-50 text-red-700 border border-red-200/80 hover:bg-red-100 active:bg-red-200/70',
};

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-1 disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
    />
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-slate-200/80 bg-white shadow-xs ${className}`}>
      {children}
    </div>
  );
}

export function KpiCard({
  icon,
  label,
  value,
  sub,
  tone = 'slate',
  onClick,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: 'rose' | 'sky' | 'emerald' | 'amber' | 'violet' | 'slate';
  onClick?: () => void;
}) {
  const tones = {
    rose: 'bg-rose-50 text-rose-600 ring-rose-100',
    sky: 'bg-sky-50 text-sky-600 ring-sky-100',
    emerald: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
    amber: 'bg-amber-50 text-amber-600 ring-amber-100',
    violet: 'bg-violet-50 text-violet-600 ring-violet-100',
    slate: 'bg-slate-100 text-slate-600 ring-slate-200/70',
  };

  const inner = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
        <p className="tabular-nums mt-1 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
        {sub && <div className="mt-1 truncate text-xs text-slate-500">{sub}</div>}
      </div>
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${tones[tone]}`}>
        {icon}
      </div>
    </div>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="w-full cursor-pointer rounded-2xl border border-slate-200/80 bg-white p-4 text-left shadow-xs transition hover:border-slate-300 hover:shadow-sm"
      >
        {inner}
      </button>
    );
  }

  return <Card className="p-4">{inner}</Card>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  'w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-brand focus:ring-2 focus:ring-rose-100';

/** Panneau modal (tiroir mobile, dialogue centré desktop) avec fermeture Échap */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 backdrop-blur-[2px] sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="pb-safe flex max-h-[90dvh] w-full max-w-lg flex-col rounded-t-3xl border border-slate-200/80 bg-white shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-5 py-3.5">
          <h2 className="min-w-0 flex-1 truncate text-base font-bold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 cursor-pointer rounded-xl p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto p-4 sm:p-5">{children}</div>
      </div>
    </div>
  );
}

export function Empty({
  icon,
  title,
  children,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2.5 rounded-2xl border border-dashed border-slate-200 bg-white/70 px-6 py-12 text-center text-slate-500">
      {icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
          {icon}
        </div>
      )}
      <p className="text-base font-semibold text-slate-800">{title}</p>
      {children}
    </div>
  );
}
