/** body-garment.js — GARMENTS WITH VOLUME that follow the body's own geometry: a garment piece is a new L1 part copied
 * from a body part's rings over a window, each ring point carried outward by the piece's EASE (m, off the ring's
 * centre) and lifted over every layer beneath it (the hull of its `over` parts and of the garments already worn on
 * that part: a shirt over the breasts, a hem over the trousers), so it takes the body's shape and keeps clear of it.
 *
 * It FOLLOWS: each garment ring carries its body ring's station id and so its bind (station-loft-rig.js bindLayered
 * reads the blend by station), so the garment skins vertex by vertex exactly as the skin under it does and bends at
 * the elbow and the knee with the arm and the leg; a ring the window inserts between two stations takes their blends
 * mixed by its place between them. Every live dial that names the body part names its garment too, so a `bulk` that
 * broadens the chest broadens the shirt. Rebuilt from the body on every read, so a cast, a tune or a core re-fits it.
 *
 * A plan's `garments`: [{ id, part, u?: [a, b], run?: [a, b], ease, flare?, over?, rings?, group }], worn in order.
 * `part` a body part or a list (a base name both sides, a side name that side: body-paint.js's rule); `u` / `run`
 * the window in the part's station parameter / as a share of its span (both ends interpolated, so a hem sits where it
 * is asked); `flare` [at the window's start, at its end] adds ease toward an end (a bell sleeve, a wide trouser hem);
 * `swell` [at, by] adds `by` of ease at the share `at` of the window, none at its ends (breeches full at the thigh);
 * `over` the parts it clears beside its own (the chest's layers); `rings` { u?, run? } adds rings inside the window where
 * an edge is finished (a hem's or a cuff's band, then painted as narrow as it is drawn). Each piece is the part `<id>_<body part>`, closed at
 * its ends by caps pinched on its axis just beyond the end rings (inside the body: what shows is the hem's edge), and
 * is marked `garment: true` (the studio light shades it smoothly as cloth: station-loft-shade.js STUDIO_SMOOTH_CREASE).
 *
 * `fit: 'shoe'` builds a piece of its own instead of a copy: footwear is FLAT where the foot is not. The foot and its
 * `over` parts (the toes) are held by two solids fitted to them, each the smallest that holds its share of their points
 * with the ease: at the back a ROUND ELLIPSOID (the heel cup, standing on the sole), at the front a FLAT HALF-ELLIPSOID
 * (the toe box, its flat side the sole) reaching back under the instep. Each ring is the SUPERPOSITION of their two
 * sections, the outermost in every direction, and nothing lies below the sole (the lowest point), so the shoe stands
 * flat. `toe` (a share, default 1: the toes' own height, so none shows through) is the toe box's height against the foot's; `heel` (m) lifts the heel cup's top.
 * Each ring takes the bind of the foot's station nearest it.
 *
 * `fit: 'skirt'` is a piece of its own too: one hull round all of `part` (the hips and both legs) from the waist (`from`:
 * an address { part, u | run }) to the hem (`to`), each ring the support of everything at its height in twenty
 * directions, symmetric, never narrowing below the hips and widening by `flare` (m per m of fall); each point skins as
 * the pelvis at the waist, and below by the crotch as the leg it lies over (the cloth near a leg follows it, the cloth
 * between the legs hangs from both thighs below the seat). The
 * cloth has two faces, down the outside, folded at the hem and back up `thick` (m) inside to the hips, so the hem is an edge
 * and the skirt open beneath. The piece is `<id>_skirt`; its outer rings are st0 (the waist) … st11 (the hem).
 * `rigidity` (any piece's; hero-flow.js): how it moves with the figure — 'shell' (locked, the default), 'stiff', 'crisp',
 * 'soft', 'flowing' or 0 … 1 — carried on its part for the flow rig; the mesh is the same either way. `material` (any
 * piece's; cloth-law.js MATERIALS: silk, linen, wool …) names its rigidity and its weight the same way; a `rigidity`
 * beside it wins.
 * `drape` (a copy piece's): held out above, the cloth falls from there, coming in at most `drape` per metre of fall (a
 * shirt from the bust, not hugging back under it).
 * `fit: 'panel'` is an open DRAPE PANEL over an arc of the skirt's hull (`around`: [from, to] degrees, 0 the front, 90 the
 * right): a coattail, a tabard's apron, a tasset; `<id>_panel`, with a `root` so a rigidity hangs it as a strand.
 * `fit: 'cape'` is open cloth hung from the SHOULDERS (`from`, an address high on the torso) over an arc (`around`) of the
 * hull round everything in `part` (the trunk, the arms, the legs) to its hem (`to`): a cloak, round where a board is flat;
 * `<id>_cape`, draping on the arms and flowing as a curtain (capePart). `fit: 'hood'` rises from the shoulders over
 * the head's volume (`head: { at, r }`, an ellipsoid), open at the face (`open`), locked to the neck and the head:
 * `<id>_hood` (hoodPart); with `worn` (outfit laws 2) it is DRAPED instead (drapedHood: fitted to the head's own parts,
 * its words `worn`, `point`, `depth`, `budget`, its cloth `material`), a long point its own part `<id>_hoodTail`.
 * `over` on a hull piece (a skirt, a panel, a cape, a hood): more parts it hangs over beside the pieces worn on its body
 * parts (the realistic body's cloth, which the tailor makes and this kernel never wore). Absent, as before.
 * `proportional` (a copy piece's: the radius at which its ease is as given): each ring's ease scales with its own radius,
 * so the cloth keeps the body's ratios and a limb's taper survives. `dense`: the cloth's rings resampled to at least
 * twelve points (densePart), so a six-sided limb is not a six-sided sleeve. Both are absent → as before (the kernel only
 * grows: outfit/principles.js, the update law). `collar` (a neck piece's: its kind and its front, polygonizer/shirt-collar.js, the kit hook shapes it), `waistband` (a copy piece's: the station parameter its band starts at):
 * the band on what it is worn over with no ease, the cloth's own ease back by the hips' widest ring. `lie` (a copy
 * piece's: the station parameter from which it lies smooth, lieSmooth): above it the cloth bridges the dents between its
 * rings, so a bodice lies flat to the shoulders instead of standing a roll at each ring; on a cape, its own ring from
 * which it does so down its fall (a mantle's). `cinch` (a copy piece's: { at, ease, band? }, outfit laws 2's belted
 * bodice): taken in to `ease` at the ring at `at`, back to its own ease over `band` above it, a little fuller just above
 * (it blouses over the belt). Absent, as before. A piece that RISES to the neck (riseToNeck) is marked
 * `risen`: its upper rings are not level, so what fits it later reads each point at its own height. Pure, deterministic.
 */
import { SLOT_FAMILIES } from './station-loft-plan.js';
import * as dmath from '../../util/dmath.js';
import { rigidityErrors } from './rigidity.js';
import { materialErrors, clothRigidity } from './cloth-law.js';
import { compileLayered } from './station-loft.js';
import { surfaceLocalOffset } from './surface-pin.js';

/** THE YOKE's share of a layer's ease it may stand out sideways over the shoulder (body-garment's yokeOf) */
export const YOKE_SIDE = 0.25;
/** per ring of a piece on the trunk: true where it lies above the armpit (the lowest point of the shoulder balls) on a
 * body that has them; every ring false elsewhere (a classic body, a limb), so those pieces are cut as before */
function yokeOf(parts, src, C, ramp = false) {
  const balls = src === 'torso' ? Object.keys(parts).filter((nm) => /^shoulderBall[RL]$/.test(nm)) : [];
  if (!balls.length) return C.map(() => (ramp ? 0 : false));
  const armpit = Math.min(...balls.flatMap((nm) => parts[nm].stations.flatMap((st) => Object.values(st.points).map((p) => p[2]))));
  if (!ramp) return C.map((c) => c[2] > armpit);
  // (a piece that lies smooth, `lie`: the cap comes on over YOKE_RAMP of the rise from the armpit to the collar, so the
  // cloth eases in to the shoulder instead of stepping in at one ring, a ledge round the chest)
  const top = Math.max(...C.map((c) => c[2])), w = Math.max(1e-6, YOKE_RAMP * (top - armpit));
  return C.map((c) => { const t = Math.max(0, Math.min(1, (c[2] - armpit) / w)); return c[2] > armpit ? t * t * (3 - 2 * t) : 0; });
}
const YOKE_RAMP = 0.5;

/** a hull piece's part name (body-garment's own: `<id>_skirt`, `_panel`, `_cape`, `_hood`) */
const HULL_FIT = /_(skirt|panel|cape|hood)$/;
const GARMENT_FIELDS = ['id', 'part', 'u', 'run', 'ease', 'flare', 'over', 'group', 'fit', 'toe', 'heel', 'rings', 'from', 'to', 'drape', 'thick', 'rigidity', 'material', 'proportional', 'dense', 'around', 'girth', 'head', 'open', 'waistband', 'collar', 'swell', 'lie', 'worn', 'point', 'depth', 'budget', 'shoulder', 'armhole', 'cinch', 'capeArm', 'hoodRound', 'hemCut', 'insideGroup', 'arms', 'torn'];
/** a trunk piece's SHOULDER words (`shoulder`): its cloth over a sleeve's head, or ending at an armhole on the shoulder */
export const SHOULDER_WORDS = Object.freeze(['sleeved', 'sleeveless']);
/** the tiered body's shoulder forms (tiered-form.js tieredSockets: the ball, its cone to the neck's root, its web) */
const SHOULDER_FORM = /^shoulder(Ball|Cone|Web)[RL]?$/;
const both = (v) => (Array.isArray(v) ? v : [v]);
const isWin = (w) => Array.isArray(w) && w.length === 2 && w.every(Number.isFinite) && w[0] <= w[1];
const r6 = (x) => Math.round(x * 1e6) / 1e6;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k], lerp3 = (a, b, f) => add(a, mul(sub(b, a), f));
const unit = (a) => { const l = dmath.hypot(...a) || 1; return mul(a, 1 / l); };
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const mean = (ps) => mul(ps.reduce(add, [0, 0, 0]), 1 / ps.length);

/** Error strings for a plan's `garments` (form only; names are judged against the parts by `garmentParts`). */
export function validateGarments(G) {
  if (G === undefined || G === null) return [];
  if (!Array.isArray(G)) return ['garments: a list of { id, part, u?, run?, ease, flare?, over?, group }'];
  const errs = [], ids = new Set();
  G.forEach((P, i) => {
    const at = `garments[${i}]`;
    if (!P || typeof P !== 'object' || Array.isArray(P)) { errs.push(`${at}: { id, part, u?, run?, ease, flare?, over?, group }`); return; }
    if (typeof P.id !== 'string' || !/^[A-Za-z][\w-]*$/.test(P.id)) errs.push(`${at}.id: a name (letters, digits, - or _)`);
    else if (ids.has(P.id)) errs.push(`${at}.id: '${P.id}' worn twice — give each piece its own id`); else ids.add(P.id);
    if (!both(P.part).length || !both(P.part).every((n) => typeof n === 'string' && n)) errs.push(`${at}.part: a part name or a list of them`);
    if (typeof P.group !== 'string' || !P.group) errs.push(`${at}.group: a palette group name`);
    if (!(Number.isFinite(P.ease) && P.ease >= 0)) errs.push(`${at}.ease: metres off the body, ≥ 0`);
    if (P.u !== undefined && !isWin(P.u)) errs.push(`${at}.u: [a, b] in the part's station parameter, a ≤ b`);
    if (P.run !== undefined && !(isWin(P.run) && P.run[0] >= 0 && P.run[1] <= 1)) errs.push(`${at}.run: [a, b] shares of the part's span, 0 ≤ a ≤ b ≤ 1`);
    if (P.flare !== undefined && !(Array.isArray(P.flare) && P.flare.length === 2 && P.flare.every((x) => Number.isFinite(x) && x >= 0))) errs.push(`${at}.flare: [extra ease at the start, at the end] (m)`);
    if (P.swell !== undefined && !(Array.isArray(P.swell) && P.swell.length === 2 && Number.isFinite(P.swell[0]) && P.swell[0] > 0 && P.swell[0] < 1 && Number.isFinite(P.swell[1]) && P.swell[1] >= 0)) errs.push(`${at}.swell: [where, a share of the window strictly inside 0 … 1, extra ease there (m)]`);
    if (P.over !== undefined && !(Array.isArray(P.over) && P.over.every((n) => typeof n === 'string'))) errs.push(`${at}.over: a list of part names`);
    if (P.rings !== undefined && !(P.rings && typeof P.rings === 'object' && Object.keys(P.rings).every((k) => ['u', 'run'].includes(k)) && Object.values(P.rings).every((v) => Array.isArray(v) && v.every(Number.isFinite)))) errs.push(`${at}.rings: { u?: [stations], run?: [shares] } — rings added inside the window`);
    if (P.fit !== undefined && !['shoe', 'skirt', 'panel', 'cape', 'hood'].includes(P.fit)) errs.push(`${at}.fit: 'shoe' (footwear on a flat sole), 'skirt' (a hull round the hips and both legs), 'panel' (a drape panel hung over an arc of that hull), 'cape' (open cloth hung from the shoulders over an arc of the hull round the trunk, the arms and the legs), 'hood' (cloth rising from the shoulders over the head, open at the face), or absent (a copy of the part's rings)`);
    if (P.fit === 'hood' && !(P.head && Array.isArray(P.head.at) && P.head.at.length === 3 && P.head.at.every(Number.isFinite) && Array.isArray(P.head.r) && P.head.r.length === 3 && P.head.r.every((x) => Number.isFinite(x) && x > 0))) errs.push(`${at}.head: { at: [x, y, z], r: [rx, ry, rz] } — the head's volume the hood goes over (m)`);
    if (P.open !== undefined && !(Number.isFinite(P.open) && P.open > 0 && P.open < 120)) errs.push(`${at}.open: the face's opening, degrees each side of the front (0 … 120)`);
    if ((P.fit === 'panel' || P.fit === 'cape' || P.fit === 'hood') && !(Array.isArray(P.around) && P.around.length === 2 && P.around.every(Number.isFinite) && P.around[1] > P.around[0] && P.around[1] - P.around[0] <= 360)) errs.push(`${at}.around: [from, to] degrees about the ${P.fit === 'cape' ? 'shoulders' : 'waist'} (0 the front, 90 the right, 180 the back), from < to, at most a turn`);
    if (P.fit === 'hood' && !(P.from && typeof P.from.part === 'string' && (Number.isFinite(P.from.u) || Number.isFinite(P.from.run)))) errs.push(`${at}.from: { part, u | run } — the shoulders' height, an address on a body part`);
    if (P.fit === 'skirt' || P.fit === 'panel' || P.fit === 'cape') for (const k of ['from', 'to']) if (!(P[k] && typeof P[k].part === 'string' && (Number.isFinite(P[k].u) || Number.isFinite(P[k].run)))) errs.push(`${at}.${k}: { part, u | run } — the ${k === 'from' ? (P.fit === 'cape' ? 'shoulders' : 'waist') : 'hem'}'s height, an address on a body part`);
    errs.push(...rigidityErrors(P.rigidity, `${at}.rigidity`), ...materialErrors(P.material, `${at}.material`));
    if (P.insideGroup !== undefined && !(P.fit === 'cape' && typeof P.insideGroup === 'string' && P.insideGroup)) errs.push(`${at}.insideGroup: the group of a cape's inner face (a cape's alone)`);
    if (P.torn !== undefined && !(P.fit === 'cape' && P.torn && Number.isFinite(P.torn.depth) && P.torn.depth > 0 && Number.isInteger(P.torn.count) && P.torn.count >= 2 && P.torn.count <= 12)) errs.push(`${at}.torn: { depth, count } (a cape's hem torn into count tongues, its gaps torn up by depth metres: a cape's alone)`);
        if (P.arms !== undefined && !(P.fit === 'cape' && P.arms === false)) errs.push(`${at}.arms: false (a cape that hangs from the trunk alone, never carried by an arm)`);
    if (P.drape !== undefined && !(Number.isFinite(P.drape) && P.drape >= 0)) errs.push(`${at}.drape: how far the cloth may fall in per metre it falls below what holds it out (≥ 0; 0 falls straight)`);
    if (P.toe !== undefined && !(Number.isFinite(P.toe) && P.toe > 0)) errs.push(`${at}.toe: the toe box's height as a share of the foot's (> 0)`);
    if (P.heel !== undefined && !(Number.isFinite(P.heel) && P.heel >= 0)) errs.push(`${at}.heel: metres added over the heel cup (≥ 0)`);
    if (P.proportional !== undefined && !(Number.isFinite(P.proportional) && P.proportional > 0)) errs.push(`${at}.proportional: the radius (m) at which the ease is as given; each ring's ease scales with its own radius, so the body's taper survives (> 0)`);
    if (P.waistband !== undefined && !Number.isFinite(P.waistband)) errs.push(`${at}.waistband: the station parameter its waistband starts at (the band sits on what it is worn over, no ease)`);
    for (const [k, W] of Object.entries(HOOD_WORDS)) if (P[k] !== undefined && !(P.fit === 'hood' && W.includes(P[k]))) errs.push(`${at}.${k}: a hood's (fit 'hood'), ${W.map((w) => `'${w}'`).join(' | ')}`);
    if (P.lie !== undefined && !Number.isFinite(P.lie)) errs.push(`${at}.lie: the station parameter from which the cloth lies smooth (its dents between rings bridged)`);
    if (P.girth !== undefined && !(P.girth && typeof P.girth === 'object' && !Array.isArray(P.girth) && Object.entries(P.girth).every(([k, v]) => GIRTH_LANDMARKS.includes(k) && Number.isFinite(v) && v >= 0))) errs.push(`${at}.girth: { landmark: metres of girth over the body (≥ 0) } — landmarks ${GIRTH_LANDMARKS.join(', ')}`);
    if (P.shoulder !== undefined && !SHOULDER_WORDS.includes(P.shoulder)) errs.push(`${at}.shoulder: ${SHOULDER_WORDS.map((w) => `'${w}'`).join(' | ')} — a trunk piece's cloth over the shoulder, into a sleeve's head or to an armhole on it`);
    if (P.armhole !== undefined && typeof P.armhole !== 'boolean') errs.push(`${at}.armhole: true (a piece on the shoulder's cone ends at the shoulder point, its armhole) or false`);
    if (P.cinch !== undefined && !(P.cinch && typeof P.cinch === 'object' && Number.isFinite(P.cinch.at) && Number.isFinite(P.cinch.ease) && P.cinch.ease >= 0 && (P.cinch.band === undefined || (Number.isFinite(P.cinch.band) && P.cinch.band > 0)))) errs.push(`${at}.cinch: { at: the station parameter it is taken in at, ease: metres off what it is worn over there (≥ 0), band?: metres above it the cloth comes back to its own ease (> 0) }`);
    if (P.dense !== undefined && typeof P.dense !== 'boolean') errs.push(`${at}.dense: true (the cloth's rings resampled to at least twelve points, rounded) or false`);
    for (const k of Object.keys(P)) if (!GARMENT_FIELDS.includes(k)) errs.push(`${at}.${k}: not a garment field (${GARMENT_FIELDS.join(', ')})`);
    if (P.thick !== undefined && !(Number.isFinite(P.thick) && P.thick > 0)) errs.push(`${at}.thick: a skirt's cloth thickness at the hem (m, > 0)`);
  });
  return errs;
}

