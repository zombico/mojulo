/**
 * value.js — THE VALUE STAGE's STAND-IN: the colour roles a stylism hero's designed pieces wear, until a style guide's
 * palette (the color theorist, lib/graph/color-theorist on its own branch) supplies them. It decides only what a
 * palette must answer locally, and leaves the palette itself to the guide:
 *
 *   LOCAL CONTRAST   each role a clear value step (L*) from what it sits on: the base cloth from the shirt it covers,
 *                    the secondary from the base and the shirt, the accent from both (outfit-plan.js `outfitLaws`
 *                    'clear value steps')
 *   THE COMPLEMENT   the accent is the dominant hue turned half the wheel: the one place the chroma is spent
 *   MATERIALS        what is metal or leather is its MATERIAL's colour, never the palette's: the plate, the fittings
 *                    (the trim) and the straps come from the genre's materials (genres.js), the register choosing how
 *                    precious; a fitting is the first of them a clear step from the base
 *
 *   standInPalette(G, r, card)  → { roles: { base, secondary, accent, trim, metal, leather }, why: { role: note } }
 *     G the genre card, r the register (0 … 1), card the outfit card's own `tones` (the cloth already worn: Top, Bottom,
 *     Outer)
 *   MATERIAL_SWATCHES           each material word's colour
 * Pure and deterministic.
 */
import { hexLch, lchHex } from '../polygonizer/station-loft-shade.js';

export const MATERIAL_SWATCHES = Object.freeze({
  brass: '#b8913f', iron: '#5d6168', gold: '#d4ab4c', zinc: '#a3a8ad', steel: '#8b929a', chrome: '#cfd3d8',
  'anodised alloy': '#46617f', gunmetal: '#3e4349', nacre: '#ddd6e8', chitin: '#3a2c3c', 'iridescent alloy': '#6e93ad',
  leather: '#5a3a22', rubber: '#26282c', 'ballistic nylon': '#3b4036', 'resin weave': '#5b4a3a',
});
// a near-grey card leaves no hue to lead with: the genre's own (a warm fantasy, a cool modern and sci-fi, a violet alien)
const GENRE_HUE = { fantasy: 40, modern: 225, scifi: 205, alien: 295 };
const r0 = (x) => Math.round(x);
const lerp = (a, b, t) => a + (b - a) * t;
const wrap = (h) => ((h % 360) + 360) % 360;
/** the colour at L*, C, h, its chroma eased down until its value holds in gamut */
const keepL = (L, C, H) => { for (let c = C; c >= 0; c -= 2) { const hex = lchHex(L, c, H); if (Math.abs(hexLch(hex)[0] - L) < 1) return hex; } return lchHex(L, 0, H); };
const clear = (x, from, by) => from.every((y) => Math.abs(x - y) >= by);
const inBand = (x) => x >= 16 && x <= 88;

