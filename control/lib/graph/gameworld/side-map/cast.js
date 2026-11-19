/**
 * THE SIDE MAP'S FOES (a level's `foes` beside its `sidemap`): where a laid map stands the bestiary's foes, as the play
 * layer's placements the foe shelf stands (gameworld/foes.js foePlacements `ends.placed`, hostileCast on the side strip's
 * RAIL: each body held to the lane, x 0, the way the hero runs).
 *
 *   WHERE      one at each of the map's spawners (its zones' `spawners`, the back wall's hatches the dress draws), on the
 *              floor there, facing the way in (−y: the hero comes from the start); a run with none stands none, so a
 *              climb, a drop, a rest and the boss's room are clear of them
 *   WHO        the level's `from` in turn, spawner by spawner along the map: the first met is the first named, so a
 *              level's list is its lesson's order (a walker before a charger)
 *
 *   SIZE       a game's, not the animal's: each foe grown to at least FOE_STATURE of the hero's height (a guinea pig stands
 *              at its knee in the fauna, under the buster's muzzle: here it stands to its chest, so a round fired level
 *              meets it), its figure, its hit egg and its collider together; a foe already that tall as it was
 *
 *   sideMapPlaced(layout, from) → [{ id, eid, at: [0, s, z], heading, segment }]
 *   sideMapEnds(layout, from, { spawn, boss? }) → the ends the foe cast reads: { placed, spawn, beats: [], rail: { length },
 *                  boss?: bossPlace's }
 *   bossPlace(layout, id) → { id, at, heading, zone }   the last room's boss: in from its far wall, on its floor, facing in
 *   grownFoe(entity, stature) → the entity at the side map's game scale (FOE_STATURE)
 *
 * Pure: no dice. The same map, the same foes.
 */
const r3 = (v) => Math.round(v * 1000) / 1000;
/** Facing the way in: down the lane toward the start (the hero faces +y, π/2). */
export const FACING_IN = r3(-Math.PI / 2);

/** The least a side map's foe stands, a share of the hero's height (its buster's muzzle is 0.7 of it, a pellet's reach
 * ¾ m round its line: lower.js BUSTER_HIT). */
export const FOE_STATURE = 0.6;

/** A foe stood by the foe cast, grown to the side map's game scale: its figure (`body.scale`), its hit egg and its
 * collider by one factor, never shrunk. */
export function grownFoe(e, stature) {
  const h = e.rule?.collideHeight ?? 0, want = FOE_STATURE * stature;
  if (!(h > 0) || h >= want) return e;
  const k = want / h, B = e.body, R = e.rule;
  return {
    ...e,
    rule: { ...R, collideHeight: r3(h * k), ...(R.collideRadius ? { collideRadius: r3(R.collideRadius * k) } : {}), ...(R.stride ? { stride: r3(R.stride * k) } : {}) },
    // (and `fit`: the page's resolver stands its figure at least that tall by the figure's own bounds, the skeleton the
    // fauna measures being shorter than its flesh and head; world-scene.js. A page without its figure keeps these)
    body: { ...B, scale: r3((B.scale ?? 1) * k), ...(B.radius ? { radius: r3(B.radius * k) } : {}), ...(B.egg ? { egg: Object.fromEntries(Object.entries(B.egg).map(([q, v]) => [q, r3(v * k)])) } : {}), fit: { least: r3(want), from: B.scale ?? 1 } },
  };
}

/** The placements on a laid map, the level's foes in turn along its spawners. */
export function sideMapPlaced(layout, from) {
  if (!from?.length) return [];
  const S = [...layout.spawners].sort((a, b) => a.at[0] - b.at[0]);
  return S.map((sp, k) => ({ id: `spawn-${k + 1}`, eid: from[k % from.length], at: [0, r3(sp.at[0]), r3(sp.at[1])], heading: FACING_IN, segment: sp.zone }));
}

/** What the foe cast reads of a side map: its placements, the hero's spawn, no trail beats, the lane's length. */
export function sideMapEnds(layout, from, { spawn, boss = null }) {
  const s1 = Math.max(...layout.swept.map((r) => r.s1));
  return { placed: sideMapPlaced(layout, from), spawn, beats: [], rail: { length: r3(s1) }, ...(boss ? { boss: bossPlace(layout, boss) } : {}) };
}

/** Where the last room's boss stands: BOSS_BACK m in from its far wall, on its floor, facing the way in. */
export const BOSS_BACK = 3;
export function bossPlace(layout, id) {
  const Z = layout.zones.at(-1), s = r3(Z.rect[1] - BOSS_BACK);
  const F = layout.solids.find((r) => r.zone === Z.i && r.role === 'floor' && s >= r.s0 && s <= r.s1);
  return { id, at: [0, s, r3(F ? F.z1 : Z.exit[1])], heading: FACING_IN, zone: Z.i };
}
