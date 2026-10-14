'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

// Theme: #4B087A (royal purple), #F7B900 (gold), #FFF5E8 (ivory), #24052F (deep plum), #D9B4E8 (lavender)
const INK = '#24052F';          // primary text
const INK_SOFT = '#7A6685';     // muted text (derived plum-gray)
const LINE = '#D9B4E8';         // borders (lavender)
const PAPER = '#FFF5E8';        // page background (ivory)
const PURPLE = '#4B087A';       // royal purple (brand name, focus border)
const GOLD = '#F7B900';         // button

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      router.push('/admin');
      router.refresh();
    } else {
      toast.error(data.error || 'Login failed');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: PAPER }}>
      <form onSubmit={submit} className="w-full max-w-[340px]">
        <div className="text-center mb-8">
          <h1 className="text-xl font-medium" style={{ color: PURPLE }}>
            Purple Queen
          </h1>
          <p className="text-xs mt-1.5" style={{ color: INK_SOFT }}>Admin sign in</p>
        </div>

        <div className="space-y-3">
          <input
            type="email"
            required
            placeholder="Admin email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2.5 text-sm bg-transparent outline-none transition-colors"
            style={{ border: `1px solid ${LINE}`, borderRadius: '4px', color: INK }}
            onFocus={(e) => (e.target.style.borderColor = PURPLE)}
            onBlur={(e) => (e.target.style.borderColor = LINE)}
          />
          <input
            type="password"
            required
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2.5 text-sm bg-transparent outline-none transition-colors"
            style={{ border: `1px solid ${LINE}`, borderRadius: '4px', color: INK }}
            onFocus={(e) => (e.target.style.borderColor = PURPLE)}
            onBlur={(e) => (e.target.style.borderColor = LINE)}
          />
        </div>

        <button
          disabled={loading}
          className="w-full mt-5 py-2.5 text-sm font-medium transition-opacity active:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: GOLD, color: INK, borderRadius: '4px' }}
        >
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}