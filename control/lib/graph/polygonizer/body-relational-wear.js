/**
 * BODY-RELATIONAL WEAR — an outfit's GARMENT PIECES (outfit/expand.js: an outfit card's, a stylism's, an outfit word's)
 * worn on the realistic body by the tailor (body-relational-tailor.js), where the authored body's kernel builds them as
 * ring copies. The expander has made every design choice (the cut, the fit, the layers, the construction, the ornament,
 * the tones); this only makes them:
 *
 *   a GARMENT    the pieces sharing a name before their role (`top`, `topTail`, `topSleeve`, `topCuff` …): one cloth
 *                block over their segments (body-relational-garment.js `fieldGarment`), each piece's window its `u`
 *                (the trunk's stations) or its `run` (a limb's share), at the garment's ease, LAYER steps over the
 *                garments worn before it (the expander's order is the stacking)
 *   ITS TUBES    a limb's two pieces one tube (`<g>_arm<S>`, `<g>_leg<S>`: `oneTube`, faired over the joint), a top's
 *                tail and its body one
 *                (`<g>_body`) when it has no legs; trousers' seat and legs handed over as the field trousers' are
 *   FLARE        each piece's `flare` [a, b] (m) along its run (`flareRun`), before its tubes are joined
 *   HEMS         a sleeve or a leg ending short of the hand or the foot turned back in to the limb (`turnHemIn`), so it
 *                opens as cloth does, no lid
 *   ALIASES      each authored part name a worn piece had (`topSleeve_upperArmR`, `outer_torso` …) the part it is now,
 *                and the shift its `u` takes there (a merged tube's second piece runs on from its first's end; a
 *                body's pelvis rings run up to the torso's 0), so what the expander placed on a piece (a row of
 *                buttons, an embroidered emblem, a trim painted on a hem or an opening) lands on its cloth here
 *   the NECK     a collar or a rib a stand collar (`collarOn`) from the garment's top ring up the neck its share of
 *                the neck's length, at its own ease
 *   a SECOND SKIN the paint a knit or a fitted top lies as on the authored body (a body segment's window in a cloth
 *                group): a close block (the fitted shirt's cloth), worn first, under every garment
 *   FOOTWEAR     `boot` (its `bootShaft`'s share of the shank) and `shoe`: the footwear primitive
 *   a BELT       the kit's band on a worn piece: the tailor's band at the height of the piece's `s`, its buckle at the front
 *
 *   wearPieces(recipe, R, build, map, garments, kit, paint) → { parts, worn, belts, painted, alias, tones }   parts
 *                named by garment; `worn` the piece ids made here (the rest — a skirt hull, a panel, a cape, a hood —
 *                left to the authored kernel); `belts` the kit ids made here; `painted` the paint entries made cloth
 *                here; `alias` authored part name → { part, du }; `tones` the footwear's for a palette that names none
 * Pure and deterministic.
 */
import { fieldGarment, FIELD_GARMENTS } from './body-relational-garment.js';
import { oneTube, flareRun, fairRun, turnHemIn, collarOn, bandAt, buckleOn, bindNearest } from './body-relational-tailor.js';
import { footwear, FOOTWEAR, FOOTWEAR_TONES } from './body-relational-footwear.js';

/** a piece's role after its garment's name */
const ROLE = /(Tail|Sleeve|Cuff|Collar|Rib|Seat|Leg|Shin|Hem|Shaft)$/;
const SEGS = new Set(['torso', 'pelvis', 'neck', 'upperArm', 'foreArm', 'thigh', 'shank']);
/** a layer over the one before it */
const LAYER = 0.0035;
const garmentOf = (id) => id.replace(ROLE, '') || id;
const mean = (ps) => [0, 1, 2].map((k) => ps.reduce((s, p) => s + p[k], 0) / ps.length);