const partsNamed = (parts, name) => (/[RL]$/.test(name) && parts[name]?.layer === 1 ? [name]
  : Object.keys(parts).filter((n) => parts[n].layer === 1 && (n === name || n === `${name}R` || n === `${name}L`)));

/** a station's blend as weights (its own entry, else the part's bone whole) */
const blendOf = (bind, id) => (bind == null ? null : typeof bind === 'string' ? { [bind]: 1 } : bind.blend?.[id] ?? { [bind.bone]: 1 });
const mixBlend = (a, b, f) => { const o = {}; for (const [k, w] of Object.entries(a)) o[k] = (o[k] || 0) + w * (1 - f); for (const [k, w] of Object.entries(b)) o[k] = (o[k] || 0) + w * f;
  const e = Object.entries(o).filter(([, w]) => w > 1e-9).sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1)).slice(0, 4), s = e.reduce((t, [, w]) => t + w, 0);
  const out = Object.fromEntries(e.map(([k, w]) => [k, r6(w / s)])); const top = e[0][0]; out[top] = r6(out[top] + 1 - Object.values(out).reduce((t, w) => t + w, 0)); return out; };

/** DENSE: the part as its cloth sees it, each ring resampled to at least twelve points by the four-point scheme (an
 * interpolating subdivision: the body's own points kept, a new point between each two, bowed out along the ring's curve)
 * so a six-sided limb is not a six-sided sleeve. The dense slots are a ring family's (SLOT_FAMILIES ring12, ring16,
 * ring20), addressed on the body's own family by `slotT` (the dense trunk's mechanism), so a `t` window lands where it
 * did; `src` names, per dense slot, the body slots it was made from (for their slot blends). A part already at twelve
 * or more is returned as it is. */
const DENSE_OF = { 6: 'ring12', 8: 'ring16', 10: 'ring20' };
function densePart(part) {
  const m = part.slots.length, fam = DENSE_OF[m]; if (!fam) return { part, src: null };
  const slots = SLOT_FAMILIES[fam], T0 = part.slots.slice(0, m / 2 + 1).map((sl, k) => part.slotT?.[sl] ?? k);
  const tOf = (i) => (i % 2 ? (T0[(i - 1) / 2] + T0[(i + 1) / 2]) / 2 : T0[i / 2]);
  const slotT = Object.fromEntries(slots.slice(0, m + 1).map((sl, i) => [sl, r6(tOf(i))]));
  const src = slots.map((sl, i) => (i % 2 ? { a: part.slots[(i - 1) / 2], b: part.slots[((i + 1) / 2) % m] } : { a: part.slots[i / 2] }));
  const ring = (pts) => { const P = part.slots.map((sl) => pts[sl]), out = {};
    slots.forEach((sl, i) => { if (!(i % 2)) { out[sl] = P[i / 2]; return; } const k = (i - 1) / 2, a = P[(k + m - 1) % m], b = P[k], c = P[(k + 1) % m], d = P[(k + 2) % m];
      out[sl] = [0, 1, 2].map((x) => r6((-a[x] + 9 * b[x] + 9 * c[x] - d[x]) / 16)); });
    return out; };
  return { part: { ...part, slots, slotT, stations: part.stations.map((st) => ({ ...st, points: ring(st.points) })) }, src };
}

/** GIRTH TARGETS: a piece's `girth` names how much girth (m) the cloth adds over the body at the body's own LANDMARKS,
 * found on the part's rings by measure (a part's widest ring, and its narrowest below that, its last): the torso's
 * `chest` and `waist`, the pelvis's `hip`, the thigh's `thigh` and `knee`, the shank's `calf` and `ankle`, the upper arm's
 * `bicep` and `elbow`, the forearm's `forearm` and `wrist`. The girth counts from the body's surface WITH its layers
 * (a tape round the navel and the chest, not the torso ring under them). 0 is the cloth on the skin (mugen 0, a hair off).
 * Between two targets the ease runs as a share of what the piece would give there; outside them it holds the nearest's. */
export const GIRTH_LANDMARKS = ['chest', 'waist', 'hip', 'thigh', 'knee', 'calf', 'ankle', 'bicep', 'elbow', 'forearm', 'wrist'];
const LANDMARKS_OF = { torso: ['chest', 'waist'], pelvis: ['hip'], thigh: ['thigh', 'knee'], shank: ['calf', 'ankle'], upperArm: ['bicep', 'elbow'], foreArm: ['forearm', 'wrist'] };
const SKIN_HAIR = 0.002;
/** the ring index of each landmark of `base` among `girths` (the window's rings' body girths, in order root → end) */
function landmarkRings(base, girths) {
  const L = LANDMARKS_OF[base]; if (!L || girths.length < 2) return {};
  const wide = girths.indexOf(Math.max(...girths)), out = { [L[0]]: wide };
  if (base === 'torso') { if (wide > 0) { const below = girths.slice(0, wide); out.waist = below.indexOf(Math.min(...below)); } }   // the torso runs hem → collar
  else if (L[1]) out[L[1]] = girths.length - 1;
  return out;
}

/** the window's rings on a part: every station inside it, and a ring interpolated at each end that falls between two */
function windowRings(part, P) {
  const st = part.stations, U = st.map((s, k) => s.u ?? k), u0 = U[0], u1 = U[U.length - 1];
  let [a, b] = P.u ?? [u0, u1]; if (P.run) { a = Math.max(a, u0 + P.run[0] * (u1 - u0)); b = Math.min(b, u0 + P.run[1] * (u1 - u0)); }
  a = Math.max(a, u0); b = Math.min(b, u1); if (!(b > a)) return [];
  const at = (u) => { let i = U.findIndex((x) => x >= u - 1e-9); if (Math.abs(U[i] - u) < 1e-9) return { ...st[i], u: U[i], k: i };
    const f = (u - U[i - 1]) / (U[i] - U[i - 1]);
    return { id: `${st[i - 1].id}_${st[i].id}_g${Math.round(f * 1000)}`, u, points: Object.fromEntries(part.slots.map((sl) => [sl, lerp3(st[i - 1].points[sl], st[i].points[sl], f)])), mix: [st[i - 1].id, st[i].id, f] }; };
  // the rings a piece asks for inside its window (`rings`: u values and shares of the span), where its edges are
  // finished: a hem, a cuff or a rib is then a band of its own, as narrow as it is drawn
  // DENSE (densePart's other half): a ring halfway between each two stations, so the cloth bends over a form between them
  const mids = P.dense ? U.slice(0, -1).map((x, k) => (x + U[k + 1]) / 2) : [];
  const extra = [...(P.rings?.u || []), ...(P.rings?.run || []).map((r) => u0 + r * (u1 - u0)), ...mids].filter((u) => u > a + 1e-6 && u < b - 1e-6 && !U.some((x) => Math.abs(x - u) < 1e-6));
  const inner = [...st.map((s, k) => ({ ...s, u: U[k], k })).filter((s) => s.u > a + 1e-9 && s.u < b - 1e-9), ...[...new Set(extra.map((u) => Math.round(u * 1e6) / 1e6))].map(at)].sort((x, y) => x.u - y.u);
  return [at(a), ...inner, at(b)];
}

/** Build the garment parts of `garments` from the L1 `parts` (in place: adds `<id>_<part>` parts) and name each beside
 * its body part in `dials` (fresh lists). Throws on a name that dresses no part, or a window that covers none of it. */
