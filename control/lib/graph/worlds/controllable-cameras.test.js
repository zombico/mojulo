import { describe, expect, it } from 'vitest';

import { createWorld, stepWorld } from './controllable-world.js';
import { emitThreeWorld } from '../scene/scene-three.js';
import { quickWorld, goalMechanics } from '../gameworld/quick.js';
import { readGameworld } from '../gameworld/world.js';
import { gameStages, stageLevelOrder } from '../gameworld/levels.js';

// The named gameplay cameras (cosmos space.camera): `eye` (first person) and `overhead` (the ¾ top-down camera), the
// movement that goes with each (`walk` lookPitch, `platform` move: 'world'), the page hiding the body the eye rides in,
// and a gameworld's `camera` lowering to them. Absent, every one of them leaves the old path as it was.
// a flat floor at z = 0 under everything, so a platform pilot stands and runs instead of falling
const FLAT = { ground: () => 0 };
const run = (w, input, steps, dt = 1 / 60) => { for (let i = 0; i < steps; i++) stepWorld(w, input, dt, FLAT); return w; };
const pilot = (rule, transform = { pos: [0, 0, 0], heading: 0 }) => ({ id: 'hero', pilotable: true, rule: { type: 'platform', ...rule }, transform });

describe('camera: eye (first person)', () => {
  it('rides the target at its eye height and looks down its heading and pitch, with no lag', () => {
    const w = createWorld({ entities: [pilot({ turnMode: 'look' })], camera: { rule: 'eye', target: 'hero', height: 1.6 } });
    run(w, { forward: 1, lookDX: 40, lookDY: 30 }, 30);
    const hero = w.byId.hero.transform, cam = w.camera.transform;
    expect(cam.pos).toEqual([hero.pos[0], hero.pos[1], hero.pos[2] + 1.6]);
    expect(cam.heading).toBe(hero.heading);
    expect(cam.pitch).toBe(hero.pitch);
    expect(hero.pitch).not.toBe(0);
    expect(w.camera.lookAt).toBeNull();
  });

  it('a walker in look mode pitches only with lookPitch; without it the walk is as before', () => {
    const mk = (extra) => createWorld({ entities: [{ id: 'p', rule: { type: 'walk', turnMode: 'look', ...extra }, transform: { pos: [0, 0, 0], heading: 0 } }] });
    const a = run(mk({ lookPitch: true }), { lookDY: 50 }, 10), b = run(mk({}), { lookDY: 50 }, 10);
    expect(a.byId.p.transform.pitch).toBeGreaterThan(0.5);
    expect(b.byId.p.transform.pitch || 0).toBe(0);
    const tank = run(mk({ turnMode: 'tank', lookPitch: true }), { lookDY: 50 }, 10);
    expect(tank.byId.p.transform.pitch || 0).toBe(0);   // tank turning never pitches
  });
});

describe('camera: overhead (¾ top-down)', () => {
  it('settles south of and above the target at its tilt, looking at it, whichever way the target faces', () => {
    for (const heading of [0, 1.3, -2.4]) {
      const w = createWorld({ entities: [pilot({}, { pos: [5, 5, 0], heading })], camera: { rule: 'overhead', target: 'hero', dist: 10, tilt: Math.PI / 3, lookH: 1, lerp: 30 } });
      run(w, {}, 120);
      const c = w.camera.transform.pos;
      expect(c[0]).toBeCloseTo(5, 3);                              // yaw π/2: straight south of it, never off to a side
      expect(c[1]).toBeCloseTo(5 - 10 * Math.cos(Math.PI / 3), 3);
      expect(c[2]).toBeCloseTo(1 + 10 * Math.sin(Math.PI / 3), 3);
      expect(w.camera.lookAt).toEqual([5, 5, 1]);
    }
  });

  it('never looks straight down: the tilt is held short of the nadir', () => {
    const w = createWorld({ entities: [pilot({})], camera: { rule: 'overhead', target: 'hero', dist: 10, tilt: Math.PI / 2, lookH: 0, lerp: 30 } });
    run(w, {}, 120);
    const c = w.camera.transform.pos;
    expect(Math.hypot(c[0], c[1])).toBeGreaterThan(1);
  });
});

