/**
 * zip-writer — a deterministic, dependency-free ZIP container builder.
 *
 * `archiver` (already a control-plane dependency, used by the bot stager) streams
 * and stamps wall-clock mtimes, which breaks the one property every export here
 * must keep: a byte-identical file for a given recipe. This writer is the
 * container half of the OPC-style exports — 3MF (interchange-seams.plan.md
 * seam 1) now, USDZ (seam 2b) next:
 *
 *  - every entry carries the fixed DOS timestamp 1980-01-01 00:00:00, so bytes
 *    depend on content only;
 *  - `deflate` entries use zlib's raw deflate at a fixed level (deterministic for
 *    a given zlib); `store` entries are written verbatim;
 *  - `align` pads each STORED entry's local header (via the extra field) so the
 *    file DATA starts on a multiple of `align` bytes — USDZ requires 64-byte
 *    alignment so the reader can mmap the payload in place;
 *  - no ZIP64: the 4 GiB / 65535-entry limits are far past any export here, and
 *    a caller that hits them gets a loud error rather than a silent wrap.
 *
 * Pure Buffer assembly, unit-testable in node.
 */

import zlib from 'node:zlib';

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// DOS date/time for 1980-01-01 00:00:00 — the epoch of the format, the fixed stamp.
const DOS_TIME = 0x0000;
const DOS_DATE = 0x0021;
const SIG_LOCAL = 0x04034b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_END = 0x06054b50;
const METHOD_STORE = 0;
const METHOD_DEFLATE = 8;

/**
 * buildZip(entries, { align, level }) → Buffer
 *
 * `entries`: `[{ name, data, method? }]` — `name` is the archive path (forward
 * slashes, no leading slash), `data` a Buffer or string (UTF-8), `method`
 * `'deflate'` (default) or `'store'`. Entries are written in the given order;
 * callers own the ordering (it is part of the byte contract).
 * `align`: when set (e.g. 64), STORED entries' data offsets are padded to a
 * multiple of it. Deflated entries are never aligned (nothing mmaps them).
 */
export function buildZip(entries, { align = 0, level = 9 } = {}) {
  if (!Array.isArray(entries)) throw new Error('buildZip requires an array of entries');
  if (entries.length > 0xffff) throw new Error('buildZip: too many entries for a non-ZIP64 archive');
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const e of entries) {
    if (!e || typeof e.name !== 'string' || !e.name || e.name.startsWith('/')) {
      throw new Error('buildZip: every entry needs a relative `name`');
    }
    const name = Buffer.from(e.name, 'utf8');
    const raw = Buffer.isBuffer(e.data) ? e.data : Buffer.from(e.data == null ? '' : String(e.data), 'utf8');
    const store = e.method === 'store';
    const method = store ? METHOD_STORE : METHOD_DEFLATE;
    const packed = store ? raw : zlib.deflateRawSync(raw, { level });
    const crc = crc32(raw);
    if (raw.length > 0xffffffff || packed.length > 0xffffffff) throw new Error('buildZip: entry exceeds the non-ZIP64 size limit');

    // Alignment rides the extra field: pad so (offset + 30 + name + extra) % align === 0.
    let extra = Buffer.alloc(0);
    if (store && align > 0) {
      const headerEnd = offset + 30 + name.length;
      let pad = (align - (headerEnd % align)) % align;
      // An extra field needs a 4-byte header; if the padding is 1–3 bytes, spill a whole block.
      if (pad > 0 && pad < 4) pad += align;
      if (pad > 0) {
        extra = Buffer.alloc(pad);
        extra.writeUInt16LE(0x1986, 0); // a private "padding" id (the USDZ convention)
        extra.writeUInt16LE(pad - 4, 2);
      }
    }

    const local = Buffer.alloc(30);
    local.writeUInt32LE(SIG_LOCAL, 0);
    local.writeUInt16LE(store ? 10 : 20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // flags: UTF-8 names
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(packed.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(extra.length, 28);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(SIG_CENTRAL, 0);
    central.writeUInt16LE(store ? 10 : 20, 4); // version made by
    central.writeUInt16LE(store ? 10 : 20, 6); // version needed
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(DOS_TIME, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(packed.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30); // extra (central) — the padding lives in the LOCAL header only
    central.writeUInt16LE(0, 32); // comment
    central.writeUInt16LE(0, 34); // disk
    central.writeUInt16LE(0, 36); // internal attrs
    central.writeUInt32LE(0, 38); // external attrs
    central.writeUInt32LE(offset, 42);

    locals.push(local, name, extra, packed);
    centrals.push(central, name);
    offset += local.length + name.length + extra.length + packed.length;
  }
  const centralStart = offset;
  const centralBytes = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(SIG_END, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBytes.length, 12);
  end.writeUInt32LE(centralStart, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...locals, centralBytes, end]);
}

/**
 * readZip(buf) → [{ name, data, method, offset }] — the minimal inverse, for
 * tests and for the bind-back doors that need to look inside an exported
 * container. Walks the central directory; inflates deflated entries.
 */
export function readZip(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 22) throw new Error('readZip: not a zip');
  let endAt = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 0xffff); i--) {
    if (buf.readUInt32LE(i) === SIG_END) { endAt = i; break; }
  }
  if (endAt < 0) throw new Error('readZip: end-of-central-directory not found');
  const count = buf.readUInt16LE(endAt + 10);
  let p = buf.readUInt32LE(endAt + 16);
  const out = [];
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== SIG_CENTRAL) throw new Error('readZip: corrupt central directory');
    const method = buf.readUInt16LE(p + 10);
    const packedLen = buf.readUInt32LE(p + 20);
    const rawLen = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localAt = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    if (buf.readUInt32LE(localAt) !== SIG_LOCAL) throw new Error('readZip: corrupt local header');
    const lNameLen = buf.readUInt16LE(localAt + 26);
    const lExtraLen = buf.readUInt16LE(localAt + 28);
    const dataAt = localAt + 30 + lNameLen + lExtraLen;
    const packed = buf.subarray(dataAt, dataAt + packedLen);
    const data = method === METHOD_STORE ? Buffer.from(packed) : zlib.inflateRawSync(packed);
    if (data.length !== rawLen) throw new Error(`readZip: size mismatch in '${name}'`);
    out.push({ name, data, method: method === METHOD_STORE ? 'store' : 'deflate', offset: dataAt });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}
