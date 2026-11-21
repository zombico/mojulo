// The side map's foes (side-map/cast.js, a level's `foes` beside its `sidemap`). The concepts: a level names none, the
// map stands none; one foe at each spawner, the level's list in turn along the map, on its floor, on the lane (x 0),
// facing the way in; grown to the game's scale (never under FOE_STATURE of the hero, so a round fired level meets it);
// through the foe cast each stands on the side strip's rail, its figure in the hero's cel light, and
// the hero stomps; the side scroller's bestiary is the herobot's language on animals and the game's mascot critters, a
// world reads it; the same map, the same foes.
import { describe, it, expect } from 'vitest';
import { sideMapPlaced, sideMapEnds, grownFoe, sideFoe, travellingWeapon, FACING_IN, FOE_STATURE, FOE_SHOT } from './cast.js';
import { sideMapOf } from './scene.js';
import { platformerGame, SIDE_MAP_FOES, SIDE_MAP_FIRST_FOES } from '../platformer-game.js';
import { gameStages, stageLevelOrder } from '../levels.js';
import { readGameworld } from '../world.js';
import { hostileCast } from '../foes.js';

const chain = { premise: 'into the plant', fill: 'machine', zones: [
  { run: 'across', screens: 2, beat: 'rest' }, { run: 'across', screens: 4, teach: 'meet', spawners: 3 }, { room: [1, 1], teach: 'boss' },
] };
const galaxy = () => readGameworld({ id: 'gb', name: 'Galaxy Boy', ...platformerGame({ pole: 'galaxy-boy' }).words });

