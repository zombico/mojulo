import { describe, it, expect } from 'vitest';
import { bambooForm, BAMBOO_FORM } from './bamboo-form.js';
import { BAMBOOS } from '../vegetation/bamboo.js';
import { floraRead, floraBox, FLORA_BAMBOO, FLORA_STRIDE } from './flora-read.js';

const species = Object.keys(BAMBOOS).find((k) => BAMBOOS[k].habit === 'running');
const unpack = (s) => { const b = Buffer.from(s, 'base64'); return new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4); };

describe('a bamboo read as form', () => {
  const B = bambooForm(species, { seed: 1, height: 10 });
  it('stands the height asked, deterministically, its culm banded at its nodes', () => {
    expect(B.height).toBeGreaterThan(8);
    expect(B.height).toBeLessThan(12);
    expect(JSON.stringify(bambooForm(species, { seed: 1, height: 10 }))).toBe(JSON.stringify(B));
    // (the culm's colours and its node bands' darker ones)
    const lum = new Set(); for (let i = 0; i < B.woodFar.col.length; i += 3) lum.add(B.woodFar.col[i] + B.woodFar.col[i + 1] + B.woodFar.col[i + 2]);
    expect(lum.size).toBeGreaterThanOrEqual(2);
    expect(B.woodFar.col.length).toBe(B.woodFar.pos.length);
    expect(B.wood.idx.length).toBeGreaterThan(B.woodFar.idx.length);
  });

  it('carries its leaves in clumps facing out of its culm and up, a spray from each heart', () => {
    expect(B.clumps.length).toBeGreaterThan(20);
    for (const c of B.clumps) { expect(c.o[2]).toBeGreaterThan(0); expect(c.p[2]).toBeGreaterThan(0); }
    expect(B.sites.length).toBe(B.clumps.length * BAMBOO_FORM.sprays);
    expect(B.leaf.outline).toBe('lance');
  });

  it('grows a bamboo card\'s culms on the trail, each leaning out of its clump', () => {
    const tree = (x, y, cluster, v) => ({ x, y, z: 0, h: 10, kind: -1, cluster, v });
    const plants = { form: 'bamboo', kinds: null, bushKinds: null, trees: [tree(0, 0, 0, 0), tree(1, 0, 0, 1), tree(0.5, 0.8, 0, 2)], bushes: [], shrubs: [] };
    const F = floraRead(plants, { colours: { foliage: '#4a983a', grass: '#7cbf48', stone: '#e2cba0', floor: '#c4875a' }, bases: { foliage: [0.1, 0.3, 0.07], floor: [0.4, 0.2, 0.1] } });
    expect(F.templates.every((t) => t.name === `bamboo:${FLORA_BAMBOO}` && t.culm)).toBe(true);
    expect(F.templates.length).toBe(3);
    const P = unpack(F.trees), cx = 0.5, cy = 0.8 / 3;
    for (let i = 0; i < 3; i++) { const yaw = P[i * FLORA_STRIDE + 4], dx = P[i * FLORA_STRIDE] - cx, dy = P[i * FLORA_STRIDE + 1] - cy; expect(Math.cos(yaw) * dx + Math.sin(yaw) * dy).toBeGreaterThan(0); }
    expect(floraBox(plants).groups).toContain('isekai:culm');
    // (the culm tinted toward the level's foliage: its colour times the tint lands nearer the foliage than its own)
    const t = [8, 9, 10].map((k) => P[k]), own = F.templates[0].culmMean, leafB = [0.1, 0.3, 0.07];
    const dist = (a) => Math.hypot(...a.map((v, k) => v - leafB[k]));
    expect(dist(own.map((v, k) => v * t[k]))).toBeLessThan(dist(own));
  });
});
