import { describe, it, expect } from 'vitest';
import { composeLive, emissionSource } from './compose.js';
import { readChase, CHASE } from './chase-line.js';

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
