// Cards in mall bays. Two plan transforms the mall calls (this module never imports the mall):
//
//   cardPlan(plan, cardFor)  — BEFORE structurize: each carded unit (a tenant bay, the food court,
//     an anchor) is replaced by its card's sub-program (sales floor + cells), so the bay's fitting
//     rooms and stock room are real rooms with walls and doors in the mall's own wall graph. A
//     unit's storefront is the SPAN of the plan's own storefront door on its concourse edge; a
//     street entry on its back wall (an anchor) is kept clear as open band floor.
//   cardBayFaces(bays, o)    — AFTER structurize: the door-gapped storefront (the mall's full-width
//     pane cannot be walked through) and the card's fit-out, degraded to the bay and stamped.
//
// Carded rooms are tagged `fromCard` so the mall's own dresser leaves their frontage alone.

import { mulberry32 } from '../polygonizer/floorplan-glyphs.js';
import { unitFrame } from './store-frame.js';
import { subProgram } from './store-cells.js';
import { fitOutFromConcept, storefrontLocal, STORE_DEFAULTS } from './store-concept.js';
import * as dmath from '../../util/dmath.js';
import { withMath } from '../../util/math-scope.js';

/**
 * cardFor(room, index) → a card or null (null leaves the unit as the plan drew it).
 * @returns {{ plan, bays }} plan: the input plan with carded units replaced; bays: one per carded unit.
 */
export function cardPlan(plan, cardFor = () => null, { seed = 1 } = {}) {
  const conc = plan.rooms.find((r) => r.role === 'concourse');
  if (!conc) return { plan, bays: [] };
  const cx0 = conc.x, cx1 = conc.x + conc.w, by0 = conc.y, by1 = conc.y + conc.h;
  // a unit's front is the side it shares with the concourse: a tenant bay's long side or an anchor's end
  const frontOf = (r) => (Math.abs(r.x + r.w - cx0) < 0.5 ? 'E' : Math.abs(r.x - cx1) < 0.5 ? 'W'
    : Math.abs(r.y + r.h - by0) < 0.5 ? 'N' : Math.abs(r.y - by1) < 0.5 ? 'S' : null);
  // the plan's doors in a unit's local frame: the storefront on its front line, street entries on its back
  const doorsOf = (U) => plan.doors.map((d) => { const [l, dep] = U.toLocal(d.x, d.y); return { d, l, dep }; })
    .filter((q) => q.l > 0 && q.l < U.W);
  const rooms = [], bays = [];
  plan.rooms.forEach((r, i) => {
    const front = r.role === 'concourse' || r.role === 'restroom' ? null : frontOf(r);
    const card = front ? cardFor(r, i) : null;
    if (!card) { rooms.push(r); return; }
    const unitRect = { x0: r.x, x1: r.x + r.w, y0: r.y, y1: r.y + r.h };
    const U = unitFrame(unitRect, front);
    const ds = doorsOf(U);
    const sf = ds.find((q) => Math.abs(q.dep) < 0.5 && !q.d.leadsTo);
    const span = sf ? [sf.l - sf.d.width / 2, sf.l + sf.d.width / 2] : [U.W * 0.09, U.W * 0.91];
    const keepClear = ds.filter((q) => Math.abs(q.dep - U.D) < 0.5 && q.d.leadsTo)
      .map((q) => [q.l - (q.d.width ?? 6) / 2 - 1.5, q.l + (q.d.width ?? 6) / 2 + 1.5]);
    const sub = subProgram(unitRect, front, card, { rng: mulberry32((seed * 131 + i) >>> 0), keepClear });
    for (const q of sub.rooms) rooms.push({ ...q, fromCard: card.id, storeType: r.storeType });
    bays.push({ room: r, index: i, card, front, unitRect, sub, span, keepClear });
  });
  return { plan: { ...plan, rooms, doors: [...plan.doors, ...bays.flatMap((b) => b.sub.doors)] }, bays };
}

/** Storefronts + fit-outs for the bays of cardPlan. Sets `bay.store` (the assessor's input). */
/** cardBayFaces on dmath: a mall bay's store is built as a standalone store is (util/math-scope.js). */
export function cardBayFaces(bays, o, opts) { return withMath(dmath, () => cardBayFacesIn(bays, o, opts)); }
function cardBayFacesIn(bays, o, { seed = 1, castBuilder = null, degrade = true, baseZ = 0 } = {}) {
  const faces = [];
  const ceil = o.wallHeight;
  for (const b of bays) {
    const U = b.sub.unit;
    const [s0, s1] = b.span;
    const ew = b.card.entry?.width ?? STORE_DEFAULTS.entryWidth;
    const ec = Math.min(s1 - ew / 2 - 0.2, Math.max(s0 + ew / 2 + 0.2, (b.card.entry?.at ?? 0.5) * U.W));
    for (const q of storefrontLocal({ W: U.W, s0, s1, e0: ec - ew / 2, e1: ec + ew / 2, top: o.doorHeight, ceil, sign: b.card.finishes?.sign || '#574f6a', trim: b.card.finishes?.trim, light: U.localLight })) {
      const w = U.xf(q);
      faces.push(baseZ ? { ...w, corners: w.corners.map((c) => [c[0], c[1], c[2] + baseZ]) } : w);
    }
    const sw = b.sub.salesWorld, inset = STORE_DEFAULTS.inset;
    const salesFrame = unitFrame({ x0: sw.x0 + inset, x1: sw.x1 - inset, y0: sw.y0 + inset, y1: sw.y1 - inset }, b.front);
    const gw = U.toWorld(ec, 0);
    const entry = { world: gw, local: [salesFrame.toLocal(gw[0], gw[1])[0], 0], width: ew };
    // street entries on the back wall (anchors): the unit is also a passage to the concourse
    const through = b.keepClear.map(([a, c]) => { const w = U.toWorld((a + c) / 2, U.D); return salesFrame.toLocal(w[0], w[1])[0]; });
    const fitOut = fitOutFromConcept(b.card, salesFrame, { cells: b.sub.cells, backDoors: b.sub.doors, front: b.front, seed: seed + b.index, baseZ, ceilingZ: baseZ + ceil, castBuilder, entry, through, degrade });
    for (const q of fitOut.faces) faces.push(q);
    b.store = { salesFrame, sub: b.sub, fitOut, entry, through };
  }
  return faces;
}
