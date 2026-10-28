/**
 * THE BEAST HEAD ON THE TIERED NECK: a beast-kin wears its kin's library head (creature-heads: the bear's, the wolf's,
 * the felid, the dragon's, the beaked, the mandibled), dressed for its coat (egocube/plan.js libraryHead: the skin's
 * tones, the people's eye accent, scaled to the body), seated by its nape on the hero's head base, its skull riding the
 * hero's head bone and its jaw a bone of its own. The neck that ends there is sealed inside the skull by the plan's own
 * seam (station-loft-plan.js: a head worn `on` a joint shrinks the segment's last ring until it is buried), so the head
 * never sits on a stub.
 *
 *   beastHeadOf(hero)       → the library head a beast wears ({ id }), or null when it keeps a person's (`head:
 *                             'person'`, or a hero that names a head of its own)
 *   beastHead(plan, hero)   → the plan with the head: the blank trunk's head off, the library head on, the rig's
 *                             head top on the skull's crown, its jaw hinged at the head's own pivot and opened by the
 *                             rig's jaw chain (a clip key's `jaw`), the head's dials worn. Absent, the plan as it was.
 *
 * Pure.
 */
import { beastCard } from './tiered.js';
import { scaleOf } from './topology.js';
import { HEAD_LIBRARY, headFor, headPlan } from '../creature-heads/index.js';
import { deriveHead } from '../creature-heads/derive.js';
import { validateHead, headFromPlan } from '../polygonizer/station-loft-head.js';
import { libraryHead } from '../egocube/plan.js';
import { partRings } from '../polygonizer/tiered-form.js';
import { SLOT_FAMILIES } from '../polygonizer/station-loft-plan.js';
import { headAtTier } from '../polygonizer/creature-drawn.js';
import { readTarget, pxPerMetre, DEFAULT_TARGET } from '../era/target.js';
import { planHeight } from '../era/cast-density.js';
import { beastCoverOf } from './cover.js';

const r6 = (x) => Math.round(x * 1e6) / 1e6 + 0;
const sub = (a, b) => a.map((x, i) => x - b[i]);
const unit = (a) => { const l = Math.hypot(...a) || 1; return a.map((x) => x / l); };
const centre = (pts) => { const v = Object.values(pts); return [0, 1, 2].map((k) => v.reduce((t, p) => t + p[k], 0) / v.length); };
/** THE NAPE: a fillet from the neck's middle ring (point for point: the two weld) flaring up past the head's base into
 * the skull, so the neck runs into the head as the nape does instead of piercing its underside at the skull's rim (a
 * thin neck under a library head's back rows showed that rim as a saw-toothed collar). Each ring is the neck's own top
 * ring scaled about the neck's axis (so its slots never twist): at `t` of the way from the neck's middle to its top,
 * then past it into the skull by `into` of the skull's half width at its back rows, `top` of that half width across (buried
 * inside it), its skin handing the neck to the head over its length. */
/** the neck's lean forward under a beast's head, degrees from the vertical: the library heads are drawn for the creature
 * biped's neck (27° forward, egocube/plan.js BIPED_TEMPLATE neckBase → neckTop), which runs into the back of the skull;
 * on a person's upright neck the skull sat forward of it and its back rim crossed the neck's back as a saw-toothed edge */
export const NECK_LEAN = 26;
export const NAPE = Object.freeze({ rings: Object.freeze([Object.freeze({ t: 0.45, flare: 1.08, w: 0.75 }), Object.freeze({ t: 1, flare: 1.3, w: 0.5 })]), into: 0.6, top: 0.62 });

export const BEAST_HEADS = Object.freeze(['person', ...Object.keys(HEAD_LIBRARY)]);
/** a designed head's words (a derivation of a library skull: creature-heads/derive.js) */
export const DESIGNED_HEAD_KEYS = Object.freeze(['from', 'name', 'moves', 'eye', 'regions', 'ornaments', 'palette']);
export const isDesigned = (w) => !!w && typeof w === 'object' && !Array.isArray(w) && typeof w.from === 'string';
/** Error strings for a designed head (empty = valid): its words, its skull, and the head it derives standing whole */
export function designedHeadErrors(w) {
  const errs = [];
  for (const k of Object.keys(w)) if (!DESIGNED_HEAD_KEYS.includes(k)) errs.push(`beast.head.${k}: not a word of a designed head (${DESIGNED_HEAD_KEYS.join(', ')})`);
  if (!HEAD_LIBRARY[w.from]) errs.push(`beast.head.from: the library skull it is drawn from (${Object.keys(HEAD_LIBRARY).join(', ')})`);
  if (w.moves !== undefined && !(Array.isArray(w.moves) && w.moves.every((m) => m && ['length', 'skull', 'muzzle', 'taper', 'drop'].includes(m.op)))) errs.push('beast.head.moves: row moves, each { op: length | skull | muzzle | taper | drop, … } (creature-heads/derive.js)');
  if (errs.length) return errs;
  try { const hp = deriveHead(headPlan(w.from), w); validateHead(hp); headFromPlan(hp); } catch (err) { errs.push(`beast.head: the head drawn from '${w.from}' does not stand: ${err.message}`); }
  return errs;
}

