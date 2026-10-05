import { describe, it, expect } from 'vitest';
import { assembleStageScene, STAGE_PAGE_BUDGET } from './stage.js';
import { isekaiGround, boulderFaces, layerFaces, cumulusFaces } from './isekai.js';
import { isekaiTexels, isekaiKey, ISEKAI_STYLES } from './isekai-tiles.js';
import { rampDistance } from './palette.js';
import { natureSite, rockItems } from './nature.js';
import { hexRgb } from './geom.js';
import { CURRENT_GEN_REFERENCES, CURRENT_GEN_REFERENCE_IDS } from './current-gen.js';
import { ISEKAI_MEADOW } from './style/isekai-meadow.js';
import { emitThreeWorld } from '../scene/scene-three.js';
import { collectFaceTextures } from '../landscape/surface-textures.js';

// the isekai meadow (isekai.js): machine checks for the style card's principles
const st = ISEKAI_MEADOW, P = st.principles, M = { kind: 'stage', kit: 'isekai-meadow' };
const p = assembleStageScene(M), site = natureSite(st, 1);
const centroid = (f) => f.corners.reduce((s, q) => [s[0] + q[0] / f.corners.length, s[1] + q[1] / f.corners.length, s[2] + q[2] / f.corners.length], [0, 0, 0]);
const luma = (c) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
const KEYS = Object.keys(st.tiles).flatMap((t) => ['lit', 'shade'].map((b) => `isekai:${st.id}:${t}-${b}`));

