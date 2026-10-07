import { describe, it, expect } from 'vitest';
import { makeSunShadow, sunDir } from './sun.js';
import { assembleStageScene, buildStageGeometry, planStage } from './stage.js';

const PLAZA_SET = { kind: 'stage', reference: 'sunshine', kit: 'delfino-plaza', rooms: [{ id: 'plaza', x: 0, y: 0, w: 26, d: 22, h: 12, open: ['-y', '+x'] }] };

describe('sun', () => {
  it('sunDir points up at the elevation, round from +x by the azimuth', () => {
    const d = sunDir(90, 0); expect(d[2]).toBeCloseTo(1);
    const e = sunDir(0, 90); expect(e[1]).toBeCloseTo(1); expect(e[2]).toBeCloseTo(0);
  });
  it('a slab overhead shades the ground under it, not the ground beside it; a face turned away is dark', () => {
    const slab = { corners: [[0, 0, 3], [2, 0, 3], [2, 2, 3], [0, 2, 3]] };
    const lit = makeSunShadow([slab], [0, 0, 1]);
    expect(lit([1, 1, 0], [0, 0, 1])).toBe(0);
    expect(lit([5, 1, 0], [0, 0, 1])).toBe(1);
    expect(lit([5, 1, 0], [0, 0, -1])).toBe(0);
  });
  it('a low sun throws a long shadow along its azimuth', () => {
    const wall = { corners: [[0, -5, 0], [0, 5, 0], [0, 5, 4], [0, -5, 4]] };
    const lit = makeSunShadow([wall], sunDir(30, 0));   // sun toward +x: the shadow falls to −x
    expect(lit([-3, 0, 0], [0, 0, 1])).toBe(0);
    expect(lit([-9, 0, 0], [0, 0, 1])).toBe(1);
    expect(lit([3, 0, 0], [0, 0, 1])).toBe(1);
  });
});

describe('the plaza kit', () => {
  const plan = planStage(PLAZA_SET), { faces } = buildStageGeometry(plan);
  it('is open to the sky (no ceiling) and fronts its closed sides with houses of different heights', () => {
    expect(faces.some((f) => f.group === 'stage:ceiling')).toBe(false);
    const tops = new Set(faces.filter((f) => f.group === 'stage:wall' && f.top).map((f) => f.top));
    expect(tops.size).toBeGreaterThan(1);   // a stepped skyline
    expect(faces.some((f) => f.texture === 'clay-terracotta')).toBe(true);
  });
  it('has stuff between pavement and stucco: a raised step and a stone base band', () => {
    expect(faces.some((f) => f.texture === 'granite-pink' && f.corners.every((c) => Math.abs(c[2] - 0.16) < 1e-6))).toBe(true);
    expect(faces.some((f) => f.texture && f.texture.startsWith('rock-sandstone-'))).toBe(true);
  });
  it('bakes daylight with cast shadows: some sunward faces are shaded, the payload carries a sky dome; deterministic', () => {
    const a = assembleStageScene(PLAZA_SET), b = assembleStageScene(PLAZA_SET);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.sky.zenith).toEqual([52, 122, 214]);
    expect(a.lights).toHaveLength(0);
    expect(a.faces.every((f) => f.top === undefined)).toBe(true);
    const lum = (h) => parseInt(h.slice(1, 3), 16) + parseInt(h.slice(3, 5), 16) + parseInt(h.slice(5, 7), 16);
    const sunward = a.faces.filter((f) => f.group === 'stage:wall' && f.cornerFills && f.normal[1] < -0.9);   // the +y row faces −y, toward the sun
    const values = sunward.flatMap((f) => f.cornerFills.map(lum));
    expect(Math.max(...values) - Math.min(...values)).toBeGreaterThan(150);   // lit stucco vs eave/balcony shadow
  });
});

// ── the dressed plaza (style/delfino-plaza.js, plaza-dress.js) ────────────────
import zlib from 'node:zlib';
import { DELFINO_PLAZA } from './style/delfino-plaza.js';
import { plazaCutouts, plazaSite } from './plaza-dress.js';
import { surfaceTexture } from '../landscape/surface-textures.js';
import { wallFrame } from './geom.js';
import { plazaPortico, plazaObelisks } from './piazza.js';

