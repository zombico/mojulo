// The solid rail: a part that climbs the solid ladder (scad, and a workbench past a look). Its outcomes are the four
// sizes of an ask (look, fit, function, engineered); its concerns are the fields the ladder's `next` names, each open at
// the rung that wants it (lib/mcp/tools/solid-next.js). A measure is a step to run and an export a step to take, so
// neither is a state. It is looked at in its World.
import { registerRail, sketchHref } from './rail.js';
import { ASKS, solidNext } from '../../mcp/tools/solid-next.js';

const NAMES = { look: 'Look', fit: 'Fit', function: 'Function', engineered: 'Engineered' };
// the rung a field serves (solid-next.js's rungOf, for the fields alone)
const rungOf = (add) => (['mechanism.material', 'strength.print', 'strength.coupon'].includes(add) ? 'engineered' : 'function');

export default registerRail({
  id: 'solid',
  test: (m) => (m.kind === 'scad' || m.kind === 'workbench') && solidNext(m) !== undefined,
  outcomes: ASKS.map((id) => ({ id, name: NAMES[id] })),
  read(m, { ref }) {
    const ask = ASKS.includes(m.ask) ? m.ask : null;
    const adds = [...new Set((solidNext(m) ?? []).map((s) => s.add).filter(Boolean))];
    return {
      // an ask caps the ladder at its rung, so the rungs above it are not this part's to reach
      ...(ask ? { outcomes: ASKS.slice(0, ASKS.indexOf(ask) + 1).map((id) => ({ id, name: NAMES[id] })) } : {}),
      concerns: adds.map((add) => ({ id: add, outcome: rungOf(add), state: 'open' })),
      exits: ref ? [{ id: 'walk', href: sketchHref(ref, 'world') }] : [],
    };
  },
});
