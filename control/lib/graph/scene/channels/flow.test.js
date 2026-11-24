// THE FLOW CHANNEL: a metro's traffic on the page, its lanes stepped and its vehicles drawn near the camera only, on the
// page's pooled templates. Emitted only with a flow; the page parses with it; none adds not one byte.
import { execFileSync } from 'node:child_process';
import { describe, it, expect } from 'vitest';
import { emitThreeWorld } from '../scene-three.js';
import { readFlow, flowChannelScript, laneBlocks, stepFlowYielding, outlineOf, outlineFaces } from './flow.js';
import { FLOW_LOD } from '../../geocity/flow.js';
import { carModel } from '../../geotown/cars.js';
import { TRAFFIC, buildSignals, pairLanes, createTrafficModel, stepTraffic, trafficTick } from './traffic-model.js';

const quad = (z, hex, s = 1) => ({ corners: [[-s, -s, z], [s, -s, z], [s, s, z], [-s, s, z]], normal: [0, 0, 1], fill: hex });
const floor = { ...quad(0, '#777777', 200), group: 'ground' };
const T = { ...TRAFFIC, GREEN: 24, AMBER: 3, CLEARANCE: 7, STOP_MARGIN: 4.2, CAR_LEN: 4.8, CAR_WID: 2, MARGIN: 0.2, GAP: 2, ACCEL: 2.5, DT: 0.05 };
const signals = buildSignals([{ x: 0, y: 0, wx: 20, wy: 20 }], 1, { w: 400, d: 400 }, T);
const lanes = pairLanes([{ axis: 'y', cross: 3, lo: -200, hi: 200, dir: 1 }, { axis: 'x', cross: -3, lo: -200, hi: 200, dir: 1 }], signals, 12, T)
  .map((L) => ({ ...L, ground: [-200, 0, 200, 0] }));
const flow = { T, signals, near: 320, kinds: [{ model: 'box', len: 4.8 }], tints: [[0.5, 0.1, 0.1]], lanes, cars: [[0, 0, 0, 0], [0, 0, 0, 0], [1, 0, 0, 0.3]] };
const pools = [{ group: 'v-paint', template: [quad(1, '#ffffff')], transforms: [], pool: 'box|paint' }, { group: 'v-trim', template: [quad(0.5, '#222222')], transforms: [], pool: 'box|trim' }];