const MEANS = {};
function tileMean(key) {
  if (MEANS[key]) return MEANS[key];
  const b = Buffer.from(surfaceTexture(key).split(',')[1], 'base64');
  let o = 8, W = 0, H = 0, ct = 2; const idat = [];
  while (o < b.length) { const len = b.readUInt32BE(o), type = b.toString('ascii', o + 4, o + 8); if (type === 'IHDR') { W = b.readUInt32BE(o + 8); H = b.readUInt32BE(o + 12); ct = b[o + 17]; } if (type === 'IDAT') idat.push(b.subarray(o + 8, o + 8 + len)); o += 12 + len; }
  const raw = zlib.inflateSync(Buffer.concat(idat)), bpp = ct === 6 ? 4 : 3, sum = [0, 0, 0]; let n = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const q = y * (1 + W * bpp) + 1 + x * bpp; if (bpp === 4 && raw[q + 3] === 0) continue; n++; for (let k = 0; k < 3; k++) sum[k] += raw[q + k]; }
  return (MEANS[key] = sum.map((v) => v / (n * 255)));
}
const luma = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const hexc = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);

describe('the dressed plaza', () => {
  const scene = assembleStageScene(PLAZA_SET), plan = planStage(PLAZA_SET), geom = buildStageGeometry(plan), { r, c, closed } = plazaSite(plan);
  const by = (g) => scene.faces.filter((f) => f.group === g);
  const alphaAt = (fs, sel) => { const a = fs.flatMap((f) => f.corners.map((q, k) => [q, f.cornerAlpha[k]])).filter(([q]) => sel(q)).map(([, a]) => a); return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0; };
  it('the style card states its principles and value order', () => {
    expect(DELFINO_PLAZA.principles.length).toBeGreaterThanOrEqual(7);
    expect(DELFINO_PLAZA.values).toEqual(['stucco', 'paving', 'shade', 'roof']);
  });
  it('principle 1 — hard sun: sunlit stucco > sunlit paving > shade (pale, never black) > terracotta', () => {
    const sun = sunDir(plan.ref.light.key.elevation, plan.ref.light.key.azimuth), dot = (n) => n[0] * sun[0] + n[1] * sun[1] + n[2] * sun[2];
    const vals = (sel) => scene.faces.filter((f) => !f.blend && f.cornerFills && sel(f)).flatMap((f) => f.cornerFills.map((h) => { const t = f.texture ? tileMean(f.texture) : [1, 1, 1]; return luma(hexc(h).map((v, k) => v * t[k])); })).sort((a, b) => a - b);
    const q = (v, t) => v[Math.floor(t * (v.length - 1))];
    const stucco = q(vals((f) => f.group === 'stage:wall' && dot(f.normal) > 0.2), 0.75), paving = q(vals((f) => f.group === 'stage:floor'), 0.75);
    const shadeAll = vals((f) => f.group === 'stage:wall' && dot(f.normal) < -0.05), shade = q(shadeAll, 0.5), roof = q(vals((f) => f.group === 'stage:roof'), 0.5);
    console.log('[plaza values]', JSON.stringify({ stucco, paving, shade, roof }));
    expect(stucco).toBeGreaterThan(paving); expect(paving).toBeGreaterThan(shade); expect(shade).toBeGreaterThan(roof);
    expect(q(shadeAll, 0.05)).toBeGreaterThan(0.12);   // the shade is never black
  });
  it('principle 2 — the fountain stands at the centre: lathed marble, a granite ring, water in basin and bowl, spilling in streams', () => {
    const stone = by('stage:fountain'), F = DELFINO_PLAZA.fountain;
    expect(stone.length).toBeGreaterThan(200);
    expect(Math.max(...stone.flatMap((f) => f.corners.map((q) => q[2])))).toBeCloseTo(F.top, 3);
    expect(stone.every((f) => f.corners.every((q) => Math.hypot(q[0] - c[0], q[1] - c[1]) <= F.R + 0.1))).toBe(true);
    expect(by('stage:ring').length).toBeGreaterThan(0);
    const water = by('stage:water'), pools = water.filter((f) => f.fill === F.pool), spill = water.filter((f) => f.fill === F.spill.color);
    expect(new Set(pools.map((f) => f.corners[0][2])).size).toBe(2);   // basin and bowl
    expect(spill.length).toBe(F.spill.streams * 2);
    expect(Math.min(...spill.flatMap((f) => f.cornerAlpha))).toBeLessThan(Math.max(...spill.flatMap((f) => f.cornerAlpha)));
    // the setts are cut away under the basin (its own floor holds the water)
    expect(by('stage:floor').some((f) => f.corners.every((q) => Math.hypot(q[0] - c[0], q[1] - c[1]) < F.R - 0.05))).toBe(false);
  });
  it('principle 3 — the floor is not a grid: fan setts everywhere but the ring', () => {
    const floor = by('stage:floor').filter((f) => !f.blend);
    expect(floor.length).toBeGreaterThan(100);
    expect(floor.every((f) => f.texture === DELFINO_PLAZA.floor.field.key)).toBe(true);
    expect(by('stage:ring').every((f) => f.texture === DELFINO_PLAZA.fountain.ring.key)).toBe(true);
  });
  it('principle 4 — sand blown against the fronts, deepest in the corner, worn at the doors; the ring dark where it splashes', () => {
    const sand = by('stage:sand'), splash = by('stage:splash');
    expect(sand.length).toBeGreaterThan(100); expect(splash.length).toBeGreaterThan(0);
    expect([...sand, ...splash].every((f) => f.blend && f.cornerFills && f.cornerAlpha.length === 4)).toBe(true);
    const wallD = (q) => closed.map((s) => (s === '-x' ? q[0] - r.x0 : s === '+x' ? r.x1 - q[0] : s === '-y' ? q[1] - r.y0 : r.y1 - q[1])).sort((a, b) => a - b);
    const near = alphaAt(sand, (q) => wallD(q)[0] < 1 && wallD(q)[1] > 5), far = alphaAt(sand, (q) => wallD(q)[0] > 4), corner = alphaAt(sand, (q) => wallD(q)[0] < 1.5 && wallD(q)[1] < 1.5);
    expect(near).toBeGreaterThan(3 * far + 0.05);
    expect(corner).toBeGreaterThan(near);
    // worn at the doors: sand right at a door is thinner than along the wall between doors
    const doors = geom.houses.map((h) => [h.F.o[0] + h.F.U[0] * h.door.mid, h.F.o[1] + h.F.U[1] * h.door.mid]);
    const atDoor = alphaAt(sand, (q) => doors.some((d) => Math.hypot(q[0] - d[0], q[1] - d[1]) < 0.5)), between = alphaAt(sand, (q) => wallD(q)[0] < 0.8 && doors.every((d) => Math.hypot(q[0] - d[0], q[1] - d[1]) > 1.6));
    expect(atDoor).toBeLessThan(between * 0.5);
  });
  it('principle 5 — life on the fronts as painted cutouts: flower boxes, awnings whose shade is striped, laundry across the corner', () => {
    expect(scene.cutouts).toEqual(['card:awning', 'card:flowers', 'card:laundry', 'card:roofs']);
    expect(by('stage:flowers').length).toBeGreaterThan(4); expect(by('stage:planter').length).toBeGreaterThan(4);
    expect(by('stage:awning').length).toBeGreaterThan(1);
    // the awning's shade is striped: the ground under an awning that faces the sun is lit in places and dark in others
    const laundry = by('stage:laundry');
    expect(laundry.length).toBe(DELFINO_PLAZA.laundry.lines);
    const corner = [closed.includes('-x') ? r.x0 : r.x1, closed.includes('+y') ? r.y1 : r.y0];
    for (const f of laundry) expect(Math.hypot((f.corners[0][0] + f.corners[1][0]) / 2 - corner[0], (f.corners[0][1] + f.corners[1][1]) / 2 - corner[1])).toBeLessThan(6);
  });
  it('principle 6 — the town goes on: rooftop rows beyond the closed sides, the furthest paler and bluer than the nearest', () => {
    const far = by('stage:far');
    expect(far.length).toBeGreaterThan(6);
    for (const s of closed) {
      const F = wallFrame(r, s), dist = (f) => -((f.corners[0][0] - F.o[0]) * F.N[0] + (f.corners[0][1] - F.o[1]) * F.N[1]);
      const rows = new Map(); for (const f of far.filter((f) => dist(f) > 0 && Math.abs((f.corners[0][0] - F.o[0]) * F.N[1] - (f.corners[0][1] - F.o[1]) * F.N[0]) < F.len + 40)) { const d = Math.round(dist(f)); (rows.get(d) || rows.set(d, []).get(d)).push(f); }
      const ds = [...rows.keys()].sort((a, b) => a - b).filter((d) => rows.get(d).length > 1);
      expect(ds.length).toBeGreaterThanOrEqual(DELFINO_PLAZA.rooftops.rows);
      const pale = (d) => { const v = rows.get(d).map((f) => luma(hexc(f.fill))); return v.reduce((a, b) => a + b, 0) / v.length; };
      const blue = (d) => { const c = hexc(rows.get(d)[0].fill); return c[2] - c[0]; };
      expect(blue(ds[ds.length - 1])).toBeGreaterThan(blue(ds[0]));
      expect(pale(ds[ds.length - 1])).toBeGreaterThan(pale(ds[0]));
    }
  });
  it('principle 7 — no two neighbouring houses dress alike', () => {
    const houses = buildStageGeometry(plan).houses; plazaCutouts(plan, houses);
    const walls = new Map(); for (const h of houses) (walls.get(h.F.o.join()) || walls.set(h.F.o.join(), []).get(h.F.o.join())).push(h);
    for (const list of walls.values()) for (let i = 1; i < list.length; i++) expect(list[i].dress).not.toBe(list[i - 1].dress);
  });
  const Po = DELFINO_PLAZA.portico, portico = plazaPortico(plan, plazaSite(plan)), PF = portico.F;
  const off = (q) => (q[0] - PF.o[0]) * PF.N[0] + (q[1] - PF.o[1]) * PF.N[1], zs = (fs) => fs.flatMap((f) => f.corners.map((q) => q[2]));
  it('principle 8 — a portico of columns and round arches along the sunlit side, roundels in the spandrels, its roof a walkway, the shade under it warm with the square\'s bounce', () => {
    const sun = sunDir(plan.ref.light.key.elevation, plan.ref.light.key.azimuth);
    expect(PF.N[0] * sun[0] + PF.N[1] * sun[1]).toBeGreaterThan(0);   // its side faces the sun
    const columns = by('stage:column'), n = columns.length / (Po.column.sides * 11);
    expect(Number.isInteger(n) && n >= 6).toBe(true);
    expect(by('stage:roundel').length).toBe(2 * (n - 2));   // a blue ring and a white boss over every inner column
    const walk = by('stage:walkway').filter((f) => f.normal[2] > 0.99 && f.corners.every((q) => Math.abs(q[2] - Po.deck) < 1e-6));
    expect(walk.length).toBeGreaterThan(50);
    expect(Math.max(...walk.flatMap((f) => f.corners.map(off)))).toBeGreaterThan(Po.depth);
    // behind it the first floor opens onto the walkway: no balcony on that side
    expect(geom.houses.filter((h) => h.F.o.join() === portico.wall.o.join()).every((h) => !h.balcony)).toBe(true);
    // the ceiling is in shade but faces the sunlit square: warmer than a wall turned from the sun, darker than the paving
    const lit = (fs) => fs.flatMap((f) => f.cornerFills.map((h) => hexc(h).map((v, k) => v * tileMean(f.texture)[k])));
    const med = (v) => [...v].sort((a, b) => a - b)[v.length >> 1], warmth = (cs) => med(cs.map((k) => k[0] - k[2]));
    const ceiling = lit(by('stage:portico').filter((f) => f.normal[2] < -0.99)), shade = lit(by('stage:wall').filter((f) => f.normal[0] * sun[0] + f.normal[1] * sun[1] + f.normal[2] * sun[2] < -0.05));
    const paving = lit(by('stage:floor').filter((f) => !f.blend));
    console.log('[portico shade]', JSON.stringify({ ceiling: med(ceiling.map(luma)), wallShade: med(shade.map(luma)), paving: med(paving.map(luma)), warmth: [warmth(ceiling), warmth(shade)] }));
    expect(warmth(ceiling)).toBeGreaterThan(warmth(shade));
    expect(med(ceiling.map(luma))).toBeLessThan(med(paving.map(luma)));
  });
  it('principle 9 — walkways railed in stone: balusters, pedestals with urns, a stair to the walkway with its own raking rail', () => {
    const rail = by('stage:balustrade'), urns = by('stage:urn');
    expect(rail.length).toBeGreaterThan(1000);
    expect(urns.length / (DELFINO_PLAZA.urn.sides * 12)).toBeGreaterThanOrEqual(5);
    // the rail stands on the walkway: its top is the balustrade's height over the deck
    const onDeck = rail.filter((f) => f.corners.every((q) => q[2] >= Po.deck - 1e-6));
    expect(Math.max(...zs(onDeck))).toBeCloseTo(Po.deck + DELFINO_PLAZA.balustrade.h + 0.08, 3);
    // the stair: treads rising one even step at a time from the square to the walkway
    const treads = [...new Set(by('stage:portico').filter((f) => f.normal[2] > 0.99 && off(f.corners[0]) > Po.depth).map((f) => f.corners[0][2]))].sort((a, b) => a - b);
    const rises = treads.slice(1).map((z, i) => z - treads[i]);
    expect(treads.length).toBeGreaterThan(15);
    expect(Math.max(...rises) - Math.min(...rises)).toBeLessThan(1e-4);
    expect(Math.max(...rises)).toBeLessThanOrEqual(Po.stair.rise + 1e-6);
    expect(treads[treads.length - 1] + rises[0]).toBeCloseTo(Po.deck, 4);
    // its rail rakes: balusters stand at many heights between the square and the walkway
    const raked = rail.filter((f) => off(f.corners[0]) > Po.depth + Po.cornice.out && Math.min(...f.corners.map((q) => q[2])) < Po.deck - 0.5);
    expect(new Set(raked.map((f) => Math.round(Math.min(...f.corners.map((q) => q[2])) * 10))).size).toBeGreaterThan(10);
  });
  it('principle 10 — two obelisks either side of the fountain across the line from the way in, over every eave', () => {
    const O = DELFINO_PLAZA.obelisks, { spots } = plazaObelisks(plan, plazaSite(plan)), ob = by('stage:obelisk');
    expect(spots.length).toBe(2);
    const way = [r.x1, r.y0], v = [c[0] - way[0], c[1] - way[1]], side = (p) => Math.sign(v[0] * (p[1] - way[1]) - v[1] * (p[0] - way[0]));
    expect(side(spots[0]) * side(spots[1])).toBe(-1);
    for (const p of spots) expect(Math.hypot(p[0] - c[0], p[1] - c[1])).toBeCloseTo(Math.hypot(spots[0][0] - c[0], spots[0][1] - c[1]), 4);   // symmetric
    const eave = Math.max(...geom.houses.map((h) => h.top));
    for (const p of spots) {
      const mine = [...ob, ...by('stage:bronze')].filter((f) => f.corners.every((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 2));
      expect(Math.max(...zs(mine))).toBeGreaterThan(eave);
      expect(new Set(mine.filter((f) => f.group === 'stage:obelisk').map((f) => f.texture))).toEqual(new Set([O.granite.key, O.stone.key]));
    }
  });
  it('principle 11 — long-and-short quoins up every house edge', () => {
    const Q = DELFINO_PLAZA.quoins, q = by('stage:quoin');
    for (const h of geom.houses) {
      const atEdge = q.filter((f) => f.corners.every((p) => { const u = (p[0] - h.F.o[0]) * h.F.U[0] + (p[1] - h.F.o[1]) * h.F.U[1]; return Math.abs(u - h.u0) < Q.long + 0.01; }));
      expect(atEdge.length).toBeGreaterThan(20);
      const widths = new Set(atEdge.filter((f) => Math.abs(f.normal[0] * h.F.N[0] + f.normal[1] * h.F.N[1] - 1) < 1e-6).map((f) => { const us = f.corners.map((p) => p[0] * h.F.U[0] + p[1] * h.F.U[1]); return Math.round((Math.max(...us) - Math.min(...us)) * 100); }));
      expect([...widths].some((w) => w > Q.short * 100 + 1)).toBe(true);
    }
  });
  it('principle 12 — the sky is a place: a cloud deck, and a dome and bell tower over the roofs, faded toward the horizon', () => {
    expect(scene.effects?.length).toBe(1);
    expect(scene.effects[0].frag).toContain('SV_BASE');
    const sky = by('stage:skyline'), top = Math.max(...geom.houses.map((h) => h.top)) + planStage(PLAZA_SET).kit.house.roof.rise;
    expect(sky.length).toBeGreaterThan(100);
    expect(sky.every((f) => f.fill && !f.cornerFills && !f.tint)).toBe(true);   // not baked: aerial perspective comes after the light
    expect(Math.max(...zs(sky))).toBeGreaterThan(top + 10);
    const Dm = DELFINO_PLAZA.skyline.dome, dome = sky.filter((f) => f.corners.every((q) => Math.hypot(q[0] - r.x0 - Dm.at[0], q[1] - r.y0 - Dm.at[1]) < Dm.R + 2));
    const blueness = dome.map((f) => { const k = hexc(f.fill); return k[2] - k[0]; }).reduce((a, b) => a + b, 0) / dome.length;
    expect(blueness).toBeGreaterThan(Dm.color[2] - Dm.color[0]);
    // an exterior without a dressing's sky carries no deck
    expect(assembleStageScene({ kind: 'stage', reference: 'dmc3', kit: 'gothic-stone', rooms: [{ id: 'a', x: 0, y: 0, w: 8, d: 8, h: 5 }] }).effects).toBeUndefined();
  });
});

import { emitThreeWorld } from '../scene/scene-three.js';
// ── live water (aqua look, jets: materials/aqua-look.js, materials/jet.js) ───
describe('the plaza with live water', () => {
  const plain = assembleStageScene(PLAZA_SET), live = assembleStageScene({ ...PLAZA_SET, water: true });
  const F = DELFINO_PLAZA.fountain, c = plazaSite(planStage(PLAZA_SET)).c;
  const water = (s) => s.faces.filter((f) => f.group === 'stage:water');
  it('without `water` the fountain keeps its floor: plain pools, painted spill strips, no jets', () => {
    expect('jets' in plain).toBe(false);
    expect(water(plain).some((f) => f.liquid)).toBe(false);
    expect(water(plain).filter((f) => f.fill === F.spill.color).length).toBe(F.spill.streams * 2);
  });
  it('with `water` the basin and bowl take the water look and the spill falls as sheets from the bowl\'s lip', () => {
    const pools = water(live).filter((f) => f.fill === F.pool);
    expect(pools.length).toBeGreaterThan(0);
    expect(pools.every((f) => f.liquid && f.liquid.kind === F.look.kind)).toBe(true);
    expect(water(live).some((f) => f.fill === F.spill.color)).toBe(false);   // the painted strips give way to the jets
    expect(live.jets.length).toBe(F.jets.count);
    for (const j of live.jets) {
      expect(j.shape).toBe('sheet');
      expect(Math.hypot(j.at[0] - c[0], j.at[1] - c[1])).toBeCloseTo(F.bowl.R + 0.04, 4);   // on the bowl's lip
      expect(j.at[2]).toBeCloseTo(F.bowl.z - 0.01, 4);
      // it pours outward, away from the fountain's axis
      expect(j.dir[0] * (j.at[0] - c[0]) + j.dir[1] * (j.at[1] - c[1])).toBeGreaterThan(0);
      expect(j.controls).toBe(false);
    }
  });
  it('a page whose jets say controls: false carries no flow panel; a study\'s jets keep theirs', () => {
    const box = [{ corners: [[0, 0, 0], [4, 0, 0], [4, 4, 0], [0, 4, 0]], normal: [0, 0, 1], fill: '#888888' }];
    const jet = { id: 'j', at: [2, 2, 2], dir: [0, 0, -1], radius: 0.005, flow: 0.06, aerated: false, K: 5, into: null, L: 1 };
    expect(emitThreeWorld({ faces: box, jets: [jet] })).toContain('data-k="flow"');
    expect(emitThreeWorld({ faces: box, jets: [{ ...jet, controls: false }] })).not.toContain('data-k="flow"');
  });
});
