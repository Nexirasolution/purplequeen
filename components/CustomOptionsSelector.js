'use client';

// Same purple / gold / ivory tokens as the product page.
const INK = '#24052F';
const INK_SOFT = '#7A6685';
const PURPLE = '#4B087A';
const LINE = '#D9B4E8';
const PAPER = '#FFF5E8';
const WASH = '#F3E6F8';

// groups: product.optionGroups
// picks:  { [groupName]: choiceLabel }
// onPick(groupName, choiceLabelOrEmpty)
export default function CustomOptionsSelector({ groups, picks, onPick, formatINR }) {
  if (!groups?.length) return null;

  return (
    <div className="mt-4 sm:mt-6 space-y-4">
      {groups.map((g) => {
        const selected = picks[g.name] || '';
        return (
          <div key={g.name}>
            <p className="text-sm mb-2" style={{ color: INK_SOFT }}>
              {g.name}
              {g.required !== false && <span style={{ color: PURPLE }}> *</span>}
              {selected && <span style={{ color: INK }}> — {selected}</span>}
            </p>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={g.name}>
              {g.choices.map((c) => {
                const active = selected === c.label;
                return (
                  <button
                    key={c.label}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => onPick(g.name, active && g.required === false ? '' : c.label)}
                    className="px-3.5 py-2 text-sm transition-colors"
                    style={{
                      borderRadius: '4px',
                      border: `1px solid ${active ? PURPLE : LINE}`,
                      background: active ? PURPLE : PAPER,
                      color: active ? PAPER : INK,
                    }}
                  >
                    {c.label}
                    {c.price > 0 && (
                      <span className="ml-1.5 text-xs" style={{ opacity: active ? 0.85 : 0.65 }}>
                        +{formatINR(c.price)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}