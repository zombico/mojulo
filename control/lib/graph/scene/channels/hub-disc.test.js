/**
 * A car's wheel seen to turn (hub-disc.js) and a driven car drawn where its camera sees it (cab-pool.js): a disc on
 * each wheel, at its hub just off its face, turned about the axle by the ground covered over the wheel's radius; the car
 * model knows its hubs; the cab placed right after the world steps it; the traffic drawn between its model's ticks.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from '../../../../public/vendor/three/three.module.min.js';

import { HUB_DISC, hubDiscSource } from './hub-disc.js';
import { cabPoolScript } from './cab-pool.js';
import { flowChannelScript } from './flow.js';
import { carModel } from '../../geotown/cars.js';

const disc = () => new Function('THREE', `${hubDiscSource()}\nreturn { __hubDisc, __hubSpin };`)(THREE);

describe('a wheel seen to turn', () => {
  it('a car model knows its four hubs, each at its wheel\'s outer face, its radius and its side', () => {
    const M = carModel('familySedan');
    expect(M.hubs).toHaveLength(4);
    for (const h of M.hubs) { expect(Math.sign(h.at[0])).toBe(h.side); expect(h.r).toBeGreaterThan(0.2); expect(h.at[2]).toBeCloseTo(h.r, 2); }
    expect(new Set(M.hubs.map((h) => Math.sign(h.at[1]))).size).toBe(2);
  });
  it('a disc stands at its hub just off the wheel, and turns about the axle by the angle it is given', () => {
    const { __hubDisc, __hubSpin } = disc(), hub = { at: [0.9, 1.4, 0.34], r: 0.34, side: 1 }, out = new THREE.Matrix4();
    expect(__hubDisc(0.34).getAttribute('position').count).toBeGreaterThan(HUB_DISC.spokes * 6);
    const at = (angle, v) => new THREE.Vector3(...v).applyMatrix4(__hubSpin(new THREE.Matrix4(), hub, angle, out));
    expect(at(0, [0, 0, 0]).toArray().map((x) => +x.toFixed(3))).toEqual([0.9 + HUB_DISC.out, 1.4, 0.34]);
    // (a quarter turn rolling forward: the disc's top goes to the front, +y)
    const top = at(Math.PI / 2, [0, 0, 0.2]);
    expect(top.y - 1.4).toBeCloseTo(0.2, 3);
    expect(top.z - 0.34).toBeCloseTo(0, 3);
  });
  it('the driven car is placed right after the world steps it, its tilt eased; the traffic drawn between ticks', () => {
    const src = cabPoolScript();
    expect(src).toContain('stepControllable = (dt, o) => { __cabStep0(dt, o); place(dt); };');
    expect(src).not.toMatch(/\(function tick\(\) \{\n    requestAnimationFrame\(tick\);/);
    expect(src).toContain('b.pitch += (b.tp - b.pitch) * k;');
    const flow = { T: { DT: 0.05 }, signals: [], near: 320, kinds: [{ model: 'box', len: 4.8 }], tints: [[0.5, 0.1, 0.1]], lanes: [], cars: [] };
    expect(flowChannelScript(flow)).toContain('s = __flNow(m, k, L, sec)');
    expect(flowChannelScript(flow)).not.toContain('__flDisc');
    expect(flowChannelScript(flow, { hubs: true })).toContain('__hubSpin(__flM, D.hubs[j], s / D.hubs[j].r, __flHM)');
  });
});
