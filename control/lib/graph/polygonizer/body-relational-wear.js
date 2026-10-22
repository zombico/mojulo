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
 *   SLEEVES      at their own pieces' ease, closer than the body (`SLEEVE` of it), a layer out only over the sleeves
 *                under them, bridged over the arm's hollows (`bridgeRun`); hanging only when the cut is loose
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
 *   a SHAPE      the card's `shoulder` (structured: `squareShoulders`) and `waist` (suppressed: `takeIn`; straight:
 *                `fallStraight`), on the jacket before its front is cut
 *   a FRONT      the card's `front`, `lapel`, `buttons` and `tie` (`tailoring`): the tie on the shirt (`bladeOn`), the
 *                jacket cleared over it (`clearOver`); the jacket's V onto the shirt (`cutV`), its lapels and collar one
 *                band (`lapelBand`: notch, peak, shawl); closed, the right front's edge over the left down to the hem, a
 *                single front's quarters cut away below its last button (`cutOpening`); its buttons (`buttonOn`)
 *   FOOTWEAR     `boot` (its `bootShaft`'s share of the shank) and `shoe`: the footwear primitive
 *   a BELT, a SASH the kit's band (or a shell wrapped round the trunk) at its height: the tailor's band on the piece it
 *                names, or the outermost cloth there when worn on top or named on the skin; its buckle or boss at the front;
 *                a garment worn over it cleared over it
 *
 *   wearPieces(recipe, R, build, map, garments, kit, paint, tailoring) → { parts, worn, belts, painted, alias, tones }   parts
 *                named by garment; `worn` the piece ids made here (the rest — a panel, a cape, a hood — left to the
 *                authored kernel); `belts` the kit ids made here; `painted` the paint entries made cloth
 *                here; `alias` authored part name → { part, du, k?, win? } (`u` there k·u + du; `win` the piece's own window on
 *                a merged tube); `tones` the footwear's for a palette that names none
 * Pure and deterministic.
 */
import { fieldGarment, FIELD_GARMENTS } from './body-relational-garment.js';
import { oneTube, drapeRun, flareRun, fairRun, bridgeRun, turnHemIn, collarOn, bandAt, buckleOn, bindNearest, bindRibbon, carrySkirt, clearanceOver, cutV, cutOpening, clearOver, lapelBand, buttonOn, bladeOn, squareShoulders, takeIn, fallStraight, clothWalker } from './body-relational-tailor.js';
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
/** a SLEEVE's share of its garment's wearing ease (a jacket's sleeve about 3–5 cm of girth over the shirt's at the biceps where its
 * body has 10–13 over the chest), and the expander's sleeve ease past which the cut is loose and the sleeve hangs */
const SLEEVE = 0.5, SLEEVE_HANG = 0.03;
/** a skirt's FLARE at its hem (m out past its waist): the expander's (m per m of fall, tuned on the game body) over the
 * skirt's drop, compressed as the ease is toward a ceiling, so a trench is an A from the waist, never a bell */
const FLARE_CAP = 0.09;
const skirtFlare = (F, drop) => FLARE_CAP * (1 - Math.exp(-Math.max(0, F * drop) / FLARE_CAP));
const garmentOf = (id) => id.replace(ROLE, '') || id;
const unitH = (p, c) => { const d = [p[0] - c[0], p[1] - c[1], 0], l = Math.hypot(d[0], d[1]) || 1; return [d[0] / l, d[1] / l, 0]; };
/** a LAPEL's width (m) along its roll line, s 0 at the top button (its foot, where it rolls from the front: `FOOT_W`)
 * … 1 where it meets the collar, the collar's width on past it: the NOTCH (a step at the gorge between the lapel and the collar), the PEAK (the lapel's corner carried up and
 * out past the collar), the SHAWL (one curve into the collar, no step); 'none' no lapel (the stand collar) */
/** points along each roll line (a lapel's rings: 2.7 cm apart over a bust, its flat stretch between two dipped under the cloth) */
const ROLL_N = 30;
const LAPEL_W = 0.075, COLLAR_W = 0.032, FOOT_W = 0.02, ramp = (s, a, b) => Math.max(0, Math.min(1, (s - a) / (b - a)));
const LAPELS = Object.freeze({
  notch: (s) => (s < 0.76 ? FOOT_W + (LAPEL_W - FOOT_W) * ramp(s, 0, 0.76) : s < 0.8 ? LAPEL_W - (LAPEL_W - 0.012) * ramp(s, 0.78, 0.8) : 0.012 + (COLLAR_W - 0.012) * ramp(s, 0.8, 0.84)),
  peak: (s) => (s < 0.72 ? FOOT_W + (LAPEL_W - FOOT_W) * ramp(s, 0, 0.72) : s < 0.8 ? LAPEL_W * (1 + 0.25 * ramp(s, 0.72, 0.8)) : s < 0.815 ? 0.012 + (LAPEL_W * 1.25 - 0.012) * (1 - ramp(s, 0.8, 0.815)) : 0.012 + (COLLAR_W - 0.012) * ramp(s, 0.815, 0.85)),
  shawl: (s) => (s < 0.6 ? FOOT_W + (LAPEL_W - FOOT_W) * Math.sin((Math.PI / 2) * ramp(s, 0, 0.6)) : COLLAR_W + (LAPEL_W - COLLAR_W) * 0.5 * (1 + Math.cos(Math.PI * ramp(s, 0.6, 1)))),
  none: null,
});
const mean = (ps) => [0, 1, 2].map((k) => ps.reduce((s, p) => s + p[k], 0) / ps.length);

/** The pieces worn (see the head of this file). */
export function wearPieces(recipe, R, build, map, garments = [], kit = [], paint = [], tailoring = null) {
  const parts = {}, worn = new Set(), belts = new Set(), painted = new Set(), turned = new Set(), alias = new Map(), tones = {};
  const seg = (P) => (Array.isArray(P.part) && P.part.length === 1 ? P.part[0] : null);
  const segPart = (s) => recipe.parts[s] ?? recipe.parts[`${s}R`];
  const uMax = (s) => { const P = segPart(s); return P ? P.stations[P.stations.length - 1].u ?? P.stations.length - 1 : 1; };
  const windowOf = (P) => { const s = seg(P); return P.u ? [P.u[0], P.u[1]] : P.run ? [P.run[0] * uMax(s), P.run[1] * uMax(s)] : [0, Infinity]; };

  // FOOTWEAR: a boot (its shaft's share of the shank from the ankle) or a shoe
  const boot = garments.find((g) => g.id === 'boot' && g.fit === 'shoe'), shaft = garments.find((g) => g.id === 'bootShaft'), shoe = garments.find((g) => g.id === 'shoe' && g.fit === 'shoe');
  // (the footwear library's cards: a boot's shaft its sock's, a share of the shank from the ankle)
  for (const [word, P, spec] of [['boots', boot, boot && (shaft?.run ? { ...FOOTWEAR.boots, sock: { ...FOOTWEAR.boots.sock, shaft: 1 - shaft.run[0] } } : 'boots')], ['shoes', shoe, shoe && 'shoes']]) {
    if (!P) continue;
    const W = footwear(recipe, R, build, map, spec, { id: word, group: P.group ?? 'Shoes' });
    Object.assign(parts, W.parts); Object.assign(tones, FOOTWEAR_TONES, W.tones || {});
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
      // run, so a loose leg falls straight from the hip instead of swelling round the limb)
      // (a top's trunk keeps its full ease; trousers' seat and legs one block, handed over)
      // THE SLEEVES their own: at their own pieces' ease, worn closer than the body (`SLEEVE` of it: a tailored sleeve
      // follows the arm), hanging only when the cut itself is loose (`SLEEVE_HANG`), never because the layers under it
      // lift it past `LOOSE`
      const arms = on.filter((x) => /^(upperArm|foreArm)$/.test(x)), rest = on.filter((x) => !arms.includes(x));
      const armRaw = Math.max(0, ...body.filter((g) => arms.includes(seg(g))).map((g) => g.ease ?? 0.008)), armHang = armRaw > SLEEVE_HANG;
      // (a layer out only over the sleeves worn before it: the trousers are not under a jacket's sleeve)
      const armLift = LAYER * order.slice(0, k).filter((H) => copies.some((g) => groupOf(g) === H && /^(upperArm|foreArm)$/.test(seg(g)))).length;
      const armEase = (G.startsWith('skin') ? armRaw : SLEEVE * wearEase(armRaw, G)) + armLift;
      const loose = ease > LOOSE, limbs = rest.filter((x) => /^(thigh|shank)$/.test(x)), trunk = rest.filter((x) => !limbs.includes(x));
      const block = (o, e) => (o.length ? fieldGarment(recipe, R, build, map, { id: G, ...cloth, ...(cloth.stand !== undefined ? { stand: e + 0.015 } : {}), on: o, window, ease: e, group }).parts : {});
      const made = { ...(!loose ? block(rest, ease) : legs ? block(rest, LOOSE) : { ...block(trunk, ease), ...block(limbs, LOOSE) }), ...block(arms, armHang ? LOOSE : armEase) };
      for (const S of ['R', 'L']) for (const [a, b] of [['upperArm', 'foreArm'], ['thigh', 'shank']]) {
        const run = [made[`${G}_${a}${S}`], made[`${G}_${b}${S}`]].filter(Boolean), arm = a === 'upperArm';
        // (a sleeve narrows toward its cuff, a trouser leg falls nearly straight)
        if (run.length && (arm ? armHang : loose)) drapeRun(run, S === 'R' ? 1 : -1, { slack: (arm ? armEase : ease) - LOOSE, taper: arm ? 0.12 : 0.03, margin: 0.004, folds: 6, fold: 0.003, hem: 'fall' });
      }
      // each piece's flare along its own run
      for (const g of body) if (g.flare) for (const S of ['', 'R', 'L']) if (made[`${G}_${seg(g)}${S}`]) flareRun(made[`${G}_${seg(g)}${S}`], g.flare);
      // (the last piece down each limb, and whether it stops short of the limb's end)
      const short = (s) => { const g = body.find((x) => seg(x) === s); return g && windowOf(g)[1] < uMax(s) - 0.05; };
      for (const S of ['R', 'L']) for (const [a, b, name] of [['upperArm', 'foreArm', 'arm'], ['thigh', 'shank', 'leg']]) {
        const A = made[`${G}_${a}${S}`], Bp = made[`${G}_${b}${S}`];
        if (A && Bp) {
          // (a sleeve that does not hang bridged over the arm's hollows, as a tailored sleeve lies)
          const T = fairRun({ ...oneTube(A, Bp), garment: true, group }), from = T.stations.length - Bp.stations.length;
          if (name === 'arm' && !armHang) bridgeRun(T);
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
      // (its trunk clear of the trunks worn before it below the waist: close cloth over a woman's hips lies inside
      // trousers' seat, which bridges out from hip to hip, and a jacket's tail would show them through; above the
      // waist the layers' eases already hold, and the shirt's armholes would only catch it)
      const zW = recipe.parts.torso ? mean(Object.values(recipe.parts.torso.stations[0].points))[2] + 0.02 : Infinity;
      const earlier = Object.entries(parts).filter(([k, P]) => P.garment && /_(body|torso|pelvis)$/.test(k)).flatMap(([, P]) => P.stations.flatMap((st) => Object.values(st.points))).filter((q) => q[2] < zW);
      if (earlier.length) for (const [k, P] of Object.entries(made)) if (/_(body|torso|pelvis)$/.test(k)) clearOver(P, earlier, { gap: LAYER * 0.5 });
      Object.assign(parts, made);
    }
    // (the garment's top ring: its body's, else its torso's)
    const topOf = parts[`${G}_body`] ?? parts[`${G}_torso`], neckSkin = recipe.parts.neck;
    // (a lapelled jacket's collar is its lapels' band, below: no stand collar)
    const lapelled = tailoring?.[G] && tailoring[G].lapel !== 'none';
    if (topOf && neckSkin && !lapelled) for (const g of neck) {
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
        // (on a merged tube, the piece's own window there: what it carried with no window of its own (an open front's
        // paint) is the piece's, not the whole tube's, or the tail's paint would cover the body's)
        const [w0, w1] = windowOf(g), win = to && to[0] === merged ? [Math.max(0, w0) + to[1], Math.min(uMax(s), w1) + to[1]] : null;
        if (to) alias.set(`${g.id}_${s}${S}`, { part: to[0], du: to[1], seg: s, ...(win ? { win } : {}) });
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
    // (a skirt's waistband a layer out over the garments worn before it, under those after: a jacket over a skirt)
    const gi = garments.indexOf(g), before = order.filter((H) => { const j = garments.findIndex((x) => garmentOf(x.id) === H); return j < gi; }).length;
    if (!host && pelvisSkin) {
      const ease = wearEase(g.ease ?? 0.008, 'bottom') + LAYER * before;
      Object.assign(parts, fieldGarment(recipe, R, build, map, { id: G, ...FIELD_GARMENTS.fittedShirt, covers: null, limit: {}, stand: ease + 0.015, on: ['pelvis'], window: { pelvis: [uMax('pelvis') - 1.5, uMax('pelvis')] }, ease, group: g.group }).parts);
      host = parts[`${G}_pelvis`] ? `${G}_pelvis` : null;
    }
    if (!host || !limb) continue;
    const u = g.to.u ?? (g.to.run ?? 1) * uMax(g.to.part), st = limb.stations.reduce((b, x) => (Math.abs((x.u ?? 0) - u) < Math.abs((b.u ?? 0) - u) ? x : b));
    const H = parts[host], z0 = mean(H.slots.map((sl) => H.stations[0].points[sl]))[2], zHem = mean(Object.values(st.points))[2];
    const zTurn = pelvisSkin ? mean(Object.values(pelvisSkin.stations[0].points))[2] + 0.01 : null;
    // (what it is worn over: the garments before it, never one worn over it)
    const wornBefore = new Set(order.filter((H) => garments.findIndex((x) => garmentOf(x.id) === H) < gi));
    const below = [...Object.entries(parts).filter(([k]) => !k.startsWith(`${G}_`) && wornBefore.has(k.split('_')[0]) && /_(body|torso|pelvis|leg[RL]|thigh[RL]|shank[RL])$/.test(k)).map(([, P]) => P),
      ...['pelvis', 'thighR', 'thighL', 'shankR', 'shankL'].map((k) => recipe.parts[k]).filter(Boolean)].flatMap((P) => P.stations.flatMap((x) => Object.values(x.points))).filter((q) => q[2] < z0 + 0.03);
    // (what is under it read within 1 cm of each ring's height: the hips widen fast below the waist, and a wider window
    // let the skirt out to them too soon, a shelf under a jacket)
    parts[host] = carrySkirt(H, { zHem, flare: skirtFlare(g.flare?.[1] ?? 0, z0 - zHem), clear: 0.008 + LAYER, needAt: clearanceOver(below, 0.01), span: 11, zTurn });
    worn.add(g.id); skirtTop.set(g.id, { name: host, z: z0 });
    // (and the garments worn over it carried out over it: a jacket's tail over a skirt's hips)
    // (its rings filled in between, every 6 mm or so, so a ring of the garment over it reads the skirt at its own height)
    const SK = parts[host], skirtPts = SK.stations.flatMap((st, i) => { const nx = SK.stations[i + 1]; return [0, 0.25, 0.5, 0.75].filter((f) => f === 0 || nx).flatMap((f) => SK.slots.map((sl) => st.points[sl].map((v, q) => v + ((nx?.points[sl][q] ?? v) - v) * f))); });
    for (const H of order.filter((H) => garments.findIndex((x) => garmentOf(x.id) === H) > gi && H !== G)) for (const k of [`${H}_body`, `${H}_torso`, `${H}_pelvis`]) if (parts[k]) clearOver(parts[k], skirtPts, { gap: LAYER, band: 0.006 });
    alias.set(`${g.id}_skirt`, { part: host, du: H.stations[0].u ?? 0, k: -1, seg: 'skirt' });
  }

  // A BELT or a SASH: a band round the trunk (an adornment's `band`, or a `shell` wrapped round it) made by the tailor at
  // the height of its `s` on the skin, on the cloth of the piece it names, or on the outermost cloth there when it is
  // worn on top or names the skin itself (a sash built for the authored body's girth would cut through a heavy figure's
  // coat); its buckle or its boss at the front
  const beltZones = [], beltPts = [];
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
    let buckle = null;
    if ((sig?.kind === 'buckle' || sig?.kind === 'boss') && band.slots.includes('front')) { buckle = buckleOn(band, 'front', { w: sig.w ?? (sig.r ?? 0.015) * 2, h: sig.h ?? (sig.r ?? 0.012) * 2 }); parts[`${A.id}Buckle_${tag}`] = { ...buckle, group: sig.group ?? 'Buckle', bind: bindNearest(buckle, on) }; }
    // A GARMENT WORN OVER THE BELT clears it (a jacket over the trousers' belt): out over the band and its buckle at its
    // height, eased back to its own line within 2 cm above and below
    // (the band's points all taken at its height, so its lower edge, wider over the hips, is cleared with the rest)
    const bp = [band, buckle].filter(Boolean).flatMap((P) => P.stations.flatMap((x) => Object.values(x.points))), zLo = Math.min(...bp.map((q) => q[2])), zHi = Math.max(...bp.map((q) => q[2]));
    const need = clearanceOver(bp.map((q) => [q[0], q[1], z])), rOn = radiusAt(on, z), beltSkin = recipe.parts.torso ? clearanceOver(['torso', 'pelvis'].map((k) => recipe.parts[k]).filter(Boolean).flatMap((Q) => Q.stations.flatMap((x) => Object.values(x.points)))) : null;
    for (const [k, P] of trunkParts()) {
      if (k === onName || !(radiusAt(P, z) > rOn)) continue;
      for (const st of P.stations) {
        const c = mean(P.slots.map((sl) => st.points[sl])), t = Math.max(0, Math.min(1, (Math.max(zLo - c[2], c[2] - zHi, 0) - 0.003) / 0.02)), w = 1 - t * t * (3 - 2 * t), under = need([c[0], c[1], z]);
        if (w <= 0) continue;
        for (const sl of P.slots) {
          const p = st.points[sl], h = [p[0] - c[0], p[1] - c[1]], r = Math.hypot(...h), d = [h[0] / (r || 1), h[1] / (r || 1), 0], R = under(d) + LAYER;
          if (R > r) st.points[sl] = [c[0] + d[0] * (r + (R - r) * w), c[1] + d[1] * (r + (R - r) * w), p[2]].map((v) => Math.round(v * 1e6) / 1e6);
        }
      }
      // (and the ridge that leaves eased into the cloth above and below it, as cloth lies over a belt: lifted along the
      // run only, 6 cm either way, never a point taken in under the skin, the V's or the quarters')
      if (beltSkin) { const C2 = P.stations.map((st) => mean(Object.values(st.points))); bridgeRun(P, { passes: 10, keep: 1, range: [zLo - 0.06, zHi + 0.06], around: false, hold: (i, j) => { const p = P.stations[i].points[P.slots[j]], c = C2[i], h = [p[0] - c[0], p[1] - c[1]], r = Math.hypot(...h); return r < beltSkin(c)([h[0] / (r || 1), h[1] / (r || 1), 0]) + 0.002; } }); }
    }
    belts.add(A.id); beltZones.push([zLo, zHi]); beltPts.push(...bp);
  }

  // A TAILORED FRONT (the card's `front`, `lapel`, `buttons` and `tie`: `tailoring`): the TIE on the shirt from its
  // knot at the collar to the belt; the jacket's V cut from its top button up to the collar, the shirt and the tie
  // showing in it; its lapels and collar one band along the roll lines and round the back of the neck, shaped by the
  // lapel's word; CLOSED, the right front over the left, its edge standing on the left one down to the hem (a single
  // front cut away below its last button, the quarters opening on the trousers; a double front square, its lapels
  // crossing above the buttons); its buttons at the stance, one row or two
  const torso = recipe.parts.torso, neckSkin = recipe.parts.neck, ctr = (st) => mean(Object.values(st.points));
  const jackets = Object.entries(tailoring || {}).filter(([k, T]) => k !== 'tie' && T && (T.lapel || T.shoulder || T.waist)), sgn = tailoring?.over === 'left' ? -1 : 1;
  if (torso && (jackets.length || tailoring?.tie)) {
    const ts = torso.stations[Math.floor(torso.stations.length / 2)], tc = ctr(ts), zWaist = ctr(torso.stations[0])[2];
    const front = (() => { const f = ts.points.front ?? ts.points[torso.slots[0]], d = [f[0] - tc[0], f[1] - tc[1], 0], l = Math.hypot(...d) || 1; return [d[0] / l, d[1] / l, 0]; })();
    const dir = (deg) => { const a = (deg * Math.PI) / 180; return [front[0] * Math.cos(a) + Math.sin(a), front[1] * Math.cos(a), 0]; };
    const pointsOf = (P) => P.stations.flatMap((st) => Object.values(st.points));
    // a cloth's SURFACE (with `extra` points: the neck above a jacket): a point's place on it and its normal, a point on
    // its front at a lateral `x` (its direction round the ring found so it lands there), its top and its bottom
    const surfaceOf = (P, extra = []) => {
      const C = P.stations.map(ctr).sort((u, v) => u[2] - v[2]), shell = clearanceOver([...pointsOf(P), ...extra]);
      const cAt = (z) => { if (z <= C[0][2]) return C[0]; for (let i = 1; i < C.length; i++) if (C[i][2] >= z) { const f = (z - C[i - 1][2]) / (C[i][2] - C[i - 1][2] || 1); return C[i - 1].map((v, q) => v + (C[i][q] - v) * f); } return C[C.length - 1]; };
      const surface = (p) => { const c = cAt(p[2]), d = unitH(p, c), r = shell([c[0], c[1], p[2]])(d) || Math.hypot(p[0] - c[0], p[1] - c[1]); return [[c[0] + d[0] * r, c[1] + d[1] * r, p[2]], d]; };
      const onFront = (x, z) => { const c = cAt(z); let q = surface([c[0] + front[0], c[1] + front[1], z])[0];
        for (let it = 0; it < 3; it++) { const r = Math.hypot(q[0] - c[0], q[1] - c[1]) || 0.1, sn = Math.max(-0.95, Math.min(0.95, (x - c[0]) / r)), cs = Math.sqrt(1 - sn * sn); q = surface([c[0] + front[0] * cs + sn, c[1] + front[1] * cs, z])[0]; }
        return q; };
      return { cAt, surface, onFront, zTop: C[C.length - 1][2], zBot: C[0][2] };
    };
    const zs = (a, b, n) => Array.from({ length: n }, (_, k) => a + ((b - a) * k) / (n - 1));
    // THE TIE: down the shirt's front from the collar to the belt, its knot a block, its blade widening to a point
    const shirtName = Object.keys(parts).find((k) => /^top_(body|torso)$/.test(k));
    let tiePts = null;
    if (tailoring?.tie && shirtName) {
      const W = surfaceOf(parts[shirtName]), z0 = W.zTop - 0.012, z1 = zWaist - 0.035, Z = zs(z0, z1, Math.max(8, Math.round((z0 - z1) / 0.01)));
      const width = Z.map((z) => (z > z0 - 0.04 ? 0.036 - 0.01 * ramp(z0 - z, 0, 0.04) : z > z1 + 0.05 ? 0.034 + 0.048 * ramp(z0 - 0.04 - z, 0, z0 - 0.09 - z1) : 0.082 * ramp(z - z1, 0, 0.05)));
      const thick = Z.map((z) => (z > z0 - 0.04 ? 0.011 : 0.0035));
      const tie = bladeOn(Z.map((z) => W.onFront(0, z)), width, thick, W.surface);
      if (tie) { parts.tie_torso = { ...tie, group: tailoring.tie.group ?? 'Tie', bind: bindRibbon(tie, parts[shirtName]) }; tiePts = pointsOf(tie); }
    }
    const skinPts = ['torso', 'pelvis', 'neck', 'thighR', 'thighL'].map((k) => recipe.parts[k]).filter(Boolean).flatMap(pointsOf);
    const under = clearanceOver(skinPts), shirtGroup = shirtName ? parts[shirtName].group ?? 'Top' : 'Skin';
    for (const [G, T] of jackets) {
      const jName = [`${G}_body`, `${G}_torso`].find((k) => parts[k]), J = jName ? parts[jName] : null;
      if (!J) continue;
      // (closed over the tie: the jacket carried out over it before it is cut)
      if (tiePts) clearOver(J, tiePts, { gap: LAYER });
      // ITS SHAPE: STRUCTURED shoulders squared on a pad (the straight line from the neck's point at 18°, 4 mm past the
      // widest ring, square down to it: farther, and the shoulder stands out past the sleeve's head under it); the waist SUPPRESSED (drawn in toward what it is worn over, the
      // shirt, the tie, the trousers or the skirt) or STRAIGHT (a sack: from the chest to the hip, its hollow bridged)
      const rings = J.stations.map((st) => ({ c: ctr(st), w: Math.max(...J.slots.map((sl) => Math.abs(st.points[sl][0] - ctr(st)[0]))) })).sort((u, v) => u.c[2] - v.c[2]);
      const top = rings[rings.length - 1], widest = rings.filter((g) => g.c[2] > zWaist + 0.15).reduce((b, g) => (g.w > b.w ? g : b), top);
      if (T.shoulder === 'structured' && widest !== top) squareShoulders(J, { xN: top.w * 0.7, zN: top.c[2], xA: widest.w + 0.004, zA: widest.c[2], slope: 0.33 });
      // (what it is worn over: the garments before it, the tie, the belt made on them)
      const worn = [...Object.entries(parts).filter(([k, P]) => !k.startsWith(`${G}_`) && (P.garment || k === 'tie_torso') && /_(body|torso|pelvis)$/.test(k)).flatMap(([, P]) => pointsOf(P)), ...beltPts];
      if (T.waist === 'suppressed' && worn.length) takeIn(J, clearanceOver(worn), { z: zWaist + 0.02, span: 0.11, depth: 0.8, gap: LAYER });
      // (over a belt, the ridge it leaves eased into the cloth above and below it, before the front is cut)
      for (const [zLo, zHi] of beltZones) bridgeRun(J, { passes: 10, keep: 1, range: [zLo - 0.06, zHi + 0.06], around: false });
      if (T.waist === 'straight') fallStraight(J, { z0: widest.c[2] - 0.12, z1: zWaist - 0.12 });
      if (!T.lapel) continue;
      const double = T.front === 'double', n = T.buttons, closed = !T.open;
      // the STANCE: the top button's height (two a little above the waist, one under it, three higher); the front
      // worn over's EDGE, closed, past the middle on the other side (a man's right front over his left, `sgn` +1; a
      // woman's left over her right, −1; a double front's past the far row of buttons); OPEN, the fronts `h` apart
      const zS = zWaist + (double ? 0.03 : { 1: -0.01, 2: 0.02, 3: 0.07 }[n] ?? 0.02), step = double ? 0.09 : 0.1, zB = zS - (n - 1) * step;
      const xE = closed ? -sgn * (double ? 0.085 : 0.02) : 0, h = closed ? 0 : 0.035;
      // the jacket's SURFACE before the cut (and the neck above it, 6 mm out)
      const neckPts = neckSkin ? neckSkin.stations.flatMap((st) => { const c = ctr(st); return Object.values(st.points).map((p) => { const d = unitH(p, c); return [p[0] + d[0] * 0.006, p[1] + d[1] * 0.006, p[2]]; }); }) : [];
      const { cAt, surface, onFront, zTop, zBot } = surfaceOf(J, neckPts), { across } = clothWalker(J);
      // the ROLL LINES: from their feet at the stance up to where the collar meets them, at the side of the neck (a
      // double front's left lapel goes down under the right front to its own button, so the two cross above the stance)
      const zC = zTop + 0.012, cTop = cAt(zTop), NP = (deg) => surface([cTop[0] + dir(deg)[0], cTop[1] + dir(deg)[1], zC])[0], NR = NP(65), NL = NP(-65);
      const footOver = [xE, zS], footUnder = double && closed ? [-xE * 0.76, zS] : footOver;
      const footR = closed ? (sgn > 0 ? footOver : footUnder) : [h, zS], footL = closed ? (sgn > 0 ? footUnder : footOver) : [-h, zS];
      const tX = double && closed ? (footL[0] - footR[0]) / ((NR[0] - footR[0]) - (NL[0] - footL[0])) : 0, apex = [footR[0] + (NR[0] - footR[0]) * tX, zS + (zC - zS) * tX];
      const line = (from, N, t0 = 0) => zs(t0, 1, ROLL_N).map((t) => { const x = from[0] + (N[0] - from[0]) * t, z = from[1] + (N[2] - from[1]) * t; return onFront(x, z); });
      const shape = LAPELS[T.lapel];
      if (shape) {
        cutV(J, under, { front, apex: closed ? apex : [0, zS], necks: [[NR[0], NR[2]], [NL[0], NL[2]]], open: T.open, openHalf: h, apexHalf: h, group: shirtGroup, floor: closed ? 0.02 : 0 });
        // the COLLAR round the back of the neck, right to left
        const collar = Array.from({ length: 23 }, (_, k) => surface([cTop[0] + dir(65 + (230 * (k + 1)) / 24)[0], cTop[1] + dir(65 + (230 * (k + 1)) / 24)[1], zC])[0]);
        // (the lapel over from its foot; the one under from where it comes out from under the front over it, tapered in
        // there; OPEN, the lapels on down the fronts' edges to the hem, the facing turned back the whole way)
        const tR = sgn > 0 ? 0 : tX, tL = sgn > 0 ? tX : 0, sR = zs(tR, 1, ROLL_N), sL = zs(tL, 1, ROLL_N).reverse(), R = line(footR, NR, tR), L = line(footL, NL, tL).reverse();
        const down = (x, top) => { const Z = zs(zS, zBot + 0.004, Math.max(4, Math.round((zS - zBot) / 0.012))).slice(1).map((z) => onFront(x, z)); return top ? Z.reverse() : Z; };
        const eR = closed ? [] : down(h, true), eL = closed ? [] : down(-h, false), path = [...eR, ...R, ...collar, ...L, ...eL];
        const taper = (k, m, t) => (t ? ramp(k, 0, 6) : 1);
        const width = [...eR.map(() => FOOT_W), ...sR.map((v, k) => shape(v) * taper(k, sR.length, tR)), ...collar.map(() => shape(1)), ...sL.map((v, k) => shape(v) * taper(sL.length - 1 - k, sL.length, tL)), ...eL.map(() => FOOT_W)];
        // (the lapel lies flat on the chest; from the gorge up it turns, and the collar falls down the back)
        // (the collar falls at the back, not at the sides of the neck, where over a squared shoulder it stood out as wings)
        const fall = [...eR.map(() => 0), ...sR.map((v) => 0.25 * ramp(v, 0.78, 1)), ...collar.map((_, k) => 0.25 + 0.5 * Math.sin((Math.PI * (k + 1)) / (collar.length + 1)) ** 2), ...sL.map((v) => 0.25 * ramp(v, 0.78, 1)), ...eL.map(() => 0)];
        const band = lapelBand(path, width, surface, { out0: [1, 0, 0], fall, overhang: 0.008, across, lift: 0.003 });
        if (band) parts[`${G}Lapel_torso`] = { ...band, group: T.group ?? 'Lapel', bind: bindRibbon(band, J) };
      }
      if (closed) {
        // THE EDGE of the right front, standing on the left one from the stance down to the hem: a single front's curved
        // away below its last button (and the left front's edge come out from under it), a double front's square
        const fq = (z) => Math.max(0, (zB - z) / Math.max(0.02, zB - zBot)), xO = (z) => (double ? xE : xE + sgn * 0.09 * fq(z) ** 1.5), xU = (z) => -xE - sgn * 0.09 * fq(z) ** 1.5;
        const zQ = double ? null : zB - (zB - zBot) * ((2 * Math.abs(xE)) / 0.18) ** (2 / 3), edge = (fx, z0, out0, name) => {
          const Z = zs(z0, zBot + 0.004, Math.max(4, Math.round((z0 - zBot) / 0.012))), band = lapelBand(Z.map((z) => onFront(fx(z), z)), Z.map(() => 0.03), surface, { out0, overhang: 0.008, across });
          if (band) parts[`${G}${name}_torso`] = { ...band, group: J.group ?? 'Outer', bind: bindRibbon(band, J) };
        };
        if (!double) {
          const bottomGroup = Object.keys(parts).some((k) => /^bottom_/.test(k)) ? 'Bottom' : 'Skin';
          cutOpening(J, under, (p) => p[2] < zQ && p[0] > Math.min(xO(p[2]), xU(p[2])) && p[0] < Math.max(xO(p[2]), xU(p[2])), { front, group: bottomGroup });
          edge(xU, zQ, [-sgn, 0, 0], 'EdgeUnder');
        }
        edge(xO, zS, [sgn, 0, 0], 'Edge');
      }
      // the BUTTONS: down the front from the stance (open, on the front under's edge), or two rows
      const cols = double ? [-0.065, 0.065] : [T.open ? -sgn * (h + 0.02) : xE + sgn * 0.02];
      for (let i = 0; i < n; i++) for (const [j, x] of cols.entries()) {
        const at = onFront(x, zS - i * step), nrm = unitH(at, cAt(at[2])), b = buttonOn(at.map((v, q) => v + nrm[q] * 0.0015), nrm);
        parts[`${G}Button${i}${cols.length > 1 ? 'RL'[j] : ''}_torso`] = { ...b, group: 'Button', bind: bindNearest(b, J) };
      }
    }
  }

  return { parts, worn, belts, painted, alias, tones };
}
