// THE MOTION RULES IN GODOT (III-b): the pilot's walk and platform rules run in the kernel (kernel/rules.gd, since
// 0.23.0) as the web runs them, standing on the level's own faces. The corpus holds the port equal to the web's
// controllable engine frame by frame (rules-conformance.js); a whole level holds it equal through the GLB, the pack and
// the bus, key for key, the pilot included.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { corpus, runRules, scenarioById, SCENARIOS } from './rules-conformance.js';
import { extractEngineScore } from './engine-score.js';
import { playBoth } from './godot-harness.js';
import { playScript } from '../game/level-equivalence.js';
import { runGodotRules, compare } from '../../../scripts/godot-rules-conformance.mjs';

const GODOT = process.env.MOJULO_GODOT;
const quad = (x0, y0, x1, y1, z = 0) => ({ corners: [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]] });

// a run up a ramp to a ledge too high to step, a jump onto it, a zone on top that ends the level
export function ledgeLevel(rule = { type: 'platform', eye: 1.7, collideRadius: 0.3 }) {
  return {
    faces: [quad(-20, -6, 4, 6), { corners: [[4, -6, 0], [10, -6, 1.5], [10, 6, 1.5], [4, 6, 0]] }, quad(10, -6, 14, 6, 1.5), quad(14, -6, 24, 6, 2.6)],
    colliders: [{ min: [14, -6, 0], max: [24, 6, 2.6] }],
    entities: [{ id: 'hero', pilotable: true, rule, transform: { pos: [0, 0, 1.7], heading: 0 } }],
    events: { sources: [{ type: 'zone', zone: 'top', at: [20, 0, 0], radius: 2, planar: true, watch: 'hero' }], reactions: [{ on: 'enter', match: { zone: 'top' }, do: 'set', var: 'won', to: 1 }] },
  };
}
// a gem whose pickup grants a double jump (game.powers), then a jump and a second press in the air
export function powerLevel() {
  return {
    faces: [quad(-20, -6, 30, 6)],
    entities: [{ id: 'hero', pilotable: true, rule: { type: 'platform', eye: 1.7 }, transform: { pos: [0, 0, 1.7], heading: 0 } }],
    events: { sources: [{ type: 'zone', zone: 'gem', at: [3, 0, 0], radius: 1.5, planar: true, watch: 'hero' }], reactions: [{ on: 'enter', match: { zone: 'gem' }, do: 'emit', type: 'pickup:double-jump' }] },
    game: { consumes: [{ slice: 'powers' }], powers: { slice: 'powers', target: 'hero', grants: { 'double-jump': { airJumps: 1 } } } },
  };
}
const hop = () => run([25, { forward: 1 }], [1, { jump: 1, jumpHeld: 1 }], [11, { jumpHeld: 1 }], [1, { jump: 1, jumpHeld: 1 }], [31, { jumpHeld: 1 }]);
// a camera rule watching the climb: what the page's camera does, the kernel's Camera3D does
const withCamera = (camera) => ({ ...ledgeLevel(), camera });
// the page's own camera driver (channels/controllable/index.js __driveCamera), lifted out of its source and run over a
// scene with no meshes: where the page puts its camera for a camera entity, frame by frame
export function pageCamera() {
  const src = fs.readFileSync(path.join(process.cwd(), 'lib/graph/scene/channels/controllable/index.js'), 'utf8');
  const a = src.indexOf('const __camRay = new THREE.Raycaster();'), b = src.indexOf('camera.lookAt(look[0], look[1], look[2]);\n}', a);
  const body = src.slice(a, b + 'camera.lookAt(look[0], look[1], look[2]);\n}'.length);
  const THREE = { Raycaster: class { set() {} intersectObjects() { return []; } }, Vector3: class { constructor(x, y, z) { Object.assign(this, { x, y, z }); } } };
  const at = [];
  const camera = { position: { set: (x, y, z) => at.splice(0, 3, x, y, z) }, lookAt() {} };
  const W = { camera: null };
  const drive = new Function('THREE', 'scene', 'camera', '__bodySet', '__world', `${body}\nreturn __driveCamera;`)(THREE, { children: [] }, camera, () => [], W);
  return (c, dt) => { W.camera = c; drive(dt); return at.slice(); };
}
const camLines = (text) => text.split('\n').filter((l) => l.startsWith('[mojulo-cam] ')).map((l) => l.split(' ').slice(1));
// a race: a car piloted over a ramp, a rival on a loop, a chase camera on the car, a checkpoint zone that counts
const LOOP = [[0, 8], [30, 8], [45, 18], [45, 38], [30, 48], [0, 48], [-15, 38], [-15, 18]];
export function raceLevel() {
  const car = { type: 'drive', horsepower: 180, mass: 1300, wheelbase: 2.7, eye: 0.6, air: true };
  return {
    faces: [quad(-80, -10, 20, 60), { corners: [[20, -10, 0], [30, -10, 2.5], [30, 4, 2.5], [20, 4, 0]] }, quad(20, 4, 80, 60), quad(30, -10, 80, 4, -0.5)],
    entities: [
      { id: 'car', pilotable: true, rule: car, transform: { pos: [0, -3, 0.6], heading: 0 }, body: { type: 'mesh', shape: 'box', size: [4, 1.8, 1.4] } },
      { id: 'rival', rule: { ...car, type: 'racer', air: false, line: LOOP, closed: true, look: 1, reach: 6, pace: 0.8 }, transform: { pos: [-2, 8, 0.6], heading: 0 }, body: { type: 'mesh', shape: 'box', size: [4, 1.8, 1.4] } },
    ],
    camera: { rule: 'follow', target: 'car', dist: 9, height: 3.5 },
    events: { sources: [{ type: 'zone', zone: 'gate', at: [50, -3, 0], radius: 4, planar: true, watch: 'car' }], reactions: [{ on: 'enter', match: { zone: 'gate' }, do: 'set', var: 'through', to: 1 }] },
  };
}
const race = () => run([110, { forward: 1 }], [30, { forward: -1 }], [40, { forward: 1, turn: 0.6 }], [20, {}]);
const run = (...parts) => parts.flatMap(([n, input]) => Array.from({ length: n }, () => ({ ...input })));
const climb = () => run([10, {}], [6, { turn: 0.5 }], [6, { turn: -0.5 }], [70, { forward: 1 }], [3, { forward: 1, jump: 1, jumpHeld: 1 }], [40, { forward: 1, jumpHeld: 1 }], [30, { forward: 1 }]);

