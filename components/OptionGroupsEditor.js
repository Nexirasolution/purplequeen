'use client';

import { Plus, Trash2, X } from 'lucide-react';

// Same royal purple / gold / ivory tokens as ProductForm.
const INK = '#24052F';
const INK_SOFT = '#6E5A7C';
const PURPLE = '#4B087A';
const WASH = '#F6EAF9';
const LINE = '#D9B4E8';
const PAPER = '#FFF5E8';

const inputStyle = {
  border: `1px solid ${LINE}`,
  borderRadius: '4px',
  padding: '8px 12px',
  fontSize: '14px',
  fontFamily: 'sans-serif',
  color: INK,
  background: PAPER,
  width: '100%',
  outline: 'none',
};

const smallBtn = {
  background: PAPER,
  color: PURPLE,
  border: `1px solid ${PURPLE}`,
  borderRadius: '4px',
  fontFamily: 'sans-serif',
  cursor: 'pointer',
};

const PRESETS = [
  { name: 'Sleeve Type', choices: ['Full Sleeve', 'Half Sleeve', 'Elbow Sleeve', 'Sleeveless'] },
  { name: 'Zip Type', choices: ['With Zip', 'Without Zip'] },
];

const focusOn = (e) => (e.target.style.borderColor = PURPLE);
const focusOff = (e) => (e.target.style.borderColor = LINE);

// value: [{ name, required, choices: [{ label, price }] }]
export default function OptionGroupsEditor({ value, onChange }) {
  const groups = value || [];

  const updateGroup = (gi, patch) =>
    onChange(groups.map((g, i) => (i === gi ? { ...g, ...patch } : g)));

  const removeGroup = (gi) => onChange(groups.filter((_, i) => i !== gi));

  const addGroup = (preset) =>
    onChange([
      ...groups,
      preset
        ? {
            name: preset.name,
            required: true,
            choices: preset.choices.map((label) => ({ label, price: '' })),
          }
        : { name: '', required: true, choices: [{ label: '', price: '' }] },
    ]);

  const updateChoice = (gi, ci, patch) =>
    updateGroup(gi, {
      choices: groups[gi].choices.map((c, i) => (i === ci ? { ...c, ...patch } : c)),
    });

  const addChoice = (gi) =>
    updateGroup(gi, { choices: [...groups[gi].choices, { label: '', price: '' }] });

  const removeChoice = (gi, ci) =>
    updateGroup(gi, { choices: groups[gi].choices.filter((_, i) => i !== ci) });

  const hasGroup = (name) => groups.some((g) => g.name.trim().toLowerCase() === name.toLowerCase());

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <label style={{ fontSize: '12px', fontWeight: 500, color: INK_SOFT, fontFamily: 'sans-serif' }}>
          Customization Options{' '}
          <span style={{ fontWeight: 400 }}>
            (optional — e.g. Sleeve Type, Zip Type, Neck Style)
          </span>
        </label>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.name}
              type="button"
              disabled={hasGroup(p.name)}
              onClick={() => addGroup(p)}
              className="text-xs px-2.5 py-1 disabled:opacity-40 disabled:cursor-not-allowed"
              style={smallBtn}
            >
              + {p.name}
            </button>
          ))}
          <button
            type="button"
            onClick={() => addGroup(null)}
            className="flex items-center gap-1 text-xs px-2.5 py-1"
            style={smallBtn}
          >
            <Plus size={12} /> New type
          </button>
        </div>
      </div>

      <p style={{ fontSize: '11px', color: INK_SOFT, fontFamily: 'sans-serif', marginBottom: '10px' }}>
        Each type has choices (sub-types). The price on a choice is ADDED to the product price when the
        customer picks it. Leave it blank for no extra charge.
      </p>

      {groups.map((g, gi) => (
        <div
          key={gi}
          className="mb-3 p-3"
          style={{ border: `1px solid ${LINE}`, borderRadius: '6px', background: WASH }}
        >
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <input
              placeholder="Type name (e.g. Sleeve Type)"
              style={{ ...inputStyle, flex: 1, minWidth: '180px' }}
              value={g.name}
              onChange={(e) => updateGroup(gi, { name: e.target.value })}
              onFocus={focusOn}
              onBlur={focusOff}
            />
            <label
              className="flex items-center gap-1.5 text-sm cursor-pointer"
              style={{ color: INK, fontFamily: 'sans-serif' }}
            >
              <input
                type="checkbox"
                checked={g.required !== false}
                onChange={(e) => updateGroup(gi, { required: e.target.checked })}
                style={{ accentColor: PURPLE, width: '15px', height: '15px' }}
              />
              Customer must choose
            </label>
            <button
              type="button"
              onClick={() => removeGroup(gi)}
              style={{ color: INK_SOFT, cursor: 'pointer' }}
              aria-label="Remove type"
            >
              <Trash2 size={16} />
            </button>
          </div>

          {g.choices.map((c, ci) => (
            <div key={ci} className="flex items-center gap-2 mb-2 pl-3" style={{ borderLeft: `2px solid ${PURPLE}` }}>
              <input
                placeholder="Choice (e.g. Full Sleeve)"
                style={{ ...inputStyle, flex: 1 }}
                value={c.label}
                onChange={(e) => updateChoice(gi, ci, { label: e.target.value })}
                onFocus={focusOn}
                onBlur={focusOff}
              />
              <input
                type="number"
                min="0"
                placeholder="Extra ₹"
                style={{ ...inputStyle, width: '110px' }}
                value={c.price ?? ''}
                onChange={(e) => updateChoice(gi, ci, { price: e.target.value })}
                onFocus={focusOn}
                onBlur={focusOff}
              />
              <button
                type="button"
                onClick={() => removeChoice(gi, ci)}
                disabled={g.choices.length === 1}
                style={{ color: INK_SOFT, cursor: 'pointer' }}
                className="disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="Remove choice"
              >
                <X size={15} />
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={() => addChoice(gi)}
            style={{ fontSize: '12px', color: PURPLE, fontFamily: 'sans-serif', fontWeight: 500, cursor: 'pointer' }}
          >
            + Add choice
          </button>
        </div>
      ))}
    </div>
  );
}