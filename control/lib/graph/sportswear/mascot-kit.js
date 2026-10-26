/**
 * A MASCOT'S KIT — a sport's kit (kits.js: the same words, the same cards) lowered onto a mascot's own body, to the
 * extent its shape has the parts a kit is worn on. A mascot (egocube/mascot-form.js) is a ring plan with no garments, so
 * its kit is what the hero's is on the bare body: paint, a second skin on the plan's own parts (body-paint.js), no
 * geometry. The shirt is the trunk's upper part and the sleeves the upper arms (a long sleeve the forearms too), the
 * shorts the trunk's lower part and the thighs (longer shorts and pants further down the leg), the socks the shins, the
 * gloves the hands; the patterns and the trims as the hero's, in their colours. An orb (all head) wears its shirt as a
 * band round its middle and its shorts on its legs: what it has, it wears.
 *
 *   mascotKit(plan, kit) → the plan with the kit worn: its paint entries (each `id: 'kit'`, after the mascot's own, so
 *                          a shirt covers a belly) and the kit's palette groups (Top, Kit, Trim, Bottom, Socks, Glove);
 *                          a plan already kitted has its old kit taken off first; `kit: null` takes it off
 *   mascotKitParts(plan)   → the parts a kit can be worn on (the trunk, thigh, shin, upperArm, foreArm, hand present)
 *
 * The mascot's face, its hook, its adornment and its own colours elsewhere are left as they are. Pure and deterministic.
 */
import { resolveKit } from './kits.js';

const KIT_ID = 'kit';
// the trunk's run a shirt covers, above the shorts (a mascot's trunk runs from the seat to the neck)
const WAIST = 0.38;
const SHIRT = ['Top'];

/** The parts a kit can be worn on: the trunk (`body`; an orb's `head`), and each limb part the plan has. */
export function mascotKitParts(plan) {
  const names = new Set((plan?.segments ?? []).map((s) => String(s.name).replace(/[RL]$/, '')));
  const trunk = names.has('body') ? 'body' : names.has('head') ? 'head' : null;
  return { trunk, orb: trunk === 'head', has: (n) => names.has(n) };
}

/** The paint a kit lowers to on a mascot's parts. */
function kitPaint(K, P) {
  const C = K.card, out = [], at = (e) => out.push({ ...e, id: KIT_ID });
  const limb = (part, e) => { if (P.has(part)) at({ part, ...e }); };
  // the shirt and the shorts on the trunk: an orb's shirt a band round its middle, its shorts its legs alone
  const shirt = P.orb ? [0, 0.14] : [WAIST, 1];   // (an orb's band low, under its face)
  if (P.trunk) at({ part: P.trunk, run: shirt, group: 'Top' });
  if (P.trunk && !P.orb) at({ part: P.trunk, run: [0, WAIST], group: 'Bottom' });
  if (C.top === 'tee') limb('upperArm', { run: [0, 0.55], group: 'Top' });
  if (C.top === 'longSleeve') { limb('upperArm', { group: 'Top' }); limb('foreArm', { group: 'Top' }); }
  const legs = { shorts: [0, 0.5], longShorts: [0, 0.8], pants: [0, 1], trousers: [0, 1] }[C.bottom];
  limb('thigh', { run: legs, group: 'Bottom' });
  if (C.bottom === 'trousers') limb('shin', { group: 'Bottom' });
  else if (K.socks === 'knee') limb('shin', { run: [0.15, 1], group: 'Socks' });
  else if (K.socks === 'ankle') limb('shin', { run: [0.7, 1], group: 'Socks' });
  if (C.gloves) limb('hand', { group: 'Glove' });
  // the patterns over the shirt (only where it is the shirt still), in the second colour
  const span = (a, b) => [shirt[0] + (shirt[1] - shirt[0]) * a, shirt[0] + (shirt[1] - shirt[0]) * b];
  const over = (e) => { if (P.trunk) at({ part: P.trunk, ...e, group: 'Kit', only: SHIRT }); };
  const PATTERNS = {
    plain: () => {},
    hoops: () => [[0.08, 0.22], [0.38, 0.52], [0.68, 0.82]].forEach((w) => over({ run: span(...w) })),
    stripes: () => [[0, 0.1], [0.3, 0.4], [0.6, 0.7], [0.9, 1]].forEach((t) => over({ run: shirt, t })),
    band: () => over({ run: span(0.4, 0.62) }),
    sleeves: () => { limb('upperArm', { group: 'Kit', only: SHIRT }); limb('foreArm', { group: 'Kit', only: SHIRT }); },
    yoke: () => { over({ run: span(0.78, 1) }); limb('upperArm', { run: [0, 0.3], group: 'Kit', only: SHIRT }); },
    sides: () => over({ run: shirt, t: [0.4, 0.6] }),
  };
  PATTERNS[K.pattern]();
  // the trims, in the trim colour: the collar the shirt's top, the hem its foot, the cuffs where a sleeve ends
  const TRIMS = {
    collar: () => { if (P.trunk && !P.orb) at({ part: P.trunk, run: [0.93, 1], group: 'Trim', only: SHIRT }); },
    hem: () => { if (P.trunk) at({ part: P.trunk, run: span(0, 0.07), group: 'Trim', only: SHIRT }); },
    cuffs: () => (C.top === 'tee' ? limb('upperArm', { run: [0.48, 0.56], group: 'Trim', only: SHIRT }) : C.top === 'longSleeve' ? limb('foreArm', { run: [0.86, 1], group: 'Trim', only: SHIRT }) : null),
    shortsStripe: () => limb('thigh', { t: [0.44, 0.56], group: 'Trim', only: ['Bottom'] }),
  };
  for (const t of K.trim) TRIMS[t]();
  return out;
}

/** The palette groups a kit paints, in its colours by role. */
const kitTones = (K) => ({ Top: K.colours[0], Kit: K.colours[1], Trim: K.colours[2], Bottom: K.colours[K.card.shorts], Socks: K.colours[K.card.socksOf], ...(K.card.gloves ? { Glove: K.colours[1] } : {}) });

export function mascotKit(plan, kit) {
  // off with an old kit first: its paint, and its palette groups back to what they were (`was`: the colours it covered)
  const { kit: _old, kitWas = null, ...mascot } = plan.mascot ?? {};
  let palette = { ...(plan.palette ?? {}) };
  if (_old !== undefined) {
    // (in place, so the palette reads as it did before the kit: a group it covered back to its colour, one it added gone)
    const was = kitWas ?? {}, laid = Object.keys(kitTones(resolveKit(_old)));
    palette = Object.fromEntries(Object.entries(palette).filter(([g]) => !laid.includes(g) || was[g] !== undefined).map(([g, v]) => [g, laid.includes(g) ? was[g] ?? v : v]));
  }
  const base = { ...plan, paint: (plan.paint ?? []).filter((e) => e.id !== KIT_ID), palette, ...(plan.mascot ? { mascot } : {}) };
  if (base.paint.length === 0 && !plan.paint) delete base.paint;
  if (kit === null || kit === undefined) return base;
  const K = resolveKit(kit), tones = kitTones(K);
  const was = Object.fromEntries(Object.keys(tones).filter((g) => palette[g] !== undefined).map((g) => [g, palette[g]]));
  return {
    ...base,
    paint: [...(base.paint ?? []), ...kitPaint(K, mascotKitParts(plan))],
    palette: { ...palette, ...tones },
    mascot: { ...mascot, kit, ...(Object.keys(was).length ? { kitWas: was } : {}) },
  };
}