export function beastHeadOf(hero) {
  const card = beastCard(hero); if (!card) return null;
  const word = hero.beast.head;
  if (word === 'person') return null;
  const H = (() => {
    if (word && HEAD_LIBRARY[word]) return { id: word };
    // (a head DESIGNED from a library skull, the creature-from-sheet catalyst's way: its derivation, creature-heads/derive.js)
    if (isDesigned(word) && HEAD_LIBRARY[word.from]) return { id: word.from, derive: word };
    // (a hero that names a head of its own wears it; the door keeps the beast's own head word on the stored record)
    if (hero.head !== undefined && hero.head !== 'none') return null;
    // (a kin's own skull by default; a beast of its words alone keeps a person's head until it names one)
    const lib = card.kin !== undefined ? headFor(card.kin) : null;
    return lib ? { id: lib.id } : null;
  })();
  return H && card.ooze ? oozedHead(H, card.ooze) : H;
}

/** an ooze's head over the beast's (./ooze.js): its row moves after the head's own (a skull drawn in metres where it sits,
 * the dragon's, takes no height), its eye grown, its iris the ooze's colour; the head grown on the neck by its headScale */
function oozedHead(H, L) {
  const own = H.derive ?? {}, base = headPlan(H.id), inPlace = !base.units;
  const moves = (L.head.moves ?? []).map((m) => (inPlace && m.op === 'skull' ? (({ height: _h, ...x }) => x)(m) : m));
  const R0 = own.eye?.R ?? base.regions?.eye?.R;
  const derive = { ...own, ...(moves.length ? { moves: [...(own.moves ?? []), ...moves] } : {}),
    ...(L.head.eye && R0 ? { eye: { ...(own.eye ?? {}), R: Math.round(R0 * L.head.eye * 1e5) / 1e5 } } : {}),
    ...(L.eyes ? { palette: { ...(own.palette ?? {}), Iris: L.eyes.color } } : {}) };
  return { id: H.id, ...(Object.keys(derive).length ? { derive } : {}), ...(L.headScale ? { scale: L.headScale } : {}) };
}

/** the head's rest face: an ooze's controls added under the beast's own (the beast's word for a control stands) */
const oozedFace = (L, own = {}) => ({ ...(L?.expression ?? {}), ...own });

