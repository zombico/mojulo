/**
 * The solid ladder's `next`, for every solid kind that has one: the steps a stored part can take from here, computed
 * from what its recipe already has, in climbing order. Never stored.
 *
 * A recipe may carry `ask`, the size of the ask the agent judged it to be: `look` (an object that reads right),
 * `fit` (it fits a thing: true size and print checks), `function` (standard parts, a load, a bill of materials) or
 * `engineered` (motion, materials, coupons). The agent judges it; the server never infers it. `ask` caps `next` at its
 * rung, so a trinket is not walked toward a tensile coupon, and opens the print check a fit asks for. Without `ask`,
 * `next` is what each kind returned before `ask` existed, byte for byte: the scad ladder as it was, and on the
 * workbench nothing until the recipe has climbed past a look (a frame, a fabricate plan, a strength spec, mm units
 * off a `build`).
 *
 * Kept free of the tool modules so the mint doors and update_sketch can import it without a cycle.
 */
import { MATERIALS } from '@/lib/graph/strength/materials';
import { scadNext } from '@/lib/mcp/tools/scad-next';

export const ASKS = Object.freeze(['look', 'fit', 'function', 'engineered']);
const RUNG = Object.freeze(Object.fromEntries(ASKS.map((a, i) => [a, i])));

/** `ask` checked: undefined stays undefined (absent contributes zero bytes); anything off the list is refused. */
export function checkedAsk(ask) {
  if (ask === undefined || ask === null) return undefined;
  if (!ASKS.includes(ask)) throw new Error(`ask is one of ${ASKS.join(' | ')}: the size of the ask (a look, a fit, a function, an engineered part), not '${ask}'`);
  return ask;
}

/** The rung a step serves: the lowest ask that wants it. */
function rungOf(s) {
  if (s.export === '3mf') return RUNG.look;
  if (s.measure === 'printer') return RUNG.fit;
  if (s.add === 'mechanism.material' || s.add === 'strength.print' || s.add === 'strength.coupon') return RUNG.engineered;
  return RUNG.function;   // fabricate, mechanism, motion, strength, a dxf, a bill of materials
}

const printedMaterial = (s) => typeof s?.material === 'string' && MATERIALS[s.material]?.family === 'fdm';
const has = (v) => v !== undefined && v !== null && v !== false && !(Array.isArray(v) && v.length === 0);

// The strength rail, the same on every kind: the rigidity sensor is taught on the scad card's `strength` section.
function strengthSteps(m) {
  const at = { card: 'scad', section: 'strength' };
  const s = m.strength && typeof m.strength === 'object' ? m.strength : null;
  if (!s) return [{ add: 'strength', ...at }];
  const out = [{ measure: 'strength', ...at }];
  if (printedMaterial(s) && !s.print) out.push({ add: 'strength.print', ...at });
  else if (printedMaterial(s) && !s.coupon) out.push({ add: 'strength.coupon', ...at });
  return out;
}

function workbenchNext(m) {
  const next = [{ measure: 'printer' }];
  if (has(m.frames)) {
    if (!has(m.fabricate)) next.push({ add: 'fabricate', tool: 'fabricate_solid', card: 'fabricate' });
    next.push({ export: 'bom', card: 'workbench', section: 'frames' });
  }
  next.push(...strengthSteps(m), { export: '3mf' });
  return next;
}

// Past a look: the recipe already says it is meant to be made, not only seen.
// (mm units alone count only off a `build`: an equipment or furniture asset is a look in any unit.)
const workbenchClimbed = (m) => has(m.frames) || has(m.fabricate) || has(m.strength) || (m.units === 'mm' && !has(m.build));

export function solidNext(manifest) {
  if (!manifest || typeof manifest !== 'object') return undefined;
  const ask = ASKS.includes(manifest.ask) ? manifest.ask : undefined;
  let next;
  if (manifest.kind === 'scad') {
    next = scadNext(manifest);
    if (ask && next) next = [{ measure: 'printer' }, ...next];
  } else if (manifest.kind === 'workbench') {
    if (!ask && !workbenchClimbed(manifest)) return undefined;
    next = workbenchNext(manifest);
  } else {
    return undefined;
  }
  return ask ? next.filter((s) => rungOf(s) <= RUNG[ask]) : next;
}