export function garmentParts(parts, garments, dials = {}) {
  if (!garments?.length) return parts;
  // THE SHOULDER (`shoulder`, a trunk piece's): on a body with shoulder forms, the forms are laid under the shoulder's line
  // first (layShoulders) and the piece's cloth is carried over them as pieces of its own (withShoulders)
  if (garments.some((P) => P.shoulder) && Object.keys(parts).some((n) => /^shoulderCone[RL]$/.test(n) && parts[n].layer === 1)) { layShoulders(parts); garments = withShoulders(garments); }
  const worn = {};   // body part → the garment parts already on it (the next one stands off them)
  garments.forEach((P, i) => {
    const names = both(P.part).flatMap((n) => { const hit = partsNamed(parts, n); if (!hit.length) throw new Error(`garments[${i}]: '${n}' is not an L1 part`); return hit; });
    // `rigidity` (hero-flow.js) rides the piece's part: how it moves when the figure moves (absent: locked, a shell); and
    // `material` (cloth-law.js: what it is made of, a rigidity and a weight), when it names one
    const stiff = (part) => Object.assign(part, P.rigidity !== undefined ? { rigidity: P.rigidity } : {}, P.material !== undefined ? { material: P.material } : {});
    // (a draped hood worn UP tucks the hair it is worn over first, so it is cut to the skull and the tucked hair: tuckHair)
    if (P.fit === 'hood' && P.worn !== undefined && P.worn !== 'down') tuckHair(parts);
    if (['skirt', 'panel', 'cape', 'hood'].includes(P.fit)) { const name = `${P.id}_${P.fit}`, built = { skirt: skirtPart, panel: panelPart, cape: capePart, hood: hoodPart }[P.fit](parts, names, P, worn);
      // (a draped hood, outfit laws 2: its body stays on the head and the shoulders, its tail, when it has one, flows on
      // its own; drapedHood)
      if (built.tail) { const { tail, ...piece } = built; parts[name] = piece; parts[`${P.id}_hoodTail`] = tail; } else parts[name] = P.fit === 'hood' && P.worn !== undefined ? built : stiff(built);
      for (const src of names) (worn[src] ??= []).push(name);
      for (const d of Object.values(dials)) if (Array.isArray(d.parts) && names.some((n) => d.parts.includes(n))) d.parts = [...d.parts, name];
      return; }
    for (const src of names) {
      if (P.fit === 'shoe') { const name = `${P.id}_${src}`; parts[name] = stiff(shoePart(parts, src, P)); (worn[src] ??= []).push(name);
        for (const d of Object.values(dials)) if (Array.isArray(d.parts) && d.parts.includes(src)) d.parts = [...d.parts, name];
        continue; }
      const { part, src: denseSrc } = P.dense ? densePart(parts[src]) : { part: parts[src], src: null }, rings = windowRings(part, P.armhole ? { ...P, u: armholeWindow(parts, src) ?? P.u } : P);
      if (rings.length < 2) throw new Error(`garments[${i}] (${P.id}): its window covers none of '${src}'`);
      const overs = (P.over || []).flatMap((n) => partsNamed(parts, n)).filter((n) => n !== src);
      // (a piece on a shank, a foot, a forearm or a hand goes UNDER a hull hung round several parts, a skirt, a panel, a
      // cape, a hood, never over it: a boot's shaft worn after a skirt was lifted round the skirt's whole hem, a ring
      // round both legs; a piece on the trunk still clears it, a coat's hem over the skirt)
      const underHulls = /^(shank|foot|toes|foreArm|hand)[RL]?$/.test(src);
      // (THE SHOULDER's layers: a piece on a shoulder form stands off what another cloth already wears on the trunk, the
      // shoulder's forms and that side's arm, so an under-layer's shoulder lies inside the over-garment's)
      const n = rings.length, ua = rings[0].u, span = rings[n - 1].u - ua || 1;
      const C = rings.map((r) => mean(part.slots.map((sl) => r.points[sl])));
      const ptsOf = (n) => parts[n].stations.flatMap((s) => Object.values(s.points));
      let beneath = [...overs, ...(worn[src] || []).filter((n) => !(underHulls && HULL_FIT.test(n)))].flatMap(ptsOf);
      // (the shoulder's other layers count only where they lie under this piece's own rings: within SHOULDER_NEAR of their
      // surface and along their run, never an arm's length away: shoulderNear)
      // (lifted over along each point's normal only, never met between the rings: shoulderNear)
      const sb = shoulderBeneath(parts, src, worn, P.group);
      // (an ARMHOLE, a sleeveless trunk piece's on a body with shoulder forms: what lies inside the arm, its root, its ball
      // and its web, is the arm's, never held out by the cloth on the trunk: armVolume)
      const inArm = P.shoulder === 'sleeveless' && src === 'torso' ? armVolume(parts) : null;
      if (inArm) beneath = beneath.filter((v) => !inArm(v));
      // (a piece that RISES to the neck, riseToNeck, is cleared above its rise by the rise itself: below it, only what lies
      // at or under the ring it rises from counts, so a layer beneath that rose with it never holds out the chest under it)
      const rise = P.shoulder && src === 'torso' ? riseStart(rings, C, part.slots, armpitOf(parts)) : null;
      if (rise) beneath = beneath.filter((v) => v[2] <= rise.z);
      const lifted = sb.length ? [...beneath, ...sb.flatMap(ptsOf).filter(shoulderNear(rings, C, part.slots))] : beneath;
      // THE YOKE: on a trunk with shoulder balls (the tiered body), its rings above the armpit run out into the shoulder;
      // cloth lies close over it (its armhole at the arm's root) and hangs from the chest, never from the shoulder point
      const yoke = yokeOf(parts, src, C), yokeW = Number.isFinite(P.lie) ? yokeOf(parts, src, C, true) : yoke.map((y) => (y ? 1 : 0));
      const N = rings.map((r, j) => part.slots.map((sl) => unit(sub(r.points[sl], C[j]))));
      // (a sleeve's head: its crown, the web's rings laid flat under the shoulder's line, faces up as much as out, so its
      // ease and its lift go over the shoulder's top as well as round it: SHOULDER_CROWN_TILT, its first rings)
      if (/^shoulderWeb[RL]$/.test(src)) { const up = unit(sub(C[0], C[n - 1]));
        SHOULDER_CROWN_TILT.forEach((w, j) => { if (j < n) N[j] = N[j].map((v) => unit(add(v, mul(up, w)))); }); }
      // the lift over what lies beneath: per point along its outward normal, over what lies within a hand's breadth round
      // the ring and within the ring's own SLAB along the part (halfway to the rings either side), so a ring is never
      // lifted by a layer that lies over its neighbour (the waist by the underside of the bust); then smoothed round the
      // ring (a max, then a mean: adornment's min-shield), so a shirt bridges the cleft
      const axisAt = (j) => unit(sub(C[Math.min(n - 1, j + 1)], C[Math.max(0, j - 1)]));
      const slab = rings.map((_, j) => { const a = axisAt(j), d = (i) => dmath.hypot(...sub(C[i], C[j]));
        return [j > 0 ? d(j - 1) / 2 : 0.03, j < n - 1 ? d(j + 1) / 2 : 0.03, a]; });
      const liftOver = (p, nrm, [lo, hi, a]) => { let h = 0; for (const v of lifted) { const d = sub(v, p), up = dot3(d, nrm); if (up <= h) continue;
        const al = dot3(d, a); if (al < -lo || al > hi) continue; const lat = dmath.hypot(...sub(d, add(mul(nrm, up), mul(a, al)))); if (lat < 0.06) h = up; } return h; };
      let H = rings.map((r, j) => part.slots.map((sl, k) => (lifted.length ? liftOver(r.points[sl], N[j][k], slab[j]) : 0)));
      // the smoothing runs round each ring only: along the stack it would carry a ring's lift onto its neighbours and
      // fill the body's concavities (the waist between the ribs and the hips)
      if (lifted.length) {
        const m = part.slots.length, nb = (j, k) => [[j, k], [j, (k + 1) % m], [j, (k + m - 1) % m]];
        H = H.map((row, j) => row.map((_, k) => Math.max(...nb(j, k).map(([a, b]) => H[a][b])))); H = H.map((row, j) => row.map((_, k) => mean(nb(j, k).map(([a, b]) => [H[a][b], 0, 0]))[0]));
      }
      // PROPORTIONAL: the ease at each ring scales with its radius (`proportional` the radius at which it is `ease`), so
      // the cloth keeps the body's ratios (the calf over the ankle, the ribs over the waist) instead of adding one girth
      // everywhere, and a thin limb is not swallowed by the ease a torso needs
      const radii = rings.map((r, j) => mean(part.slots.map((sl) => [dmath.hypot(...sub(r.points[sl], C[j])), 0, 0]))[0]);
      const easeOf = (j) => (P.proportional ? P.ease * radii[j] / P.proportional : P.ease);
      let easeAt = easeOf;
      // CLEARANCE BETWEEN RINGS: the cloth runs straight from ring to ring and from slot to slot, so a layer bulging
      // between them (the bust) is met there: each point of it outside that patch raises its four corners (two rings,
      // the two slots either side of it) by the least that clears it (each corner's share by its nearness), twice over
      if (beneath.length) for (let pass = 0; pass < 2; pass++) {
        const m = part.slots.length, R = (j, k) => dmath.hypot(...sub(add(rings[j].points[part.slots[k]], mul(N[j][k], easeOf(j) + H[j][k])), C[j]));
        const ang = (j, v) => { const a = N[j][0], b = cross3(sub(C[Math.min(n - 1, j + 1)], C[Math.max(0, j - 1)]), a); return Math.atan2(dot3(v, unit(b)), dot3(v, a)); };
        const A = rings.map((_, j) => part.slots.map((_, k) => ang(j, N[j][k])));
        const need = rings.map(() => part.slots.map(() => 0));
        for (const v of beneath) for (let j = 0; j < n - 1; j++) {
          const ax = sub(C[j + 1], C[j]), L2 = dot3(ax, ax); if (L2 < 1e-12) continue; const f = dot3(sub(v, C[j]), ax) / L2; if (f <= 0 || f >= 1) continue;
          const c = add(C[j], mul(ax, f)), d = sub(v, c), w = sub(d, mul(ax, dot3(d, ax) / L2)), r = dmath.hypot(...w); if (r < 1e-9) continue;
          // the two slots either side of it by angle round ring j, its share between them, and how far the chord between them
          // sags inside their arc (1 / cos of half their angle)
          const th = ang(j, w); let k0 = 0, g = 0, chord = 1;
          for (let q = 0; q < m; q++) { const a0 = A[j][q], a1 = A[j][(q + 1) % m]; let span = a1 - a0; while (span <= -Math.PI) span += 2 * Math.PI; while (span > Math.PI) span -= 2 * Math.PI;
            let t = th - a0; while (t <= -Math.PI) t += 2 * Math.PI; while (t > Math.PI) t -= 2 * Math.PI; const gg = span ? t / span : -1; if (gg >= 0 && gg <= 1) { k0 = q; g = gg; chord = 1 / Math.cos(Math.min(1.2, Math.abs(span) / 2)); break; } }
          const k1 = (k0 + 1) % m, W = [[j, k0, (1 - f) * (1 - g)], [j, k1, (1 - f) * g], [j + 1, k0, f * (1 - g)], [j + 1, k1, f * g]];
          const dl = (r + SKIN_HAIR) * chord - W.reduce((t, [jj, kk, ww]) => t + ww * R(jj, kk), 0); if (dl <= 0) continue;
          const z = W.reduce((t, [, , ww]) => t + ww * ww, 0); for (const [jj, kk, ww] of W) need[jj][kk] = Math.max(need[jj][kk], dl * ww / z);
        }
        H = H.map((row, j) => row.map((h, k) => h + need[j][k]));
      }
      const fl = P.flare ?? [0, 0];
      // (a SWELL [at, by]: `by` more ease at the share `at` of the window, easing to none at its two ends: breeches' balloon)
      const sw = P.swell, bump = (f) => { const a = sw[0], t = f <= a ? f / a : (1 - f) / (1 - a), q = Math.sin((Math.PI / 2) * Math.max(0, Math.min(1, t))); return sw[1] * q * q; };
      const flAt = sw ? (f) => fl[0] * (1 - f) + fl[1] * f + bump(f) : (f) => fl[0] * (1 - f) + fl[1] * f;
      // GIRTH TARGETS: the landmark rings, found on the body's own rings before the drape (a pinned ring is cinched there)
      const ringG = (pts) => pts.reduce((g, p, k) => g + dmath.hypot(...sub(pts[(k + 1) % pts.length], p)), 0);
      const bodyG = P.girth ? rings.map((r) => ringG(part.slots.map((sl) => r.points[sl]))) : null;
      const at = P.girth ? landmarkRings(src.replace(/[RL]$/, ''), bodyG) : {}, pinned = new Set(Object.keys(P.girth || {}).filter((w) => at[w] !== undefined).map((w) => at[w]));
      const H0 = H.map((row) => [...row]);   // the lift over the layers beneath alone
      // DRAPE: cloth held out above (by the bust, the shoulder blades) falls from there instead of hugging back in under
      // it: from the top ring down, each point stands at least as far out as the one above it, less `drape` per metre
      // it falls
      // (a yoke ring holds nothing out below it: the cloth falls from the chest under the arm, not from the shoulder's width)
      if (P.drape !== undefined) for (let j = n - 2; j >= 0; j--) { if (yoke[j + 1]) continue; const dz = Math.abs(C[j + 1][2] - C[j][2]);
        for (let k = 0; k < part.slots.length; k++) { const sl = part.slots[k], f = (rings[j].u - ua) / span, e = easeAt(j) + flAt(f), fa = (rings[j + 1].u - ua) / span, ea = easeAt(j + 1) + flAt(fa);
          const above = dmath.hypot(...sub(add(rings[j + 1].points[sl], mul(N[j + 1][k], ea + H[j + 1][k])), C[j + 1]).slice(0, 2)), here = dmath.hypot(...sub(rings[j].points[sl], C[j]).slice(0, 2));
          H[j][k] = Math.max(H[j][k], above - P.drape * dz - here - e); }
        if (pinned.has(j)) H[j] = [...H0[j]]; }   // a girth target cinches its ring: the cloth below falls from there
      // GIRTH TARGETS (landmarkRings): at each named landmark the ease that, with the lift already there (the layers
      // beneath, the drape), gives that girth over the body's ring; between them a share of the piece's own ease
      if (P.girth) {
        // (the girth counts from the body's surface with its layers, a tape round them: a pinned ring's lift is that alone)
        const S = Object.entries(P.girth).filter(([w]) => at[w] !== undefined).map(([w, g]) => { const j = at[w]; return [j, Math.max(SKIN_HAIR, g / (2 * Math.PI)) / (easeOf(j) || 1e-9)]; }).sort((a, b) => a[0] - b[0]);
        if (S.length) { const shareAt = (j) => { if (j <= S[0][0]) return S[0][1]; if (j >= S[S.length - 1][0]) return S[S.length - 1][1];
            const q = S.findIndex(([i]) => i >= j); const [i0, s0] = S[q - 1], [i1, s1] = S[q]; return s0 + (s1 - s0) * (j - i0) / (i1 - i0); };
          easeAt = (j) => easeOf(j) * shareAt(j); }
      }
      // A CINCH (`cinch` { at, ease, band? }, a copy piece's; outfit laws 2: a bodice under a belt): taken in to `ease` at the
      // ring at `at`, coming back to its own ease over `band` above it (CINCH_BAND below), the cloth just above it standing
      // a little fuller (CINCH_BLOUSE: it blouses over the belt), so the side runs in from the chest to the belt
      if (P.cinch) { const base = easeAt, zc = (() => { const k = rings.findIndex((r) => r.u >= P.cinch.at - 1e-9); if (k <= 0) return C[Math.max(0, k)][2];
          const f = (P.cinch.at - rings[k - 1].u) / Math.max(1e-9, rings[k].u - rings[k - 1].u); return C[k - 1][2] + (C[k][2] - C[k - 1][2]) * f; })();
        const up = P.cinch.band ?? CINCH_BAND * 3;
        easeAt = (j) => { const d = C[j][2] - zc, g = Math.min(1, Math.abs(d) / (d > 0 ? up : CINCH_BAND)), sm = g * g * (3 - 2 * g), b = base(j);
          return (P.cinch.ease + (b - P.cinch.ease) * sm) * (d > 0 ? 1 + CINCH_BLOUSE * Math.sin(Math.PI * Math.min(1, d / (up / 2))) * (d < up / 2 ? 1 : 0) : 1); }; }
      // THE WAISTBAND (`waistband`, the station parameter its band starts at): the band sits on what it is worn over with no
      // ease (a hair off the layers under it, the drape's lift dropped), and the cloth below takes its own ease back by the
      // hips' widest ring, so trousers are never bulky at the waist
      const band = Number.isFinite(P.waistband) && rings.some((r) => r.u >= P.waistband - 1e-9) ? (() => {
        const g = rings.map((r) => ringG(part.slots.map((sl) => r.points[sl]))), zw = C[g.indexOf(Math.max(...g))][2];
        const zb = Math.min(...rings.map((r, j) => (r.u >= P.waistband - 1e-9 ? C[j][2] : Infinity)));
        return rings.map((r, j) => { if (r.u >= P.waistband - 1e-9) return 0; const t = Math.max(0, Math.min(1, (zb - C[j][2]) / Math.max(1e-6, zb - zw))); return t * t * (3 - 2 * t); });
      })() : null;
      const stations = rings.map((r, j) => { const f = (r.u - ua) / span, e0 = easeAt(j) + flAt(f);
        const e = band ? Math.max(SKIN_HAIR, e0 * band[j]) : e0, h = (k) => (band ? H0[j][k] + (H[j][k] - H0[j][k]) * band[j] : H[j][k]);
        // (over the yoke the cloth stands out sideways by YOKE_SIDE of its ease at most: it lies on the shoulder, the shoulder
        // point its edge, where a copy of the yoke's ring carried out along its normal stood off past the arm's root, a box)
        const off = (k) => { const o = mul(N[j][k], e + h(k)); if (!yoke[j]) return o; const x = r.points[part.slots[k]][0], sx = Math.sign(x) || 1, cap = YOKE_SIDE * e, w = yokeW[j];
          return sx * o[0] > cap ? [sx * (w === 1 ? cap : cap + (sx * o[0] - cap) * (1 - w)), o[1], o[2]] : o; };
        return { id: r.id, u: r6(r.u), points: Object.fromEntries(part.slots.map((sl, k) => [sl, add(r.points[sl], off(k)).map(r6)])) }; });
      if (Number.isFinite(P.lie)) lieSmooth(stations, rings, C, part.slots, P.lie, {
        // (its floor: the layers beneath and a share of the ease, LIE_FLOOR, along the point's own normal; the yoke's cap
        // kept, so the hull never stands the cloth out sideways past the arm's root)
        floor: (j, k) => add(rings[j].points[part.slots[k]], mul(N[j][k], H0[j][k] + LIE_FLOOR * easeAt(j))),
        cap: (j, k, p) => { if (!yoke[j]) return p; const b = rings[j].points[part.slots[k]], sx = Math.sign(b[0]) || 1, c = YOKE_SIDE * easeAt(j), o = sx * (p[0] - b[0]);
          return o > c ? [b[0] + sx * (c + (o - c) * (1 - yokeW[j])), p[1], p[2]] : p; } });
      // THE RISE (a `shoulder` piece's, outfit laws 2, on a trunk with shoulder forms): from the chest up, one surface to
      // the neckline (riseToNeck), never the torso's boxy top turned over as a lid
      const risen = P.shoulder && yoke.some(Boolean);
      if (risen) riseToNeck(stations, rings, C, part.slots, { under: [...overs, ...(worn[src] || []).filter((nm) => !HULL_FIT.test(nm)), ...riseForms(parts, worn, P.group, false)].map((nm) => parts[nm]), forms: riseForms(parts, worn, P.group, true).map((nm) => parts[nm]), ease: formEase(parts, P), armhole: P.shoulder === 'sleeveless', inArm, armIn: inArm ?? armVolume(parts), body: parts[src], easeAt, armpit: armpitOf(parts) });
      const name = `${P.id}_${src}`;
      // the caps pinched on the axis a little beyond the end rings (a cap in its ring's plane has no outward side)
      const axis = unit(sub(C[n - 1], C[0])), rad = (j) => mean(part.slots.map((sl) => [dmath.hypot(...sub(stations[j].points[sl], C[j])), 0, 0]))[0];
      // (a sleeve's head, over the web laid under the shoulder's line: its crown's cap barely past its first ring, never a
      // dome standing on the shoulder)
      const pinch = /^shoulderWeb[RL]$/.test(src) ? SHOULDER_CROWN : 0.3;
      const piece = { layer: 1, closure: 'closed', garment: true, slots: part.slots, stations, caps: { back: sub(C[0], mul(axis, pinch * rad(0))).map(r6), tip: add(C[n - 1], mul(axis, 0.3 * rad(n - 1))).map(r6) }, group: P.group, ...(part.slotT ? { slotT: { ...part.slotT } } : {}), ...(P.collar ? { collar: P.collar } : {}), ...(risen ? { risen: true } : {}) };
      if (part.bind !== undefined) {
        const own = (r) => (r.mix ? mixBlend(blendOf(part.bind, r.mix[0]), blendOf(part.bind, r.mix[1]), r.mix[2]) : blendOf(part.bind, r.id));
        const blend = Object.fromEntries(rings.map((r) => [r.id, own(r)]));
        // a body ring's own slot blends (a slot weighed apart from its station: the shoulder's over the collarbone, a
        // pectoral's) carry onto the garment ring over it, so the cloth there bends as that skin does
        // (a dense slot takes its body slots' blends: its own, or the mix of the two it lies between)
        const bodyBlend = (id, sl) => part.bind.blend?.[`${id}.${sl}`];
        const slotBlend = (id, sl) => { if (!denseSrc) return bodyBlend(id, sl); const S = denseSrc[part.slots.indexOf(sl)];
          if (!S.b) return bodyBlend(id, S.a); const a = bodyBlend(id, S.a), b = bodyBlend(id, S.b); if (!a && !b) return undefined;
          return mixBlend(a ?? blendOf(part.bind, id), b ?? blendOf(part.bind, id), 0.5); };
        if (typeof part.bind === 'object') for (const r of rings) for (const sl of Object.keys(r.points ?? {})) {
          const a = r.mix ? (slotBlend(r.mix[0], sl) ?? blendOf(part.bind, r.mix[0])) : slotBlend(r.id, sl);
          if (!r.mix) { if (a) blend[`${r.id}.${sl}`] = { ...a }; continue; }
          const b = slotBlend(r.mix[1], sl) ?? blendOf(part.bind, r.mix[1]);
          if (slotBlend(r.mix[0], sl) || slotBlend(r.mix[1], sl)) blend[`${r.id}.${sl}`] = mixBlend(a, b, r.mix[2]);
        }
        piece.bind = { bone: typeof part.bind === 'string' ? part.bind : part.bind.bone, blend: { ...blend, back: own(rings[0]), tip: own(rings[n - 1]) } };
      }
      parts[name] = stiff(piece); (worn[src] ??= []).push(name);
      for (const d of Object.values(dials)) if (Array.isArray(d.parts) && d.parts.includes(src)) d.parts = [...d.parts, name];
    }
  });
  return parts;
}

/** LYING SMOOTH (`lie`, a copy piece's: the station parameter from which it lies; outfit laws 2): from that ring up, the
 * cloth is one surface. Read in ONE frame, off the straight axis from the first of those rings' middles to the last (the
 * body's own ring middles jump forward at the bust and back at the shoulder blades, so a line bridged off each ring's
 * middle was no line in space, and the rings stood as rolls), each slot's line up the piece, read by its own length, has
 * its dents bridged (the upper hull), then rounded (LIE_ROUND passes of a neighbours' mean, never under its floor: the
 * layers beneath and LIE_FLOOR of the ease), and bridged again, so no ring stands proud of its neighbours as a roll or a
 * ledge and the cloth lies straight from the bust to the shoulder. Below it, where the cloth is held (a sash, a belt), it
 * gathers as it did. The first and last rings as they were; `cap` keeps a point where the piece's own cut holds it (the
 * yoke, its cap eased in over the rise above the armpit), the line laid again over what the cap left. A sleeve lies the
 * same way down the arm. In place. */
const LIE_FLOOR = 0.35, LIE_ROUND = 12, LIE_PASSES = 4;
/** a cinch's band below its ring (m) and how much fuller the cloth stands just above it (a share of its own ease) */
const CINCH_BAND = 0.05, CINCH_BLOUSE = 0.25;
function lieSmooth(stations, rings, C, slots, from, { floor = null, cap = null } = {}) {
  const J = rings.map((r, j) => j).filter((j) => rings[j].u >= from - 1e-9);
  if (J.length < 3) return;
  // (the axis: a straight line from the first ring's middle to the last's; each point read off its foot on it)
  const a = C[J[0]], ax = sub(C[J[J.length - 1]], a), L2 = dot3(ax, ax) || 1e-12;
  const foot = (p) => add(a, mul(ax, dot3(sub(p, a), ax) / L2)), n = J.length;
  // (bridged, held by its cut, bridged again: the cut's cap trims a point the hull lifted, so the line is laid again
  // over what the cap left, LIE_PASSES times, the rounding on the first)
  for (let it = 0; it < (cap ? LIE_PASSES : 1); it++) slots.forEach((sl, k) => {
    const P = J.map((j) => stations[j].points[sl]);
    // (the line read by its own length up the slot: a ring tipped at the neckline lies in its place along it)
    const x = [0]; for (let q = 1; q < n; q++) x.push(x[q - 1] + Math.max(1e-6, dmath.hypot(...sub(P[q], P[q - 1]))));
    const A = P.map(foot), D = P.map((p, q) => sub(p, A[q])), r = D.map((v) => dmath.hypot(...v)), U = D.map((v, q) => mul(v, 1 / (r[q] || 1e-9)));
    const fl = floor ? J.map((j, q) => Math.min(r[q], dot3(sub(floor(j, k), A[q]), U[q]))) : r.map(() => -Infinity);
    let y = upperHull(x, r);
    for (let pass = 0; pass < (it ? 0 : LIE_ROUND); pass++) y = y.map((v, q) => (q === 0 || q === n - 1 ? v : Math.max(fl[q], (y[q - 1] + 2 * v + y[q + 1]) / 4)));
    y = upperHull(x, y);
    for (let q = 1; q + 1 < n; q++) { const p = add(A[q], mul(U[q], y[q]));
      stations[J[q]].points[sl] = (cap ? cap(J[q], k, p) : p).map(r6); }
  });
}
/**
 * THE RISE (a trunk piece's `shoulder`, outfit laws 2, on a body with shoulder forms). The tiered torso's top is a box: its
 * front and back walls stand up to the shoulder line and its last rings turn in over a flat lid to the neck. A piece copied
 * off those rings turned over the same lid, a level edge across the upper chest (and a fold across the shoulder blades),
 * and its top ring, carried along its own tipped normal, dipped the neckline in a V. Risen, each slot's line from the chest
 * up is ONE CURVE: it leaves the ring where the slot stands furthest out (the chest, the shoulder blades, the side under
 * the arm, from RISE_BELOW under the armpit up) along the line it came up on, and arrives at the NECKLINE moving in toward
 * the neck (RISE_TILT up), so there is no edge between the chest and the neck but the neckline's own. The neckline is the
 * neck's root ring (the torso's top ring, its own shallow round: lower at the front than at the sides), carried out level
 * by NECK_EASE of the piece's ease over what is worn there. The rings between lie along the curve by its length, then each
 * point is lifted along the curve's normal over what is worn beneath it, over the body (LIE_FLOOR of the ease) and over the
 * shoulder's cone by its yoke's own ease (so the piece's yoke lies under it at rest and comes out with a raised arm), the
 * lift smoothed along the line and each line's dents bridged in one frame (no roll at a ring). What lies inside the arm
 * (armVolume) is the arm's: the body's corner above the armpit is never held out. A SLEEVELESS piece is an ARMHOLE: under
 * the arm its side runs up from the chest's own width (never held out by the arm's root or the shirt's under it, which
 * show in the armhole), letting go over the armpit so the cloth goes on over the shoulder's corner. In place.
 */
const RISE_BELOW = 0.1, RISE_K = 0.55, RISE_TILT = 1, NECK_EASE = 0.4, NECK_REACH = 0.015, RISE_CLEAR = 0.003, ARMHOLE_SIDE = 0.7, ARMHOLE_TOP = 0.05, RISE_HULL = 3, NECK_RISE = 0.5;
const armpitOf = (parts) => { const balls = Object.keys(parts).filter((nm) => /^shoulderBall[RL]$/.test(nm));
  return balls.length ? Math.min(...balls.flatMap((nm) => parts[nm].stations.flatMap((st) => Object.values(st.points).map((p) => p[2])))) : null; };
/** whether a point lies inside an arm: its root (the upper arm), its ball or its web, each read as the tube through its
 * rings' middles at their mean radius (a hair inside it) */
