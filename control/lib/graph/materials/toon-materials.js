/**
 * TOON MATERIALS — a hero's materials (materials/dress-materials.js, `recipe.surfaces`) lowered for the character light
 * (the anime look, polygonizer/station-loft-shade.js), where a material is DRAWN, not reflected: it decides each group's
 * step, its shade swatch and its highlight, in the light's own terms. The live metal shader's continuous reflection
 * would fight the cel bands, so an anime hero never takes it; it takes this.
 *
 *   toonMaterials(surfaces, palette) → { thresholds, shade, highlight } for the groups that have a material, or null
 *
 * By material:
 *   metal          a higher step (more of the piece in shade: metal reads by its dark), a dark shade leaning the way a
 *                  painter leans the metal (gold, brass, bronze and copper toward red-orange, steel toward blue), and a
 *                  gloss tinted by the metal's own measured colour (materials/metal-surface.js), so gold and steel are
 *                  told apart by real optics while drawn in bands
 *   lacquer, satin, enamel, paint   the light's own step and shade, a small sharp gloss (the lacquer pop)
 *   leather        a little more shade, a warm shade, a dull wide gloss
 *   glass          a small hard white gloss
 *   cloth, rubber  no highlight; rubber a deeper shade
 *   the cloths     silk a broad soft gloss, velvet a deep rich shade (more of it in shade), wool a soft low-contrast step,
 *                  denim a cool shade, nylon and the synthetics a small gloss; linen, cotton, canvas the light's own
 * The highlight rules are the light's resolved form ({ kind: 'gloss', threshold, band, colour }); `colour` is the swatch
 * the step's third tone takes (the light otherwise derives one from the base).
 */
import { resolveMaterial } from '../polygonizer/materials.js';
import { resolveMetalSurface, isMetalSurface, METAL_NAMES } from './metal-surface.js';
import { hexToRgb, rgbToHex, lchOf, oklch, mixHue } from '../color-theorist/oklab.js';

// the numbers: the eyes gate's to move
export const TOON_MATERIAL = Object.freeze({
  metal: Object.freeze({ threshold: 0.2, shadeL: 0.44, shadeC: 1.25, lean: 18, gloss: 0.87, glossL: 0.95, glossC: 0.45 }),
  satin: Object.freeze({ gloss: 0.92, glossLift: 0.55 }),
  leather: Object.freeze({ threshold: 0.08, shadeL: 0.62, lean: 8, gloss: 0.86, glossLift: 0.2, band: 0.4 }),
  glass: Object.freeze({ gloss: 0.88 }),
  rubber: Object.freeze({ shadeL: 0.55 }),
  // the cloths (dress-materials.js CLOTHS), drawn: silk a broad soft sheen, velvet a deep rich shade with more of it in
  // shade, wool a soft low-contrast step, denim a cool shade, the synthetics a small sheen; linen, cotton and canvas the
  // light's own cloth
  silk: Object.freeze({ gloss: 0.86, glossLift: 0.28 }),
  velvet: Object.freeze({ threshold: 0.22, shadeL: 0.6, shadeC: 1.15 }),
  wool: Object.freeze({ threshold: -0.06, shadeL: 0.82, shadeC: 0.9 }),
  denim: Object.freeze({ shadeL: 0.7, lean: 0.25 }),
  nylon: Object.freeze({ gloss: 0.9, glossLift: 0.45 }),
});
const CLOTH_CLASS = Object.freeze({ silk: 'silk', 'spun filament': 'silk', membrane: 'silk', velvet: 'velvet', wool: 'wool', felt: 'wool', denim: 'denim',
  nylon: 'nylon', polymer: 'nylon', 'carbon weave': 'nylon', 'resin weave': 'nylon', linen: 'cloth', cotton: 'cloth', canvas: 'cloth', 'ballistic nylon': 'cloth' });
// GREY_C: the chroma under which a tone reads as grey (a steel's own colour), so its shade may lean cool
const WARM = 40, STEEL = 255, GREY_C = 0.08;
const lchHex = (hex) => lchOf(hexToRgb(hex));
const hexOf = (L, C, h) => rgbToHex(oklch(L, C, h));
const gloss = (threshold, colour, band = 1) => ({ kind: 'gloss', threshold, band: [0, band], colour });
// a lift toward white by a share of the way, the hue kept
const lifted = (hex, k) => { const [L, C, h] = lchHex(hex); return hexOf(L + (1 - L) * k, C * (1 - 0.5 * k), h); };

