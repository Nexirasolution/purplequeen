'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Plus, Trash2, Upload, Loader2, X } from 'lucide-react';
import { INDIAN_STATES } from '@/lib/indianStates';
import OptionGroupsEditor from '@/components/OptionGroupsEditor';
import { uploadFile } from '@/lib/uploadFile';
import { computeBasePrice } from '@/lib/pricing';
import { applyDiscount } from '@/lib/discount';
import { formatINR } from '@/lib/utils';
import { NO_SIZE } from '@/lib/noSize';

// Design tokens: same royal purple / gold / ivory system as the rest of the site.
// Palette: #4B087A #F7B900 #FFF5E8 #24052F #D9B4E8
const INK = '#24052F';          // deep purple for text
const INK_SOFT = '#6E5A7C';     // muted purple-grey for labels and hints
const PURPLE = '#4B087A';       // royal purple: headings, focus, outlines, checkboxes
const GOLD = '#F7B900';         // primary submit button
const WASH = '#F6EAF9';         // light lavender tint for upload tiles
const LINE = '#D9B4E8';         // soft lavender borders
const PAPER = '#FFF5E8';        // ivory background
const DISABLED_BG = '#EEE2F2';  // read-only / disabled field fill

function emptySize() {
  // price '' = "use the variant price"
  return { size: '', stock: 0, sku: '', price: '' };
}

function emptyVariant() {
  return {
    color: '',
    colorHex: '#4B087A',
    images: [''],
    price: '',
    compareAtPrice: '',
    sizes: [emptySize()],
  };
}

function emptyAddonOption() {
  return { name: '', image: '', price: '', stock: '', sku: '' };
}

function normalizeSizeChart(value) {
  if (Array.isArray(value)) return value;
  if (value) return [value]; // backward-compat with the old single-string field
  return [];
}

// Existing products may have sizes with no price (null/undefined): show them as blank inputs.
function normalizeVariants(variants) {
  return (variants || []).map((v) => ({
    ...v,
    sizes: (v.sizes || []).map((s) => ({ ...s, price: s.price ?? '' })),
  }));
}

// <input type="datetime-local"> needs "YYYY-MM-DDTHH:mm" in the admin's LOCAL time.
function toLocalInput(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

// Discount block as the form edits it (value kept as string so the input can be blank).
function normalizeDiscount(d) {
  return {
    isActive: !!d?.isActive,
    type: d?.type === 'flat' ? 'flat' : 'percent',
    value: Number(d?.value) > 0 ? d.value : '',
    startsAt: toLocalInput(d?.startsAt),
    endsAt: toLocalInput(d?.endsAt),
  };
}

// Admin-defined option groups. Old products only have the fixed sleeve / zip
// checkboxes, so convert those into groups the first time they are opened
// (nothing is lost; saving stores them as optionGroups).
function buildInitialOptionGroups(p) {
  if (p.optionGroups?.length) {
    return p.optionGroups.map((g) => ({
      name: g.name,
      required: g.required !== false,
      choices: (g.choices || []).map((c) => ({ label: c.label, price: c.price || '' })),
    }));
  }
  const groups = [];
  if (p.sleeveOptions?.length) {
    groups.push({
      name: 'Sleeve Type',
      required: true,
      choices: p.sleeveOptions.map((label) => ({ label, price: '' })),
    });
  }
  if (p.zipOptions?.length) {
    groups.push({
      name: 'Zip Type',
      required: true,
      choices: p.zipOptions.map((label) => ({ label, price: '' })),
    });
  }
  return groups;
}

// Shared input style
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
  marginTop: '4px',
};

const labelStyle = {
  fontSize: '12px',
  fontWeight: '500',
  color: INK_SOFT,
  fontFamily: 'sans-serif',
};

const cardStyle = {
  background: PAPER,
  border: `1px solid ${LINE}`,
  borderRadius: '6px',
  padding: '20px',
  marginBottom: '16px',
};

const sectionHeadStyle = {
  fontSize: '11px',
  fontWeight: '500',
  color: PURPLE,
  textTransform: 'uppercase',
  letterSpacing: '0.14em',
  fontFamily: 'sans-serif',
  marginBottom: '12px',
};