export function standInPalette(G, r, card = {}, genre = 'fantasy') {
  const M = G.materials, cloth = ['Top', 'Outer', 'Bottom'].filter((k) => card[k]).map((k) => [k, hexLch(card[k])]);
  // the dominant hue: the card's most chromatic cloth, else the genre's
  const lead = cloth.reduce((b, c) => (c[1][1] >= 8 && (!b || c[1][1] > b[1][1]) ? c : b), null);
  const H = lead ? lead[1][2] : GENRE_HUE[genre] ?? 40, Cmax = lerp(18, 46, r);
  const under = cloth.find(([k]) => k === 'Outer') ?? cloth.find(([k]) => k === 'Top') ?? cloth[0];
  const Lu = under ? under[1][0] : 60, Lcloth = cloth.map(([, c]) => c[0]);
  // the base: a step off the cloth it covers, in the dominant hue, moderate
  let Lb = [Lu > 52 ? Lu - 28 : Lu + 28, Lu > 52 ? Lu - 38 : Lu + 38, Lu > 52 ? Lu + 22 : Lu - 22].find((x) => inBand(x) && clear(x, [Lu], 20)) ?? (Lu > 52 ? 24 : 80);
  // the fittings: the genre's metals, plain to precious by the register, the first a clear step from the base; none
  // clears it ⇒ the base moves to a value that clears both its metal and the cloth (the material stays itself)
  const fit = M.fitting ?? M.metal, start = Math.min(fit.length - 1, Math.round(r * (fit.length - 1)));
  const order = [...fit.slice(start), ...fit.slice(0, start).reverse()].filter((m) => MATERIAL_SWATCHES[m]);
  const Lof = (m) => hexLch(MATERIAL_SWATCHES[m])[0];
  let trimWord = order.find((m) => clear(Lof(m), [Lb], 18));
  if (!trimWord) { trimWord = order[0]; const Lm = Lof(trimWord); let best = null;
    for (let x = 16; x <= 88; x++) if (clear(x, [Lu], 20) && clear(x, [Lm], 18) && (best === null || Math.abs(x - Lb) < Math.abs(best - Lb))) best = x;
    if (best !== null) Lb = best; }
  const trim = MATERIAL_SWATCHES[trimWord] ?? '#b8913f', Lt = hexLch(trim)[0];
  // the secondary: an analogous neighbour, a step from the base and the fitting, and off the cloth
  const near = (ok) => { let best = null; for (let x = 16; x <= 88; x++) if (ok(x) && (best === null || Math.abs(Math.abs(x - Lb) - 22) < Math.abs(Math.abs(best - Lb) - 22))) best = x; return best; };
  const Ls = near((x) => clear(x, [Lb, Lt], 16) && clear(x, Lcloth, 12)) ?? near((x) => clear(x, [Lb, Lt], 16)) ?? (Lb < 50 ? Lb + 22 : Lb - 22);
  // the accent: the complement, the chroma spent there, a step from the base and the secondary; of the values that
  // clear them, the one where the complement's hue holds the most chroma (a yellow is bright, a blue deep)
  const Ha = wrap(H + 180), want = Cmax * 1.15;
  const La = [Lb + 40, Lb - 40, Lb + 30, Lb - 30, Ls + 18, Ls - 18, Lb + 52, Lb - 52].filter((x) => inBand(x) && clear(x, [Lb, Ls], 15))
    .map((x) => [x, hexLch(keepL(x, want, Ha))[1]]).reduce((b, c) => (!b || c[1] > b[1] + 0.5 ? c : b), null)?.[0] ?? (Lb < 50 ? 78 : 30);
  const plateWord = M.plate ?? M.metal[0], strapWord = M.strap ?? 'leather';
  const roles = { base: keepL(Lb, Cmax * 0.6, H), secondary: keepL(Ls, Cmax * 0.5, wrap(H + 40)), accent: keepL(La, want, Ha),
    trim, metal: MATERIAL_SWATCHES[plateWord] ?? '#5d6168', leather: MATERIAL_SWATCHES[strapWord] ?? '#5a3a22' };
  const why = {
    base: `${r0(Math.abs(Lb - Lu))} L* off the ${under ? under[0].toLowerCase() : 'cloth'} it covers, in the outfit's own hue (${r0(H)}°): local contrast where they meet`,
    secondary: `an analogous neighbour (${r0(wrap(H + 40))}°), ${r0(Math.abs(Ls - Lb))} L* from the base: the second value`,
    accent: `the complement (${r0(wrap(H + 180))}°) and the chroma spent there, ${r0(Math.abs(La - Lb))} L* from the base: it sits on the focal`,
    trim: `${trimWord}, the genre's fitting at this register, ${r0(Math.abs(hexLch(trim)[0] - Lb))} L* from the base: a material, not a palette colour`,
    metal: `${plateWord}: what the plates are made of`,
    leather: `${strapWord}: what the straps are made of`,
  };
  return { roles, why };
}
