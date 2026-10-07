/**
 * The scad ladder's `next`: the steps a stored OpenSCAD part can take from here, computed from what its recipe
 * already has, in climbing order. Each names the scad card's section that teaches it, so a part that never climbs
 * never reads past the card's first step. Returned by mint_solid (kind scad) and by update_sketch on a scad row;
 * never stored. A step is named, never its result: whether a mechanism closes or a part holds is the reading's.
 *
 * Kept free of the tool modules so both doors can import it without a cycle (the fabricator's inventory is data).
 */
import { MATERIALS } from '@/lib/graph/strength/materials';
import { INVENTORY } from '@/lib/graph/fabricator/inventory';

const step = (o, section) => ({ ...o, ...(section ? { card: 'scad', section } : {}) });

// The cutters that take a standard part (a bearing seat, a heat-set pilot, a nut trap, a NEMA face …), read off the
// fabricator's inventory so there is one list. The bare `mj_hole` is every hole, so it says nothing about a part.
const PART_CUTTERS = [...new Set(Object.values(INVENTORY).map((r) => r.fit).filter((f) => f && f !== 'mj_hole'))];
const PART_CUTTER = new RegExp(`\\b(${PART_CUTTERS.join('|')})\\s*\\(`);

export function scadNext(manifest) {
  if (!manifest || typeof manifest !== 'object' || manifest.kind !== 'scad') return undefined;
  const m = manifest;
  const next = [];
  // A part cut for standard parts with no plan beside it: fabricate_solid names them, the bill and the notices.
  if (!m.fabricate && typeof m.source === 'string' && PART_CUTTER.test(m.source)) next.push({ add: 'fabricate', tool: 'fabricate_solid', card: 'fabricate' });
  const parts = m.parts && typeof m.parts === 'object' ? Object.keys(m.parts).length : 0;
  const mech = m.mechanism && typeof m.mechanism === 'object' ? m.mechanism : null;
  if (!mech) {
    if (parts >= 2) next.push(step({ add: 'mechanism' }, 'mechanism'));
  } else {
    const bodies = mech.bodies && typeof mech.bodies === 'object' ? Object.values(mech.bodies) : [];
    if (!mech.material && !bodies.some((b) => b && b.material)) next.push(step({ add: 'mechanism.material' }, 'dynamics'));
    next.push(step({ measure: 'motion' }, 'mechanism'));
  }
  const s = m.strength && typeof m.strength === 'object' ? m.strength : null;
  if (!s) {
    next.push(step({ add: 'strength' }, 'strength'));
  } else {
    next.push(step({ measure: 'strength' }, 'strength'));
    const printed = typeof s.material === 'string' && MATERIALS[s.material]?.family === 'fdm';
    if (printed && !s.print) next.push(step({ add: 'strength.print' }, 'strength'));
    else if (printed && !s.coupon) next.push(step({ add: 'strength.coupon' }, 'strength'));
  }
  if (typeof m.source === 'string' && /\bmj_sheet\s*\(/.test(m.source)) next.push(step({ export: 'dxf' }, 'outputs'));
  next.push({ export: '3mf' });
  return next;
}
