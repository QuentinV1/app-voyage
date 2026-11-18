import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { useEffect } from 'react';

export function Spinner({ full, label }: { full?: boolean; label?: string }) {
  const el = (
    <div className="flex flex-col items-center gap-2 text-slate-500">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-rose-200 border-t-brand" />
      {label && <p className="text-sm">{label}</p>}
    </div>
  );
  return full ? <div className="flex h-full items-center justify-center">{el}</div> : el;
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand text-white active:bg-brand-dark disabled:opacity-50',
  secondary: 'bg-white text-slate-800 border border-slate-200 active:bg-slate-50 disabled:opacity-50',
  ghost: 'text-slate-600 active:bg-slate-100',
  danger: 'bg-red-50 text-red-700 active:bg-red-100',
};

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 font-medium transition ${VARIANTS[variant]} ${className}`}
    />
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-white shadow-sm ring-1 ring-slate-100 ${className}`}>{children}</div>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-brand focus:ring-2 focus:ring-rose-100';

/** Panneau modal qui monte du bas de l'écran (style mobile) */
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
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        className="pb-safe flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-3xl bg-white sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-full p-2 text-slate-500 active:bg-slate-100" aria-label="Fermer">
            ✕
          </button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

export function Empty({ icon, title, children }: { icon: string; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center text-slate-500">
      <div className="text-4xl">{icon}</div>
      <p className="font-medium text-slate-700">{title}</p>
      {children}
    </div>
  );
}
