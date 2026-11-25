import { describe, it, expect } from 'vitest';
import { composeLive, emissionSource } from './compose.js';
import { readChase, CHASE } from './chase-line.js';
import { readPrompts } from './prompt.js';

// THE CHASE LINE: a set piece's way, which holds the pilot while it runs it; the stick read along the line, never the
// camera, so a directed camera can turn round without the controls turning with it
const CW = composeLive();
const DT = 1 / 60;
const FLAT = { ground: () => 0 };
// a camera that faces wherever it likes: each frame a quarter turn more, standing off to one side
CW.RULES.__spinCam = (e) => { e.camYaw = (e.camYaw || 0) + Math.PI / 2; e.transform.pos = [0, -20, 5]; };
// an L: 20 m east, then 20 m north
const L = { id: 'roofs', path: [[0, 0], [20, 0], [20, 20]], half: 2 };
const world = (camera, chase = { lines: [L] }) => {
  const w = CW.createWorld({ entities: [{ id: 'h', pilotable: true, rule: { type: 'platform', eye: 0, speed: 6 }, transform: { pos: [0.5, 0, 0], heading: 0 } }], camera, ...(chase ? { chase } : {}) });
  w.pilotId = 'h';
  return w;
};
const run = (w, input, n) => { for (let i = 0; i < n; i++) CW.stepWorld(w, input, DT, FLAT); return w; };

describe('the chase line', () => {
  it('absent adds nothing: no state, no emitted source', () => {
    expect(world({ rule: 'follow', target: 'h' }, null)).not.toHaveProperty('chase');
    expect(emissionSource({})).not.toContain('stepWithChase');
    expect(emissionSource({ chase: true })).toContain('stepWithChase');
  });

  it('reads the stick along the line whatever the camera does: the same run under a spinning camera as under a follow', () => {
    const follow = run(world({ rule: 'follow', target: 'h' }), { forward: 1, strafe: 0 }, 240);
    const spun = run(world({ rule: '__spinCam' }), { forward: 1, strafe: 0 }, 240);
    expect(follow.chase.s).toBeGreaterThan(20);                        // round the corner
    expect(spun.chase.s).toBeCloseTo(follow.chase.s, 6);
    expect(spun.byId.h.transform.pos[0]).toBeCloseTo(follow.byId.h.transform.pos[0], 6);
    expect(spun.byId.h.transform.pos[1]).toBeCloseTo(follow.byId.h.transform.pos[1], 6);
    expect(spun.byId.h.transform.pos[1]).toBeGreaterThan(1);           // north, up the second leg
  });

  it('holds the body inside its corridor, free across it', () => {
    const w = run(world({ rule: '__spinCam' }), { forward: 0.3, strafe: 1 }, 180);
    expect(Math.abs(w.chase.offset)).toBeLessThanOrEqual(L.half + 1e-9);
    expect(Math.abs(w.chase.offset)).toBeGreaterThan(L.half - 0.05);   // pressed against the wall
  });

  it('ends at its end, gives the body its own rule back, and the bus hears the start and the end', () => {
    const w = world({ rule: 'follow', target: 'h' });
    const events = [];
    let prev = null;
    for (let i = 0; i < 600 && !w.chase.done.length; i++) {
      CW.stepWorld(w, { forward: 1, strafe: 0 }, DT, FLAT);
      const f = CW.castFacts(w, prev); prev = f.prev; events.push(...f.events.filter((x) => x.type.startsWith('chase:')).map((x) => x.type));
    }
    expect(w.chase.on).toBeNull();
    expect(w.chase.done).toEqual(['roofs']);
    expect(w.byId.h.rule.move).toBeUndefined();
    expect(events).toEqual(['chase:roofs:start', 'chase:roofs:end']);
  });

  it('a cued line waits for its name', () => {
    const w = run(world({ rule: 'follow', target: 'h' }, { lines: [{ ...L, when: 'cue' }] }), { forward: 0 }, 5);
    expect(w.chase.on).toBeNull();
    expect(CW.chaseStart(w, 'roofs')).toBe(true);
    run(w, { forward: 1, strafe: 0 }, 2);
    expect(w.chase.on).toBe('roofs');
    expect(w.byId.h.rule.move).toBe('camera');
    expect(CW.chaseEnd(w, 'roofs')).toBe(true);
    expect(w.byId.h.rule.move).toBeUndefined();
  });

  it('is deterministic', () => {
    const trace = () => { const w = world({ rule: '__spinCam' }); const out = []; for (let i = 0; i < 120; i++) { CW.stepWorld(w, { forward: 1, strafe: Math.sin(i / 9) }, DT, FLAT); out.push(w.chase.s, w.chase.offset); } return out; };
    expect(trace()).toEqual(trace());
  });
});

