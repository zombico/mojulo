/**
 * BLAZE GUNNER'S STAGES: a stage as a recipe in the scroll stage's own words (stage-scene.js), its sections in screens
 * along the scroll, each adding one thing to what came before (the side map's "one new thing a zone",
 * docs/side-map-principles.md), a carrier in each so the arsenal grows as the stage goes, and the boss at its end
 * holding the screen until it falls. A new stage is a row.
 *
 *   STAGES             { [id]: { title, says, sections: [{ from, name, adds }], scroll } }: `scroll` an airspace's scroll
 *   STAGE_IDS
 *   stageManifest(id)  → { kind: 'airspace', title, scroll }: the stage as a manifest (a level puts scrollStagePlay's
 *                        play on it)
 *   bossOf(stage)      → the id of what the stage holds for (a hull, an interior's reactor: the track's last `until`), or null
 *
 * Pure data.
 */

const row = (o) => Object.freeze(o);

export const STAGES = Object.freeze({
  // STAGE 1: the fleet's edge. Waves to learn the base gun and the first pod on; a gun pod and a heavy that ask for a pod;
  // a hull run low over a frigate whose guns fire up at the ship, darts diving and a wall to find the gap in; and the
  // boss, a corvette broken by its systems while it holds the screen
  'stage-1': row({
    title: 'Blaze Gunner: the fleet\'s edge',
    says: 'waves in the open, a carrier bringing the spread; a gun pod and a heavy, the blade brought; a hull run low over a frigate, darts and a wall; the corvette held until its systems fall',
    sections: Object.freeze([
      row({ from: 0, name: 'the open', adds: 'drones in a line and a vee; the first carrier, its spread' }),
      row({ from: 3, name: 'the picket', adds: 'a gun pod holding station, its fan; a heavy, its spiral; a carrier bringing the blade' }),
      row({ from: 6, name: 'the hull run', adds: 'a frigate on the play plane, its guns firing up; darts diving; a wall and its gap' }),
      row({ from: 10.2, name: 'the corvette', adds: 'the boss: the screen held while its systems are broken, then its chain' }),
    ]),
    scroll: row({
      track: Object.freeze([row({ by: Object.freeze([10.2, 0]) }), row({ hold: true, until: 'hull-1' }), row({ by: Object.freeze([2.5, 0]) })]),
      backdrop: row({ planets: 2 }),
      waves: Object.freeze([
        row({ at: 0.6, foe: 'drone', count: 5, formation: 'line', v: 0.15 }),
        row({ at: 1.5, foe: 'drone', count: 5, formation: 'vee', v: -0.1 }),
        row({ at: 2.3, foe: 'carrier', v: 0.05, carries: 'spread' }),
        row({ at: 3.2, foe: 'gunpod', v: 0.2 }),
        row({ at: 3.6, foe: 'drone', count: 4, formation: 'echelon', v: -0.2 }),
        row({ at: 4.4, foe: 'heavy', v: -0.05 }),
        row({ at: 5.2, foe: 'carrier', v: 0.25, carries: 'blade' }),
        row({ at: 6.6, foe: 'dart', count: 3, formation: 'column', v: 0.2 }),
        row({ at: 7.6, foe: 'layer', v: 0.3 }),
        row({ at: 8.6, foe: 'dart', count: 4, formation: 'swarm', v: 0.15 }),
      ]),
      hulls: Object.freeze([
        // the hull run: a frigate low across the screen, on the play plane (`depth` 0), flown over
        row({ capital: 'frigate', at: 7.2, v: -0.36, depth: 0 }),
        // the boss: a corvette ahead of the held screen
        row({ capital: 'corvette', at: 10.55, v: 0.02, depth: 0 }),
        // the fleet behind the fight
        row({ capital: 'cruiser', at: 2.2, v: 0.22, depth: -5 }),
        row({ capital: 'carrier', at: 6.5, v: 0.3, depth: -8, heading: 180 }),
      ]),
    }),
  }),
  // STAGE 2: infiltration. A short approach in space, a carrier bringing the vulcan; then into the station by its mouth:
  // a hall of guns and hatches, a duct in bends, crushers, locks, the shutters, and the reactor behind its shields in the
  // core room, the screen held until it falls; out through the far face
  'stage-2': row({
    title: 'Blaze Gunner: infiltration',
    says: 'drones and a carrier on the approach; into the station: guns on the walls and drones out of hatches, a duct in bends, crushers, locks, the shutters; the reactor held until it falls',
    sections: Object.freeze([
      row({ from: 0, name: 'the approach', adds: 'drones in a line; a carrier bringing the vulcan' }),
      row({ from: 2.5, name: 'the mouth', adds: 'the station\'s face, its walls closing in' }),
      row({ from: 3.5, name: 'the hall', adds: 'guns on the walls, drones out of hatches' }),
      row({ from: 6.5, name: 'the duct', adds: 'a narrow way in bends' }),
      row({ from: 8.5, name: 'the crushers', adds: 'pistons told, slammed out, drawn back' }),
      row({ from: 10.5, name: 'the locks', adds: 'shutters right across the way: go through while open' }),
      row({ from: 12.5, name: 'the shutters', adds: 'bulkheads from the ceiling and the floor in turn' }),
      row({ from: 14.5, name: 'the reactor', adds: 'the boss: the core behind its shields, held until it falls' }),
    ]),
    scroll: row({
      track: Object.freeze([row({ by: Object.freeze([15.15, 0]) }), row({ hold: true, until: 'reactor' }), row({ by: Object.freeze([1.7, 0]) })]),
      backdrop: row({ planets: 1 }),
      waves: Object.freeze([
        row({ at: 0.6, foe: 'drone', count: 4, formation: 'line', v: -0.1 }),
        row({ at: 1.3, foe: 'carrier', v: 0.1, carries: 'vulcan' }),
        row({ at: 1.8, foe: 'drone', count: 4, formation: 'vee', v: 0.15 }),
      ]),
      interior: row({ at: 2.5, look: 'station', sections: Object.freeze(['mouth', 'hall', 'duct', 'crushers', 'locks', 'shutters', 'core'].map((kind) => row({ kind }))) }),
      hulls: Object.freeze([row({ capital: 'cruiser', at: 1.2, v: 0.25, depth: -5 })]),
    }),
  }),
});
export const STAGE_IDS = Object.freeze(Object.keys(STAGES));

/** The stage as a manifest: an airspace's scroll. */
export function stageManifest(id) {
  const S = STAGES[id];
  if (!S) throw new Error(`scroll stage: '${id}' is not a stage (${STAGE_IDS.join(', ')})`);
  return { kind: 'airspace', title: S.title, scroll: JSON.parse(JSON.stringify(S.scroll)) };
}

/** What a stage holds its screen for (a hull, an interior's reactor): its track's last `until`. */
export const bossOf = (S) => [...(S.scroll.track || [])].reverse().find((L) => L.hold === true && L.until)?.until ?? null;
