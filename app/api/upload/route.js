import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';

// This route NEVER receives the file. It only signs a short-lived upload URL,
// and the browser then PUTs the (already compressed) file straight to Cloudflare R2.
// Vercel only handles a tiny JSON request, so there is no 4.5 MB body limit,
// no sharp, and almost no function time.

// Cloudflare R2 is S3-compatible.
const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.R2_BUCKET;
// Public bucket URL: custom domain (recommended) or the r2.dev URL, e.g. https://cdn.example.com
const PUBLIC_URL = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');

// SVG is deliberately NOT allowed: it can carry scripts.
// Images are compressed to WebP in the browser (JPEG only as a fallback).
const IMAGE_TYPES = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/avif': 'avif' };
const VIDEO_TYPES = { 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' };

// Limits are enforced by the signed URL (Content-Length is part of the signature).
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;   // compressed images are usually 100-400 KB
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

const CACHE_CONTROL = 'public, max-age=31536000, immutable';

export async function POST(req) {
  // TODO (recommended): if only admins should upload, verify the lb_admin_token
  // cookie here the same way app/admin/layout.js does, and return 401 if invalid.
  // If review photos must stay public, add a Vercel Firewall rate-limit rule on /api/upload.

  try {
    const { contentType, size, folder: rawFolder } = await req.json();

    const ext = IMAGE_TYPES[contentType] || VIDEO_TYPES[contentType];
    if (!ext) {
      return NextResponse.json({ error: 'Unsupported file type' }, { status: 415 });
    }

    const bytes = Number(size);
    const maxBytes = IMAGE_TYPES[contentType] ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
    if (!Number.isFinite(bytes) || bytes <= 0) {
      return NextResponse.json({ error: 'Invalid file size' }, { status: 400 });
    }
    if (bytes > maxBytes) {
      return NextResponse.json({ error: 'File too large' }, { status: 413 });
    }

    // Flat folder names only (no slashes or "..")
    const folder = /^[a-z0-9_-]{1,40}$/i.test(String(rawFolder || '')) ? rawFolder : 'uploads';

    // Unique name, never taken from the user's file name
    const key = `${folder}/${randomUUID()}.${ext}`;

    const uploadUrl = await getSignedUrl(
      r2,
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        ContentType: contentType,
        ContentLength: bytes,
        CacheControl: CACHE_CONTROL,
      }),
      { expiresIn: 300 } // 5 minutes
    );

    return NextResponse.json({
      uploadUrl,
      url: `${PUBLIC_URL}/${key}`, // save this in the database
      // The browser must send exactly these headers on the PUT
      headers: { 'Content-Type': contentType, 'Cache-Control': CACHE_CONTROL },
    });
  } catch (err) {
    console.error('Upload sign failed:', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}