function ImageSlot({ value, onChange, onRemove, showRemove }) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      // Compressed to WebP in the browser, then sent straight to Cloudflare R2
      const url = await uploadFile(file, 'products');
      onChange(url);
      toast.success('Image uploaded');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  return (
    <div className="flex items-center gap-2 mb-2">
      <div
        onClick={() => !uploading && fileRef.current?.click()}
        className="shrink-0 overflow-hidden relative"
        style={{
          width: '48px',
          height: '48px',
          borderRadius: '4px',
          border: `1.5px dashed ${PURPLE}`,
          background: WASH,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        {value ? (
          <img src={value} alt="" className="w-full h-full object-cover" />
        ) : uploading ? (
          <Loader2 size={16} className="animate-spin" style={{ color: INK }} />
        ) : (
          <Upload size={14} style={{ color: PURPLE }} />
        )}
        {uploading && value && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(255,245,232,0.7)' }}>
            <Loader2 size={14} className="animate-spin" style={{ color: INK }} />
          </div>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

      <input
        placeholder="https://... or click thumbnail to upload"
        style={{ ...inputStyle, marginTop: 0, flex: 1 }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => (e.target.style.borderColor = PURPLE)}
        onBlur={(e) => (e.target.style.borderColor = LINE)}
      />

      {showRemove && (
        <button type="button" onClick={onRemove} style={{ color: INK_SOFT, flexShrink: 0 }} aria-label="Remove image">
          <X size={15} />
        </button>
      )}
    </div>
  );
}

// Reusable editor for a list of named add-on options (pants / shawls).
// Each option gets its own image, extra price (added on top of the
// variant price when a customer picks it), stock, and optional SKU.
function AddonOptionsEditor({ title, options, onAdd, onUpdate, onRemove }) {
  return (
    <div style={cardStyle}>
      <div className="flex items-center justify-between mb-3">
        <p style={{ ...sectionHeadStyle, marginBottom: 0 }}>{title}</p>
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center gap-1 text-sm font-medium px-3 py-1.5"
          style={{
            background: PAPER,
            color: PURPLE,
            border: `1px solid ${PURPLE}`,
            borderRadius: '4px',
            fontFamily: 'sans-serif',
            cursor: 'pointer',
          }}
        >
          <Plus size={14} /> Add {title.replace(/s$/, '')}
        </button>
      </div>
      <p style={{ fontSize: '12px', color: INK_SOFT, fontFamily: 'sans-serif', marginBottom: options.length ? '12px' : 0 }}>
        Leave empty if {title.toLowerCase()} don't apply to this product. The price entered is ADDED
        on top of the variant/size price when a customer selects it. Customers can also choose "None".
      </p>

      {options.map((opt, idx) => (
        <div
          key={idx}
          className="flex flex-col sm:flex-row sm:items-start gap-3 mb-3 pb-3"
          style={{ borderBottom: idx < options.length - 1 ? `1px solid ${LINE}` : 'none' }}
        >
          <ImageSlot
            value={opt.image}
            onChange={(url) => onUpdate(idx, 'image', url)}
            onRemove={() => onUpdate(idx, 'image', '')}
            showRemove={!!opt.image}
          />
          <div className="grid sm:grid-cols-4 gap-2 flex-1">
            <input
              placeholder="Name (e.g. Cotton Palazzo)"
              style={{ ...inputStyle, marginTop: 0 }}
              value={opt.name}
              onChange={(e) => onUpdate(idx, 'name', e.target.value)}
              onFocus={(e) => (e.target.style.borderColor = PURPLE)}
              onBlur={(e) => (e.target.style.borderColor = LINE)}
            />
            <input
              type="number"
              placeholder="Extra price ₹"
              style={{ ...inputStyle, marginTop: 0 }}
              value={opt.price}
              onChange={(e) => onUpdate(idx, 'price', e.target.value)}
              onFocus={(e) => (e.target.style.borderColor = PURPLE)}
              onBlur={(e) => (e.target.style.borderColor = LINE)}
            />
            <input
              type="number"
              placeholder="Stock"
              style={{ ...inputStyle, marginTop: 0 }}
              value={opt.stock}
              onChange={(e) => onUpdate(idx, 'stock', e.target.value)}
              onFocus={(e) => (e.target.style.borderColor = PURPLE)}
              onBlur={(e) => (e.target.style.borderColor = LINE)}
            />
            <input
              placeholder="SKU (optional)"
              style={{ ...inputStyle, marginTop: 0 }}
              value={opt.sku}
              onChange={(e) => onUpdate(idx, 'sku', e.target.value)}
              onFocus={(e) => (e.target.style.borderColor = PURPLE)}
              onBlur={(e) => (e.target.style.borderColor = LINE)}
            />
          </div>
          <button
            type="button"
            onClick={() => onRemove(idx)}
            style={{ color: INK_SOFT, cursor: 'pointer', flexShrink: 0, marginTop: '12px' }}
            aria-label="Remove option"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}

export default function ProductForm({ initial, productId }) {
  const router = useRouter();
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(() => {
    const base = initial || {
      name: '', slug: '', sku: '', description: '', category: '', fabric: '', tags: [], weight: '',
      variants: [emptyVariant()],
      sizeChart: [],
      optionGroups: [],
      pantOptions: [],
      shawlOptions: [],
      freeShipping: false,
      freeShippingStates: [],
      isBestSeller: false, isTopSeller: false, isActiveSeller: true, isFeatured: false, isActive: true,
      isReadyToShip: false,
    };
    return {
      ...base,
      weight: base.weight > 0 ? base.weight : '',
      variants: normalizeVariants(base.variants),
      sizeChart: normalizeSizeChart(base.sizeChart),
      optionGroups: buildInitialOptionGroups(base),
      pantOptions: (base.pantOptions || []).map((o) => ({ ...o })),
      shawlOptions: (base.shawlOptions || []).map((o) => ({ ...o })),
      freeShipping: !!base.freeShipping,
      freeShippingStates: base.freeShippingStates || [],
      discount: normalizeDiscount(base.discount),
    };
  });
  const [saving, setSaving] = useState(false);
  // 'off' | 'all' (free in every state) | 'states' (free only in the ticked states)
  const [shipMode, setShipMode] = useState(() =>
    initial?.freeShipping ? 'all' : initial?.freeShippingStates?.length ? 'states' : 'off'
  );
  const [sizeChartUploading, setSizeChartUploading] = useState(false);
  const sizeChartFileRef = useRef();

  useEffect(() => {
    fetch('/api/categories').then((r) => r.json()).then((d) => setCategories(d.categories || []));
  }, []);

  // Does the chosen category use sizes? (default true until a category is chosen / loaded)
  const selectedCategoryId = form.category?._id || form.category;
  const selectedCategory = categories.find((c) => c._id === selectedCategoryId);
  const hasSizes = selectedCategory ? selectedCategory.hasSizes !== false : true;

  function update(field, value) { setForm((f) => ({ ...f, [field]: value })); }

  function updateDiscount(key, value) {
    setForm((f) => ({ ...f, discount: { ...f.discount, [key]: value } }));
  }

  function toggleArrayValue(field, value) {
    setForm((f) => {
      const current = f[field] || [];
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      return { ...f, [field]: next };
    });
  }

  function updateVariant(idx, field, value) {
    setForm((f) => { const v = [...f.variants]; v[idx] = { ...v[idx], [field]: value }; return { ...f, variants: v }; });
  }

  function updateVariantImage(vIdx, imgIdx, value) {
    setForm((f) => {
      const variants = [...f.variants];
      const images = [...variants[vIdx].images];
      images[imgIdx] = value;
      variants[vIdx] = { ...variants[vIdx], images };
      return { ...f, variants };
    });
  }

  function removeVariantImage(vIdx, imgIdx) {
    setForm((f) => {
      const variants = [...f.variants];
      const images = variants[vIdx].images.filter((_, i) => i !== imgIdx);
      variants[vIdx] = { ...variants[vIdx], images: images.length ? images : [''] };
      return { ...f, variants };
    });
  }

  function addVariantImage(vIdx) {
    setForm((f) => {
      const variants = [...f.variants];
      variants[vIdx] = { ...variants[vIdx], images: [...variants[vIdx].images, ''] };
      return { ...f, variants };
    });
  }

  function updateSize(vIdx, sIdx, field, value) {
    setForm((f) => {
      const variants = [...f.variants];
      const sizes = [...variants[vIdx].sizes];
      sizes[sIdx] = { ...sizes[sIdx], [field]: value };
      variants[vIdx] = { ...variants[vIdx], sizes };
      return { ...f, variants };
    });
  }

  function addSize(vIdx) {
    setForm((f) => {
      const variants = [...f.variants];
      variants[vIdx] = { ...variants[vIdx], sizes: [...variants[vIdx].sizes, emptySize()] };
      return { ...f, variants };
    });
  }

  function removeSize(vIdx, sIdx) {
    setForm((f) => {
      const variants = [...f.variants];
      variants[vIdx] = { ...variants[vIdx], sizes: variants[vIdx].sizes.filter((_, i) => i !== sIdx) };
      return { ...f, variants };
    });
  }

  function addVariant() { setForm((f) => ({ ...f, variants: [...f.variants, emptyVariant()] })); }
  function removeVariant(idx) { setForm((f) => ({ ...f, variants: f.variants.filter((_, i) => i !== idx) })); }

  // Pant / Shawl option list handlers: same shape, different field name.
  function addAddonOption(field) {
    setForm((f) => ({ ...f, [field]: [...(f[field] || []), emptyAddonOption()] }));
  }
  function updateAddonOption(field, idx, key, value) {
    setForm((f) => {
      const list = [...(f[field] || [])];
      list[idx] = { ...list[idx], [key]: value };
      return { ...f, [field]: list };
    });
  }
  function removeAddonOption(field, idx) {
    setForm((f) => ({ ...f, [field]: (f[field] || []).filter((_, i) => i !== idx) }));
  }

  // Size chart: supports multiple images. Selecting several files at once
  // uploads each in turn and appends every resulting URL to the array.
  async function handleSizeChartFilesChange(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setSizeChartUploading(true);
    try {
      const uploaded = [];
      for (const file of files) {
        // Compressed to WebP in the browser, then sent straight to Cloudflare R2
        uploaded.push(await uploadFile(file, 'sizecharts'));
      }
      setForm((f) => ({ ...f, sizeChart: [...(f.sizeChart || []), ...uploaded] }));
      toast.success(`${uploaded.length} size chart image${uploaded.length > 1 ? 's' : ''} uploaded`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSizeChartUploading(false);
      e.target.value = '';
    }
  }

  function removeSizeChartImage(idx) {
    setForm((f) => ({ ...f, sizeChart: (f.sizeChart || []).filter((_, i) => i !== idx) }));
  }

  // Lowest price across all variants / sizes (same rule the server uses for basePrice),
  // used only for the discount preview below.
  const previewBasePrice = computeBasePrice(
    (form.variants || []).map((v) => ({
      ...v,
      price: Number(v.price) || 0,
      sizes: (v.sizes || []).map((s) => ({
        ...s,
        price: s.price === '' || s.price == null ? null : Number(s.price),
      })),
    }))
  );
  const discountValue = Number(form.discount?.value) || 0;
  const discountPreview =
    previewBasePrice > 0 && discountValue > 0
      ? applyDiscount(previewBasePrice, { type: form.discount.type, value: discountValue })
      : null;

  async function submit(e) {
    e.preventDefault();

    if (shipMode === 'states' && (form.freeShippingStates || []).length === 0) {
      toast.error('Select at least one state for free shipping, or choose another option');
      return;
    }

    // Sizes are only required when the category uses sizes
    if (hasSizes) {
      const missing = form.variants.findIndex(
        (v) => !(v.sizes || []).some((s) => (s.size || '').trim())
      );
      if (missing !== -1) {
        toast.error(`Variant ${missing + 1} needs at least one size`);
        return;
      }
    }

    // Discount validation (only when switched on)
    const d = form.discount || {};
    if (d.isActive) {
      if (!(Number(d.value) > 0)) {
        toast.error('Enter a discount value, or switch the discount off');
        return;
      }
      if (d.type === 'percent' && Number(d.value) > 95) {
        toast.error('Percent discount can be at most 95%');
        return;
      }
      if (d.startsAt && d.endsAt && new Date(d.endsAt) <= new Date(d.startsAt)) {
        toast.error('Discount end time must be after the start time');
        return;
      }
    }

    // Option groups: a type needs a name and at least one named choice
    const groupsToSave = (form.optionGroups || [])
      .map((g) => ({
        name: (g.name || '').trim(),
        required: g.required !== false,
        choices: (g.choices || [])
          .map((c) => ({ label: (c.label || '').trim(), price: Math.max(0, Number(c.price) || 0) }))
          .filter((c) => c.label),
      }))
      .filter((g) => g.name || g.choices.length);

    const badGroup = groupsToSave.find((g) => !g.name || g.choices.length === 0);
    if (badGroup) {
      toast.error(
        !badGroup.name
          ? 'Every customization type needs a name'
          : `"${badGroup.name}" needs at least one choice`
      );
      return;
    }

    setSaving(true);
    // Note: sku is intentionally omitted: it's auto-generated/managed server-side
    // based on the product's category (see /api/products and /api/products/[id]).
    const payload = {
      ...form,
      weight: Math.max(0, Number(form.weight) || 0), // grams, manual entry
      sizeChart: form.sizeChart || [],
      // Sleeve / zip are now regular option groups; clear the legacy fields so
      // the product page doesn't show them twice.
      sleeveOptions: [],
      zipOptions: [],
      optionGroups: groupsToSave,
      // Free shipping: everywhere, or only in the selected states
      freeShipping: shipMode === 'all',
      freeShippingStates: shipMode === 'states' ? (form.freeShippingStates || []) : [],
      // Discount section pricing. Dates are converted from the admin's local time
      // to ISO (UTC) here, so the server doesn't misread them in its own timezone.
      discount: {
        isActive: !!d.isActive,
        type: d.type === 'flat' ? 'flat' : 'percent',
        value: Number(d.value) || 0,
        startsAt: d.startsAt ? new Date(d.startsAt).toISOString() : null,
        endsAt: d.endsAt ? new Date(d.endsAt).toISOString() : null,
      },
      pantOptions: (form.pantOptions || [])
        .filter((o) => o.name?.trim())
        .map((o) => ({
          name: o.name.trim(),
          image: o.image || '',
          price: Number(o.price) || 0,
          stock: Number(o.stock) || 0,
          sku: o.sku || '',
        })),
      shawlOptions: (form.shawlOptions || [])
        .filter((o) => o.name?.trim())
        .map((o) => ({
          name: o.name.trim(),
          image: o.image || '',
          price: Number(o.price) || 0,
          stock: Number(o.stock) || 0,
          sku: o.sku || '',
        })),
      variants: form.variants.map((v) => {
        const toPrice = (p) => (p === '' || p == null ? null : Number(p));
        // No-size category: ONE hidden "One Size" entry holds the stock / price.
        // Size category: every row needs a name; blank rows are dropped.
        const sizes = hasSizes
          ? v.sizes
              .filter((s) => (s.size || '').trim())
              .map((s) => ({
                ...s,
                size: s.size.trim(),
                stock: Number(s.stock) || 0,
                // blank = use the variant price
                price: toPrice(s.price),
              }))
          : [
              {
                size: NO_SIZE,
                stock: Number(v.sizes?.[0]?.stock) || 0,
                sku: v.sizes?.[0]?.sku || '',
                price: toPrice(v.sizes?.[0]?.price),
              },
            ];

        return {
          ...v,
          price: Number(v.price),
          compareAtPrice: Number(v.compareAtPrice) || 0,
          images: v.images.filter(Boolean),
          sizes,
        };
      }),
    };
    delete payload.sku;

    const url = productId ? `/api/products/${productId}` : '/api/products';
    const method = productId ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await res.json();
    setSaving(false);
    if (res.ok) {
      toast.success(productId ? 'Product updated' : 'Product created');
      router.push('/admin/products');
    } else {
      toast.error(data.error || 'Something went wrong');
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">

      {/* Basic Info Card */}
      <div style={cardStyle}>
        <p style={sectionHeadStyle}>Product Details</p>
        <div style={{ height: '1px', background: LINE, marginBottom: '16px' }} />
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label style={labelStyle}>Product Name *</label>
            <input
              required
              style={inputStyle}
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              onFocus={(e) => (e.target.style.borderColor = PURPLE)}
              onBlur={(e) => (e.target.style.borderColor = LINE)}
            />
          </div>
          <div>
            <label style={labelStyle}>SKU</label>
            <input
              disabled
              readOnly
              style={{ ...inputStyle, background: DISABLED_BG, color: INK_SOFT, cursor: 'not-allowed' }}
              value={form.sku || 'Auto-generated from category on save'}
              title="SKU is generated automatically from the product's category"
            />
          </div>
          <div>
            <label style={labelStyle}>Category *</label>
            <select
              required
              style={inputStyle}
              value={form.category?._id || form.category}
              onChange={(e) => update('category', e.target.value)}
              onFocus={(e) => (e.target.style.borderColor = PURPLE)}
              onBlur={(e) => (e.target.style.borderColor = LINE)}
            >
              <option value="">Select category</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}{c.hasSizes === false ? ' (no sizes)' : ''}
                </option>
              ))}
            </select>
            {selectedCategory && !hasSizes && (
              <p style={{ fontSize: '11px', color: INK_SOFT, fontFamily: 'sans-serif', marginTop: '4px' }}>
                This category has no sizes: just enter one stock / price per variant below.
              </p>
            )}
          </div>
          <div>
            <label style={labelStyle}>Fabric</label>
            <input
              style={inputStyle}
              value={form.fabric}
              onChange={(e) => update('fabric', e.target.value)}
              onFocus={(e) => (e.target.style.borderColor = PURPLE)}
              onBlur={(e) => (e.target.style.borderColor = LINE)}
            />
          </div>
          <div>
            <label style={labelStyle}>Tags (comma separated)</label>
            <input
              style={inputStyle}
              value={Array.isArray(form.tags) ? form.tags.join(', ') : ''}
              onChange={(e) => update('tags', e.target.value.split(',').map((t) => t.trim()).filter(Boolean))}
              onFocus={(e) => (e.target.style.borderColor = PURPLE)}
              onBlur={(e) => (e.target.style.borderColor = LINE)}
            />
          </div>
          <div>
            <label style={labelStyle}>Weight (grams)</label>
            <input
              type="number"
              min="0"
              step="1"
              placeholder="e.g. 450 (weight of one piece)"
              style={inputStyle}
              value={form.weight ?? ''}
              onChange={(e) => update('weight', e.target.value)}
              onFocus={(e) => (e.target.style.borderColor = PURPLE)}
              onBlur={(e) => (e.target.style.borderColor = LINE)}
            />
          </div>
          <div className="sm:col-span-2">
            <label style={labelStyle}>Description</label>
            <textarea
              style={{ ...inputStyle, resize: 'vertical' }}
              rows={3}
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              onFocus={(e) => (e.target.style.borderColor = PURPLE)}
              onBlur={(e) => (e.target.style.borderColor = LINE)}
            />
          </div>

          {/* Size chart: one or more images. If left empty, the storefront
              falls back to this product's category size chart. Hidden for no-size categories. */}
          {hasSizes && (
            <div className="sm:col-span-2">
              <label style={labelStyle}>
                Size Chart <span style={{ fontWeight: '400', textTransform: 'none', letterSpacing: 0 }}>
                  (optional — shown as a gallery on the product page; falls back to the category's size chart if left empty)
                </span>
              </label>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-3 mt-2">
                {(form.sizeChart || []).map((url, idx) => (
                  <div key={idx} className="relative aspect-square overflow-hidden" style={{ borderRadius: '4px', border: `1px solid ${LINE}` }}>
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeSizeChartImage(idx)}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ background: 'rgba(36,5,47,0.7)', color: PAPER }}
                      aria-label="Remove size chart image"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  disabled={sizeChartUploading}
                  onClick={() => sizeChartFileRef.current?.click()}
                  className="aspect-square flex flex-col items-center justify-center gap-1 disabled:opacity-50"
                  style={{ borderRadius: '4px', border: `1.5px dashed ${PURPLE}`, background: WASH, color: PURPLE, cursor: 'pointer' }}
                >
                  {sizeChartUploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                  <span style={{ fontSize: '10px', fontFamily: 'sans-serif' }}>{sizeChartUploading ? 'Uploading…' : 'Add'}</span>
                </button>
              </div>
              <input ref={sizeChartFileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleSizeChartFilesChange} />
            </div>
          )}

          {/* Customization options: admin-defined types (e.g. Sleeve Type, Zip Type)
              with choices (sub-types) and an optional extra price per choice. */}
          <div className="sm:col-span-2">
            <OptionGroupsEditor
              value={form.optionGroups}
              onChange={(v) => update('optionGroups', v)}
            />
          </div>

          {/* Free shipping: whole product, or only for selected states */}
          <div className="sm:col-span-2">
            <label style={labelStyle}>Free Shipping</label>
            <div className="flex flex-wrap gap-4 mt-2">
              {[
                ['off', 'Normal shipping'],
                ['all', 'Free in all states'],
                ['states', 'Free only in selected states'],
              ].map(([val, text]) => (
                <label key={val} className="flex items-center gap-1.5 text-sm cursor-pointer" style={{ color: INK, fontFamily: 'sans-serif' }}>
                  <input
                    type="radio"
                    name="freeShippingMode"
                    checked={shipMode === val}
                    onChange={() => setShipMode(val)}
                    style={{ accentColor: PURPLE, width: '15px', height: '15px' }}
                  />
                  {text}
                </label>
              ))}
            </div>

            {shipMode === 'states' && (
              <div className="mt-3">
                <div className="flex gap-4 mb-2" style={{ fontSize: '12px', fontFamily: 'sans-serif' }}>
                  <button type="button" style={{ color: PURPLE, fontWeight: 500 }} onClick={() => update('freeShippingStates', [...INDIAN_STATES])}>
                    Select all
                  </button>
                  <button type="button" style={{ color: INK_SOFT, fontWeight: 500 }} onClick={() => update('freeShippingStates', [])}>
                    Clear
                  </button>
                  <span style={{ color: INK_SOFT }}>{(form.freeShippingStates || []).length} selected</span>
                </div>
                <div
                  className="grid sm:grid-cols-3 gap-x-4 gap-y-1.5 p-3 overflow-y-auto"
                  style={{ border: `1px solid ${LINE}`, borderRadius: '4px', maxHeight: '180px' }}
                >
                  {INDIAN_STATES.map((st) => (
                    <label key={st} className="flex items-center gap-1.5 text-sm cursor-pointer" style={{ color: INK, fontFamily: 'sans-serif' }}>
                      <input
                        type="checkbox"
                        checked={(form.freeShippingStates || []).includes(st)}
                        onChange={() => toggleArrayValue('freeShippingStates', st)}
                        style={{ accentColor: PURPLE, width: '15px', height: '15px' }}
                      />
                      {st}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <p style={{ fontSize: '11px', color: INK_SOFT, fontFamily: 'sans-serif', marginTop: '6px' }}>
              A free-shipping product adds no weight to the shipping charge. If every item in the cart ships free, shipping is ₹0.
            </p>
          </div>

          {/* Toggles */}
          <div className="sm:col-span-2 flex flex-wrap gap-4">
            {[
              ['isBestSeller', 'Bestseller'],
              ['isTopSeller', 'Top Seller'],
              ['isActiveSeller', 'Active Seller'],
              ['isFeatured', 'Featured'],
              ['isActive', 'Active (visible on site)'],
              ['isReadyToShip', 'Ready to Ship'],
            ].map(([key, label]) => (
              <label
                key={key}
                className="flex items-center gap-2 text-sm cursor-pointer"
                style={{ color: INK_SOFT, fontFamily: 'sans-serif' }}
              >
                <input
                  type="checkbox"
                  checked={!!form[key]}
                  onChange={(e) => update(key, e.target.checked)}
                  style={{ accentColor: PURPLE, width: '15px', height: '15px' }}
                />
                {label}
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Variants Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 style={{ ...sectionHeadStyle, marginBottom: 0 }}>Variants</h2>
          <button
            type="button"
            onClick={addVariant}
            className="flex items-center gap-1 text-sm font-medium px-4 py-2 transition-colors"
            style={{
              background: PAPER,
              color: PURPLE,
              border: `1px solid ${PURPLE}`,
              borderRadius: '4px',
              fontFamily: 'sans-serif',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = PURPLE;
              e.currentTarget.style.color = PAPER;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = PAPER;
              e.currentTarget.style.color = PURPLE;
            }}
          >
            <Plus size={16} /> Add Variant
          </button>
        </div>

        {form.variants.map((v, vIdx) => (
          <div key={vIdx} style={cardStyle}>
            {/* Variant header */}
            <div
              className="flex justify-between items-center mb-3 pb-2"
              style={{ borderBottom: `1px solid ${LINE}` }}
            >
              <span style={{ fontWeight: '500', fontSize: '13px', color: INK, fontFamily: 'sans-serif' }}>
                Variant {vIdx + 1}
              </span>
              {form.variants.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeVariant(vIdx)}
                  style={{ color: INK_SOFT, cursor: 'pointer' }}
                  aria-label="Remove variant"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>

            <div className="grid sm:grid-cols-4 gap-3 mb-3">
              <input
                placeholder="Color name (e.g. Green)"
                style={inputStyle}
                value={v.color}
                onChange={(e) => updateVariant(vIdx, 'color', e.target.value)}
                onFocus={(e) => (e.target.style.borderColor = PURPLE)}
                onBlur={(e) => (e.target.style.borderColor = LINE)}
              />
              <input
                type="color"
                style={{ ...inputStyle, padding: '4px', height: '40px' }}
                value={v.colorHex}
                onChange={(e) => updateVariant(vIdx, 'colorHex', e.target.value)}
              />
              <input
                placeholder="Default price ₹"
                type="number"
                style={inputStyle}
                value={v.price}
                onChange={(e) => updateVariant(vIdx, 'price', e.target.value)}
                onFocus={(e) => (e.target.style.borderColor = PURPLE)}
                onBlur={(e) => (e.target.style.borderColor = LINE)}
              />
              <input
                placeholder="Compare-at price ₹"
                type="number"
                style={inputStyle}
                value={v.compareAtPrice}
                onChange={(e) => updateVariant(vIdx, 'compareAtPrice', e.target.value)}
                onFocus={(e) => (e.target.style.borderColor = PURPLE)}
                onBlur={(e) => (e.target.style.borderColor = LINE)}
              />
            </div>

            <p style={{ fontSize: '12px', color: INK_SOFT, fontFamily: 'sans-serif', marginBottom: '8px', fontWeight: '500' }}>
              Images for this colour — click thumbnail to upload
            </p>
            {v.images.map((img, imgIdx) => (
              <ImageSlot
                key={imgIdx}
                value={img}
                onChange={(url) => updateVariantImage(vIdx, imgIdx, url)}
                onRemove={() => removeVariantImage(vIdx, imgIdx)}
                showRemove={v.images.length > 1}
              />
            ))}
            <button
              type="button"
              onClick={() => addVariantImage(vIdx)}
              style={{ fontSize: '12px', color: PURPLE, fontFamily: 'sans-serif', fontWeight: '500', marginBottom: '12px', cursor: 'pointer' }}
            >
              + Add another image
            </button>

            {hasSizes ? (
              <>
                <p style={{ fontSize: '12px', color: INK_SOFT, fontFamily: 'sans-serif', fontWeight: '500', marginBottom: '2px' }}>
                  Sizes, Stock &amp; Price
                </p>
                <p style={{ fontSize: '11px', color: INK_SOFT, fontFamily: 'sans-serif', marginBottom: '8px' }}>
                  Leave a size's price blank to use the default price above. Customers see each size's price on the product page.
                </p>
                {v.sizes.map((s, sIdx) => (
                  <div key={sIdx} className="flex flex-wrap gap-2 mb-2 items-center">
                    <input
                      placeholder="Size (e.g. M, 38, Free Size)"
                      style={{ ...inputStyle, width: '140px', marginTop: 0 }}
                      value={s.size}
                      onChange={(e) => updateSize(vIdx, sIdx, 'size', e.target.value)}
                      onFocus={(e) => (e.target.style.borderColor = PURPLE)}
                      onBlur={(e) => (e.target.style.borderColor = LINE)}
                    />
                    <input
                      type="number"
                      placeholder="Stock"
                      style={{ ...inputStyle, width: '90px', marginTop: 0 }}
                      value={s.stock}
                      onChange={(e) => updateSize(vIdx, sIdx, 'stock', e.target.value)}
                      onFocus={(e) => (e.target.style.borderColor = PURPLE)}
                      onBlur={(e) => (e.target.style.borderColor = LINE)}
                    />
                    <input
                      type="number"
                      min="0"
                      placeholder="Price ₹ (optional)"
                      style={{ ...inputStyle, width: '140px', marginTop: 0 }}
                      value={s.price ?? ''}
                      onChange={(e) => updateSize(vIdx, sIdx, 'price', e.target.value)}
                      onFocus={(e) => (e.target.style.borderColor = PURPLE)}
                      onBlur={(e) => (e.target.style.borderColor = LINE)}
                    />
                    <input
                      placeholder="SKU (optional)"
                      style={{ ...inputStyle, flex: 1, minWidth: '120px', marginTop: 0 }}
                      value={s.sku}
                      onChange={(e) => updateSize(vIdx, sIdx, 'sku', e.target.value)}
                      onFocus={(e) => (e.target.style.borderColor = PURPLE)}
                      onBlur={(e) => (e.target.style.borderColor = LINE)}
                    />
                    <button
                      type="button"
                      onClick={() => removeSize(vIdx, sIdx)}
                      style={{ color: INK_SOFT, cursor: 'pointer', flexShrink: 0 }}
                      aria-label="Remove size"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addSize(vIdx)}
                  style={{ fontSize: '12px', color: PURPLE, fontFamily: 'sans-serif', fontWeight: '500', cursor: 'pointer' }}
                >
                  + Add size
                </button>
              </>
            ) : (
              <>
                {/* No-size category: one stock / price row, no size name */}
                <p style={{ fontSize: '12px', color: INK_SOFT, fontFamily: 'sans-serif', fontWeight: '500', marginBottom: '2px' }}>
                  Stock &amp; Price
                </p>
                <p style={{ fontSize: '11px', color: INK_SOFT, fontFamily: 'sans-serif', marginBottom: '8px' }}>
                  This category has no sizes. Leave the price blank to use the default price above.
                </p>
                <div className="flex flex-wrap gap-2 mb-2 items-center">
                  <input
                    type="number"
                    min="0"
                    placeholder="Stock"
                    style={{ ...inputStyle, width: '110px', marginTop: 0 }}
                    value={v.sizes?.[0]?.stock ?? 0}
                    onChange={(e) => updateSize(vIdx, 0, 'stock', e.target.value)}
                    onFocus={(e) => (e.target.style.borderColor = PURPLE)}
                    onBlur={(e) => (e.target.style.borderColor = LINE)}
                  />
                  <input
                    type="number"
                    min="0"
                    placeholder="Price ₹ (optional)"
                    style={{ ...inputStyle, width: '150px', marginTop: 0 }}
                    value={v.sizes?.[0]?.price ?? ''}
                    onChange={(e) => updateSize(vIdx, 0, 'price', e.target.value)}
                    onFocus={(e) => (e.target.style.borderColor = PURPLE)}
                    onBlur={(e) => (e.target.style.borderColor = LINE)}
                  />
                  <input
                    placeholder="SKU (optional)"
                    style={{ ...inputStyle, flex: 1, minWidth: '120px', marginTop: 0 }}
                    value={v.sizes?.[0]?.sku ?? ''}
                    onChange={(e) => updateSize(vIdx, 0, 'sku', e.target.value)}
                    onFocus={(e) => (e.target.style.borderColor = PURPLE)}
                    onBlur={(e) => (e.target.style.borderColor = LINE)}
                  />
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Discount: the offer price is used ONLY when a customer buys this product
          from the Discounts section. Product pages and category pages keep showing
          the original price. Stock is the same stock entered above. */}
      <div style={cardStyle}>
        <div className="flex items-center justify-between mb-3">
          <p style={{ ...sectionHeadStyle, marginBottom: 0 }}>Discount</p>
          <label
            className="flex items-center gap-2 text-sm cursor-pointer"
            style={{ color: INK, fontFamily: 'sans-serif' }}
          >
            <input
              type="checkbox"
              checked={!!form.discount?.isActive}
              onChange={(e) => updateDiscount('isActive', e.target.checked)}
              style={{ accentColor: PURPLE, width: '15px', height: '15px' }}
            />
            Show in Discounts section
          </label>
        </div>
        <p style={{ fontSize: '12px', color: INK_SOFT, fontFamily: 'sans-serif', marginBottom: form.discount?.isActive ? '12px' : 0 }}>
          When on, this product also appears on the Discounts page with the offer price. The same product still sells
          at the original price everywhere else, from the same stock.
        </p>

        {form.discount?.isActive && (
          <>
            <div className="grid sm:grid-cols-4 gap-3">
              <div>
                <label style={labelStyle}>Discount type</label>
                <select
                  style={inputStyle}
                  value={form.discount.type}
                  onChange={(e) => updateDiscount('type', e.target.value)}
                  onFocus={(e) => (e.target.style.borderColor = PURPLE)}
                  onBlur={(e) => (e.target.style.borderColor = LINE)}
                >
                  <option value="percent">Percent (% off)</option>
                  <option value="flat">Flat (₹ off)</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>{form.discount.type === 'percent' ? 'Percent off' : 'Rupees off'}</label>
                <input
                  type="number"
                  min="0"
                  placeholder={form.discount.type === 'percent' ? 'e.g. 20' : 'e.g. 150'}
                  style={inputStyle}
                  value={form.discount.value}
                  onChange={(e) => updateDiscount('value', e.target.value)}
                  onFocus={(e) => (e.target.style.borderColor = PURPLE)}
                  onBlur={(e) => (e.target.style.borderColor = LINE)}
                />
              </div>
              <div>
                <label style={labelStyle}>Starts (optional)</label>
                <input
                  type="datetime-local"
                  style={inputStyle}
                  value={form.discount.startsAt}
                  onChange={(e) => updateDiscount('startsAt', e.target.value)}
                  onFocus={(e) => (e.target.style.borderColor = PURPLE)}
                  onBlur={(e) => (e.target.style.borderColor = LINE)}
                />
              </div>
              <div>
                <label style={labelStyle}>Ends (optional)</label>
                <input
                  type="datetime-local"
                  style={inputStyle}
                  value={form.discount.endsAt}
                  onChange={(e) => updateDiscount('endsAt', e.target.value)}
                  onFocus={(e) => (e.target.style.borderColor = PURPLE)}
                  onBlur={(e) => (e.target.style.borderColor = LINE)}
                />
              </div>
            </div>

            {discountPreview != null && (
              <p style={{ fontSize: '13px', color: INK, fontFamily: 'sans-serif', marginTop: '12px' }}>
                Lowest price: {formatINR(previewBasePrice)} →{' '}
                <b style={{ color: PURPLE }}>{formatINR(discountPreview)}</b> in the Discounts section
              </p>
            )}
            <p style={{ fontSize: '11px', color: INK_SOFT, fontFamily: 'sans-serif', marginTop: '6px' }}>
              The discount applies to the size/variant price only. Pant, shawl and customization extras are charged in full.
              Leave start and end empty to run it until you switch it off.
            </p>
          </>
        )}
      </div>

      {/* Pant Options: optional, product-level, admin can add any number */}
      <AddonOptionsEditor
        title="Pant Options"
        options={form.pantOptions}
        onAdd={() => addAddonOption('pantOptions')}
        onUpdate={(idx, key, value) => updateAddonOption('pantOptions', idx, key, value)}
        onRemove={(idx) => removeAddonOption('pantOptions', idx)}
      />

      {/* Shawl Options: optional, product-level, admin can add any number */}
      <AddonOptionsEditor
        title="Shawl Options"
        options={form.shawlOptions}
        onAdd={() => addAddonOption('shawlOptions')}
        onUpdate={(idx, key, value) => updateAddonOption('shawlOptions', idx, key, value)}
        onRemove={(idx) => removeAddonOption('shawlOptions', idx)}
      />

      {/* Submit button */}
      <button
        disabled={saving}
        className="w-full sm:w-auto px-8 py-3 font-semibold text-sm transition-opacity"
        style={{
          background: GOLD,
          color: INK,
          border: 'none',
          borderRadius: '4px',
          fontFamily: 'sans-serif',
          fontSize: '14px',
          letterSpacing: '0.02em',
          cursor: saving ? 'not-allowed' : 'pointer',
          opacity: saving ? 0.6 : 1,
        }}
      >
        {saving ? 'Saving...' : productId ? 'Update Product' : 'Create Product'}
      </button>
    </form>
  );
}