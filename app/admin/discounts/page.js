'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Trash2 } from 'lucide-react';
import { formatINR } from '@/lib/utils';
import { applyDiscount, isDiscountLive } from '@/lib/discount';

const EMPTY_FORM = { productId: '', type: 'percent', value: '', startsAt: '', endsAt: '' };

export default function AdminDiscountsPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  async function load() {
    setLoading(true);
    // `t` busts the 30s CDN cache on /api/products so edits show immediately
    const res = await fetch(`/api/products?limit=all&t=${Date.now()}`);
    const data = await res.json();
    setProducts(data.products || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  // Products that already have a discount (live, scheduled or expired)
  const discounted = useMemo(() => products.filter((p) => p.discount?.isActive), [products]);
  const available = useMemo(() => products.filter((p) => !p.discount?.isActive), [products]);

  const selected = products.find((p) => p._id === form.productId);
  const preview =
    selected && Number(form.value) > 0
      ? applyDiscount(selected.basePrice, { type: form.type, value: Number(form.value) })
      : null;

  async function save(productId, discount) {
    setSaving(true);
    try {
      const res = await fetch(`/api/products/${productId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discount }), // partial update: nothing else is touched
      });
      if (!res.ok) {
        toast.error('Failed to save');
        return false;
      }
      toast.success('Saved');
      await load();
      return true;
    } finally {
      setSaving(false);
    }
  }

  async function add() {
    if (!form.productId || !(Number(form.value) > 0)) {
      return toast.error('Pick a product and enter a discount value');
    }
    if (form.type === 'percent' && Number(form.value) > 95) {
      return toast.error('Percent discount can be at most 95%');
    }
    const ok = await save(form.productId, {
      isActive: true,
      type: form.type,
      value: Number(form.value),
      startsAt: form.startsAt || null,
      endsAt: form.endsAt || null,
    });
    if (ok) setForm(EMPTY_FORM);
  }

  function remove(p) {
    if (!confirm(`Remove the discount from "${p.name}"?`)) return;
    save(p._id, { ...p.discount, isActive: false });
  }

  const field = 'px-3 py-2 text-sm rounded-lg border border-brand-ink/10 outline-none w-full';

  return (
    <div className="space-y-6">
      {/* Add discount */}
      <div className="card-soft p-4">
        <div className="grid gap-3 sm:grid-cols-6 items-end">
          <label className="sm:col-span-2 text-xs text-brand-ink/60">
            Product
            <select
              className={`${field} mt-1`}
              value={form.productId}
              onChange={(e) => setForm({ ...form, productId: e.target.value })}
            >
              <option value="">Select product…</option>
              {available.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name} ({p.sku})
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs text-brand-ink/60">
            Type
            <select
              className={`${field} mt-1`}
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              <option value="percent">% off</option>
              <option value="flat">₹ off</option>
            </select>
          </label>

          <label className="text-xs text-brand-ink/60">
            Value
            <input
              type="number"
              min="0"
              placeholder={form.type === 'percent' ? 'e.g. 20' : 'e.g. 150'}
              className={`${field} mt-1`}
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
            />
          </label>

          <label className="text-xs text-brand-ink/60">
            Starts (optional)
            <input
              type="datetime-local"
              className={`${field} mt-1`}
              value={form.startsAt}
              onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
            />
          </label>

          <label className="text-xs text-brand-ink/60">
            Ends (optional)
            <input
              type="datetime-local"
              className={`${field} mt-1`}
              value={form.endsAt}
              onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
            />
          </label>
        </div>

        <div className="flex items-center gap-4 mt-4">
          <button onClick={add} disabled={saving} className="btn-primary text-sm">
            Add discount
          </button>
          {preview != null && (
            <span className="text-sm">
              {formatINR(selected.basePrice)} → <b>{formatINR(preview)}</b>
            </span>
          )}
        </div>
      </div>

      {/* Discounted products */}
      {loading ? (
        <p className="text-brand-ink/50">Loading...</p>
      ) : (
        <div className="card-soft overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-brand-ink/10 text-brand-ink/50">
                <th className="p-3">Product</th>
                <th className="p-3">Original</th>
                <th className="p-3">Discount</th>
                <th className="p-3">Discount price</th>
                <th className="p-3">Stock</th>
                <th className="p-3">Status</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {discounted.map((p) => {
                // Stock is the product's own stock (shared with the normal listing)
                const stock = (p.variants || []).reduce(
                  (s, v) => s + (v.sizes || []).reduce((t, z) => t + (z.stock || 0), 0),
                  0
                );
                const live = isDiscountLive(p);
                return (
                  <tr key={p._id} className="border-b border-brand-ink/5">
                    <td className="p-3 font-medium">{p.name}</td>
                    <td className="p-3">{formatINR(p.basePrice)}</td>
                    <td className="p-3">
                      {p.discount.type === 'percent' ? `${p.discount.value}%` : formatINR(p.discount.value)}
                    </td>
                    <td className="p-3 font-bold">{formatINR(applyDiscount(p.basePrice, p.discount))}</td>
                    <td className="p-3">{stock}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${
                          live ? 'bg-brand-green/15 text-brand-deepgreen' : 'bg-brand-ink/10 text-brand-ink/50'
                        }`}
                      >
                        {live ? 'Live' : 'Scheduled / Ended'}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => remove(p)}
                        className="p-1.5 text-brand-magenta"
                        aria-label={`Remove discount from ${p.name}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {discounted.length === 0 && (
            <p className="text-center text-brand-ink/40 py-10">No discounted products yet. Add one above.</p>
          )}
        </div>
      )}
    </div>
  );
}