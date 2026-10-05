import { describe, it, expect } from 'vitest';
import { assembleStageScene, STAGE_PAGE_BUDGET } from './stage.js';
import { bambooItems, bambooFaces, sakuraFaces } from './isekai.js';
import { isekaiTexels, isekaiKey } from './isekai-tiles.js';
import { rampDistance } from './palette.js';
import { natureSite, treeItems } from './nature.js';
import { hexRgb } from './geom.js';
import { makeSunShadow, sunDir } from './sun.js';
import { ISEKAI_BAMBOO } from './style/isekai-bamboo.js';
import { ISEKAI_SAKURA } from './style/isekai-sakura.js';
import { emitThreeWorld } from '../scene/scene-three.js';
import { collectFaceTextures } from '../landscape/surface-textures.js';

// the isekai groves (isekai.js, style/isekai-bamboo.js, style/isekai-sakura.js): machine checks for their principles
const centroid = (f) => f.corners.reduce((s, q) => [s[0] + q[0] / f.corners.length, s[1] + q[1] / f.corners.length, s[2] + q[2] / f.corners.length], [0, 0, 0]);
const page = (p) => emitThreeWorld({ ...p, textures: collectFaceTextures(p.faces), inline: true });
const locked = (st, p) => {
  let n = 0;
  for (const f of p.faces) {
    const ramp = st.lock[f.group] && st.palette[st.lock[f.group]]; if (!ramp) continue;
    for (const h of [f.fill, ...(f.cornerFills || [])].filter(Boolean)) { expect(rampDistance(hexRgb(h), ramp)).toBeLessThanOrEqual(1 / 255 + 1e-9); n++; }
  }
  return n;
};
const texelsOk = (key) => {
  const K = isekaiKey(key), t = isekaiTexels(key), ok = new Set(K.stops.map((s) => s.join(',')));
  for (let i = 0; i < t.W * t.H; i++) if (!t.a || t.a[i]) expect(ok.has(`${t.rgb[i * 3]},${t.rgb[i * 3 + 1]},${t.rgb[i * 3 + 2]}`)).toBe(true);
};

describe('the bamboo grove', () => {
  const st = ISEKAI_BAMBOO, P = st.principles, M = { kind: 'stage', kit: 'isekai-bamboo' }, p = assembleStageScene(M), site = natureSite(st, 1);
  const items = bambooItems(st, site, 1);

  it(P[0], () => {
    const byClump = new Map(); for (const t of items) byClump.set(t.cluster, (byClump.get(t.cluster) || 0) + 1);
    expect(byClump.size).toBeGreaterThan(8);
    expect(Math.min(...byClump.values())).toBeGreaterThanOrEqual(2);
    for (const t of items) {
      expect(site.trailDist(t.x, t.y)).toBeGreaterThan(site.halfWAt(t.y) + st.trees.clearTrail - 1e-6);
      for (const u of items) if (u !== t) expect(Math.hypot(u.x - t.x, u.y - t.y)).toBeGreaterThanOrEqual(st.trees.gap - 1e-6);
    }
  });

  it(P[1], () => {
    for (const b of ['lit', 'shade']) texelsOk(`isekai:${st.id}:culm-${b}`);
    const culms = p.faces.filter((f) => f.group === 'isekai:culm');
    expect(culms.length).toBe(bambooFaces(st, site, items).culms.length);
    for (const f of culms) { expect(f.texture).toMatch(/:culm-(lit|shade)$/); expect(f.textureLit).toBeFalsy(); expect(f.tint).toBeUndefined(); }
    for (const b of ['lit', 'shade']) expect(culms.some((f) => f.texture.endsWith(b))).toBe(true);
  });

  it(P[2], () => {
    for (const b of ['lit', 'shade']) texelsOk(`isekai:${st.id}:spray-${b}`);
    const sprays = p.faces.filter((f) => f.group === 'isekai:spray');
    expect(sprays.length).toBe(items.length * st.trees.spray.per);
    for (const f of sprays) expect(p.cutouts).toContain(f.texture);
    // the sprays dapple: under the grove's canopy the floor is shaded in some places and lit in others, and more shaded
    // than open meadow away from it
    const { culms, sprays: raw } = bambooFaces(st, site, items), dir = sunDir(st.light.key.elevation, st.light.key.azimuth);
    const sh = makeSunShadow([...culms, ...raw.map((f) => ({ ...f, cel: 'spray' }))], dir, { cell: 0.6, maskOf: (f) => (f.cel === 'spray' ? isekaiTexels(`isekai:${st.id}:spray-lit`) : null) });
    const under = items.slice(0, 40).map((t) => sh([t.x - dir[0] * 4, t.y - dir[1] * 4, site.ground(t.x, t.y) + 0.1], [0, 0, 1]));
    expect(under.some((v) => v === 0)).toBe(true);
  });

  it(P[3], () => {
    for (const [name, ramp] of Object.entries(st.palette)) { if (['sky', 'far', 'cloud', 'soil'].includes(name)) continue; expect(ramp[0][2]).toBeGreaterThanOrEqual(ramp[0][0]); }
    expect(locked(st, p)).toBeGreaterThan(5000);
  });

  it('is a recipe and opens under the budget, still and live; live, the culms and sprays sway', () => {
    expect(JSON.stringify(assembleStageScene(M))).toBe(JSON.stringify(p));
    expect(page(p).length).toBeLessThan(STAGE_PAGE_BUDGET);
    const w = assembleStageScene({ ...M, wind: true });
    expect(w.liveGrass.crowns.groups).toEqual(['isekai:culm', 'isekai:spray']);
    expect(page(w).length).toBeLessThan(STAGE_PAGE_BUDGET);
  });
});

