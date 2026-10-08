import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CircleAlert, CircleCheck, X } from 'lucide-react';

import './donations.css';
import { mad, percent } from './shared';

export function ProgressBar({ raised, goal, donors }: { raised: number; goal: number; donors?: number }) {
  const pct = percent(raised, goal);
  return (
    <div>
      <div aria-label={`${pct}% of goal`} aria-valuemax={100} aria-valuemin={0} aria-valuenow={pct} className={`dn-progress${raised >= goal ? ' dn-progress-funded' : ''}`} role="progressbar"><span style={{ width: `${pct}%` }} /></div>
      <div className="dn-progress-meta"><span><strong>{mad(raised)}</strong> of {mad(goal)}</span><span>{pct}%{donors === undefined ? '' : ` · ${donors} donor${donors === 1 ? '' : 's'}`}</span></div>
    </div>
  );
}

export function Stat({ label, value, note, alert }: { label: string; value: ReactNode; note?: ReactNode; alert?: boolean }) {
  return <div className={`dn-stat${alert ? ' dn-stat-alert' : ''}`}><span className="dn-stat-label">{label}</span><span className="dn-stat-value">{value}</span>{note ? <span className="dn-stat-note">{note}</span> : null}</div>;
}

export function Badge({ children, tone }: { children: ReactNode; tone?: 'draft' | 'warn' | 'funded' | 'closed' | 'danger' }) {
  return <span className={`dn-badge${tone ? ` dn-badge-${tone}` : ''}`}>{children}</span>;
}

export function statusTone(status: string) {
  if (status === 'draft') return 'draft' as const;
  if (status === 'funded') return 'funded' as const;
  if (status === 'closed') return 'closed' as const;
  if (status === 'rejected' || status === 'reversed') return 'danger' as const;
  if (status === 'receipt_submitted' || status === 'pledged' || status === 'expired') return 'warn' as const;
  return undefined;
}

export function BarChart({ data }: { data: { day: string; amount_mad: number; count: number }[] }) {
  const width = 640;
  const height = 170;
  const pad = { top: 8, bottom: 22, left: 4, right: 4 };
  const max = Math.max(1, ...data.map((d) => d.amount_mad));
  const slot = (width - pad.left - pad.right) / Math.max(1, data.length);
  const labelEvery = Math.ceil(data.length / 6);
  return (
    <svg aria-label="Confirmed donations per day" className="dn-chart" preserveAspectRatio="none" role="img" viewBox={`0 0 ${width} ${height}`}>
      <line className="dn-chart-grid" x1={0} x2={width} y1={height - pad.bottom} y2={height - pad.bottom} />
      {data.map((d, i) => {
        const h = d.amount_mad === 0 ? 0 : Math.max(3, ((height - pad.top - pad.bottom) * d.amount_mad) / max);
        const x = pad.left + i * slot;
        return (
          <g key={d.day}>
            <rect className="dn-chart-bar" height={h} rx={2} width={Math.max(2, slot - 3)} x={x + 1.5} y={height - pad.bottom - h}><title>{`${d.day.slice(0, 10)}: ${mad(d.amount_mad)} (${d.count})`}</title></rect>
            {i % labelEvery === 0 ? <text className="dn-chart-axis" x={x} y={height - 6}>{d.day.slice(5, 10)}</text> : null}
          </g>
        );
      })}
    </svg>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string; count?: number }[]; value: T; onChange: (id: T) => void }) {
  return (
    <div className="dn-tabs" role="tablist">
      {tabs.map((t) => (
        <button aria-selected={value === t.id} className={`dn-tab${value === t.id ? ' dn-tab-on' : ''}`} key={t.id} onClick={() => onChange(t.id)} role="tab" type="button">
          {t.label}{t.count ? <span className="dn-tab-count">{t.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function Chips<T extends string>({ options, value, onChange }: { options: { id: T; label: string; count?: number }[]; value: T; onChange: (id: T) => void }) {
  return <div className="dn-chips">{options.map((o) => <button className={`dn-chip${value === o.id ? ' dn-chip-on' : ''}`} key={o.id} onClick={() => onChange(o.id)} type="button">{o.label}{o.count === undefined ? null : <b>{o.count}</b>}</button>)}</div>;
}

export function useNotice() {
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const view = (
    <>
      {error ? <div className="alert alert-error" role="alert"><CircleAlert size={15} /> {error} <button aria-label="Dismiss" className="icon-button" onClick={() => setError('')} type="button"><X size={14} /></button></div> : null}
      {message ? <div className="alert alert-success" role="status"><CircleCheck size={15} /> {message}</div> : null}
    </>
  );
  useEffect(() => {
    if (!message) return;
    const t = window.setTimeout(() => setMessage(''), 4000);
    return () => window.clearTimeout(t);
  }, [message]);
  return { view, fail: (e: unknown) => { setMessage(''); setError(e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : 'Something went wrong.'); }, ok: (m: string) => { setError(''); setMessage(m); }, clear: () => { setError(''); setMessage(''); } };
}

export function Dialog({ title, children, onClose, actions }: { title: string; children: ReactNode; onClose: () => void; actions: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    ref.current?.querySelector<HTMLElement>('input, textarea, button')?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="dialog-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div aria-labelledby="dn-dialog-title" aria-modal="true" className="dialog" ref={ref} role="dialog" style={{ maxWidth: 460 }}>
        <h2 id="dn-dialog-title" style={{ fontSize: 20, marginBottom: 12 }}>{title}</h2>
        <div className="dn-section">{children}</div>
        <div className="dialog-actions">{actions}</div>
      </div>
    </div>
  );
}

export function Field({ label, hint, wide, children }: { label: string; hint?: string; wide?: boolean; children: ReactNode }) {
  return <label className={`dn-field${wide ? ' dn-wide' : ''}`}><span>{label}</span>{children}{hint ? <small>{hint}</small> : null}</label>;
}
