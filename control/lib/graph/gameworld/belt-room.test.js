// THE BELT (belt-room.js): the game room blown out to a beat 'em up's level. The concept: a way in screens, an armed
// hero moved in the screen's frame, the bestiary's foes dormant in waves that grow, the belt's rules on the bus, the
// side camera held square with its depth kept; seeded.
import { describe, it, expect } from 'vitest';
import { beltRoom, BELT } from './belt-room.js';
import { POLES } from './feel/cards.js';

const FIGHTER = Object.keys(POLES).find((p) => POLES[p].demo.includes('attack'));
const R = beltRoom({ id: 'b', feel: FIGHTER }, { screens: 2 });
const M = R.manifest, hero = M.entities.find((e) => e.id === 'hero'), foes = M.entities.filter((e) => e.team === 'foes');

describe('the way', () => {
  it('is its screens end to end, a camera wide each, with a back wall and the near side held', () => {
    expect(R.belt.length).toBe(2 * BELT.SCREEN);
    expect(R.belt.screens.map((s) => [s.from, s.to])).toEqual([[0, BELT.SCREEN], [BELT.SCREEN, 2 * BELT.SCREEN]]);
    const xs = M.colliders.map((c) => [c.min[0], c.max[0]]);
    expect(xs.some(([a, b]) => b <= -BELT.DEPTH / 2 + 1e-6 && a < b)).toBe(true);     // the back
    expect(xs.some(([a]) => a >= BELT.DEPTH / 2 - 1e-6)).toBe(true);                   // the near side
    expect(M.faces.some((f) => f.group === 'belt:near')).toBe(false);                   // held, not drawn
  });
  it('every prop stands inside the way, against the back', () => {
    expect(R.belt.props.length).toBeGreaterThan(0);
    for (const p of R.belt.props) { expect(p.at[0]).toBeLessThan(0); expect(p.at[1]).toBeGreaterThan(0); expect(p.at[1]).toBeLessThan(R.belt.length); }
  });
});

describe('the cast', () => {
  it('the hero is armed, hittable, and moved in the screen\'s frame', () => {
    expect(hero.rule).toMatchObject({ move: 'world', moveYaw: BELT.camera.yaw });
    expect(Array.isArray(hero.rule.weapons) && hero.rule.weapons.length).toBeTruthy();
    expect(hero.rule.moveset).toBeTruthy();
    expect(hero.body.hittable).toBe(true);
  });
  it('the foes stand dormant, a person\'s size, one a wave slot; each wave a foe more than the last', () => {
    const counts = R.belt.screens.flatMap((s) => s.waves.map((w) => w.length));
    expect(foes).toHaveLength(counts.reduce((a, b) => a + b, 0));
    for (let k = 1; k < counts.length; k++) expect(counts[k]).toBeGreaterThanOrEqual(counts[k - 1]);
    for (const f of foes) { expect(f.dormant).toBe(true); expect(f.rule.collideHeight).toBeLessThan(2.5); }
    // (each stands inside its own screen)
    R.belt.screens.forEach((s) => s.waves.flat().forEach((p) => { expect(p.at[1]).toBeGreaterThan(s.from); expect(p.at[1]).toBeLessThan(s.to); }));
  });
});

describe('the rules and the camera', () => {
  it('the belt is on the bus, its cues reaching the cast; its rows on the level\'s HUD host', () => {
    expect(M.events.cast).toBe(true);
    expect(M.events.reactions.filter((r) => r.do === 'ctrl' && r.op === 'hold').length).toBeGreaterThan(0);
    expect(M.events.reactions.filter((r) => r.do === 'ctrl' && r.op === 'spawn').map((r) => r.who).sort()).toEqual(foes.map((f) => f.id).sort());
    expect(M.manaHud.rows).toBe('events');
  });
  it('the side camera is square to the way, its depth held, kept half a frame in from a hold', () => {
    expect(M.camera).toMatchObject({ rule: 'side', target: 'hero', keel: 0, ends: BELT.camera.ends });
    expect(2 * BELT.camera.ends).toBeLessThanOrEqual(BELT.SCREEN);
  });
  it('is seeded: the same world lays the same belt; more screens, more of it', () => {
    expect(JSON.stringify(beltRoom({ id: 'b', feel: FIGHTER }, { screens: 2 }).belt)).toBe(JSON.stringify(R.belt));
    expect(beltRoom({ id: 'b', feel: FIGHTER }, { screens: 3 }).belt.screens).toHaveLength(3);
    expect(() => beltRoom({ id: 'b', feel: FIGHTER }, { screens: 0 })).toThrow(/screens/);
  });
});