describe('the motion rules the Godot kernel runs', () => {
  it('the corpus walks one case per path through the rules, every hand scenario a distinct one', () => {
    expect(new Set(SCENARIOS.map((s) => s.id)).size).toBe(SCENARIOS.length);
    expect(new Set(SCENARIOS.map((s) => s.entity.rule.type))).toEqual(new Set(['walk', 'platform']));
    // the probe walker steps the tread and not the shelf above it, which a walker probing from its eye would climb
    const probe = scenarioById('walk-probe');
    expect(JSON.parse(runRules(probe).at(-1)).pos[2]).toBeCloseTo(0.4 + 1.7, 6);
    const eyeProbe = { ...probe, entity: { ...probe.entity, rule: { type: 'walk', eye: 1.7 } } };
    expect(JSON.parse(runRules(eyeProbe).at(-1)).pos[2]).toBeCloseTo(1.2 + 1.7, 6);
  });

  it('the score carries the pilot\'s rule in recipe units, for a pilot the kernel runs (walk, platform, drive, fly)', () => {
    const score = extractEngineScore({ ref: 'r', manifest: {} }, ledgeLevel());
    expect(score.pilot).toEqual({ id: 'hero', rule: { type: 'platform', eye: 1.7, collideRadius: 0.3 }, pos: [0, 0, 1.7], heading: 0 });
    const drive = extractEngineScore({ ref: 'r', manifest: {} }, { entities: [{ id: 'car', pilotable: true, rule: { type: 'drive' } }] });
    expect(drive.pilot).toMatchObject({ id: 'car', rule: { type: 'drive' } });
    const glide = extractEngineScore({ ref: 'r', manifest: {} }, { entities: [{ id: 'cam', pilotable: true, rule: { type: 'glide' } }] });
    expect(glide.pilot).toBeUndefined();
    expect(extractEngineScore({ ref: 'r', manifest: {} }, raceLevel()).drivers.map((d) => d.id)).toEqual(['rival']);
    expect(extractEngineScore({ ref: 'r', manifest: {} }, { entities: [] }).pilot).toBeUndefined();
  });

  it('the web side of the whole level: the platform pilot jumps the ledge and wins; without the jump it stays below', () => {
    const won = (k) => JSON.parse(k.split('|')[0]).vars.won === 1;
    expect(playScript(ledgeLevel(), climb()).keys.some(won)).toBe(true);
    expect(playScript(ledgeLevel(), climb().map(({ jump, jumpHeld, ...rest }) => rest)).keys.some(won)).toBe(false);
  });

  // TWIN BUG: the page pulls its chase camera in by its 3-unit stand-off even with no wall between it and the hero
  // (__driveCamera: no hit leaves hitD = full, and the target is (full - skin) / full), so a follow camera always sits 3
  // units nearer than its rule says. The Godot kernel matches the page (walker.gd _show_camera); this names the bug.
  it.fails('the page\'s chase camera stands where its rule says when nothing is in the way', () => {
    const drive = pageCamera();
    const c = { transform: { pos: [0, -6, 3], heading: Math.PI / 2, pitch: 0 }, lookAt: [0, 0, 1.5], rule: { type: 'follow' } };
    expect(drive(c, 1 / 30)).toEqual([0, -6, 3]);
  });

  it.skipIf(!GODOT)('kernel/rules.gd is equal to the web\'s rules over the corpus, frame by frame (MOJULO_GODOT)', () => {
    const sc = corpus();
    const { out, errors } = runGodotRules(sc, GODOT);
    expect(errors).toEqual([]);
    const rows = compare(sc, out);
    expect(rows.filter((r) => !r.equal)).toEqual([]);
    expect(rows.reduce((n, r) => n + r.frames, 0)).toBeGreaterThan(1500);
  }, 300000);

  const PLANTS = [
    { name: 'the probe from the eye', from: 'if probe > 0.0 else p', to: 'if probe < 0.0 else p' },
    { name: 'coyote time from zero', from: 'minf(float(e.get("coyote", coyote_t)) + dt, 1.0)', to: 'minf(float(e.get("coyote", 0.0)) + dt, 1.0)' },
    { name: 'a box top with no step', from: 'if foot_z >= float(mx[2]) - step:', to: 'if foot_z > float(mx[2]):' },
    { name: 'a lane corner the wrong way', from: 'if d2 < best - 1e-12 or (bias > 0.0', to: 'if d2 < best - 1e-12 or (bias < 0.0' },
    { name: 'no jump cut', from: 'and not e.get("launchedBy")', to: 'and false' },
    { name: 'a boost at the run\'s speed', from: '((bf / bn) * boost_speed * ctl * dt', to: '((bf / bn) * speed * ctl * dt' },
    { name: 'a shot under the hillside', from: '		if not is_nan(g) and at[2] < g + 0.8:\n			at[2] = g + 0.8', to: '		pass' },
    { name: 'a shot that never looks for a clear view', from: '						if not is_nan(g) and g > z - 0.3:', to: '						if false:' },
    { name: 'a shot always on one side of the line', from: 'c["_shotSide"] = 1.0 if to_cam >= 0.0 else -1.0', to: 'c["_shotSide"] = 1.0' },
    { name: 'a push that never closes in', from: 'dist *= 1.0 + 0.35 *', to: 'dist *= 1.0 + 0.0 *' },
    { name: 'a car with no power curve', from: 'F = minf(power_n / maxf(absf(v), v_floor), traction_cap) * throttle', to: 'F = traction_cap * throttle' },
    { name: 'a car dropped off a ledge at once', from: 'p[2] = maxf(want, float(p[2]) - _num(r, "fallRate", 25.0) * dt)', to: 'p[2] = want' },
    { name: 'a ramp\'s lip found coarsely', from: '			for k in 10:', to: '			for k in 3:' },
    { name: 'a racer\'s laps not counted', from: '		if closed and int(e["lineAt"]) % n == 0:', to: '		if false:' },
    { name: 'a stall that does not sink', from: '		vz -= _num(r, "sinkRate", 6.0) * (1.0 - v / v_stall)', to: '		pass' },
    { name: 'a racer slow to back off', from: '	if float(e["stuckT"]) > 1.0:', to: '	if float(e["stuckT"]) > 2.0:' },
    { name: 'a gauge that never unlocks', from: '			e["boostLock"] = false', to: '			pass' },
  ];
  it.skipIf(!GODOT)('every planted bug in the rules is caught by the corpus (MOJULO_GODOT)', () => {
    const sc = corpus();
    for (const p of PLANTS) {
      const { out } = runGodotRules(sc, GODOT, { mutate: [{ file: 'rules.gd', from: p.from, to: p.to }] });
      expect(compare(sc, out).some((r) => !r.equal), p.name).toBe(true);
    }
  }, 900000);

  it.skipIf(!GODOT)('a whole level: the pilot climbs, jumps the ledge and wins, key for key in both engines (MOJULO_GODOT)', () => {
    for (const rule of [{ type: 'platform', eye: 1.7, collideRadius: 0.3 }, { type: 'walk', eye: 1.7, speed: 5 }]) {
      const { web, godot, compare: cmp } = playBoth(ledgeLevel(rule), climb(), { godot: GODOT });
      expect(godot.error, rule.type).toBe(null);
      expect(cmp.first, rule.type).toBe(null);
      expect(cmp.equal, rule.type).toBe(true);
      const won = (k) => JSON.parse(k.split('|')[0]).vars.won === 1;
      // the platform pilot makes the ledge; the walker steps every face under its eye, the ledge too (no jump in walk)
      expect(web.keys.some(won), rule.type).toBe(true);
    }
  }, 600000);

  it('the web side of a power: the pickup grants the air jump, and the second press climbs again', () => {
    const top = (keys) => Math.max(...keys.map((k) => Number(k.split('|')[1].split(':')[1].split(',')[2])));
    const without = powerLevel();
    without.events.reactions = [];
    expect(top(playScript(powerLevel(), hop()).keys)).toBeGreaterThan(top(playScript(without, hop()).keys));
  });

  it.skipIf(!GODOT)('a power picked up grants its move in Godot as on the web, key for key (MOJULO_GODOT)', () => {
    const { godot, compare: cmp } = playBoth(powerLevel(), hop(), { godot: GODOT });
    expect(godot.error).toBe(null);
    expect(cmp.first).toBe(null);
    expect(cmp.equal).toBe(true);
    const { compare: planted } = playBoth(powerLevel(), hop(), { godot: GODOT, mutate: [{ file: 'level.gd', from: '		walker.rule[k] = g[k]', to: '		pass' }] });
    expect(planted.equal).toBe(false);
  }, 300000);

  it.skipIf(!GODOT)('the page\'s camera rules drive the Godot camera as they drive the page\'s, frame by frame (MOJULO_GODOT)', () => {
    for (const camera of [{ rule: 'overhead', target: 'hero', dist: 10 }, { rule: 'follow', target: 'hero', dist: 5, height: 2 }, { rule: 'side', target: 'hero' },
      { rule: 'fixed', target: 'hero', stations: [{ at: [0, 9, 6], focus: [0, 0] }, { at: [16, -9, 7], focus: [16, 0, 2.6] }] }, { rule: 'eye', target: 'hero', height: 0 }]) {
      const want = [];
      playScript(withCamera(camera), climb(), { onFrame: (sim) => { const c = sim.world.camera; want.push([c.transform.pos, c.lookAt]); } });
      const { godot } = playBoth(withCamera(camera), climb(), { godot: GODOT });
      expect(godot.error, camera.rule).toBe(null);
      const got = camLines(godot.text);
      expect(got.length, camera.rule).toBe(want.length);
      const f4 = (v) => v.map((x) => x.toFixed(4)).join(',');
      for (let i = 0; i < want.length; i++) {
        expect(got[i][1], `${camera.rule} f${i} pos`).toBe(f4(want[i][0]));
        expect(got[i][2], `${camera.rule} f${i} look`).toBe(want[i][1] ? f4(want[i][1]) : 'null');
      }
      // the node stands where the page's own driver puts the page's camera (a chase camera pulled in, as the page's is)
      const drive = pageCamera(), node = [];
      playScript(withCamera(camera), climb(), { onFrame: (sim) => node.push(drive(sim.world.camera, 1 / 30)) });
      for (let i = 0; i < node.length; i++) {
        const g = got[i][3].split(',').map(Number);
        expect(g.every((x, k) => Math.abs(x - node[i][k]) < 2e-3), `${camera.rule} f${i} node ${got[i][3]} page ${node[i].map((x) => x.toFixed(4))}`).toBe(true);
      }
    }
  }, 600000);

  it('the web side of the race: the car flies the ramp and goes through the gate; the rival drives its loop', () => {
    const keys = playScript(raceLevel(), race()).keys;
    expect(keys.some((k) => JSON.parse(k.split('|')[0]).vars.through === 1)).toBe(true);
    const z = (k, i) => Number(k.split('|')[i].split(':')[1].split(',')[2]);
    expect(Math.max(...keys.map((k) => z(k, 1)))).toBeGreaterThan(60);   // in the air off the lip (quanta of 5 cm)
    expect(keys.at(-1).split('|')[2]).not.toBe(keys[0].split('|')[2]);
  });

  it.skipIf(!GODOT)('a whole race: the car, its flight and the rival, key for key in both engines, the chase camera on the car (MOJULO_GODOT)', () => {
    const want = [];
    playScript(raceLevel(), race(), { onFrame: (sim) => { const c = sim.world.camera; want.push(c.transform.pos); } });
    const { godot, compare: cmp } = playBoth(raceLevel(), race(), { godot: GODOT });
    expect(godot.error).toBe(null);
    expect(cmp.first).toBe(null);
    expect(cmp.equal).toBe(true);
    const got = camLines(godot.text).map((l) => l[1]);
    expect(got).toEqual(want.map((v) => v.map((x) => x.toFixed(4)).join(',')));
  }, 600000);

  it.skipIf(!GODOT)('a level whose ground is not read from its faces parts from the web (MOJULO_GODOT)', () => {
    const { compare: cmp } = playBoth(ledgeLevel(), climb(), { godot: GODOT, mutate: [{ file: 'level.gd', from: 'RulesScript.make_ground(_land_triangles(mpu), float(score.get("ground", 0.0)) / mpu)', to: 'RulesScript.make_ground([], 0.0)' }] });
    expect(cmp.equal).toBe(false);
  }, 300000);
});
