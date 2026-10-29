/**
 * AUTHORED KIT — the kit as pieces (body-relational-kit.js, the realistic body's construction; docs/garment-principles.md)
 * on the GAME BODY, the authored and the tiered hero, where the adornment kernel (station-loft-adorn.js) laid each piece
 * as a slab lifted off the body's envelope and a buckle as four bars round a point. Run by expandPlan's `kit` hook on the
 * dressed recipe, after the garments (body-garment.js) and before the adornment bake, so the kernel bakes what is left:
 *
 *   a BELT       a band wrapped round the trunk (or a skirt's waist) carrying a buckle or a boss: one mass at the height
 *                of its window (no lower than the hips' widest), read off everything worn there, the legs' tops among
 *                it (`beltOn`, sampled round the body `BELT_ROUND` ways, not the cloth's ring12), on the cloth piece it
 *                names or the outermost one there; belts within a hand's width share a height, the later cinched over
 *                the earlier; its buckle a frame (`frameBuckle`)
 *   CLEARED      the trunk's cloth worn over a belt (a jacket, a tunic out over its trousers) carried out over the belt
 *                and its buckle at its height, eased back to its own line within 2 cm
 *   the KIT      a pouch, a holster, a harness's webbing, a thigh rig's band (`kitPieces`), on the cloth and the belts
 *
 * The game body's weights are by ring (body-garment.js: a garment ring carries its body ring's station), so every piece
 * reads them so (`rings`); its rings lie far apart, so what a piece is fitted over is read with rings put in between
 * (`readOf`). Its pieces are layer-1 parts named as the realistic body's are (`<id>_<segment>` a belt,
 * `<id>…_<segment>` its buckle, `…_kit` the rest), and they follow the live dials as what they lie on does
 * (`followDials`: a `bulk` that widens the hips widens the belt round them).
 *
 *   authoredKit(recipe, adorn) → { parts, taken }   `taken` the adornments' ids made here, for the kernel to leave
 * Pure and deterministic.
 */
import { beltOn, frameBuckle, kitPieces } from './body-relational-kit.js';
import { clearanceOver } from './body-relational-tailor.js';
import { byShare } from './station-loft-adorn.js';
import { compileLayered } from './station-loft.js';
import { authoredJacket } from './authored-jacket.js';

/** a belt's section, sampled so many ways round the body */
export const BELT_ROUND = 24;
/** a layer over the one before it (m: the realistic wear's) */
const LAYER = 0.0035;
/** a belt's width (m), read off its window and held to a belt's */
const WIDTH = Object.freeze([0.03, 0.055]);
/** a belt's thickness (m): the expander's, held to a belt's (the game body reads at a distance: thicker than the
 * realistic body's 3 to 5 mm) */
const THICK = Object.freeze([0.004, 0.008]);
/** the trunk's segments a belt is worn on, and the cloth a belt is worn over */
const TRUNK = /^(torso|pelvis)$/, TRUNK_CLOTH = /_(torso|pelvis|skirt)$/;

const r6 = (x) => Math.round(x * 1e6) / 1e6;
const clamp = (x, [a, b]) => Math.max(a, Math.min(b, x));
const mean = (ps) => [0, 1, 2].map((k) => ps.reduce((s, p) => s + p[k], 0) / ps.length);
const middle = (st) => mean(Object.values(st.points));
const pointsOf = (P) => P.stations.flatMap((st) => Object.values(st.points));

/** how close the rings a piece is READ by lie (m): the game body's are 3 to 10 cm apart, and a belt's section is read
 * within millimetres of its height (`beltOn`, `webbingOn`), so between two rings it read next to nothing */
const READ_STEP = 0.005;
const READS = new WeakMap();
/** `P` as it is read: rings put in between its own every `READ_STEP` along it, each its two neighbours' points mixed and
 * the nearer one's id (so a weight read by ring is that ring's). The piece itself is never changed */
function readOf(P) {
  if (READS.has(P)) return READS.get(P);
  const S = P.stations, out = [];
  for (let i = 0; i < S.length; i++) {
    out.push(S[i]);
    if (i + 1 >= S.length) continue;
    const a = S[i], b = S[i + 1], slots = Object.keys(a.points).filter((sl) => b.points[sl]);
    const gap = Math.hypot(...[0, 1, 2].map((k) => middle(b)[k] - middle(a)[k])), n = Math.ceil(gap / READ_STEP) - 1;
    for (let k = 1; k <= n; k++) { const t = k / (n + 1); out.push({ id: t < 0.5 ? a.id : b.id, points: Object.fromEntries(slots.map((sl) => [sl, a.points[sl].map((x, q) => x + (b.points[sl][q] - x) * t)])) }); }
  }
  const R = { ...P, stations: out };
  READS.set(P, R);
  return R;
}

