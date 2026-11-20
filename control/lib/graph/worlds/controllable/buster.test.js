// The buster's laws (buster.js): a press fires a tap shot at once, never more than its cap in flight; held, the charge
// builds and the release fires the highest level reached, a short hold none; each round flies straight along the facing
// and a body it meets takes its level's damage; its hitbox is its own (the regular rounds tinier than they look, the full
// charge a tall capsule): a crawler under the line lets a tap shot sail over it and is caught by the full charge, while
// a walker at the knee is met by every round (its LOW reach); the builder is emitted only into a page whose world has a body with a
// buster, so a page without one keeps every byte.
import { describe, it, expect } from 'vitest';
import { composeLive, emissionSource } from './compose.js';
import { controllableChannelScript } from '../../scene/channels/controllable/index.js';
import { feelRule } from '../../gameworld/feel/lower.js';

const E = composeLive();
const DT = 1 / 60;
// the run and gun's own buster, as the feel lowers it (Galaxy Boy's card)
const BUSTER = feelRule({ pole: 'galaxy-boy', takes: true }).buster;
const hero = (buster = BUSTER) => ({ id: 'hero', pilotable: true, rule: { type: 'platform', eye: 0, collideRadius: 0.3, collideHeight: 1.7, step: 0.3, buster }, transform: { pos: [0, 0, 0], heading: 0 } });
// (a person's body, as a foe stands: its egg, so a round at the chest meets it)
const foe = (x, hp = 100) => ({ id: 'foe', team: 'foes', rule: { type: 'static' }, body: { type: 'mesh', hittable: true, hp, egg: { a: 0.35, c: 0.9, cz: 0.9 } }, transform: { pos: [x, 0, 0], heading: Math.PI } });
const world = (...es) => E.createWorld({ entities: es, pilot: 'hero' });
const step = (st, fire, n = 1) => { for (let i = 0; i < n; i++) E.stepWorld(st, { fire: fire ? 1 : 0 }, DT, { ground: () => 0 }); return st; };
const rounds = (st, lv) => (st.projectiles || []).filter((p) => p.owner === 'hero' && (lv === undefined || p.busterLv === lv));

