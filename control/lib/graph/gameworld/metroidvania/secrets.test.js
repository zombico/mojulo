// THE SECRET WALLS: a pocket hidden behind a wall like the walls round it, found by blows. The concepts: no power opens it
// (the box's words and its solve); no gate holds it and nothing marks it (the held gates, the drawing, the map); its
// blows counted, or, the level physical, its room's wall matter breaking by its joules (rupa) at the world's power.
import { describe, it, expect } from 'vitest';
import { readBox, layBox } from './box.js';
import { greyboxOf } from './rooms.js';
import { solveBox } from './solve.js';
import { boxOf, assembleBox, secretMatterOf } from './scene.js';
import { boxMapOf, boxMapView } from './hud.js';
import { GATES, SECRET } from './gates.js';
import { vampireSonata, vampireSonataGame } from './vampire-sonata.js';
import { readGameworld } from '../world.js';
import { gameStages, stageLevelOrder } from '../levels.js';
import { POWER } from '../../rupa/index.js';

const M = (words, more = {}) => ({ kind: 'geocube', show: 'metroidvania', metroidvania: words, stature: 1.69, ...more });
const words = vampireSonata();
const secretRing = words.rings.find((r) => (r.pockets ?? []).some((p) => p.gate === 'secret'));

describe('the secret walls', () => {
  it('are a pocket\'s gate no power opens, never the step into a ring', () => {
    expect(GATES.secret.by).toBe('blows');
    expect(secretRing).toBeTruthy();
    expect(() => readBox(words)).not.toThrow();
    const bad = structuredClone(words); bad.rings[0].inward = 'secret';
    expect(() => readBox(bad)).toThrow(/inward/);
    // (the solve opens it with nothing held: blows find it)
    const S = solveBox(layBox(words));
    expect(S.pockets.got.some((p) => p.gate === 'secret')).toBe(true);
    expect(S.pockets.left).toEqual([]);
  });

  it('stand as a wall: full height under the alcove, a breakable no held gate holds, broken in its blows', () => {
    const G = greyboxOf(layBox(words)), g = G.gates.find((x) => x.kind === 'secret');
    expect(g.shape).toBe('secret');
    const B = boxOf(M(words)), b = B.breakables.find((x) => x.id === B.secrets[0].id);
    expect(b.hp).toBe(SECRET.blows);
    expect(b.joules).toBeUndefined();
    expect(B.held.gates.some((x) => x.id === b.id)).toBe(false);
    expect(B.laws.find((l) => l.id === 'secrets')).toMatchObject({ holds: true });
  });

  it('under destructible physics, are their room\'s wall matter, as thin a facing as breaks in their blows at the world\'s power', () => {
    const B = boxOf(M(words, { destruction: 'physical', cube: 'gothic-night' })), b = B.breakables.find((x) => x.id === B.secrets[0].id);
    const W = secretMatterOf({ cube: 'gothic-night' });
    expect(b.matter).toBe(W.matter);
    expect(W.power).toBe(POWER[SECRET.power].by);
    const blows = b.joules / (W.swing * W.power);
    expect(blows).toBeLessThan(SECRET.blows);
    expect(blows).toBeGreaterThan(SECRET.blows - 1);
    expect(B.laws.find((l) => l.id === 'secrets').says).toMatch(/by its matter/);
    // (a level's own matter wins: a person's blows make it a thicker facing for the same blows)
    const human = boxOf(M(words, { destruction: 'physical', matter: { power: 'human' } })).breakables.find((x) => x.id === b.id);
    expect(human.joules).toBeLessThan(b.joules);
  });

  it('are drawn as their room\'s wall in a dressed box, never in a gate\'s colour', () => {
    const P = assembleBox(M(words)), id = boxOf(M(words)).secrets[0].id, mine = P.faces.filter((f) => f.group === `break:${id}`);
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.some((f) => f.fill === GATES.secret.colour)).toBe(false);
  });

  it('keep their prize off the map until the wall is down', () => {
    const B = boxOf(M(words)), map = boxMapOf({ layout: B.layout, screen: B.greybox.screen, held: B.held });
    const R = map.relics.find((r) => r.secret), seen = { [R.cell]: 1 };
    expect(R.secret).toBe(B.secrets[0].id);
    const at = (V) => V.markers.some((m) => m.kind === 'item' && m.x === R.x && m.y === R.y);
    expect(at(boxMapView(map, { seen }))).toBe(false);
    expect(at(boxMapView(map, { seen, broken: { [R.secret]: 1 } }))).toBe(true);
  });

  it('break by the game\'s own degree: physical where its mechanics say, counted blows where it says none', () => {
    const order = (G) => { const W = readGameworld(G), [st] = gameStages(W); return stageLevelOrder(W, st, { heroRef: 'h', heroStature: 1.69, ref: 'l' }).args.manifest; };
    const plain = order(vampireSonataGame({ heroRef: 'h' }));
    expect(plain.destruction).toBeUndefined();
    const G = vampireSonataGame({ heroRef: 'h' }); G.mechanics = { destruction: 'physical' };
    expect(order(G)).toMatchObject({ destruction: 'physical', matter: { power: SECRET.power } });
  });
});
