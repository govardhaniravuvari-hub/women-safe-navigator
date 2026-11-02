import { Loader2 } from 'lucide-react';
import { scoreTone } from '../lib/format';

export function Spinner({ size = 18, className = '' }) {
  return <Loader2 size={size} className={`animate-spin ${className}`} />;
}

export function PageLoader({ label = 'Loading…' }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-slate-500">
      <Spinner size={26} className="text-brand-600" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-brand-200 bg-white/60 px-6 py-10 text-center">
      {Icon ? (
        <span className="grid size-11 place-items-center rounded-full bg-brand-50 text-brand-600">
          <Icon size={20} />
        </span>
      ) : null}
      <div>
        <p className="font-semibold text-slate-800">{title}</p>
        {description ? <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function SectionHeading({ eyebrow, title, description, action }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow ? (
          <p className="text-[11px] font-bold tracking-[0.14em] text-brand-600 uppercase">{eyebrow}</p>
        ) : null}
        <h2 className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">{title}</h2>
        {description ? <p className="mt-1 max-w-2xl text-sm text-slate-500">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function ScoreBadge({ score, label, size = 'md' }) {
  const tone = scoreTone(score);
  return (
    <span
      className={`badge ring-1 ${tone.bg} ${tone.text} ${tone.ring} ${size === 'lg' ? 'px-3 py-1.5 text-xs' : ''}`}
    >
      <span className={`inline-block size-1.5 rounded-full ${tone.bar}`} />
      {score != null ? `${score}/100 · ${label || 'estimate'}` : 'Not scored'}
    </span>
  );
}

export function StatusPill({ status }) {
  const map = {
    verified: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    pending: 'bg-amber-50 text-amber-700 ring-amber-200',
    rejected: 'bg-rose-50 text-rose-700 ring-rose-200',
    active: 'bg-brand-50 text-brand-700 ring-brand-200',
    suspended: 'bg-rose-50 text-rose-700 ring-rose-200',
    cancelled: 'bg-slate-100 text-slate-600 ring-slate-200',
    resolved: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  };
  return (
    <span className={`badge ring-1 capitalize ${map[status] || 'bg-slate-100 text-slate-600 ring-slate-200'}`}>
      {status}
    </span>
  );
}

export function Alert({ tone = 'info', title, children, icon: Icon }) {
  const styles = {
    info: 'border-brand-200 bg-brand-50 text-brand-900',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
    error: 'border-rose-200 bg-rose-50 text-rose-900',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  };
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${styles[tone]}`}>
      {title ? (
        <p className="flex items-center gap-2 font-semibold">
          {Icon ? <Icon size={15} /> : null}
          {title}
        </p>
      ) : null}
      <div className={title ? 'mt-1 leading-snug' : 'leading-snug'}>{children}</div>
    </div>
  );
}

export function ConfirmationDialog({ open, title, description, confirmLabel, onConfirm, onCancel, busy, tone = 'danger' }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[950] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <div className="animate-fade-up w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
        <h3 className="text-base font-bold text-slate-900">{title}</h3>
        {description ? <p className="mt-1.5 text-sm text-slate-600">{description}</p> : null}
        <div className="mt-4 flex gap-2">
          <button type="button" className="btn-secondary flex-1" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className={`${tone === 'danger' ? 'btn-danger' : 'btn-primary'} flex-1`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? <Spinner size={16} /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
