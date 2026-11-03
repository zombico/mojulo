import { describe, it, expect } from 'vitest';
import { composeLive, emissionSource } from './compose.js';

// THE WORLD CLOCK: a world's `tempo` moments fire on what happens, the world steps at their scale, the camera at real time
const CW = composeLive();
const DT = 1 / 60;
const seen = [];   // the steps the camera's rule is handed
CW.RULES.__probeCam = (e, inp, d) => { seen.push(d); };
const body = () => ({ type: 'mesh', shape: 'box', size: [0.6, 0.6, 1.7], hittable: true, hp: 100, radius: 0.5, poise: 100, staggerDur: 1 });
const ent = (id, x) => ({ id, rule: { type: 'static' }, transform: { pos: [x, 0, 0], heading: 0 }, body: body() });
const world = (tempo, extra = []) => {
  const w = CW.createWorld({ entities: [ent('hero', 0), ent('foe', 1.5), ...extra], camera: { rule: '__probeCam' }, ...(tempo ? { tempo } : {}) });
  w.pilotId = 'hero';
  return w;
};
const run = (w, n) => { const out = []; for (let i = 0; i < n; i++) { const t0 = w.time; CW.stepWorld(w, {}, DT, { ground: () => 0 }); out.push(w.time - t0); } return out; };

describe('the world clock', () => {
  it('absent adds nothing: no state, no emitted source, the world on real time', () => {
    const w = world(null);
    expect(w).not.toHaveProperty('tempo');
    expect(run(w, 3).every((d) => Math.abs(d - DT) < 1e-12)).toBe(true);
    expect(emissionSource({})).not.toContain('stepWithTempo');
    expect(emissionSource({ clock: true })).toContain('stepWithTempo');
    expect(CW.createWorld({ entities: [ent('a', 0)], tempo: { moments: [{ scale: 0.5 }] } })).not.toHaveProperty('tempo');   // a moment fires on something
  });

  it('a moment fires on its signal: the world slows for its hold, the camera keeps real time, then real time comes back', () => {
    const w = world({ moments: [{ on: 'down:foe', scale: 0.25, hold: 0.5 }] });
    expect(run(w, 5).every((d) => Math.abs(d - DT) < 1e-12)).toBe(true);
    w.byId.foe.downed = true;
    run(w, 1);
    expect(w.tempo.playing.on).toBe('down:foe');
    seen.length = 0;
    const steps = run(w, Math.round(0.5 / DT) - 1);
    for (const d of steps) expect(d).toBeCloseTo(DT * 0.25, 12);
    expect(seen.every((d) => d === DT)).toBe(true);
    run(w, 2);
    expect(w.tempo.playing).toBeNull();
    expect(run(w, 1)[0]).toBeCloseTo(DT, 12);
  });

  it('a freeze holds every body still while the camera moves on', () => {
    const w = world({ moments: [{ on: 'go', scale: 0, hold: 0.3 }] });
    const before = JSON.stringify(w.entities.filter((e) => !e.isCamera).map((e) => e.transform.pos));
    CW.tempoMoment(w, 'go');
    seen.length = 0;
    const steps = run(w, 10);
    expect(Math.max(...steps)).toBeLessThan(DT * 1e-5);
    expect(JSON.stringify(w.entities.filter((e) => !e.isCamera).map((e) => e.transform.pos))).toBe(before);
    expect(seen).toEqual(Array(10).fill(DT));
  });

  it('a ramp eases into the scale and back, never jumping', () => {
    const w = world({ moments: [{ on: 'go', scale: 0.2, hold: 0.2, ramp: 0.3 }] });
    CW.tempoMoment(w, 'go');
    const scales = [];
    for (let i = 0; i < 60; i++) { run(w, 1); scales.push(w.tempo.scale); }
    expect(Math.min(...scales)).toBeCloseTo(0.2, 9);
    for (let i = 1; i < scales.length; i++) expect(Math.abs(scales[i] - scales[i - 1])).toBeLessThan(0.1);
    expect(scales.at(-1)).toBe(1);
  });

  it('a cooldown keeps it from firing again; a weaker moment does not cut a stronger one; a stronger one takes over', () => {
    const w = world({ moments: [{ on: 'hit', scale: 0.5, hold: 0.1, cooldown: 1 }, { on: 'big', scale: 0.1, hold: 0.1 }] });
    expect(CW.tempoMoment(w, 'hit')).toBe(true);
    run(w, 20);
    expect(CW.tempoMoment(w, 'hit')).toBe(false);
    expect(CW.tempoMoment(w, 'big')).toBe(true);
    expect(w.tempo.playing.on).toBe('big');
    run(w, 60);
    expect(CW.tempoMoment(w, 'hit')).toBe(true);
    expect(CW.tempoMoment(w, 'nothing')).toBe(false);
  });

  it('down:foe on each foe, last-down on the last; a dodge by the pilot; a strike on a connect', () => {
    const w = world({ moments: [{ on: 'down:foe', scale: 0.5, hold: 0.05 }, { on: 'last-down', scale: 0.2, hold: 0.05 }, { on: 'dodge', scale: 0.4, hold: 0.05 }] }, [ent('foe2', -1.5)]);
    w.byId.foe.downed = true; run(w, 1);
    expect(w.tempo.playing.on).toBe('down:foe');
    run(w, 30);
    w.byId.foe2.downed = true; run(w, 1);
    expect(w.tempo.playing.on).toBe('last-down');
    run(w, 30);
    w.byId.hero.dodgeCount = 1; run(w, 1);
    expect(w.tempo.playing.on).toBe('dodge');
    // a melee connect
    const s = world({ moments: [{ on: 'strike', scale: 0.3, hold: 0.1 }] }), hero = s.byId.hero;
    hero.strikeParams = CW.meleeSwingSpec({ strikeReach: 2, strikeDamage: 4 }, {}, 'neutral', false).params;
    hero.swingT = 0.4; hero.struckThisSwing = {};
    run(s, 1);
    expect(hero.meleeHitCount).toBe(1);
    expect(s.tempo.playing.on).toBe('strike');
  });

  it('is deterministic: the same frames, the same clock', () => {
    const trace = () => { const w = world({ moments: [{ on: 'down', scale: 0.3, hold: 0.2, ramp: 0.1 }] }); run(w, 3); w.byId.foe.downed = true; return run(w, 40); };
    expect(trace()).toEqual(trace());
  });
});

