/**
 * SEEN LAWS — the color theorist tests what is rendered. Its palette laws (solve.js) run on swatches; these run on a
 * render: each role's colours as they came out (lit and in shade, sampled by role off a page in either era, or an
 * engine's frame) against the palette that asked for them. Advice and a stamp, never a refusal (docs/bicycles.md).
 *
 *   seenLaws(seen, palette) → [{ law, ok, value }]
 *     seen      { roles: { <role>: { lit?, shade? } }, swatches?: { <role>: { lit, shade } } }: display hex; `roles` the
 *               role's faces turned to the sun and turned away, averaged; `swatches` a patch square to the sun and one
 *               under the sky alone (the light's own test)
 *     palette   { targets: { <role>: { lit, shade } }, sky: '#hex', accent?: <role> }
 *   laws:
 *     targets            each swatch within TARGET_TOL of its target, lit and shade (the light solved is the light drawn)
 *     value-order        roles the palette parts clearly in lightness (VALUE_GAP in OKLab L) keep that order lit
 *     accent             the accent the most chromatic role seen (where it is sampled)
 *     shade-is-a-colour  a role's shade is never black (L ≥ SHADE_FLOOR) and, where its lit colour has a hue, leans
 *                        toward the sky's hue from it: shade is the sky's light, not the lit colour darkened
 *   A law with nothing to read (no swatches, one role, no accent) is left out, not passed.
 */
import { hexToRgb, lchOf, hueGap } from './oklab.js';

/** How far a swatch may stand from its target, the largest channel's step out of 255. */
export const TARGET_TOL = 6;
/** How far apart in OKLab lightness two roles must be before their order is a law. */
export const VALUE_GAP = 0.08;
/** The darkest a shade may read (OKLab L): below it, it reads as black. */
export const SHADE_FLOOR = 0.12;
/** Below this chroma a colour has no hue to lean. */
const GREY = 0.03;

const lch = (hex) => lchOf(hexToRgb(hex));
const off = (a, b) => Math.max(...hexToRgb(a).map((v, k) => Math.abs(v - hexToRgb(b)[k])));

export function seenLaws(seen, palette) {
  const out = [], T = palette.targets, R = seen.roles ?? {};
  if (seen.swatches && Object.keys(seen.swatches).length) {
    const bad = Object.entries(seen.swatches).flatMap(([r, w]) => ['lit', 'shade'].filter((k) => w[k] && T[r]?.[k] && off(w[k], T[r][k]) > TARGET_TOL).map((k) => `${r} ${k} ${w[k]} for ${T[r][k]} (${off(w[k], T[r][k])} off)`));
    out.push({ law: 'targets', ok: !bad.length, value: bad.length ? bad.join('; ') : `every swatch within ${TARGET_TOL} of its target` });
  }
  const lit = Object.keys(R).filter((r) => R[r].lit && T[r]?.lit);
  if (lit.length >= 2) {
    const flips = [];
    for (const a of lit) for (const b of lit) {
      const [La] = lch(T[a].lit), [Lb] = lch(T[b].lit);
      if (La - Lb >= VALUE_GAP && !(lch(R[a].lit)[0] > lch(R[b].lit)[0])) flips.push(`${a} under ${b}`);
    }
    out.push({ law: 'value-order', ok: !flips.length, value: flips.length ? `seen out of the palette's order: ${flips.join(', ')}` : `${lit.length} roles in the palette's order of lightness` });
  }
  if (palette.accent && R[palette.accent]?.lit) {
    const C = (r) => lch(R[r].lit)[1], rivals = lit.filter((r) => r !== palette.accent && C(r) > C(palette.accent));
    out.push({ law: 'accent', ok: !rivals.length, value: rivals.length ? `${rivals.join(', ')} more chromatic than the accent` : 'the accent the most chromatic role seen' });
  }
  const shaded = Object.keys(R).filter((r) => R[r].lit && R[r].shade);
  if (shaded.length && palette.sky) {
    const [, , hSky] = lch(palette.sky), bad = [];
    for (const r of shaded) {
      const [Ls] = lch(R[r].shade), [, Cl, hl] = lch(R[r].lit), [, , hs] = lch(R[r].shade);
      if (Ls < SHADE_FLOOR) bad.push(`${r}'s shade black (L ${Ls.toFixed(2)})`);
      else if (Cl >= GREY && !(hueGap(hs, hSky) < hueGap(hl, hSky))) bad.push(`${r}'s shade not toward the sky (${Math.round(hueGap(hs, hSky))}° off it, its lit ${Math.round(hueGap(hl, hSky))}°)`);
    }
    out.push({ law: 'shade-is-a-colour', ok: !bad.length, value: bad.length ? bad.join('; ') : `${shaded.length} roles' shade a colour, toward the sky` });
  }
  return out;
}
