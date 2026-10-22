'use client';

import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Trash2, X, Upload, Loader2, Pencil } from 'lucide-react';

const emptyForm = {
  title: '', subtitle: '', image: '', mobileImage: '', link: '',
  buttonText: 'Shop Now', sortOrder: 0, isActive: true,
};

// Must match what /api/upload accepts (SVG and GIF are rejected by the server)
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const MAX_BYTES = 8 * 1024 * 1024;

export default function AdminBannersPage() {
  const [banners, setBanners] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState('');
  const [editingId, setEditingId] = useState(null);
  const fileRef = useRef();

  async function load() {
    try {
      const res = await fetch('/api/banners?all=true');
      const data = await res.json();
      setBanners(data.banners || []);
    } catch {
      toast.error('Failed to load banners');
    }
  }
  useEffect(() => { load(); }, []);

  async function handleFileChange(e) {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('Use a JPG, PNG, WebP or AVIF image');
      input.value = '';
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error('Image must be under 8 MB');
      input.value = '';
      return;
    }

    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);
    setUploading(true);

    try {
      // 1. Ask the server for a short-lived signed upload URL
      const signRes = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentType: file.type,
          size: file.size,
          folder: 'banners',
        }),
      });
      const signData = await signRes.json();
      if (!signRes.ok) throw new Error(signData.error || 'Could not start upload');

      // 2. PUT the file straight to R2 with exactly the headers the server signed
      const putRes = await fetch(signData.uploadUrl, {
        method: 'PUT',
        headers: signData.headers,
        body: file,
      });
      if (!putRes.ok) throw new Error('Upload to storage failed');

      // 3. Save the public URL in the form; switch preview to the hosted image
      setForm((f) => ({ ...f, image: signData.url, mobileImage: '' }));
      setPreview(signData.url);
      toast.success('Image uploaded');
    } catch (err) {
      toast.error(err.message || 'Upload failed');
      setPreview('');
      setForm((f) => ({ ...f, image: '' }));
    } finally {
      setUploading(false);
      URL.revokeObjectURL(localUrl);
      input.value = ''; // allows re-picking the same file
    }
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setPreview('');
    setShowForm(true);
  }

  function openEdit(b) {
    setEditingId(b._id);
    setForm({
      title: b.title || '',
      subtitle: b.subtitle || '',
      image: b.image || '',
      mobileImage: '', // single image now – clear any old mobile image
      link: b.link || '',
      buttonText: b.buttonText || 'Shop Now',
      sortOrder: b.sortOrder ?? 0,
      isActive: b.isActive ?? true,
    });
    setPreview(b.image || '');
    setShowForm(true);
  }

  async function submit(e) {
    e.preventDefault();
    if (uploading) return;
    if (!form.image) { toast.error('Please upload an image'); return; }

    const isEditing = Boolean(editingId);
    try {
      const res = await fetch(
        isEditing ? `/api/banners/${editingId}` : '/api/banners',
        {
          method: isEditing ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        }
      );

      if (res.ok) {
        toast.success(isEditing ? 'Banner updated' : 'Banner added');
        closeForm();
        load();
      } else {
        toast.error(isEditing ? 'Failed to update banner' : 'Failed to add banner');
      }
    } catch {
      toast.error('Network error. Please try again.');
    }
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    setPreview('');
  }

  async function toggleActive(b) {
    try {
      await fetch(`/api/banners/${b._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !b.isActive }),
      });
      load();
    } catch {
      toast.error('Failed to update banner');
    }
  }

  async function remove(id) {
    if (!confirm('Delete this banner?')) return;
    try {
      await fetch(`/api/banners/${id}`, { method: 'DELETE' });
      load();
    } catch {
      toast.error('Failed to delete banner');
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-display text-2xl font-bold text-brand-magenta">Homepage Banners</h1>
        <button onClick={openCreate} className="btn-primary flex items-center gap-1 text-sm">
          <Plus size={16} /> Add Banner
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="card-soft p-5 mb-6 space-y-3">
          <div className="flex justify-between">
            <h2 className="font-semibold">{editingId ? 'Edit Banner' : 'New Banner'}</h2>
            <button type="button" onClick={closeForm}><X size={18} /></button>
          </div>

          {/* Banner image upload (used on desktop AND mobile) */}
          <div>
            <p className="text-xs font-medium text-brand-ink/60 mb-1">Banner Image (required)</p>
            <div
              onClick={() => !uploading && fileRef.current?.click()}
              className="w-full h-36 border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-brand-magenta transition-colors overflow-hidden relative"
            >
              {preview ? (
                <img src={preview} alt="banner preview" className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center gap-1 text-brand-ink/40 text-sm">
                  <Upload size={24} />
                  <span>Click to choose image</span>
                </div>
              )}
              {uploading && (
                <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                  <Loader2 size={24} className="animate-spin text-brand-magenta" />
                </div>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              className="hidden"
              onChange={handleFileChange}
            />
            <p className="text-xs text-brand-ink/40 mt-1">
              Recommended: wide crop, ~2.4:1 ratio, up to 8 MB (JPG, PNG, WebP, AVIF). Keep the main subject/text in the center — it will be auto-cropped to fit mobile screens.
            </p>
          </div>

          {editingId && (
            <p className="text-xs text-brand-ink/50">Click the image to replace it, or leave it as is.</p>
          )}

          <input placeholder="Title" className="w-full border rounded-lg px-3 py-2 text-sm" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <input placeholder="Subtitle" className="w-full border rounded-lg px-3 py-2 text-sm" value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} />
          <input placeholder="Link (e.g. /category/umbrella-kurtis)" className="w-full border rounded-lg px-3 py-2 text-sm" value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} />
          <input placeholder="Button text" className="w-full border rounded-lg px-3 py-2 text-sm" value={form.buttonText} onChange={(e) => setForm({ ...form, buttonText: e.target.value })} />
          <input type="number" placeholder="Sort order" className="w-full border rounded-lg px-3 py-2 text-sm" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} />

          <label className="text-sm flex items-center gap-2">
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Active
          </label>

          <button className="btn-primary text-sm" disabled={uploading}>
            {uploading ? 'Uploading…' : editingId ? 'Save Changes' : 'Create'}
          </button>
        </form>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        {banners.map((b) => (
          <div key={b._id} className="card-soft overflow-hidden">
            <div className="h-32">
              <img src={b.image} alt={b.title} className="w-full h-full object-cover" />
            </div>
            <div className="p-3 flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">{b.title || '(no title)'}</p>
                <p className="text-xs text-brand-ink/50">Order: {b.sortOrder}</p>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs flex items-center gap-1">
                  <input type="checkbox" checked={b.isActive} onChange={() => toggleActive(b)} /> Active
                </label>
                <button onClick={() => openEdit(b)} className="text-brand-ink/60 hover:text-brand-magenta"><Pencil size={16} /></button>
                <button onClick={() => remove(b._id)} className="text-brand-magenta"><Trash2 size={16} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}