function armVolume(parts) {
  const tubes = Object.keys(parts).filter((nm) => /^(upperArm|shoulderBall|shoulderWeb)[RL]$/.test(nm) && parts[nm].stations?.length > 1).map((nm) => parts[nm].stations.map((st) => { const P = Object.values(st.points), c = mean(P);
    return { c, r: mean(P.map((p) => [dmath.hypot(...sub(p, c)), 0, 0]))[0] - SKIN_HAIR }; }));
  return (v) => tubes.some((T) => { for (let i = 0; i + 1 < T.length; i++) { const ax = sub(T[i + 1].c, T[i].c), L2 = dot3(ax, ax); if (L2 < 1e-12) continue;
    const f = Math.max(0, Math.min(1, dot3(sub(v, T[i].c), ax) / L2)); if (dmath.hypot(...sub(v, add(T[i].c, mul(ax, f)))) < T[i].r + (T[i + 1].r - T[i].r) * f) return true; } return false; });
}
/** what a rising trunk piece goes over on the shoulder: the shoulder's cones (`own`: the forms, cleared by the cloth's
 * ease, so the piece's own yoke lies under it at rest) or the cloth another layer wears on them */
const riseForms = (parts, worn, group, own) => ['R', 'L'].flatMap((S) => (own ? [`shoulderCone${S}`].filter((nm) => parts[nm]?.stations)
  : (worn[`shoulderCone${S}`] || []).filter((nm) => parts[nm] && parts[nm].group !== group)));
/** the ease a piece's yoke stands off the shoulder's cone with (its own, proportional to the cone's mean ring radius when
 * the piece's is), so the rise clears the yoke and no more */
function formEase(parts, P) {
  const cones = ['R', 'L'].map((S) => parts[`shoulderCone${S}`]).filter((c) => c?.stations?.length);
  if (!P.proportional || !cones.length) return P.ease;
  return P.ease * mean(cones.flatMap((c) => c.stations.map((st) => [ringRadius(st), 0, 0])))[0] / P.proportional;
}
/** where a trunk piece's rise starts (see riseToNeck): the ring index `j` and the height `z` up to which what lies beneath
 * is cleared by the ordinary lift (halfway to the next ring), or null where it does not rise. The curve starts on one ring
 * for every slot: the lowest of the rings where the body under a slot stands furthest out, from RISE_BELOW under the
 * armpit, so the turn begins at the chest's fullest and the rings above it stay rings */
function riseStart(rings, C, slots, armpit) {
  const n = rings.length, t = n - 1; if (armpit === null || n < 4) return null;
  const ct = C[t], hd = (p) => dmath.hypot(p[0] - ct[0], p[1] - ct[1]);
  const lo = C.findIndex((c) => c[2] >= armpit - RISE_BELOW); if (lo < 1 || lo > t - 2) return null;
  const j = Math.min(...slots.map((sl) => { let b = lo; for (let q = lo; q < t; q++) if (hd(rings[q].points[sl]) > hd(rings[b].points[sl])) b = q; return b; }));
  return j > t - 2 ? null : { j, z: (C[j][2] + C[j + 1][2]) / 2 };
}
function riseToNeck(stations, rings, C, slots, { under, forms, ease, armhole = false, inArm = null, armIn, body, easeAt, armpit }) {
  const n = stations.length, t = n - 1; if (armpit === null || n < 4) return;
  const ct = C[t], up = [0, 0, 1];
  const hOut = (p) => unit([p[0] - ct[0], p[1] - ct[1], 0]), hd = (p) => dmath.hypot(p[0] - ct[0], p[1] - ct[1]);
  const start = riseStart(rings, C, slots, armpit); if (!start) return;
  const j0 = start.j;
  // (what it clears, read as surfaces: each part's rings and the quarters between them, each ring's slots and the halves
  // between them, so the lift is met between rings as well as on them and never stands a roll at one)
  const fill = (P) => { const S = P.stations, sl = P.slots, o = [];
    for (let i = 0; i < S.length; i++) for (const f of i + 1 < S.length ? [0, 0.25, 0.5, 0.75] : [0]) { const ring = sl.map((q) => (f ? lerp3(S[i].points[q], S[i + 1].points[q], f) : S[i].points[q]));
      ring.forEach((p, k) => o.push(p, lerp3(p, ring[(k + 1) % ring.length], 0.5))); }
    return o; };
  const zMin = Math.min(...C.slice(j0).map((c) => c[2])) - 0.06, near = (p) => p[2] >= zMin && !(inArm && inArm(p));
  // (an armhole's cloth answers only to what lies inside its line, the chest's width under the arm, ARMHOLE_SIDE: what lies
  // out past it is the sleeve's, which comes out of the armhole)
  const capW = armhole ? Math.max(...slots.map((sl) => stations[j0].points[sl]).filter((p) => Math.abs(hOut(p)[0]) >= ARMHOLE_SIDE).map(hd), 0) : 0;
  const inside = (p) => !armhole || !capW || p[2] > armpit + ARMHOLE_TOP || Math.abs(p[0] - ct[0]) <= capW;
  const wornPts = under.flatMap(fill).filter(near).filter(inside), bodyPts = fill(body).filter(near).filter((p) => !(p[2] > armpit && armIn(p))), formPts = forms.flatMap(fill).filter(near).filter((p) => !armIn(p) && inside(p));
  // the lift over a point set along a direction, within a hand's breadth round it and its slab along the line (and, at
  // the neckline, only what lies within NECK_REACH out of it: the neck's own layers, never the chest's front)
  const liftOver = (p, nrm, tau, half, pts, clear, reach = Infinity) => { let h = 0; for (const v of pts) { const d = sub(v, p), dn = dot3(d, nrm), o = dn + clear; if (o <= h || dn > reach) continue;
    const al = dot3(d, tau); if (al < -half || al > half) continue; if (dmath.hypot(...sub(d, add(mul(nrm, dn), mul(tau, al)))) < 0.06) h = o; } return h; };
  const out = stations.map((st) => slots.map((sl) => st.points[sl])), lift = stations.map(() => slots.map(() => 0)), liftW = stations.map(() => slots.map(() => 0)), NRM = stations.map(() => slots.map(() => null));
  slots.forEach((sl, k) => {
    const b = rings[t].points[sl];
    // the neckline: the neck's root carried out level over what is worn there
    const ho = hOut(b), Q = add(b, mul(ho, NECK_EASE * easeAt(t) + liftOver(b, ho, up, 0.015, wornPts, SKIN_HAIR, NECK_REACH)));
    const P0 = stations[j0].points[sl], T0 = unit(sub(P0, stations[j0 - 1].points[sl])), T3 = unit(add(mul(hOut(Q), -1), mul(up, RISE_TILT)));
    const d = sub(Q, P0), L = dmath.hypot(...d), a = Math.min(0.5 * L, RISE_K * Math.max(0.25 * L, dot3(d, T0))), bb = Math.min(0.5 * L, RISE_K * Math.max(0.25 * L, dot3(d, T3)));
    const B = [P0, add(P0, mul(T0, a)), sub(Q, mul(T3, bb)), Q];
    const at = (s) => { const r = 1 - s; return add(add(mul(B[0], r * r * r), mul(B[1], 3 * r * r * s)), add(mul(B[2], 3 * r * s * s), mul(B[3], s * s * s))); };
    const tan = (s) => { const r = 1 - s; return unit(add(add(mul(sub(B[1], B[0]), 3 * r * r), mul(sub(B[2], B[1]), 6 * r * s)), mul(sub(B[3], B[2]), 3 * s * s))); };
    // (the rings between by the curve's length)
    const S = 48, len = [0]; for (let q = 1; q <= S; q++) len.push(len[q - 1] + dmath.hypot(...sub(at(q / S), at((q - 1) / S))));
    const sAt = (f) => { const g = f * len[S]; let q = 1; while (q < S && len[q] < g) q++; return (q - 1 + (g - len[q - 1]) / Math.max(1e-12, len[q] - len[q - 1])) / S; };
    const seg = len[S] / (t - j0);
    for (let j = j0 + 1; j <= t; j++) { const s = j === t ? 1 : sAt((j - j0) / (t - j0)), p = at(s), tau = tan(s);
      const beta = unit(cross3(up, hOut(p))); let nrm = unit(cross3(tau, beta)); if (dot3(nrm, add(hOut(p), up)) < 0) nrm = mul(nrm, -1);
      out[j][k] = p; NRM[j][k] = nrm;
      if (j < t) liftW[j][k] = liftOver(p, nrm, tau, seg / 2, wornPts, SKIN_HAIR + RISE_CLEAR);
      if (j < t) lift[j][k] = Math.max(liftW[j][k], liftOver(p, nrm, tau, seg / 2, bodyPts, LIE_FLOOR * easeAt(j)), liftOver(p, nrm, tau, seg / 2, formPts, ease + RISE_CLEAR)); }
  });
  // (the lift smoothed along the line, never below its own: each slot's normal is its own, so it is not carried round the
  // ring to a slot facing another way)
  for (let pass = 0; pass < 2; pass++) for (let j = j0 + 1; j < t; j++) lift[j] = lift[j].map((h, k) => Math.max(h, (lift[j - 1][k] + lift[j + 1][k]) / 2));
  // (an ARMHOLE, a sleeveless piece's: under the arm the cloth goes up from the chest's own width to the shoulder, never
  // held out past it by the arm's root, which the arm covers: a slot facing the side, ARMHOLE_SIDE, is kept within its
  // width at the chest)
  // (over the armpit the cap lets go, ARMHOLE_TOP, so the cloth goes on over the shoulder's corner to its own yoke)
  // (never in past the cloth worn beneath it there, which only an arm covers: what is inside the line is the piece's)
  const cap = (k, p, j) => { const ho = hOut(stations[j0].points[slots[k]]); if (!armhole || Math.abs(ho[0]) < ARMHOLE_SIDE) return p;
    const w = Math.max(hd(stations[j0].points[slots[k]]), hd(add(out[j][k], mul(NRM[j][k], liftW[j][k])))), r = hd(p);
    const g = Math.max(0, Math.min(1, (p[2] - armpit) / ARMHOLE_TOP)), f = 1 - g * g * (3 - 2 * g);
    return r > w && f > 0 ? [ct[0] + (p[0] - ct[0]) * (1 - f * (1 - w / r)), ct[1] + (p[1] - ct[1]) * (1 - f * (1 - w / r)), p[2]] : p; };
  for (let j = j0 + 1; j < t; j++) slots.forEach((sl, k) => { stations[j].points[sl] = cap(k, add(out[j][k], mul(NRM[j][k], lift[j][k])), j).map(r6); });
  // (the neckline never under the ring below it: where that ring was lifted over the layers at the neck, the neckline
  // comes up with it, still rising into it at NECK_RISE of the band's width, so the front never dips into a V nor turns
  // a level band at the neck)
  slots.forEach((sl, k) => { const q = out[t][k], b = stations[t - 1].points[sl], w = dmath.hypot(q[0] - b[0], q[1] - b[1]);
    stations[t].points[sl] = [q[0], q[1], Math.max(q[2], b[2] + NECK_RISE * w)].map(r6); });
  // (then each slot's line, from RISE_HULL rings under the rise to the neckline, read in one frame as lieSmooth reads it,
  // has its dents bridged: a lift that met one ring and not the next stands no roll between them; never past the cap)
  const J = stations.map((_, j) => j).filter((j) => j >= Math.max(0, j0 - RISE_HULL)), a = mean(slots.map((sl) => stations[J[0]].points[sl]));
  const ax = sub(mean(slots.map((sl) => stations[t].points[sl])), a), L2 = dot3(ax, ax) || 1e-12, foot = (p) => add(a, mul(ax, dot3(sub(p, a), ax) / L2));
  slots.forEach((sl, k) => { const P = J.map((j) => stations[j].points[sl]), x = [0]; for (let q = 1; q < P.length; q++) x.push(x[q - 1] + Math.max(1e-6, dmath.hypot(...sub(P[q], P[q - 1]))));
    const A = P.map(foot), D = P.map((p, q) => sub(p, A[q])), r = D.map((v) => dmath.hypot(...v)), y = upperHull(x, r);
    for (let q = 1; q + 1 < P.length; q++) if (y[q] > r[q] + 1e-7) { const j = J[q], p = add(A[q], mul(D[q], y[q] / (r[q] || 1e-9)));
      stations[j].points[sl] = (j > j0 ? cap(k, p, j) : p).map(r6); } });
}
/** the upper hull of the line (x, y) (x increasing) read at each x: every y raised to the least concave line over them */
function upperHull(x, y) {
  const H = [];
  for (let q = 0; q < x.length; q++) { while (H.length >= 2) { const a = H[H.length - 2], b = H[H.length - 1]; if ((x[b] - x[a]) * (y[q] - y[a]) - (y[b] - y[a]) * (x[q] - x[a]) >= 0) H.pop(); else break; } H.push(q); }
  const out = [...y];
  for (let h = 0; h + 1 < H.length; h++) { const a = H[h], b = H[h + 1]; for (let q = a + 1; q < b; q++) out[q] = Math.max(y[q], y[a] + (y[b] - y[a]) * (x[q] - x[a]) / Math.max(1e-9, x[b] - x[a])); }
  return out;
}

/**
 * THE SHOULDER UNDER CLOTH (a trunk piece's `shoulder`, outfit laws 2, on a body with shoulder forms: the tiered body's
 * ball, its cone to the neck's root and its web, tiered-form.js tieredSockets). The forms stood a deltoid's dome above the
 * trunk's own top, so a trunk piece copied off the torso's rings ended in a flat shelf with the forms (painted as the
 * shirt) standing over it as balls. Clothed, the shoulder is one line of cloth:
 *
 *   LAID (layShoulders): each side's forms are laid under the SHOULDER'S LINE, a roof from the neck's root (the torso's top
 *     ring at its side) straight down to the shoulder point (the torso's widest ring above the armpit, at its side) and
 *     rounding down past it over the arm's root (a parabola of the arm's first ring's radius); a point over it comes down
 *     onto it. The forms keep their slots, their stations and their weights, so they move as they did, under the cloth.
 *   CARRIED (withShoulders): the piece's cloth goes on over them as pieces of its own, `<id>Yoke_shoulderCone{R,L}` (the
 *     cone's tube from inside the neck over the trapezius, ending at the ring through the shoulder point, `armhole`) and,
 *     sleeved, `<id>Yoke_shoulderWeb{R,L}` (the sleeve's head, from the shoulder's crown down into the sleeve); sleeveless,
 *     that ring is the armhole's edge, on the shoulder and wrapping under the arm. (Run on into the arm, the cone's turned
 *     rings stood out of the sleeve as flaps.)
 *     Copies of the forms' rings, so they skin as the forms do, torso to fold to arm, and nest: each is lifted along its
 *     normals (never met between its rings) over the cloth another layer wears there, on the trunk, the forms and that
 *     arm (shoulderBeneath, shoulderNear), so an under-layer's shoulder lies inside; a sleeve's head's crown, its rings laid
 *     flat under the line, takes its ease up over the shoulder as well as out (SHOULDER_CROWN_TILT).
 * Absent `shoulder`, or a body without the forms (the realistic, the classic), nothing changes.
 */
const ROOF_CLEAR = 0.002, SHOULDER_CROWN = 0.05, SHOULDER_CROWN_TILT = Object.freeze([1.2, 0.6]);
const ringRadius = (st) => { const P = Object.values(st.points), c = mean(P); return mean(P.map((p) => [dmath.hypot(...sub(p, c)), 0, 0]))[0]; };
function layShoulders(parts) {
  const T = parts.torso; if (!T?.stations?.length) return;
  for (const S of ['R', 'L']) {
    const sx = S === 'R' ? 1 : -1, forms = ['shoulderBall', 'shoulderCone', 'shoulderWeb'].map((b) => `${b}${S}`).filter((n) => parts[n]?.stations);
    if (!forms.length) continue;
    const armpit = Math.min(...(parts[`shoulderBall${S}`] ?? parts[forms[0]]).stations.flatMap((st) => Object.values(st.points).map((p) => p[2])));
    const side = (st) => Object.values(st.points).reduce((b, p) => (sx * p[0] > sx * b[0] ? p : b));
    const neck = side(T.stations[T.stations.length - 1]);
    let point = null;
    for (const st of T.stations) { const p = side(st); if (Math.max(...Object.values(st.points).map((q) => q[2])) >= armpit && (!point || sx * p[0] > sx * point[0])) point = p; }
    if (!point || sx * point[0] <= sx * neck[0] + 1e-6) continue;
    const xn = sx * neck[0], zn = neck[2], xs = sx * point[0], zs = point[2], arm = parts[`upperArm${S}`];
    const rho = Math.max(1e-3, arm?.stations?.length ? ringRadius(arm.stations[0]) : 0.3 * (xs - xn));
    const roof = (ax) => (ax <= xn ? zn : ax <= xs ? zn + (zs - zn) * (ax - xn) / (xs - xn) : zs - (ax - xs) ** 2 / (2 * rho));
    const lay = (p) => { const z = roof(sx * p[0]) - ROOF_CLEAR; return p[2] > z ? [p[0], p[1], r6(z)] : p; };
    for (const nm of forms) { const P = parts[nm];
      parts[nm] = { ...P, stations: P.stations.map((st) => ({ ...st, points: Object.fromEntries(Object.entries(st.points).map(([k, p]) => [k, lay(p)])) })), caps: { back: lay(P.caps.back), tip: lay(P.caps.tip) } }; }
  }
}
/** the garments with each `shoulder` piece's cloth over the shoulder after it (see layShoulders): its ease, its ring
 * (proportional, dense) and its group, on the cone, and on the web when sleeved */
function withShoulders(garments) {
  return garments.flatMap((P) => { if (!P.shoulder) return [P];
    const base = { id: `${P.id}Yoke`, ease: P.ease, group: P.group, ...(P.proportional !== undefined ? { proportional: P.proportional } : {}), ...(P.dense !== undefined ? { dense: P.dense } : {}) };
    return [P, { ...base, part: ['shoulderCone'], armhole: true }, ...(P.shoulder === 'sleeved' ? [{ ...base, part: ['shoulderWeb'] }] : [])]; });
}
/** an armhole's window on a shoulder's cone: from its first ring to the one nearest the ball's middle (the ring through
 * the shoulder point), or null on a body without the ball */
function armholeWindow(parts, src) {
  const cone = parts[src], ball = parts[src.replace(/^shoulderCone/, 'shoulderBall')];
  if (!/^shoulderCone[RL]$/.test(src) || !ball?.stations) return null;
  const bc = mean(ball.stations.flatMap((st) => Object.values(st.points))), U = cone.stations.map((st, k) => st.u ?? k);
  const d = cone.stations.map((st) => dmath.hypot(...sub(mean(Object.values(st.points)), bc)));
  return [U[0], U[d.indexOf(Math.min(...d))]];
}
/** what a piece on a shoulder form stands off beside what is worn on its own form (see layShoulders): the cloth of another
 * group already worn on the torso, that side's other forms and its arm, another layer's, never its own. A trunk piece
 * stands off none of it (its lid lies under its own layer's shoulder pieces, which cover the layers beneath there, and its
 * chest lies smooth as before). */