describe('the world clock on the page', () => {
  it('a world with a tempo composes the clock and steps its bodies on the world\'s step; one without keeps every byte', async () => {
    const { emitThreeWorld } = await import('@/lib/graph/scene/scene-three');
    const floor = { corners: [[-20, -20, 0], [20, -20, 0], [20, 20, 0], [-20, 20, 0]], fill: '#556' };
    const ents = [{ id: 'p', rule: { type: 'walk', speed: 4 }, pilotable: true, body: body() }, { id: 'f', rule: { type: 'static' }, body: body(), transform: { pos: [3, 0, 0], heading: 0 } }];
    const base = { faces: [floor], entities: ents, camera: { rule: 'follow', target: 'p' } };
    const plain = emitThreeWorld(base);
    const timed = emitThreeWorld({ ...base, tempo: { moments: [{ on: 'last-down', scale: 0.2, hold: 1.5, ramp: 0.2 }] } });
    for (const s of ['stepWithTempo', '__mojTempo', 'tempoScale', '"last-down"']) { expect(timed).toContain(s); expect(plain).not.toContain(s); }
    expect(timed).toContain('__syncEntity(e, wdt)');
    expect(plain).toContain('__syncEntity(e, dt)');
    expect(emitThreeWorld({ ...base, tempo: null })).toBe(plain);
  });
});

describe('a world\'s tempo, read', () => {
  it('words, moments and a mix of them; refuses what it cannot play, naming what it takes', async () => {
    const { readTempo, TEMPO_PRESETS } = await import('./world-clock.js');
    expect(readTempo(null)).toBeNull();
    expect(readTempo('finisher')).toEqual({ moments: TEMPO_PRESETS.finisher });
    expect(readTempo(['impact', { on: 'boss', scale: 0, hold: 1 }]).moments.map((m) => m.on)).toEqual([...TEMPO_PRESETS.impact.map((m) => m.on), 'boss']);
    expect(readTempo({ moments: [{ on: 'dodge', scale: 0.3, hold: 1, ramp: 0.2 }] })).toEqual({ moments: [{ on: 'dodge', scale: 0.3, hold: 1, ramp: 0.2 }] });
    expect(() => readTempo('matrix')).toThrow(/finisher/);
    expect(() => readTempo({ moments: [{ on: 'strike', scale: 2, hold: 1 }] })).toThrow(/0 \(held\) to 1/);
    expect(() => readTempo({ moments: [{ on: 'strike', scale: 0.5 }] })).toThrow(/hold/);
    // every preset plays: its moments fire on what the kernel reads
    const { TEMPO_SIGNALS } = await import('./world-clock.js');
    for (const ms of Object.values(TEMPO_PRESETS)) for (const m of ms) expect(TEMPO_SIGNALS).toContain(m.on);
  });

  it('a world manifest\'s tempo reaches the page; a world without one has none', async () => {
    const { resolveWorldScene } = await import('../world-scene.js');
    const { TEMPO_PRESETS } = await import('./world-clock.js');
    const manifest = { kind: 'controllable', entities: [{ id: 'p', rule: { type: 'walk', speed: 4 }, pilotable: true, body: body() }], camera: { rule: 'follow', target: 'p' } };
    expect((await resolveWorldScene({ ref: 't', manifest: { ...manifest, tempo: 'finisher' } })).payload.tempo).toEqual({ moments: TEMPO_PRESETS.finisher });
    expect((await resolveWorldScene({ ref: 't', manifest })).payload).not.toHaveProperty('tempo');
  }, 120_000);   // (world resolution's cold import is heavy)
});