describe('movement: platform move: \'world\'', () => {
  const hero = (heading) => createWorld({ entities: [pilot({ move: 'world', moveYaw: Math.PI / 2, speed: 4 }, { pos: [0, 0, 0], heading })] });

  it('W walks up the screen (north) and D walks right (east), whichever way the hero faced', () => {
    for (const heading of [0, Math.PI, -1]) {
      const n = run(hero(heading), { forward: 1 }, 60).byId.hero.transform;
      expect(n.pos[1]).toBeGreaterThan(3.5);
      expect(Math.abs(n.pos[0])).toBeLessThan(1e-9);
      const e = run(hero(heading), { strafe: 1 }, 60).byId.hero.transform;
      expect(e.pos[0]).toBeGreaterThan(3.5);
      const d = run(hero(heading), { turn: 1 }, 60).byId.hero.transform;   // A/D on the turn axis move the same way
      expect(d.pos[0]).toBeGreaterThan(3.5);
    }
  });

  it('the hero turns to face where it runs, at faceRate, and runs its forward clip', () => {
    const w = run(hero(0), { forward: 1 }, 60), h = w.byId.hero;
    expect(h.transform.heading).toBeCloseTo(Math.PI / 2, 6);
    expect(h.locomotion).toBe('forward');
    const one = run(hero(0), { forward: 1 }, 1).byId.hero.transform.heading;
    expect(one).toBeCloseTo(12 / 60, 9);   // one frame turns at most faceRate × dt
  });

  it('a diagonal is no faster than a straight run', () => {
    const diag = run(hero(0), { forward: 1, strafe: 1 }, 60).byId.hero.transform.pos;
    const straight = run(hero(0), { forward: 1 }, 60).byId.hero.transform.pos;
    expect(Math.hypot(diag[0], diag[1])).toBeCloseTo(Math.hypot(straight[0], straight[1]), 6);
  });

  it('without the key, the platform rule is the tank-turning rule it was', () => {
    const w = createWorld({ entities: [pilot({ speed: 4 }, { pos: [0, 0, 0], heading: 0 })] });
    run(w, { forward: 1 }, 60);
    expect(w.byId.hero.transform.pos[0]).toBeGreaterThan(3.5);   // heading 0 is +X: W runs along the heading
    expect(w.byId.hero.transform.heading).toBe(0);
  });
});

describe('the page: the body the eye rides in is hidden', () => {
  const floor = { corners: [[-10, -10, 0], [10, -10, 0], [10, 10, 0], [-10, 10, 0]], fill: '#445566', doubleSided: true };
  const entities = [{ id: 'hero', rule: { type: 'platform' }, body: { type: 'mesh', shape: 'box' } }];
  const HIDE = 'if (e.id === "hero") m.visible = false;';

  it('an eye camera with hideTarget hides its target every frame, and the re-show leaves it alone', () => {
    const html = emitThreeWorld({ faces: [floor], entities, camera: { rule: 'eye', target: 'hero', height: 1.6, hideTarget: true, mouseLook: true } });
    expect(html).toContain(HIDE);
    expect(html).toContain('!m.userData.hangarHidden && e.id !== "hero") m.visible = true;');
    expect(html).toContain('const __MOUSELOOK = true;');
  });

  it('any other camera emits none of it', () => {
    for (const camera of [{ rule: 'follow', target: 'hero' }, { rule: 'eye', target: 'hero' }, { rule: 'overhead', target: 'hero', hideTarget: true }]) {
      const html = emitThreeWorld({ faces: [floor], entities, camera });
      expect(html).not.toContain('m.visible = false;   // first person');
      expect(html).toContain('if (!m.visible && !m.userData.hangarHidden) m.visible = true;');
    }
  });
});