describe('the isekai meadow', () => {
  it('takes its look from the current era: Genshin Impact and Breath of the Wild, each a reference card naming the kit', () => {
    expect(CURRENT_GEN_REFERENCE_IDS).toEqual(['genshin', 'botw']);
    for (const id of st.references) {
      const r = CURRENT_GEN_REFERENCES[id];
      expect(r.kit).toBe('isekai-meadow');
      for (const k of ['title', 'setting', 'surfaces', 'palette', 'light', 'air']) expect(r[k]).toBeTruthy();
    }
    expect(ISEKAI_STYLES[st.id]).toBe(st);
  });

  it(P[0], () => {
    let n = 0;
    for (const f of p.faces) {
      const ramp = st.lock[f.group] && st.palette[st.lock[f.group]];
      if (!ramp) continue;
      for (const h of [f.fill, ...(f.cornerFills || [])].filter(Boolean)) { expect(rampDistance(hexRgb(h), ramp)).toBeLessThanOrEqual(1 / 255 + 1e-9); n++; }
    }
    expect(n).toBeGreaterThan(10000);
    for (const g of ['isekai:ground', 'isekai:trail', 'isekai:crown', 'isekai:wood', 'isekai:ridge']) expect(p.faces.some((f) => f.group === g)).toBe(true);
  });

  it(P[1], () => {
    // every tile holds nothing but its window of its ramp's stops (the pixel lock)
    for (const key of KEYS) {
      const K = isekaiKey(key), t = isekaiTexels(key), ok = new Set(K.stops.map((s) => s.join(',')));
      for (let i = 0; i < t.W * t.H; i++) if (!t.a || t.a[i]) expect(ok.has(`${t.rgb[i * 3]},${t.rgb[i * 3 + 1]},${t.rgb[i * 3 + 2]}`)).toBe(true);
    }
    // every rock and cliff face is an unlit isekai quad: the screen shows its texels and nothing else
    const drawn = p.faces.filter((f) => f.group === 'isekai:cliff' || f.group === 'isekai:rock');
    expect(drawn.length).toBeGreaterThan(1500);
    for (const f of drawn) {
      expect(f.texture).toMatch(/^isekai:isekai-meadow:(cliff|rock|hat)-(lit|shade)$/);
      expect(f.textureLit).toBeFalsy();
      expect(f.tint).toBeUndefined();
      expect(f.corners.length).toBe(4);
      expect(f.uv.length).toBe(4);
    }
    // both bands appear on cliff and rock, and a lit cliff facet turns to the sun
    for (const t of ['cliff', 'rock']) for (const b of ['lit', 'shade']) expect(drawn.some((f) => f.texture.endsWith(`${t}-${b}`))).toBe(true);
    const dir = [Math.cos(42 * Math.PI / 180) * Math.cos(Math.PI / 3), Math.cos(42 * Math.PI / 180) * Math.sin(Math.PI / 3), Math.sin(42 * Math.PI / 180)];
    const litCliff = drawn.filter((f) => f.texture.endsWith('cliff-lit')), facing = litCliff.filter((f) => f.normal[0] * dir[0] + f.normal[1] * dir[1] + f.normal[2] * dir[2] > 0);
    expect(facing.length / litCliff.length).toBeGreaterThan(0.8);
  });

  it(P[2], () => {
    for (const [name, ramp] of Object.entries(st.palette)) {
      if (name === 'sky' || name === 'far') continue;
      const d = ramp[0];
      expect(d[2]).toBeGreaterThan(d[0]);          // cool
      expect(luma(d)).toBeGreaterThan(40);         // never black
    }
  });

  it(P[3], () => {
    const rocks = rockItems(st, site, 1), hatted = rocks.filter((it) => it.size * st.rubble.unit >= st.boulder.minHat);
    expect(hatted.length).toBeGreaterThan(5);
    const hats = p.faces.filter((f) => /:hat-(lit|shade)$/.test(f.texture || '')).map(centroid), fringe = p.faces.filter((f) => f.group === 'isekai:hat').map(centroid);
    for (const it of hatted) {
      const b = boulderFaces(st, it, 1), near = (q) => Math.hypot(q[0] - it.x, q[1] - it.y) < b.s * 0.6;
      expect(hats.filter(near).length).toBeGreaterThanOrEqual(b.cap.length);   // a neighbour's may fall in the radius too
      expect(fringe.filter(near).length).toBeGreaterThanOrEqual(b.rim.length);
    }
    // a pebble wears no hat
    const pebbles = rocks.filter((it) => it.role === 'pebble');
    for (const it of pebbles.slice(0, 5)) expect(hats.some((q) => Math.hypot(q[0] - it.x, q[1] - it.y) < 0.2)).toBe(false);
    // every cliff lip hangs a fringe down its face
    const { lips } = isekaiGround(st, site);
    expect(lips.length).toBeGreaterThan(50);
    expect(p.faces.filter((f) => f.group === 'isekai:lip').length).toBe(lips.length);
    for (const l of lips) expect(l.down[2]).toBeLessThan(0);
    for (const f of p.faces.filter((f) => f.group === 'isekai:hat' || f.group === 'isekai:lip')) expect(p.cutouts).toContain(f.texture);
  });

  it(P[4], () => {
    const rocks = rockItems(st, site, 1);
    for (const it of rocks.slice(0, 40)) {
      const b = boulderFaces(st, it, 1), n = b.cap.length;
      expect(n).toBeGreaterThanOrEqual(st.boulder.sides[0]);
      expect(n).toBeLessThanOrEqual(st.boulder.sides[1]);
      expect(b.sides.length).toBe(n * (st.boulder.rings.length - 1));
      // the top is flat: every cap normal points up
      for (const f of b.cap) expect(f.normal[2]).toBeGreaterThan(0.95);
    }
  });

  it(P[5], () => {
    const sky = hexRgb(p.bg).map((v) => v * 255), far = st.layers.map((L) => st.palette.far[L.stop]);
    for (const c of far) expect(luma(sky)).toBeGreaterThan(luma(c));
    for (let i = 1; i < far.length; i++) expect(luma(far[i])).toBeGreaterThan(luma(far[i - 1]));   // further is lighter
    const shade = st.palette.grass[0], grassLit = st.palette.grass[3];
    expect(luma(far[0])).toBeGreaterThan(luma(shade));
    expect(luma(grassLit)).toBeGreaterThan(luma(shade));
  });

  it(P[6], () => {
    const L = layerFaces(st, site);
    for (const [i, layer] of st.layers.entries()) {
      const want = '#' + st.palette.far[layer.stop].map((v) => v.toString(16).padStart(2, '0')).join('');
      expect(L.filter((f) => f.fill === want).length).toBeGreaterThan(60);
      if (i) expect(layer.at).toBeGreaterThan(st.layers[i - 1].at);
    }
    expect(st.air.fog.density).toBeLessThan(0.01);
    // the near skirt carries clumps of trees, every facet a foliage stop
    const stops = new Set(st.palette.foliage.map((c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('')));
    const clumps = L.filter((f) => f.group === 'isekai:crown');
    expect(clumps.length).toBeGreaterThan(100);
    for (const f of clumps) expect(stops.has(f.fill)).toBe(true);
  });

  it(P[7], () => {
    const clouds = p.faces.filter((f) => f.group === 'isekai:cloud'), c = [site.W / 2, site.D / 2], R = Math.hypot(site.W, site.D) / 2;
    expect(clouds.length).toBe(st.cumulus.tiers.reduce((a, t) => a + t.n, 0));
    const farthest = R + Math.max(...st.layers.map((L) => L.at));
    for (const f of clouds) {
      expect(f.texture).toMatch(/^isekai:isekai-meadow:cumulus-(lit|shade)$/);
      expect(p.cutouts).toContain(f.texture);
      expect(f.textureLit).toBeFalsy();
      expect(Math.min(...f.corners.map((q) => Math.hypot(q[0] - c[0], q[1] - c[1])))).toBeGreaterThan(farthest);   // behind the ranges
    }
    expect(clouds.some((f) => f.texture.endsWith('-shade'))).toBe(true);   // the ones toward the sun, from their shaded side
    const k = st.light.key, e = (k.elevation * Math.PI) / 180, a = (k.azimuth * Math.PI) / 180, want = [Math.cos(e) * Math.cos(a), Math.cos(e) * Math.sin(a), Math.sin(e)];
    p.sky.sun.dir.forEach((v, i) => expect(v).toBeCloseTo(want[i], 4));
    expect(cumulusFaces(st, site, want)).toEqual(clouds);
  });

  it('is a recipe: the same manifest is the same payload, and the page opens under the budget', () => {
    expect(JSON.stringify(assembleStageScene(M))).toBe(JSON.stringify(p));
    const html = emitThreeWorld({ ...p, textures: collectFaceTextures(p.faces), inline: true });
    expect(html.length).toBeLessThan(STAGE_PAGE_BUDGET);
  });
});
