/**
 * Image resolver — turns an `image`-typed stash item into a published page
 * element. Reads the item's `media_ref` out of stored media (the same storage
 * surface uploads land in) and hands the raw bytes back to the caller, which
 * writes them into the self-contained outcome folder as a standalone file and
 * references them with a relative `<img src>`.
 *
 * This is the substrate's first image resolver — `picture_book`/`slide_deck`
 * only resolve `sketch` items, and `flyer` explicitly punted image handling to
 * "not in v1". The `photojournal` kind is the first to render photographs.
 *
 * Posture mirrors the sketch resolver: when the media is missing/unreadable we
 * return `dangling: true` with a null buffer rather than throwing, so one bad
 * item can't sink a whole publication. See lib/outcomes/PUBLISHER.plan.md.
 */

import { downloadToBuffer } from '@/lib/storage';

// mime → file extension for the standalone file written into the outcome folder.
const MIME_EXT = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
  'image/tiff': 'tiff',
  'image/bmp': 'bmp',
};

/**
 * Derive a sensible file extension from an `image/*` mime. Falls back to the
 * subtype (stripped of any `+suffix`), and finally to `img` for the truly
 * unknown — the contract gate already guaranteed an `image/` prefix at intake.
 */
export function extFromMime(mime) {
  if (typeof mime !== 'string') return 'img';
  const lower = mime.toLowerCase().trim();
  if (MIME_EXT[lower]) return MIME_EXT[lower];
  const sub = lower.split('/')[1];
  if (!sub) return 'img';
  return sub.split('+')[0].replace(/[^a-z0-9]/g, '') || 'img';
}

/**
 * Resolve an image-typed stash item to its bytes + display metadata.
 *
 * @param {object} item — the stash item; must carry `mediaRef` and
 *   `metadata.{mime,width,height}` (guaranteed by the intake gate).
 * @returns {Promise<{ buffer: Buffer|null, mime: string|null, ext: string|null,
 *   width: number|null, height: number|null, dangling: boolean }>}
 *   `dangling: true` (with a null buffer) when the media_ref is missing or the
 *   stored file can't be read — the caller renders a placeholder.
 */
export async function resolveImageItem(item) {
  const mediaRef = item?.mediaRef;
  const mime = item?.metadata?.mime ?? null;
  const width = Number.isInteger(item?.metadata?.width) ? item.metadata.width : null;
  const height = Number.isInteger(item?.metadata?.height) ? item.metadata.height : null;
  if (!mediaRef || typeof mediaRef !== 'string') {
    return { buffer: null, mime, ext: null, width, height, dangling: true };
  }
  let buffer = null;
  try {
    buffer = await downloadToBuffer(mediaRef);
  } catch {
    buffer = null;
  }
  if (!buffer || buffer.length === 0) {
    return { buffer: null, mime, ext: null, width, height, dangling: true };
  }
  return {
    buffer,
    mime,
    ext: extFromMime(mime),
    width,
    height,
    dangling: false,
  };
}