function shoulderBeneath(parts, src, worn, group) {
  const S = /^shoulder(Ball|Cone|Web)([RL])$/.exec(src)?.[2];
  if (!S) return [];
  const forms = ['shoulderBall', 'shoulderCone', 'shoulderWeb'].map((b) => `${b}${S}`);
  const family = ['torso', ...forms, `upperArm${S}`];
  const other = family.flatMap((n) => worn[n] || []).filter((n) => parts[n] && parts[n].group !== group);
  return other.filter((n, i, a) => a.indexOf(n) === i);
}
/** whether a point lies under a copy piece's rings (its centres `C`): along their run and within SHOULDER_NEAR of their
 * surface, the radius between the two rings it lies between */
const SHOULDER_NEAR = 0.03;
const shoulderNear = (rings, C, slots) => { const R = rings.map((r, j) => mean(slots.map((sl) => [dmath.hypot(...sub(r.points[sl], C[j])), 0, 0]))[0]);
  return (v) => { for (let j = 0; j + 1 < C.length; j++) { const ax = sub(C[j + 1], C[j]), L2 = dot3(ax, ax); if (L2 < 1e-12) continue;
    const f = dot3(sub(v, C[j]), ax) / L2; if (f < 0 || f > 1) continue; const d = dmath.hypot(...sub(v, add(C[j], mul(ax, f))));
    if (d <= R[j] + (R[j + 1] - R[j]) * f + SHOULDER_NEAR) return true; } return false; }; };
/** what a hull piece hangs over beside its own parts: the garments worn on them, and on the trunk's shoulder forms where
 * it hangs over the trunk (see layShoulders; none worn there, as before) */
const wornUnder = (names, worn) => [...names.flatMap((nm) => worn[nm] || []), ...(names.includes('torso') ? Object.keys(worn).filter((nm) => SHOULDER_FORM.test(nm)).flatMap((nm) => worn[nm]) : [])];

/** A HOOD (`fit: 'hood'`): cloth rising from the shoulders (`from`) over the head, open at the face. The head and the
 * hair an anime hero is drawn with are added to the mesh after the parts, so the piece is told the head's volume:
 * `head: { at, r }`, an ellipsoid (centre, semi-axes in m). Each ring is the support, in twenty directions, of what lies
 * in its slab among `part` (the shoulders' and the neck's rings, and whatever is worn on them: the cloak it rises from)
 * and of the ellipsoid's section there, carried out by the ease; the rings crowd toward the crown so it reads round,
 * and from the head's widest ring down it only falls (never tucking in to the neck).
 * Its arc is `around` at the shoulders (the cloak's) and opens to the face (`open`, degrees each side of the front,
 * 50 by default) from the chin up. A closed slab `thick` deep. It is locked to the figure: the shoulders' blend at its
 * foot, the neck's above, the head's from the head's base up, so it turns with the head. `<id>_hood`, rings st0 (the
 * shoulders) … st11 (the crown). */
const HOOD_SLOTS = 13, HOOD_RINGS = 12;
function hoodPart(parts, names, P, worn) {
  if (P.worn !== undefined) return drapedHood(parts, names, P, worn);
  const n = SLOT_FAMILIES.ring20.length, N = HOOD_RINGS, e = P.ease, thick = P.thick ?? 0.005, { at: hc, r: hr } = P.head;
  const zb = heightAt(parts, P.from), zTop = hc[2] + hr[2] + e;
  const beneath = [...names, ...(P.over || []), ...wornUnder(names, worn)].filter((nm, i, a) => a.indexOf(nm) === i && parts[nm] && !/_hood$/.test(nm));
  const pts = beneath.flatMap((nm) => [...parts[nm].stations.flatMap((st) => Object.values(st.points)), parts[nm].caps.back, parts[nm].caps.tip]);
  const cy = hc[1], dirs = Array.from({ length: n }, (_, k) => [Math.sin(2 * Math.PI * k / n), Math.cos(2 * Math.PI * k / n)]);
  const zs = Array.from({ length: N }, (_, i) => zb + (zTop - zb) * Math.sin(Math.PI / 2 * i / (N - 1)));
  const slabOf = (i) => [i < N - 1 ? (zs[i + 1] - zs[i]) / 2 : 0.01, i > 0 ? (zs[i] - zs[i - 1]) / 2 : 0.02];
  let prev = null;
  const R = zs.map((z, i) => { const [up, down] = slabOf(i), q = pts.filter((p) => p[2] <= z + up && p[2] >= z - down);
    // the head's section at this height (its support in a direction is the ellipse's: hypot of the semi-axes along it)
    const f = 1 - ((z - hc[2]) / hr[2]) ** 2, ex = f > 0 ? hr[0] * Math.sqrt(f) : 0, ey = f > 0 ? hr[1] * Math.sqrt(f) : 0;
    let r = dirs.map(([dx, dy]) => Math.max(0.01, f > 0 ? hc[0] * dx + (hc[1] - cy) * dy + Math.hypot(ex * dx, ey * dy) : 0, ...q.map((p) => p[0] * dx + (p[1] - cy) * dy)));
    if (!q.length && f <= 0 && prev) r = prev.map((x) => x * 0.5); prev = r;
    r = r.map((x, k) => Math.max(x, r[(n - k) % n]));
    for (let pass = 0; pass < 3; pass++) r = r.map((x, k) => Math.max(x, (r[(k + 1) % n] + r[(k + n - 1) % n]) / 2));
    return r; });
  // from the head's widest ring down the cloth FALLS: it never narrows toward the shoulders (it does not tuck in under
  // the skull to the neck), so it covers the nape and the hair down the back
  const sum = (r) => r.reduce((a, b) => a + b, 0); let widest = N - 1;
  zs.forEach((z, i) => { if (z >= hc[2] - hr[2] && sum(R[i]) > sum(R[widest])) widest = i; });
  for (let i = widest - 1; i >= 0; i--) R[i] = R[i].map((x, k) => Math.max(x, R[i + 1][k]));
  // the face's opening: the cloak's arc at the shoulders, opening to `open` each side of the front from the chin up
  const chin = hc[2] - 0.55 * hr[2], open = P.open ?? 50, [b0] = P.around;
  const openAt = (z) => { const t = Math.max(0, Math.min(1, (z - zb) / Math.max(1e-6, chin - zb))), s = t * t * (3 - 2 * t); return b0 + (open - b0) * s; };
  // how it skins: the shoulders' blend at its foot, the neck's up to the head's base, the head's above
  const nearestBlend = (part, z) => { if (!part) return null; let best = part.stations[0], bd = Infinity;
    for (const st of part.stations) { const d = Math.abs(mean(Object.values(st.points))[2] - z); if (d < bd) { bd = d; best = st; } } return blendOf(part.bind, best.id); };
  const foot = nearestBlend(parts.torso, zb) ?? { [parts.neck?.bind?.bone ?? 'neck']: 1 }, neckB = nearestBlend(parts.neck, (zb + chin) / 2) ?? foot;
  const headB = parts.cranium ? (blendOf(parts.cranium.bind, parts.cranium.stations[0].id) ?? { head: 1 }) : { head: 1 }, base = hc[2] - hr[2];
  const ss = (a, b, z) => { const t = Math.max(0, Math.min(1, (z - a) / Math.max(1e-6, b - a))); return t * t * (3 - 2 * t); };
  const blendAt = (z) => (z < base ? mixBlend(foot, neckB, ss(zb, base, z)) : mixBlend(neckB, headB, ss(base, hc[2] - 0.2 * hr[2], z)));
  const m = HOOD_SLOTS, L = 2 * m, slots = Array.from({ length: L }, (_, k) => (k === 0 || k === m ? `p${k}` : k < m ? `p${k}R` : `p${L - k}L`));
  const rAt = (i, deg) => { const x = ((deg % 360) + 360) % 360 / (360 / n), k = Math.floor(x) % n, f = x - Math.floor(x); return R[i][k] + (R[i][(k + 1) % n] - R[i][k]) * f; };
  const stations = [], blend = {};
  zs.forEach((z, i) => { const id = `st${i}`, points = {}, a0 = openAt(z), a1 = 360 - a0;
    slots.forEach((sl, k) => { const inner = k >= m, j = inner ? 2 * m - 1 - k : k, deg = a0 + (a1 - a0) * j / (m - 1), th = deg * Math.PI / 180;
      const r = rAt(i, deg) + e - (inner ? thick : 0), p = [Math.sin(th) * r, cy + Math.cos(th) * r, z]; points[sl] = p.map(r6); blend[`${id}.${sl}`] = blendAt(z); });
    stations.push({ id, u: i, points }); });
  const mid = (i) => mean(Object.values(stations[i].points)), bot = mid(0), crown = mid(N - 1);
  return { layer: 1, closure: 'closed', garment: true, slots, stations, caps: { back: [bot[0], bot[1], bot[2] - 0.004].map(r6), tip: [crown[0], crown[1], crown[2] + 0.004].map(r6) }, group: P.group,
    bind: { bone: Object.keys(headB)[0], blend: { ...blend, back: foot, tip: headB } } };
}

/** THE DRAPED HOOD's words (outfit laws 2; a hood piece's, validateGarments): `worn` up over the head or down on the
 * shoulders; `point` the back's peak (none: round; short: a peak at the back of the crown; long: a liripipe, a tail
 * hanging down the back); `depth` how far the brim comes forward of the face; `budget` the register's (planes the box's,
 * facets the low-poly's, smooth the rest) */
export const HOOD_WORDS = Object.freeze({ worn: ['up', 'down'], point: ['none', 'short', 'long'], depth: ['shallow', 'deep'], budget: ['planes', 'facets', 'smooth'] });
/** per budget: the slots a side of the opening and the rings from the shoulders to the crown */
/** the least the hood stands off the skull and the hair (m, at an adult's head) */
const HOOD_CLEAR = 0.008;
const HOOD_BUDGET = Object.freeze({ planes: { m: 4, N: 7 }, facets: { m: 7, N: 10 }, smooth: { m: 13, N: 16 } });
/** THE HEAD AS IT IS WORN: the head's own parts compiled where they sit (the cranium or the realistic head's skin, the jaw,
 * and every part pinned to them: the face, the hair, the ears), so a hood fits the head and the hair this figure has,
 * the landmark head, the anime head's big skull and hair, the realistic head, a child's or a chibi's, never a stretched
 * ellipsoid. → { all, hair, face, brow } points, or null when the parts name no head */
function headCloud(parts) {
  const seeds = new Set(Object.keys(parts).filter((n) => /^(cranium|jaw|headSkin)$/.test(n)));
  for (let grew = true; grew;) { grew = false; for (const [n, p] of Object.entries(parts)) if (!seeds.has(n) && p.pin?.parent && seeds.has(p.pin.parent)) { seeds.add(n); grew = true; } }
  for (const n of ['earR', 'earL']) if (parts[n] && !parts[n].pin && seeds.size) seeds.add(n);
  if (!seeds.size) return null;
  const mesh = compileLayered({ schema: 'layered-v1', dials: {}, parts: Object.fromEntries([...seeds].map((n) => [n, parts[n]])) }, {}, { details: true, creases: false });
  const out = { all: [], hair: [], face: [], brow: [] };
  mesh.vertices.forEach((p, i) => { const n = mesh.provenance[i].part; out.all.push(p);
    if (/^hair(?!Brows|Lashes|Beard)/.test(n)) out.hair.push(p); else if (!/^ear/.test(n)) out.face.push(p);
    if (/^(brow[RL]|hairBrows)$/.test(n)) out.brow.push(p); });
  return out.all.length ? out : null;
}
/** the hair a hood is worn over: what the opening shows, out to TUCK.keep degrees each side of the front (fading out by
 * TUCK.fade more) and below TUCK.brim of the way from the brow to the crown; the rest pressed to within TUCK.slack of the
 * skull (at the head's scale), straight in toward the skull's middle */
const TUCK = Object.freeze({ keep: 65, fade: 20, brim: 0.35, slack: 0.01, cone: 25 });
const FACE_LOCKS = /Fringe|Bang|Temple|Sideburn/;
/**
 * HAIR TUCKED UNDER A HOOD (outfit laws 2, a draped hood worn up): the fringe and the locks that frame the face, which the
 * opening shows, stay as they are; the crown, the back, a tail and long back hair, behind the brim, are pressed in toward
 * the skull to lie within a little slack of it, as hair gathered under a hood does, so the hood is cut to the skull and
 * never to a full head of hair standing out behind (a chibi's hood the size of its hair, an anime hood's back boxed out
 * by it). Each hair part pinned to the head is rewritten in its own pin's frame (`offsets`); a part that stretches with a
 * dial or follows its parent is left as it is. In place on `parts`. Worn down, or no hair: nothing changes.
 */
function tuckHair(parts) {
  const seeds = new Set(Object.keys(parts).filter((n) => /^(cranium|jaw|headSkin)$/.test(n)));
  for (let grew = true; grew;) { grew = false; for (const [n, p] of Object.entries(parts)) if (!seeds.has(n) && p.pin?.parent && seeds.has(p.pin.parent)) { seeds.add(n); grew = true; } }
  // (the locks that frame the face, the fringe, the temples' and the sideburns, are kept whole: their roots lie under the
  // brim, and a lock half pressed in would tear at the brim's line)
  const hairNames = [...seeds].filter((n) => /^hair(?!Brows|Lashes|Beard)/.test(n) && !FACE_LOCKS.test(n) && parts[n].layer > 1 && parts[n].offsets && !parts[n].stretch && !parts[n].follow);
  if (!hairNames.length) return;
  for (const n of ['earR', 'earL']) if (parts[n] && !parts[n].pin) seeds.add(n);
  const mesh = compileLayered({ schema: 'layered-v1', dials: {}, parts: Object.fromEntries([...seeds].map((n) => [n, parts[n]])) }, {}, { details: true, creases: false });
  const skull = [], brows = [];
  mesh.vertices.forEach((p, i) => { const n = mesh.provenance[i].part; if (!/^hair/.test(n) && !/^ear/.test(n)) skull.push(p); if (/^(brow[RL]|hairBrows)$/.test(n)) brows.push(p); });
  if (skull.length < 8) return;
  const lo = [0, 1, 2].map((k) => Math.min(...skull.map((p) => p[k]))), hi = [0, 1, 2].map((k) => Math.max(...skull.map((p) => p[k]))), c = lo.map((v, k) => (v + hi[k]) / 2);
  const hs = hi[2] - lo[2], top = hi[2], brow = brows.length ? Math.max(...brows.map((p) => p[2])) : lo[2] + 0.62 * hs, zKeep = brow + TUCK.brim * (top - brow);
  const slack = TUCK.slack * hs / 0.24, cosCone = dmath.cos(TUCK.cone * Math.PI / 180);
  const rel = skull.map((p) => sub(p, c)), relLen = rel.map((v) => Math.sqrt(dot3(v, v)));
  // the skull's reach toward a direction: the furthest of its points within the cone round it, along it
  const reach = (u) => { let r = 0; rel.forEach((v, j) => { const l = relLen[j]; if (l > 1e-9) { const a = dot3(v, u); if (a >= cosCone * l && a > r) r = a; } }); return r; };
  const smooth = (t) => { const x = Math.max(0, Math.min(1, t)); return x * x * (3 - 2 * x); };
  for (const name of hairNames) {
    const frame = mesh.pins[name], placed = mesh.parts[name]?.points; if (!frame || !placed) continue;
    let moved = false; const offsets = {};
    for (const [id, o] of Object.entries(parts[name].offsets)) {
      const p = placed[id]; if (!p) { offsets[id] = o; continue; }
      const v = sub(p, c), d = Math.sqrt(dot3(v, v)), th = Math.abs(dmath.atan2(v[0], v[1])) * 180 / Math.PI;
      // what the opening shows stays: w 1 in front below the brim, 0 behind it
      const w = (1 - smooth((th - TUCK.keep) / TUCK.fade)) * (1 - smooth((p[2] - zKeep) / (0.1 * hs)));
      const u = d > 1e-9 ? mul(v, 1 / d) : [0, 0, 1], room = reach(u) + slack;
      if (w >= 1 || d <= room) { offsets[id] = o; continue; }
      const q = add(c, mul(u, room)), np = add(mul(p, w), mul(q, 1 - w));
      offsets[id] = surfaceLocalOffset(frame, np).map(r6); moved = true;
    }
    if (moved) parts[name] = { ...parts[name], offsets };
  }
}
/** an ellipsoid's surface as points (a head with no parts of its own: `head: { at, r }`) */
const ellipsoidCloud = ({ at, r }) => { const all = [];
  for (let i = 0; i <= 12; i++) for (let k = 0; k < 24; k++) { const v = Math.PI * i / 12, u = 2 * Math.PI * k / 24; all.push([at[0] + r[0] * Math.sin(v) * Math.sin(u), at[1] + r[1] * Math.sin(v) * Math.cos(u), at[2] + r[2] * Math.cos(v)]); }
  return { all, hair: [], face: all.filter((p) => p[1] > at[1]), brow: [] }; };
const smooth01 = (t) => { const x = Math.max(0, Math.min(1, t)); return x * x * (3 - 2 * x); };
/**
 * A DRAPED HOOD (`fit: 'hood'` with `worn`, outfit laws 2): cut and fallen as cloth, from the head it is worn over (headCloud)
 * and the cloth's own stiffness (`material` / `rigidity`, cloth-law.js: soft wool collapses, stiff leather stands).
 *
 * WORN UP. Each ring, from just below the shoulder line (`from`) to over the crown, is the support in twenty directions of
 * the head and hair at its height and of what lies beneath at the shoulders (the cloak it rises from), made symmetric and
 * its dents filled; the CROWN lies on the skull and the hair with a little slack (more as the cloth stands), and each
 * direction's line from the shoulders to the crown is bridged (the upper hull): the cloth falls from the head onto the
 * shoulders as a tent, never a cylinder dropped to them, and never tucks in under the jaw. The BACK falls from the crown to
 * its `point`: a peak at the back of the crown, a ridge down the seam (short), or a liripipe (long: a tail hung from that
 * peak down the back, its own part `<id>_hoodTail`, which flows as a strand of the hood's cloth); none keeps it round. The
 * OPENING frames the face: from the chin to the brim its edge stands clear of the cheeks (`open`, degrees each side of the
 * front, narrows it), its top, the BRIM, set above the brow by the cloth's stiffness (soft cloth comes down to the brow,
 * stiff stands at the hairline), brought forward of the face by `depth`, and rolled (its edge a fold standing proud); below
 * the chin it opens out to the cloak's own arc (`around`). Where the cloth is held at the neck it gathers in a few LARGE
 * FOLDS, none at the shoulders, so its lower edge lies on the cloak's collar with no gap or step.
 *
 * WORN DOWN. The hood lies collapsed on the upper back: a loose ring of its opening round the neck at the collar, the
 * cloth beneath it a soft sack on the back, narrowing to its point down the spine (a liripipe hangs on from it). The head
 * and the hair are bare.
 *
 * Its `budget` (the register's) sets the slots and the rings, the same shape at every budget. A closed slab `thick` deep,
 * its rings st0 (the foot) … up, skinning as the old hood did (the shoulders at its foot, the neck, the head over the head's
 * base; down, the shoulders and the neck alone). The body is locked; the tail, when there is one, flows.
 */
