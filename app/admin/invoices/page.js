'use client';
import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Printer, Search, X, ArrowLeft, Minus } from 'lucide-react';

// brand palette (same as AdminShell)
const INK = '#24052F', SOFT = '#6E5A7C', PURPLE = '#4B087A', GOLD = '#F7B900', LINE = '#D9B4E8', WASH = '#F6EAF9';

const money = (n) => '₹' + (Number(n) || 0).toLocaleString('en-IN');
const date = (d) => new Date(d).toLocaleDateString('en-IN');
const inp = 'w-full min-w-0 rounded border bg-white px-3 py-2.5 text-sm outline-none focus:border-[#4B087A]';
const btnMain = 'rounded px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50';
const btnGhost = 'inline-flex items-center gap-1.5 rounded border bg-white px-3 py-2 text-sm';

/* ═════════════════════════ Page ═════════════════════════ */
export default function AdminInvoicesPage() {
  const [tab, setTab] = useState('invoices');
  const [orders, setOrders] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [selected, setSelected] = useState(null);
  const [mode, setMode] = useState('view'); // 'view' | 'form'
  const [editing, setEditing] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [msg, setMsg] = useState(null);

  const load = async () => {
    const [o, i] = await Promise.all([
      fetch('/api/admin/invoices?orders=1').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/admin/invoices').then((r) => (r.ok ? r.json() : [])),
    ]);
    setOrders(o); setInvoices(i);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setMode('form'); setMsg(null); };
  const openEdit = () => { setEditing(selected); setMode('form'); setMsg(null); };
  const back = () => { setMode('view'); setSelected(null); };

  const fromOrder = async (order) => {
    if (!confirm(`Generate invoice for ${order.orderNumber}? This will reduce stock.`)) return;
    setBusyId(order._id); setMsg(null);
    const r = await fetch('/api/admin/invoices', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: order._id }),
    });
    const data = await r.json();
    setBusyId(null);
    if (!r.ok) return setMsg({ type: 'error', text: data.error || 'Failed' });
    setMsg({ type: 'ok', text: `${data.invoiceNumber} created and stock reduced.` });
    setSelected(data); setMode('view'); setTab('invoices'); load();
  };

  const voidInvoice = async () => {
    if (!confirm(`Delete ${selected.invoiceNumber}? Stock for its items will be added back.`)) return;
    const r = await fetch(`/api/admin/invoices?id=${selected._id}`, { method: 'DELETE' });
    const data = await r.json();
    if (!r.ok) return setMsg({ type: 'error', text: data.error || 'Failed' });
    setMsg({ type: 'ok', text: 'Invoice deleted and stock restored.' });
    setSelected(null); load();
  };

  const onSaved = (inv, text) => {
    setMsg({ type: 'ok', text });
    setSelected(inv); setMode('view'); setTab('invoices'); load();
  };

  // on phones show EITHER the list OR the detail/form
  const detailOpen = mode === 'form' || !!selected;

  return (
    <div className="w-full min-w-0 max-w-5xl">
      <style>{`@media print{body *{visibility:hidden}#invoice,#invoice *{visibility:visible}#invoice{position:absolute;left:0;top:0;width:100%;border:0!important}.no-print{display:none!important}}`}</style>

      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold sm:text-2xl" style={{ color: INK }}>Invoices</h1>
        <button onClick={openNew} className={`${btnMain} inline-flex items-center gap-1.5`} style={{ background: PURPLE }}>
          <Plus size={16} /> New invoice
        </button>
      </div>

      {msg && (
        <p className={`no-print mb-3 rounded border bg-white p-2 text-sm ${msg.type === 'ok' ? 'border-green-300 text-green-700' : 'border-red-300 text-red-600'}`}>
          {msg.text}
        </p>
      )}

      <div className="grid min-w-0 gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* LIST */}
        <div className={`no-print min-w-0 ${detailOpen ? 'hidden lg:block' : ''}`}>
          <div className="mb-3 grid grid-cols-2 rounded-lg border bg-white p-1 text-sm" style={{ borderColor: LINE }}>
            {[['invoices', `Invoices (${invoices.length})`], ['orders', `From orders (${orders.length})`]].map(([k, label]) => (
              <button key={k} onClick={() => setTab(k)} className="rounded py-2"
                style={tab === k ? { background: PURPLE, color: '#fff' } : { color: SOFT }}>{label}</button>
            ))}
          </div>

          <div className="space-y-2">
            {tab === 'invoices' && invoices.map((inv) => (
              <button key={inv._id} onClick={() => { setSelected(inv); setMode('view'); }}
                className="flex w-full items-center justify-between gap-2 rounded-lg border bg-white p-3 text-left"
                style={{ borderColor: selected?._id === inv._id ? PURPLE : LINE }}>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{inv.invoiceNumber}</span>
                  <span className="block truncate text-xs" style={{ color: SOFT }}>{inv.customer?.name || '—'} · {date(inv.createdAt)}</span>
                </span>
                <span className="shrink-0 text-sm font-semibold">{money(inv.total)}</span>
              </button>
            ))}
            {tab === 'invoices' && invoices.length === 0 && <p className="text-sm" style={{ color: SOFT }}>No invoices yet.</p>}

            {tab === 'orders' && orders.map((o) => (
              <div key={o._id} className="rounded-lg border bg-white p-3 text-sm" style={{ borderColor: LINE }}>
                <div className="flex justify-between gap-2">
                  <span className="truncate font-medium">{o.orderNumber}</span>
                  <span className="shrink-0 font-semibold">{money(o.total)}</span>
                </div>
                <p className="text-xs" style={{ color: SOFT }}>
                  {o.customer?.name || '—'} · {date(o.createdAt)} · {o.paymentMethod?.toUpperCase()} / {o.paymentStatus}
                </p>
                <button onClick={() => fromOrder(o)} disabled={busyId === o._id}
                  className={`${btnMain} mt-2 w-full`} style={{ background: PURPLE }}>
                  {busyId === o._id ? 'Generating…' : 'Generate invoice'}
                </button>
              </div>
            ))}
            {tab === 'orders' && orders.length === 0 && <p className="text-sm" style={{ color: SOFT }}>All orders are invoiced.</p>}
          </div>
        </div>

        {/* DETAIL / FORM */}
        <div className={`min-w-0 ${detailOpen ? '' : 'hidden lg:block'}`}>
          {detailOpen && (
            <button onClick={back} className="no-print mb-3 inline-flex items-center gap-1.5 text-sm lg:hidden" style={{ color: PURPLE }}>
              <ArrowLeft size={16} /> Back to list
            </button>
          )}

          {mode === 'form' && (
            <InvoiceForm key={editing?._id || 'new'} initial={editing}
              onCancel={() => setMode('view')} onSaved={onSaved} />
          )}
          {mode === 'view' && selected && <InvoiceView inv={selected} onEdit={openEdit} onVoid={voidInvoice} />}
          {mode === 'view' && !selected && (
            <p className="no-print rounded-lg border border-dashed p-6 text-center text-sm" style={{ borderColor: LINE, color: SOFT }}>
              Select an invoice, or click “New invoice”.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═════════════════════════ Invoice view ═════════════════════════ */
function InvoiceView({ inv, onEdit, onVoid }) {
  const a = inv.shippingAddress || {};
  return (
    <div className="min-w-0">
      <div className="no-print mb-2 flex flex-wrap gap-2">
        <button onClick={() => window.print()} className={btnGhost} style={{ borderColor: LINE }}><Printer size={15} /> Print / PDF</button>
        <button onClick={onEdit} className={btnGhost} style={{ borderColor: LINE }}><Pencil size={15} /> Edit</button>
        <button onClick={onVoid} className={`${btnGhost} text-red-600`} style={{ borderColor: LINE }}><Trash2 size={15} /> Delete</button>
      </div>

      <div id="invoice" className="rounded-lg border bg-white p-4 text-black sm:p-8" style={{ borderColor: LINE }}>
        <div className="flex flex-col gap-4 sm:flex-row sm:justify-between">
          <div>
            <p className="text-lg font-bold" style={{ color: PURPLE }}>Purple Queen</p>
            <h2 className="mt-2 text-xl font-bold">INVOICE</h2>
            <p className="break-all text-sm">{inv.invoiceNumber}</p>
            <p className="text-sm text-gray-600">{date(inv.createdAt)}</p>
            <p className="text-xs text-gray-500">{inv.paymentMethod?.toUpperCase()} · {inv.paymentStatus}</p>
          </div>
          <div className="min-w-0 text-sm sm:text-right">
            <p className="text-xs uppercase tracking-wide text-gray-500">Bill to</p>
            <p className="font-medium">{inv.customer?.name}</p>
            <p>{inv.customer?.phone}</p>
            <p className="break-all">{inv.customer?.email}</p>
            <p className="mt-1 text-gray-700">
              {[a.line1, a.line2, a.landmark].filter(Boolean).join(', ')}
              {(a.line1 || a.line2) && <br />}
              {[a.city, a.state, a.pincode].filter(Boolean).join(', ')}
            </p>
          </div>
        </div>

        {/* desktop table */}
        <div className="mt-6 hidden sm:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2">Item</th><th>Color</th><th>Size</th>
                <th className="text-right">Qty</th><th className="text-right">Price</th><th className="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {inv.items.map((i, k) => (
                <tr key={k} className="border-b align-top">
                  <td className="py-2">
                    <div className="flex items-start gap-2">
                      <Thumb src={i.image} size={44} />
                      <div className="min-w-0">
                        {i.name}
                        {i.sku && <span className="block text-xs text-gray-400">{i.sku}</span>}
                        {i.details && <span className="block text-xs text-gray-500">{i.details}</span>}
                      </div>
                    </div>
                  </td>
                  <td>{i.color}</td><td>{i.size}</td>
                  <td className="text-right">{i.qty}</td>
                  <td className="text-right">{money(i.price)}</td>
                  <td className="text-right">{money(i.price * i.qty)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* mobile cards */}
        <div className="mt-4 space-y-3 sm:hidden">
          {inv.items.map((i, k) => (
            <div key={k} className="flex gap-3 rounded border p-3 text-sm">
              <Thumb src={i.image} size={56} />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{i.name}</p>
                {i.details && <p className="text-xs text-gray-500">{i.details}</p>}
                <div className="mt-1 flex justify-between gap-2">
                  <span>{[i.color, i.size].filter(Boolean).join(' / ')} · {i.qty} × {money(i.price)}</span>
                  <span className="shrink-0 font-semibold">{money(i.price * i.qty)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="ml-auto mt-4 w-full space-y-1 text-sm sm:w-64">
          <Row label="Subtotal" value={money(inv.subtotal)} />
          {inv.discount > 0 && <Row label={`Discount${inv.couponCode ? ` (${inv.couponCode})` : ''}`} value={'-' + money(inv.discount)} />}
          {inv.shippingFee > 0 && <Row label="Shipping" value={money(inv.shippingFee)} />}
          <div className="flex justify-between border-t pt-1 text-base font-bold">
            <span>Total</span><span>{money(inv.total)}</span>
          </div>
        </div>
        {inv.notes && <p className="mt-4 text-sm text-gray-600">Note: {inv.notes}</p>}
      </div>
    </div>
  );
}

/* ═════════════════════════ Create / edit form ═════════════════════════ */
function InvoiceForm({ initial, onSaved, onCancel }) {
  const locked = initial?.source === 'order'; // order invoices: products fixed

  const [customer, setCustomer] = useState({ name: '', phone: '', email: '', ...(initial?.customer || {}) });
  const [addr, setAddr] = useState({
    line1: '', line2: '', city: '', state: '', pincode: '', landmark: '', ...(initial?.shippingAddress || {}),
  });
  // line: { product, name, sku, color, size, qty, price, stock, origQty }
  const [lines, setLines] = useState((initial?.items || []).map((i) => ({ ...i, origQty: initial.source === 'manual' ? i.qty : 0 })));
  const [discount, setDiscount] = useState(initial?.discount || '');
  const [shippingFee, setShippingFee] = useState(initial?.shippingFee || '');
  const [paymentMethod, setPaymentMethod] = useState(initial?.paymentMethod || 'cash');
  const [paymentStatus, setPaymentStatus] = useState(initial?.paymentStatus || 'paid');
  const [notes, setNotes] = useState(initial?.notes || '');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  // when editing: look up current stock of each line
  useEffect(() => {
    if (!initial || locked || !initial.items?.length) return;
    const ids = [...new Set(initial.items.map((i) => i.product))].join(',');
    fetch(`/api/admin/invoices?products=1&ids=${ids}`)
      .then((r) => r.json())
      .then((ps) => {
        const m = new Map(ps.map((p) => [String(p._id), p]));
        setLines((ls) => ls.map((l) => {
          const s = m.get(String(l.product))?.variants?.find((v) => v.color === l.color)?.sizes?.find((x) => x.size === l.size);
          return { ...l, stock: s ? s.stock : undefined };
        }));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const maxOf = (l) => (l.stock == null ? Infinity : l.stock + (l.origQty || 0));

  const addLines = (news) =>
    setLines((ls) => {
      const out = [...ls];
      for (const n of news) {
        const i = out.findIndex((l) => l.product === n.product && l.color === n.color && l.size === n.size);
        if (i >= 0) out[i] = { ...out[i], qty: Math.min((Number(out[i].qty) || 0) + n.qty, maxOf(out[i])) };
        else out.push({ ...n, origQty: 0 });
      }
      return out;
    });

  const patch = (idx, p) => setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...p } : l)));
  const remove = (idx) => setLines((ls) => ls.filter((_, i) => i !== idx));

  const items = locked ? initial.items : lines;
  const pieces = items.reduce((s, i) => s + (Number(i.qty) || 0), 0);
  const subtotal = items.reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.qty) || 0), 0);
  const total = Math.max(0, subtotal - (Number(discount) || 0) + (Number(shippingFee) || 0));

  async function save(e) {
    e.preventDefault(); setErr('');
    if (!customer.name?.trim()) return setErr('Customer name is required');
    if (!locked && lines.length === 0) return setErr('Add at least one product');
    if (!locked && lines.some((l) => !(Number(l.qty) >= 1))) return setErr('Every quantity must be 1 or more');
    setSaving(true);
    const payload = {
      customer, shippingAddress: addr, paymentMethod, paymentStatus, notes,
      discount: Number(discount) || 0, shippingFee: Number(shippingFee) || 0,
      ...(locked ? {} : {
        items: lines.map((l) => ({ product: l.product, variantId: l.variantId, color: l.color, size: l.size, qty: Number(l.qty), price: Number(l.price) })),
      }),
    };
    const r = await fetch('/api/admin/invoices', {
      method: initial ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(initial ? { ...payload, id: initial._id } : payload),
    });
    const data = await r.json();
    setSaving(false);
    if (!r.ok) return setErr(data.error || 'Failed to save');
    onSaved(data, initial ? 'Invoice updated and stock adjusted.' : `${data.invoiceNumber} created and stock reduced.`);
  }

  const set = (setter) => (k) => (e) => setter((o) => ({ ...o, [k]: e.target.value }));

  return (
    <>
      <form onSubmit={save} className="no-print min-w-0 space-y-5 rounded-lg border bg-white p-3 sm:p-5" style={{ borderColor: LINE }}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="truncate text-lg font-semibold" style={{ color: INK }}>
            {initial ? `Edit ${initial.invoiceNumber}` : 'New invoice'}
          </h2>
          <button type="button" onClick={onCancel} aria-label="Close" className="hidden lg:block" style={{ color: SOFT }}><X size={20} /></button>
        </div>

        {locked && (
          <p className="rounded p-2 text-xs" style={{ background: WASH, color: SOFT }}>
            This invoice came from an order, so its products are fixed (stock is tied to the order). You can edit customer, address, discount, shipping, payment and notes.
          </p>
        )}

        {/* Customer */}
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Customer</h3>
          <div className="grid gap-2 sm:grid-cols-3">
            <input className={inp} style={{ borderColor: LINE }} placeholder="Name *" value={customer.name || ''} onChange={set(setCustomer)('name')} />
            <input className={inp} style={{ borderColor: LINE }} placeholder="Phone" inputMode="tel" value={customer.phone || ''} onChange={set(setCustomer)('phone')} />
            <input className={inp} style={{ borderColor: LINE }} placeholder="Email" inputMode="email" value={customer.email || ''} onChange={set(setCustomer)('email')} />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <input className={inp} style={{ borderColor: LINE }} placeholder="Address line 1" value={addr.line1 || ''} onChange={set(setAddr)('line1')} />
            <input className={inp} style={{ borderColor: LINE }} placeholder="Address line 2" value={addr.line2 || ''} onChange={set(setAddr)('line2')} />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <input className={inp} style={{ borderColor: LINE }} placeholder="City" value={addr.city || ''} onChange={set(setAddr)('city')} />
            <input className={inp} style={{ borderColor: LINE }} placeholder="State" value={addr.state || ''} onChange={set(setAddr)('state')} />
            <input className={`${inp} col-span-2 sm:col-span-1`} style={{ borderColor: LINE }} placeholder="Pincode" inputMode="numeric" value={addr.pincode || ''} onChange={set(setAddr)('pincode')} />
          </div>
        </section>

        {/* Products */}
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Products {pieces > 0 && <span className="font-normal" style={{ color: SOFT }}>· {pieces} pcs</span>}</h3>
            {!locked && (
              <button type="button" onClick={() => setPickerOpen(true)}
                className="inline-flex items-center gap-1.5 rounded px-3 py-2 text-sm font-medium text-white" style={{ background: PURPLE }}>
                <Plus size={16} /> Add products
              </button>
            )}
          </div>

          <div className="space-y-2">
            {items.map((l, idx) => {
              const max = maxOf(l);
              const over = !locked && Number(l.qty) > max;
              return (
                <div key={idx} className="rounded border p-3" style={{ borderColor: over ? '#dc2626' : LINE }}>
                  <div className="flex items-start justify-between gap-3">
                    <Thumb src={l.image} size={56} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{l.name}</p>
                      <p className="text-xs" style={{ color: SOFT }}>
                        {[l.color, l.size && `Size ${l.size}`].filter(Boolean).join(' · ')}
                        {l.sku && ` · ${l.sku}`}{l.details && ` · ${l.details}`}
                      </p>
                    </div>
                    {!locked && (
                      <button type="button" onClick={() => remove(idx)} aria-label="Remove" className="shrink-0 p-1 text-red-500"><Trash2 size={18} /></button>
                    )}
                  </div>

                  {locked ? (
                    <p className="mt-1 text-xs" style={{ color: SOFT }}>{l.qty} × {money(l.price)} = {money(l.price * l.qty)}</p>
                  ) : (
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <Stepper value={l.qty} max={max} onChange={(v) => patch(idx, { qty: v })} />
                      <div className="flex min-w-0 flex-1 items-center gap-1">
                        <span className="text-xs" style={{ color: SOFT }}>₹</span>
                        <input className={`${inp} !py-2`} style={{ borderColor: LINE, minWidth: 80 }} type="number" min="0" inputMode="decimal"
                          value={l.price} onChange={(e) => patch(idx, { price: e.target.value })} aria-label="Price" />
                      </div>
                      <span className="ml-auto text-sm font-semibold">{money((Number(l.price) || 0) * (Number(l.qty) || 0))}</span>
                    </div>
                  )}
                  {!locked && l.stock != null && (
                    <p className="mt-1 text-xs" style={{ color: over ? '#dc2626' : SOFT }}>
                      {over ? `Only ${max} available` : `Available: ${max === Infinity ? '—' : max}`}
                    </p>
                  )}
                </div>
              );
            })}
            {items.length === 0 && (
              <p className="rounded border border-dashed p-4 text-center text-sm" style={{ borderColor: LINE, color: SOFT }}>
                No products yet. Tap “Add products”.
              </p>
            )}
          </div>
        </section>

        {/* Totals & payment */}
        <section className="grid gap-2 sm:grid-cols-2">
          <input className={inp} style={{ borderColor: LINE }} type="number" min="0" inputMode="decimal" placeholder="Discount (₹)" value={discount} onChange={(e) => setDiscount(e.target.value)} />
          <input className={inp} style={{ borderColor: LINE }} type="number" min="0" inputMode="decimal" placeholder="Shipping (₹)" value={shippingFee} onChange={(e) => setShippingFee(e.target.value)} />
          <select className={inp} style={{ borderColor: LINE }} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            {['cash', 'upi', 'card', 'cod', 'razorpay', 'other'].map((m) => <option key={m} value={m}>{m.toUpperCase()}</option>)}
          </select>
          <select className={inp} style={{ borderColor: LINE }} value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}>
            {['paid', 'pending', 'refunded'].map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <textarea className={`${inp} sm:col-span-2`} style={{ borderColor: LINE }} rows={2} placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </section>

        {err && <p className="rounded border border-red-300 p-2 text-sm text-red-600">{err}</p>}

        {/* sticky action bar (always reachable on phones) */}
        <div className="sticky bottom-0 -mx-3 flex flex-wrap items-center gap-3 border-t bg-white px-3 py-3 sm:-mx-5 sm:px-5" style={{ borderColor: LINE }}>
          <div className="min-w-0">
            <p className="text-xs" style={{ color: SOFT }}>Total</p>
            <p className="text-lg font-bold leading-tight">{money(total)}</p>
          </div>
          <button disabled={saving} className={`${btnMain} ml-auto`} style={{ background: PURPLE, boxShadow: `inset 0 -2px 0 ${GOLD}` }}>
            {saving ? 'Saving…' : initial ? 'Save changes' : 'Create invoice'}
          </button>
          <button type="button" onClick={onCancel} className={btnGhost} style={{ borderColor: LINE }}>Cancel</button>
        </div>
      </form>

      {pickerOpen && <ProductPicker onAdd={addLines} onClose={() => setPickerOpen(false)} />}
    </>
  );
}

/* ═════════════════════════ Product picker (all products + category + size stock) ═════════════════════════ */
function ProductPicker({ onAdd, onClose }) {
  const LIMIT = 20;
  const [cats, setCats] = useState([]);
  const [cat, setCat] = useState('');
  const [q, setQ] = useState('');
  const [list, setList] = useState([]);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [added, setAdded] = useState(0);

  const [active, setActive] = useState(null); // product being configured
  const [color, setColor] = useState('');
  const [price, setPrice] = useState('');
  const [picks, setPicks] = useState({}); // "color|size" -> { color, size, qty, stock }

  useEffect(() => {
    fetch('/api/admin/invoices?categories=1').then((r) => (r.ok ? r.json() : [])).then(setCats).catch(() => {});
  }, []);

  const fetchPage = async (skip, replace) => {
    setLoading(true);
    const r = await fetch(`/api/admin/invoices?products=1&limit=${LIMIT}&skip=${skip}&q=${encodeURIComponent(q.trim())}&category=${cat}`);
    const data = r.ok ? await r.json() : [];
    setList((l) => (replace ? data : [...l, ...data]));
    setMore(data.length === LIMIT);
    setLoading(false);
  };

  useEffect(() => {
    const t = setTimeout(() => fetchPage(0, true), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, cat]);

  const stockOf = (p) => p.variants.reduce((s, v) => s + v.sizes.reduce((a, z) => a + z.stock, 0), 0);

  const open = (p) => {
    const v = p.variants.find((x) => x.sizes.some((s) => s.stock > 0)) || p.variants[0];
    setActive(p); setColor(v?.color || ''); setPrice(p.price); setPicks({});
  };

  const setQty = (sz, n) => {
    const key = `${color}|${sz.size}`;
    const qty = Math.max(0, Math.min(sz.stock, n));
    setPicks((m) => ({ ...m, [key]: { color, size: sz.size, qty, stock: sz.stock } }));
  };

  const chosen = Object.values(picks).filter((x) => x.qty > 0);
  const totalPcs = chosen.reduce((s, x) => s + x.qty, 0);

  const addToInvoice = () => {
    onAdd(chosen.map((x) => ({
      product: active._id, name: active.name, sku: active.sku,
      color: x.color, size: x.size, qty: x.qty, price: Number(price) || 0, stock: x.stock,
      image: active.variants.find((v) => v.color === x.color)?.image || active.image || '',
      variantId: active.variants.find((v) => v.color === x.color)?.id,
    })));
    setAdded((n) => n + totalPcs);
    setActive(null); setPicks({});
  };

  const sizes = active?.variants.find((v) => v.color === color)?.sizes || [];

  return (
    <div className="no-print fixed inset-0 z-[70] flex items-end justify-center bg-black/40 md:items-center" onClick={onClose}>
      <div className="flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-white md:h-[80vh] md:max-w-2xl md:rounded-xl"
        style={{ background: '#fff' }} onClick={(e) => e.stopPropagation()}>

        {/* header */}
        <div className="flex items-center gap-2 border-b px-3 py-3" style={{ borderColor: LINE }}>
          {active ? (
            <button onClick={() => setActive(null)} className="p-1" aria-label="Back" style={{ color: PURPLE }}><ArrowLeft size={20} /></button>
          ) : null}
          <h3 className="min-w-0 flex-1 truncate font-semibold" style={{ color: INK }}>{active ? active.name : 'Select products'}</h3>
          <button onClick={onClose} className="rounded px-3 py-1.5 text-sm font-medium text-white" style={{ background: PURPLE }}>
            Done{added > 0 && ` (${added})`}
          </button>
        </div>

        {/* LIST VIEW */}
        {!active && (
          <>
            <div className="space-y-2 border-b p-3" style={{ borderColor: LINE }}>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-3" style={{ color: SOFT }} />
                <input className={`${inp} pl-9`} style={{ borderColor: LINE }} placeholder="Search products…" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
              <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1">
                {[{ _id: '', name: 'All' }, ...cats].map((c) => (
                  <button key={c._id || 'all'} onClick={() => setCat(c._id)}
                    className="shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium"
                    style={cat === c._id ? { background: PURPLE, color: '#fff', borderColor: PURPLE } : { borderColor: LINE, color: SOFT }}>
                    {c.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto p-3">
              {list.map((p) => {
                const st = stockOf(p);
                return (
                  <button key={p._id} onClick={() => open(p)} disabled={st === 0}
                    className="flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left disabled:opacity-50" style={{ borderColor: LINE }}>
                    <span className="flex min-w-0 items-center gap-3">
                      <Thumb src={p.image || p.variants.find((v) => v.image)?.image} size={52} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{p.name}</span>
                        <span className="block truncate text-xs" style={{ color: SOFT }}>
                          {[p.category, p.sku].filter(Boolean).join(' · ') || '—'}
                        </span>
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-sm font-semibold">{money(p.price)}</span>
                      <span className="block text-xs" style={{ color: st === 0 ? '#dc2626' : SOFT }}>{st === 0 ? 'Out of stock' : `${st} in stock`}</span>
                    </span>
                  </button>
                );
              })}
              {!loading && list.length === 0 && <p className="p-4 text-center text-sm" style={{ color: SOFT }}>No products found.</p>}
              {loading && <p className="p-2 text-center text-xs" style={{ color: SOFT }}>Loading…</p>}
              {more && !loading && (
                <button onClick={() => fetchPage(list.length, false)} className={`${btnGhost} w-full justify-center`} style={{ borderColor: LINE }}>
                  Load more
                </button>
              )}
            </div>
          </>
        )}

        {/* PRODUCT VIEW: color + size quantities */}
        {active && (
          <>
            <div className="flex-1 space-y-4 overflow-y-auto p-3">
              <div className="flex justify-center">
                <Thumb src={active.variants.find((v) => v.color === color)?.image || active.image} size={180} />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Price ₹</label>
                <input className={`${inp} max-w-[140px]`} style={{ borderColor: LINE }} type="number" min="0" inputMode="decimal"
                  value={price} onChange={(e) => setPrice(e.target.value)} />
              </div>

              <div>
                <p className="mb-1.5 text-sm font-medium">
                  Choose color: <span style={{ color: PURPLE }}>{color || 'Standard'}</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {active.variants.map((v) => {
                    const st = v.sizes.reduce((a, z) => a + z.stock, 0);
                    const picked = Object.values(picks).filter((x) => x.color === v.color).reduce((a, x) => a + x.qty, 0);
                    const on = color === v.color;
                    return (
                      <button key={v.color} type="button" onClick={() => setColor(v.color)}
                        className="relative flex items-center gap-2 rounded-lg border p-1.5 pr-3 text-left"
                        style={{ borderColor: on ? PURPLE : LINE, boxShadow: on ? `0 0 0 1px ${PURPLE}` : 'none', opacity: st === 0 ? 0.5 : 1 }}>
                        <Thumb src={v.image || active.image} size={40} />
                        <span>
                          <span className="block text-sm font-medium">{v.color || 'Standard'}</span>
                          <span className="block text-[11px]" style={{ color: st === 0 ? '#dc2626' : SOFT }}>{st === 0 ? 'Out of stock' : `${st} in stock`}</span>
                        </span>
                        {picked > 0 && (
                          <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-bold text-white" style={{ background: PURPLE }}>
                            {picked}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="mb-1.5 text-sm font-medium">Sizes — set quantity (stock reduces from the size you pick)</p>
                <div className="space-y-2">
                  {sizes.map((sz) => {
                    const qty = picks[`${color}|${sz.size}`]?.qty || 0;
                    return (
                      <div key={sz.size} className="flex items-center justify-between gap-3 rounded-lg border p-3" style={{ borderColor: qty ? PURPLE : LINE, opacity: sz.stock === 0 ? 0.5 : 1 }}>
                        <div>
                          <p className="text-sm font-semibold">Size {sz.size}</p>
                          <p className="text-xs" style={{ color: sz.stock === 0 ? '#dc2626' : SOFT }}>{sz.stock === 0 ? 'Out of stock' : `${sz.stock} in stock`}</p>
                        </div>
                        <Stepper value={qty} min={0} max={sz.stock} disabled={sz.stock === 0} onChange={(v) => setQty(sz, v)} />
                      </div>
                    );
                  })}
                  {sizes.length === 0 && <p className="text-sm" style={{ color: SOFT }}>No sizes for this color.</p>}
                </div>
              </div>

              {chosen.length > 0 && (
                <p className="rounded p-2 text-xs" style={{ background: WASH, color: SOFT }}>
                  Selected: {chosen.map((x) => `${x.color} ${x.size} ×${x.qty}`).join(', ')}
                </p>
              )}
            </div>

            <div className="flex items-center gap-3 border-t p-3" style={{ borderColor: LINE }}>
              <div>
                <p className="text-xs" style={{ color: SOFT }}>{totalPcs} pcs</p>
                <p className="font-bold">{money(totalPcs * (Number(price) || 0))}</p>
              </div>
              <button onClick={addToInvoice} disabled={totalPcs === 0} className={`${btnMain} ml-auto`} style={{ background: PURPLE }}>
                Add to invoice
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ═════════════════════════ small pieces ═════════════════════════ */
function Stepper({ value, onChange, max = Infinity, min = 1, disabled }) {
  const v = Number(value) || 0;
  const btn = 'flex h-9 w-9 items-center justify-center rounded border disabled:opacity-40';
  return (
    <div className="flex items-center gap-1.5">
      <button type="button" disabled={disabled || v <= min} onClick={() => onChange(Math.max(min, v - 1))} className={btn} style={{ borderColor: LINE }} aria-label="Decrease"><Minus size={16} /></button>
      <input type="number" inputMode="numeric" min={min} value={value} disabled={disabled}
        onChange={(e) => onChange(e.target.value === '' ? '' : Math.max(min, Math.min(max, parseInt(e.target.value) || 0)))}
        className="h-9 w-14 rounded border text-center text-sm outline-none focus:border-[#4B087A]" style={{ borderColor: LINE }} />
      <button type="button" disabled={disabled || v >= max} onClick={() => onChange(Math.min(max, v + 1))} className={btn} style={{ borderColor: LINE }} aria-label="Increase"><Plus size={16} /></button>
    </div>
  );
}

function Thumb({ src, size = 48 }) {
  const [bad, setBad] = useState(false);
  const box = { width: size, height: size, borderColor: LINE, background: WASH };
  if (!src || bad) return <div className="shrink-0 rounded border" style={box} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" loading="lazy" onError={() => setBad(true)} className="shrink-0 rounded border object-cover" style={box} />;
}

function Row({ label, value }) {
  return <div className="flex justify-between"><span>{label}</span><span>{value}</span></div>;
}