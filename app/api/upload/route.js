import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { requireAdmin } from '@/lib/apiAuth';

export const runtime = 'nodejs';

// This route NEVER receives the file. It only signs a short-lived upload URL,
// and the browser then PUTs the (already compressed) file straight to Cloudflare R2.

// Accept both names so a .env.local typo can't break uploads again.
const BUCKET = process.env.R2_BUCKET || process.env.R2_BUCKET_NAME;
const ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
// Public bucket URL: custom domain (recommended) or the r2.dev URL
const PUBLIC_URL = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: ACCESS_KEY_ID || '',
    secretAccessKey: SECRET_ACCESS_KEY || '',
  },
  // Newer AWS SDK versions add checksum params that R2 rejects on presigned URLs
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
});

// SVG is deliberately NOT allowed: it can carry scripts.
const IMAGE_TYPES = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/avif': 'avif' };
const VIDEO_TYPES = { 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' };

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

const CACHE_CONTROL = 'public, max-age=31536000, immutable';

// Folders any visitor may upload to (e.g. customer review photos).
// Everything else (products, banners, categories, reels...) needs an admin login.
// Change 'reviews' to whatever folder name your review upload uses.
const PUBLIC_FOLDERS = new Set(['reviews']);

async function signUpload(req) {
  try {
    const missing = [
      !ACCOUNT_ID && 'R2_ACCOUNT_ID',
      !ACCESS_KEY_ID && 'R2_ACCESS_KEY_ID',
      !SECRET_ACCESS_KEY && 'R2_SECRET_ACCESS_KEY',
      !BUCKET && 'R2_BUCKET',
      !PUBLIC_URL && 'R2_PUBLIC_URL',
    ].filter(Boolean);

    if (missing.length) {
      console.error('Upload config missing env vars:', missing.join(', '));
      return NextResponse.json(
        { error: `Server upload config missing: ${missing.join(', ')}` },
        { status: 500 }
      );
    }

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

const adminSign = requireAdmin(signUpload);

export async function POST(req, ctx) {
  // Peek at the folder without consuming the body the real handler needs
  let folder = '';
  try {
    const body = await req.clone().json();
    folder = String(body?.folder || '');
  } catch {}

  if (PUBLIC_FOLDERS.has(folder)) return signUpload(req);
  return adminSign(req, ctx);
}