function drapedHood(parts, names, P, worn) {
  const up = P.worn !== 'down', B = HOOD_BUDGET[P.budget ?? 'smooth'], m = B.m, N = B.N, n = SLOT_FAMILIES.ring20.length;
  const e = P.ease, thick = P.thick ?? 0.005, rg = clothRigidity(P) ?? 0.4, point = P.point ?? 'short', deep = (P.depth ?? 'deep') === 'deep';
  const zb = heightAt(parts, P.from);
  const beneath = [...names, ...(P.over || []), ...wornUnder(names, worn)].filter((nm, i, a) => a.indexOf(nm) === i && parts[nm] && !/_hood$/.test(nm) && parts[nm].stations);
  const under = beneath.flatMap((nm) => [...parts[nm].stations.flatMap((st) => Object.values(st.points)), parts[nm].caps.back, parts[nm].caps.tip]);
  const H = headCloud(parts) ?? ellipsoidCloud(P.head);
  // the head's landmarks off its own points: the crown, the chin, the brow, the cheeks, the skull's middle front to back
  const zTopH = Math.max(...H.all.map((p) => p[2]));
  const skullY = H.all.filter((p) => p[2] > zTopH - 0.35 * (zTopH - zb)), cy = (Math.min(...skullY.map((p) => p[1])) + Math.max(...skullY.map((p) => p[1]))) / 2;
  const front = H.face.filter((p) => p[1] > cy), chin = Math.max(zb + 0.02, Math.min(...(front.length ? front : H.all).map((p) => p[2])));
  const hs = Math.max(0.05, zTopH - chin), brow = H.brow.length ? Math.max(...H.brow.map((p) => p[2])) : chin + 0.62 * hs;
  const cheekPts = front.filter((p) => p[2] >= chin + 0.15 * (brow - chin) && p[2] <= brow);
  const cheek = cheekPts.length ? Math.max(...cheekPts.map((p) => Math.abs(p[0]))) : 0.08 * hs / 0.24;
  const k = hs / 0.24;   // the head's own scale against an adult's crown-to-chin
  const dirs = Array.from({ length: n }, (_, q) => [Math.sin(2 * Math.PI * q / n), Math.cos(2 * Math.PI * q / n)]);
  const support = (pts) => dirs.map(([dx, dy]) => pts.reduce((t, p) => Math.max(t, p[0] * dx + (p[1] - cy) * dy), 0.005));
  const fill = (r) => { r = r.map((x, q) => Math.max(x, r[(n - q) % n])); for (let pass = 0; pass < 3; pass++) r = r.map((x, q) => Math.max(x, (r[(q + 1) % n] + r[(q + n - 1) % n]) / 2)); return r; };
  const rAt = (R, deg) => { const x = ((deg % 360) + 360) % 360 / (360 / n), q = Math.floor(x) % n, f = x - Math.floor(x); return R[q] + (R[(q + 1) % n] - R[q]) * f; };
  const L = 2 * m, slots = Array.from({ length: L }, (_, q) => (q === 0 || q === m ? `p${q}` : q < m ? `p${q}R` : `p${L - q}L`));
  // how it skins: the shoulders' blend at its foot, the neck's up to the head's base, the head's above (as hoodPart's)
  const nearestBlend = (part, z) => { if (!part) return null; let best = part.stations[0], bd = Infinity;
    for (const st of part.stations) { const d = Math.abs(mean(Object.values(st.points))[2] - z); if (d < bd) { bd = d; best = st; } } return blendOf(part.bind, best.id); };
  const foot = nearestBlend(parts.torso, zb) ?? { [parts.neck?.bind?.bone ?? 'neck']: 1 }, neckB = nearestBlend(parts.neck, (zb + chin) / 2) ?? foot;
  const carrier = parts.cranium ?? parts.headSkin, headB = carrier?.bind ? (blendOf(carrier.bind, carrier.stations?.[0]?.id) ?? { head: 1 }) : { head: 1 };
  const blendAt = (z) => (z < chin ? mixBlend(foot, neckB, smooth01((z - zb) / Math.max(1e-6, chin - zb))) : mixBlend(neckB, headB, smooth01((z - chin) / Math.max(1e-6, 0.35 * hs))));
  const slab = (zs, i) => [i < zs.length - 1 ? Math.max(0.006, (zs[i + 1] - zs[i]) / 2) : 0.01, i > 0 ? Math.max(0.006, (zs[i] - zs[i - 1]) / 2) : 0.02];
  const [b0] = P.around, foldN = Math.max(2, Math.round(m / 4)), foldA = (0.012 + 0.012 * (1 - rg)) * k;
  // the folds a cloth makes where it is held (at the neck): `nf` of them across an arc from a to 360 − a, outward only
  const folds = (deg, a, amp) => { const t = (deg - a) / Math.max(1e-6, 360 - 2 * a); return amp * (1 - Math.cos(2 * Math.PI * (2 * foldN + 1) * t)) / 2; };
  const stations = [], blend = {};
  const ring = (i, z, a0, rOf, inner = (deg, r) => r - thick, bl = blendAt(z)) => { const id = `st${i}`, points = {};
    slots.forEach((sl, q) => { const isIn = q >= m, j = isIn ? 2 * m - 1 - q : q, deg = a0 + (360 - 2 * a0) * j / (m - 1), th = deg * Math.PI / 180;
      const ro = rOf(deg, j), r = isIn ? inner(deg, ro, j) : ro, p = [Math.sin(th) * r, cy + Math.cos(th) * r, z]; points[sl] = p.map(r6); blend[`${id}.${sl}`] = bl; });
    stations.push({ id, u: i, points }); };
  let tailRoot = null, tailBack = null;
  if (up) {
    const zTop = zTopH + e * (0.35 + 0.8 * rg), z0 = zb;
    const zs = Array.from({ length: N }, (_, i) => z0 + (zTop - z0) * Math.sin(Math.PI / 2 * i / (N - 1)));
    let prev = null;
    const R = zs.map((z, i) => { const [hi, lo] = i === 0 ? [0.004, 0.004] : slab(zs, i), inS = (p) => p[2] <= z + hi && p[2] >= z - lo;   // (the foot: what lies at its own height, the collar it sits on)
      const hp = H.all.filter(inS), bp = under.filter(inS);
      let r = hp.length || bp.length ? support([...hp, ...bp]) : prev.map((x) => x * 0.6); prev = r; r = fill(r);
      // the crown's slack (stiff cloth stands off the skull, soft lies on it); the cowl's ease below the chin
      // (the cowl's ease between: room to gather at the neck, none spare where it lies on the collar)
      const sl = e * (0.35 + 0.8 * rg), ez = z >= chin || z <= zb ? sl : sl + (e - sl) * Math.sin(Math.PI * smooth01((z - zb) / Math.max(1e-6, chin - zb)));
      return r.map((x) => x + ez); });
    // the crown closes over the top: the last ring a small one round the top's middle
    R[N - 1] = R[N - 1].map((x) => Math.min(x, 0.18 * hs));
    // THE POINT: the back of the crown drawn out to a peak (a ridge down the back seam, fading round to the sides)
    const pk = { none: 0, short: 0.22, long: 0.26 }[point] * hs, zp = zTopH - 0.18 * hs;
    if (pk > 0) { const ip = zs.reduce((b, z, i) => (Math.abs(z - zp) < Math.abs(zs[b] - zp) ? i : b), 0), rp = rAt(R[ip], 180) + pk;
      R[ip] = R[ip].map((x, q) => { const d = Math.abs(((q * 360 / n) - 180 + 540) % 360 - 180); return Math.max(x, rp - (rp - x) * Math.min(1, (d / 70) ** 1.4) - 0.001); });
      tailRoot = [0, cy - rp, zs[ip]]; }
    // THE FALL: each direction's line from the shoulders to the crown bridged (cloth hangs from the head and lies on the
    // shoulders, a tent; it never tucks in under the jaw or round the neck)
    const hull = () => { for (let q = 0; q < n; q++) { const y = upperHull(zs, R.map((r) => r[q])); y.forEach((v, i) => { R[i][q] = v; }); } };
    hull();
    // (ROUNDED, `hoodRound`, the realistic body's hood: each ring eased round its directions and each direction's line eased
    // down its rings, so the cloth is a curve and never the flat walls and corners of a support taken in twenty directions;
    // the clearance below raises it again wherever easing took it into the head or the hair)
    if (P.hoodRound) for (let pass = 0; pass < 4; pass++) {
      for (let i = 0; i < N; i++) { const r = R[i]; R[i] = r.map((x, q) => (r[(q + n - 1) % n] + 2 * x + r[(q + 1) % n]) / 4); }
      for (let q = 0; q < n; q++) { const col = R.map((r) => r[q]); for (let i = 1; i < N - 1; i++) R[i][q] = (col[i - 1] + 2 * col[i] + col[i + 1]) / 4; }
    }
    // CLEARANCE: the cloth runs straight between its rings and its directions, so the skull and the hair bulging between
    // them are met there: each point of them (but the face's own, which the opening shows) outside that patch raises its
    // four corners by the least that clears it, by HOOD_CLEAR, each corner's share by its nearness; twice over
    const clear = HOOD_CLEAR * k, faceSet = new Set(H.face), hood = H.all.filter((p) => !(p[1] > cy && p[2] < brow && faceSet.has(p)));
    for (let pass = 0; pass < 3; pass++) { const need = R.map((r) => r.map(() => 0));
      for (const p of hood) { const z = p[2]; let i = zs.findIndex((x) => x > z); if (i <= 0) continue; i -= 1; const f = (z - zs[i]) / (zs[i + 1] - zs[i]);
        const dx = p[0], dy = p[1] - cy, rp = Math.hypot(dx, dy); if (rp < 1e-6) continue; let th = Math.atan2(dx, dy) * 180 / Math.PI; if (th < 0) th += 360;
        const x = th / (360 / n), q0 = Math.floor(x) % n, q1 = (q0 + 1) % n, g = x - Math.floor(x), chord = 1 / Math.cos(Math.PI / n);
        const W = [[i, q0, (1 - f) * (1 - g)], [i, q1, (1 - f) * g], [i + 1, q0, f * (1 - g)], [i + 1, q1, f * g]];
        const dl = (rp + clear) * chord - W.reduce((t, [a, b, w]) => t + w * R[a][b], 0); if (dl <= 0) continue;
        const zz = W.reduce((t, [, , w]) => t + w * w, 0); for (const [a, b, w] of W) need[a][b] = Math.max(need[a][b], dl * w / zz); }
      R.forEach((r, i) => r.forEach((_, q) => { r[q] += need[i][q]; })); R.forEach((r, i) => { R[i] = fill(r); }); hull(); }
    // the opening's half-angle at a height: past the cheeks (or `open`) from the chin to the brim, an arch over the brow
    // closing at the brim's top, out to the cloak's arc below the chin
    // (rounded: the arch springs from the cheekbones, so the opening is one curve over the face, never a square)
    const zBrim = brow + (0.12 + 0.3 * rg) * (zTopH - brow), zArch = P.hoodRound ? chin + 0.45 * (brow - chin) : brow - 0.15 * (brow - chin);
    const faceA = (i) => { if (Number.isFinite(P.open)) return P.open; let a = 20; while (a < 85 && rAt(R[i], a) * Math.sin(a * Math.PI / 180) < cheek + 0.012 * k) a += 1; return a; };
    const aOpen = zs.map((z, i) => { const f = faceA(i);
      if (z <= chin) return b0 + (f - b0) * smooth01((z - z0) / Math.max(1e-6, chin - z0));
      if (z <= zArch) return f; if (z >= zBrim) return 0; return f * Math.sqrt(Math.max(0, 1 - ((z - zArch) / (zBrim - zArch)) ** 2)); });
    // the brim forward of the face (`depth`), rolled at its edge; less forward the stiffer it stands
    // (rounded: a deep hood's brim comes forward as a soft fall, not a visor)
    const fwd = (deep ? (P.hoodRound ? 0.09 : 0.16) : 0.03) * hs * (1 - 0.4 * rg), roll = 0.045 * hs;
    zs.forEach((z, i) => { const a0 = aOpen[i], band = z >= chin ? smooth01((z - chin) / Math.max(1e-6, 0.5 * (brow - chin))) * (z <= zBrim + 0.1 * hs ? 1 : smooth01(1 - (z - zBrim - 0.1 * hs) / (0.15 * hs))) : 0;
      // (the folds at the neck: none at the foot, where it lies on the collar, none over the cheeks)
      const fz = z < chin ? Math.sin(Math.PI * smooth01((z - zb) / Math.max(1e-6, chin - zb))) : 0;
      const rOf = (deg, j) => { const d = Math.min(deg, 360 - deg); let r = rAt(R[i], deg);
        r += fwd * band * Math.max(0, Math.cos(d * Math.PI / 180)) ** 2;   // the brim forward
        if (a0 > 0.5 && z > chin - 0.05 * hs && (j === 0 || j === m - 1)) r += roll * band; else if (a0 > 0.5 && z > chin - 0.05 * hs && (j === 1 || j === m - 2)) r += 0.4 * roll * band;
        else if (a0 <= 0.5 && z >= zBrim - 0.02 * hs && z <= zBrim + 0.12 * hs) r += roll * Math.max(0, Math.cos(d * Math.PI / 180)) ** 3;
        return r + folds(deg, a0, foldA * fz); };
      ring(i, z, a0, rOf, (deg, r) => Math.max(r - thick, rAt(R[i], deg) - thick)); });
    tailBack = (z) => { if (z < zs[0]) return null; const i = zs.findIndex((x) => x >= z); if (i < 0) return null; if (i === 0) return rAt(R[0], 180);
      const f = (z - zs[i - 1]) / (zs[i] - zs[i - 1]); return rAt(R[i - 1], 180) + (rAt(R[i], 180) - rAt(R[i - 1], 180)) * f; };
  } else {
    // DOWN: from the collar's ring round the neck to the point down the back, the cloth of the hood lying collapsed on
    // what is beneath (the cloak, the back): each ring the support there, a soft sack standing off it most at its middle
    const zc = zb + 0.38 * Math.max(0.02, chin - zb), zd = zb - (point === 'none' ? 0.9 : 1.1) * (P.hoodRound ? 0.7 : 1) * hs;
    const zs = Array.from({ length: N }, (_, i) => zc + (zd - zc) * (i / (N - 1)) ** 0.9);
    let prev = null;
    const R = zs.map((z, i) => { const lo = i > 0 ? Math.max(0.006, (zs[i - 1] - z) / 2) : 0.02, hi = i < N - 1 ? Math.max(0.006, (z - zs[i + 1]) / 2) : 0.02;
      const bp = under.filter((p) => p[2] <= z + hi && p[2] >= z - lo); let r = bp.length ? support(bp) : prev; prev = r; return fill(r); });
    // (its line down the back bridged as the cloth lies, the sack's bulk and the collar's roll on it)
    for (let q = 0; q < n; q++) { const y = upperHull(zs.map((z) => -z), R.map((r) => r[q])); y.forEach((v, i) => { R[i][q] = v; }); }
    // (a collapsed hood lies FLAT on the back: its sack a little cloth deep and its collar's roll low, so from the side it
    // reads as cloth lying on the back, never a hump standing proud of it)
    // (rounded, `hoodRound`: the realistic body's down hood a COWL gathered at the nape: its collar rolled thick, the cloth
    // heaped highest just under it and thinning down the back, folded where it is gathered round the neck)
    const R0 = !!P.hoodRound, bulk = (R0 ? 0.11 : 0.035 + 0.025 * (1 - rg)) * hs, roll = (R0 ? 0.07 : 0.035) * hs;
    const sackAt = R0 ? (t) => Math.sin(Math.PI * Math.min(1, 0.35 + 0.65 * t)) ** 0.7 * (1 - 0.55 * t) * bulk : (t) => Math.sin(Math.PI * (0.12 + 0.88 * t) ** 0.8) * bulk;
    const backOf = (deg) => Math.max(0, -Math.cos(deg * Math.PI / 180));
    const downFold = R0 ? (deg, a0, t) => folds(deg, a0, foldA * 1.1 * (1 - smooth01(t * 2.5))) * backOf(deg) : () => 0;
    zs.forEach((z, i) => { const t = i / (N - 1), a0 = b0 + (180 - Math.max(6, 14 * (1 - rg)) - b0) * smooth01(t) ** 0.7;
      const sack = sackAt(t), rl = roll * (1 - smooth01(t * 3));
      // (it lies ON what is beneath: a share of the ease off it, DOWN_EASE, never the whole ease a hood worn up keeps
      // round the head, which stood the sack a hand's breadth proud of the cloak in profile)
      const rOf = (deg, j) => { const w = Math.sin(Math.PI * j / (m - 1)) ** 0.6; return rAt(R[i], deg) + DOWN_EASE * e + rl * (R0 ? 0.35 + 0.65 * backOf(deg) : 1) + sack * w + downFold(deg, Math.min(a0, 179), t); };
      ring(i, z, Math.min(a0, 179), rOf, (deg, r) => Math.max(rAt(R[i], deg) + 0.4 * DOWN_EASE * e, r - Math.max(thick, 0.7 * (r - rAt(R[i], deg) - DOWN_EASE * e))), mixBlend(foot, neckB, i === 0 ? 0.5 : 0)); });
    const last = mean(Object.values(stations[N - 1].points)); tailRoot = [0, last[1], last[2]];
    // (the liripipe lies on the sack where it is, never a sack's full depth off the back below it: it hooked out there)
    tailBack = (z) => { const i = zs.findIndex((x) => x <= z); return i < 0 ? null : rAt(R[i], 180) + DOWN_EASE * e + sackAt(i / (N - 1)); };
  }
  const mid = (i) => mean(Object.values(stations[i].points)), bot = mid(0), topC = mid(stations.length - 1);
  const piece = { layer: 1, closure: 'closed', garment: true, slots, stations, caps: up ? { back: [bot[0], bot[1], bot[2] - 0.004].map(r6), tip: [topC[0], topC[1], topC[2] + 0.004].map(r6) } : { back: [bot[0], bot[1], bot[2] + 0.004].map(r6), tip: [topC[0], topC[1], topC[2] - 0.004].map(r6) }, group: P.group,
    bind: { bone: up ? Object.keys(headB)[0] : Object.keys(foot)[0], blend: { ...blend, back: up ? foot : mixBlend(foot, neckB, 0.5), tip: up ? headB : foot } } };
  if (point !== 'long' || !tailRoot) return piece;
  // THE LIRIPIPE: a tail from the point hanging down the back, tapering, laid just off what it hangs over (the hood's
  // back, the cloak), a strand of the hood's cloth (`root`: it flows from where it is sewn)
  const tl = (up ? 1.4 : 0.6) * hs, K = 7, r0 = 0.07 * hs, tslots = SLOT_FAMILIES.ring8;
  let lastBack = 0; const backAt = (z) => { const h = tailBack(z); if (h !== null) return h; const bp = under.filter((p) => Math.abs(p[2] - z) < 0.03 && Math.abs(p[0]) < 0.06); return bp.length ? (lastBack = Math.max(lastBack, Math.max(...bp.map((p) => cy - p[1])) + 0.3 * e)) : lastBack; };   // (it falls: never in under what it hung over above)
  const tStations = [], tBlend = {};
  for (let i = 0; i < K; i++) { const t = i / (K - 1), z = tailRoot[2] - tl * t, rr = r0 * (1 - 0.75 * t), y = tailRoot[1] + (cy - backAt(z) - 0.7 * rr - tailRoot[1]) * smooth01(t / 0.3);
    const id = `st${i}`, points = {}; tslots.forEach((sl, q) => { const a = 2 * Math.PI * q / tslots.length; points[sl] = [Math.sin(a) * rr, y + Math.cos(a) * rr, z].map(r6); tBlend[`${id}.${sl}`] = up ? blendAt(Math.max(z, chin)) : foot; });
    tStations.push({ id, u: i, points }); }
  const tTop = mean(Object.values(tStations[0].points)), tEnd = mean(Object.values(tStations[K - 1].points));
  const tail = { layer: 1, closure: 'closed', garment: true, slots: tslots, stations: tStations, caps: { back: [tTop[0], tTop[1], tTop[2] + 0.004].map(r6), tip: [tEnd[0], tEnd[1], tEnd[2] - rr0(r0)].map(r6) }, group: P.group, root: tTop.map(r6),
    ...(P.rigidity !== undefined ? { rigidity: P.rigidity } : {}), ...(P.material !== undefined ? { material: P.material } : {}),
    bind: { bone: up ? Object.keys(headB)[0] : Object.keys(foot)[0], blend: { ...tBlend, back: up ? headB : foot, tip: up ? blendAt(chin) : foot } } };
  return { ...piece, tail };
}
const rr0 = (r0) => 0.25 * r0;
/** the share of a hood's ease it keeps off what it lies on, worn down */
const DOWN_EASE = 0.3;

