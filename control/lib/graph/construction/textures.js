// construction/textures — a member face's figure as a surface texture, named by a key that carries every parameter.
//
// `timber:<base64url JSON>` encodes the species, the log spec and the face's plane in the log, so the texture is a pure
// function of its key: the lowering only mints keys (cheap), and the texture is baked when the scene's texture channel
// resolves it (world-scene → collectFaceTextures → surfaceTexture → the resolver registered here). The key holds no
// colour: the member's tint and finish ride the face's fill, so restaining a frame reuses every texture byte.
// Baked PNGs and their logs are cached, least recently used first out.
import { registerTextureResolver, encodePng } from '../landscape/surface-textures.js';
import { makeLog } from './log.js';
import { bakeFigure } from './figure.js';

export const TIMBER_TEXTURE_PREFIX = 'timber:';
const MAX_URLS = 256, MAX_LOGS = 32;
const urls = new Map(), logs = new Map();
const touch = (m, k, v, max) => { m.delete(k); m.set(k, v); if (m.size > max) m.delete(m.keys().next().value); return v; };

const b64u = (s) => Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');

/**
 * The key for one face: `log` is the makeLog spec (species, age, length, ringMm, knots, seed, …), `plane` is
 * { origin, a, b, w, h } in log metres, `nu` × `nv` the pixel size.
 */
export function timberTextureKey(log, plane, nu, nv) {
  const q = (v, k = 1e5) => Math.round(v * k) / k;
  return TIMBER_TEXTURE_PREFIX + b64u(JSON.stringify({
    log,
    o: plane.origin.map((v) => q(v)), a: plane.a.map((v) => q(v, 1e6)), b: plane.b.map((v) => q(v, 1e6)),
    w: q(plane.w), h: q(plane.h), nu, nv,
  }));
}

/** Bake a key → { rgb, nu, nv }, or null for a malformed key. */
export function bakeTimberKey(key) {
  let p;
  try { p = JSON.parse(unb64u(key.slice(TIMBER_TEXTURE_PREFIX.length))); } catch { return null; }
  if (!p || !p.log || !Array.isArray(p.o)) return null;
  const lk = JSON.stringify(p.log);
  const log = logs.get(lk) || touch(logs, lk, makeLog(p.log), MAX_LOGS);
  const rgb = bakeFigure(log, { origin: p.o, a: p.a, b: p.b, w: p.w, h: p.h, nu: p.nu, nv: p.nv });
  return { rgb, nu: p.nu, nv: p.nv };
}

/** The data URL for a key (cached), or null. */
export function resolveTimberTexture(key) {
  if (urls.has(key)) return touch(urls, key, urls.get(key), MAX_URLS);
  const baked = bakeTimberKey(key);
  if (!baked) return null;
  return touch(urls, key, `data:image/png;base64,${encodePng(baked.rgb, baked.nu, baked.nv).toString('base64')}`, MAX_URLS);
}

registerTextureResolver(TIMBER_TEXTURE_PREFIX, resolveTimberTexture);
