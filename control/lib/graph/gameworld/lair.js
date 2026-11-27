/**
 * A BOSS'S LAIR — the level of its own a boss of the boss shelf is fought in (a bestiary entry that stands as one,
 * gameworld/foes.js isDirected: Artesia's hydra, a dragon). A world map whose climax beat calls such a boss has it taken off the
 * climax (the castle heights end on their keep's door) and laid one page more after its last: a CAVE CHAMBER (the
 * dungeon kind, architecture/dungeon-designer.js), its rock cold and mid-dark under one live fire so the beast stands off
 * it, the hero come in at its mouth and the boss coiled toward its back wall, the chase held low behind the hero on the
 * line from the boss (worlds/controllable/rules-basic.js follow `face`) so it looms; won by bringing it down.
 *
 *   LAIR                        the chamber, its rock, its light, where the two stand, the camera's words, and the light
 *                               its bodies are drawn under (`cast`: the lair's own, every body lit by the level as the
 *                               hero is: the manifest's castLight)
 *   lairBossOf(G, glyphs)       → { kind, beat } the climax beat's boss where it stands as a boss of the shelf, else null
 *   withoutLairBoss(glyphs, b)  → the glyphs with that beat's foes taken off it (the climax then holds nothing)
 *   lairStage(level, index, b, G) → the lair's stage (levels.js gameStages)
 *   lairArena()                 → the arena words a boss's phase event reads (its floor's centre and reach: a dragon's
 *                                 rise sets its rim burning)
 *
 * Pure.
 */
import { bestiaryOf, isDirected } from './foes.js';
import { VEHICLES } from '../boss/vehicles.js';
import { DRAGONS } from '../boss/dragons.js';

export const LAIR = Object.freeze({
  chamber: Object.freeze({ id: 'lair', at: Object.freeze([0, 0]), radius: 28, height: 22 }),
  // (cold, mid-dark rock: a warm beast stands off it; the fire's light a little cooled with it)
  style: Object.freeze({ palette: Object.freeze({ floor: '#59606c', wall: '#666e7c', ceiling: '#474c56' }), texture: 'rock-cave' }),
  lighting: Object.freeze({ ambient: 0.34, fireIntensity: 3.2, tint: Object.freeze([0.92, 0.96, 1.08]) }),
  // (the boss coiled toward the back wall facing the mouth, the hero come in at the mouth facing it; dropped onto the
  // cave's floor from `drop` m, which undulates)
  boss: Object.freeze([-6, 0, 0]), hero: Object.freeze([6, 1.5]), drop: 3,
  // (the bodies' light, the cast rig's (color-theorist/cave-rig.js): the fire's warm key thrown high from one side of the
  // line the two face each other on (a three-quarter key: it models them both and never glares straight back down the
  // chase, as a key from behind the camera does off a wing's gloss); the rock's cold light, under a sky's, filling them;
  // the floor's bounce; the walls' rim faint)
  cast: Object.freeze({ fire: '#ffb070', key: 0.8, ambient: 0.3, tint: Object.freeze([0.92, 0.96, 1.08]), floor: '#59606c', wall: '#666e7c', toLight: Object.freeze([0.2, 0.6, 0.78]), rim: 0.18 }),
  // (the chase: low, close, off the shoulder, its look lifted toward the boss)
  camera: Object.freeze({ dist: 4.2, height: 0.9, shoulder: 1.1, lookH: 1.4, faceH: 7.5, faceMix: 0.6 }),
});

const sketchOf = (glyphs) => glyphs?.grid?.sketch ?? glyphs?.sketch ?? null;

export function lairBossOf(G, glyphs) {
  const beats = sketchOf(glyphs)?.scenario?.beats ?? [], B = bestiaryOf(G);
  for (const b of beats) {
    if (b.kind !== 'climax' || !b.foes) continue;
    const kind = Object.keys(b.foes).find((k) => isDirected(B[k]));
    if (kind) return { kind, beat: b.id };
  }
  return null;
}

export function withoutLairBoss(glyphs, boss) {
  const strip = (sk) => ({ ...sk, scenario: { ...sk.scenario, beats: sk.scenario.beats.map((b) => (b.id === boss.beat ? (({ foes: _f, ...x }) => x)(b) : b)) } });
  if (glyphs.grid?.sketch) return { ...glyphs, grid: { ...glyphs.grid, sketch: strip(glyphs.grid.sketch) } };
  return { ...glyphs, sketch: strip(glyphs.sketch) };
}

export function lairStage(level, index, boss, G) {
  const E = bestiaryOf(G)[boss.kind], row = E.dragon ? DRAGONS[E.dragon] : VEHICLES[E.vehicle];
  return { level, node: 'lair', section: 'lair', index, boss: boss.kind, label: `${row.name}'s lair`,
    manifest: { kind: 'dungeon', chambers: [{ ...LAIR.chamber, at: [...LAIR.chamber.at] }], style: structuredClone(LAIR.style), lighting: structuredClone(LAIR.lighting), fire: true, castLight: { cave: structuredClone(LAIR.cast) } } };
}

export const lairArena = () => ({ center: [...LAIR.chamber.at], r: LAIR.chamber.radius, z: 0 });
