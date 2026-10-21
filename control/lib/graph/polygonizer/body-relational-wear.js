/**
 * BODY-RELATIONAL WEAR — an outfit's GARMENT PIECES (outfit/expand.js: an outfit card's, a stylism's, an outfit word's)
 * worn on the realistic body by the tailor (body-relational-tailor.js), where the authored body's kernel builds them as
 * ring copies. The expander has made every design choice (the cut, the fit, the layers, the construction, the ornament,
 * the tones); this only makes them:
 *
 *   a GARMENT    the pieces sharing a name before their role (`top`, `topTail`, `topSleeve`, `topCuff` …): one cloth
 *                block over their segments (body-relational-garment.js `fieldGarment`), each piece's window its `u`
 *                (the trunk's stations) or its `run` (a limb's share), the close cloth at a real WEARING EASE (the
 *                expander's compressed toward its role's ceiling), LAYER steps over the garments worn before it (the
 *                expander's order is the stacking)
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
 *   a SKIRT      a coat's or a skirt's own (`fit: 'skirt'`): carried down from its garment's body (`carrySkirt`), close at
 *                the waist, an A by its flare compressed as the ease is, clear of what is under it, its hem turned up
 *                inside; a skirt with no body hung from a waistband of the close cloth
 *   FOOTWEAR     `boot` (its `bootShaft`'s share of the shank) and `shoe`: the footwear primitive
 *   a BELT, a SASH the kit's band (or a shell wrapped round the trunk) at its height: the tailor's band on the piece it
 *                names, or the outermost cloth there when worn on top or named on the skin; its buckle or boss at the front
 *
 *   wearPieces(recipe, R, build, map, garments, kit, paint) → { parts, worn, belts, painted, alias, tones }   parts
 *                named by garment; `worn` the piece ids made here (the rest — a panel, a cape, a hood — left to the
 *                authored kernel); `belts` the kit ids made here; `painted` the paint entries made cloth
 *                here; `alias` authored part name → { part, du, k? } (`u` there k·u + du); `tones` the footwear's for a palette that names none
 * Pure and deterministic.
 */
import { fieldGarment, FIELD_GARMENTS } from './body-relational-garment.js';
import { oneTube, drapeRun, flareRun, fairRun, turnHemIn, collarOn, bandAt, buckleOn, bindNearest, carrySkirt, clearanceOver } from './body-relational-tailor.js';
import { footwear, FOOTWEAR, FOOTWEAR_TONES } from './body-relational-footwear.js';

/** a piece's role after its garment's name */
const ROLE = /(Tail|Sleeve|Cuff|Collar|Rib|Seat|Leg|Shin|Hem|Shaft|Skirt)$/;
const SEGS = new Set(['torso', 'pelvis', 'neck', 'upperArm', 'foreArm', 'thigh', 'shank']);
/** a layer over the one before it */
const LAYER = 0.0035;
/** the ease past which cloth hangs rather than swells (m) */
const LOOSE = 0.014;
/** THE WEARING EASE a realistic garment keeps, per role: the expander's ease (tuned on the authored game body and its
 * stylize) compressed toward the role's ceiling, its order kept (a coat looser than a jacket, a jacket than a shirt) and
 * never a balloon: the ceilings a tailor's wearing ease at the chest, about a girth's sixth of a turn (a shirt's 8–10 cm
 * of girth, a jacket's 10–13, a coat's 15–20) */
const WEAR_CAP = Object.freeze({ top: 0.012, outer: 0.022, bottom: 0.014 });
const wearEase = (e, G) => { const cap = WEAR_CAP[G] ?? WEAR_CAP.bottom; return cap * (1 - Math.exp(-e / cap)); };
/** a skirt's FLARE at its hem (m out past its waist): the expander's (m per m of fall, tuned on the game body) over the
 * skirt's drop, compressed as the ease is toward a ceiling, so a trench is an A from the waist, never a bell */
