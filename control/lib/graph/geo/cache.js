/**
 * On-disk cache for fetched gazetteer artifacts.
 *
 * Layout:
 *   <root>/<source>/_collections/<name>.geojson   — source-level bulk file
 *   <root>/<source>/<slug>.geojson                — per-query feature
 *   <root>/<source>/<slug>.meta.json              — sidecar: { sourceUrl, fetchedAt }
 *
 * The cache is a recorded artifact, not a transient optimization. There is no
 * TTL and no stale-while-revalidate; the operator deletes a file to force a
 * fresh fetch. See MAP_ILLUSTRATOR_PRINCIPLES.md § Caching.
 *
 * Defaults to `<cwd>/data/geo-cache`. Override with GEO_CACHE_ROOT, matching
 * the pattern used by data/storage in lib/storage/index.js.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_ROOT = path.join(process.cwd(), 'data', 'geo-cache');

export function getCacheRoot() {
  return process.env.GEO_CACHE_ROOT || DEFAULT_ROOT;
}

function sanitizeKey(key) {
  if (typeof key !== 'string' || !key) throw new Error('cache key must be a non-empty string');
  if (key.includes('..') || key.includes('\\')) {
    throw new Error(`cache key '${key}' contains illegal traversal characters`);
  }
  return key.replace(/^\/+/, '');
}

function pathFor(source, key, suffix = '.geojson') {
  const safeSource = sanitizeKey(source);
  const safeKey = sanitizeKey(key);
  return path.join(getCacheRoot(), safeSource, `${safeKey}${suffix}`);
}

async function ensureDir(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

export async function readJson(source, key) {
  const filePath = pathFor(source, key);
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

export async function writeJson(source, key, value, meta) {
  const filePath = pathFor(source, key);
  await ensureDir(filePath);
  await fs.writeFile(filePath, JSON.stringify(value));
  if (meta) {
    const metaPath = pathFor(source, key, '.meta.json');
    await fs.writeFile(
      metaPath,
      JSON.stringify({ ...meta, cachedAt: new Date().toISOString() }, null, 2),
    );
  }
  return filePath;
}

export async function readMeta(source, key) {
  const metaPath = pathFor(source, key, '.meta.json');
  try {
    const raw = await fs.readFile(metaPath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}