describe('the side map\'s foes', () => {
  it('a level that names none stands none', () => {
    const { layout } = sideMapOf({ kind: 'geocube', show: 'sidemap', seed: 2, sidemap: chain });
    expect(sideMapPlaced(layout, [])).toEqual([]);
  });
  it('one at each spawner, the level\'s list in turn, on its floor, on the lane, facing the way in', () => {
    const { layout } = sideMapOf({ kind: 'geocube', show: 'sidemap', seed: 2, sidemap: chain });
    const P = sideMapPlaced(layout, ['a', 'b']);
    expect(P.map((p) => p.eid)).toEqual(['a', 'b', 'a']);
    const S = [...layout.spawners].sort((x, y) => x.at[0] - y.at[0]);
    P.forEach((p, k) => {
      expect(p.at).toEqual([0, S[k].at[0], S[k].at[1]]);
      expect(p.heading).toBe(FACING_IN);
    });
    expect(sideMapEnds(layout, ['a'], { spawn: [0, 1, 0] }).rail.length).toBe(Math.max(...layout.swept.map((r) => r.s1)));
    expect(sideMapPlaced(layout, ['a', 'b'])).toEqual(P);
  });
  it('a foe at the game\'s scale: its figure, egg and collider grown by one factor, never shrunk', () => {
    const e = { team: 'foes', rule: { collideHeight: 0.25, collideRadius: 0.1, stride: 0.3 }, body: { scale: 2, radius: 0.1, egg: { a: 0.3, c: 0.125, cz: 0.125 } } };
    const g = grownFoe(e, 1.67), k = (FOE_STATURE * 1.67) / 0.25;
    expect(g.rule.collideHeight).toBeCloseTo(FOE_STATURE * 1.67, 3);
    expect(g.body.scale).toBeCloseTo(2 * k, 2);
    expect(g.body.egg.c / g.body.egg.a).toBeCloseTo(0.125 / 0.3, 2);
    const tall = { ...e, rule: { ...e.rule, collideHeight: 1.5 } };
    expect(grownFoe(tall, 1.67)).toBe(tall);
  });
  it('the side scroller\'s bestiary: the herobot on animals and the mascot critters, read by a world', () => {
    const G = galaxy();
    expect(Object.keys(G.foes)).toEqual(Object.keys(SIDE_MAP_FOES));
    // (a robot the herobot, a critter the mascot; a HEAVY a robot plated over, at the elite rank)
    const oozes = (e) => [e.skin.ooze].flat();
    expect(Object.values(G.foes).every((e) => ['herobot', 'mascot'].includes(oozes(e)[0]))).toBe(true);
    const heavy = Object.values(G.foes).filter((e) => e.rank === 'elite');
    expect(heavy.length).toBeGreaterThan(0);
    for (const e of heavy) expect(oozes(e)).toEqual(['herobot', 'transmetal']);
    // (a robot is destroyed, its pieces flung; a critter squashed as a platformer's are)
    for (const e of Object.values(G.foes)) expect(e.vanish?.die === 'destroy').toBe(oozes(e)[0] === 'herobot');
    expect(G.levels.first.foes.from).toEqual(SIDE_MAP_FIRST_FOES);
  });
  it('through the foe cast: on the rail, in the hero\'s cel light, and the hero stomps', () => {
    const G = galaxy(), [stage] = gameStages(G);
    const refs = Object.fromEntries(Object.keys(G.foes).map((k) => [k, `gb-foes-${k}`]));
    const extra = (ends) => hostileCast(G, stage.level, ends, { refs, hero: true });
    const m = stageLevelOrder(G, stage, { heroRef: 'hero-ref', heroStature: 1.67, ref: 'lvl', extra }).args.manifest;
    const foes = m.entities.filter((e) => e.team === 'foes'), { layout } = sideMapOf({ ...stage.manifest, feel: G.feel, stature: 1.67 });
    expect(foes.length).toBe(layout.spawners.length);
    for (const f of foes) {
      // (on the rail where it stands; one that WAITS off it, a swooper, joins it there when the hero comes)
      expect(f.rule.rail.join[0]).toBe(0);
      if (!f.rule.rail.wait) { expect(f.transform.pos[0]).toBe(0); expect(f.rule.rail.join).toEqual(f.transform.pos); }
      expect(m.figures[f.body.figure].light).toBe('cel');
      // (at the game's scale: never under FOE_STATURE of the hero, its egg to its height)
      expect(f.rule.collideHeight).toBeGreaterThanOrEqual(FOE_STATURE * 1.67 - 1e-3);
      expect(f.body.egg.cz + f.body.egg.c).toBeGreaterThanOrEqual(f.rule.collideHeight * 0.9);
    }
    expect(m.entities[0].rule.stomp).toBeDefined();
    // (no foe cast, no foes: the level as it was)
    expect(stageLevelOrder(G, stage, { heroRef: 'hero-ref', heroStature: 1.67, ref: 'lvl' }).args.manifest.entities.some((e) => e.team === 'foes')).toBe(false);
  });
  it('a foe\'s gun fires TRAVELLING rounds: a hitscan line a slow round from its middle, a lob a real arc; through its own', () => {
    const shot = travellingWeapon({ fireClass: 'sight', damage: 10 }, 1);
    expect(shot).toMatchObject({ fireClass: 'lob', lobAngle: 0, projectileGravity: 0, projectileSpeed: FOE_SHOT.speed, splashRadius: 0, damage: 10, noGround: true, passTeam: true, foeRound: true });
    expect(shot.eye).toBeCloseTo(FOE_SHOT.eye, 6);
    // (slow enough to be seen crossing a screen: under the hero's own run)
    expect(FOE_SHOT.speed).toBeLessThan(10);
    const lob = travellingWeapon({ fireClass: 'lob', damage: 10 }, 1);
    expect(lob.lobAngle).toBeGreaterThan(0); expect(lob.projectileGravity).toBeGreaterThan(0);
    // (a foe's own height and rate stand; a body with no gun, as it was)
    expect(travellingWeapon({ fireClass: 'sight', eye: 0.3, cooldown: 2 }, 1)).toMatchObject({ eye: 0.3, cooldown: 2 });
    expect(travellingWeapon(undefined, 1)).toBeUndefined();
    expect(travellingWeapon(shot, 1)).toBe(shot);
    const e = { id: 'f', team: 'foes', rule: { collideHeight: 0.5 }, body: { scale: 1 }, weapon: { fireClass: 'sight', damage: 10 } };
    expect(sideFoe(e, 1.67).weapon.eye).toBeCloseTo(FOE_SHOT.eye * FOE_STATURE * 1.67, 2);
  });
});
