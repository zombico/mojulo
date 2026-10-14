/**
 * A TRACK DRESSED BY ITS TRACKSCAPE — the slots (trackscape.js) filled with set pieces (set-pieces.js) in the track's
 * kit (track-kit.js), placed where a car meets them:
 *
 *   each slot      its set's piece, sized to read where the slot needs it, turned to face the road (a span across it),
 *                  stood on the land (a hand's breadth into it, never floating on a slope)
 *   off the road   a footprint that reaches the road is pushed back along the road's normal until it clears (a span's
 *                  legs stand past the barrier line)
 *   colliders      what a car can reach (anything standing within a few metres of the barrier line, a span's legs) is
 *                  a box the drive rule meets, as the barriers are
 *   the eye        the dressed track measured again by the lap's own eye (eye.js) with the pieces as they stand: the
 *                  laws held on what was built, not on the slots' phantoms
 *
 *   the arena      the venue planned (arena-plan.js) before anything is built: a slot inside one of its zones is the
 *                  zone's to fill (absorbed: its local area builds it), and the eye meets the zones as what will stand
 *   the surrounds  the land beyond the venue shaped (surrounds.js: its relief, formations where the driver looks, a
 *                  settlement where the lap sees most, woods), before the pieces and the zones stand on it
 *
 *   planScapedTrack(m)  → planTrack(m) with `scape: { slots, pieces, census, laws, set, arena, absorbed }`, the pieces' faces and their
 *                         colliders added. `m.scape`: true, or { set?, seed?, landmark? (a block's id), arena? (false: none), surrounds? (false: the flat field;
 *                         or { land?: hills | mountains | mesas | flat, settlement?: village | farms | town | none, seed? }), local? (false:
 *                         the zones unbuilt; or { <zone>: { seed?, skip?, upTo? } }), upTo? (every area's last pass) }; the kit is
 *                         `m.kit` (the meadow if none)
 *   scapeThings(pieces) → things for the eye (each piece at its centre, its least extent, its interest)
 *
 * Absent `m.scape`, planScapedTrack is planTrack. Pure, deterministic.
 */
import { planTrack } from './track.js';
import { planTrackscape, trackscapeLaws } from './trackscape.js';
import { driverEye } from './eye.js';
import { pieceFor, buildPiece, paintPiece, SET_OF_CLASS, SETS, TRACK_BLOCKS } from './set-pieces.js';
import { buildBlock } from '../era/blocks.js';
import { planArena, zoneOf, ARENA } from './arena-plan.js';
import { buildLocalAreas } from './local-area.js';
import { trackKit } from './track-kit.js';
import { planSurrounds } from './surrounds.js';

// a course's land when no word names one: mountains under a sharp course, hills otherwise
const landOf = (m) => ((m.course?.elevation?.amplitude ?? 0) >= 20 ? 'mountains' : 'hills');

const r3 = (v) => Math.round(v * 1000) / 1000;
const REACH = 4;   // m past the barrier line a car can still reach (a spin, a slide off)
const INTEREST = { rhythm: 'filler', braking: 'prop', pocket: 'prop', reveal: 'prop', focus: 'focus', span: 'focus', gantry: 'focus', landmark: 'focus' };

