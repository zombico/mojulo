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
 * Its game runs on mana-ui, as Rebel Storm's does: its title, its stages, its pause and each stage's scored result in
 * the squadron's look, and each stage is designed whole as Rebel Storm's missions are (campaign/stage.js: its place, its
 * route, its waves at their marks in their formations, its hazards, its boss, its points and medals), told on the same
 * holo table as it loads, approved there, and laid from its design. Arcade, not a sim: every fighter, gun and core down
 * is points, the boss down wins it, and its medal is its score's.
 *
 *   WOLF_SQUADRON           the squadron's craft and airframe
 *   WOLF_SQUADRON_LOOK      the look mana-ui draws it in: the `squadron` theme card
 *   STAGES                  the stages, in order: { id, name, brief, airspace } (a stage with no design flies these)
 *   STAGE_DESIGNS           the stages designed whole, written onto the world as its `missions`
 *   wolfSquadronStart(world) → { world }: the rail's starter, its first stages under what the creator wrote
 *
 * Pure: the same squadron lays the same stages.
 */

export const WOLF_SQUADRON = Object.freeze({ airframe: 'strikeFoil' });
// (an arcade squadron's look: night-blue plates cut at the corner, cyan and amber, menus that slam in; nothing drawn
// across the way ahead during a stage)
export const WOLF_SQUADRON_LOOK = 'squadron';

/**
 * The stages designed whole (campaign/stage.js), told on the holo table before they are flown and approved there:
 * written onto the world as its `missions` (campaign/designer.js), an approved one's level laid from its design (its
 * route, its waves at their marks in their formations, its hazards, its boss, its score and medals), briefed as it loads.
 */
export const STAGE_DESIGNS = Object.freeze({
  'stage-1': Object.freeze({
    id: 'stage-1', name: 'Canyon run', status: 'approved',
    place: { system: 'Kessa', cluster: 'Varn', station: 'Red Canyon', moon: 4, star: 'orange' },
    route: { ground: 'canyon', world: 'rust', speed: 120, hazards: 'some' },
    waves: [
      { id: 'scouts', name: 'Scouts', count: 3, at: 0.12, formation: 'line' },
      { id: 'raiders', name: 'Raiders', count: 4, at: 0.32, formation: 'vee' },
      { id: 'hunters', name: 'Hunters', count: 3, at: 0.52, formation: 'echelon' },
      { id: 'swarm', name: 'Swarm', count: 6, at: 0.72, formation: 'swarm' },
    ],
    boss: { name: 'Gunship', guns: 2, armour: 'light', hull: 'corvette' },
    steps: [
      { title: 'Red Canyon', say: 'Down Red Canyon, low and fast. The walls are your cover; the pillars in the way are not.', show: ['squad', 'route', 'start', 'end'] },
      { title: 'First contact', say: 'Scouts first, three abreast. Then raiders, four in a vee.', show: ['scouts', 'raiders'] },
      { title: 'Hunters and the swarm', say: 'Hunters come stepped across the canyon. Past them, a swarm: roll through it, guns hot.', show: ['hunters', 'swarm'] },
      { title: 'The gunship', say: 'A gunship holds the canyon\'s mouth. Its two guns first, then its core.', show: ['boss'], routes: [['squad', 'boss']] },
      { title: 'Wolves, go', say: 'Every fighter a hundred, a gun two fifty, the core a thousand. Bring home gold.', show: ['squad', 'boss'] },
    ],
  }),
  'stage-2': Object.freeze({
    id: 'stage-2', name: 'Debris field', status: 'approved',
    place: { system: 'Kessa', cluster: 'Varn', station: 'Varn Shoals', moon: 4, star: 'orange' },
    route: { ground: 'space', world: 'rust', speed: 60, hazards: 'some' },
    waves: [
      { id: 'pickets', name: 'Pickets', count: 3, at: 0.15, formation: 'line' },
      { id: 'wing', name: 'Wing', count: 3, at: 0.4, formation: 'vee' },
      { id: 'swarm', name: 'Swarm', count: 4, at: 0.65, formation: 'swarm' },
    ],
    boss: { name: 'Carrier', guns: 3, armour: 'light', hull: 'carrier' },
    steps: [
      { title: 'The Shoals', say: 'The Varn Shoals: rock all the way to the carrier. Keep moving; the rocks let into the way will not.', show: ['squad', 'route', 'start', 'end'] },
      { title: 'Pickets and a wing', say: 'Pickets at the edge of the field, then a wing of three in a vee.', show: ['pickets', 'wing'] },
      { title: 'The swarm', say: 'Deep in the field, a swarm comes out of the rocks: roll through it, guns hot.', show: ['swarm'] },
      { title: 'The carrier', say: 'The carrier sits beyond the field: three guns round its core. Take the guns, then the core.', show: ['boss'], routes: [['squad', 'boss']] },
    ],
  }),
});

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
  // (its menus, its pause and its results drawn by mana-ui in the squadron's look; its stages designed whole, briefed on
  // the holo table as they load, approved ones laid from their designs; the creator's own `ui` and missions win)
  const designs = Object.fromEntries(Object.entries(STAGE_DESIGNS).filter(([id]) => levels[id]).map(([id, D]) => [id, JSON.parse(JSON.stringify(D))]));
  return { world: { mode: 'autonomous', style: { kit: 'trail-valley' }, ui: { theme: WOLF_SQUADRON_LOOK }, start: STAGES[0].id, ...world, levels, ...(Object.keys(designs).length ? { missions: { ...designs, ...(world?.missions ?? {}) } } : {}) } };
}
