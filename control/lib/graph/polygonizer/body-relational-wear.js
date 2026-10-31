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
import { shapeCollar } from './shirt-collar.js';
import { fieldGarment, FIELD_GARMENTS } from './body-relational-garment.js';
import { oneTube, drapeRun, flareRun, swellRun, fairRun, waistbandOf, cinchWaist, bridgeRun, turnHemIn, collarOn, bandAt, buckleOn, bindNearest, carrySkirt, clearanceOver, clearOver } from './body-relational-tailor.js';
import { footwear, FOOTWEAR, FOOTWEAR_TONES } from './body-relational-footwear.js';
import { beltOn, frameBuckle } from './body-relational-kit.js';
import { foldCloth } from './body-relational-folds.js';
import { openFront, zipDown, jacketPieces, JACKET } from './body-relational-jacket.js';
import { tailorFronts } from './tailored-front.js';

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
const mean = (ps) => [0, 1, 2].map((k) => ps.reduce((s, p) => s + p[k], 0) / ps.length);

/** The pieces worn (see the head of this file). */
export function wearPieces(recipe, R, build, map, garments = [], kit = [], paint = [], tailoring = null, { hug = false } = {}) {
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
      // and its swell (breeches full down the thigh)
      for (const g of body) if (g.swell) for (const S of ['', 'R', 'L']) if (made[`${G}_${seg(g)}${S}`]) swellRun(made[`${G}_${seg(g)}${S}`], g.swell);
      // THE WAISTBAND (a piece's `waistband`: outfit law 2): no ease, on the skin and the layers worn before it, the cloth's
      // own ease back by the hips' widest
      // (a layer tucked under it, worn before it, cinched with it: each in the order worn, then the band over them)
      for (const g of body) if (Number.isFinite(g.waistband) && made[`${G}_${seg(g)}`]) {
        const zone = waistbandOf(made[`${G}_${seg(g)}`], g.waistband); if (!zone) continue;
        const ptsOf = (Q) => Q.stations.flatMap((x) => Object.values(x.points)), under = ['torso', 'pelvis'].map((k) => recipe.parts[k]).filter(Boolean).flatMap(ptsOf);
        const tucked = Object.entries(parts).filter(([k, Q]) => Q.garment && /_(body|torso|pelvis)$/.test(k)).map(([, Q]) => Q);
        for (const Q of tucked) { cinchWaist(Q, under, zone); under.push(...ptsOf(Q)); }
        cinchWaist(made[`${G}_${seg(g)}`], under, zone, { gap: tucked.length ? LAYER : 0.002 });
      }
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
      // (its KIND, shirt-collar.js: a band's V, a shirt's fall and its points, a turtleneck's roll; the fall a piece of its own)
      const K = C && g.collar ? shapeCollar(C, g.collar) : null;
      if (C) parts[`${g.id}_neck`] = { ...(K ? K.stand : C), garment: true, group: g.group };
      if (K?.fall) parts[`${g.id}Fall_neck`] = { ...K.fall, garment: true, group: g.group };
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
    const u = (A.s[0] + A.s[1]) / 2, st = top ? null : skin.stations.reduce((b, x) => (Math.abs((x.u ?? 0) - u) < Math.abs((b.u ?? 0) - u) ? x : b));
    let z = top ? top.z - 0.015 : mean(Object.values(st.points))[2];
    // (hugging: a belt within a hand's width of one already made shares its height, cinched over it; a duty belt rides
    // over the trousers' belt, never a band of its own above it)
    if (hug) { const by = beltZones.map(([lo, hi]) => (lo + hi) / 2).find((m) => Math.abs(m - z) < 0.1); if (by !== undefined) z = by; }
    const G = top ? null : named ? garmentOf(pid) : null, own = top ? parts[top.name] : G ? parts[`${G}_${s}`] ?? parts[`${G}_body`] : null;
    const outer = trunkParts().map(([k, P]) => [k, P, radiusAt(P, z)]).filter((x) => x[2] > 0).sort((a, b) => b[2] - a[2])[0];
    const [onName, on] = A.onTop || !own ? (outer ? [outer[0], outer[1]] : [null, null]) : [top ? top.name : `${G}_${s}`, own];
    if (!on) continue;
    const at = on.stations.reduce((b, x, k) => (Math.abs(mean(Object.values(x.points))[2] - z) < Math.abs(mean(Object.values(on.stations[b].points))[2] - z) ? k : b), 0);
    // (HUGGING, realistic laws 8: one mass fitted to everything worn at its height, its buckle a frame: body-relational-kit.js;
    // before, the cloth's two rings there copied and lifted, so the belt rippled as they do)
    // (what it is cinched over: the piece it is on and the trunk's cloth inside it, the belts made before it, the skin; a
    // garment wider than it there is worn OVER it and clears it below, never a girth the belt is fitted to; a sleeve
    // hanging beside the waist is no girth at all)
    const rOn0 = hug ? radiusAt(on, z) : 0;
    const under = (k, P) => k === onName || (P.garment ? /_(body|torso|pelvis)$/.test(k) && !(radiusAt(P, z) > rOn0) : belts.has(k.split('_')[0]) || /^\w*[Bb]elt\w*_/.test(k));
    const cinched = hug ? [...Object.entries(parts).filter(([k, P]) => under(k, P)).map(([, P]) => P), ...['torso', 'pelvis'].map((k) => recipe.parts[k]).filter(Boolean)].flatMap((P) => P.stations.flatMap((x) => Object.values(x.points))) : null;
    const band = hug ? beltOn(on, cinched, z, { width: A.mode === 'shell' ? 0.045 : 0.038, thick: Math.max(0.003, Math.min(0.005, A.thick ?? 0.004)) })
      : bandAt(on, at, { width: A.mode === 'shell' ? 0.05 : 0.035, lift: Math.min(0.008, (A.thick ?? 0.008) * 0.6) }); if (!band) continue;
    const tag = onName.split('_')[0];
    parts[`${A.id}_${tag}`] = { ...band, group: A.group ?? 'Leather' };
    const sig = A.signature;
    let buckle = null;
    if (hug && (sig?.kind === 'buckle' || sig?.kind === 'boss') && band.slots.includes('front')) {
      const F = frameBuckle({ ...band, group: A.group ?? 'Leather' }, `${A.id}Buckle`, { w: Math.max(0.04, sig.w ?? 0.05), group: sig.group ?? 'Buckle', tailGroup: A.group ?? 'Leather' });
      for (const [k, P] of Object.entries(F)) parts[`${k}_${tag}`] = P;
      buckle = { stations: Object.values(F).flatMap((P) => P.stations) };
    } else if ((sig?.kind === 'buckle' || sig?.kind === 'boss') && band.slots.includes('front')) { buckle = buckleOn(band, 'front', { w: sig.w ?? (sig.r ?? 0.015) * 2, h: sig.h ?? (sig.r ?? 0.012) * 2 }); parts[`${A.id}Buckle_${tag}`] = { ...buckle, group: sig.group ?? 'Buckle', bind: bindNearest(buckle, on) }; }
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

  // A TAILORED FRONT (the card's `front`, `lapel`, `buttons`, `shoulder`, `waist`, its `tie` and a waistcoat: `tailoring`),
  // on the jacket's one tube (tailored-front.js)
  tailorFronts(parts, recipe, tailoring, { beltZones, beltPts, shoulderZ: R.joints.shoulderR?.[2] ?? null, layer: LAYER });

  // THE JACKET AS BUILT (its construction words: body-relational-jacket.js): its body opened at the centre front, a real
  // gap between two edges (a zip's, or worn open), its cloth named for the folds; then its pieces
  const J = tailoring?.jacket, gathered = {};
  if (J) {
    for (const [k, P] of Object.entries(parts)) if (/^outer_/.test(k) && J.cloth) P.cloth = J.cloth;
    const bodyName = Object.keys(parts).find((k) => /^outer_(body|torso)$/.test(k));
    if (bodyName && (J.zip || J.open)) {
      const open = !!J.open, B = parts[bodyName], zs = B.stations.map((st) => mean(Object.values(st.points))[2]), z0 = Math.min(...zs), z1 = Math.max(...zs);
      const gapAt = open ? (z) => 0.07 + 0.08 * Math.max(0, Math.min(1, (z - z0) / (z1 - z0))) : () => JACKET.zipGap;
      parts[bodyName] = openFront(B, { gap: gapAt });
      // (its COLLAR opened with it, by the opening at the collar's foot: a closed ring round the neck held an open jacket shut)
      const collarName = Object.keys(parts).find((k) => /^outerCollar_neck$/.test(k));
      if (collarName) parts[collarName] = openFront(parts[collarName], { gap: () => gapAt(z1) });
      if (J.zip && !open) Object.assign(parts, zipDown(parts[bodyName], 'outerZip', { group: 'Buckle', tape: parts[bodyName].group ?? 'Outer' }));
      Object.assign(parts, jacketPieces(parts, bodyName, J, recipe, { gapAt, gathered }));
    }
  }
  // THE FOLDS (hugging, realistic laws 8: body-relational-folds.js): crescents inside the elbows and behind the knees,
  // stacks over the boots and at the cuffs, the shirt bloused over its belt, on the outermost cloth there
  if (hug) {
    const ends = (k) => { const P = recipe.parts[k]; if (!P) return null; const c = (st) => mean(Object.values(st.points)); return [c(P.stations[0]), c(P.stations[P.stations.length - 1])]; };
    const joints = {}, boots = {};
    for (const S of ['R', 'L']) {
      const fa = ends(`foreArm${S}`), sh = ends(`shank${S}`);
      if (fa) { joints[`elbow${S}`] = fa[0]; joints[`wrist${S}`] = fa[1]; }
      if (sh) joints[`knee${S}`] = sh[0];
      const boot = Object.entries(parts).filter(([k, P]) => P.group === 'Shoes' && k.endsWith(`_shank${S}`)).flatMap(([, P]) => P.stations.flatMap((x) => Object.values(x.points)));
      if (boot.length) boots[S] = Math.max(...boot.map((q) => q[2]));
    }
    foldCloth(parts, { joints, belts: beltZones, beltPts, boots, order, gathered });
  }
  return { parts, worn, belts, painted, alias, tones };
}
