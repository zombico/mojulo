// The metro refacade: richer builders for the seeded landmarks and sacred / civic buildings,
// drawn only when the box carries `metro: true` (the metro profile stamps it). Every other box
// takes its stock builder, so a stored city renders the same bytes.
//
// A refacade builder keeps the stock builder's CONTRACT: it draws inside the box's footprint
// (b.x, b.y, b.w, b.d) from b.z0, no higher than the stock silhouette (LANDMARK_HEIGHTS × the
// short side for a landmark, the seeded b.z1 for a sacred / civic box), with no rng — so the
// plaza reservation, the road glyph and the camera framing built off the box stay honest.
// A shape with no entry here falls back to its stock builder.
import { TOWERS } from './refacade-towers.js';
import { VENUES } from './refacade-venues.js';
import { MONUMENTS } from './refacade-monuments.js';
import { SACRED } from './refacade-sacred.js';
import { SHRINES } from './refacade-shrines.js';
import * as dmath from '../../util/dmath.js';
import { withMath } from '../../util/math-scope.js';

const REFACADE = { ...TOWERS, ...VENUES, ...MONUMENTS, ...SACRED, ...SHRINES };
const ALIASES = {
  skydome: 'rogers-centre', eiffel: 'eiffel-tower', tokyo: 'tokyo-tower', 'empire-state': 'empire-state-building',
  empire: 'empire-state-building', gateway: 'gateway-arch', 'chicago-bean': 'cloud-gate', bean: 'cloud-gate',
  liberty: 'statue-of-liberty', rizal: 'rizal-monument',
};

export const refacadeKey = (shape) => ALIASES[shape] || shape;
export const hasRefacade = (shape) => Object.hasOwn(REFACADE, refacadeKey(shape));

/** The metro builder's faces for `b`, or null when `b` is not metro or its shape has none. */
/** refacadeBuilding on dmath: the shared helpers it reaches answer the same everywhere (util/math-scope.js). */
export function refacadeBuilding(b, ctx) { return withMath(dmath, () => refacadeBuildingIn(b, ctx)); }
function refacadeBuildingIn(b, ctx) {
  if (!b || !b.metro) return null;
  const build = REFACADE[refacadeKey(b.shape)];
  return build ? build(b, ctx) : null;
}
