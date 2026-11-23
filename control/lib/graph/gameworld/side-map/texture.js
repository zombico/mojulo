/**
 * THE CAKE'S TEXTURES (cake.js MATERIALS `texture`): a procedural tile a material wears, laid on world uvs over its
 * faces and multiplied by the light baked into them (the page's `textureLit`: texel × the face's baked colour), so a
 * material carries detail finer than the light's cells. Each tile is near white: a multiplier, never a colour of its own.
 *
 *   grain     rock: two octaves of value noise, a stone's tooth
 *   sparkle   snow: an even field with rare bright crystals
 *   brushed   metal: streaks along the grain and a broad sheen across it
 *   stone     masonry: a fine tooth and a few pits
 *   cloth     padded: a weave
 *
 *   TEXTURE_SIZE, TEXTURE_TILE (metres a tile spans on the face)
 *   sideMapTexture(kind) → a PNG data url (cached)
 *   textureKey(kind) → the payload's `textures` key a face names
 *
 * Deterministic: seeded dice by the kind's name (city/plan/dice.js mulberry32).
 */
import { encodePng } from '../../landscape/surface-textures.js';
import { mulberry32 } from '../../city/plan/dice.js';

export const TEXTURE_SIZE = 64, TEXTURE_TILE = 2;
export const TEXTURE_KINDS = Object.freeze(['grain', 'sparkle', 'brushed', 'stone', 'cloth']);
export const textureKey = (kind) => `sidemap:${kind}`;
const built = new Map();

// value noise on a lattice that wraps (the tile repeats seamlessly)
function lattice(R, n) { const g = Array.from({ length: n * n }, () => R()); return (x, y) => { const xi = Math.floor(x) % n, yi = Math.floor(y) % n, xf = x - Math.floor(x), yf = y - Math.floor(y), a = g[yi * n + xi], b = g[yi * n + ((xi + 1) % n)], c = g[((yi + 1) % n) * n + xi], d = g[((yi + 1) % n) * n + ((xi + 1) % n)], u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }; }

const PAINT = {
  grain: (R) => { const n1 = lattice(R, 8), n2 = lattice(R, 32); return (x, y) => 0.8 + 0.13 * n1((x * 8) / 64, (y * 8) / 64) + 0.07 * n2((x * 32) / 64, (y * 32) / 64); },
  sparkle: (R) => { const n = lattice(R, 16), spots = new Set(Array.from({ length: 22 }, () => Math.floor(R() * 64 * 64))); return (x, y) => (spots.has(y * 64 + x) ? 1 : 0.9 + 0.06 * n((x * 16) / 64, (y * 16) / 64)); },
  brushed: (R) => { const rows = Array.from({ length: 64 }, () => R()); return (x, y) => 0.84 + 0.08 * rows[y] + 0.08 * Math.max(0, Math.sin(((x + y * 0.6) / 64) * Math.PI * 2)) ** 6; },
  stone: (R) => { const n = lattice(R, 16), pits = new Set(Array.from({ length: 30 }, () => Math.floor(R() * 64 * 64))); return (x, y) => (pits.has(y * 64 + x) ? 0.72 : 0.88 + 0.1 * n((x * 16) / 64, (y * 16) / 64)); },
  cloth: () => (x, y) => 0.88 + 0.08 * (((x >> 1) + (y >> 1)) % 2) + 0.03 * ((x + y) % 2),
};

/** A material's tile as a PNG data url. */
export function sideMapTexture(kind) {
  if (built.has(kind)) return built.get(kind);
  const P = PAINT[kind];
  if (!P) throw new Error(`side map texture: ${kind} is not one (${TEXTURE_KINDS.join(', ')})`);
  let h = 2166136261; for (const c of kind) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const f = P(mulberry32(h >>> 0)), N = TEXTURE_SIZE, rgb = Buffer.alloc(N * N * 3);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const v = Math.round(255 * Math.max(0, Math.min(1, f(x, y)))); rgb[(y * N + x) * 3] = v; rgb[(y * N + x) * 3 + 1] = v; rgb[(y * N + x) * 3 + 2] = v; }
  const url = `data:image/png;base64,${encodePng(rgb, N, N).toString('base64')}`;
  built.set(kind, url);
  return url;
}
