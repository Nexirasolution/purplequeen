'use client';

import { useState } from 'react';
import { Check, X, Undo2 } from 'lucide-react';

// Same tokens as AdminShell
const INK = '#24052F';       // deep plum text
const INK_SOFT = '#7A6685';  // muted plum-gray secondary text
const PURPLE = '#4B087A';    // royal purple (primary)
const GOLD = '#F7B900';      // buttons and premium details
const LINE = '#D9B4E8';      // lavender borders
const PAPER = '#FFF5E8';     // ivory

const RISK = {
  low: { label: 'Low risk', bg: '#EFE0F7', fg: PURPLE },
  medium: { label: 'Medium risk', bg: '#FFF0C2', fg: '#7A5A00' },
  high: { label: 'High risk', bg: '#F7DEDB', fg: '#A33' },
};

const STATUS_LABEL = {
  executed: 'Applied',
  rejected: 'Rejected',
  failed: 'Could not apply',
  expired: 'Expired',
  undone: 'Undone',
  executing: 'Applying…',
};

export default function ProposalCard({ initial }) {
  const [a, setA] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function decide(decision) {
    if (
      decision === 'approve' &&
      a.risk === 'high' &&
      !window.confirm(`HIGH-RISK change:\n\n${a.summary}\n\nThis can affect many customers. Apply it now?`)
    ) {
      return;
    }
    setBusy(true);
    setErr('');
    try {
      const res = await fetch(`/api/admin/ai-actions/${a.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Something went wrong.');
      setA(data.action);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  const risk = RISK[a.risk] || RISK.low;
  const done = a.status !== 'pending';

  return (
    <div
      className="mt-2 text-sm"
      style={{ border: `1px solid ${LINE}`, borderRadius: 6, background: PAPER, color: INK, overflow: 'hidden' }}
    >
      <div className="px-3 py-2.5">
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium" style={{ color: PURPLE }}>
            {a.summary}
          </p>
          <span
            className="shrink-0 px-2 py-0.5 text-[11px] font-medium"
            style={{ borderRadius: 3, background: risk.bg, color: risk.fg }}
          >
            {risk.label}
          </span>
        </div>

        <ul className="mt-2 space-y-1 text-xs">
          {a.preview.map((line, i) => (
            <li key={i} className="whitespace-pre-wrap">
              {line}
            </li>
          ))}
        </ul>

        {a.reason && (
          <p className="mt-2 text-xs italic" style={{ color: INK_SOFT }}>
            Why: {a.reason}
          </p>
        )}
      </div>

      <div className="px-3 py-2 flex flex-wrap items-center gap-2" style={{ borderTop: `1px solid ${LINE}`, background: '#fff' }}>
        {!done && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => decide('approve')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium"
              style={{ borderRadius: 4, background: GOLD, color: INK, opacity: busy ? 0.6 : 1 }}
            >
              <Check size={14} /> Approve &amp; apply
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => decide('reject')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium"
              style={{ borderRadius: 4, border: `1px solid ${LINE}`, color: INK_SOFT, opacity: busy ? 0.6 : 1 }}
            >
              <X size={14} /> Reject
            </button>
          </>
        )}

        {done && (
          <>
            <span
              className="text-xs font-medium"
              style={{ color: a.status === 'executed' ? PURPLE : a.status === 'failed' ? '#A33' : INK_SOFT }}
            >
              {STATUS_LABEL[a.status] || a.status}
              {a.decidedBy && a.status !== 'expired' ? ` by ${a.decidedBy}` : ''}
            </span>
            {a.canUndo && (
              <button
                type="button"
                disabled={busy}
                onClick={() => decide('undo')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium"
                style={{ borderRadius: 4, border: `1px solid ${LINE}`, color: INK, opacity: busy ? 0.6 : 1 }}
              >
                <Undo2 size={14} /> Undo
              </button>
            )}
          </>
        )}
      </div>

      {(a.result || a.error || err) && (
        <p className="px-3 pb-2.5 text-xs" style={{ background: '#fff', color: err || a.error ? '#A33' : INK_SOFT }}>
          {err || a.error || a.result}
        </p>
      )}
    </div>
  );
}