describe('the buster', () => {
  it('is the run and gun\'s, lowered from its card: a tap and its charge levels', () => {
    expect(BUSTER.max).toBe(3);
    expect(BUSTER.levels.length).toBeGreaterThanOrEqual(2);
    expect(BUSTER.levels[1].damage).toBeGreaterThan(BUSTER.levels[0].damage);
    expect(BUSTER.levels[0].damage).toBeGreaterThan(BUSTER.tap.damage);
  });
  it('a press fires a tap shot at once, straight along the facing; no more than its cap fly', () => {
    const st = world(hero());
    step(st, true);
    expect(rounds(st, 0)).toHaveLength(1);
    const r = rounds(st, 0)[0];
    expect(r.vel[1]).toBe(0); expect(r.vel[2]).toBe(0); expect(r.vel[0]).toBeGreaterThan(0);
    for (let k = 0; k < 5; k++) { step(st, false); step(st, true); }
    expect(rounds(st, 0)).toHaveLength(3);
  });
  it('held, the charge builds; let go, the highest level reached fires; a short hold fires no charge', () => {
    const st = world(hero());
    step(st, true);                                                  // the tap
    step(st, true, Math.ceil(BUSTER.levels[0].at / DT) + 2);          // past the first level
    expect(st.byId.hero.charging).toBe(true);
    expect(st.byId.hero.chargeLevel).toBe(1);
    step(st, false);
    expect(rounds(st, 1)).toHaveLength(1);
    const full = world(hero());
    step(full, true, Math.ceil(BUSTER.levels.at(-1).at / DT) + 2);
    expect(full.byId.hero.chargeFrac).toBe(1);
    step(full, false);
    expect(rounds(full, BUSTER.levels.length)).toHaveLength(1);
    const short = world(hero());
    step(short, true, 3); step(short, false);
    expect(rounds(short).filter((p) => p.busterLv > 0)).toHaveLength(0);
  });
  it('the release is the beat (the action lab\'s law): let go a level\'s frames after the press, that level fires on that frame; a frame sooner it fizzles', () => {
    const L0 = Math.round(BUSTER.levels[0].at / DT);
    const on = world(hero()); step(on, true, L0); step(on, false);
    expect(rounds(on, 1)).toHaveLength(1);
    const soon = world(hero()); step(soon, true, L0 - 1); step(soon, false);
    expect(rounds(soon).filter((p) => p.busterLv > 0)).toHaveLength(0);
  });
  it('from its MUZZLE where it has one: the cannon arm\'s end, ahead, up and on the right of the facing, whichever way it faces', () => {
    const M = { right: 0.12, up: 0.72, ahead: 0.38 }, H = 1.7;
    for (const heading of [Math.PI / 2, -Math.PI / 2]) {
      const st = world({ ...hero({ ...BUSTER, muzzle: M }), transform: { pos: [0, 0, 0], heading } });
      step(st, true);
      const p = rounds(st)[0], f = E.fwdXY(heading), from = st.byId.hero.lastShot.from, right = [f[1], -f[0]];
      // (ahead along the facing by the arm and the round, up at the shoulder, to the right of the facing by the shoulder)
      expect(from[0] * f[0] + from[1] * f[1]).toBeCloseTo(M.ahead * H + BUSTER.tap.size, 6);
      expect(from[2]).toBeCloseTo(M.up * H, 6);
      expect(from[0] * right[0] + from[1] * right[1]).toBeCloseTo(M.right * H, 6);
      expect(p.vel[0] * f[0] + p.vel[1] * f[1]).toBeGreaterThan(0);
    }
    // (a move's own muzzle where the body plays it: a dash's, lower and further ahead)
    const D = { right: 0.12, up: 0.58, ahead: 0.5 }, st = world(hero({ ...BUSTER, muzzle: { ...M, moves: { dash: D } } }));
    st.byId.hero.locomotion = 'dash';
    step(st, true);
    expect(st.byId.hero.lastShot.from[2]).toBeCloseTo(D.up * H, 6);
  });
  it('a body in its line takes the round\'s damage', () => {
    const st = world(hero(), foe(3));
    step(st, true); step(st, false, 30);
    expect(st.byId.foe.body.hp).toBeCloseTo(100 - BUSTER.tap.damage, 6);
  });
  it('its hitbox is its own: the regular rounds tinier than they look, the full charge tall', () => {
    const full = BUSTER.levels[BUSTER.levels.length - 1];
    expect(BUSTER.tap.hit.r).toBeLessThan(BUSTER.tap.size);
    expect(BUSTER.tap.hit.tall).toBeUndefined();
    expect(full.hit.tall).toBeGreaterThan(full.hit.r);
    // (a crawler under the line, its egg below the muzzle: the tap passes over it, the full charge meets it)
    const crawler = (x) => ({ id: 'foe', team: 'foes', rule: { type: 'static' }, body: { type: 'mesh', hittable: true, hp: 100, egg: { a: 0.3, c: 0.25, cz: 0.25 } }, transform: { pos: [x, 0, 0], heading: Math.PI } });
    const tap = world(hero(), crawler(3)); step(tap, true); step(tap, false, 40);
    expect(tap.byId.foe.body.hp).toBe(100);
    const L = Math.round(full.at / DT) + 2, charged = world(hero(), crawler(4)); step(charged, true, L); step(charged, false, 40);
    expect(charged.byId.foe.body.hp).toBeCloseTo(100 - full.damage, 6);
    // (and the tall round bursts at the height it met the crawler, not over its head)
    const b = charged.bursts[charged.bursts.length - 1];
    expect(b.pos[2]).toBeLessThan(1.7 * BUSTER.chest - 0.2);
  });
  it('every round reaches LOW: a walker at the hero\'s knee, under the muzzle\'s line, falls to a tap', () => {
    // (a walker a game's size, 0.6 of the hero's height: its egg tops out under the muzzle, over the low reach)
    expect(BUSTER.low).toBeGreaterThan(0); expect(BUSTER.low).toBeLessThan(BUSTER.chest);
    const walker = (x) => ({ id: 'foe', team: 'foes', rule: { type: 'static' }, body: { type: 'mesh', hittable: true, hp: 100, egg: { a: 0.3, c: 0.5, cz: 0.5 } }, transform: { pos: [x, 0, 0], heading: Math.PI } });
    const tap = world(hero(), walker(3)); step(tap, true); step(tap, false, 40);
    expect(tap.byId.foe.body.hp).toBeCloseTo(100 - BUSTER.tap.damage, 6);
    // (and none without its low reach: the tap sails over, as it did)
    const high = world(hero({ ...BUSTER, low: 0 }), walker(3)); step(high, true); step(high, false, 40);
    expect(high.byId.foe.body.hp).toBe(100);
  });
  it('is emitted only into a page with a body that carries it', () => {
    expect(emissionSource()).not.toContain('stepWithBuster');
    expect(controllableChannelScript([foe(3)], null, {})).not.toContain('stepWithBuster');
    const page = controllableChannelScript([hero(), foe(3)], null, {});
    expect(page).toContain('stepWithBuster');
    expect(page).toContain('p.pellet');
    // (the arm cannon's swap: the hand for the cannon while the buster is out, on a page with a buster alone)
    expect(page).toContain('__busterSwap');
    // (and the charge's energy at the muzzle: its bloom, its sparks drawn in, a burst a level)
    expect(page).toContain('__chargeFx');
    expect(controllableChannelScript([foe(3)], null, {})).not.toContain('__chargeFx');
    expect(controllableChannelScript([foe(3)], null, {})).not.toContain('__busterSwap');
  });
});
