/**
 * GET /outcomes/<cook_ref>/[...path]
 *
 * Serves Outcome Artifact folders from control/data/outcomes/<cook_ref>/.
 * Bare URL /outcomes/<cook_ref>/ resolves to index.html. Any other path under
 * the same prefix is served as the file at that location (svg/png/json/md).
 * A folder with no index.html of its own (a building's sheets, a game's
 * export) is drawn as a listing of what is in it (lib/outcomes-listing.js),
 * so every link to a folder opens.
 *
 * Strictly static — no React, no app shell. The file on disk IS the artifact;
 * this route just streams bytes with the right content-type.
 *
 * Path-traversal hardening: each segment is validated as a safe filename
 * (no .., no slashes), and the resolved path is asserted to live within the
 * outcomes base directory.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';

import { outcomeDirFor } from '@/lib/outcomes-paths';
import { folderListingHtml } from '@/lib/outcomes-listing';

/** The folder at `dir`, drawn as a page; null when it is not a folder. */
async function listing(dir, ref, sub) {
  let entries;
  try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return null; }
  const rows = [];
  for (const e of entries) {
    if (!SAFE_SEGMENT.test(e.name)) continue;
    if (e.isDirectory()) rows.push({ name: e.name, dir: true });
    else if (e.isFile()) {
      const st = await fs.stat(path.join(dir, e.name)).catch(() => null);
      rows.push({ name: e.name, dir: false, bytes: st?.size });
    }
  }
  return new NextResponse(folderListingHtml({ ref, sub, entries: rows }), {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'private, max-age=0, must-revalidate' },
  });
}

const SAFE_SEGMENT = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/;

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  // export_model legs + the bundle (remote-worker exports P3): real types, not octet-stream
  '.zip': 'application/zip',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.stl': 'model/stl',
  '.3mf': 'application/vnd.ms-package.3dmanufacturing-3dmodel+xml',
  '.usdz': 'model/vnd.usdz+zip',
  '.usda': 'model/vnd.usda',
  // what a game export's pages load, and a building's schedules and IFC
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.woff2': 'font/woff2',
  '.ifc': 'application/x-step',
};

function contentTypeFor(filename) {
  const ext = path.extname(filename).toLowerCase();
  return CONTENT_TYPES[ext] || 'application/octet-stream';
}

export async function GET(request, { params }) {
  const { slug } = await params;
  const segments = Array.isArray(slug) ? slug : [slug];

  if (segments.length === 0) {
    return NextResponse.json({ error: 'cook_ref required' }, { status: 400 });
  }
  for (const seg of segments) {
    if (!SAFE_SEGMENT.test(seg)) {
      return NextResponse.json(
        { error: `invalid path segment '${seg}'` },
        { status: 400 },
      );
    }
  }

  const [cookRef, ...rest] = segments;
  const filename = rest.length === 0 ? 'index.html' : rest.join('/');
  const dir = outcomeDirFor(cookRef);
  const filePath = path.join(dir, filename);

  // Belt-and-suspenders: resolved path must live inside the outcome dir.
  // (segment validation already prevents this, but a second check is cheap.)
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(dir) + path.sep) && resolved !== path.resolve(dir, 'index.html')) {
    const inDir = resolved.startsWith(path.resolve(dir));
    if (!inDir) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
  }

  const contentType = contentTypeFor(filename);

  // Video needs HTTP Range support: Safari (and seeking everywhere) requires a
  // 206 partial response, so a stitch's motion.mp4 must be range-served, not
  // streamed whole. Other artifacts (svg/html/json/…) keep the simple 200 path.
  const isVideo = contentType.startsWith('video/');
  let stat;
  try {
    stat = await fs.stat(resolved);
  } catch (err) {
    // the bare folder with no index.html of its own: what is in it
    if (err.code === 'ENOENT' && rest.length === 0) {
      const page = await listing(dir, cookRef, []);
      if (page) return page;
    }
    if (err.code === 'ENOENT') {
      return NextResponse.json(
        { error: `outcome not found: ${cookRef}${rest.length ? `/${rest.join('/')}` : ''}` },
        { status: 404 },
      );
    }
    throw err;
  }

  // a folder inside the outcome: its own index.html when it has one, else what is in it
  if (stat.isDirectory()) {
    const index = path.join(resolved, 'index.html');
    if (await fs.stat(index).then((st) => st.isFile(), () => false)) {
      return new NextResponse(await fs.readFile(index), { status: 200, headers: { 'content-type': CONTENT_TYPES['.html'], 'cache-control': 'private, max-age=0, must-revalidate' } });
    }
    return listing(resolved, cookRef, rest);
  }

  const range = isVideo ? request.headers.get('range') : null;
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (m) {
      const size = stat.size;
      let start = m[1] ? parseInt(m[1], 10) : 0;
      let end = m[2] ? parseInt(m[2], 10) : size - 1;
      if (Number.isNaN(start)) start = 0;
      if (Number.isNaN(end) || end >= size) end = size - 1;
      if (start > end || start >= size) {
        return new NextResponse(null, {
          status: 416,
          headers: { 'content-range': `bytes */${size}`, 'accept-ranges': 'bytes' },
        });
      }
      const fh = await fs.open(resolved, 'r');
      try {
        const len = end - start + 1;
        const buf = Buffer.alloc(len);
        await fh.read(buf, 0, len, start);
        return new NextResponse(buf, {
          status: 206,
          headers: {
            'content-type': contentType,
            'content-range': `bytes ${start}-${end}/${size}`,
            'accept-ranges': 'bytes',
            'content-length': String(len),
            'cache-control': 'private, max-age=0, must-revalidate',
          },
        });
      } finally {
        await fh.close();
      }
    }
  }

  const data = await fs.readFile(resolved);
  return new NextResponse(data, {
    status: 200,
    headers: {
      'content-type': contentType,
      'cache-control': 'private, max-age=0, must-revalidate',
      ...(isVideo ? { 'accept-ranges': 'bytes', 'content-length': String(stat.size) } : {}),
    },
  });
}
