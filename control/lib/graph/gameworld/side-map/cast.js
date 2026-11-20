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
 *   SIZE       a game's, not the animal's: each foe grown to at least FOE_STATURE of the hero's height (a heavy, the elite
 *              rank, FOE_STATURE_HEAVY) (a guinea pig stands
 *              at its knee in the fauna, under the buster's muzzle: here it stands to its chest, so a round fired level
 *              meets it), its figure, its hit egg and its collider together; a foe already that tall as it was
 *
 *   sideMapPlaced(layout, from) → [{ id, eid, at: [0, s, z], heading, segment }]
 *   sideMapEnds(layout, from, { spawn, boss? }) → the ends the foe cast reads: { placed, spawn, beats: [], rail: { length },
 *                  boss?: bossPlace's }
 *   bossPlace(layout, id) → { id, at, heading, zone }   the last room's boss: in from its far wall, on its floor, facing in
 *   grownFoe(entity, stature) → the entity at the side map's game scale (FOE_STATURE)
 *   sideFoe(entity, stature) → grown, and its gun's rounds TRAVELLING (travellingWeapon: FOE_SHOT, FOE_LOB), dodged
 *
 * Pure: no dice. The same map, the same foes.
 */
const r3 = (v) => Math.round(v * 1000) / 1000;
/** Facing the way in: down the lane toward the start (the hero faces +y, π/2). */
export const FACING_IN = r3(-Math.PI / 2);

/** The least a side map's foe stands, a share of the hero's height (its buster's muzzle is 0.7 of it, a pellet's reach
 * ¾ m round its line: lower.js BUSTER_HIT). */
export const FOE_STATURE = 0.6;
/** A HEAVY (the elite rank) stands taller: this share of the hero's height, so it is read as the bigger thing before it is
 * shot (its plating the bestiary's). */
export const FOE_STATURE_HEAVY = 0.8;

/** A foe stood by the foe cast, grown to the side map's game scale: its figure (`body.scale`), its hit egg and its
 * collider by one factor, never shrunk. */
export function grownFoe(e, stature) {
  const h = e.rule?.collideHeight ?? 0, want = (e.rule?.mind?.rank === 'elite' ? FOE_STATURE_HEAVY : FOE_STATURE) * stature;
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

/**
 * A FOE'S ROUNDS on a side map travel: the foe shelf's gun fires the lab's platformer shots (feel/kernel.js RANGED: `aimed`,
 * one slow round at the hero; `lob`, an arc that bursts), never a hitscan line, so a shot is seen crossing the room and
 * jumped or dashed past. FOE_SHOT a straight round (a turret's: from its middle, `eye` a share of its height, every
 * `cooldown` s), FOE_LOB an arc (a lobber's); each flies over and under z = 0 (`noGround`, the map's floors its colliders)
 * and through the foes before it (`passTeam`), in its colour (the page draws it in the shot's look, index.js).
 */
export const FOE_SHOT = Object.freeze({ speed: 7, size: 0.2, life: 3.2, cooldown: 1.6, eye: 0.55, color: 0xff4a1a });
export const FOE_LOB = Object.freeze({ speed: 9, angle: 50, gravity: 14, size: 0.2, splash: 0.6, life: 3, cooldown: 2.4, eye: 0.7, color: 0xffa030 });
const round = (w, R, H, lob) => ({
  ...w, fireClass: 'lob', lobAngle: lob ? R.angle : 0, projectileSpeed: R.speed, projectileGravity: lob ? R.gravity : 0, projRadius: R.size,
  splashRadius: lob ? R.splash : 0, fuse: R.life, cooldown: R.cooldown, armTime: 0.1, smokeTrail: false, eye: w.eye > 0 ? w.eye : r3(R.eye * H),
  ...(w.cooldown > 0 ? { cooldown: w.cooldown } : {}),
  fxColor: R.color, fxScale: R.size, noGround: true, passTeam: true, foeRound: true,
});
/** A foe's gun as a side map fires it: its hitscan a travelling round, its lob a real arc; a body with none, as it was. */
export function travellingWeapon(w, height) {
  if (!w || w.foeRound) return w;
  if (w.fireClass === 'sight') return round(w, FOE_SHOT, height, false);
  if (w.fireClass === 'lob') return round(w, FOE_LOB, height, true);
  return w;
}

/** A foe as a side map stands it: grown to the game's scale (grownFoe), its gun firing travelling rounds. */
export function sideFoe(e, stature) {
  const g = grownFoe(e, stature);
  return g.weapon ? { ...g, weapon: travellingWeapon(g.weapon, g.rule?.collideHeight ?? stature) } : g;
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