/** the height of `P`'s axis at its station parameter `u`, between the two stations about it */
function zAt(P, u) {
  const S = P.stations.map((st, i) => [st.u ?? i, middle(st)[2]]).sort((a, b) => a[0] - b[0]);
  if (u <= S[0][0]) return S[0][1];
  for (let i = 1; i < S.length; i++) if (u <= S[i][0]) { const f = (u - S[i - 1][0]) / Math.max(1e-9, S[i][0] - S[i - 1][0]); return S[i - 1][1] + (S[i][1] - S[i - 1][1]) * f; }
  return S[S.length - 1][1];
}
/** `P`'s mean radius at height `z` (its nearest ring, within 3 cm), or −1 */
function radiusAt(P, z) {
  const st = P.stations.reduce((b, x) => (Math.abs(middle(x)[2] - z) < Math.abs(middle(b)[2] - z) ? x : b)), c = middle(st);
  return Math.abs(c[2] - z) > 0.03 ? -1 : Object.values(st.points).reduce((t, q) => t + Math.hypot(q[0] - c[0], q[1] - c[1]), 0) / Object.keys(st.points).length;
}
/** whether an adornment is a BELT the kit makes: a band wrapped round the trunk or a skirt carrying a buckle or a boss
 * (or named a belt or a sash), never a plate */
export function isBelt(A, parts) {
  const wrap = A?.mode === 'band' || (A?.mode === 'shell' && A.t === 'wrap');
  if (!wrap || typeof A.part !== 'string' || !Array.isArray(A.s) || A.edge !== undefined || A.rigid || !parts[A.part]) return false;
  const seg = A.part.split('_').pop();
  return (TRUNK.test(seg) || seg === 'skirt') && (['buckle', 'boss'].includes(A.signature?.kind) || /(^|[a-z])(belt|sash|Belt|Sash)/.test(A.id));
}