describe('the impact cam\'s bridge: a firing moment cues the live shoot plan', () => {
  it('a world with a tempo cues tempo:<what fired>; a live plan\'s gizmos take no raycast; a plan that is not live is as it was', async () => {
    const { emitThreeWorld } = await import('@/lib/graph/scene/scene-three');
    const { normalizeShoot, lowerShoot } = await import('../../shoot/plan.js');
    const { shootChannelScript } = await import('../../scene/channels/shoot.js');
    const plan = normalizeShoot({ cameras: [{ id: 'w', keys: [{ t: 0, pos: [0, -9, 4], poi: [0, 0, 1] }, { t: 30, pos: [0, -9, 4], poi: [0, 0, 1] }] }], shots: [{ name: 'wide', camera: 'w', span: [0, 30] }, { name: 'impact', camera: 'w', span: [0, 2], on: 'tempo:last-down' }] }).plan;
    const floor = { corners: [[-20, -20, 0], [20, -20, 0], [20, 20, 0], [-20, 20, 0]], fill: '#556' };
    const html = emitThreeWorld({ faces: [floor], entities: [{ id: 'p', rule: { type: 'walk', speed: 4 }, pilotable: true, body: body() }], camera: { rule: 'follow', target: 'p' }, shoot: lowerShoot(plan, { live: true }), tempo: { moments: [{ on: 'last-down', scale: 0.2, hold: 1 }] } });
    expect(html).toContain("window.__mojShoot.cue('tempo:' + __tmLast.on)");
    expect(shootChannelScript(lowerShoot(plan, { live: true }))).toContain('c.raycast = () => {};');
    expect(shootChannelScript(lowerShoot(plan))).not.toContain('raycast');
  });
});

describe('the impact cam: a moment takes the camera on the two it knows', () => {
  const fight = (cam, extra = {}) => {
    const w = world({ moments: [{ on: 'down:foe', scale: 0.3, hold: 0.3, ...(cam ? { cam } : {}) }, { on: 'big', scale: 0.1, hold: 0.2 }] });
    Object.assign(w, extra);
    w.byId.foe.lastHitBy = 'hero'; w.byId.foe.downed = true;
    return w;
  };
  it('a moment\'s cam frames the downer and the downed with the shot rule, and hands the camera back as it ends', () => {
    const w = fight('two'), C = w.camera, rule = C.rule;
    run(w, 1);
    expect(C.rule).toMatchObject({ type: 'shot', frame: 'two', on: ['hero', 'foe'], cut: false });
    expect(C.heldRule).toBe(rule);
    run(w, Math.round(0.4 / DT));
    expect(w.tempo.playing).toBeNull();
    expect(C.rule).toBe(rule);
    expect(C.heldRule).toBeNull();
  });
  it('one subject left (the other gone): a close on it; `on` picks whom; no one to frame, no shot', () => {
    const w = fight({ frame: 'low', on: ['b'], move: 'push' });
    run(w, 1);
    expect(w.camera.rule).toMatchObject({ type: 'shot', frame: 'low', on: ['foe'], move: 'push' });
    const none = world({ moments: [{ on: 'go', scale: 0.5, hold: 0.2, cam: 'two' }] });
    CW.tempoMoment(none, 'go');
    expect(none.camera.rule.type).toBe('__probeCam');
  });
  it('never takes the camera from a scene\'s shot or the tackle cinematic, and leaves a scene\'s shot where it was', () => {
    const scene = fight('two');
    CW.castOps(scene, [{ op: 'shot', shot: { frame: 'wide', on: ['hero'] } }]);
    run(scene, 1);
    expect(scene.camera.rule).toMatchObject({ type: 'shot', frame: 'wide' });
    run(scene, Math.round(0.4 / DT));
    expect(scene.camera.rule).toMatchObject({ type: 'shot', frame: 'wide' });
    const cine = fight('two', { cinematic: { a: 'hero', b: 'foe', side: 1 } });
    run(cine, 1);
    expect(cine.camera.rule.type).toBe('__probeCam');
  });
  it('a moment that takes over without a cam hands the camera back', () => {
    const w = fight('two');
    run(w, 1);
    expect(w.camera.rule.type).toBe('shot');
    CW.tempoMoment(w, 'big');
    expect(w.camera.rule.type).toBe('__probeCam');
  });
  it('reads a cam: a frame word or { frame, on, side, move, lerp }; refuses one it cannot shoot', async () => {
    const { readTempo } = await import('./world-clock.js');
    expect(readTempo({ moments: [{ on: 'strike', scale: 0, hold: 0.1, cam: 'close' }] }).moments[0].cam).toBe('close');
    expect(readTempo({ moments: [{ on: 'strike', scale: 0, hold: 0.1, cam: { frame: 'profile', on: ['a'], side: -1 } }] }).moments[0].cam).toEqual({ frame: 'profile', on: ['a'], side: -1 });
    expect(() => readTempo({ moments: [{ on: 'strike', scale: 0, hold: 0.1, cam: 'dutch' }] })).toThrow(/frame is one of/);
    expect(() => readTempo({ moments: [{ on: 'strike', scale: 0, hold: 0.1, cam: { move: 'zoom' } }] })).toThrow(/move is one of/);
  });
});

