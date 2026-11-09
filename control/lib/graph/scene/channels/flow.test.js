// THE FLOW CHANNEL: a metro's traffic on the page, its lanes stepped and its vehicles drawn near the camera only, on the
// page's pooled templates. Emitted only with a flow; the page parses with it; none adds not one byte.
import { execFileSync } from 'node:child_process';
import { describe, it, expect } from 'vitest';
import { emitThreeWorld } from '../scene-three.js';
import { readFlow, flowChannelScript } from './flow.js';
import { TRAFFIC, buildSignals, pairLanes } from './traffic-model.js';

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
