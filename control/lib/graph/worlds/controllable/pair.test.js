// A pair's laws (pair.js): two foes, each its own bar, sharing a fate by rows: one covers the other reeling; one whose
// partner falls enrages, or (revive) neither dies while the other stands, felled and up at half, until both are felled
// together; one under its share swaps out and comes back; emitted only into a page whose world has a pair.
import { describe, it, expect } from 'vitest';
import { composeLive, emissionSource } from './compose.js';
import { controllableChannelScript } from '../../scene/channels/controllable/index.js';

const E = composeLive();
const DT = 1 / 30;
const run = (st, s) => { for (let i = 0; i < Math.max(1, Math.round(s / DT)); i++) E.stepWorld(st, {}, DT, { ground: () => 0 }); return st; };
const foe = (id, pos, pair) => ({ id, team: 'foes', rule: { type: 'ai', speed: 3, mind: { motivation: 'hunt', aggressiveness: 'bold' }, pair }, body: { type: 'figure-rig', figure: id, hittable: true, hp: 20, poise: 2, vanish: { is: 'motes', linger: 2.4 } }, transform: { pos, heading: Math.PI } });
function world(rows) {
  return E.createWorld({ entities: [
    { id: 'hero', pilotable: true, rule: { type: 'platform' }, body: { hittable: true, hp: 100 }, transform: { pos: [12, 0, 0], heading: Math.PI } },
    foe('a', [0, 0, 0], { with: 'b', ...rows }), foe('b', [0, 2.5, 0], { with: 'a', ...rows }),
  ] });
}
const blow = (st, id) => { const x = st.byId[id]; x.body.hp = 0; x.lastHitBy = 'hero'; E.armReaction(x, 'topple', true); };

describe('a pair', () => {
  it('covers its partner while it reels, then goes back to its own mind', () => {
    const st = run(world({ cover: true, down: 'enrage' }), DT);
    Object.assign(st.byId.b, { staggerT: 0, reactClip: 'stagger', reactDur: 1 });
    run(st, DT);
    expect(st.byId.a.rule).toMatchObject({ mind: { motivation: 'escort' }, escort: 'b' });
    run(st, 1.5);
    expect(st.byId.a.rule.mind.motivation).toBe('hunt');
    expect(st.byId.a.rule.escort).toBeUndefined();
  });

  it('one whose partner falls enrages: relentless, quicker, powered up', () => {
    const st = run(world({ cover: true, down: 'enrage' }), DT);
    Object.assign(st.byId.b, { downed: true }); st.byId.b.body.hp = 0;
    run(st, DT);
    expect(st.byId.a.rule.mind.aggressiveness).toBe('relentless');
    expect(st.byId.a.rule.speed).toBeCloseTo(3.9, 6);
    expect(st.byId.a.statuses['power-up']).toBeTruthy();
  });

  it('revive: neither dies while the other stands; felled, it gets up at half; felled together, both fall once', () => {
    const st = run(world({ cover: false, down: 'revive' }), DT);
    blow(st, 'a');
    run(st, DT);
    expect(st.byId.a.downed).toBeFalsy();
    expect(st.byId.a.pairFelled).toBe(true);
    expect(st.byId.a.body.hp).toBe(10);
    run(st, 7);   // (the knockdown: its fall, its lying, its getting up)
    expect(st.byId.a.pairFelled).toBe(false);   // (up again)
    // felled together: the second felled while the first lies
    blow(st, 'a'); run(st, DT); blow(st, 'b'); run(st, DT);
    expect([st.byId.a.downed, st.byId.b.downed]).toEqual([true, true]);
  });

  it('under its share it swaps out while its partner stands, and comes back as hurt as it left', () => {
    const st = run(world({ cover: false, down: 'enrage', swap: 0.5, back: 1 }), DT);
    st.byId.a.body.hp = 8;
    run(st, DT);
    expect(st.byId.a.dormant).toBe(true);
    expect(st.byId.a.transit).toMatchObject({ is: 'smoke', dir: 'out' });
    run(st, 1.2);
    expect(st.byId.a.dormant).toBe(false);
    expect(st.byId.a.body.hp).toBe(8);
  });

  it('is emitted only into a page whose world has a pair', () => {
    expect(emissionSource({ pair: true })).toContain('stepWithPairs');
    expect(emissionSource({})).not.toContain('stepWithPairs');
    expect(controllableChannelScript([foe('a', [0, 0, 0])].map((e) => ({ ...e, rule: { ...e.rule, pair: undefined } })), null, {}, {})).not.toContain('stepWithPairs');
    expect(controllableChannelScript([foe('a', [0, 0, 0], { with: 'b' })], null, {}, {})).toContain('stepWithPairs');
  });
});
