// THE CITY'S SHOPS ON THE RUNTIME: a gun carried empty (combat-ranged.js `loaded`, `reserve`) fires nothing until a box of
// rounds is bought (the cast's `rearm`), a reload loading them; a respray (the cast's `repaint`) gives the car the player
// drives the next coat it does not wear.
import { describe, it, expect } from 'vitest';
import { composeLive } from './compose.js';

const E = composeLive();
const DT = 1 / 30;
const PISTOL = { fireClass: 'sight', auto: true, rof: 3, magazine: 12, reload: 0.5, damage: 1, range: 35, reserve: 0, loaded: 0 };
const run = (st, s, input = {}) => { for (let i = 0; i < Math.max(1, Math.round(s / DT)); i++) E.stepWorld(st, input, DT, { ground: () => 0 }); return st; };

describe('a gun carried empty', () => {
  it('fires nothing; a box bought loads it on the reload, and the rest is its reserve', () => {
    const st = E.createWorld({ entities: [{ id: 'hero', pilotable: true, rule: { type: 'platform', speed: 5 }, weapon: PISTOL, body: { type: 'figure-rig', figure: 'hero' }, transform: { pos: [0, 0, 0] } }, { id: 'cam', isCamera: true, rule: { type: 'follow', target: 'hero' } }] });
    const w = st.byId.hero.weapon;
    expect(w).toMatchObject({ ammo: 0, reserve: 0, magazine: 12 });
    run(st, 1, { fire: 1 });
    expect(w.shots || 0).toBe(0);
    E.castOps(st, [{ op: 'rearm', who: 'hero', by: 24 }]);
    run(st, 1);
    expect(w.ammo).toBe(12); expect(w.reserve).toBe(12);
  });
});

describe('a respray', () => {
  it('the car the player drives comes out the next coat of the list it does not wear', () => {
    const cab = { id: 'car-1', rule: { type: 'drive', horsepower: 140, mass: 1400, wheelbase: 2.7, wheelRadius: 0.33 }, mount: { cab: true, hull: [0.95, 2.3], reach: 3, stand: [-1.3, 0.2], mount: { s: 0.35 }, dismount: { s: 0.35 }, slow: 1.5, pool: { model: 'm', tint: [1, 0, 0] } }, body: { type: 'none' }, transform: { pos: [2, 1, 0] } };
    const st = E.createWorld({ entities: [{ id: 'hero', pilotable: true, rule: { type: 'platform', speed: 5 }, body: { type: 'figure-rig', figure: 'hero' }, transform: { pos: [0, 0, 0] } }, cab, { id: 'cam', isCamera: true, rule: { type: 'follow', target: 'hero' } }] });
    run(st, DT, { interact: 1 }); run(st, 3);
    expect(st.byId.hero.mountedOn).toBe('car-1');
    const T = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    E.castOps(st, [{ op: 'repaint', who: 'hero', tints: T }]);
    expect(st.byId['car-1'].mount.pool).toMatchObject({ model: 'm', tint: [0, 1, 0] });
    E.castOps(st, [{ op: 'repaint', who: 'hero', tints: T }]);
    expect(st.byId['car-1'].mount.pool.tint).toEqual([0, 0, 1]);
  });
});
