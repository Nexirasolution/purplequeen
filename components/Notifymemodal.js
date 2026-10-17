'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle2 } from 'lucide-react';

const PURPLE = '#4B087A';
const GOLD = '#F7B900';
const INK = '#24052F';
const INK_FAINT = '#6E5A7C';
const PAPER = '#FFF5E8';

export default function NotifyMeModal({ product, onClose }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | done
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const digits = phone.replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, '');
    if (name.trim().length < 2) return setError('Please enter your name');
    if (!/^[6-9]\d{9}$/.test(digits)) return setError('Enter a valid 10-digit mobile number');

    setStatus('loading');
    try {
      const res = await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id ?? product._id ?? product.slug,
          productSlug: product.slug,
          productName: product.name,
          productImage: product.variants?.[0]?.images?.[0] || '',
          name: name.trim(),
          phone: digits,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Something went wrong');
      setStatus('done');
    } catch (err) {
      setError(err.message);
      setStatus('idle');
    }
  };

  const inputStyle = {
    width: '100%', padding: '12px 14px', borderRadius: 10,
    border: `1px solid ${INK_FAINT}55`, background: '#fff', color: INK, fontSize: 16,
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(36,5,47,0.55)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Notify me when back in stock"
    >
      <div
        className="relative w-full sm:max-w-md p-6 rounded-t-2xl sm:rounded-2xl"
        style={{ background: PAPER, color: INK }}
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} aria-label="Close" className="absolute top-4 right-4">
          <X className="w-5 h-5" />
        </button>

        {status === 'done' ? (
          <div className="text-center py-6">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-3" style={{ color: PURPLE }} />
            <h3 className="text-lg font-semibold">You're on the list!</h3>
            <p className="text-sm mt-2" style={{ color: INK_FAINT }}>
              We'll message you on WhatsApp as soon as <b>{product.name}</b> is back.
            </p>
            <button onClick={onClose} className="mt-5 px-6 py-3 rounded-full font-semibold" style={{ background: PURPLE, color: PAPER }}>
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold pr-8">Notify me when available</h3>
              <p className="text-sm mt-1 line-clamp-2" style={{ color: INK_FAINT }}>{product.name}</p>
            </div>

            <input
              style={inputStyle} placeholder="Your name" value={name}
              onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={60}
            />
            <div className="flex gap-2">
              <span className="px-3 flex items-center rounded-[10px] text-base" style={{ background: '#fff', border: `1px solid ${INK_FAINT}55` }}>+91</span>
              <input
                style={inputStyle} placeholder="WhatsApp number" value={phone}
                onChange={(e) => setPhone(e.target.value)} inputMode="numeric"
                autoComplete="tel-national" maxLength={13}
              />
            </div>

            {error && <p className="text-sm" style={{ color: '#B3261E' }}>{error}</p>}

            <button
              type="submit" disabled={status === 'loading'}
              className="w-full py-3 rounded-full font-semibold disabled:opacity-60"
              style={{ background: GOLD, color: INK }}
            >
              {status === 'loading' ? 'Saving…' : 'Notify me on WhatsApp'}
            </button>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}