/** The kit's pieces on the game body's dressed recipe (see the head of this file). */
export function authoredKit(recipe, adorn, { tailoring = null } = {}) {
  const P0 = recipe.parts, parts = {}, taken = new Set(), zones = [], belts = [];
  const cloth = Object.fromEntries(Object.entries(P0).filter(([, P]) => P.garment && P.layer === 1 && Array.isArray(P.stations)));
  const trunkCloth = () => Object.entries(cloth).filter(([k]) => TRUNK_CLOTH.test(k));
  const skin = ['torso', 'pelvis'].map((k) => P0[k]).filter(Boolean);
  // (the legs' tops, skin and cloth, which a belt slung on the hips spans; and the HIPS' WIDEST, the lowest ring of the
  // pelvis at its full girth)
  const legs = Object.entries({ ...P0, ...cloth }).filter(([k]) => /(^|_)thigh[RL]$/.test(k)).map(([, P]) => P);
  const hipFloor = (() => { const P = P0.pelvis; if (!P) return -Infinity; const R = P.stations.map((st) => [middle(st)[2], radiusAt(P, middle(st)[2])]).sort((a, b) => a[0] - b[0]), top = Math.max(...R.map((x) => x[1])); return R.find((x) => x[1] >= 0.95 * top)[0]; })();
  for (const A of adorn || []) {
    if (!isBelt(A, P0)) continue;
    const seg = A.part.split('_').pop(), carrier = P0[A.part], W = byShare(carrier, A);
    const width = clamp(Math.abs(zAt(carrier, W.s[1]) - zAt(carrier, W.s[0])), WIDTH), thick = clamp(A.thick ?? 0.006, THICK);
    // (a belt rides the trunk: on the hips no lower than their widest, never down where the legs part from the pelvis,
    // which a hip belt's window reaches on the game body's short pelvis)
    let z = Math.max(zAt(carrier, (W.s[0] + W.s[1]) / 2), hipFloor + width / 2);
    // (hugging: a belt within a hand's width of one already made shares its height, cinched over it)
    const by = zones.map(([lo, hi]) => (lo + hi) / 2).find((m) => Math.abs(m - z) < 0.1); if (by !== undefined) z = by;
    // (on the cloth piece it names; on the skin, or worn on top, the outermost cloth there; none, the skin itself)
    const outer = trunkCloth().map(([k, P]) => [k, P, radiusAt(P, z)]).filter((x) => x[2] > 0).sort((a, b) => b[2] - a[2])[0];
    const [onName, on] = cloth[A.part] && !A.onTop ? [A.part, cloth[A.part]] : outer ? [outer[0], outer[1]] : [seg, carrier];
    // (what it is cinched over: the piece it is on, the trunk's cloth inside it, the belts made before it, the skin; a
    // garment wider than it there is worn OVER it, never a girth it is fitted to)
    const rOn = radiusAt(on, z);
    const under = trunkCloth().filter(([k, P]) => k === onName || !(radiusAt(P, z) > rOn)).map(([, P]) => P);
    const cinched = [...under, ...belts, ...skin, ...legs].map(readOf).flatMap(pointsOf);
    const band = beltOn(readOf(on), cinched, z, { width, thick, around: BELT_ROUND, rings: true });
    if (!band) continue;
    parts[`${A.id}_${seg}`] = { ...band, group: A.group ?? 'Leather' };
    const sig = A.signature, made = [band];
    if (sig?.kind === 'buckle' || sig?.kind === 'boss') {
      const F = frameBuckle({ ...band, group: A.group ?? 'Leather' }, `${A.id}Buckle`, { w: Math.max(0.04, sig.w ?? 0.05), group: sig.group ?? 'Buckle', tailGroup: A.group ?? 'Leather' });
      for (const [k, P] of Object.entries(F)) { parts[`${k}_${seg}`] = P; made.push(P); }
    }
    // CLEARED: the trunk's cloth worn over the belt carried out over it and its buckle at its height, eased back to its
    // own line within 2 cm above and below
    const bp = made.flatMap(pointsOf), zLo = Math.min(...bp.map((q) => q[2])), zHi = Math.max(...bp.map((q) => q[2])), need = clearanceOver(bp.map((q) => [q[0], q[1], z]));
    for (const [k, P] of trunkCloth()) {
      if (k === onName || !(radiusAt(P, z) > rOn)) continue;
      const out = { ...P, stations: P.stations.map((st) => {
        const c = middle(st), t = Math.max(0, Math.min(1, (Math.max(zLo - c[2], c[2] - zHi, 0) - 0.003) / 0.02)), w = 1 - t * t * (3 - 2 * t);
        if (w <= 0) return st;
        const reach = need([c[0], c[1], z]);
        return { ...st, points: Object.fromEntries(Object.entries(st.points).map(([sl, p]) => {
          const h = [p[0] - c[0], p[1] - c[1]], r = Math.hypot(...h), d = [h[0] / (r || 1), h[1] / (r || 1), 0], R = reach(d) + LAYER;
          return [sl, R > r ? [c[0] + d[0] * (r + (R - r) * w), c[1] + d[1] * (r + (R - r) * w), p[2]].map(r6) : p];
        })) };
      }) };
      parts[k] = out; cloth[k] = out;
    }
    taken.add(A.id); zones.push([zLo, zHi]); belts.push(band);
  }
  // THE JACKET AS BUILT (its construction words, `tailoring.jacket`: authored-jacket.js): opened after the belts (a
  // jacket worn over one cleared over it first), its pieces laid on it before the kit's (webbing on the outermost layer)
  const jacket = authoredJacket(recipe, cloth, tailoring?.jacket, { read: readOf });
  for (const [k, P] of Object.entries(jacket.parts)) { parts[k] = P; if (cloth[k]) cloth[k] = P; }
  // THE KIT'S PIECES on the cloth and the belts (the pouches hung from them, the webbing fastened to them)
  const worn = { ...cloth, ...Object.fromEntries(Object.entries(parts).filter(([k]) => !cloth[k])) };
  const rest = (adorn || []).filter((A) => !taken.has(A.id));
  if (rest.length) {
    const L1 = compileLayered({ schema: 'layered-v1', frame: recipe.frame, dials: {}, parts: Object.fromEntries(['torso', 'pelvis', 'thighR', 'thighL'].filter((k) => P0[k]).map((k) => [k, P0[k]])) }, {}, { details: false, creases: false }).parts;
    const read = (o) => Object.fromEntries(Object.entries(o).map(([k, P]) => [k, P.layer === 1 && Array.isArray(P.stations) ? readOf(P) : P]));
    const bodyRead = read(Object.fromEntries(['torso', 'pelvis', 'neck', 'thighR', 'thighL', 'upperArmR', 'upperArmL'].filter((k) => P0[k]).map((k) => [k, P0[k]])));
    const K = kitPieces({ ...recipe, parts: { ...P0, ...bodyRead } }, read(worn), rest, { L1, rings: true, around: BELT_ROUND });
    Object.assign(parts, K.parts);
    for (const id of K.taken) taken.add(id);
  }
  // THE DIALS: every piece made here follows the live dials that move what it lies on
  followDials(recipe, parts, adorn || [], cloth, jacket.carriers);
  return { parts, taken };
}

