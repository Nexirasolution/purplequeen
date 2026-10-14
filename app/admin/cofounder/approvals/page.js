'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import ProposalCard from '../ProposalCard';

// Same tokens as AdminShell
const INK_SOFT = '#7A6685'; // muted plum-gray for secondary text
const PURPLE = '#4B087A';   // royal purple (primary)
const LINE = '#D9B4E8';     // lavender borders

export default function ApprovalsPage() {
  const [data, setData] = useState({ pending: [], recent: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/ai-actions', { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Could not load proposals.');
      setData(json);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <div className="flex items-center justify-between pb-3" style={{ borderBottom: `1px solid ${LINE}` }}>
        <div className="flex items-center gap-3">
          <Link href="/admin/cofounder" aria-label="Back to AI Cofounder" style={{ color: INK_SOFT }}>
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-lg font-medium" style={{ color: PURPLE }}>
            AI proposals
          </h1>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs"
          style={{ color: INK_SOFT }}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {error && (
        <p className="mt-3 text-sm" style={{ color: '#A33' }}>
          {error}
        </p>
      )}

      <h2 className="mt-5 text-sm font-medium" style={{ color: PURPLE }}>
        Waiting for your approval ({data.pending.length})
      </h2>
      {!loading && data.pending.length === 0 && (
        <p className="mt-2 text-sm" style={{ color: INK_SOFT }}>
          Nothing waiting. Ask the AI Cofounder for ideas and its proposals will appear here and in the chat.
        </p>
      )}
      <div className="max-w-2xl">
        {data.pending.map((a) => (
          <ProposalCard key={a.id} initial={a} />
        ))}
      </div>

      <h2 className="mt-8 text-sm font-medium" style={{ color: PURPLE }}>
        History
      </h2>
      {!loading && data.recent.length === 0 && (
        <p className="mt-2 text-sm" style={{ color: INK_SOFT }}>
          No past proposals yet.
        </p>
      )}
      <div className="max-w-2xl pb-8">
        {data.recent.map((a) => (
          <ProposalCard key={a.id} initial={a} />
        ))}
      </div>
    </div>
  );
}