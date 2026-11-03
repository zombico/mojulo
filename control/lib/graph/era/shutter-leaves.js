/**
 * THE SHUTTER LEAVES — the design library's shutters drawn as RELIEF, not geometry: a leaf stays one box on the wall
 * (era/out-openings.js shutterDress) and its front wears its form as a painted tile with a height map behind it. The
 * tile carries the form from afar (its slats', boards' and panels' shadows painted under a light from above, as the
 * town's stone is: matte-paint/dressed.js); near the eye the page marches the height along the view
 * (scene/channels/leaf-relief.js), so a slat's shadow line sinks behind the slat over it and a panel stands in its frame.
 * A street of shutters costs the boxes it had.
 *
 *   SHUTTER_LEAVES            { form: { read, depth (m, its deepest relief), height(u, v) → m proud of the leaf's back } }
 *                             on a leaf LEAF.w × LEAF.h metres (u across it, v up it); the tile is stretched to each leaf
 *   SHUTTER_LEAF_IDS          the forms' ids, in the library's order
 *   leafKey(form)             the colour tile's key ('leaf:<form>'), served by the `leaf:` texture resolver: a grey set to
 *                             DETAIL_MEAN (matte-paint/detail.js), so the face's own paint and light ride under it
 *   leafRelief(form)          { W, H, depth, height (a data URL: the height map, grey, white the crest) } for the page
 *   leafPage(keys)            the page's cfg for the leaf keys a scene laid (channels/leaf-relief.js), or null
 *   layLeaf(face, form, mirror?)   a leaf's front face (four corners, its foot first, as wallBox lays it) wearing its tile:
 *                             uv the leaf's own (0–1 across and up), its fill lifted as a detail's is
 *
 * A new look is a row. Pure: no dice (a grain from a hash of the texel); the same form paints the same bytes.
 */
import { DETAIL_MEAN } from '../matte-paint/detail.js';
import { encodePng, registerTextureResolver } from '../landscape/surface-textures.js';

/** The leaf a tile is painted on (m): a shutter beside a metre-wide light, as tall as the light. */
export const LEAF = Object.freeze({ w: 0.5, h: 1.5, px: 0.005 });
// a frame's parts (m): the stiles, the rails, how proud the frame stands of the field it holds
const STILE = 0.055, RAIL = 0.07, FRAME = 0.016;
const inFrame = (u, v, mid) => u < STILE || u > LEAF.w - STILE || v < RAIL || v > LEAF.h - RAIL || Math.abs(v - mid) < RAIL / 2;

export const SHUTTER_LEAVES = Object.freeze({
  persiana: {
    read: 'a louvred leaf in a frame of stiles and rails, a rail across its middle: the slatted shutter of a southern street',
    depth: FRAME,
    height(u, v) {
      const mid = LEAF.h * 0.42;
      if (inFrame(u, v, mid)) return FRAME;
      // each slat sloped out and down (its foot proud, its head back under the slat over it), a dark slot under its foot
      const z0 = v < mid ? RAIL : mid + RAIL / 2, p = 0.085, t = ((v - z0) / p) % 1;
      return t < 0.14 ? 0 : 0.002 + 0.012 * (1 - (t - 0.14) / 0.86);
    },
  },
  panelled: {
    read: 'a framed leaf of two fielded panels, each bevelled to its frame: the panelled shutter of a stone town house',
    depth: FRAME,
    height(u, v) {
      const mid = LEAF.h * 0.45;
      if (inFrame(u, v, mid)) return FRAME;
      // the distance to the panel's edge: a groove at the frame, a bevel up to the raised field
      const lo = v < mid ? RAIL : mid + RAIL / 2, hi = v < mid ? mid - RAIL / 2 : LEAF.h - RAIL;
      const e = Math.min(u - STILE, LEAF.w - STILE - u, v - lo, hi - v);
      return e < 0.006 ? 0 : e < 0.036 ? 0.003 + (0.009 * (e - 0.006)) / 0.03 : 0.012;
    },
  },
  ledged: {
    read: 'upright boards, their joints dark, held by two ledges and a brace between them: the board shutter of a cottage or a barn',
    depth: 0.032,
    height(u, v) {
      const l0 = [0.16, 0.25], l1 = [LEAF.h - 0.25, LEAF.h - 0.16];
      if ((v > l0[0] && v < l0[1]) || (v > l1[0] && v < l1[1])) return u > 0.03 && u < LEAF.w - 0.03 ? 0.032 : 0.012;
      // the brace, from the foot ledge's hinge end up to the head ledge's latch end
      if (v > l0[1] && v < l1[0]) {
        const a = [0.07, l0[1]], b = [LEAF.w - 0.07, l1[0]], d = [b[0] - a[0], b[1] - a[1]], L = Math.hypot(d[0], d[1]);
        if (Math.abs(((u - a[0]) * d[1] - (v - a[1]) * d[0]) / L) < 0.0375) return 0.026;
      }
      const bw = LEAF.w / 5, j = u % bw;
      return j < 0.004 || j > bw - 0.004 ? 0 : 0.012 - 0.003 * (Math.min(j, bw - j) < 0.012 ? 1 - Math.min(j, bw - j) / 0.012 : 0);
    },
  },
});
export const SHUTTER_LEAF_IDS = Object.freeze(Object.keys(SHUTTER_LEAVES));