describe('a gameworld\'s camera, lowered', () => {
  const world = (quick) => quickWorld({ id: 'cams', quick: { goal: 'reach', ...quick }, style: { kit: 'trail-valley' } });
  const level = (quick, heroRef) => {
    const W = world(quick), G = readGameworld(W), [stage] = gameStages(W);
    return stageLevelOrder(G, stage, { ref: 'cams-level', heroRef }).args.manifest;
  };

  it('absent: third person with a hero, the old first-person walker without one (the args a run fingerprints, unchanged)', () => {
    const hero = level({}, 'h');
    expect(hero.camera).toMatchObject({ rule: 'follow', target: 'hero', dist: 5.5 });
    expect(hero.entities[0].rule.move).toBeUndefined();
    expect(hero.entities[0].rule.turnMode).toBeUndefined();
    const walker = level({}, null);
    expect(walker.camera).toEqual({ rule: 'follow', target: 'player', dist: 0.05, height: 0, lookH: 0, lead: 2 });
    expect(walker.entities[0].rule).toEqual({ type: 'walk', speed: 4.5, turn: 2.4, eye: 1.7 });
  }, 60_000);

  it('top-down: the overhead camera over the hero, who moves in the screen\'s frame', () => {
    const m = level({ camera: 'top-down' }, 'h');
    expect(m.camera).toMatchObject({ rule: 'overhead', target: 'hero', yaw: Math.PI / 2, tilt: Math.PI / 3 });
    expect(m.entities[0].rule).toMatchObject({ type: 'platform', move: 'world', moveYaw: Math.PI / 2 });
    expect(JSON.stringify(m.events)).toContain('W A S D  move');
  }, 60_000);

  it('first person: the eye rides the hero (body hidden, mouse looks); without a hero, the walker looks and pitches', () => {
    const m = level({ camera: 'first-person' }, 'h');
    expect(m.camera).toEqual({ rule: 'eye', target: 'hero', height: 1.6, mouseLook: true, hideTarget: true });
    expect(m.entities[0].rule).toMatchObject({ type: 'platform', turnMode: 'look' });
    const w = level({ camera: 'first-person' }, null);
    expect(w.camera).toEqual({ rule: 'eye', target: 'player', height: 0, mouseLook: true });
    expect(w.entities[0].rule).toMatchObject({ type: 'walk', turnMode: 'look', lookPitch: true, strafe: 1 });
  }, 60_000);

  it('the camera is the world\'s setting: quick.camera moves up to it, and a bad one is named', () => {
    expect(world({ camera: 'top-down' })).toMatchObject({ camera: 'top-down', quick: { goal: 'reach' } });
    expect(world({ camera: 'top-down' }).quick.camera).toBeUndefined();
    expect(() => world({ camera: 'isometric' })).toThrow(/camera is one of third-person .*first-person .*top-down/);
    expect(() => readGameworld({ ...world({}), camera: 'drone' })).toThrow(/gameworld: camera is one of/);
  });

  it('top-down and third person need a hero to watch, and say so', () => {
    expect(() => level({ camera: 'top-down' }, null)).toThrow(/top-down camera watches a hero/);
    expect(() => level({ camera: 'third-person' }, null)).toThrow(/third-person camera follows a hero/);
  }, 60_000);
});

