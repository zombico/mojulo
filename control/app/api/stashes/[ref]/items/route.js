/**
 * POST /api/stashes/[ref]/items — UI gather (the structural-edit path that
 * mints typed items into a stash). The agent path is the `gather` MCP tool;
 * this route exists so the dashboard can submit text / markdown / svg / image
 * / link items without going through MCP. Both paths funnel into the same
 * `StashRepository.gather` gate — one source of contract truth.
 *
 * Discriminates by content type:
 *   - `multipart/form-data` → image upload (fields: file, title?, alt?,
 *                                            sourceUrl?, drawer?)
 *   - `application/json`    → text / markdown / svg / link
 *
 * `script` and `pointer` are intentionally NOT accepted here (per
 * lite-template/integration/app-system/0602/STASH_RELATIONAL_ATOMS.md). Scripts
 * are realistically agent-generated; pointers need contextmap resolution the
 * dashboard doesn't have. The route 400s with a clear message if either type
 * is requested.
 *
 * Image storage: bytes write to control/data/storage/stashes/<stash_ref>/items/
 * (per-stash folders, no content hashing — citable-atoms posture). The
 * media_ref stored on the row is the storage key, resolvable later via
 * /api/stashes/[ref]/media/[id]. EXIF stripping is a known gap — handled by a
 * future sharp-based pass; for now the operator's localhost-only substrate
 * eats the leak. Tracked as future work alongside thumbnail derivation.
 */

import path from 'node:path';
import { NextResponse } from 'next/server';
import imageSize from 'image-size';
import { StashRepository } from '@/lib/db/repositories/stashes';
import { uploadFile } from '@/lib/storage';

const UI_ALLOWED_TYPES = new Set(['text', 'markdown', 'svg', 'link', 'image', 'sketch']);
const IMAGE_MAX_BYTES = 10 * 1024 * 1024; // 10MB

function safeFilename(name) {
  if (!name || typeof name !== 'string') return 'upload';
  // Strip path separators, control chars, leading dots, length cap.
  const stripped = name
    .replace(/[\x00-\x1f]/g, '')
    .replace(/[\\/]/g, '_')
    .replace(/^\.+/, '')
    .trim();
  const clipped = stripped.slice(0, 80);
  return clipped || 'upload';
}

async function handleJsonGather(stashRef, body) {
  const {
    type,
    drawer,
    title,
    source_url,
    sourceUrl,
    body: textBody,
    body_md,
    bodyMd,
    body_svg,
    bodySvg,
    metadata,
  } = body || {};
  if (!type || !UI_ALLOWED_TYPES.has(type)) {
    return NextResponse.json(
      {
        error: `type '${type ?? ''}' is not accepted on the UI gather path. Allowed: ${[...UI_ALLOWED_TYPES].join(', ')}. Script and pointer items must be gathered via your agent.`,
      },
      { status: 400 },
    );
  }
  if (type === 'image') {
    return NextResponse.json(
      { error: 'image items must be uploaded as multipart/form-data, not JSON' },
      { status: 400 },
    );
  }
  const item = StashRepository.gather({
    stashRef,
    drawer: drawer || undefined,
    type,
    title: title || undefined,
    sourceUrl: source_url ?? sourceUrl,
    body: textBody,
    bodyMd: body_md ?? bodyMd,
    bodySvg: body_svg ?? bodySvg,
    metadata: metadata || undefined,
  });
  return NextResponse.json({ item: serializeItem(item) });
}