/** The pieces worn (see the head of this file). */
export function wearPieces(recipe, R, build, map, garments = [], kit = [], paint = []) {
  const parts = {}, worn = new Set(), belts = new Set(), painted = new Set(), turned = new Set(), alias = new Map(), tones = {};
  const seg = (P) => (Array.isArray(P.part) && P.part.length === 1 ? P.part[0] : null);
  const segPart = (s) => recipe.parts[s] ?? recipe.parts[`${s}R`];
  const uMax = (s) => { const P = segPart(s); return P ? P.stations[P.stations.length - 1].u ?? P.stations.length - 1 : 1; };
  const windowOf = (P) => { const s = seg(P); return P.u ? [P.u[0], P.u[1]] : P.run ? [P.run[0] * uMax(s), P.run[1] * uMax(s)] : [0, Infinity]; };

  // FOOTWEAR: a boot (its shaft's share of the shank from the ankle) or a shoe
  const boot = garments.find((g) => g.id === 'boot' && g.fit === 'shoe'), shaft = garments.find((g) => g.id === 'bootShaft'), shoe = garments.find((g) => g.id === 'shoe' && g.fit === 'shoe');
  for (const [word, P, spec] of [['boots', boot, boot && { ...FOOTWEAR.boots, ...(shaft?.run ? { shaft: 1 - shaft.run[0] } : {}) }], ['shoes', shoe, shoe && FOOTWEAR.shoes]]) {
    if (!P) continue;
    Object.assign(parts, footwear(recipe, R, build, map, spec, { id: word, group: P.group ?? 'Shoes' }).parts); Object.assign(tones, FOOTWEAR_TONES);
    worn.add(P.id); if (word === 'boots' && shaft) worn.add(shaft.id);
  }

  // A SECOND SKIN: the paint a body segment's window takes in a cloth group, a piece of a garment of that group's
  // (`skin<Group>`), worn first; the garments over it a layer out
  const CLOTH = /^(Top|Bottom|Outer)$/, skins = [];
  // (an entry may name the authored body's overlays with its segment, the pectoral with the torso: the segment is the cloth's)
  paint.forEach((x, i) => {
    const on = Array.isArray(x?.part) ? x.part.filter((q) => SEGS.has(q)) : [];
    if (on.length !== 1 || !CLOTH.test(x.group)) return;
    skins.push({ id: `skin${x.group}${on[0][0].toUpperCase()}${on[0].slice(1)}`, part: on, ...(x.u ? { u: x.u } : {}), ...(x.run ? { run: x.run } : {}), ease: 0.0015, group: x.group, skin: true }); painted.add(i);
  });
  // THE GARMENTS, in the expander's order (its stacking), the second skins first
  const copies = [...skins, ...garments.filter((g) => !g.fit && seg(g) && SEGS.has(seg(g)) && !worn.has(g.id))];
  const groupOf = (g) => (g.skin ? `skin${g.group}` : garmentOf(g.id)), order = [...new Set(copies.map(groupOf))];
  order.forEach((G, k) => {
    const pieces = copies.filter((g) => groupOf(g) === G), body = pieces.filter((g) => seg(g) !== 'neck'), neck = pieces.filter((g) => seg(g) === 'neck');
    const lift = LAYER * k, legs = body.some((g) => /^(thigh|shank)$/.test(seg(g)));
    if (body.length) {
      const on = [...new Set(body.map(seg))], window = Object.fromEntries(body.map((g) => [seg(g), windowOf(g)])), ease = Math.max(...body.map((g) => g.ease ?? 0.008)) + lift, group = body[0].group;
      // (trousers: the seat and the legs handed over as the field trousers' are; a top: a second skin's or a knit's
      // close cloth (the fitted shirt's) under 6 mm of ease, a woven's over it, blended half again closer than the tee)
      const cloth = legs && on.includes('pelvis') ? { ...FIELD_GARMENTS.trousers, limit: {} } : ease < 0.006 ? { ...FIELD_GARMENTS.fittedShirt, covers: null, limit: {} } : { covers: null, looser: 2, reach: 0.04, taut: true };
      const made = fieldGarment(recipe, R, build, map, { id: G, ...cloth, on, window, ease, group }).parts;
      // each piece's flare along its own run
      for (const g of body) if (g.flare) for (const S of ['', 'R', 'L']) if (made[`${G}_${seg(g)}${S}`]) flareRun(made[`${G}_${seg(g)}${S}`], g.flare);
      // (the last piece down each limb, and whether it stops short of the limb's end)
      const short = (s) => { const g = body.find((x) => seg(x) === s); return g && windowOf(g)[1] < uMax(s) - 0.05; };
      for (const S of ['R', 'L']) for (const [a, b, name] of [['upperArm', 'foreArm', 'arm'], ['thigh', 'shank', 'leg']]) {
        const A = made[`${G}_${a}${S}`], Bp = made[`${G}_${b}${S}`];
        if (A && Bp) {
          const T = fairRun({ ...oneTube(A, Bp), garment: true, group }), from = T.stations.length - Bp.stations.length;
          // (the second piece's rings run on from the first's end: its `u` shifted by the first segment's length in u)
          T.stations.forEach((st, i) => { if (i >= from) st.u = (st.u ?? 0) + uMax(a); });
          made[`${G}_${name}${S}`] = T; delete made[`${G}_${a}${S}`]; delete made[`${G}_${b}${S}`];
        }
        // THE HEM turned in where the cloth stops short: the lower piece's end, or the upper's when it is alone
        const low = made[`${G}_${name}${S}`] ? b : made[`${G}_${a}${S}`] ? a : null, tube = made[`${G}_${name}${S}`] ?? made[`${G}_${a}${S}`];
        // (folded back to the limb itself: the skin's ring nearest the hem, 2 mm out, so no lid shows inside a loose sleeve)
        const limb = recipe.parts[`${low}${S}`];
        if (low && tube && short(low) && limb) {
          const end = mean(tube.slots.map((sl) => tube.stations[tube.stations.length - 1].points[sl]));
          const at = limb.stations.reduce((b2, st) => (Math.hypot(...mean(Object.values(st.points)).map((v, q) => v - end[q])) < Math.hypot(...mean(Object.values(b2.points)).map((v, q) => v - end[q])) ? st : b2));
          turnHemIn(tube, { ...at.points }, limb.slots, { inset: -0.002 }); turned.add(made[`${G}_${name}${S}`] ? `${G}_${name}${S}` : `${G}_${a}${S}`);
        }
      }
      if (!legs && made[`${G}_pelvis`] && made[`${G}_torso`]) {
        const T = { ...oneTube(made[`${G}_pelvis`], made[`${G}_torso`]), garment: true, group }, from = T.stations.length - made[`${G}_torso`].stations.length;
        // (the pelvis's rings run up to the torso's 0: their `u` less the pelvis's length in u)
        T.stations.forEach((st, i) => { if (i < from) st.u = (st.u ?? 0) - uMax('pelvis'); });
        made[`${G}_body`] = T; delete made[`${G}_pelvis`]; delete made[`${G}_torso`];
      }
      Object.assign(parts, made);
    }
    // (the garment's top ring: its body's, else its torso's)
    const topOf = parts[`${G}_body`] ?? parts[`${G}_torso`], neckSkin = recipe.parts.neck;
    if (topOf && neckSkin) for (const g of neck) {
      const zs = neckSkin.stations.map((st) => mean(Object.values(st.points))[2]), [r0, r1] = g.run ?? [0, 0.3];
      parts[`${g.id}_neck`] = { ...collarOn(topOf, neckSkin, { height: Math.max(0.015, (r1 - r0) * (Math.max(...zs) - Math.min(...zs))), ease: (g.ease ?? 0.008) + lift }), garment: true, group: g.group };
    }
    for (const g of pieces) if (!g.skin) worn.add(g.id);
    // THE ALIASES: each piece's authored part name, the part it is now and its `u`'s shift there
    for (const g of pieces) {
      if (g.skin) continue;
      const s = seg(g), limb = /^(upperArm|foreArm|thigh|shank)$/.test(s);
      for (const S of limb ? ['R', 'L'] : ['']) {
        const merged = limb ? `${G}_${/^(upperArm|foreArm)$/.test(s) ? 'arm' : 'leg'}${S}` : `${G}_body`;
        const to = s === 'neck' ? (parts[`${g.id}_neck`] ? [`${g.id}_neck`, 0] : null) : parts[`${G}_${s}${S}`] ? [`${G}_${s}${S}`, 0] : parts[merged] ? [merged, s === 'foreArm' ? uMax('upperArm') : s === 'shank' ? uMax('thigh') : s === 'pelvis' ? -uMax('pelvis') : 0] : null;
        if (to) alias.set(`${g.id}_${s}${S}`, { part: to[0], du: to[1], seg: s });
      }
    }
  });

  // A BELT on a worn piece: the band at the height of its `s` on the skin there, its buckle at the front
  for (const A of kit) {
    if (A?.mode !== 'band' || typeof A.part !== 'string') continue;
    const [pid, s] = A.part.split('_'), G = garmentOf(pid), on = parts[`${G}_${s}`] ?? (/^(pelvis|torso)$/.test(s) ? parts[`${G}_body`] : null), skin = segPart(s);
    if (!on || !skin || !worn.has(pid) || !Array.isArray(A.s)) continue;
    const u = (A.s[0] + A.s[1]) / 2, st = skin.stations.reduce((b, x) => (Math.abs((x.u ?? 0) - u) < Math.abs((b.u ?? 0) - u) ? x : b)), z = mean(Object.values(st.points))[2];
    const at = on.stations.reduce((b, x, i) => (Math.abs(mean(Object.values(x.points))[2] - z) < Math.abs(mean(Object.values(on.stations[b].points))[2] - z) ? i : b), 0);
    const band = bandAt(on, at, { width: 0.035, lift: (A.thick ?? 0.008) * 0.6 }); if (!band) continue;
    parts[`${A.id}_${G}`] = { ...band, group: A.group ?? 'Leather' };
    const sig = A.signature;
    if (sig?.kind === 'buckle' && band.slots.includes('front')) { const b = buckleOn(band, 'front', { w: sig.w ?? 0.03, h: sig.h ?? 0.024 }); parts[`${A.id}Buckle_${G}`] = { ...b, group: sig.group ?? 'Buckle', bind: bindNearest(b, on) }; }
    belts.add(A.id);
  }
  return { parts, worn, belts, painted, alias, tones };
}
