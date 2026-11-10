// THE RAIL (foe.js, `rule.rail`, a side strip's: gameworld/foes.js hostileCast): a foe waits off the 2D rail, behind the
// lane, until the hero comes near its place along it; then comes in on its arc to its place on the floor; and on the rail
// every move it makes (its own, the mind's chase, a knockback) keeps it on the lane. One class per procedure: a pacer
// (its own move) and a chaser (the mind's).
import { describe, it, expect } from 'vitest';
import { composeLive } from './compose.js';
import { FOE_CLASSES } from '../../foes/index.js';
import { resolveFoe } from '../../foes/resolve.js';

const E = composeLive();
const DT = 1 / 30;
const byMove = (m) => { const c = Object.values(FOE_CLASSES).find((k) => k.move === m); if (!c) throw new Error(`no class that ${m}s`); return c; };
const pilot = (pos) => ({ id: 'p', pilotable: true, rule: { type: 'platform', speed: 4, eye: 0, collideRadius: 0.3, collideHeight: 1.7, lane: [[0, -10], [0, 60]] }, body: { type: 'mesh', hittable: true, hp: 99, egg: { a: 0.35, c: 0.9, cz: 0.9 } }, transform: { pos, heading: Math.PI / 2 } });
const JOIN = [0, 20, 0];
const RAIL = { a: [0, -10], b: [0, 60], join: JOIN, heading: -Math.PI / 2, wait: true, wake: 9, time: 0.7, arc: 1.4 };
const foe = (cls, pos = [-5.5, 20, 0]) => {
  const f = resolveFoe({ class: cls.id });
  return { id: 'f', team: 'foes', rule: { ...f.entity.rule, eye: 0, collideRadius: 0.4, collideHeight: 0.6, rail: RAIL }, ...(f.entity.weapon ? { weapon: f.entity.weapon } : {}), body: { type: 'mesh', hittable: true, hp: f.toll.hp, poise: 2, egg: { a: 0.3, c: 0.3, cz: 0.3 } }, transform: { pos, heading: 0 } };
};
const run = (st, n) => { for (let i = 0; i < n; i++) E.stepWorld(st, {}, DT, { ground: () => 0 }); return st; };

describe('a foe on a side strip\'s rail', () => {
  for (const move of ['pace', 'chase']) {
    it(`a ${move === 'pace' ? 'pacer' : 'chaser'} waits off the rail, comes in when the hero nears, then holds to the lane`, () => {
      const st = E.createWorld({ entities: [pilot([0, -5, 0]), foe(byMove(move))] });
      run(st, 60);
      expect(st.byId.f.transform.pos[0]).toBeCloseTo(-5.5, 6);       // the hero 25 m off: it waits behind the lane
      st.byId.p.transform.pos = [0, 14, 0];                            // within its wake
      const xs = [];
      for (let i = 0; i < 40; i++) { run(st, 1); xs.push(st.byId.f.transform.pos[0]); }
      expect(Math.min(...xs)).toBeLessThan(-1);                        // (it came in from behind)
      expect(st.byId.f.foeRail).toBe('on');
      for (let i = 0; i < 120; i++) { run(st, 1); expect(Math.abs(st.byId.f.transform.pos[0])).toBeLessThan(1e-9); }   // on the lane, every step
      st.byId.f.transform.pos[0] = 2.5;                                // a blow knocks it off the plane
      run(st, 1);
      expect(Math.abs(st.byId.f.transform.pos[0])).toBeLessThan(1e-9);
    });
  }
  it('absent a rail, a foe moves as it did', () => {
    const f = foe(byMove('pace'), [3, 20, 0]); delete f.rule.rail;
    const st = E.createWorld({ entities: [pilot([0, 14, 0]), f] });
    run(st, 30);
    expect(st.byId.f.foeRail).toBeUndefined();
  });
});
