/**
 * WOLF SQUADRON — the arcade flight rail's starter: stages flown down a path (skyscape/rail-stage.js, the rail rule),
 * flight as a concept and not a simulation. The stage sets the speed and the way; the player steers about it, boosts,
 * brakes and rolls, and shoots what the stage wakes. The ground is a floor, never a crash: what hurts is what stands in
 * the way (pillars, rocks) and what shoots back, each taking its share of the shield. Each stage ends on a boss.
 *
 *   stage-1  Canyon run    down a canyon on a planet, its floor skimmed, pillars in the way, three waves, a gunship
 *   stage-2  Debris field  through a field of rocks in space, rocks let into the way, three waves, a gunship
 *
 * The craft is a starfighter off the craft shelf on both (its airframe the strike foil). The squad, the rival squad,
 * the all-range arena and the route's later stages are laid on the same words as they come.
 *
 *   WOLF_SQUADRON           the squadron's craft and airframe
 *   STAGES                  the stages, in order: { id, name, brief, airspace }
 *   wolfSquadronStart(world) → { world }: the rail's starter, its first stages under what the creator wrote
 *
 * Pure: the same squadron lays the same stages.
 */

export const WOLF_SQUADRON = Object.freeze({ airframe: 'strikeFoil' });

export const STAGES = Object.freeze([
  Object.freeze({
    id: 'stage-1', name: 'Canyon run', brief: 'Down the canyon, low and fast: pillars to weave through, fighters to break up, the gunship at its mouth.',
    airspace: Object.freeze({ map: Object.freeze({ form: 'canyon', craft: 'multirole' }), rail: Object.freeze({ speed: 120, waves: 3 }) }),
  }),
  Object.freeze({
    id: 'stage-2', name: 'Debris field', brief: 'Through the rocks above the planet: rocks in the way, fighters among them, the gunship beyond.',
    airspace: Object.freeze({ map: Object.freeze({ craft: 'fighter', field: 6000 }), space: Object.freeze({ asteroids: 'field' }), rail: Object.freeze({ speed: 60, waves: 3 }) }),
  }),
]);

/** A stage as a gameworld level: its airspace, the squadron's starfighter on it, flown as a stage. */
export function stageLevel(stage) {
  return { name: stage.name, airspace: { ...JSON.parse(JSON.stringify(stage.airspace)), airframe: WOLF_SQUADRON.airframe }, goal: { flight: 'stage' } };
}

/** The rail's starter: its first stages, under what the creator wrote (every key they wrote wins). */
export function wolfSquadronStart(world, { stages = STAGES.length } = {}) {
  const levels = Object.fromEntries(STAGES.slice(0, stages).map((S) => [S.id, stageLevel(S)]));
  return { world: { mode: 'autonomous', style: { kit: 'trail-valley' }, start: STAGES[0].id, ...world, levels } };
}
