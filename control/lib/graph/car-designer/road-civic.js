/**
 * THE CITY'S UTILITY VEHICLES in the form render: civil support trucks at their classes' true numbers (roads/vehicles.js),
 * built from the hull kit (mil-hull.js) as the field's and the airside's are, and drawn, worn and painted by the same
 * compiler (military.js compileMilitary, road-military.js militaryBody), so every door that draws a field vehicle draws
 * these: the preview, a level's parked vehicles, the GLB. They are classes, not replicas.
 *
 *   the works      (road-civic-works.js) the refuse truck, the plough truck and gritter, the street sweeper
 *   the emergency  (road-civic-emergency.js) the pumper fire engine, the box ambulance, the paramedic van
 *   the lifts      (road-civic-lifts.js) the aerial ladder truck, the utility bucket truck
 *
 * Each that deploys says how far (`reach`, metres: civic-kit.js CIVIC_REACH): a refuse truck's tailgate tipped, a
 * plough's blade on the road, a sweeper's brooms down, a ladder's tip or a bucket's floor raised; its words deploy it (CIVIC_WORDS), a number sets it (`pose.reach`,
 * clamped to its range). The census measures each stowed.
 *
 * Its paint is the livery's (livery-cut.js): plain, its kind's own (CIVIC_LIVERY: a municipal white, a plough's orange)
 * with its fleet number on its mark anchors; a named livery or a camo on a base. What is not paint is its own: the bands
 * and chevrons, the lenses, chrome, aluminium, rubber. Its tyres are a road's, smooth; it is kept clean unless a wear is
 * asked.
 *
 *   CIVIC_CLASSES                     physics class → its body kind
 *   civicAxles(cls)                   → the axles' stations (+y forward, the body centred)
 *   CIVIC_BODIES, CIVIC_KITS          the builders and each kind's kit ([anchor, card, words?], mil-fittings.js)
 *   CIVIC_REACH, CIVIC_WORDS, CIVIC_LIVERY, civicWords, reachOf   (civic-kit.js)
 *
 * Vehicle space (+y forward, x across, +x the right side, z up), metres, the wheels' contact at z = 0. Pure and
 * deterministic.
 */
import { WORKS_BODIES, WORKS_KITS, worksAxles } from './road-civic-works.js';
import { EMERGENCY_BODIES, EMERGENCY_KITS, emergencyAxles } from './road-civic-emergency.js';
import { LIFT_BODIES, LIFT_KITS, liftAxles } from './road-civic-lifts.js';

export const CIVIC_CLASSES = Object.freeze({ refuseTruck: 'refuse', snowPlow: 'plough', streetSweeper: 'sweeper', fireEngine: 'fireEngine', ambulance: 'ambulance', paramedicVan: 'paramedic', ladderTruck: 'ladder', bucketTruck: 'bucket' });
export { CIVIC_REACH, CIVIC_WORDS, CIVIC_LIVERY, civicWords, reachOf } from './civic-kit.js';

/** Where each axle stands (+y forward), the front first. */
export function civicAxles(cls) {
  const kind = CIVIC_CLASSES[cls];
  if (WORKS_BODIES[kind]) return worksAxles(cls, kind);
  if (EMERGENCY_BODIES[kind]) return emergencyAxles(cls, kind);
  if (LIFT_BODIES[kind]) return liftAxles(cls, kind);
  throw new Error(`car-designer: '${cls}' is not a civic class (${Object.keys(CIVIC_CLASSES).join(', ')})`);
}

export const CIVIC_BODIES = Object.freeze({ ...WORKS_BODIES, ...EMERGENCY_BODIES, ...LIFT_BODIES });
export const CIVIC_KITS = Object.freeze({ ...WORKS_KITS, ...EMERGENCY_KITS, ...LIFT_KITS });
