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
import { HEAD_LIBRARY, headFor } from '../creature-heads/index.js';
import { libraryHead } from '../egocube/plan.js';
import { partRings } from '../polygonizer/tiered-form.js';
import { SLOT_FAMILIES } from '../polygonizer/station-loft-plan.js';

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

export function beastHeadOf(hero) {
  const card = beastCard(hero); if (!card) return null;
  const word = hero.beast.head;
  if (word === 'person') return null;
  if (word && HEAD_LIBRARY[word]) return { id: word };
  // (a hero that names a head of its own wears it; the door keeps the beast's own head word on the stored record)
  if (hero.head !== undefined && hero.head !== 'none') return null;
  const lib = headFor(card.kin);
  return lib ? { id: lib.id } : null;
}

export function beastHead(plan, hero) {
  const H = beastHeadOf(hero); if (!H || !plan.rig) return plan;
  const card = beastCard(hero), skin = plan.palette?.Skin ?? '#8a7a6a';
  // the neck leaned forward about its root, its length kept: the head base (a core joint, so the rig's rest) moves
  const J0 = plan.joints, nh = J0.neckHub, hb = J0.headBase, L = Math.hypot(...sub(hb, nh)), a = (NECK_LEAN * Math.PI) / 180;
  const headBase = [hb[0], r6(nh[1] + L * Math.sin(a)), r6(nh[2] + L * Math.cos(a))];
  plan = { ...plan, joints: { ...J0, headBase }, rig: { ...plan.rig, joints: { ...plan.rig.joints, headBase: { ...plan.rig.joints.headBase, at: headBase } } } };
  const hp = libraryHead(H.id, { skin, lineage: card.kin, k: scaleOf(plan) });
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
      const crown = ring(ct.map((x, k) => x + axis[k] * NAPE.into * half), Math.max(NAPE.rings.at(-1).flare, (NAPE.top * half) / rt));
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
  return { ...plan, segments, heads: [{ name: 'head', plan: hp, expression: {}, on: 'headBase', bind: { cranium: 'head', jaw: 'jaw' } }], dials,
    rig: { ...plan.rig, joints: rigJoints, bones, chains } };
}