export function planScapedTrack(m = {}) {
  let plan = planTrack(m);
  if (!m.scape) return plan;
  const opts = m.scape === true ? {} : m.scape;
  const set = opts.set ?? SET_OF_CLASS[plan.course.class] ?? 'gt', seed = Number.isInteger(opts.seed) ? opts.seed : Number.isInteger(m.seed) ? m.seed : 1;
  const K = trackKit(m.kit ?? 'isekai-meadow'), X = plan.X, a = plan.alignment, L = a.length;
  // the landmark the set can build at its largest (its rails' tops): the planner searches only where that reads
  const lmId = opts.landmark ?? SETS[set].landmark, LB = TRACK_BLOCKS[lmId];
  const top = buildBlock(LB, { params: Object.fromEntries(Object.entries(LB.params).filter(([, r]) => typeof r[0] === 'number').map(([k, r]) => [k, r[1]])), library: TRACK_BLOCKS }).box.size;
  const scape = planTrackscape(plan, { seed, landmarkMax: Math.min(Math.max(top[0], top[1]), top[2]) });
  const C = Array.from({ length: Math.max(16, Math.round(L)) + 1 }, (_, i) => a.at(Math.min(L, (i * L) / Math.max(16, Math.round(L)))));
  const nearest = (x, y) => { let b = C[0], d = Infinity; for (const c of C) { const e = (c.x - x) ** 2 + (c.y - y) ** 2; if (e < d) { d = e; b = c; } } return b; };
  const offOf = (x, y) => { const c = nearest(x, y); return { c, off: -(x - c.x) * Math.sin(c.heading) + (y - c.y) * Math.cos(c.heading) }; };
  // the arena plan (arena-plan.js): the venue's zones; a slot inside one is the zone's to fill (its local area)
  const arena = opts.arena === false ? null : planArena(plan, { scape, seed });
  // the surrounds (surrounds.js): the land beyond the venue shaped and stood on, before anything here stands on it
  const SO = opts.surrounds === false ? null : opts.surrounds === true || opts.surrounds === undefined ? {} : opts.surrounds;
  const sur = SO ? planSurrounds(plan, { arena, scape, K, seed: Number.isInteger(SO.seed) ? SO.seed : seed, land: SO.land ?? landOf(m), settlement: SO.settlement ?? 'village' }) : null;
  if (sur) plan = sur.plan;
  const absorbed = [];
  const nth = {}, pieces = [], faces = [...(sur ? sur.faces : [])], colliders = [];
  for (const slot of scape.slots) {
    const z = arena && slot.beat !== 'span' && slot.beat !== 'gantry' && !slot.landmark ? zoneOf(arena, slot.at) : null;
    if (z) { absorbed.push({ beat: slot.beat, zone: z.id }); continue; }
    const { c } = offOf(slot.at[0], slot.at[1]), across = slot.beat === 'span' || slot.beat === 'gantry';
    const k = (nth[slot.beat] = (nth[slot.beat] ?? -1) + 1);
    let p = pieceFor(slot.landmark && opts.landmark ? { ...slot, beat: 'landmark' } : slot, set, { nth: k, toward: [c.x, c.y], heading: across ? slot.heading ?? c.heading : c.heading, ...(slot.landmark && opts.landmark ? { block: opts.landmark } : {}) });
    if (!p) continue;
    let built = buildPiece(p, { seed: seed + k });
    // off the road: the footprint's nearest corner to the line past the barrier (a span's ends, past it both sides)
    if (!across) {
      for (let tries = 0; tries < 12; tries++) {
        const { lo, hi } = built.box, corners = [[lo[0], lo[1]], [hi[0], lo[1]], [hi[0], hi[1]], [lo[0], hi[1]]];
        const near = Math.min(...corners.map(([x, y]) => Math.abs(offOf(x, y).off)));
        if (near >= X.outer + 0.5) break;
        const { off } = offOf(slot.at[0], slot.at[1]), sgn = off >= 0 ? 1 : -1, push = X.outer + 0.5 - near + 0.5;
        const at = [p.at[0] - Math.sin(c.heading) * sgn * push, p.at[1] + Math.cos(c.heading) * sgn * push, p.at[2]];
        p = { ...p, at: [r3(at[0]), r3(at[1]), r3(plan.groundAt(at[0], at[1]))] };
        built = buildPiece(p, { seed: seed + k });
      }
    }
    // stood on the land: its foot a hand's breadth into the lowest ground under its footprint
    const { lo, hi } = built.box, under = Math.min(...[[lo[0], lo[1]], [hi[0], lo[1]], [hi[0], hi[1]], [lo[0], hi[1]], [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2]].map(([x, y]) => plan.groundAt(x, y)));
    const dz = under - 0.15 - p.at[2];
    const placed = built.faces.map((f) => ({ ...f, corners: f.corners.map((q) => [q[0], q[1], r3(q[2] + dz)]) }));
    faces.push(...paintPiece(placed, K));
    const box = { lo: [lo[0], lo[1], lo[2] + dz], hi: [hi[0], hi[1], hi[2] + dz] };
    pieces.push({ ...p, beat: slot.beat, box: { lo: box.lo.map(r3), hi: box.hi.map(r3) }, interest: INTEREST[slot.beat] ?? 'prop', ...(slot.landmark ? { landmark: true } : {}), ...(slot.corner !== undefined ? { corner: slot.corner } : {}) });
    // colliders: a span's legs (its two ends), else the whole footprint where a car can reach it
    if (across) {
      const half = (p.params.span ?? 10) / 2, nx = -Math.sin(c.heading), ny = Math.cos(c.heading);
      for (const s of [-1, 1]) { const x = slot.at[0] + nx * s * (half + 0.4), y = slot.at[1] + ny * s * (half + 0.4); colliders.push({ min: [r3(x - 0.8), r3(y - 0.8), r3(box.lo[2])], max: [r3(x + 0.8), r3(y + 0.8), r3(box.hi[2])], of: `trackscape:${slot.beat}` }); }
    } else {
      const reach = Math.min(...[[lo[0], lo[1]], [hi[0], lo[1]], [hi[0], hi[1]], [lo[0], hi[1]]].map(([x, y]) => Math.abs(offOf(x, y).off)));
      if (reach < X.outer + REACH) colliders.push({ min: box.lo.map(r3), max: box.hi.map(r3), of: `trackscape:${slot.beat}` });
    }
  }
  // the local areas (local-area.js): each zone built on its own, in passes (ground, massing, elements, dressing)
  const local = arena && opts.local !== false ? buildLocalAreas(plan, arena, { K, seed, local: opts.local ?? {}, upTo: opts.upTo ?? 'dressing' }) : null;
  if (local) { faces.push(...local.faces); colliders.push(...local.colliders); }
  // the eye again, on what was built (a zone not yet built to its elements counts as what will stand there)
  const built = local ? local.things : [];
  const census = driverEye(plan, [...scapeThings(pieces), ...built, ...(arena && !built.length ? zoneThings(arena, plan) : []), ...(sur ? sur.things : [])], { cls: scape.cls, ground: plan.groundAt });
  const laws = trackscapeLaws(plan, { ...scape, slots: scape.slots }, census);
  return {
    ...plan,
    faces: [...plan.faces, ...faces],
    colliders: [...plan.colliders, ...colliders],
    scape: { set, kit: K.id, slots: scape.slots, keepClear: scape.keepClear, corners: scape.corners, pieces, ...(arena ? { arena, absorbed } : {}), ...(local ? { local: local.areas } : {}), ...(sur ? { surrounds: sur.report } : {}), census: { blank: census.blank, seconds: census.seconds.length, corners: census.corners, landmarkSeen: census.landmarkSeen, rhythm: census.rhythm }, laws },
  };
}