const FLARE_CAP = 0.09;
const skirtFlare = (F, drop) => FLARE_CAP * (1 - Math.exp(-Math.max(0, F * drop) / FLARE_CAP));
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
      const raw = Math.max(...body.map((g) => g.ease ?? 0.008)), ease = (G.startsWith('skin') ? raw : wearEase(raw, G)) + lift;
      const on = [...new Set(body.map(seg))], window = Object.fromEntries(body.map((g) => [seg(g), windowOf(g)])), group = body[0].group;
      // (trousers: the seat and the legs handed over as the field trousers' are; every other garment the CLOSE cloth (the
      // fitted shirt's: blended half again the body's, following the forms, a soft cap on what it spans): a looser blend,
      // taut from the chest, bridges the side's hollows out under the arm, 10 cm where the body is 4 under the close one)
      // (and no farther past the skin than its ease and 1.5 cm more: the trunk's side ends at the armpit)
      const cloth = legs && on.includes('pelvis') ? { ...FIELD_GARMENTS.trousers, limit: {} } : { ...FIELD_GARMENTS.fittedShirt, covers: null, limit: {}, stand: ease + 0.015 };
      // (LOOSE cloth hangs: past `LOOSE` of ease the limbs' field is cut at it and the rest is the tailor's fall down the
      // run, so a loose sleeve or leg falls straight from the shoulder or the hip instead of swelling round the limb)
      // (a top's trunk keeps its full ease, its sleeves cut at LOOSE; trousers' seat and legs one block, handed over)
      const loose = ease > LOOSE, limbs = on.filter((x) => /^(upperArm|foreArm|thigh|shank)$/.test(x)), trunk = on.filter((x) => !limbs.includes(x));
      const made = !loose ? fieldGarment(recipe, R, build, map, { id: G, ...cloth, on, window, ease, group }).parts
        : legs ? fieldGarment(recipe, R, build, map, { id: G, ...cloth, on, window, ease: LOOSE, group }).parts
          : { ...(trunk.length ? fieldGarment(recipe, R, build, map, { id: G, ...cloth, on: trunk, window, ease, group }).parts : {}), ...(limbs.length ? fieldGarment(recipe, R, build, map, { id: G, ...cloth, on: limbs, window, ease: LOOSE, group }).parts : {}) };
      if (loose) for (const S of ['R', 'L']) for (const [a, b] of [['upperArm', 'foreArm'], ['thigh', 'shank']]) {
        const run = [made[`${G}_${a}${S}`], made[`${G}_${b}${S}`]].filter(Boolean);
        // (a sleeve narrows toward its cuff, a trouser leg falls nearly straight)
        if (run.length) drapeRun(run, S === 'R' ? 1 : -1, { slack: ease - LOOSE, taper: a === 'upperArm' ? 0.12 : 0.03, margin: 0.004, folds: 6, fold: 0.003, hem: 'fall' });
      }
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
      const C = collarOn(topOf, neckSkin, { height: Math.max(0.015, (r1 - r0) * (Math.max(...zs) - Math.min(...zs))), ease: (g.ease ?? 0.008) + lift });
      if (C) parts[`${g.id}_neck`] = { ...C, garment: true, group: g.group };
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

  // A SKIRT (a coat's, or a skirt of its own): carried down from its garment's body by the tailor (`carrySkirt`), close at
  // the waist, an A by its flare (compressed as the ease is) and clear of what it is worn over (the trousers, a skirt
  // under it, the hips and the legs), its hem turned up inside so it opens beneath; a skirt with no body of its own hung
  // from a waistband of the close cloth at the top of the hips. Its authored part (`<id>_skirt`, `u` 0 the waist … 11 the
  // hem) aliased onto the rings carried, so a trim painted on its hem or a belt at its waist lands there
  const skirtTop = new Map(), pelvisSkin = recipe.parts.pelvis;
  for (const g of garments.filter((x) => x.fit === 'skirt' && !worn.has(x.id) && x.to)) {
    const G = garmentOf(g.id), limb = segPart(g.to.part);
    let host = [`${G}_body`, `${G}_torso`, `${G}_pelvis`].find((k) => parts[k]);
    if (!host && pelvisSkin) {
      const ease = wearEase(g.ease ?? 0.008, 'bottom') + LAYER * order.length;
      Object.assign(parts, fieldGarment(recipe, R, build, map, { id: G, ...FIELD_GARMENTS.fittedShirt, covers: null, limit: {}, stand: ease + 0.015, on: ['pelvis'], window: { pelvis: [uMax('pelvis') - 1.5, uMax('pelvis')] }, ease, group: g.group }).parts);
      host = parts[`${G}_pelvis`] ? `${G}_pelvis` : null;
    }
    if (!host || !limb) continue;
    const u = g.to.u ?? (g.to.run ?? 1) * uMax(g.to.part), st = limb.stations.reduce((b, x) => (Math.abs((x.u ?? 0) - u) < Math.abs((b.u ?? 0) - u) ? x : b));
    const H = parts[host], z0 = mean(H.slots.map((sl) => H.stations[0].points[sl]))[2], zHem = mean(Object.values(st.points))[2];
    const zTurn = pelvisSkin ? mean(Object.values(pelvisSkin.stations[0].points))[2] + 0.01 : null;
    const below = [...Object.entries(parts).filter(([k]) => !k.startsWith(`${G}_`) && /_(body|torso|pelvis|leg[RL]|thigh[RL]|shank[RL])$/.test(k)).map(([, P]) => P),
      ...['pelvis', 'thighR', 'thighL', 'shankR', 'shankL'].map((k) => recipe.parts[k]).filter(Boolean)].flatMap((P) => P.stations.flatMap((x) => Object.values(x.points))).filter((q) => q[2] < z0 + 0.03);
    parts[host] = carrySkirt(H, { zHem, flare: skirtFlare(g.flare?.[1] ?? 0, z0 - zHem), clear: 0.008 + LAYER, needAt: clearanceOver(below), span: 11, zTurn });
    worn.add(g.id); skirtTop.set(g.id, { name: host, z: z0 });
    alias.set(`${g.id}_skirt`, { part: host, du: H.stations[0].u ?? 0, k: -1, seg: 'skirt' });
  }

  // A BELT or a SASH: a band round the trunk (an adornment's `band`, or a `shell` wrapped round it) made by the tailor at
  // the height of its `s` on the skin, on the cloth of the piece it names, or on the outermost cloth there when it is
  // worn on top or names the skin itself (a sash built for the authored body's girth would cut through a heavy figure's
  // coat); its buckle or its boss at the front
  const trunkParts = () => Object.entries(parts).filter(([k, P]) => P.garment && /_(body|torso|pelvis)$/.test(k));
  const radiusAt = (P, z) => { const st = P.stations.reduce((b, x) => (Math.abs(mean(Object.values(x.points))[2] - z) < Math.abs(mean(Object.values(b.points))[2] - z) ? x : b)); const c = mean(Object.values(st.points)); return Math.abs(c[2] - z) > 0.03 ? -1 : Object.values(st.points).reduce((t, q) => t + Math.hypot(q[0] - c[0], q[1] - c[1]), 0) / P.slots.length; };
  for (const A of kit) {
    const wrap = A?.mode === 'band' || (A?.mode === 'shell' && A.t === 'wrap');
    if (!wrap || typeof A.part !== 'string' || !Array.isArray(A.s)) continue;
    const named = A.part.includes('_'), [pid, s] = named ? A.part.split('_') : [null, A.part], skin = segPart(s);
    // (a belt on a skirt worn here: at its waist, on the tube it was carried down from)
    const top = named && s === 'skirt' ? skirtTop.get(pid) : null;
    if (!top && (!skin || !/^(torso|pelvis)$/.test(s) || (named && !worn.has(pid)))) continue;
    const u = (A.s[0] + A.s[1]) / 2, st = top ? null : skin.stations.reduce((b, x) => (Math.abs((x.u ?? 0) - u) < Math.abs((b.u ?? 0) - u) ? x : b)), z = top ? top.z - 0.015 : mean(Object.values(st.points))[2];
    const G = top ? null : named ? garmentOf(pid) : null, own = top ? parts[top.name] : G ? parts[`${G}_${s}`] ?? parts[`${G}_body`] : null;
    const outer = trunkParts().map(([k, P]) => [k, P, radiusAt(P, z)]).filter((x) => x[2] > 0).sort((a, b) => b[2] - a[2])[0];
    const [onName, on] = A.onTop || !own ? (outer ? [outer[0], outer[1]] : [null, null]) : [top ? top.name : `${G}_${s}`, own];
    if (!on) continue;
    const at = on.stations.reduce((b, x, k) => (Math.abs(mean(Object.values(x.points))[2] - z) < Math.abs(mean(Object.values(on.stations[b].points))[2] - z) ? k : b), 0);
    const band = bandAt(on, at, { width: A.mode === 'shell' ? 0.05 : 0.035, lift: Math.min(0.008, (A.thick ?? 0.008) * 0.6) }); if (!band) continue;
    const tag = onName.split('_')[0];
    parts[`${A.id}_${tag}`] = { ...band, group: A.group ?? 'Leather' };
    const sig = A.signature;
    if ((sig?.kind === 'buckle' || sig?.kind === 'boss') && band.slots.includes('front')) { const b = buckleOn(band, 'front', { w: sig.w ?? (sig.r ?? 0.015) * 2, h: sig.h ?? (sig.r ?? 0.012) * 2 }); parts[`${A.id}Buckle_${tag}`] = { ...b, group: sig.group ?? 'Buckle', bind: bindNearest(b, on) }; }
    belts.add(A.id);
  }
  return { parts, worn, belts, painted, alias, tones };
}