// ─── footwear: two sections superposed on a flat sole ───
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
/** the distance from (x, z) along (dx, dz) to the boundary of the ellipse at (cx, cz) with semi-axes a, b (inside it) */
const toEllipse = (x, z, dx, dz, cx, cz, a, b) => { const ox = (x - cx) / a, oz = (z - cz) / b, ux = dx / a, uz = dz / b;
  const A = ux * ux + uz * uz, B = 2 * (ox * ux + oz * uz), C = ox * ox + oz * oz - 1; return (-B + Math.sqrt(Math.max(0, B * B - 4 * A * C))) / (2 * A); };
/** A shoe on `src` (a foot), built in the foot's own frame (along it heel → toe, out to its side, up), its slots the
 * fine ring's, R and L each from its own foot. Two solids, each the smallest that holds its share of the foot and toe
 * points with the ease: a ROUND ELLIPSOID over the heel (sunk through the sole and cut flat on it) and a FLAT HALF-ELLIPSOID over the
 * forefoot (its flat side the sole), reaching back under the instep; a ring is their two sections superposed (the
 * outermost in each direction), and nothing lies below the sole. */
function shoePart(parts, src, P) {
  // its own fine ring (a shoe needs no slot of the foot's: it binds by station), so the sole's edge is not cut across
  const foot = parts[src], side = /L$/.test(src) ? -1 : 1, slots = SLOT_FAMILIES.ring20, n = slots.length;
  const overs = (P.over || []).flatMap((o) => partsNamed(parts, o)).filter((o) => o !== src && o.slice(-1) === src.slice(-1));
  const pts = [foot, ...overs.map((o) => parts[o])].flatMap((q) => [...q.stations.flatMap((st) => Object.values(st.points)), q.caps.back, q.caps.tip]);   // its caps too: the heel and the toe tips
  const up = [0, 0, 1], C0 = mean(Object.values(foot.stations[0].points));
  let far = pts[0]; for (const p of pts) if (dmath.hypot(p[0] - C0[0], p[1] - C0[1]) > dmath.hypot(far[0] - C0[0], far[1] - C0[1])) far = p;
  const axis = unit([far[0] - C0[0], far[1] - C0[1], 0]), out = mul(unit(cross(axis, up)), side);   // out: the foot's outer side
  const local = pts.map((p) => { const d = sub(p, C0); return [dot(d, axis), dot(d, out), p[2]]; });
  const e = P.ease, toe = P.toe ?? 1, heel = P.heel ?? 0;
  const sole = Math.min(...local.map((q) => q[2])), a0 = Math.min(...local.map((q) => q[0])) - e, a1 = Math.max(...local.map((q) => q[0])) + e, L = a1 - a0;
  // the centre line across: a least-squares line through the points (a foot turned out, toes splayed)
  const ma = mean(local.map((q) => [q[0], 0, 0]))[0], ml = mean(local.map((q) => [q[1], 0, 0]))[0];
  const k = local.reduce((t, q) => t + (q[0] - ma) * (q[1] - ml), 0) / (local.reduce((t, q) => t + (q[0] - ma) ** 2, 0) || 1), cl = (a) => ml + k * (a - ma);
  // the two solids along the foot: centre, half-length and the power of their profile along it, a section's share
  // s(a) = (1 − |(a − c)/r|^p)^(1/p), never under 0.3: the heel round (p 2), the toe box blunt (p 3.5), so it keeps
  // its width until near the tip. Each is sized by the points where its section is full enough to hold them (s ≥ 0.45):
  // nearer its end a point is the tip's, and the ease covers it
  const back = { c: a0 + 0.22 * L, r: 0.22 * L + 2 * e, p: 2 }, front = { c: a0 + 0.58 * L, r: 0.42 * L + 2 * e, p: 3.5 };   // both reach a little past the foot, so neither end is pinched on it
  const share = (S, a) => Math.max(0.3, Math.max(0, 1 - Math.abs((a - S.c) / S.r) ** S.p) ** (1 / S.p));
  const fit = (S, mine) => { let w = 1e-3, h = 1e-3; for (const [a, l, z] of local.filter(mine)) { const sh = share(S, a); if (sh < 0.45) continue; w = Math.max(w, (Math.abs(l - cl(a)) + e) / sh); h = Math.max(h, (z - sole + e) / sh); } return { ...S, w, h }; };
  const inB = (q) => q[0] < a0 + 0.4 * L, inF = (q) => q[0] >= a0 + 0.3 * L;
  const B = fit(back, inB), F = fit(front, inF);
  // the heel cup a round ellipse sunk through the sole to SINK of its half-height and cut there, so it too stands flat:
  // its half-height the height it must reach over (1 + SINK)
  const SINK = 0.6; B.h = B.h / (1 + SINK); F.h *= toe;
  // grow each until its points lie inside the ellipse itself, not just its box (a high point out at the side, the
  // ankle's corner), the ease included: a few passes, since the heel's centre rises with its height
  const grow = (S, mine, zc) => { for (let it = 0; it < 4; it++) { let g = 1; for (const [a, l, z] of local.filter(mine)) { const sh = share(S, a); if (sh < 0.45) continue;
    const dl = Math.abs(l - cl(a)) + e, dz = Math.max(0, z - zc(S, sh)) + e; g = Math.max(g, Math.hypot(dl / (S.w * sh), dz / ((S === F ? S.h : S.h) * sh))); }
    S.w *= g; S.h *= g; } };
  grow(B, inB, (S, sh) => sole + SINK * S.h * sh); if (toe >= 1) grow(F, inF, () => sole);
  B.h += heel / 2;
  const N = 12, stations = [];
  for (let i = 0; i < N; i++) {
    const a = a0 + L * i / (N - 1), c = cl(a), sb = a <= back.c + back.r ? share(B, a) : 0, sf = a >= front.c - front.r ? share(F, a) : 0;
    const oz = sole + 0.15 * Math.min(...[sb ? 2 * B.h * sb : Infinity, sf ? F.h * sf : Infinity]);
    const points = {};
    for (let q = 0; q < n; q++) {
      const sl = side > 0 ? slots[q] : slots[(n - q) % n];   // the mirror of the R ring's slot, so the halves pair as the body's do
      const th = 2 * Math.PI * q / n, dx = Math.sin(th), dz = Math.cos(th);
      let t = 0;
      if (sb) { let tb = toEllipse(c, oz, dx, dz, c, sole + SINK * (B.h - heel / 2) * sb, B.w * sb, B.h * sb); if (dz < 0) tb = Math.min(tb, (sole - oz) / dz); t = Math.max(t, tb); }
      if (sf) { let te = toEllipse(c, oz, dx, dz, c, sole, F.w * sf, F.h * sf); if (dz < 0) te = Math.min(te, (sole - oz) / dz); t = Math.max(t, te); }
      points[sl] = add(add(C0, add(mul(axis, a), mul(out, c + t * dx))), [0, 0, Math.max(sole, oz + t * dz) - C0[2]]).map(r6);
    }
    stations.push({ id: `st${i}`, u: i, points, a });
  }
  const cen = (j) => mean(Object.values(stations[j].points)), ax = unit(sub(cen(N - 1), cen(0)));
  const piece = { layer: 1, closure: 'closed', garment: true, slots, stations: stations.map(({ a: _a, ...st }) => st), caps: { back: sub(cen(0), mul(ax, 0.01)).map(r6), tip: add(cen(N - 1), mul(ax, 0.01)).map(r6) }, group: P.group };
  if (foot.bind !== undefined) {
    // each ring binds as the foot's station nearest it along the foot
    const fa = foot.stations.map((st) => dot(sub(mean(Object.values(st.points)), C0), axis));
    const near = (a) => foot.stations[fa.reduce((b, x, j) => (Math.abs(x - a) < Math.abs(fa[b] - a) ? j : b), 0)].id;
    const blend = Object.fromEntries(stations.map((st) => [st.id, blendOf(foot.bind, near(st.a))]));
    piece.bind = { bone: typeof foot.bind === 'string' ? foot.bind : foot.bind.bone, blend: { ...blend, back: blend.st0, tip: blend[`st${N - 1}`] } };
  }
  return piece;
}

// ─── skirts: a hull round the hips and both legs ───
/** the height of an address { part, u | run } on a body part: its ring centre there */
function heightAt(parts, A) {
  const part = parts[A.part] ?? parts[`${A.part}R`]; if (!part) throw new Error(`skirt: '${A.part}' is not an L1 part`);
  const U = part.stations.map((s, k) => s.u ?? k), u0 = U[0], u1 = U[U.length - 1], u = Number.isFinite(A.u) ? A.u : u0 + A.run * (u1 - u0);
  const z = part.stations.map((st) => mean(Object.values(st.points))[2]); let i = U.findIndex((x) => x >= u - 1e-9); if (i <= 0) return z[Math.max(0, i)];
  return z[i - 1] + (z[i] - z[i - 1]) * (u - U[i - 1]) / (U[i] - U[i - 1]);
}
/** THE HULL ROUND THE LEGS (a skirt's, a panel's): at N heights from the waist (`from`) to the hem (`to`) the support of
 * everything there (the body parts, the garments already worn on them) in twenty directions about the waist's centre,
 * made symmetric; below the hips' widest ring it never narrows (cloth falls, it does not tuck between the legs) and
 * widens by `flare` per metre it falls. With it, how a point on it skins (`blendAt`). */
function legHull(parts, names, P, worn) {
  const n = SLOT_FAMILIES.ring20.length, flare = Array.isArray(P.flare) ? P.flare[1] : (P.flare ?? 0);
  const zw = heightAt(parts, P.from), zh = heightAt(parts, P.to);
  // (a panel's neighbours are not beneath it: panels hang side by side from one hull, never stacked on each other)
  const beneath = [...names, ...(P.over || []), ...names.flatMap((nm) => worn[nm] || [])].filter((nm, i, a) => a.indexOf(nm) === i && parts[nm] && !/_panel$/.test(nm));
  const pts = beneath.flatMap((nm) => [...parts[nm].stations.flatMap((st) => Object.values(st.points)), parts[nm].caps.back, parts[nm].caps.tip]);
  const waist = pts.filter((p) => Math.abs(p[2] - zw) < 0.04), cy = waist.length ? (Math.min(...waist.map((p) => p[1])) + Math.max(...waist.map((p) => p[1]))) / 2 : 0;
  const N = 12, dirs = Array.from({ length: n }, (_, k) => [Math.sin(2 * Math.PI * k / n), Math.cos(2 * Math.PI * k / n)]);
  const zs = Array.from({ length: N }, (_, i) => zw + (zh - zw) * i / (N - 1)), slab = Math.abs(zh - zw) / (N - 1) * 0.75;
  let prev = null;
  const R = zs.map((z) => { const q = pts.filter((p) => Math.abs(p[2] - z) <= slab);
    const r = q.length ? dirs.map(([dx, dy]) => Math.max(0.01, ...q.map((p) => p[0] * dx + (p[1] - cy) * dy))) : prev; prev = r;
    return r.map((x, k) => Math.max(x, r[(n - k) % n])); });
  // the hips' widest ring; below it the cloth only falls and flares
  let hip = 0; R.forEach((r, i) => { if (r.reduce((a, b) => a + b, 0) > R[hip].reduce((a, b) => a + b, 0)) hip = i; });
  for (let i = hip + 1; i < N; i++) R[i] = R[i].map((x, k) => Math.max(x, R[i - 1][k] + flare * Math.abs(zs[i] - zs[i - 1])));
  // the crotch: where the legs part (the lowest point of the pelvis, else the thighs' tops)
  const zc = parts.pelvis ? Math.min(...parts.pelvis.stations.flatMap((st) => Object.values(st.points)).map((p) => p[2])) : zw - 0.12;
  const pelvisBone = parts.pelvis?.bind?.bone ?? 'pelvis', legBone = (sd) => parts[`thigh${sd}`]?.bind?.bone ?? `thigh${sd}`;
  // a leg's centre and radius at a height: its thigh's and shank's ring centres, interpolated (null above it)
  const legRings = (sd) => ['thigh', 'shank'].flatMap((nm) => parts[`${nm}${sd}`]?.stations || []).map((st) => { const P2 = Object.values(st.points), c = mean(P2);
    return { c, r: Math.max(...P2.map((q) => dmath.hypot(q[0] - c[0], q[1] - c[1]))) }; }).sort((a2, b2) => b2.c[2] - a2.c[2]);
  const LR = { R: legRings('R'), L: legRings('L') };
  const legAt = (sd, z) => { const L = LR[sd]; if (!L.length || z > L[0].c[2]) return null; for (let q = 1; q < L.length; q++) if (z >= L[q].c[2]) { const f = (L[q - 1].c[2] - z) / Math.max(1e-9, L[q - 1].c[2] - L[q].c[2]);
    return { c: L[q - 1].c.map((v, d) => v + (L[q].c[d] - v) * f), r: L[q - 1].r + (L[q].r - L[q - 1].r) * f }; } return L[L.length - 1]; };
  // the cloth goes with what it lies nearest: each leg, or the line between them (the pelvis), by the inverse square
  // of its distance from each at its height (a leg from its surface, the line from the axis, the leg's radius off it).
  // So the cloth over a knee goes where the knee goes, the cloth between and behind the knees hangs between them, and a
  // stride swings the skirt rather than flinging it. The legs' share grows from the waist to the crotch, and so does the
  // between's: from the pelvis over the seat to both thighs evenly by the crotch (cloth HANGS from the waist: a hip
  // hinge tips the pelvis and the waistband with the trunk, never the cloth below the hips into the thighs).
  const blendAt = (p, z) => {
    const down = Math.max(0, Math.min(1, (zw - z) / Math.max(1e-6, zw - zc))), LgR = legAt('R', z), LgL = legAt('L', z);
    const inv = (d) => 1 / Math.max(1e-4, d) ** 2, off = (L) => (L ? Math.max(0.005, dmath.hypot(p[0] - L.c[0], p[1] - L.c[1]) - L.r) : Infinity);
    const iR = LgR ? inv(off(LgR)) : 0, iL = LgL ? inv(off(LgL)) : 0, iC = inv(Math.max(0.005, dmath.hypot(p[0], p[1] - cy) - (LgR?.r ?? 0.06)));
    const legs = Math.min(0.95, down * (iR + iL) / (iR + iL + iC)), split = iR + iL > 0 ? iR / (iR + iL) : 0.5;
    // the between's share that hangs between the thighs: none over the seat (it goes back with the pelvis in a hinge),
    // eased in over the lower half of the fall to the crotch
    const hs = Math.max(0, Math.min(1, (down - 0.5) / 0.5)), hang = (1 - legs) * hs * hs * (3 - 2 * hs);
    const w = { [pelvisBone]: 1 - legs - hang, [legBone('R')]: legs * split + hang / 2, [legBone('L')]: legs * (1 - split) + hang / 2 };
    const ent = Object.entries(w).filter(([, x]) => x > 1e-6), sum = ent.reduce((t, [, x]) => t + x, 0), out = Object.fromEntries(ent.map(([b, x]) => [b, r6(x / sum)]));
    const top = ent.sort((a2, b2) => b2[1] - a2[1])[0][0]; out[top] = r6(out[top] + 1 - Object.values(out).reduce((t, x) => t + x, 0)); return out; };
  return { n, N, zw, zh, zs, R, dirs, cy, hip, pelvisBone, blendAt };
}
/** A SKIRT round `names` (the hips and both legs, a list of L1 parts) from the waist (`from`) to the hem (`to`): each
 * ring at its height is the leg hull's (legHull), carried out by the ease; each point skins as the pelvis at the waist,
 * blending down to the leg on its own side by the crotch. */
