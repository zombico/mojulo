import { describe, expect, it } from 'vitest';
import { composeLive } from './compose.js';
import { readBeam, beamLanding } from '../../playscape/elements/beams.js';

// A POWER'S ATTACK (cast.js beam `to: { nearest }`, `hurt`): fired at the nearest standing foe in front of the caster,
// within its reach, it takes its hp when it lands, as a blow does; with none in front it flies straight ahead at nothing.

const E = composeLive();
const hooks = { ground: () => 0 };
const PERSON = { a: 0.35, c: 0.9, cz: 0.9 };
const at = (id, pos, extra = {}) => ({ id, rule: { type: 'walk', speed: 0, eye: 0 }, body: { type: 'mesh', hittable: true, hp: 20, egg: { ...PERSON } }, transform: { pos, heading: 0, pitch: 0 }, ...extra });
const foe = (id, pos) => at(id, pos, { rule: { type: 'ai', speed: 0, eye: 0 } });
const spec = readBeam('orb', 'beam');
const fire = (w, hurt, nearest = { range: 30, cone: 0.7 }) => E.castOps(w, [{ op: 'beam', who: 'hero', to: { nearest }, spec, land: beamLanding(spec), hurt }]);
// the world run on until the beam has landed, its facts read each step as the page reads them
const until = (w, s = 3) => { let prev = E.castFacts(w, null).prev, events = []; for (let k = 0; k < s * 30; k++) { E.stepWorld(w, {}, 1 / 30, hooks); const r = E.castFacts(w, prev); prev = r.prev; events = events.concat(r.events); } return events; };

describe('a power\'s attack finds the nearest foe in front and lands on it', () => {
  it('the nearest foe in front within reach takes the hurt as it lands, never one behind, aside or beyond', () => {
    const w = E.createWorld({ entities: [at('hero', [0, 0, 0], { pilotable: true }), foe('near', [8, 1, 0]), foe('aside', [3, 6, 0]), foe('behind', [-4, 0, 0]), foe('far', [50, 0, 0]), at('ally', [4, 0, 0], { pilotable: true })] });
    fire(w, 7);
    const M = w.moments.find((m) => m.is === 'beam');
    expect(M.target).toBe('near');
    const ev = until(w);
    expect(w.byId.near.body.hp).toBe(13);
    expect(w.byId.near.lastHitBy).toBe('hero');
    expect(ev.some((e) => e.type === 'struck' && e.entity === 'near')).toBe(true);
    expect(ev.some((e) => e.type === 'hit:near')).toBe(true);
    for (const id of ['aside', 'behind', 'far', 'ally']) expect(w.byId[id].body.hp, id).toBe(20);
  });

  it('a blow that takes the last hp downs it; with no foe in front the beam flies on at nothing', () => {
    const w = E.createWorld({ entities: [at('hero', [0, 0, 0], { pilotable: true }), foe('near', [6, 0, 0])] });
    fire(w, 25);
    const ev = until(w);
    expect(w.byId.near.downed).toBe(true);
    expect(ev.some((e) => e.type === 'down' && e.entity === 'near')).toBe(true);
    const v = E.createWorld({ entities: [at('hero', [0, 0, 0], { pilotable: true }), foe('behind', [-6, 0, 0])] });
    fire(v, 25, { range: 12 });
    const M = v.moments.find((m) => m.is === 'beam');
    expect(M.target).toBeUndefined();
    expect(M.to[0]).toBeCloseTo(12, 5);
    until(v);
    expect(v.byId.behind.body.hp).toBe(20);
  });

  it('a beam without hurt lands as it always did: struck, no hp taken', () => {
    const w = E.createWorld({ entities: [at('hero', [0, 0, 0], { pilotable: true }), foe('near', [6, 0, 0])] });
    E.castOps(w, [{ op: 'beam', who: 'hero', to: 'near', spec, land: beamLanding(spec) }]);
    const ev = until(w);
    expect(ev.some((e) => e.type === 'struck')).toBe(true);
    expect(w.byId.near.body.hp).toBe(20);
  });
});
