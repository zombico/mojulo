// A side map level (side-map/level.js, a world's `levels.<id>.sidemap`). The concepts: the rail writes the run and gun's
// first level as a side map and the mascot platformer's as the strip it was; a world refuses a side map with no side
// camera or beside another level form, teaching; the level order puts the hero on the lane at the first checkpoint under
// the side map's camera, its ladders, colliders and the catch zone its falls are counted in, the game's own fall policy
// off, the goal at the far side of the last zone, and the map's laws all held.
import { describe, it, expect } from 'vitest';
import { platformerGame, SIDE_MAP_CUBE, PLATFORMER_CUBE } from '../platformer-game.js';
import { gameStages, stageLevelOrder } from '../levels.js';
import { readGameworld } from '../world.js';
import { SIDE_FALL, SIDE_DOWN } from './play.js';
import { SIDE_ENERGY } from './level.js';

const galaxy = () => ({ id: 'gb', name: 'Galaxy Boy', ...platformerGame({ pole: 'galaxy-boy' }).words });

describe('a side map level', () => {
  it('the rail writes the run and gun\'s first level as a side map, the mascot platformer\'s as its strip', () => {
    expect(Object.keys(galaxy().levels.first)).toEqual(['name', 'style', 'sidemap', 'foes']);
    // (drawn in its own cube, a city by night, never the mascot platformer's orchard)
    expect(galaxy().levels.first.style.geocube).toBe(SIDE_MAP_CUBE);
    expect(galaxy().style.geocube).toBe(PLATFORMER_CUBE);
    expect(galaxy().levels.first.name).toBe('Level 0');
    expect(platformerGame({ pole: 'jumping-giuseppe' }).words.levels.first.course).toBeDefined();
  });
  it('a world refuses a side map with no side camera, or beside another level form', () => {
    const W = galaxy();
    expect(() => readGameworld({ ...W, camera: 'orbit' })).toThrow(/seen from the side/);
    expect(() => readGameworld({ ...W, levels: { first: { ...W.levels.first, walk: { nodes: {} } } } })).toThrow(/the map alone/);
  });
  it('its order: the hero on the lane under the side map\'s camera, its falls counted, its goal at the end, its laws held', () => {
    const W = galaxy(), [stage] = gameStages(W);
    expect(stage).toMatchObject({ section: 'sidemap', manifest: { kind: 'geocube', show: 'sidemap' } });
    const O = stageLevelOrder(W, stage, { heroRef: 'hero-ref', heroStature: 1.67, ref: 'lvl' }), m = O.args.manifest;
    const [hero, ...ladders] = m.entities, Z = m.camera.zones;
    expect(m.camera.rule).toBe('side-map');
    // (its bodies in their rail's light: the side scroller's cel, game-bodies.js BODY_LIGHTS)
    expect(Object.values(m.figures).every((f) => f.light === 'cel')).toBe(true);
    // (and their line, round each part, the bodies' alone, dark and never black)
    expect(m.toon.ink).toMatchObject({ only: 'bodies', lines: false });
    expect(m.toon.ink.color).not.toBe('#000000');
    // (and its key a zone: the lamps of the zones lit by lamps on the camera's zones, the page lights a cel body by them)
    expect(m.camera.zones.some((z) => Array.isArray(z.lamps) && z.lamps.length)).toBe(true);
    expect(hero.rule).toMatchObject({ move: 'lane', collideHeight: 1.67 });
    expect(hero.transform.pos[1]).toBeCloseTo(Z[0].checkpoint[0], 2);
    expect(ladders.every((l) => l.rule.type === 'climbable')).toBe(true);
    expect(m.events.sources).toContainEqual(expect.objectContaining({ zone: SIDE_FALL }));
    expect(m.game.fall).toBe('none');
    // (its lives as energy: a hit takes ticks, spent the hero drops out as a fall does; a continue, its screens the HUD's)
    expect(m.game.mechanics).toContainEqual({ kind: 'lives', start: 3, falls: [SIDE_FALL], energy: { ...SIDE_ENERGY, down: [...SIDE_DOWN] }, continues: true });
    const goal = m.game.mechanics.find((x) => x.kind === 'reach-exit');
    expect(goal.at[1]).toBeGreaterThan(Z.at(-1).rect[0]);
    expect(m.colliders.length).toBeGreaterThan(Z.length);
    expect(O.laws.filter((l) => !l.holds)).toEqual([]);
  });
  it('it hears the game: the rail writes a sound and an electronic score, and the level carries them; a game with none, none', () => {
    const W = galaxy(), [stage] = gameStages(W);
    expect(W.sound).toEqual({});
    expect(W.music).toEqual({ direction: { style: 'club' } });
    const audio = { sfx: { sheet: { style: 'mouth' } } };
    expect(stageLevelOrder(W, stage, { heroRef: 'hero-ref', heroStature: 1.67, ref: 'lvl', audio }).args.manifest.audio).toEqual(audio);
    expect(stageLevelOrder(W, stage, { heroRef: 'hero-ref', heroStature: 1.67, ref: 'lvl' }).args.manifest.audio).toBeUndefined();
  });
  it('with a co-star both stand in the player\'s seat, each on its own feel; the rail asks who goes; without one, the hero alone', () => {
    const P = platformerGame({ pole: 'galaxy-boy' });
    expect(P.costar).toMatchObject({ herobot: 'astro-girl', variant: 'saber' });
    expect(P.words.setup.picks[0]).toMatchObject({ id: 'pilot', from: { options: [{ id: 'hero' }, { id: 'costar' }] } });
    expect(platformerGame({ pole: 'galaxy-boy', hero: 'zero-boy' }).words.setup).toBeUndefined();
    const W = { ...galaxy(), characters: { direction: { tradition: 'anime', body: 'herobot' }, hero: { ref: 'gb-hero' }, costar: { ref: 'gb-costar', name: 'Astro Girl', variant: 'saber' } } };
    const G = readGameworld(W), [stage] = gameStages(W);
    const m = stageLevelOrder(G, stage, { heroRef: 'hero-ref', heroStature: 1.67, ref: 'lvl', costar: G.characters.costar }).args.manifest;
    const seats = m.entities.filter((e) => e.seat === 'player');
    expect(seats.map((e) => e.id)).toEqual(['hero', 'costar']);
    expect(seats[0].pilotRule.buster).toBeDefined();
    expect(seats[1].pilotRule.moveset).toBeDefined();
    expect(seats[1].pilotRule.buster).toBeUndefined();
    expect(m.figures.costar).toMatchObject({ heroRef: 'gb-costar' });
    const alone = stageLevelOrder(G, stage, { heroRef: 'hero-ref', heroStature: 1.67, ref: 'lvl' }).args.manifest;
    expect(alone.entities.some((e) => e.seat)).toBe(false);
    expect(() => readGameworld({ ...W, characters: { ...W.characters, costar: { name: 'x' } } })).toThrow(/costar.ref/);
  });
  it('a side map is played by a hero', () => {
    const W = galaxy(), [stage] = gameStages(W);
    expect(() => stageLevelOrder(W, stage, { heroRef: null })).toThrow(/played by a hero/);
  });
});