function skirtPart(parts, names, P, worn) {
  const slots = SLOT_FAMILIES.ring20, e = P.ease, { N, zw, zs, R, dirs, cy, hip, pelvisBone, blendAt } = legHull(parts, names, P, worn);
  // the cloth's two faces: down the outside to the hem, folded there, and back up a wall `thick` inside it to the hips,
  // closed within the body; so the hem is an edge and the skirt is open beneath, never a disc across the legs
  const thick = P.thick ?? 0.004, ring = (i, inner) => ({ i, inner, z: inner ? zs[i] + (i === N - 1 ? thick : 0) : zs[i] });
  const walk = [...zs.map((_, i) => ring(i, false)), ...zs.map((_, i) => N - 1 - i).filter((i) => i >= hip).map((i) => ring(i, true))];
  const stations = [], blend = {};
  walk.forEach(({ i, inner, z }, j) => { const id = `st${j}`, points = {};
    slots.forEach((sl, k) => { const [dx, dy] = dirs[k], r = R[i][k] + e - (inner ? thick : 0); const p = [dx * r, cy + dy * r, z]; points[sl] = p.map(r6); blend[`${id}.${sl}`] = blendAt(p, z); });
    stations.push({ id, u: j, points }); });
  const zTop = zs[hip];
  const piece = { layer: 1, closure: 'closed', garment: true, slots, stations, caps: { back: [0, r6(cy), r6(zw + 0.02)], tip: [0, r6(cy), r6(zTop - 0.02)] }, group: P.group,
    bind: { bone: pelvisBone, blend: { ...blend, back: { [pelvisBone]: 1 }, tip: { [pelvisBone]: 1 } } } };
  return piece;
}
/** A DRAPE PANEL (`fit: 'panel'`): an open piece of cloth hung from the waist over an arc of the leg hull — `around`
 * [from, to] in degrees about the waist's centre (0 the front, 90 the figure's right, 180 the back) — and falling to its
 * hem: a coattail, a tabard's apron, a tasset, a loincloth. A closed slab `thick` deep (its outer face over the arc, its
 * inner face back under it), so it is cloth with two sides and edges; each ring is the hull's carried out by the ease
 * over everything worn beneath, flaring by `flare`; each point skins as the skirt's do. Its `root` (the top's middle)
 * hangs it as a strand from the waist when it flows (hero-flow.js). The piece is `<id>_panel`, rings st0 (the waist) …
 * st11 (the hem). */
const PANEL_SLOTS = 9;
// a petal hem: from this share of the fall down, the corners rise by this share of the fall
const PETAL = Object.freeze({ from: 0.45, rise: 0.42 });
// a cutaway: its front edge swept this share of its arc out by the hem (at `most` degrees, a piece that goes round to
// the back keeping its back), along a curve of this power (the fall's share)
const CUTAWAY = Object.freeze({ sweep: 0.9, most: 70, bend: 1.7 });
function panelPart(parts, names, P, worn) {
  const { N, zs, R, cy, pelvisBone, blendAt } = legHull(parts, names, P, worn), e = P.ease, thick = P.thick ?? 0.005;
  const [a0, a1] = P.around, m = PANEL_SLOTS, n = SLOT_FAMILIES.ring20.length;
  // the loop (outer face o0 … o8, then the inner back i8 … i0) named as a ring family is (station-loft.js: a midline slot,
  // the right half, a midline slot, the left half mirrored by name), so the mesher's faces close round it
  const L = 2 * m, slots = Array.from({ length: L }, (_, k) => (k === 0 || k === m ? `p${k}` : k < m ? `p${k}R` : `p${L - k}L`));
  // the hull's radius in any direction: between its twenty, by angle
  const rAt = (i, deg) => { const x = ((deg % 360) + 360) % 360 / (360 / n), k = Math.floor(x) % n, f = x - Math.floor(x); return R[i][k] + (R[i][(k + 1) % n] - R[i][k]) * f; };
  const stations = [], blend = {};
  // (`hemCut: 'petal'`: the hem a curve, not a level line: over the panel's lower part its corners are drawn up, the
  // middle left the longest, so the cloth ends as a petal does)
  const fall = zs[0] - zs[N - 1], petal = P.hemCut === 'petal' ? (i, j) => { const f = Math.max(0, (i / (N - 1) - PETAL.from) / (1 - PETAL.from)), edge = Math.abs(2 * j / (m - 1) - 1); return PETAL.rise * fall * f * f * edge * edge; } : () => 0;
  // (`hemCut: 'cutaway'`: its edge nearer the front swept out toward the other as it falls, a curve from the waist, so a
  // pair split at the front opens on what is under it as a tailcoat's fronts do; its hem the narrow end left)
  const near = (d) => Math.min(((d % 360) + 360) % 360, 360 - ((d % 360) + 360) % 360), front0 = near(a0) <= near(a1);
  const arcAt = P.hemCut === 'cutaway' ? (i) => { const t = (i / (N - 1)) ** CUTAWAY.bend * Math.min(CUTAWAY.most, CUTAWAY.sweep * (a1 - a0)); return front0 ? [a0 + t, a1] : [a0, a1 - t]; } : () => [a0, a1];
  zs.forEach((z0, i) => { const id = `st${i}`, points = {}, [b0, b1] = arcAt(i);
    slots.forEach((sl, k) => { const inner = k >= m, j = inner ? 2 * m - 1 - k : k, deg = b0 + (b1 - b0) * j / (m - 1), th = deg * Math.PI / 180, z = z0 + petal(i, j);
      const r = rAt(i, deg) + e - (inner ? thick : 0), p = [Math.sin(th) * r, cy + Math.cos(th) * r, z]; points[sl] = p.map(r6); blend[`${id}.${sl}`] = blendAt(p, z); });
    stations.push({ id, u: i, points }); });
  const mid = (i) => mean(Object.values(stations[i].points)), top = mid(0), bot = mid(N - 1);
  return { layer: 1, closure: 'closed', garment: true, slots, stations, caps: { back: [top[0], top[1], top[2] + 0.004].map(r6), tip: [bot[0], bot[1], bot[2] - 0.004].map(r6) }, group: P.group, root: top.map(r6),
    bind: { bone: pelvisBone, blend: { ...blend, back: { [pelvisBone]: 1 }, tip: blendAt(bot, bot[2]) } } };
}
/** A CAPE (`fit: 'cape'`): open cloth hung from the SHOULDERS over an arc of the hull round everything in `part` (the
 * trunk, the arms, the legs) — `around` as a panel's — and falling to its hem: a cloak, a cape, a mantle's tail. Its rings
 * crowd toward the top (the yoke over the shoulders reads), each the support of everything at its height in twenty
 * directions, made symmetric and with its dents filled round the ring (cloth bridges, it never tucks in), so it is round
 * where a board is flat. Above the widest ring among the shoulders it comes in to the neck; below it the cloth only falls,
 * flaring by `flare` (m per m of fall). A closed slab `thick` deep, as a panel. Each point skins as the torso's ring at its
 * height down to the waist, then hands over to the pelvis and the legs as a skirt's points do, and DRAPES ON THE ARMS:
 * cloth near an arm takes that arm's blend by nearness, so it goes where the arm goes. With no `root` it flows as a
 * curtain, a string per share of its width, each kept out of the arms. The piece is `<id>_cape`, rings st0 (the
 * shoulders) … st13 (the hem). `insideGroup`: its inner face's group (a lining).
 * `arms: false`: it hangs from the trunk alone (no arm carries it: a short cape an arm swings clear of, where cloth
 * carried by a swinging arm is dragged through the cloth beside it). `torn: { depth, count }`: its hem TORN into `count`
 * tongues across its arc, each tip hanging to the hem and the gaps between them torn up by as much as `depth` (each
 * gap its own share of it, seeded by its place: the same cape, the same rags), over its last two rings. */
const CAPE_SLOTS = 13, CAPE_RINGS = 14, ARM_SHARE = 1, ARM_NEAR = 0.05, ARM_FAR = 0.12;
function capePart(parts, names, P, worn) {
  const n = SLOT_FAMILIES.ring20.length, N = CAPE_RINGS, e = P.ease, thick = P.thick ?? 0.005, flare = Array.isArray(P.flare) ? P.flare[1] : (P.flare ?? 0);
  const zt = heightAt(parts, P.from), zh = heightAt(parts, P.to);
  // (it hangs over everything worn, drape panels too: only another cape is not beneath it)
  const beneath = [...names, ...(P.over || []), ...wornUnder(names, worn)].filter((nm, i, a) => a.indexOf(nm) === i && parts[nm] && !/_cape$/.test(nm));
  const pts = beneath.flatMap((nm) => [...parts[nm].stations.flatMap((st) => Object.values(st.points)), parts[nm].caps.back, parts[nm].caps.tip]);
  // the centre: the trunk's at the shoulders, between its front and its back
  const trunk = (parts.torso?.stations || []).flatMap((st) => Object.values(st.points)), near = (trunk.length ? trunk : pts).filter((p) => Math.abs(p[2] - zt) < 0.08);
  const cy = near.length ? (Math.min(...near.map((p) => p[1])) + Math.max(...near.map((p) => p[1]))) / 2 : 0;
  const dirs = Array.from({ length: n }, (_, k) => [Math.sin(2 * Math.PI * k / n), Math.cos(2 * Math.PI * k / n)]);
  const zs = Array.from({ length: N }, (_, i) => zt + (zh - zt) * (i / (N - 1)) ** 1.5);
  const slabOf = (i) => [i > 0 ? (zs[i - 1] - zs[i]) / 2 : 0.02, i < N - 1 ? (zs[i] - zs[i + 1]) / 2 : 0.02];
  let prev = null;
  const R = zs.map((z, i) => { const [lo, hi] = slabOf(i), q = pts.filter((p) => p[2] <= z + lo && p[2] >= z - hi);
    let r = q.length ? dirs.map(([dx, dy]) => Math.max(0.01, ...q.map((p) => p[0] * dx + (p[1] - cy) * dy))) : prev; prev = r;
    r = r.map((x, k) => Math.max(x, r[(n - k) % n]));
    // the dents filled: a direction under the mean of its neighbours rises to it (cloth bridges an arm's gap to the back)
    for (let pass = 0; pass < 3; pass++) r = r.map((x, k) => Math.max(x, (r[(k + 1) % n] + r[(k + n - 1) % n]) / 2));
    return r; });
  // the shoulders: the widest ring above the waist (the top half of the fall); below it the cloth falls, never narrowing
  const zw = parts.pelvis ? heightAt(parts, { part: 'pelvis', run: 1 }) : zt - 0.4 * (zt - zh), sum = (r) => r.reduce((a, b) => a + b, 0);
  let hold = 0; R.forEach((r, i) => { if (zs[i] >= zw && sum(r) > sum(R[hold])) hold = i; });
  for (let i = hold + 1; i < N; i++) R[i] = R[i].map((x, k) => Math.max(x, R[i - 1][k] + flare * Math.abs(zs[i] - zs[i - 1])));
  // LYING SMOOTH (`lie`: from that ring down, its rings' own parameter): each direction's line down the cape bridges the
  // dents between its rings (upperHull), so a short cape over the shoulders (a mantle) is one surface, never a ring stood
  // in under its neighbours at each slab; absent, as before
  if (Number.isFinite(P.lie)) { const I = zs.map((_, i) => i).filter((i) => i >= P.lie - 1e-9);
    if (I.length >= 3) for (let k = 0; k < n; k++) { const y = upperHull(I.map((i) => zt - zs[i]), I.map((i) => R[i][k])); I.forEach((i, q) => { R[i][k] = y[q]; }); } }
  // (a shoulder cape's SHOULDER ROUNDED, `capeArm`: each direction's line from the neck to the widest ring a quarter
  // ellipse, flat at the neck and falling at the tip, so the cloth turns over the shoulder in a curve and never meets its
  // fall at a corner; never inside the line it had, so it clears what it did)
  if (P.capeArm && hold > 1) for (let k = 0; k < n; k++) { const r0 = R[0][k], rh = R[hold][k], z0 = zs[0], zH = zs[hold];
    for (let i = 1; i < hold; i++) { const t = (zs[i] - zH) / Math.min(-1e-6, z0 - zH), ell = r0 + (rh - r0) * Math.sqrt(Math.max(0, 1 - t * t)); R[i][k] = Math.max(R[i][k], ell); } }
  // (a shoulder cape's hem ROLLED, `capeArm.roll`: its last rings stood out by it, a fur's edge)
  if (P.capeArm?.roll) { R[N - 1] = R[N - 1].map((x) => x + P.capeArm.roll); R[N - 2] = R[N - 2].map((x) => x + 0.55 * P.capeArm.roll); }
  // how a point skins: the torso's ring at its height above the waist, handing over to the pelvis by the waist; below it
  // as a skirt's point (legHull), when there are legs to hang over
  const torso = parts.torso, pelvisBone = parts.pelvis?.bind?.bone ?? 'pelvis';
  const torsoAt = (z) => { if (!torso) return { [pelvisBone]: 1 }; let best = torso.stations[0], bd = Infinity;
    for (const st of torso.stations) { const d = Math.abs(mean(Object.values(st.points))[2] - z); if (d < bd) { bd = d; best = st; } } return blendOf(torso.bind, best.id) ?? { [pelvisBone]: 1 }; };
  const legs = names.filter((nm) => /^(pelvis|thigh|shank|shin)[RL]?$/.test(nm));
  const below = parts.pelvis && legs.some((nm) => /^thigh/.test(nm)) && zh < zw ? legHull(parts, legs, { from: { part: 'pelvis', run: 1 }, to: P.to }, worn) : null;
  const zc = parts.pelvis ? Math.min(...parts.pelvis.stations.flatMap((st) => Object.values(st.points)).map((p) => p[2])) : zw - 0.12;
  const trunkAt = (p, z) => { if (z >= zw || !below) return mixBlend(torsoAt(z), { [pelvisBone]: 1 }, Math.max(0, Math.min(0.5, 0.5 * (zt - z) / Math.max(1e-6, zt - zw))));
    const waist = mixBlend(torsoAt(zw), { [pelvisBone]: 1 }, 0.5); return mixBlend(waist, below.blendAt(p, z), Math.max(0, Math.min(1, (zw - z) / Math.max(1e-6, zw - zc)))); };
  // THE ARMS: cloth lying over an arm drapes on it, so a raised or swinging arm carries the cloth with it instead of
  // passing through it. Each arm a polyline of its rings (the upper arm, then the forearm); a point's share of the arm
  // is whole (ARM_SHARE) within ARM_NEAR of its surface, fading to none by ARM_FAR: the cloth that lies on the arm
  const armLine = (sd) => [`upperArm${sd}`, `foreArm${sd}`].flatMap((nm) => (parts[nm]?.stations || []).map((st) => { const P2 = Object.values(st.points), c = mean(P2);
    return { c, r: Math.max(...P2.map((q) => dmath.hypot(...sub(q, c)))), w: blendOf(parts[nm].bind, st.id) }; })).filter((x) => x.w);
  const ARMS = ['R', 'L'].map(armLine).filter((L2) => L2.length > 1 && names.some((nm) => /^upperArm/.test(nm)));
  const armNear = (p) => { let best = null;
    for (const L2 of ARMS) for (let q = 0; q + 1 < L2.length; q++) { const a = L2[q], b = L2[q + 1], ab = sub(b.c, a.c), t = Math.max(0, Math.min(1, dot3(sub(p, a.c), ab) / Math.max(1e-9, dot3(ab, ab))));
      const d = dmath.hypot(...sub(p, add(a.c, mul(ab, t)))) - (a.r + (b.r - a.r) * t); if (!best || d < best.d) best = { d, a, b, t }; }
    if (best) best.w = mixBlend(best.a.w, best.b.w, best.t);   // the skin's own blend there, between its two rings
    return best; };
  // (a SHOULDER CAPE, `capeArm` { near, far, share, roll }: the realistic body's mantle, lying on the shoulders, takes the arm
  // over a wider reach and never whole, so a raised arm lifts its side as one soft fold, never a shard drawn out along it)
  const SH = P.capeArm, aNear = SH?.near ?? ARM_NEAR, aFar = SH?.far ?? ARM_FAR, aShare = SH?.share ?? ARM_SHARE;
  const blendAt = (p, z) => { const base = trunkAt(p, z), A = P.arms === false ? null : armNear(p); if (!A) return base;
    const f = Math.max(0, Math.min(1, (aFar - A.d) / (aFar - aNear))), share = aShare * f * f * (3 - 2 * f);
    return share < 0.01 ? base : mixBlend(base, A.w, share); };
  const [a0, a1] = P.around, m = CAPE_SLOTS, L = 2 * m;
  const slots = Array.from({ length: L }, (_, k) => (k === 0 || k === m ? `p${k}` : k < m ? `p${k}R` : `p${L - k}L`));
  const rAt = (i, deg) => { const x = ((deg % 360) + 360) % 360 / (360 / n), k = Math.floor(x) % n, f = x - Math.floor(x); return R[i][k] + (R[i][(k + 1) % n] - R[i][k]) * f; };
  const stations = [], blend = {}, oneCloth = P.arms === false || !!P.insideGroup;
  // (a TORN hem: each slot's rise over the last two rings, a V between two tongues' tips, each gap's depth its own share)
  const T = P.torn, tear = (i, j) => { if (!T || i < N - 2) return 0;
    const f = (j / (m - 1)) * T.count, g = Math.floor(Math.min(T.count - 1e-9, f)), v = Math.abs(2 * (f - g) - 1), gap = 0.55 + 0.45 * (((g * 7919 + 13) % 17) / 16);
    return T.depth * gap * Math.pow(v, 0.8) * (i === N - 1 ? 1 : 0.45); };
  zs.forEach((z0, i) => { const id = `st${i}`, points = {};
    slots.forEach((sl, k) => { const inner = k >= m, j = inner ? 2 * m - 1 - k : k, deg = a0 + (a1 - a0) * j / (m - 1), th = deg * Math.PI / 180, z = T ? z0 + tear(i, j) : z0;
      const r = rAt(i, deg) + e - (inner ? thick : 0), p = [Math.sin(th) * r, cy + Math.cos(th) * r, z]; points[sl] = p.map(r6);
      // (on a cape that says the new words, `arms: false` or a lining: a cape minted before keeps its bytes)
      // (its inside skins as the outside over it: a point a cloth's thickness nearer an arm took more of that arm, and
      // the inside came through the outside wherever the arm moved)
      const ro = r + (inner ? thick : 0); blend[`${id}.${sl}`] = blendAt(inner && oneCloth ? [Math.sin(th) * ro, cy + Math.cos(th) * ro, z] : p, z); });
    stations.push({ id, u: i, points }); });
  const mid = (i) => mean(Object.values(stations[i].points)), top = mid(0), bot = mid(N - 1);
  // no `root`: a flowing cape hangs as a CURTAIN (hero-flow.js), a string down each share of its width, so the cloth over
  // an arm is held out of that arm by its own string, not by one string down the spine
  // A LINING (`insideGroup`: a group): the slab's inner face in a colour of its own (station-loft.js `mirrorGroup`: the
  // ring's left half is the inner face here). One cloth, so it cannot cross itself as a second cape inside it did
  return { layer: 1, closure: 'closed', garment: true, slots, stations, caps: { back: [top[0], top[1], top[2] + 0.004].map(r6), tip: [bot[0], bot[1], bot[2] - 0.004].map(r6) }, group: P.group,
    ...(P.insideGroup ? { mirrorGroup: P.insideGroup } : {}),
    bind: { bone: pelvisBone, blend: { ...blend, back: torsoAt(zt), tip: trunkAt(bot, bot[2]) } } };
}
