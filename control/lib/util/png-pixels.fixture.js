/**
 * png-pixels — test-only (a *.fixture.js, so the package leaves it out): text with every embedded base64 PNG swapped
 * for a digest of its pixels.
 *
 * Node's zlib is not one library: the official builds bundle Chromium's zlib 1.3.1, Homebrew's Node links macOS's
 * 1.2.12, and the two compress the same scanlines to different bytes. The README promises a texture's pixels, not its
 * compressed bytes, so a byte pin over a payload that carries a texture hashes it through here: the image header and
 * the inflated scanlines (inflate is the same function in every zlib), never the deflate stream.
 */
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';

const PNG_DATA = /data:image\/png;base64,([A-Za-z0-9+/]+={0,2})/g;

/** `png:<16 hex>` over one base64 PNG's IHDR and its inflated IDAT. */
export function pngPixelDigest(b64) {
  const b = Buffer.from(b64, 'base64');
  const h = createHash('sha256');
  const idat = [];
  for (let o = 8; o + 8 <= b.length;) {
    const n = b.readUInt32BE(o), type = b.toString('latin1', o + 4, o + 8), data = b.subarray(o + 8, o + 8 + n);
    if (type === 'IHDR') h.update(data);
    else if (type === 'IDAT') idat.push(data);
    o += 12 + n;
  }
  return `png:${h.update(inflateSync(Buffer.concat(idat))).digest('hex').slice(0, 16)}`;
}

/** `s` with each embedded base64 PNG replaced by its pixel digest; text without one comes back unchanged. */
export const withPngPixels = (s) => (s.includes('data:image/png;base64,') ? s.replace(PNG_DATA, (_, b64) => pngPixelDigest(b64)) : s);