describe('movement: platform move: \'lane\' (the side-scroller)', () => {
  // an L: east 10 m, then north 10 m
  const LANE = [[0, 0], [10, 0], [10, 10]];
  const runner = (pos = [0, 0, 0]) => createWorld({ entities: [pilot({ move: 'lane', lane: LANE, speed: 4 }, { pos, heading: 0 })] });

  it('D runs along the lane the way it was drawn, round its bend, and the body never leaves the line', () => {
    const w = runner();
    let off = 0;
    for (let i = 0; i < 240; i++) {
      stepWorld(w, { strafe: 1 }, 1 / 60, FLAT);
      const [x, y] = w.byId.hero.transform.pos;
      off = Math.max(off, Math.min(Math.abs(y) + Math.max(0, x - 10), Math.abs(x - 10) + Math.max(0, -y)));
    }
    const [x, y] = w.byId.hero.transform.pos;
    expect(x).toBeCloseTo(10, 6);          // round the corner, now running north
    expect(y).toBeGreaterThan(4);
    expect(off).toBeLessThan(1e-9);
    expect(w.byId.hero.transform.heading).toBeCloseTo(Math.PI / 2, 3);   // faces its run
  });

  it('A runs back; W and S do nothing; the turn axis runs the lane as strafe does', () => {
    expect(run(runner([5, 0, 0]), { strafe: -1 }, 30).byId.hero.transform.pos[0]).toBeLessThan(5 - 1.5);
    const still = run(runner([5, 0, 0]), { forward: 1 }, 30).byId.hero.transform.pos;
    expect(still[0]).toBe(5);
    expect(still[1]).toBe(0);
    expect(run(runner([5, 0, 0]), { turn: 1 }, 30).byId.hero.transform.pos[0]).toBeGreaterThan(5 + 1.5);
  });

  it('A runs back round the same bend from its far leg', () => {
    const w = run(runner([10, 5, 0]), { strafe: -1 }, 240), [x, y] = w.byId.hero.transform.pos;
    expect(y).toBe(0);
    expect(x).toBeLessThan(6);
    expect(Math.cos(w.byId.hero.transform.heading)).toBeCloseTo(-1, 6);   // faces west, its run
  });

  it('a body set off the line is put back on it', () => {
    const w = run(runner([4, 3, 0]), {}, 1);
    expect(w.byId.hero.transform.pos.slice(0, 2)).toEqual([4, 0]);
  });
});

describe('camera: side', () => {
  const LANE = [[0, 0], [10, 0], [10, 10]];
  const world = (pos) => createWorld({ entities: [pilot({ move: 'lane', lane: LANE }, { pos, heading: 0 })], camera: { rule: 'side', target: 'hero', dist: 11, tilt: 0.2, lookH: 1.2, lerp: 30 } });

  it('stands square to the lane on the right of its run, so running forward runs right across the screen', () => {
    const w = run(world([5, 0, 0]), {}, 120);
    const c = w.camera.transform.pos;
    expect(c[0]).toBeCloseTo(5, 3);                     // square on to an east-running lane: due south of the hero
    expect(c[1]).toBeCloseTo(-11 * Math.cos(0.2), 3);
    expect(w.camera.transform.heading).toBeCloseTo(Math.PI / 2, 6);   // looking north: east is screen-right
    expect(w.camera.lookAt).toEqual([5, 0, 1.2]);
  });

  it('swings round with the bend, easing rather than snapping', () => {
    const w = run(world([5, 0, 0]), {}, 60);
    w.byId.hero.transform.pos = [10, 6, 0];             // past the corner: the lane now runs north
    stepWorld(w, {}, 1 / 60, FLAT);
    const one = w.camera.transform.heading;
    expect(one).toBeGreaterThan(Math.PI / 2);           // turning toward π (looking west) …
    expect(one).toBeLessThan(Math.PI / 2 + 0.2);        // … but not in one frame
    run(w, {}, 240);
    expect(w.camera.transform.heading).toBeCloseTo(Math.PI, 3);
  });
});

describe('a gameworld\'s side camera, lowered', () => {
  const W = (quick) => quickWorld({ id: 'side', quick: { goal: 'collect', pickup: 'coin', camera: 'side', ...quick }, style: { kit: 'trail-valley' } });

  it('the hero runs the trail\'s own spine (spawn on it), the side camera watches, and the coins are moved onto the line', () => {
    const w = W({}), G = readGameworld(w), [stage] = gameStages(w);
    const m = stageLevelOrder(G, stage, { ref: 'side-level', heroRef: 'h', goal: (ends) => goalMechanics(w.quick, ends) }).args.manifest;
    const rule = m.entities[0].rule;
    expect(rule).toMatchObject({ type: 'platform', move: 'lane' });
    expect(rule.lane.length).toBeGreaterThan(60);
    expect(m.camera).toEqual({ rule: 'side', target: 'hero' });
    const onLine = (p) => Math.min(...rule.lane.slice(1).map((b, i) => {
      const a = rule.lane[i], dx = b[0] - a[0], dy = b[1] - a[1], u = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)));
      return Math.hypot(p[0] - a[0] - dx * u, p[1] - a[1] - dy * u);
    }));
    expect(onLine(m.entities[0].transform.pos)).toBeLessThan(0.05);
    const coins = m.game.mechanics.find((x) => x.kind === 'collect').pickups;
    expect(coins.length).toBeGreaterThan(2);
    for (const c of coins) expect(onLine(c.at)).toBeLessThan(0.01);
    expect(JSON.stringify(m.events)).toContain('A / D  run');
  }, 60_000);

  it('a climb has no lane to run, and a side camera with no hero has nothing to watch: both say so', () => {
    const climb = quickWorld({ id: 'climb', quick: { goal: 'reach', climb: true, camera: 'side' }, style: { kit: 'isekai-meadow' } });
    const G = readGameworld(climb), stages = gameStages(climb);
    expect(() => stageLevelOrder(G, stages[1], { ref: 'x', heroRef: 'h' })).toThrow(/climb with no trail to run/);
    const flat = W({}), F = readGameworld(flat);
    expect(() => stageLevelOrder(F, gameStages(flat)[0], { ref: 'x', heroRef: null })).toThrow(/side camera watches a hero/);
  }, 60_000);
});

