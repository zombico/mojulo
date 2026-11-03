/**
 * cover-upload — a cover's illustration from a picture the operator has, in place of a painted one. The image worker
 * is never involved: the agent passes the picture's file (`{ path }`, which mojulo files into a stash as an image item)
 * or names an image item already gathered, and the cover's illustration slot maps it:
 *
 *   slots.illustration: { realizer: 'upload', from: { stash: '<stash ref>', item: <item id> } }
 *
 * The Claude plugin profile has no image worker, so its covers start with `realizer: 'placeholder'` (the palette
 * stand-in, nothing to paint) and take a picture this way. Server side (the stash repository, the storage).
 *
 *   readUploadFrom(from)        → { path } or { stash, item }, or throws, teaching (shape only)
 *   readArtFile(file)           → the picture's bytes and header (PNG, JPEG, WebP; 10 MB, the stash intake's cap), or throws
 *   pictureHeader(buffer)       → { type, width, height } from a PNG's, JPEG's or WebP's header, or null
 *   fileArt(picture, { title }) → { stash, item }: the picture filed into a new stash as an image item
 *   checkUploadedArt(from)      → errors[]: the stash, the item and its being an image (create_cover's gate)
 *   uploadedArt(from)           → the image's bytes (the compositor's illustration layer), or throws, teaching
 */
import fs from 'node:fs';
import path from 'node:path';
import { StashRepository } from '@/lib/db/repositories/stashes';
import { downloadToBuffer, uploadFileSync } from '@/lib/storage';

const HOW = "a picture for the illustration is { path: '<absolute PNG or JPEG path on this host>' } (mojulo files it into a stash), or a stash image item { stash: '<stash ref>', item: <image item id> } (get_stash for its id)";
const ART_MAX_BYTES = 10 * 1024 * 1024; // the stash intake's cap (app/api/stashes/[ref]/items)

export function readUploadFrom(from) {
  if (from && typeof from === 'object' && from.path !== undefined) {
    if (typeof from.path !== 'string' || !path.isAbsolute(from.path)) throw new Error(`art.path must be an absolute path (${HOW})`);
    return { path: from.path };
  }
  if (!from || typeof from !== 'object' || typeof from.stash !== 'string' || !from.stash || !Number.isInteger(from.item)) throw new Error(HOW);
  return { stash: from.stash, item: from.item };
}

/** The picture at a path, checked before anything is written: its bytes, its type and its size in pixels. */
export function readArtFile(file) {
  let buffer;
  try { buffer = fs.readFileSync(file); } catch (err) { throw new Error(`art.path: cannot read '${file}' (${err.code || err.message})`); }
  if (!buffer.length) throw new Error(`art.path: '${file}' is empty`);
  if (buffer.length > ART_MAX_BYTES) throw new Error(`art.path: '${file}' is over the ${ART_MAX_BYTES / (1024 * 1024)} MB cap`);
  const dims = pictureHeader(buffer);
  if (!dims || !(dims.width > 0) || !(dims.height > 0)) throw new Error(`art.path: '${file}' is not a PNG, JPEG or WebP picture`);
  return { buffer, name: path.basename(file), mime: `image/${dims.type}`, width: dims.width, height: dims.height };
}

// The JPEG start-of-frame markers that carry the picture's size (not DHT C4, JPG C8 or DAC CC).
const JPEG_SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

/** A PNG's, JPEG's or WebP's type and size from its header, or null: read here, so the boot loads no image package. */
export function pictureHeader(b) {
  if (b.length >= 24 && b.readUInt32BE(0) === 0x89504e47 && b.readUInt32BE(4) === 0x0d0a1a0a && b.toString('ascii', 12, 16) === 'IHDR') {
    return { type: 'png', width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  }
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    for (let i = 2; i + 9 < b.length;) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1];
      if (m === 0xff || m === 0x01 || (m >= 0xd0 && m <= 0xd8)) { i += m === 0xff ? 1 : 2; continue; }
      if (JPEG_SOF.has(m)) return { type: 'jpeg', width: b.readUInt16BE(i + 7), height: b.readUInt16BE(i + 5) };
      i += 2 + b.readUInt16BE(i + 2);
    }
    return null;
  }
  if (b.length >= 30 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
    const chunk = b.toString('ascii', 12, 16);
    if (chunk === 'VP8 ') return { type: 'webp', width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
    if (chunk === 'VP8L') { const v = b.readUInt32LE(21); return { type: 'webp', width: (v & 0x3fff) + 1, height: ((v >>> 14) & 0x3fff) + 1 }; }
    if (chunk === 'VP8X') return { type: 'webp', width: b.readUIntLE(24, 3) + 1, height: b.readUIntLE(27, 3) + 1 };
  }
  return null;
}

/** A checked picture filed into a new stash as an image item, as the dashboard's intake stores one. */
export function fileArt(picture, { title }) {
  const stash = StashRepository.mint({ title: `${title} — cover art` });
  const key = `stashes/${stash.stashRef}/items/${picture.name.replace(/[^A-Za-z0-9._-]/g, '_')}`;
  uploadFileSync(key, picture.buffer);
  const item = StashRepository.gather({
    stashRef: stash.stashRef, type: 'image', title: picture.name, mediaRef: key,
    metadata: { mime: picture.mime, width: picture.width, height: picture.height, content_hash: `stash-storage:${key}`, original_filename: picture.name },
  });
  return { stash: stash.stashRef, item: item.id };
}

function itemOf(from) {
  const { stash, item } = readUploadFrom(from);
  const s = StashRepository.getByRef(stash);
  if (!s) return { error: `no stash '${stash}' (${HOW})` };
  const it = StashRepository.getItemById(item);
  if (!it || it.stashId !== s.id) return { error: `stash '${stash}' has no item ${item}` };
  if (it.type !== 'image') return { error: `item ${item} of '${stash}' is ${it.type}, not an image` };
  if (!it.mediaRef || it.mediaRef.startsWith('doc_')) return { error: `item ${item} of '${stash}' has no stored image bytes (pass the picture again as art: { path })` };
  return { it };
}

export function checkUploadedArt(from) {
  try { const r = itemOf(from); return r.error ? [r.error] : []; }
  catch (err) { return [err.message]; }
}

export async function uploadedArt(from) {
  const r = itemOf(from);
  if (r.error) throw new Error(`cover illustration: ${r.error}`);
  return downloadToBuffer(r.it.mediaRef);
}
