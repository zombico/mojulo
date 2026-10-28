// A summoner's laws (summon.js): it calls its sleeping summons a few at a time once a hero is near, on a wind-up a blow
// breaks; reeling, its bound summons go slack; down, their strings are cut (destroyed where they stand) and the uncalled
// are dropped, while an unbound one fights on; emitted only into a page whose world has a summoner.
import { describe, it, expect } from 'vitest';
import { composeLive, emissionSource } from './compose.js';
import { controllableChannelScript } from '../../scene/channels/controllable/index.js';

const E = composeLive();
const DT = 1 / 30;
const run = (st, s) => { for (let i = 0; i < Math.round(s / DT); i++) E.stepWorld(st, {}, DT, { ground: () => 0 }); return st; };
const SUMMON = { at: 2, every: 1, wind: 0.5, radius: 10, ring: 1.5, with: 'smoke' };
const foe = (id, pos, more = {}) => ({ id, team: 'foes', rule: { type: 'ai', mind: { motivation: 'sentry', aggressiveness: 'wary' }, ...(more.rule || {}) }, body: { type: 'figure-rig', figure: id, hittable: true, hp: 20, poise: 2, vanish: { is: 'motes', linger: 2.4 } }, transform: { pos, heading: Math.PI }, ...(more.dormant ? { dormant: true } : {}) });
function world({ bound = true, n = 3, hero = [5, 0, 0] } = {}) {
  const ids = Array.from({ length: n }, (_, k) => `m-s${k + 1}`);
  return E.createWorld({ entities: [
    { id: 'hero', pilotable: true, rule: { type: 'platform' }, body: { hittable: true, hp: 100 }, transform: { pos: hero, heading: Math.PI } },
    foe('m', [0, 0, 0], { rule: { summon: { ids, ...SUMMON } } }),
    ...ids.map((id) => foe(id, [0, 0, 0], { dormant: true, rule: { summoned: { by: 'm', bound } } })),
  ] });
}
const awake = (st) => ['m-s1', 'm-s2', 'm-s3'].filter((id) => st.byId[id] && !st.byId[id].dormant && !st.byId[id].gone);

describe('the call', () => {
  it('calls none while no hero is near, then a few at a time, each on its wind-up, never more than its cap', () => {
    const far = world({ hero: [40, 0, 0] });
    run(far, 3);
    expect(awake(far)).toEqual([]);
    const st = world();
    run(st, 1.2);
    expect(st.byId.m.summonWind).toBeGreaterThan(0);   // (winding up: held)
    expect(awake(st)).toEqual([]);
    run(st, 0.4);
    expect(awake(st)).toEqual(['m-s1']);
    expect(st.byId['m-s1'].transit).toMatchObject({ is: 'smoke', dir: 'in' });
    run(st, 4);
    expect(awake(st)).toEqual(['m-s1', 'm-s2']);   // (its cap: two up at once)
  });

  it('a blow breaks the wind-up', () => {
    const st = world();
    run(st, 1.2);
    st.byId.m.staggerT = 0; st.byId.m.reactClip = 'stagger'; st.byId.m.reactDur = 1;
    run(st, 0.4);
    expect(awake(st)).toEqual([]);
  });
});

describe('the strings', () => {
  it('a reeling summoner\'s bound summons stand slack until it recovers', () => {
    const st = run(world(), 1.8);
    st.byId.m.staggerT = 0; st.byId.m.reactClip = 'stagger'; st.byId.m.reactDur = 1.3;
    run(st, 1 / 30);
    expect(st.byId['m-s1'].summonSlack).toBe(true);
    run(st, 2);
    expect(st.byId['m-s1'].summonSlack).toBe(false);
  });

  it('its fall cuts the bound ones up (destroyed where they stand) and drops the uncalled', () => {
    const st = run(world(), 1.8);
    st.byId.m.body.hp = 0; st.byId.m.downed = true;
    run(st, 0.2);
    const s1 = st.byId['m-s1'];
    expect(s1.downed).toBe(true);
    expect(s1.wreck).toMatchObject({ die: 'dismantle', sever: 'all' });
    expect(st.byId['m-s3']).toMatchObject({ downed: true, dormant: true });
    expect(st.byId['m-s3'].wreck).toBeUndefined();
  });

  it('an unbound summons fights on, its uncalled kin dropped all the same', () => {
    const st = run(world({ bound: false }), 1.8);
    st.byId.m.body.hp = 0; st.byId.m.downed = true;
    run(st, 0.2);
    expect(st.byId['m-s1'].downed).toBeFalsy();
    expect(st.byId['m-s3'].downed).toBe(true);
  });
});

describe('absent, nothing', () => {
  it('is emitted only into a page whose world has a summoner', () => {
    expect(emissionSource({ summon: true })).toContain('stepWithSummons');
    expect(emissionSource({})).not.toContain('stepWithSummons');
    const page = (ents) => controllableChannelScript(ents, null, {}, {});
    expect(page([foe('a', [0, 0, 0])])).not.toContain('stepWithSummons');
    expect(page([foe('a', [0, 0, 0], { rule: { summon: { ids: [], ...SUMMON } } })])).toContain('stepWithSummons');
  });
});