describe('a world\'s chase lines, read', () => {
  it('takes lines with ids and paths, and teaches on what it does not take', () => {
    expect(readChase({ lines: [L] })).toEqual({ lines: [L] });
    expect(readChase([{ id: 'a', path: [[0, 0], [1, 0]], when: 'cue' }])).toEqual({ lines: [{ id: 'a', path: [[0, 0], [1, 0]], when: 'cue' }] });
    expect(readChase(null)).toBeNull();
    expect(() => readChase({ lines: [] })).toThrow(/lines/);
    expect(() => readChase([{ id: 'a', path: [[0, 0]] }])).toThrow(/a path of 2/);
    expect(() => readChase([L, L])).toThrow(/twice/);
    expect(() => readChase([{ ...L, half: 0 }])).toThrow(/half/);
    expect(() => readChase([{ ...L, when: 'soon' }])).toThrow(/when is/);
    expect(() => readChase(Array.from({ length: CHASE.maxLines + 1 }, (_, i) => ({ ...L, id: 'l' + i })))).toThrow(/at most/);
  });
});

// THE TRACK CAMERA: directed by where the target is along the line, the stick still the line's
describe('the track camera', () => {
  const keys = [{ s: 0, frame: 'chase' }, { s: 8, frame: 'lead' }, { s: 22, frame: 'profile', cut: true }];
  const cam = { rule: 'track', target: 'h', path: L.path, keys };
  // is the target inside a frame of `half` degrees either side of the camera's look, and in front of it
  const framed = (w, half = 28) => {
    const c = w.camera, p = w.byId.h.transform.pos, look = c.lookAt, cp = c.transform.pos;
    const lx = look[0] - cp[0], ly = look[1] - cp[1], lz = look[2] - cp[2], hx = p[0] - cp[0], hy = p[1] - cp[1], hz = p[2] + 1 - cp[2];
    const cos = (lx * hx + ly * hy + lz * hz) / (Math.hypot(lx, ly, lz) * Math.hypot(hx, hy, hz));
    return cos > Math.cos((half * Math.PI) / 180);
  };

  it('frames the hero at every step along the line, the lead key ahead of them looking back', () => {
    const w = world(cam);
    let seenLead = false;
    for (let i = 0; i < 300 && !w.chase.done.length; i++) {
      CW.stepWorld(w, { forward: 1, strafe: 0 }, DT, FLAT);
      if (i > 20) expect(framed(w), `step ${i} at s ${w.chase.s.toFixed(1)}`).toBe(true);
      if (w.camera.track.key === 1 && w.chase.s > 12) {
        // ahead of the hero along the line (east on the first leg), facing back toward them
        seenLead = true;
        expect(w.camera.transform.pos[0]).toBeGreaterThan(w.byId.h.transform.pos[0]);
        expect(Math.cos(w.camera.transform.heading)).toBeLessThan(0);
      }
    }
    expect(seenLead).toBe(true);
  });

  it('keeps the hero near the frame\'s middle: a look asked far off them is turned to within frameMax of them', () => {
    // (a profile looking 12 m on down the line: 60° off the hero, asked; within the cap, held)
    const far = { rule: 'track', target: 'h', path: L.path, keys: [{ s: 0, frame: 'profile', ahead: 12 }] };
    const off = (w) => {
      const c = w.camera, p = w.byId.h.transform.pos, cp = c.transform.pos, l = c.lookAt;
      const a = [l[0] - cp[0], l[1] - cp[1], l[2] - cp[2]], b = [p[0] - cp[0], p[1] - cp[1], p[2] + 1.2 - cp[2]];
      return (Math.acos((a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (Math.hypot(...a) * Math.hypot(...b))) * 180) / Math.PI;
    };
    const capped = run(world(far), { forward: 1, strafe: 0 }, 60), loose = run(world({ ...far, frameMax: 90 }), { forward: 1, strafe: 0 }, 60);
    expect(off(capped)).toBeCloseTo(15, 3);
    expect(off(loose)).toBeGreaterThan(50);
    // (a look already within the cap is left where the frame asks it)
    const near = run(world({ ...far, keys: [{ s: 0, frame: 'profile' }] }), { forward: 1, strafe: 0 }, 60);
    expect(off(near)).toBeLessThan(15);
  });

  it('cuts on a cut key, eases otherwise', () => {
    const w = world(cam);
    let prev = null, jumpAtCut = 0, jumpElse = 0;
    for (let i = 0; i < 300 && !w.chase.done.length; i++) {
      const k0 = w.camera.track ? w.camera.track.key : -1;
      CW.stepWorld(w, { forward: 1, strafe: 0 }, DT, FLAT);
      const p = w.camera.transform.pos, d = prev ? Math.hypot(p[0] - prev[0], p[1] - prev[1], p[2] - prev[2]) : 0;
      if (i > 5) { if (k0 === 1 && w.camera.track.key === 2) jumpAtCut = d; else jumpElse = Math.max(jumpElse, d); }
      prev = p.slice();
    }
    expect(jumpAtCut).toBeGreaterThan(3);              // a cut: across the line to the profile in one frame
    expect(jumpElse).toBeLessThan(jumpAtCut / 10);     // everywhere else an ease (the swing round to lead the fastest of it)
  });

  it('never turns the stick: the run under the track camera is the run under the follow', () => {
    const a = run(world({ rule: 'follow', target: 'h' }), { forward: 1, strafe: 0 }, 200), b = run(world(cam), { forward: 1, strafe: 0 }, 200);
    expect(b.chase.s).toBeCloseTo(a.chase.s, 6);
  });
});

// A LINE'S OWN CAMERA AND MARKS: the set piece's camera directed along it while it holds, the level's given back; its
// marks heard as the hero passes them, and again after the hero is put back behind one
describe('a line with its own camera and its marks', () => {
  const line = { ...L, marks: [{ at: 6, id: 'gap' }, { at: 25, id: 'bridge' }], cams: [{ s: 0, frame: 'chase' }, { s: 8, frame: 'lead' }] };
  const heard = (w, n, input = { forward: 1, strafe: 0 }) => {
    const out = [];
    let prev = null;
    for (let i = 0; i < n; i++) { CW.stepWorld(w, input, DT, FLAT); const f = CW.castFacts(w, prev); prev = f.prev; out.push(...f.events.filter((x) => x.type.startsWith('chase:')).map((x) => x.type)); }
    return out;
  };

  it('takes the camera as it takes the hero and gives the level\'s back as it ends, looking down the line', () => {
    const w = world({ rule: 'follow', target: 'h' }, { lines: [line] });
    CW.stepWorld(w, { forward: 1, strafe: 0 }, DT, FLAT);
    expect(w.camera.rule.type).toBe('track');
    const events = heard(w, 600);
    expect(events).toEqual(['chase:roofs:start', 'chase:roofs:gap', 'chase:roofs:bridge', 'chase:roofs:end']);
    expect(w.camera.rule.type).toBe('follow');
    expect(Math.sin(w.camera.camYaw)).toBeGreaterThan(0.9);   // north: the line's last leg
  });

  it('let go unended, it is taken again where the hero stands, and the marks past them are heard again', () => {
    const w = world({ rule: 'follow', target: 'h' }, { lines: [line] });
    expect(heard(w, 70)).toContain('chase:roofs:gap');
    CW.chaseReset(w);
    expect(w.camera.rule.type).toBe('follow');
    w.byId.h.transform.pos = [2, 0, 0];                         // put back behind the gap
    expect(heard(w, 60)).toEqual(['chase:roofs:start', 'chase:roofs:gap']);
    expect(w.camera.rule.type).toBe('track');
  });

  it('reads its marks and cams, and refuses a frame it does not know', () => {
    expect(readChase({ lines: [line] }).lines[0]).toMatchObject({ marks: [{ at: 6, id: 'gap' }, { at: 25, id: 'bridge' }], cams: [{ s: 0, frame: 'chase' }, { s: 8, frame: 'lead' }] });
    expect(() => readChase({ lines: [{ ...L, cams: [{ s: 0, frame: 'dutch' }] }] })).toThrow(/frame is lead/);
    expect(() => readChase({ lines: [{ ...L, marks: [{ at: -1, id: 'x' }] }] })).toThrow(/marks/);
  });
});

// THE PURSUERS: bodies run along the line behind the hero, keeping their gap while it runs, catching it when it stops
describe('the pursuers on a line', () => {
  const chaser = { id: 'thug', rule: { type: 'static' }, transform: { pos: [-10, 0, 0], heading: 0 }, body: { type: 'mesh', shape: 'box', size: [0.6, 0.6, 1.7] } };
  const mk = () => {
    const w = CW.createWorld({ entities: [{ id: 'h', pilotable: true, rule: { type: 'platform', eye: 0, speed: 6 }, transform: { pos: [0.5, 0, 0], heading: 0 } }, chaser], camera: { rule: 'follow', target: 'h' }, chase: { lines: [{ ...L, path: [[0, 0], [80, 0]], pursuers: [{ id: 'thug', gap: 6, catch: 1.2, back: 10 }] }] } });
    w.pilotId = 'h';
    return w;
  };
  it('keeps its gap behind a hero who runs, facing down the line', () => {
    const w = run(mk(), { forward: 1, strafe: 0 }, 240);
    const gap = w.byId.h.transform.pos[0] - w.byId.thug.transform.pos[0];
    expect(gap).toBeGreaterThan(4);
    expect(gap).toBeLessThan(8);
    expect(Math.cos(w.byId.thug.transform.heading)).toBeGreaterThan(0.99);
    expect(w.byId.thug.moving).toBe(true);
  });
  it('catches a hero who stops: the bus hears it and the hero is put back down the line', () => {
    const w = run(mk(), { forward: 1, strafe: 0 }, 240), s0 = w.chase.s, events = [];
    let prev = null;
    for (let i = 0; i < 180; i++) { CW.stepWorld(w, { forward: 0, strafe: 0 }, DT, FLAT); const f = CW.castFacts(w, prev); prev = f.prev; events.push(...f.events.filter((x) => x.type.startsWith('chase:')).map((x) => x.type)); }
    expect(events).toContain('chase:roofs:caught');
    expect(w.chase.s).toBeLessThan(s0 - 5);
    expect(w.chase.on).toBe('roofs');   // still the line's: run at it again
  });
});

// THE FALL: a line is never run from the street under its course
describe('a fall from the line\'s course', () => {
  // a roof 6 m up for 20 m, then nothing: the street at 0
  const ROOF = { ground: (p) => (p[0] < 20 ? 6 : 0) };
  it('puts the pilot back where it last stood on the course, and the bus hears it', () => {
    const w = CW.createWorld({ entities: [{ id: 'h', pilotable: true, rule: { type: 'platform', eye: 0, speed: 6 }, transform: { pos: [1, 0, 6], heading: 0 } }], camera: { rule: 'follow', target: 'h' }, chase: { lines: [{ id: 'roofs', path: [[0, 0], [60, 0]] }] } });
    w.pilotId = 'h';
    const events = [];
    let prev = null, lowest = 6;
    for (let i = 0; i < 400; i++) {
      CW.stepWorld(w, { forward: 1, strafe: 0 }, DT, ROOF);
      const f = CW.castFacts(w, prev); prev = f.prev; events.push(...f.events.filter((x) => x.type === 'chase:roofs:fell').map((x) => x.type));
      lowest = Math.min(lowest, w.byId.h.transform.pos[2]);
    }
    expect(events.length).toBeGreaterThan(0);
    expect(lowest).toBeGreaterThan(6 - 3.5);            // never down on the street
    expect(w.chase.done).toEqual([]);                    // the line not run to its end from below
    expect(w.chase.s).toBeLessThan(21);
  });
});

// A LINE THAT RIDES: a convoy of two trucks driving east at 8 m/s, a line laid along their tops in the convoy's frame
describe('a chase line that rides a carrier', () => {
  const SPEED = 8, RUN = 800;
  // a truck: a deck 10 m long, 2.4 wide, its top 4 m up, driving east (a mover, a carrier)
  const truck = (id, x) => ({ id, rule: { type: 'mover', path: [[x, 0, 2.5], [x + RUN, 0, 2.5]], period: RUN / SPEED, mode: 'loop' },
    body: { type: 'mesh', shape: 'box', size: [10, 2.4, 3], carrier: true, carryHalf: [5, 1.2], deck: 1.5 }, transform: { pos: [x, 0, 2.5] } });
  const trucks = [truck('t1', 5), truck('t2', 17)];   // decks x 0 … 10 and 12 … 22: a 2 m gap (this rule's jump at a run clears 3)
  // the ground: the road, and each truck's deck where it now stands
  const ground = (w) => ({ ground: (p) => { let z = 0; for (const e of w.entities) { const b = e.body; if (!b || !b.carrier) continue; const c = e.transform.pos, top = c[2] + b.deck; if (Math.abs(p[0] - c[0]) <= b.carryHalf[0] && Math.abs(p[1] - c[1]) <= b.carryHalf[1] && top <= p[2] + 0.6 && top > z) z = top; } return z; } });
  const ride = (extra = {}) => {
    const w = CW.createWorld({ entities: [{ id: 'h', pilotable: true, rule: { type: 'platform', eye: 0, speed: 6, jumpSpeed: 6.5, collideRadius: 0.3 }, transform: { pos: [1, 0, 4], heading: 0 } }, ...trucks],
      chase: { lines: [{ id: 'convoy', path: [[0.5, 0], [21.5, 0]], half: 1.1, rides: 't1', ...extra }] } });
    w.pilotId = 'h';
    return w;
  };
  const go = (w, n, input) => { for (let i = 0; i < n; i++) CW.stepWorld(w, typeof input === 'function' ? input(i, w) : input, DT, ground(w)); return w; };

  it('reads its carrier; a line that rides nothing has no frame', () => {
    expect(readChase({ lines: [{ id: 'c', path: [[0, 0], [9, 0]], rides: 't1' }] }).lines[0].rides).toBe('t1');
    expect(() => readChase({ lines: [{ id: 'c', path: [[0, 0], [9, 0]], rides: 3 }] })).toThrow(/rides is the id of a carrier/);
    const w = run(world(null), {}, 1);
    expect(CW.chaseFrame(w, 'roofs')).toBeNull();
  });

  it('takes a pilot standing on the deck, and reads its run along the deck, not along the road', () => {
    const w = go(ride(), 30, {});
    expect(w.chase.on).toBe('convoy');
    const s0 = w.chase.s, x0 = w.byId.h.transform.pos[0];
    go(w, 60, { forward: 1 });
    // a second's run at 6 m/s: 6 m along the convoy, and 14 m along the road (the truck's 8 with it)
    expect(w.chase.s - s0).toBeCloseTo(6, 0);
    expect(w.byId.h.transform.pos[0] - x0).toBeCloseTo(14, 0);
    expect(CW.chaseFrame(w)[0]).toBeGreaterThan(8);
  });

  it('a jump across the gap between two trucks lands on the next deck, carried through the air by the frame', () => {
    const w = go(ride(), 10, {});
    // (the jump held as a player holds it: its height is how long it is held)
    let jumpAt = -1;
    go(w, 200, (i, W) => { if (jumpAt < 0 && W.chase.s > 9) jumpAt = i; return { forward: 1, jump: i === jumpAt ? 1 : 0, jumpHeld: jumpAt >= 0 && i - jumpAt < 12 ? 1 : 0 }; });
    expect(jumpAt).toBeGreaterThan(0);
    expect(w.chase.s).toBeGreaterThan(13);                 // on the second deck, along the convoy
    expect(w.byId.h.transform.pos[2]).toBeCloseTo(4, 1);  // stood on it, never down on the road
    expect(w.byId.h.carriedBy).toBe('t2');
  });

  it('a fall into the gap puts the pilot back on the deck it last stood on, wherever the deck has gone', () => {
    const w = go(ride(), 10, {}), events = [];
    let prev = null;
    for (let i = 0; i < 240; i++) {
      CW.stepWorld(w, { forward: 1 }, DT, ground(w));
      const f = CW.castFacts(w, prev); prev = f.prev; events.push(...f.events.filter((e) => e.type.startsWith('chase:')).map((e) => e.type));
    }
    expect(events).toContain('chase:convoy:fell');
    // back on a deck (4 m up), on the first truck's run
    const h = w.byId.h, t1 = w.byId.t1.transform.pos;
    expect(h.transform.pos[2]).toBeGreaterThan(3.5);
    expect(Math.abs(h.transform.pos[0] - t1[0])).toBeLessThan(5.5);
  });

  it('a prompt missed on the deck puts the hero back where they stood on it, the convoy driven on meanwhile', () => {
    const w = CW.createWorld({ entities: [{ id: 'h', pilotable: true, rule: { type: 'platform', eye: 0, speed: 6, jumpSpeed: 6.5, collideRadius: 0.3 }, transform: { pos: [1, 0, 4], heading: 0 } }, ...trucks],
      chase: { lines: [{ id: 'convoy', path: [[0.5, 0], [21.5, 0]], half: 1.1, rides: 't1' }] }, prompts: readPrompts([{ id: 'grab', says: 'Grab', window: 0.5 }]) });
    w.pilotId = 'h';
    go(w, 30, { forward: 1 });
    const on = w.byId.h.transform.pos[0] - w.byId.t1.transform.pos[0];
    CW.promptFire(w, 'grab');
    let n = 0;
    while (!w.prompt.results.grab && n++ < 120) go(w, 1, { forward: 1 });   // run on, never pressing: missed
    expect(w.prompt.results.grab).toBe('miss');
    // (put back, the run since undone: where the hero stood on the deck as it came up, the deck driven on down the road)
    expect(w.byId.t1.transform.pos[0]).toBeGreaterThan(12);
    const back = w.byId.h.transform.pos[0] - w.byId.t1.transform.pos[0];
    expect(Math.abs(back - on)).toBeLessThan(0.5);
    expect(w.byId.h.transform.pos[2]).toBeCloseTo(4, 1);
  });
});
