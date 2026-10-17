import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import sharp from 'sharp';

export const runtime = 'nodejs';

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
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);
const VIDEO_TYPES = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
};

// Vercel rejects request bodies over 4.5 MB before this code runs.
// Larger files need a direct-to-R2 (presigned URL) upload instead.
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_VIDEO_BYTES = 4 * 1024 * 1024;

const MAX_IMAGE_WIDTH = 1600;

export async function POST(req) {
  // TODO (recommended): if only admins should upload, verify the lb_admin_token
  // cookie here the same way app/admin/layout.js does, and return 401 if invalid.
  // If review photos must stay public, add a Vercel Firewall rate-limit rule on /api/upload.

  try {
    const formData = await req.formData();
    const file = formData.get('file');

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No file' }, { status: 400 });
    }

    // Flat folder names only (no slashes or "..")
    const rawFolder = String(formData.get('folder') || 'uploads');
    const folder = /^[a-z0-9_-]{1,40}$/i.test(rawFolder) ? rawFolder : 'uploads';

    const isImage = IMAGE_TYPES.has(file.type);
    const isVideo = Object.prototype.hasOwnProperty.call(VIDEO_TYPES, file.type);

    if (!isImage && !isVideo) {
      return NextResponse.json({ error: 'Unsupported file type' }, { status: 415 });
    }

    const maxBytes = isImage ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
    if (file.size > maxBytes) {
      return NextResponse.json({ error: 'File too large' }, { status: 413 });
    }

    let body = Buffer.from(await file.arrayBuffer());
    let contentType = file.type;
    let ext;

    if (isImage) {
      // Same processing Cloudinary did: apply EXIF orientation, downscale only, convert to WebP.
      body = await sharp(body)
        .rotate() // auto-orient from EXIF
        .resize({ width: MAX_IMAGE_WIDTH, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
      contentType = 'image/webp';
      ext = 'webp';
    } else {
      ext = VIDEO_TYPES[file.type];
    }

    // Unique name, never taken from the user's file name
    const key = `${folder}/${randomUUID()}.${ext}`;

    await r2.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      })
    );

    return NextResponse.json({ url: `${PUBLIC_URL}/${key}` });
  } catch (err) {
    console.error('Upload failed:', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}