// what a surface spec is, as the toon light reads it
function classOf(spec) {
  if (spec && typeof spec === 'object' && isMetalSurface(spec)) return 'metal';
  const name = typeof spec === 'string' ? spec : spec?.preset;
  if (Object.hasOwn(CLOTH_CLASS, name)) return CLOTH_CLASS[name];
  if (name === 'leather') return 'leather';
  if (name === 'glass') return 'glass';
  if (name === 'rubber') return 'rubber';
  if (name === 'satin' || name === 'enamel' || name === 'ceramic' || name === 'plastic') return 'satin';
  const row = resolveMaterial(spec);
  return row?.metal ? 'metal' : 'cloth';
}

// a SHELF material that is a metal (a name: 'gold', 'chrome', 'gunmetal', polygonizer/materials.js) drawn as the metal of
// that name, or as steel when the optics table holds none (gunmetal is a dark steel)
const metalSpec = (spec) => {
  if (spec && typeof spec === 'object' && isMetalSurface(spec)) return spec;
  const name = typeof spec === 'string' ? spec : spec?.preset;
  return { metal: METAL_NAMES.includes(name) ? name : 'steel' };
};

/** A hero's surfaces lowered for the character light → { thresholds, shade, highlight }, or null when none applies. */
export function toonMaterials(surfaces, palette = {}) {
  if (!surfaces || typeof surfaces !== 'object') return null;
  const thresholds = {}, shade = {}, highlight = {};
  for (const [g, spec] of Object.entries(surfaces)) {
    const tone = palette[g];
    if (typeof tone !== 'string' || !/^#[0-9a-f]{6}$/i.test(tone)) continue;
    const kind = classOf(spec), [L, C, h] = lchHex(tone);
    if (kind === 'metal') {
      const M = TOON_MATERIAL.metal, s = resolveMetalSurface(metalSpec(spec)), warm = s.metal !== 'steel' && s.metal !== 'stainless' && s.metal !== 'aluminium' && s.metal !== 'titanium' && s.metal !== 'chrome' && s.metal !== 'nickel' && s.metal !== 'silver';
      const [, mC, mh] = lchHex(s.hex);
      thresholds[g] = M.threshold;
      // the shade leans the way a painter leans the metal: warm metals toward red-orange, the greys toward blue (a grey
      // tone half way, a coloured one hardly: an orange body worked in steel keeps its orange in shade, never magenta)
      const cool = 0.5 * Math.max(0, 1 - C / GREY_C);
      shade[g] = hexOf(L * M.shadeL, Math.max(C * M.shadeC, warm ? 0.04 : 0.02), warm ? mixHue(h, WARM, M.lean / 90) : mixHue(h, STEEL, cool));
      highlight[g] = gloss(M.gloss, hexOf(M.glossL, Math.max(mC, 0.02) * M.glossC, mC > 0.02 ? mh : STEEL));
    } else if (kind === 'satin') {
      highlight[g] = gloss(TOON_MATERIAL.satin.gloss, lifted(tone, TOON_MATERIAL.satin.glossLift));
    } else if (kind === 'leather') {
      const M = TOON_MATERIAL.leather;
      thresholds[g] = M.threshold;
      shade[g] = hexOf(L * M.shadeL, C * 1.1, mixHue(h, WARM, M.lean / 90));
      highlight[g] = gloss(M.gloss, lifted(tone, M.glossLift), M.band);
    } else if (kind === 'glass') {
      highlight[g] = gloss(TOON_MATERIAL.glass.gloss, '#ffffff');
    } else if (kind === 'rubber') {
      shade[g] = hexOf(L * TOON_MATERIAL.rubber.shadeL, C, h);
    } else if (kind === 'silk' || kind === 'nylon') {
      const M = TOON_MATERIAL[kind];
      highlight[g] = gloss(M.gloss, lifted(tone, M.glossLift));
    } else if (kind === 'velvet' || kind === 'wool') {
      const M = TOON_MATERIAL[kind];
      thresholds[g] = M.threshold;
      shade[g] = hexOf(L * M.shadeL, C * M.shadeC, h);
    } else if (kind === 'denim') {
      const M = TOON_MATERIAL.denim;
      shade[g] = hexOf(L * M.shadeL, C, mixHue(h, STEEL, M.lean));
    }
  }
  const any = Object.keys(thresholds).length + Object.keys(shade).length + Object.keys(highlight).length;
  return any ? { thresholds, shade, highlight } : null;
}
