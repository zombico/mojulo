/**
 * GET /outcomes/<cook_ref>/[...path]
 *
 * Serves Outcome Artifact folders from control/data/outcomes/<cook_ref>/.
 * Bare URL /outcomes/<cook_ref>/ resolves to index.html. Any other path under
 * the same prefix is served as the file at that location (svg/png/json/md).
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

import { outcomeDirFor } from '@/lib/outcomes/write';

const SAFE_SEGMENT = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/;

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

function contentTypeFor(filename) {
  const ext = path.extname(filename).toLowerCase();
  return CONTENT_TYPES[ext] || 'application/octet-stream';
}

export async function GET(_request, { params }) {
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

  let data;
  try {
    data = await fs.readFile(resolved);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return NextResponse.json(
        { error: `outcome not found: ${cookRef}${rest.length ? `/${rest.join('/')}` : ''}` },
        { status: 404 },
      );
    }
    throw err;
  }

  return new NextResponse(data, {
    status: 200,
    headers: {
      'content-type': contentTypeFor(filename),
      'cache-control': 'private, max-age=0, must-revalidate',
    },
  });
}
