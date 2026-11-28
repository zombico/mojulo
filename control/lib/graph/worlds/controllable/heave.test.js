// What a mover lifts (heave.js): a couch wider than the doorway it goes through, lifted whole by the hero, carried in its
// hands with its box out of the world's colliders, so the doorway's jambs never stop it; set down, its box is back where
// it was put; carried into the drop zone (the truck at the door), it is loaded and gone. The bus hears each. A world with
// nothing to lift keeps no state of it.
import { describe, it, expect } from 'vitest';
import { composeLive } from './compose.js';

const CW = composeLive();
// (a couch 2 m long across the hero's way, 1.4 m ahead; a wall at x = −3 with a doorway 0.9 m wide; the truck beyond it)
const COUCH = { id: 'living/couch', min: [1.4, -1, 0], max: [2.3, 1, 0.85], name: 'couch' };
const JAMBS = [{ min: [-3.2, -6, 0], max: [-2.8, -0.45, 2.4] }, { min: [-3.2, 0.45, 0], max: [-2.8, 6, 2.4] }];
const DROP = { at: [-6, 0, 0], half: [1.2, 1.2] };
const hero = () => ({ id: 'hero', pilotable: true, rule: { type: 'platform', speed: 4, collideRadius: 0.3 }, transform: { pos: [0, 0, 0], heading: 0 }, body: { type: 'mesh', shape: 'box', size: [0.6, 0.6, 1.7] } });
const world = (heave = { pieces: [COUCH], drop: DROP }) => CW.createWorld({ entities: [hero()], colliders: [{ min: [...COUCH.min], max: [...COUCH.max] }, ...JAMBS.map((c) => ({ min: [...c.min], max: [...c.max] }))], ...(heave ? { heave } : {}) });
const hooks = { ground: () => 0 };
function run(w, frames, input) {
  let prev = CW.castFacts(w, undefined).prev; const events = [];
  for (let i = 0; i < frames; i++) { CW.stepWorld(w, typeof input === 'function' ? input(i, w) : input, 1 / 60, hooks); const f = CW.castFacts(w, prev); prev = f.prev; events.push(...f.events); }
  return events;
}
const blocks = (w, P) => (w.colliders || []).some((c) => c.min[0] === P.min[0] && c.max[1] === P.max[1]);
const face = (w, a) => { w.byId.hero.transform.heading = a; };

describe('a piece a mover lifts', () => {
  it('is taken up by the action when the hero faces it, its box out of the world while it is held', () => {
    const w = world(), P = w.heave.pieces[0];
    expect(CW.heaveTarget(w, w.byId.hero)).toBe(P);
    const ev = run(w, 2, (i) => ({ act: i === 0 }));
    expect(w.heave.held).toBe(COUCH.id);
    expect(blocks(w, COUCH)).toBe(false);
    expect(ev.map((e) => e.type)).toContain('heave:lift');
    // (in the hands: its underside at the hands' height, ahead of the hero)
    expect(P.min[2]).toBeCloseTo(w.heave.hold.up, 2);
    expect(P.min[0]).toBeGreaterThan(w.byId.hero.transform.pos[0]);
  });

  it('goes through a doorway narrower than it is, and is loaded when carried into the drop zone', () => {
    const w = world();
    run(w, 2, (i) => ({ act: i === 0 }));
    face(w, Math.PI);
    const ev = run(w, 60 * 6, { forward: 1 });
    // (the hero walked out through the 0.9 m doorway with a 2 m couch, and the couch is on the truck)
    expect(w.byId.hero.transform.pos[0]).toBeLessThan(-4.8);
    expect(w.heave.pieces[0].loaded).toBe(true);
    expect(w.heave.held).toBe(null);
    expect(ev.find((e) => e.type === 'heave:load')).toMatchObject({ piece: COUCH.id, n: 1 });
  });

  it('is set down by the action again: on the ground before the hero, its box back in the world there', () => {
    const w = world(), P = w.heave.pieces[0];
    run(w, 2, (i) => ({ act: i === 0 }));
    face(w, Math.PI / 2);
    const ev = run(w, 3, (i) => ({ act: i === 1 }));
    expect(w.heave.held).toBe(null);
    expect(P.min[2]).toBe(0);
    expect(P.min[1]).toBeGreaterThan(w.byId.hero.transform.pos[1]);
    expect((w.colliders || []).some((c) => c.min[1] === P.min[1] && c.max[0] === P.max[0])).toBe(true);
    expect(ev.map((e) => e.type)).toContain('heave:set');
  });

  it('reaches a piece on the floor a walker stands on, whose position is its eye (a stage\'s first-person walker)', () => {
    const up = { id: 'up/couch', min: [1.4, -1, 4.2], max: [2.3, 1, 5.05] }, walker = { ...hero(), rule: { type: 'walk', speed: 4, eye: 1.7, collideRadius: 0.3 }, transform: { pos: [0, 0, 5.9], heading: 0 } };
    const w = CW.createWorld({ entities: [walker], colliders: [{ min: [...up.min], max: [...up.max] }], heave: { pieces: [up] } });
    expect(CW.heaveTarget(w, w.byId.hero)?.id).toBe(up.id);
    CW.stepWorld(w, { act: 1 }, 1 / 60, { ground: () => 4.2 });
    expect(w.heave.held).toBe(up.id);
    expect(w.heave.pieces[0].min[2]).toBeCloseTo(4.2 + w.heave.hold.up, 1);
  });

  it('is out of reach across the room or a storey up; a world with nothing to lift keeps no state of it', () => {
    const far = { ...COUCH, id: 'far', min: [6, -1, 0], max: [7, 1, 0.8] }, up = { ...COUCH, id: 'up', min: [1.4, -1, 3], max: [2.3, 1, 3.8] };
    const w = CW.createWorld({ entities: [hero()], colliders: [], heave: { pieces: [far, up] } });
    expect(CW.heaveTarget(w, w.byId.hero)).toBe(null);
    const none = world(null);
    run(none, 3, (i) => ({ act: i === 0 }));
    expect(none.heave).toBeUndefined();
  });
});