describe('the sakura grove', () => {
  const st = ISEKAI_SAKURA, P = st.principles, M = { kind: 'stage', kit: 'isekai-sakura' }, p = assembleStageScene(M), site = natureSite(st, 1);
  const trees = treeItems(st, site, 1), items = [{ ...trees[0] }, { x: trees[0].x, y: trees[0].y, h: st.trees.heroes[0].h, v: 0, cluster: -1, hero: true }];
  const grown = items.map((t) => sakuraFaces(st, site, [t]));

  it(P[0], () => {
    for (const tile of ['bloom', 'sprig']) for (const b of ['lit', 'shade']) texelsOk(`isekai:${st.id}:${tile}-${b}`);
    const blossom = p.faces.filter((f) => f.group === 'isekai:blossom'), sprigs = p.faces.filter((f) => f.group === 'isekai:sprig');
    expect(blossom.length).toBeGreaterThan(2000);
    expect(sprigs.length).toBeGreaterThan(500);
    for (const f of [...blossom, ...sprigs]) { expect(f.texture).toMatch(/:(bloom|sprig)-(lit|shade)$/); expect(f.tint).toBeUndefined(); expect(rampDistance(hexRgb(f.fill), st.palette.blossom)).toBeLessThanOrEqual(1 / 255 + 1e-9); }
    for (const b of ['lit', 'shade']) expect(blossom.some((f) => f.texture.endsWith(b))).toBe(true);
    expect(sprigs.every((f) => p.cutouts.includes(f.texture))).toBe(true);
    expect(st.palette.blossom[0][2]).toBeGreaterThan(st.palette.blossom[0][1]);   // the shade is lavender, not grey
  });

  it(P[1], () => {
    for (const b of ['lit', 'shade']) texelsOk(`isekai:${st.id}:bark-${b}`);
    const wood = p.faces.filter((f) => f.group === 'isekai:wood');
    expect(wood.length).toBeGreaterThan(500);
    for (const f of wood) { expect(f.texture).toMatch(/:bark-(lit|shade)$/); expect(f.textureLit).toBeFalsy(); }
    for (const b of ['lit', 'shade']) expect(wood.some((f) => f.texture.endsWith(b))).toBe(true);
    // the hero is grown a generation deeper than a grove tree: more limbs, more and smaller clumps
    const [g, h] = grown;
    expect(h.wood.length).toBeGreaterThan(g.wood.length * 1.5);
    expect(h.clumps.length).toBeGreaterThan(g.clumps.length);
    expect(items[1].spread).toBeGreaterThan(items[1].h * 0.4);   // wide: the spread past half the height
    // the heroes stand framed: two of them, the grove kept clear, and a camera up into the first
    const heroes = st.trees.heroes.map((H) => ({ x: site.trailX(H.y) + H.side * (site.halfWAt(H.y) + H.off), y: H.y }));
    expect(heroes.length).toBe(2);
    const trunks = wood.filter((f) => f.corners.some((c) => c[2] < site.ground(c[0], c[1]))).map(centroid);
    for (const H of heroes) expect(trunks.some((c) => Math.hypot(c[0] - H.x, c[1] - H.y) < 0.6)).toBe(true);
    const cam = p.cameras.find((c) => c.name === 'hero').worldFraming;
    expect(cam.lookAt[2]).toBeGreaterThan(cam.cameraPosition[2]);
  });

  it(P[2], () => {
    texelsOk(`isekai:${st.id}:petals-lit`); texelsOk(`isekai:${st.id}:petals-shade`);
    const petals = p.faces.filter((f) => f.group === 'isekai:petals').map(centroid);
    expect(petals.length).toBeGreaterThan(300);
    expect(p.faces.filter((f) => f.group === 'isekai:petals').every((f) => p.cutouts.includes(f.texture))).toBe(true);
    // live: the carpet's grid is set only under and near the crowns, and the petals' windows are the tile's
    const w = assembleStageScene({ ...M, wind: true }), Pt = w.liveGrass.petals, C = Pt.carpet, G = w.liveGrass.grid;
    const m = new Uint8Array(Buffer.from(C.m.__b64, 'base64'));
    const trunks = p.faces.filter((f) => f.group === 'isekai:wood' && f.corners.some((c) => c[2] < site.ground(c[0], c[1]))).map(centroid);
    const near = (q) => Math.min(...trunks.map((t) => Math.hypot(t[0] - q[0], t[1] - q[1])));
    const spread = Math.max(...p.faces.filter((f) => f.group === 'isekai:blossom').map((f) => near(centroid(f))));
    let n = 0;
    for (let j = 0; j + 1 < G.ny; j++) for (let i = 0; i + 1 < G.nx; i++) {
      if (!(m[j * (G.nx - 1) + i] & 63)) continue; n++;
      expect(near([G.x0 + (i + 0.5) * G.cell, G.y0 + (j + 0.5) * G.cell])).toBeLessThan(C.reach * spread + G.cell);
    }
    expect(n).toBeGreaterThan(100);
    expect(Pt.win).toEqual({ lit: [2, 4], shade: [0, 2] });
    expect(Pt.ramp).toEqual(st.palette.blossom);
    expect('carpet' in assembleStageScene({ kind: 'stage', kit: 'isekai-sakura' })).toBe(false);
  });

  it(P[3], () => {
    expect(locked(st, p)).toBeGreaterThan(5000);
    expect(st.palette.far.every((c) => c[2] > c[0])).toBe(true);
  });

  it('is a recipe and opens under the budget, still and live; live, the blossom and wood sway and the petals fall', () => {
    expect(JSON.stringify(assembleStageScene(M))).toBe(JSON.stringify(p));
    expect(page(p).length).toBeLessThan(STAGE_PAGE_BUDGET);
    const w = assembleStageScene({ ...M, wind: true });
    expect(w.liveGrass.crowns.groups).toEqual(['isekai:blossom', 'isekai:sprig', 'isekai:wood']);
    const on = page(w);
    expect(on.length).toBeLessThan(STAGE_PAGE_BUDGET);
    expect(w.liveGrass.petals.sources.length).toBeGreaterThan(5);
    expect(on).toContain('__mojStagePetals');
    // the bamboo has no petals
    expect('petals' in assembleStageScene({ kind: 'stage', kit: 'isekai-bamboo', wind: true }).liveGrass).toBe(false);
  });
});