/** Pieces as things for the eye: each at its box's centre, its least extent (the larger of its width and depth, or its
 *  height, whichever is less) its span. */
export function scapeThings(pieces) {
  return pieces.map((p) => {
    const sz = p.box.hi.map((v, i) => v - p.box.lo[i]), c = p.box.hi.map((v, i) => (v + p.box.lo[i]) / 2);
    return { kind: p.beat, interest: p.interest, at: c, span: Math.min(Math.max(sz[0], sz[1]), sz[2]), top: p.box.hi[2], ...(p.landmark ? { landmark: true } : {}) };
  });
}

/** The arena's zones as the eye will meet what stands in them: a stand (a focus, its top row's height), the pit
 *  building (a prop, two storeys), at their footprints. */
export function zoneThings(arena, plan) {
  const A = ARENA[plan.course.class] ?? ARENA.circuit, out = [];
  for (const z of arena.zones) {
    const h = z.use === 'grandstand' ? A.eye + 3 : z.use === 'pit building' ? (plan.course.class === 'kart' ? 4 : 9) : 0;
    if (!h) continue;
    const xs = z.poly.map((p) => p[0]), ys = z.poly.map((p) => p[1]), c = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
    const g = plan.groundAt(c[0], c[1]);
    out.push({ kind: z.use, interest: z.use === 'grandstand' ? 'focus' : 'prop', at: [c[0], c[1], g + h / 2], span: Math.min(h, Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys))), top: g + h });
  }
  return out;
}
