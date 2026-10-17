// Client-side upload helper (use only in 'use client' components).
//
//   const url = await uploadFile(file, 'products', (pct) => setProgress(pct));
//
// Images are resized + converted to WebP IN THE BROWSER, then uploaded straight
// to Cloudflare R2 with a signed URL. Videos are uploaded as they are.
// Returns the public URL to save in the database (same value the old API returned as `url`).

const MAX_IMAGE_WIDTH = 1600;
const WEBP_QUALITY = 0.8;

// Same processing sharp did: apply EXIF orientation, downscale only, convert to WebP.
async function compressImage(file) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('This image format is not supported. Please use JPG, PNG or WebP.');
  }

  const scale = Math.min(1, MAX_IMAGE_WIDTH / bitmap.width);
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const toBlob = (type, q) => new Promise((resolve) => canvas.toBlob(resolve, type, q));

  // Old Safari can't encode WebP and silently returns PNG, so fall back to JPEG.
  let blob = await toBlob('image/webp', WEBP_QUALITY);
  if (!blob || blob.type !== 'image/webp') blob = await toBlob('image/jpeg', WEBP_QUALITY);
  if (!blob) throw new Error('Could not process the image.');

  // Never make a small, untouched file bigger
  if (scale === 1 && blob.size >= file.size && ['image/webp', 'image/jpeg'].includes(file.type)) {
    return file;
  }
  return blob;
}

function putToR2(uploadUrl, body, headers, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`));
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(body);
  });
}

export async function uploadFile(file, folder = 'uploads', onProgress) {
  const isImage = file.type.startsWith('image/');
  const body = isImage ? await compressImage(file) : file;
  const contentType = body.type || file.type;

  // 1. Ask our API for a signed URL (tiny JSON request, no file)
  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contentType, size: body.size, folder }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Upload failed');

  // 2. Send the file straight to Cloudflare R2
  await putToR2(data.uploadUrl, body, data.headers, onProgress);

  return data.url;
}