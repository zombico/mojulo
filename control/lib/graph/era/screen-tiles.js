/**
 * SCREEN TILES — a pierced screen over a light's glass drawn as ONE cutout card, not as its bars: a star field has
 * hundreds of bars a light (far past a house's triangle budget, era/out-structures.js STRUCTURE_RINGS), so the screen
 * is painted into a tile instead: white where the bars run, transparent between, one period of the field a tile.
 * The card's own colour (the trim's paint, lit) multiplies the white, so the screen is the trim's, no hue of its own.
 *
 *   screenKey({ pitch, bar })   → `screen:khatam-<pitch mm>-<bar mm>`: the khatam star field (octagons and their gap
 *                                 squares, PIC at the arabesque library's contact angles, polygonizer/arabesque.js),
 *                                 a cell `pitch` metres, its bars `bar` wide; the key's texture registered (`screen:`)
 *   screenUv(u, z, uc, zc, pitch) the card's uv at a point of the wall: an octagon centred on (uc, zc)
 *
 * Pure: no dice. A tile is painted once a key.
 */
import { octagonSquareTiling, tileMotif } from '../polygonizer/arabesque.js';
import { encodePngRgba, registerTextureResolver } from '../landscape/surface-textures.js';

const SIZE = 256, CONTACT = { oct: 67, square: 55 };
const r4 = (v) => Math.round(v * 1e4) / 1e4;

/** The key of a khatam screen `pitch` metres a cell, its bars `bar` metres wide. */
export const screenKey = ({ pitch, bar }) => `screen:khatam-${Math.round(pitch * 1000)}-${Math.round(bar * 1000)}`;
/** The card's uv at (u, z): one cell a unit, an octagon's centre at (uc, zc) (the tile's middle). */
export const screenUv = (u, z, uc, zc, pitch) => [r4((u - uc) / pitch + 0.5), r4((z - zc) / pitch + 0.5)];

// one period of the field, `bar` a fraction of it: alpha 255 on a bar, 0 off; the bars white
function paint(pitchMm, barMm) {
  const pitch = 1, bar = barMm / pitchMm, R = pitch / (2 * Math.cos(Math.PI / 8)), { octs, squares } = octagonSquareTiling(3, 3, R);
  const segs = [...octs.flatMap((t) => tileMotif(t, CONTACT.oct)), ...squares.flatMap((t) => tileMotif(t, CONTACT.square))];
  const a = new Uint8Array(SIZE * SIZE), h = (bar / 2) * SIZE, wrap = (v) => ((v % SIZE) + SIZE) % SIZE;
  // (the octagon at (1, 1) to the tile's middle: a texel x is (p − 1 + 0.5) · SIZE)
  for (const [p, q] of segs) {
    const ax = (p.x - 0.5) * SIZE, ay = (p.y - 0.5) * SIZE, bx = (q.x - 0.5) * SIZE, by = (q.y - 0.5) * SIZE, dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
    for (let y = Math.floor(Math.min(ay, by) - h - 1); y <= Math.ceil(Math.max(ay, by) + h + 1); y++) for (let x = Math.floor(Math.min(ax, bx) - h - 1); x <= Math.ceil(Math.max(ax, bx) + h + 1); x++) {
      const t = Math.max(0, Math.min(1, ((x + 0.5 - ax) * dx + (y + 0.5 - ay) * dy) / l2)), ex = x + 0.5 - ax - t * dx, ey = y + 0.5 - ay - t * dy;
      if (ex * ex + ey * ey <= h * h) a[wrap(y) * SIZE + wrap(x)] = 255;
    }
  }
  return a;
}

const PAINTED = new Map();
/** The screen's texels: { W, H, a } (alpha; the colour is white). */
export function screenTexels(key) {
  const m = /^screen:khatam-(\d+)-(\d+)$/.exec(key);
  if (!m) return null;
  return { W: SIZE, H: SIZE, a: paint(+m[1], +m[2]) };
}
registerTextureResolver('screen:', (key) => {
  if (PAINTED.has(key)) return PAINTED.get(key);
  const T = screenTexels(key);
  if (!T) return null;
  const rgba = Buffer.alloc(T.W * T.H * 4, 255);
  for (let i = 0; i < T.W * T.H; i++) rgba[i * 4 + 3] = T.a[i];
  const url = `data:image/png;base64,${encodePngRgba(rgba, T.W, T.H).toString('base64')}`;
  PAINTED.set(key, url);
  return url;
});
