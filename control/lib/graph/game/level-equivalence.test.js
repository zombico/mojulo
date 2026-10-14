// The level-equivalence harness's web half (level-equivalence.js): the page's ground over a level's faces, a win
// script steered toward the contract's audits and recorded as input, the stay-put control, a canonical key a frame,
// and the comparison that names the first frame and field two engines part on. The Godot half runs in the Godot tier
// (level-equivalence.godot.test.js).
import { describe, it, expect } from 'vitest';
import { faceGround, levelSim, keyEntities, frameKey, winScript, playScript, outcomeIn, compareKeys, auditPath, POS_Q } from './level-equivalence.js';
import { composeMechanics } from './mechanics.js';

const quad = (x0, y0, x1, y1, z) => ({ corners: [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]] });
function level({ heading = 0, eye = 1.7 } = {}) {
  const m = composeMechanics([{ kind: 'reach-exit', at: [12, 4, 0], radius: 1.5 }], { player: 'hero', spawn: [0, 0, 0] });
  return {
    faces: [quad(-20, -20, 0, 20, 0), quad(0, -20, 20, 20, 0.5)],
    entities: [{ id: 'hero', pilotable: true, rule: { type: 'walk', speed: 4, eye }, transform: { pos: [0, 0, eye], heading } }, { id: 'lamp', rule: { type: 'clock', rate: 0 }, transform: { pos: [3, 3, 0], heading: 0 } }],
    events: m.events,
    game: { on: m.on, audits: m.audits },
  };
}

describe('the level-equivalence harness, web half', () => {
  it('stands the walker on the page\'s ground: the nearest face straight below, none where there is none', () => {
    const g = faceGround(level().faces);
    expect(g([5, 0, 3])).toBe(0.5);
    expect(g([-5, 0, 3])).toBe(0);
    expect(g([5, 0, 0.2])).toBe(null);   // below the step: the face is above it
    expect(g([50, 0, 3])).toBe(null);
  });

  it('a win script reaches the goal\'s own anchor and is recorded as input; the stay-put control ends nothing', () => {
    const p = level({ heading: Math.PI / 2 });
    expect(auditPath(p.game)).toEqual({ points: [[12, 4, 0]], idle: 0 });
    const win = winScript(p, { seconds: 20 });
    expect(win.outcome).toBe('success');
    expect(win.frames.length).toBe(win.at + 1);
    expect(win.frames.some((f) => f.turn) && win.frames.some((f) => f.forward)).toBe(true);
    const control = playScript(p, win.frames.map(() => ({})));
    expect(control.outcome).toBe(null);
    // the same input played again is the same run, key for key
    const again = playScript(p, win.frames);
    expect(compareKeys(win.keys, again.keys)).toEqual({ equal: true, frames: win.keys.length, first: null });
    expect(again.outcome).toBe('success');
  });

  it('keys the bus whole and the pilot first, its feet in quanta, then every ruled entity', () => {
    const p = level();
    expect(keyEntities(p)).toEqual(['hero', 'lamp']);
    const sim = levelSim(p), key = frameKey(sim, keyEntities(p));
    const [bus, hero, lamp] = key.split('|');
    expect(JSON.parse(bus)).toMatchObject({ vars: {}, log: expect.any(Array) });
    expect(hero).toBe(`hero:0,0,${Math.floor(0 / POS_Q + 0.5)},0`);   // the eye taken off: its feet on the ground
    expect(lamp).toBe('lamp:60,60,0,0');
  });

  it('names the first frame two runs part on, and the field', () => {
    const a = ['{}|hero:1,2,3,0', '{}|hero:1,3,3,0', '{}|hero:1,4,3,0'];
    expect(compareKeys(a, a)).toMatchObject({ equal: true });
    expect(compareKeys(a, [a[0], '{}|hero:1,9,3,0', a[2]]).first).toEqual({ frame: 1, field: 'hero', web: 'hero:1,3,3,0', godot: 'hero:1,9,3,0' });
    expect(compareKeys(a, ['{"x":1}|hero:1,2,3,0']).first.field).toBe('bus');
    expect(compareKeys(a, a.slice(0, 2)).equal).toBe(false);   // a run cut short is not equal
  });

  it('hears the level end as the page\'s game channel does: the contract\'s on over the log\'s delta', () => {
    const c = { on: { 'goal:*': { end: 'success' }, 'spotted': { end: 'fail' }, 'pickup:coin': { emit: { type: 'grant' } } } };
    expect(outcomeIn(c, [{ type: 'pickup:coin' }, { type: 'goal:reached' }])).toBe('success');
    expect(outcomeIn(c, [{ type: 'spotted' }], 0)).toBe('fail');
    expect(outcomeIn(c, [{ type: 'spotted' }], 1)).toBe(null);
  });
});

// THE JS TWIN'S KNOWN BUGS, found by the Godot round's corpus. The Godot kernel matches the web here (it is the truth
// the port is held to); each is pinned with it.fails, green while the bug stands and red the day it is fixed, so the
// fix also moves the kernel and this note.
describe('the JS twin: known bugs', () => {
  it.fails('a collect pickup counts once: walking back over a coin already taken does not take it again', async () => {
    const { simLevel } = await import('./level-sim.js');
    const m = composeMechanics([{ kind: 'collect', into: 'bag', pickups: [{ item: 'coin', at: [3, 0, 0] }] }, { kind: 'reach-exit', at: [50, 0, 0] }], { storeSchema: { slices: [{ name: 'bag', kind: 'inventory' }] }, player: 'hero' });
    const sim = simLevel({ entities: [{ id: 'hero', pilotable: true, rule: { type: 'walk' }, transform: { pos: [0, 0, 0], heading: 0 } }], events: m.events });
    const H = sim.world.byId.hero;
    for (const x of [3, 0, 3]) { H.transform.pos = [x, 0, 0]; sim.run(0.2); }
    // today: 2 (the zone fires on every entry; its toggle hides the coin but guards nothing)
    expect(sim.bus.vars['held:bag:coin']).toBe(1);
  });
});
