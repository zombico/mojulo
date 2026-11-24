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
 *   bossOf(stage)      → the id of the hull the stage holds for (the track's last `until`), or null
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
});
export const STAGE_IDS = Object.freeze(Object.keys(STAGES));

/** The stage as a manifest: an airspace's scroll. */
export function stageManifest(id) {
  const S = STAGES[id];
  if (!S) throw new Error(`scroll stage: '${id}' is not a stage (${STAGE_IDS.join(', ')})`);
  return { kind: 'airspace', title: S.title, scroll: JSON.parse(JSON.stringify(S.scroll)) };
}

/** The hull a stage holds its screen for: its track's last `until`. */
export const bossOf = (S) => [...(S.scroll.track || [])].reverse().find((L) => L.hold === true && L.until)?.until ?? null;
