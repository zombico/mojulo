/**
 * The scad ladder's `next`: the steps a stored OpenSCAD part can take from here, computed from what its recipe
 * already has, in climbing order. Each names the scad card's section that teaches it, so a part that never climbs
 * never reads past the card's first step. Returned by mint_solid (kind scad) and by update_sketch on a scad row;
 * never stored. A step is named, never its result: whether a mechanism closes or a part holds is the reading's.
 *
 * Kept free of the tool modules so both doors can import it without a cycle.
 */
import { MATERIALS } from '@/lib/graph/strength/materials';

const step = (o, section) => ({ ...o, ...(section ? { card: 'scad', section } : {}) });

export function scadNext(manifest) {
  if (!manifest || typeof manifest !== 'object' || manifest.kind !== 'scad') return undefined;
  const m = manifest;
  const next = [];
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