describe('the fixed camera', () => {
  const world = (x) => createWorld({
    entities: [{ id: 'hero', pilotable: true, rule: { type: 'walk', speed: 0 }, body: { type: 'none' }, transform: { pos: [x, 0, 0], heading: 0 } }],
    camera: { rule: 'fixed', target: 'hero', stations: [{ at: [0, -8, 5], focus: [0, 0, 0] }, { at: [20, 8, 5], focus: [20, 0, 0] }] },
  });
  const cam = (w) => w.entities.find((e) => e.isCamera);
  it('stands at the station whose focus is nearest, and cuts (never pans) when another is nearer by its hold', () => {
    const w = world(4);
    stepWorld(w, {}, 1 / 30);
    expect(cam(w).transform.pos).toEqual([0, -8, 5]);
    w.byId.hero.transform.pos = [10.5, 0, 0];   // just past the middle: inside the hold, the shot stays
    stepWorld(w, {}, 1 / 30);
    expect(cam(w)._fixedAt).toBe(0);
    w.byId.hero.transform.pos = [13, 0, 0];
    stepWorld(w, {}, 1 / 30);
    expect(cam(w).transform.pos).toEqual([20, 8, 5]);
    expect(cam(w).lookAt[0]).toBeGreaterThan(13);   // leaning from its focus toward the hero
  });
  it('a quick game played on fixed cameras lays one over each place of the way', () => {
    const W = quickWorld({ id: 'dread', quick: { goal: 'reach', camera: 'fixed' }, style: { kit: 'trail-valley' } }), G = readGameworld(W), [stage] = gameStages(W);
    const L = stageLevelOrder(G, stage, { ref: 'x', heroRef: 'h', goal: (ends) => goalMechanics(W.quick, ends) });
    const c = L.args.manifest.camera;
    expect(c.rule).toBe('fixed');
    expect(c.stations.length).toBeGreaterThan(2);
    expect(c.stations[0].focus).toEqual(L.ends.spawn);
  });
});

// A rig body drawn at a scale of its own (`body.scale`: a hero in a city level's units) scales its group once; a page
// with no scaled body carries none of it.
describe('the page: a body at its own scale', () => {
  const floor = { corners: [[-10, -10, 0], [10, -10, 0], [10, 10, 0], [-10, 10, 0]], fill: '#445566', doubleSided: true };
  const SCALE = 'if (b.scale > 0) group.scale.setScalar(b.scale);';
  it('is emitted only when a body carries a scale', () => {
    const at = (body) => emitThreeWorld({ faces: [floor], entities: [{ id: 'hero', rule: { type: 'platform' }, body }], camera: { rule: 'follow', target: 'hero' } });
    expect(at({ type: 'mesh', shape: 'box', scale: 0.273 })).toContain(SCALE);
    expect(at({ type: 'mesh', shape: 'box' })).not.toContain(SCALE);
    expect(at({ type: 'mesh', shape: 'box', scale: 1 })).not.toContain(SCALE);
  });
});