async function handleMultipartGather(stashRef, request) {
  const form = await request.formData();
  const file = form.get('file');
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: '`file` is required for image upload' }, { status: 400 });
  }
  const size = file.size ?? 0;
  if (size === 0) {
    return NextResponse.json({ error: 'uploaded file is empty' }, { status: 400 });
  }
  if (size > IMAGE_MAX_BYTES) {
    return NextResponse.json(
      { error: `image exceeds the ${IMAGE_MAX_BYTES / (1024 * 1024)}MB cap` },
      { status: 413 },
    );
  }
  const mimeFromClient = file.type || 'application/octet-stream';
  if (!mimeFromClient.startsWith('image/')) {
    return NextResponse.json(
      { error: `not an image (mime: ${mimeFromClient})` },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Derive dimensions server-side. image-size is sync, no decode-to-pixels,
  // and reads a few hundred bytes of header — cheap.
  let width, height, sniffedMime;
  try {
    const dims = imageSize(buffer);
    width = dims.width;
    height = dims.height;
    if (dims.type) sniffedMime = `image/${dims.type === 'jpg' ? 'jpeg' : dims.type}`;
  } catch {
    return NextResponse.json(
      { error: 'could not read image header — file may be corrupt or unsupported' },
      { status: 400 },
    );
  }
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    return NextResponse.json(
      { error: 'image header missing width/height' },
      { status: 400 },
    );
  }
  const mime = sniffedMime || mimeFromClient;

  // Per-stash storage key. Timestamp prefix keeps filenames unique within a
  // stash without needing the row id (we mint the row AFTER the write, so a
  // post-insert rename would be an extra round-trip).
  const stash = StashRepository.getByRef(stashRef);
  if (!stash) {
    return NextResponse.json({ error: `Stash '${stashRef}' not found` }, { status: 404 });
  }
  const filename = safeFilename(file.name) || 'upload';
  const ext = path.extname(filename) || '';
  const base = ext ? filename.slice(0, -ext.length) : filename;
  const storageKey = `stashes/${stashRef}/items/${Date.now()}-${base}${ext}`;
  await uploadFile(storageKey, buffer);

  const titleField = form.get('title');
  const altField = form.get('alt');
  const sourceUrlField = form.get('sourceUrl');
  const drawerField = form.get('drawer');

  const metadata = {
    mime,
    width,
    height,
    // 0602 explicitly opts out of dedup hashing, but the gate still expects a
    // content_hash field (legacy from the 0531 contract). Use the storage key
    // as a stable identity-string; it's unique per upload, satisfies the gate,
    // and signals "no real hash here" to anyone reading the row.
    content_hash: `stash-storage:${storageKey}`,
  };
  if (typeof altField === 'string' && altField) metadata.alt = altField;
  if (file.name) metadata.original_filename = file.name;

  const item = StashRepository.gather({
    stashRef,
    drawer: typeof drawerField === 'string' && drawerField ? drawerField : undefined,
    type: 'image',
    title: typeof titleField === 'string' && titleField ? titleField : undefined,
    sourceUrl: typeof sourceUrlField === 'string' && sourceUrlField ? sourceUrlField : undefined,
    mediaRef: storageKey,
    metadata,
  });

  return NextResponse.json({ item: serializeItem(item) });
}

function serializeItem(item) {
  return {
    id: item.id,
    type: item.type,
    drawerId: item.drawerId,
    title: item.title,
    sourceUrl: item.sourceUrl,
    body: item.body,
    bodyMd: item.bodyMd,
    mediaRef: item.mediaRef,
    metadata: item.metadata,
    createdAt: item.createdAt,
  };
}

export async function POST(request, { params }) {
  try {
    const { ref } = await params;
    const contentType = request.headers.get('content-type') || '';
    if (contentType.startsWith('multipart/form-data')) {
      return await handleMultipartGather(ref, request);
    }
    if (contentType.includes('application/json')) {
      const body = await request.json().catch(() => ({}));
      return await handleJsonGather(ref, body);
    }
    return NextResponse.json(
      { error: `unsupported content-type '${contentType}'. Use application/json or multipart/form-data.` },
      { status: 415 },
    );
  } catch (err) {
    let status = 500;
    if (/not found/i.test(err.message)) status = 404;
    else if (/required|must|exceeds|valid|reject|not start/i.test(err.message)) status = 400;
    return NextResponse.json(
      { error: err.message || 'Failed to gather item' },
      { status },
    );
  }
}