const lin = (v) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const srgb = (c) => 255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
const rgbOf = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hexOf = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const grain = (i, j) => { const s = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453; return s - Math.floor(s); };
// the light a leaf is painted under: from above and in front, 50° off the face's normal; the share of it that is sky
const SUN = Object.freeze({ up: Math.sin((50 * Math.PI) / 180), out: Math.cos((50 * Math.PI) / 180), ambient: 0.45 });

const PAINT = new Map();
function paint(form) {
  if (PAINT.has(form)) return PAINT.get(form);
  const S = SHUTTER_LEAVES[form], W = Math.round(LEAF.w / LEAF.px), H = Math.round(LEAF.h / LEAF.px), px = LEAF.px;
  // (rows from the leaf's head down, as an image is: row 0 its top)
  const h = new Float32Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) h[j * W + i] = S.height((i + 0.5) * px, LEAF.h - (j + 0.5) * px);
  const at = (i, j) => h[Math.min(H - 1, Math.max(0, j)) * W + Math.min(W - 1, Math.max(0, i))];
  const shade = new Float32Array(W * H), flat = SUN.ambient + (1 - SUN.ambient) * SUN.out;
  let mean = 0;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const k = j * W + i, z = h[k];
    // its slope (v up the leaf: row j−1 is above), lit against the flat leaf's light
    const dx = (at(i + 1, j) - at(i - 1, j)) / (2 * px), dy = (at(i, j - 1) - at(i, j + 1)) / (2 * px), l = Math.hypot(dx, dy, 1);
    let s = (SUN.ambient + (1 - SUN.ambient) * Math.max(0, (-dy * SUN.up + SUN.out) / l)) / flat;
    // the shadow cast down onto it by what stands over it, toward the light
    for (let k2 = 1; k2 <= 10; k2++) if (at(i, j - k2) - z > (k2 * px * SUN.out) / SUN.up) { s *= 0.55; break; }
    // the hollows darker (a slot, a joint, a groove): its depth under the crest
    s *= 1 - 0.35 * Math.max(0, 1 - z / (S.depth * 0.5));
    s *= 0.96 + 0.08 * grain(i, j);
    shade[k] = s; mean += s;
  }
  mean /= W * H;
  const rgb = Buffer.alloc(W * H * 3), hb = Buffer.alloc(W * H * 3);
  for (let k = 0; k < W * H; k++) {
    const g = Math.round(srgb(Math.min(1, (shade[k] / mean) * DETAIL_MEAN))), y = Math.round((255 * h[k]) / S.depth);
    rgb[k * 3] = rgb[k * 3 + 1] = rgb[k * 3 + 2] = g;
    hb[k * 3] = hb[k * 3 + 1] = hb[k * 3 + 2] = y;
  }
  const P = { W, H, colour: `data:image/png;base64,${encodePng(rgb, W, H).toString('base64')}`, height: `data:image/png;base64,${encodePng(hb, W, H).toString('base64')}` };
  PAINT.set(form, P);
  return P;
}

export const leafKey = (form) => `leaf:${form}`;
registerTextureResolver('leaf:', (key) => (SHUTTER_LEAVES[key.slice(5)] ? paint(key.slice(5)).colour : null));

/** A form's relief for the page's parallax: the height map and how deep it is. */
export function leafRelief(form) {
  const S = SHUTTER_LEAVES[form];
  if (!S) return null;
  const P = paint(form);
  return { W: P.W, H: P.H, depth: S.depth, height: P.height };
}

/** The parallax's march (channels/leaf-relief.js): its steps, and the distances (m) it fades out between. */
export const LEAF_POM = Object.freeze({ steps: 10, near: 6, far: 14 });
/** The page's cfg for the leaf keys among `keys` (a scene's textures), or null when it laid none. */
export function leafPage(keys) {
  const maps = {};
  for (const key of keys) if (typeof key === 'string' && key.startsWith('leaf:')) { const R = leafRelief(key.slice(5)); if (R) maps[key] = { height: R.height, depth: R.depth }; }
  return Object.keys(maps).length ? { maps, pom: { ...LEAF_POM } } : null;
}

const UV = Object.freeze([[0, 0], [1, 0], [1, 1], [0, 1]]);
const lift = (hex) => hexOf(rgbOf(hex).map((v) => srgb(Math.min(1, lin(v) / DETAIL_MEAN))));
/** A leaf's front face wearing its form's tile. `mirror`: its corners were reversed (a mirrored house), the uv with them. */
export function layLeaf(face, form, mirror = false) {
  if (!SHUTTER_LEAVES[form] || face.corners?.length !== 4 || typeof face.fill !== 'string') return face;
  return { ...face, texture: leafKey(form), textureLit: true, uv: (mirror ? UV.slice().reverse() : UV).map((p) => p.slice()), fill: lift(face.fill), ...(face.cornerFills ? { cornerFills: face.cornerFills.map(lift) } : {}) };
}