const parses = (html) => {
  const src = [...html.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n');
  try { execFileSync(process.execPath, ['--input-type=module', '--check'], { input: src, stdio: ['pipe', 'pipe', 'pipe'] }); return null; } catch (e) { return String(e.stderr || e.message).slice(0, 400); }
};

describe('the flow channel', () => {
  it('reads a flow with lanes, signals and vehicles, and nothing else', () => {
    expect(readFlow(null)).toBe(null);
    expect(readFlow({ ...flow, cars: [] })).toBe(null);
    expect(readFlow(flow)).toBe(flow);
    const src = flowChannelScript(flow);
    for (const s of ['stepFlow = (t)', 'createTrafficModel', 'stepTraffic', '__POOLS', 'window.__mojFlow']) expect(src).toContain(s);
  });

  it('emits a page that parses, its pools registered and its step on the clock', () => {
    const html = emitThreeWorld({ faces: [floor], repeats: pools, flow, capture: true });
    expect(parses(html)).toBe(null);
    for (const s of ['const __POOLS = {}', 'if (r.pool) { __POOLS[r.pool] = geo;', ' stepFlow(t);', '"box|paint"']) expect(html).toContain(s);
  });

  it('adds not one byte without a flow, and draws no flow without its pools', () => {
    const bare = emitThreeWorld({ faces: [floor] });
    expect(emitThreeWorld({ faces: [floor], flow: null })).toBe(bare);
    expect(bare).not.toContain('stepFlow');
    expect(bare).not.toContain('__POOLS');
    expect(emitThreeWorld({ faces: [floor], flow })).not.toContain('stepFlow');
  });
});

describe('the flow far off (lod: a vehicle past its full reach drawn as its outline)', () => {
  // a model's corners as the page's pooled template holds them, flat [x, y, z, …] (each face a fan)
  const flat = (faces) => faces.flatMap((f) => f.corners.flat());
  it('cuts a car\'s outline from its own heights, its glass where its model has windows', () => {
    const M = carModel('familySedan'), O = outlineOf(flat(M.paint), flat(M.trim), FLOW_LOD), n = FLOW_LOD.bins, mid = n >> 1;
    expect(O.heights).toHaveLength(n);
    // (the roof over the bonnet and the boot, the cabin glazed and the bonnet not)
    expect(O.heights[mid]).toBeGreaterThan(O.heights[0] + 0.25);
    expect(O.heights[mid]).toBeGreaterThan(O.heights[n - 1] + 0.25);
    expect(O.glass[mid]).toBe(true);
    expect(O.glass[n - 1]).toBe(false);
    expect(O.y1 - O.y0).toBeCloseTo(M.L, 0);
    // (with no trim to say where its windows are, the nose's bin alone)
    const box = [[-1, -2, 0.4], [1, 2, 0.4], [-1, -2, 2], [1, 2, 2]].flat();
    expect(outlineOf(box, null, FLOW_LOD).glass.map((g, j) => (g ? j : -1)).filter((j) => j >= 0)).toEqual([n - 1]);
  });

  it('is a few dozen triangles where the model has hundreds, toned as the model\'s faces are', () => {
    const M = carModel('familySedan'), [pos, col] = outlineFaces(outlineOf(flat(M.paint), flat(M.trim), FLOW_LOD), FLOW_LOD);
    const tris = pos.length / 9;
    expect(tris).toBeLessThanOrEqual(120);
    expect(tris * 10).toBeLessThan(M.paint.length + M.trim.length);
    expect(col.length).toBe(pos.length);
    expect(Math.max(...col)).toBeLessThanOrEqual(1);
  });

  it('adds not one byte without lod; with it the page carries the outlines and parses', () => {
    expect(flowChannelScript({ ...flow, lod: undefined })).toBe(flowChannelScript(flow));
    const src = flowChannelScript({ ...flow, lod: FLOW_LOD });
    for (const s of ['__flOutline', 'function outlineOf', 'function outlineFaces', '__flFull2']) expect(src).toContain(s);
    expect(flowChannelScript(flow)).not.toContain('__flOutline');
    const html = emitThreeWorld({ faces: [floor], repeats: pools, flow: { ...flow, lod: FLOW_LOD }, capture: true });
    expect(parses(html)).toBe(null);
  });
});

describe('the flow played (a page with a car a hero gets into: the traffic gives way and stands in the way)', () => {
  const zAt = () => 0, L = lanes[0];
  const cabAt = (y, heading = Math.PI / 2) => ({ id: 'car-1', rule: { type: 'drive' }, mount: { cab: true, hull: [0.9, 2.2], reach: 3, stand: [-1.4, 0.2], mount: { s: 0.3 }, dismount: { s: 0.3 } }, body: { type: 'figure-rig', figure: 'c' }, transform: { pos: [3, y, 0], heading } });
  it('a page with no cab is the page it was, byte for byte; one with a cab carries the yield and parses', () => {
    expect(flowChannelScript(flow, { play: false })).toBe(flowChannelScript(flow));
    const plain = emitThreeWorld({ faces: [floor], repeats: pools, flow });
    const played = emitThreeWorld({ faces: [floor], repeats: pools, flow, entities: [cabAt(-60)] });
    expect(plain).not.toContain('flowYield');
    for (const s of ['flowYield', 'stepFlowYielding', 'laneBlocks', 'trafficHulls']) expect(played).toContain(s);
    expect(parses(played)).toBe(null);
    // (the functions' sources stand alone on the page: no name a bundler gave an import)
    expect(played).not.toMatch(/__vi_import|__vite_ssr|WEBPACK/);
  });
  it('a body in a lane is a block where it lies; beside the lane, off its ends or over it, it is none', () => {
    const body = (x, y, f = [0, 1], z = 0) => ({ p: [x, y, z], f, hw: 0.9, hl: 2.2 });
    expect(laneBlocks(L, [body(3, -60)], T, zAt)).toEqual([{ s: 140, half: 2.2 }]);
    // (turned across the lane: its width along it)
    expect(laneBlocks(L, [body(3, -60, [1, 0])], T, zAt)[0].half).toBeCloseTo(0.9);
    expect(laneBlocks(L, [body(9, -60), body(3, -260), body(3, -60, [0, 1], 6)], T, zAt)).toEqual([]);
    // (the lane that drives the other way counts from its far end)
    expect(laneBlocks({ ...L, dir: -1 }, [body(3, -60)], T, zAt)[0].s).toBe(260);
  });
  it('the vehicles behind a block stop a gap short of it and queue, never touching; the block gone, they drive on', () => {
    const cars = [0, 1, 2].map(() => ({ lane: 0, startFrac: 0, len: 4.8 })), m = createTrafficModel([L], cars, signals, T);
    const lead = () => m.cars.slice().sort((a, b) => b.s - a.s);
    // (a block a way ahead of the lane's leading vehicle, short of the crossing)
    const at = Math.min(lead()[0].s + 60, (L.crossings[0]?.sStop ?? L.total) - 12), blocks = [{ s: at, half: 2.2 }];
    // (on a slow page's clock: a frame many of the model's ticks long)
    for (let t = 0.6; t < 60; t += 0.6) stepFlowYielding(m, t, blocks, { ...T, MAX_STEPS: 1800 }, trafficTick);
    const behind = m.cars.filter((c) => c.s < at).sort((a, b) => b.s - a.s);
    expect(behind.length).toBeGreaterThan(0);
    expect(behind[0].v).toBe(0);
    expect(at - 2.2 - (behind[0].s + 2.4)).toBeGreaterThanOrEqual(T.GAP - 1e-6);
    expect(at - 2.2 - (behind[0].s + 2.4)).toBeLessThan(T.GAP + 1);
    for (let k = 1; k < behind.length; k++) expect(behind[k - 1].s - behind[k].s).toBeGreaterThanOrEqual(4.8 + T.GAP - 1e-6);
    const was = behind[0].s;
    for (let t = 60.05; t < 66; t += 0.05) stepTraffic(m, t);
    expect(behind[0].s).toBeGreaterThan(was + 5);
  });
});
