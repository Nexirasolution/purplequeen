'use client';

import { useEffect, useMemo, useState } from 'react';

export default function AdminNotifyPage() {
  const [rows, setRows] = useState([]);

  const load = async () => setRows(await (await fetch('/api/admin/notify')).json());
  useEffect(() => { load(); }, []);

  const groups = useMemo(() => {
    const m = {};
    rows.forEach((r) => {
      (m[r.productId] ||= { productId: r.productId, name: r.productName, items: [] }).items.push(r);
    });
    return Object.values(m);
  }, [rows]);

  const message = (r) =>
    `Hi ${r.name}, good news! ${r.productName} is back in stock. Order now: ${location.origin}/product/${r.productSlug}`;

  // Opens WhatsApp with the message pre-filled, then marks the row as notified
  const sendOne = async (r) => {
    window.open(`https://wa.me/${r.phone}?text=${encodeURIComponent(message(r))}`, '_blank');
    await fetch('/api/admin/notify', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: r._id }),
    });
    load();
  };

  const remove = async (id) => {
    await fetch('/api/admin/notify', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    load();
  };

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">Notify Requests</h1>
      <p className="text-sm text-gray-600 mb-6">
        After restocking a product, tap "Send on WhatsApp" for each customer. WhatsApp opens with the message ready; just press send.
      </p>
      {groups.length === 0 && <p>No requests yet.</p>}

      {groups.map((g) => {
        const waiting = g.items.filter((i) => i.status !== 'notified');
        return (
          <section key={g.productId} className="mb-8 border rounded-xl overflow-hidden">
            <header className="flex flex-wrap items-center justify-between gap-3 p-4 bg-[#F6EAF9]">
              <div>
                <h2 className="font-semibold">{g.name}</h2>
                <p className="text-sm text-gray-600">{g.items.length} request(s) · {waiting.length} waiting</p>
              </div>
              <button
                disabled={!waiting.length}
                onClick={() => sendOne(waiting[0])}
                className="px-4 py-2 rounded-full font-semibold bg-[#4B087A] text-white disabled:opacity-40"
              >
                Send to next ({waiting.length})
              </button>
            </header>

            <ul className="divide-y">
              {g.items.map((r) => (
                <li key={r._id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                  <div>
                    <b>{r.name}</b> · +{r.phone}
                    <span className={`ml-2 px-2 py-0.5 rounded text-xs ${
                      r.status === 'notified' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                      {r.status === 'notified' ? 'notified' : 'waiting'}
                    </span>
                  </div>
                  <div className="flex gap-3 items-center">
                    <button
                      onClick={() => sendOne(r)}
                      className="px-3 py-1.5 rounded-full bg-green-600 text-white font-medium"
                    >
                      {r.status === 'notified' ? 'Send again' : 'Send on WhatsApp'}
                    </button>
                    <button onClick={() => remove(r._id)} className="text-red-600">Delete</button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}