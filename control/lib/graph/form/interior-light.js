/**
 * THE INTERIOR'S LIGHT (a geocube's `light.interior`, opt-in): a land under a roof, no sky. Its light is the place's own:
 * rows of high-bay lamps under the roof, the glow of what burns in it (a furnace's mouth, a ladle's metal), the bounce of
 * both off its floor; its background a dark void through a smoke haze; and what its metal sees, an interior (a dark hall,
 * the lamps' rows a strip of light overhead, the glows low down), never a sky. The cube's own sun stays as the high-bay
 * field's key (overhead, its colour the lamps'), so a deck still throws its shadow on the floor under it and the palette
 * is solved under the light the place has.
 *
 *   readInterior(spec)            → the interior's words, checked (null when absent)
 *   interiorLights(I, { box, lamps?, glows? }) → { lamps: [{ at, colour, power, range }], glows: [...] }: the lamps a
 *                                   place's works hang (`lamps`), or, with none, rows of them under the roof over the
 *                                   land's box; the glows it names. At most MAX_LAMPS and MAX_GLOWS, the nearest the
 *                                   middle kept: a page lights every fragment by each
 *   interiorPayload(I, lights)    → what the page reads (form/land-read.js `interior`): the void, the haze, the lights and
 *                                   the environment's colours
 *
 * The words:
 *   void     '#rrggbb': the dark beyond the walls and through the haze
 *   haze     { colour, density }: the air's smoke (an exponential fog, density per metre)
 *   lamps    { colour, power, spacing, height }: the high-bay rows (`spacing` metres apart each way, `height` metres over
 *            the floor) where a place's works hang none of their own
 *   glow     { colour, power }: what burns: the colour and strength a glowing mouth lights its surroundings with
 */
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const HEX = /^#[0-9a-f]{6}$/i;
const bad = (m) => { throw new Error(`light.interior${m}`); };
const num = (v, lo, hi, m) => { if (!(typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi)) bad(m); };
export const MAX_LAMPS = 10, MAX_GLOWS = 6;
export const INTERIOR = Object.freeze({
  void: '#0d0b0a',
  haze: Object.freeze({ colour: '#3a3029', density: 0.0022 }),
  lamps: Object.freeze({ colour: '#ffe6c4', power: 1, spacing: 140, height: 60 }),
  glow: Object.freeze({ colour: '#ff7a22', power: 1 }),
});

export function readInterior(spec) {
  if (spec === undefined || spec === null || spec === false) return null;
  if (!isObj(spec)) bad(' is { void?, haze?, lamps?, glow? }: the light of a land under a roof');
  for (const k of Object.keys(spec)) if (!(k in INTERIOR)) bad(`.${k} is not a word (void, haze, lamps, glow)`);
  const I = { void: spec.void ?? INTERIOR.void, haze: { ...INTERIOR.haze, ...(spec.haze ?? {}) }, lamps: { ...INTERIOR.lamps, ...(spec.lamps ?? {}) }, glow: { ...INTERIOR.glow, ...(spec.glow ?? {}) } };
  if (!HEX.test(I.void)) bad(".void is a '#rrggbb' colour");
  if (!HEX.test(I.haze.colour)) bad(".haze.colour is a '#rrggbb' colour");
  num(I.haze.density, 0, 0.05, '.haze.density is per metre, 0..0.05');
  if (!HEX.test(I.lamps.colour)) bad(".lamps.colour is a '#rrggbb' colour");
  num(I.lamps.power, 0, 8, '.lamps.power is 0..8');
  num(I.lamps.spacing, 10, 1000, '.lamps.spacing is metres between rows, 10..1000');
  num(I.lamps.height, 4, 400, '.lamps.height is metres over the floor, 4..400');
  if (!HEX.test(I.glow.colour)) bad(".glow.colour is a '#rrggbb' colour");
  num(I.glow.power, 0, 8, '.glow.power is 0..8');
  for (const k of Object.keys(spec.haze ?? {})) if (!(k in INTERIOR.haze)) bad(`.haze.${k} is not a word (colour, density)`);
  for (const k of Object.keys(spec.lamps ?? {})) if (!(k in INTERIOR.lamps)) bad(`.lamps.${k} is not a word (colour, power, spacing, height)`);
  for (const k of Object.keys(spec.glow ?? {})) if (!(k in INTERIOR.glow)) bad(`.glow.${k} is not a word (colour, power)`);
  return I;
}

const r2 = (v) => Math.round(v * 100) / 100;

/** The lights a page hangs: the works' own lamps, else rows under the roof; the glows; each list kept to its most. */
export function interiorLights(I, { box, floor = 0, lamps = null, glows = [] } = {}) {
  const [bx, by] = box, mid = [(bx[0] + bx[1]) / 2, (by[0] + by[1]) / 2];
  let L = lamps;
  if (!L || !L.length) {
    L = [];
    const S = I.lamps.spacing, nx = Math.max(1, Math.round((bx[1] - bx[0]) / S)), ny = Math.max(1, Math.round((by[1] - by[0]) / S));
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) L.push({ at: [bx[0] + (i + 0.5) * (bx[1] - bx[0]) / nx, by[0] + (j + 0.5) * (by[1] - by[0]) / ny, floor + I.lamps.height] });
  }
  const near = (a, b) => Math.hypot(a.at[0] - mid[0], a.at[1] - mid[1]) - Math.hypot(b.at[0] - mid[0], b.at[1] - mid[1]);
  const lampsOut = [...L].sort(near).slice(0, MAX_LAMPS).map((q) => ({ at: q.at.map(r2), colour: q.colour ?? I.lamps.colour, power: r2((q.power ?? 1) * I.lamps.power), range: r2(q.range ?? I.lamps.spacing * 1.6) }));
  const glowsOut = [...glows].sort(near).slice(0, MAX_GLOWS).map((q) => ({ at: q.at.map(r2), colour: q.colour ?? I.glow.colour, power: r2((q.power ?? 1) * I.glow.power), range: r2(q.range ?? 120) }));
  return { lamps: lampsOut, glows: glowsOut };
}

/** What the page reads. */
export function interiorPayload(I, lights) {
  return { void: I.void, haze: I.haze, lamps: lights.lamps, glows: lights.glows, env: { lamp: I.lamps.colour, glow: I.glow.colour, void: I.void, haze: I.haze.colour } };
}