describe('a moment\'s look: grade dials eased by the moment\'s weight', () => {
  it('the weight eases in over the ramp, holds at 1, eases out, and is 0 when no moment plays', () => {
    const w = world({ moments: [{ on: 'go', scale: 0.5, hold: 0.2, ramp: 0.2, look: { saturation: 0 } }] });
    expect(CW.tempoWeight(w)).toBe(0);
    CW.tempoMoment(w, 'go');
    const ws = [];
    for (let i = 0; i < 40; i++) { run(w, 1); ws.push(CW.tempoWeight(w)); }
    expect(Math.max(...ws)).toBe(1);
    for (let i = 1; i < ws.length; i++) expect(Math.abs(ws[i] - ws[i - 1])).toBeLessThan(0.15);
    expect(ws.at(-1)).toBe(0);
    expect(w.tempo.moments[0].look).toEqual({ saturation: 0 });
  });

  it('reads a look (grade dials and impact frames); every preset\'s look is a look', async () => {
    const { readTempo, TEMPO_PRESETS } = await import('./world-clock.js');
    expect(readTempo({ moments: [{ on: 'strike', scale: 0, hold: 0.05, look: { impact: 2, zoom: 0.4 } }] }).moments[0].look).toEqual({ zoom: 0.4, impact: 2 });
    expect(() => readTempo({ moments: [{ on: 'strike', scale: 0, hold: 0.05, look: { impact: 9 } }] })).toThrow(/1 to 6 frames/);
    expect(() => readTempo({ moments: [{ on: 'strike', scale: 0, hold: 0.05, look: { sepia: 1 } }] })).toThrow(/not a dial/);
    for (const [word, ms] of Object.entries(TEMPO_PRESETS)) expect(readTempo(word).moments.map((m) => m.look)).toEqual(ms.map((m) => m.look));
  });

  it('the page lays a moment\'s look over the grade only when a moment carries one', async () => {
    const { emitThreeWorld } = await import('@/lib/graph/scene/scene-three');
    const floor = { corners: [[-20, -20, 0], [20, -20, 0], [20, 20, 0], [-20, 20, 0]], fill: '#556' };
    const base = { faces: [floor], entities: [{ id: 'p', rule: { type: 'walk', speed: 4 }, pilotable: true, body: body() }], camera: { rule: 'follow', target: 'p' } };
    const looked = emitThreeWorld({ ...base, tempo: { moments: [{ on: 'strike', scale: 0, hold: 0.05, look: { impact: 2 } }] } });
    expect(looked).toContain('window.__mojGrade.moment(');
    expect(looked).toContain('gradeFrame');
    const bare = emitThreeWorld({ ...base, tempo: { moments: [{ on: 'strike', scale: 0, hold: 0.05 }] } });
    expect(bare).not.toContain('__mojGrade');
  });
});
