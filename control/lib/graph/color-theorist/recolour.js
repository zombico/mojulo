/**
 * RECOLOUR — a nature or jungle stage (era/nature.js, era/jungle.js) painted in a palette. Those kits colour by
 * multiplying coloured tiles and cards by tints, so a palette can't reach them through ramps the way it reaches the
 * isekai kits. Here each face keeps its own LIGHTNESS (the card's value laws hold: the trail brightest, then the sunlit
 * rock, the grass, the foliage) and takes its hue and chroma from the palette role its surface plays: the trail the
 * soil, the meadow the ground, the cliff and scree the rock, boughs and leaves the foliage, wood the bark, the blazes
 * the accent, the far ridges the far layers. A tiled face swaps its tile for the tile's EVEN twin (era/tone.js: its
 * greys, its median at EVEN_LEVEL), so its tint lands on the colour it names; its detail is the tile's own value.
 * The card's sun, fill, haze and sky are the palette's.
 *
 * It reads the palette as stored data (`palette`: the roles' middle stops, light, shadow, fog, sky, key, written at
 * authoring by color-theorist/adapters.js natureColours), never the solver, so the kits import nothing heavy.
 *
 *   recolourCard(st, P)      → the style card with its light and air in the palette
 *   recolourFaces(faces, P)  → the faces in the palette (before the bake: tints; after it: fills)
 *   roleOf(face)             → the palette role a face plays, or null (left as it is)
 *
 * Pure but for the texture cache (a tile's mean colour, read once).
 */
import { oklch, lchOf, hexToRgb, rgbToHex, rgbToOklab } from './oklab.js';
import { decodePng, EVEN_LEVEL } from '../era/tone.js';
import { surfaceTexture } from '../landscape/surface-textures.js';

const KEY_SHIFT = { high: 0.05, mid: 0, low: -0.1 };
const clamp01 = (v) => Math.max(0, Math.min(1, v));

/** The palette role a face plays, by its group and its tile. */
export function roleOf(f) {
  const g = f.group || '', t = typeof f.texture === 'string' ? f.texture.replace(/^even:/, '') : '';
  if (g === 'trail:shadow' || g === 'jungle:shaft') return null;
  if (g === 'trail:blaze') return 'accent';
  if (g === 'trail:water') return 'water';
  if (g === 'trail:ridge') return 'far';
  if (/^bark-|^card:roots/.test(t) || ['jungle:wood', 'jungle:liana', 'jungle:twig', 'jungle:fern-trunk'].includes(g)) return 'bark';
  if (/^card:(bough|spray|broadleaf|fern|bamboo|vine)/.test(t) || ['trail:bough', 'jungle:moss', 'jungle:bamboo', 'jungle:crown', 'jungle:canopy', 'jungle:under', 'jungle:wall', 'jungle:fern', 'jungle:bamboo-leaf', 'jungle:epiphyte', 'jungle:vine'].includes(g)) return 'foliage';
  if (/^card:litter/.test(t) || g === 'jungle:litter') return 'soil';
  if (/^card:(grass|meadow)|^grass-/.test(t) || ['trail:grassblend', 'trail:grass', 'trail:top', 'jungle:grass'].includes(g)) return 'ground';
  if (/^soil-(dirt|mud)/.test(t)) return 'soil';
  if (/^soil-scree|^rock-|^slate/.test(t) || ['trail:cliff', 'trail:rock'].includes(g)) return 'rock';
  if (g === 'trail:tree' || g === 'trail:debris') return 'wood?';
  if (g === 'trail:ground') return 'ground';
  return null;
}

// a tile's mean colour (0…1), over its opaque texels
const MEANS = new Map();
function meanOf(key) {
  if (MEANS.has(key)) return MEANS.get(key);
  const d = decodePng(surfaceTexture(key));
  let m = [1, 1, 1];
  if (d) {
    const s = [0, 0, 0]; let n = 0;
    for (let i = 0; i < d.W * d.H; i++) if (d.px[i * 4 + 3] > 127) { for (let k = 0; k < 3; k++) s[k] += d.px[i * 4 + k]; n += 1; }
    if (n) m = s.map((v) => v / n / 255);
  }
  MEANS.set(key, m);
  return m;
}

/** The colour a face is in the palette: its stock albedo's lightness (moved by the palette's key), its role's hue and
 * chroma. A fill-only face in a tree or the debris is wood when its stock colour is warm and dull, foliage when green. */
function target(f, albedo, P) {
  let role = roleOf(f);
  if (role === 'wood?') { const [, C, h] = lchOf(albedo.map((v) => v * 255)); role = C > 0.03 && h > 100 && h < 170 ? 'foliage' : 'bark'; }
  if (!role) return null;
  const ref = P.roles[role];
  if (!ref) return null;
  const [L0] = rgbToOklab(albedo.map((v) => clamp01(v) * 255)), [, C, h] = lchOf(hexToRgb(ref));
  return oklch(clamp01(L0 + (KEY_SHIFT[P.key] ?? 0)), C, h).map((v) => v / 255);
}

const r4 = (v) => Math.round(v * 10000) / 10000;
/** The faces in the palette. Before the bake a face carries `tint` (over its tile, if it has one); after it, `fill`. */
export function recolourFaces(faces, P) {
  if (!P?.roles) return faces;
  return faces.map((f) => {
    const tex = typeof f.texture === 'string' && !f.texture.startsWith('even:') ? f.texture : null;
    if (Array.isArray(f.tint)) {
      const base = tex ? meanOf(tex) : [1, 1, 1], albedo = f.tint.map((v, k) => v * base[k]), c = target(f, albedo, P);
      if (!c) return f;
      return tex ? { ...f, texture: `even:${tex}`, tint: c.map((v) => r4(v / EVEN_LEVEL)) } : { ...f, tint: c.map(r4) };
    }
    if (typeof f.fill === 'string' && /^#[0-9a-f]{6}$/i.test(f.fill) && !tex) {
      const c = target(f, hexToRgb(f.fill).map((v) => v / 255), P);
      return c ? { ...f, fill: rgbToHex(c.map((v) => v * 255)) } : f;
    }
    return f;
  });
}

/** The card's light and air in the palette: the sun its light, the fill its ambient, the haze its fog, the sky its own. */
export function recolourCard(st, P) {
  if (!P?.roles) return st;
  return {
    ...st,
    light: { ...st.light, key: { ...st.light.key, color: P.light }, ambient: P.ambient },
    air: { ...st.air, fog: { ...st.air.fog, color: P.fog }, dome: { ...st.air.dome, zenith: P.sky.zenith, horizon: P.sky.horizon } },
    // a jungle's colour grade leans every colour warm-green: in a palette its tint is neutral (its lift kept, grey)
    ...(st.grade ? { grade: { ...st.grade, ...(st.grade.tint ? { tint: [1, 1, 1] } : {}), ...(st.grade.lift ? { lift: st.grade.lift.map(() => st.grade.lift.reduce((a, b) => a + b, 0) / st.grade.lift.length) } : {}) } } : {}),
  };
}