export function beastHead(plan, hero) {
  const H = beastHeadOf(hero); if (!H || !plan.rig) return plan;
  // (its colour the coat's: a kin whose coat is its own groups', the lamia's, its coat's first, not the skin of its torso)
  const card = beastCard(hero), skin = (card.coat ? plan.palette?.[card.coat[0]] : null) ?? plan.palette?.Skin ?? '#8a7a6a';
  // the neck leaned forward about its root, its length kept: the head base (a core joint, so the rig's rest) moves
  const J0 = plan.joints, nh = J0.neckHub, hb = J0.headBase, L = Math.hypot(...sub(hb, nh)), a = (NECK_LEAN * Math.PI) / 180;
  const headBase = [hb[0], r6(nh[1] + L * Math.sin(a)), r6(nh[2] + L * Math.cos(a))];
  plan = { ...plan, joints: { ...J0, headBase }, rig: { ...plan.rig, joints: { ...plan.rig.joints, headBase: { ...plan.rig.joints.headBase, at: headBase } } } };
  // (under a cover carried as material, beast/cover.js, the head's details by what reads at the hero's target, the drawn
  // creature's rule: a tuft too short to break the outline is the material's, not a card; its eyes as drawn)
  const hp0 = libraryHead(H.id, { skin, lineage: card.kin, k: scaleOf(plan) * (H.scale ?? 1), derive: H.derive ?? null });
  const hp = beastCoverOf(hero) ? headAtTier(hp0, pxPerMetre(readTarget(hero.target ?? DEFAULT_TARGET), planHeight(plan)) * (hp0.units?.scale ?? 1), { eyes: 1 }) : hp0;
  const segments = plan.segments.filter((s) => s.name !== 'head');
  const rigJoints = { ...plan.rig.joints, headTop: { at: 'head.cranium.tip' }, jawHinge: { at: 'head.jawOpen.pivot', rides: 'head' }, jawTip: { at: 'head.jaw.tip', rides: 'head' } };
  const bones = plan.rig.bones.some((b) => b.id === 'jaw') ? plan.rig.bones : [...plan.rig.bones, { id: 'jaw', head: 'jawHinge', tail: 'jawTip' }];
  const chains = { ...(plan.rig.chains ?? {}), jaw: { axis: 'x', sign: -1, links: [{ pivot: 'jawHinge', joints: ['jawTip'] }] } };
  const dials = Object.fromEntries([...Object.entries(plan.dials ?? {}).map(([id, d]) => [id, Array.isArray(d.parts) ? { ...d, parts: d.parts.filter((p) => p !== 'head') } : d]), ['head', { op: 'include', name: 'head' }]]);
  // the nape fillet over the neck's top half, into the skull (the skull's half width at its back rows, in metres)
  const neck = segments.find((s) => s.name === 'neck' && s.kind === 'segment');
  if (neck) {
    const R = partRings(plan, neck).stations, mid = R.find((st) => st.id === 'st1'), top = R.find((st) => st.id === 'st2');
    const rows = hp.parts?.cranium?.rows ?? [], S = hp.units?.scale ?? 1;
    const half = rows.slice(0, 2).reduce((m, [, , sl]) => Math.max(m, ...Object.values(sl).map((v) => (Array.isArray(v) ? Math.abs(v[0]) : 0))), 0) * S;
    if (mid && top && half > 0) {
      const cm = centre(mid.points), ct = centre(top.points), axis = unit(sub(ct, cm)), rt = Math.max(...Object.values(top.points).map((p) => Math.hypot(...sub(p, ct))));
      const ring = (c, f) => Object.fromEntries(Object.entries(top.points).map(([sl, p]) => [sl, p.map((x, k) => r6(c[k] + (x - ct[k]) * f))]));
      const between = NAPE.rings.map(({ t, flare }) => ring(cm.map((x, k) => x + (ct[k] - x) * t), flare));
      // (the crown `top` of the skull's half width across whatever the neck's girth: a heavy neck's flare would stand out
      // through the back of the skull, the ring narrowing inside it instead)
      const crown = ring(ct.map((x, k) => x + axis[k] * NAPE.into * half), (NAPE.top * half) / rt);
      const stations = [mid.points, ...between, crown].map((P, i) => ({ id: `st${i}`, points: Object.fromEntries(Object.entries(P).map(([sl, p]) => [sl, p.map(r6)])) }));
      const w = (neckShare) => (neckShare >= 1 ? { neck: 1 } : neckShare <= 0 ? { head: 1 } : { neck: neckShare, head: r6(1 - neckShare) });
      const shares = [1, ...NAPE.rings.map((x) => x.w), 0], cc = centre(crown);
      const names = Object.keys(top.points), fam = Object.entries(SLOT_FAMILIES).find(([, f]) => f.length === names.length && f.every((x, i) => x === names[i]))?.[0] ?? names;
      segments.push({ name: 'nape', kind: 'rings', slots: fam, group: neck.group, stations,
        caps: { back: cm.map((x, k) => r6(x - axis[k] * 0.01)), tip: cc.map((x, k) => r6(x + axis[k] * 0.01)) },
        bind: { bone: 'head', blend: { back: w(1), ...Object.fromEntries(shares.map((x, i) => [`st${i}`, w(x)])), tip: w(0) } } });
    }
  }
  const lean = dials.lean?.parts; if (Array.isArray(lean) && segments.some((s) => s.name === 'nape') && lean.includes('neck')) dials.lean = { ...dials.lean, parts: [...lean, 'nape'] };
  return { ...plan, segments, heads: [{ name: 'head', plan: hp, expression: oozedFace(card.ooze, hero.beast.expression), on: 'headBase', bind: { cranium: 'head', jaw: 'jaw' } }], dials,
    rig: { ...plan.rig, joints: rigJoints, bones, chains } };
}
