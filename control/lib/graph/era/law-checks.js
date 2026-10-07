/**
 * LAW CHECKS — the sixth-gen laws (laws.js) read off a built room stage, so a recipe's look is measured rather than
 * hoped for. Each check returns `{ law, ok, why }`; together they are a readout that advises and never refuses
 * (docs/responsibility-model.md): the machine gate. The eyes gate stays the operator's.
 *
 * Values are measured as the nave's tests measure them: a corner's baked colour × its tile's mean colour, as luminance.
 */
import zlib from 'node:zlib';
import { surfaceTexture } from '../landscape/surface-textures.js';

const MEANS = new Map();
/** A tile's mean colour (0..1) from its data-URL PNG, over its opaque texels. */
export function tileMean(key) {
  if (MEANS.has(key)) return MEANS.get(key);
  const url = surfaceTexture(key);
  if (!url) { MEANS.set(key, [1, 1, 1]); return [1, 1, 1]; }
  const b = Buffer.from(url.split(',')[1], 'base64');
  let o = 8, W = 0, H = 0, ct = 2; const idat = [];
  while (o < b.length) { const len = b.readUInt32BE(o), type = b.toString('ascii', o + 4, o + 8); if (type === 'IHDR') { W = b.readUInt32BE(o + 8); H = b.readUInt32BE(o + 12); ct = b[o + 17]; } if (type === 'IDAT') idat.push(b.subarray(o + 8, o + 8 + len)); o += 12 + len; }
  const raw = zlib.inflateSync(Buffer.concat(idat)), bpp = ct === 6 ? 4 : 3, sum = [0, 0, 0]; let n = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const q = y * (1 + W * bpp) + 1 + x * bpp; if (bpp === 4 && raw[q + 3] === 0) continue; n++; for (let k = 0; k < 3; k++) sum[k] += raw[q + k]; }
  const m = sum.map((v) => v / (n * 255));
  MEANS.set(key, m);
  return m;
}
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const family = (key) => (typeof key === 'string' ? key.replace(/-[a-d]$/, '') : null);
const near = (c, p, r) => Math.hypot(c[0] - p[0], c[1] - p[1], c[2] - p[2]) < r;

/** Mean seen luminance of the corners of the faces `sel` picks (blends and cards left out), where `where` holds. */
function seen(faces, sel, where = () => true) {
  const v = [];
  for (const f of faces) {
    if (f.blend || !sel(f)) continue;
    const t = f.texture ? tileMean(f.texture) : [1, 1, 1];
    (f.cornerFills || [f.fill]).forEach((h, k) => { const c = f.corners[Math.min(k, f.corners.length - 1)]; if (typeof h === 'string' && where(c)) v.push(lum(hex(h).map((x, i) => x * t[i]))); });
  }
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

/** Read the laws off a room stage's payload. */
export function checkStageLaws(payload) {
  const faces = payload.faces || [], torches = (payload.lights || []).map((l) => l.position);
  const g = (name) => (f) => f.group === `stage:${name}`;
  const nearTorch = (c) => torches.some((t) => near(c, t, 1.6));
  const farFromTorch = (c) => !torches.some((t) => Math.hypot(c[0] - t[0], c[1] - t[1]) < 3.5);
  const v = { torchlit: seen(faces, g('wall'), nearTorch), wall: seen(faces, g('wall'), (c) => !nearTorch(c)), floor: seen(faces, g('floor'), farFromTorch), ceiling: seen(faces, g('ceiling')) };
  const fam = (sel) => new Set(faces.filter((f) => !f.blend && sel(f) && f.texture).map((f) => family(f.texture)));
  const wallF = fam(g('wall')), ceilF = fam(g('ceiling'));
  const shared = [...ceilF].filter((k) => wallF.has(k));
  // coursed masonry carried overhead reads as a tiled ceiling, whoever's brick it is
  const coursed = [...ceilF].filter((k) => /^(stone-wall|gen:stone-brick)/.test(k));
  const out = [];
  const add = (law, ok, why) => out.push({ law, ok, why });
  if (v.torchlit != null && v.floor != null && v.ceiling != null) {
    add('value-order', v.torchlit > v.floor && v.floor > v.ceiling,
      `torchlit wall ${v.torchlit.toFixed(3)} > open floor ${v.floor.toFixed(3)} > ceiling ${v.ceiling.toFixed(3)}`);
  }
  add('materials-by-layer', ceilF.size > 0 && shared.length === 0 && coursed.length === 0 && (v.ceiling ?? 1) < (v.wall ?? 0),
    shared.length ? `the ceiling wears the walls' tile (${shared.join(', ')})` : coursed.length ? `the ceiling is coursed brick (${coursed.join(', ')}), a wall carried overhead`
      : `ceiling ${v.ceiling?.toFixed(3)} against wall ${v.wall?.toFixed(3)}`);
  const blends = faces.filter((f) => f.blend);
  add('blend-by-cause', blends.length > 0, blends.length ? `${blends.length} blend faces (${[...new Set(blends.map((f) => f.group))].join(', ')})` : 'no second tile anywhere: no moss, no grime, no wear');
  const cards = faces.filter((f) => typeof f.texture === 'string' && f.texture.startsWith('card:'));
  add('cutout-cards', cards.length > 0, cards.length ? `${cards.length} cards (${[...new Set(cards.map((f) => f.texture))].join(', ')})` : 'no dressing cards: nothing hung, nothing grown');
  // a set piece declares itself (`stage:focus…`), or a doorway breaks the scale (the nave's great door stands ≥ 5 m)
  const doorTop = Math.max(0, ...faces.filter((f) => f.group === 'stage:door').flatMap((f) => f.corners.map((c) => c[2])));
  const focus = faces.some((f) => typeof f.group === 'string' && f.group.startsWith('stage:focus')) || doorTop >= 5;
  add('focus', focus, focus ? 'a set piece stands' : 'no set piece holds the eye');
  const darkest = Math.min(...faces.filter((f) => f.cornerFills && !f.blend).flatMap((f) => f.cornerFills.map((h) => Math.max(...hex(h)))));
  add('shade-is-colour', darkest > 0.03, `darkest corner ${darkest.toFixed(3)}`);
  return { values: v, laws: out, passed: out.filter((x) => x.ok).length, of: out.length };
}