/** the body part a piece made here lies on: a belt's (`<id>_<segment>`, its buckle's `<id>Buckle…_<segment>`) its
 * segment, the kit's (`<id>…_kit`) its adornment's part's body segment */
function carrierOf(name, adorn) {
  if (!name.endsWith('_kit')) return name.split('_').pop();
  const A = adorn.filter((x) => typeof x?.id === 'string' && name.startsWith(x.id)).sort((a, b) => b.id.length - a.id.length)[0];
  return A ? A.part.split('_').pop() : null;
}
/** RIGID: the kit's hard pieces (a pouch, a holster and its pistol), which ride as one */
const RIGID = /(Body|Flap|Tab|Snap|Seam[RL]|Slide|Grip|Strap|Hanger)\d*_kit$/;
/**
 * The pieces FOLLOW THE DIALS (in place): a dial blends by station id over every part it names, so each piece's stations
 * take ids of their own (`st<k>k<n>`, its bind's keys with them) and the piece joins each dial that names the body part
 * it lies on, its stations weighted as that part's surface is at their height (a rigid piece one weight, at its middle);
 * a hinge or a chain swings it with that part, a belt aside. A garment the kit reshaped is in the dials already.
 */
function followDials(recipe, parts, adorn, cloth, carriers = {}) {
  // (each dial copied before it is joined: its parts, its blend and its links are the plan's own objects)
  for (const [k, d] of Object.entries(recipe.dials || {})) recipe.dials[k] = { ...d, ...(d.parts ? { parts: [...d.parts] } : {}), ...(d.blend ? { blend: { ...d.blend } } : {}), ...(Array.isArray(d.links) ? { links: d.links.map((L) => ({ ...L, ...(L.parts ? { parts: [...L.parts] } : {}) })) } : {}) };
  const dials = Object.values(recipe.dials || {});
  let n = 0;
  for (const [name, P] of Object.entries(parts)) {
    if (cloth[name] || !Array.isArray(P.stations)) continue;
    const bname = carriers[name] ?? carrierOf(name, adorn), body = recipe.parts[bname];
    const id = (st) => `${st}k${n}`, rename = (k) => (k === 'back' || k === 'tip' ? k : k.includes('.') ? `${id(k.slice(0, k.indexOf('.')))}${k.slice(k.indexOf('.'))}` : id(k));
    const old = P.stations.map((st) => st.id);
    P.stations = P.stations.map((st) => ({ ...st, id: id(st.id) }));
    if (P.bind && typeof P.bind === 'object') P.bind = { ...P.bind, blend: Object.fromEntries(Object.entries(P.bind.blend || {}).map(([k, w]) => [old.some((o) => k === o || k.startsWith(`${o}.`)) ? rename(k) : k, w])) };
    n++;
    if (!body?.stations) continue;
    // (a belt and its buckle widen with what they are round, but never swing with the trunk: a band at the trunk's hem
    // spans the hinge's pivot, the trunk bending above it; so do a jacket's zip and its rib waistband, down onto the hips)
    const rigid = RIGID.test(name) || /(Pocket|Flap|Snap|Button|Pull)[RL]?$/.test(name), swings = name.endsWith('_kit') || (!!carriers[name] && !/^outer(Zip|Rib_waist)/.test(name)), mid = mean(P.stations.map(middle));
    const zs = body.stations.map((st) => [middle(st)[2], st.id]).sort((a, b) => a[0] - b[0]);
    const weightAt = (blend, z) => { const w = (k) => blend[k] ?? 0; if (z <= zs[0][0]) return w(zs[0][1]); for (let i = 1; i < zs.length; i++) if (z <= zs[i][0]) { const f = (z - zs[i - 1][0]) / Math.max(1e-9, zs[i][0] - zs[i - 1][0]); return w(zs[i - 1][1]) + (w(zs[i][1]) - w(zs[i - 1][1])) * f; } return w(zs[zs.length - 1][1]); };
    for (const d of dials) {
      if ((d.op === 'scale' || d.op === 'offset') && d.parts?.includes(bname) && d.blend) {
        d.parts.push(name);
        for (const st of P.stations) { const w = weightAt(d.blend, rigid ? mid[2] : middle(st)[2]); if (w) d.blend[st.id] = r6(w); }
      } else if (!swings) continue;
      else if (d.op === 'hinge' && d.parts?.includes(bname)) d.parts.push(name);
      else if (d.op === 'chain' && Array.isArray(d.links)) for (const L of d.links) if (L.parts?.includes(bname)) L.parts.push(name);
    }
  }
}
