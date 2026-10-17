// Admin-defined customization options, e.g.
//   { name: 'Sleeve Type', required: true, choices: [{ label: 'Full Sleeve', price: 0 }, { label: 'Elbow Sleeve', price: 50 }] }
// A choice's `price` is an EXTRA amount added on top of the product price.

const MAX_GROUPS = 10;
const MAX_CHOICES = 30;

// Cleans whatever the admin form sends (also used by the bulk route).
export function sanitizeOptionGroups(input) {
  if (!Array.isArray(input)) return [];

  const groups = [];
  const seenGroups = new Set();

  for (const g of input.slice(0, MAX_GROUPS)) {
    const name = String(g?.name || '').trim().slice(0, 60);
    if (!name || seenGroups.has(name.toLowerCase())) continue;

    const seenChoices = new Set();
    const choices = [];
    for (const c of (Array.isArray(g.choices) ? g.choices : []).slice(0, MAX_CHOICES)) {
      const label = String(c?.label || '').trim().slice(0, 60);
      if (!label || seenChoices.has(label.toLowerCase())) continue;
      seenChoices.add(label.toLowerCase());
      choices.push({ label, price: Math.max(0, Number(c.price) || 0) });
    }
    if (choices.length === 0) continue; // a group with no choices is dropped

    seenGroups.add(name.toLowerCase());
    groups.push({ name, required: g.required !== false, choices });
  }

  return groups;
}

// Validates the customer's picks against the PRODUCT's groups and returns the
// trusted selections + extra price. Prices always come from the database,
// never from the client.
//   picks: [{ group: 'Sleeve Type', choice: 'Full Sleeve' }, ...]
// Returns { selections, extra } or { error: 'message' }.
export function resolveCustomSelections(product, picks) {
  const groups = product.optionGroups || [];
  if (groups.length === 0) return { selections: [], extra: 0 };

  const pickMap = new Map();
  for (const p of Array.isArray(picks) ? picks : []) {
    if (p?.group) pickMap.set(String(p.group), String(p.choice || ''));
  }

  const selections = [];
  let extra = 0;

  for (const g of groups) {
    const chosen = pickMap.get(g.name);
    if (!chosen) {
      if (g.required) return { error: `please select ${g.name}` };
      continue;
    }
    const choice = (g.choices || []).find((c) => c.label === chosen);
    if (!choice) return { error: `selected ${g.name} is no longer available` };

    const price = Number(choice.price) || 0;
    selections.push({ group: g.name, choice: choice.label, price });
    extra += price;
  }

  return { selections, extra };
}