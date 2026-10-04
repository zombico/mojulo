import { describe, it, expect } from 'vitest';
import zlib from 'node:zlib';
import { assembleStageScene, buildStageGeometry, planStage } from './stage.js';
import { naveShafts, naveCutouts } from './nave.js';
import { GOTHIC_NAVE } from './style/gothic-nave.js';
import { surfaceTexture } from '../landscape/surface-textures.js';
import { emitThreeWorld } from '../scene/scene-three.js';

const NAVE_SET = { kind: 'stage', reference: 'dmc3', kit: 'gothic-nave', rooms: [{ id: 'nave', x: 0, y: 0, w: 12, d: 24, h: 13, open: ['-y', '+x'] }] };
// a tile's mean colour (0..1) from its data-URL PNG, over its opaque texels (RGB or RGBA, filter-0 rows)
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
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);

describe('the gothic-nave style card', () => {
  it('states its principles and the order its values keep', () => {
    expect(GOTHIC_NAVE.principles.length).toBeGreaterThanOrEqual(8);
    expect(GOTHIC_NAVE.values).toEqual(['glass', 'torchlit', 'pool', 'floor', 'vault']);
  });
});

describe('the dressed nave', () => {
  const scene = assembleStageScene(NAVE_SET), plan = planStage(NAVE_SET), geom = buildStageGeometry(plan);
  const { pools } = naveShafts(plan, geom.bays), torches = geom.seats.filter((s) => !s.fixture);
  const near = (c, p, r) => Math.hypot(c[0] - p.at[0], c[1] - p.at[1]) < r;
  it('is deterministic', () => {
    expect(JSON.stringify(assembleStageScene(NAVE_SET))).toBe(JSON.stringify(scene));
  });
  it('principle 1 — light leads: glass > torchlit stone > pool > the open floor > the vault, measured as baked colour × tile mean', () => {
    const corners = (sel, where = () => true) => scene.faces.filter((f) => !f.blend && sel(f)).flatMap((f) => (f.cornerFills || [f.fill]).map((h, k) => [f, f.corners[Math.min(k, f.corners.length - 1)], h])).filter(([, c]) => where(c));
    const mean = (list) => { const v = list.map(([f, , h]) => { const t = f.texture ? tileMean(f.texture) : [1, 1, 1]; return lum(hex(h).map((x, k) => x * t[k])); }); return v.reduce((a, b) => a + b, 0) / v.length; };
    const floor = (f) => f.group === 'stage:floor';
    const v = {
      glass: mean(corners((f) => f.group === 'stage:glass')),
      pool: mean(corners(floor, (c) => pools.some((p) => near(c, p, 1.0)))),
      torchlit: mean(corners((f) => f.group === 'stage:wall', (c) => torches.some((t) => Math.hypot(c[0] - t.at[0], c[1] - t.at[1], c[2] - t.at[2]) < 1.6))),
      floor: mean(corners(floor, (c) => !pools.some((p) => near(c, p, 3.2)) && !torches.some((t) => near(c, t, 3.5)))),
      vault: mean(corners((f) => f.group === 'stage:ceiling')),
    };
    console.log('[nave values]', JSON.stringify(v));
    expect(v.glass).toBeGreaterThan(v.torchlit);
    expect(v.torchlit).toBeGreaterThan(v.pool);
    expect(v.pool).toBeGreaterThan(v.floor);
    expect(v.floor).toBeGreaterThan(v.vault);
  });
  it('principle 2 — each sunward lancet throws a shaft that lands as a pool; pools are baked, never exported, never soot', () => {
    const sunward = geom.bays.filter((b) => b.lancet && b.F.N[0] > 0.5);
    expect(sunward.length).toBeGreaterThan(3);
    expect(pools).toHaveLength(sunward.length);
    for (const p of pools) { expect(p.at[0]).toBeGreaterThan(plan.rooms[0].x0 + 4); expect(p.fixture).toBe('pool'); }   // across the nave, on the floor
    const shafts = scene.faces.filter((f) => f.group === 'stage:shaft');
    expect(shafts.length).toBeGreaterThan(0);
    expect(shafts.every((f) => f.water && f.cornerAlpha.length === 4 && Math.max(...f.cornerAlpha) <= GOTHIC_NAVE.shafts.alpha[1] + 1e-9)).toBe(true);
    expect(Math.min(...shafts.flatMap((f) => f.cornerAlpha))).toBe(0);   // soft edges
    expect(scene.lights).toHaveLength(geom.seats.length);   // the pools are not lights a game engine gets
  });
  it('principle 3 — moss rises from the wall bases and grime gathers at the floor\'s edges, worn off the walking line', () => {
    const moss = scene.faces.filter((f) => f.group === 'stage:moss'), grime = scene.faces.filter((f) => f.group === 'stage:grime');
    expect(moss.length).toBeGreaterThan(100); expect(grime.length).toBeGreaterThan(20);
    expect([...moss, ...grime].every((f) => f.blend && f.cornerAlpha.length === 4 && f.cornerFills && f.texture.startsWith('floor:'))).toBe(true);
    const alphaAt = (fs, sel) => { const a = fs.flatMap((f) => f.corners.map((c, k) => [c, f.cornerAlpha[k]])).filter(([c]) => sel(c)).map(([, a]) => a); return a.reduce((x, y) => x + y, 0) / Math.max(1, a.length); };
    expect(alphaAt(moss, (c) => c[2] < 0.4)).toBeGreaterThan(0.35);
    expect(alphaAt(moss, (c) => c[2] > GOTHIC_NAVE.moss.rise[1] + GOTHIC_NAVE.moss.wander)).toBe(0);
    const r = plan.rooms[0], midX = (r.x0 + r.x1) / 2;
    expect(alphaAt(grime, (c) => c[0] - r.x0 < 1.2)).toBeGreaterThan(3 * alphaAt(grime, (c) => Math.abs(c[0] - midX) < 0.6 && c[1] > r.y0 + 4 && c[1] < r.y1 - 4) + 0.1);
    expect(emitThreeWorld({ faces: moss.slice(0, 10), textures: { 'floor:moss': surfaceTexture('floor:moss') }, inline: true })).toContain('blend layer (two-tile vertex blend)');
  });
  it('principle 4 — dressing is painted cutouts: ivy, cobwebs and banners, each on its cause; banners hang from iron rods', () => {
    expect(scene.cutouts).toEqual(['card:banner', 'card:cobweb', 'card:ivy']);
    const by = (g) => scene.faces.filter((f) => f.group === g);
    expect(by('stage:banner').length).toBeGreaterThan(0); expect(by('stage:ivy').length).toBeGreaterThan(0); expect(by('stage:cobweb').length).toBeGreaterThan(0);
    for (const b of by('stage:banner')) {
      expect(Math.min(...b.corners.map((c) => c[2]))).toBeGreaterThan(1.5);   // hung clear of a walker's head... nearly
      const top = Math.max(...b.corners.map((c) => c[2]));
      expect(by('stage:iron').some((f) => f.corners.every((c) => Math.abs(c[2] - top) < 0.2))).toBe(true);
    }
    // every card faces into the room (lit from the side the torches are on)
    const r = plan.rooms[0], centre = [(r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2];
    for (const f of [...by('stage:banner'), ...by('stage:ivy')]) expect(f.normal[0] * (centre[0] - f.corners[0][0]) + f.normal[1] * (centre[1] - f.corners[0][1])).toBeGreaterThan(0);
    // ivy hangs from the string course, and cobwebs sit in the angle at the plinth or the springing
    const zS = geom.bays.find((b) => b.zS).zS;
    for (const f of by('stage:ivy')) expect(Math.max(...f.corners.map((c) => c[2]))).toBeGreaterThan(zS);
  });
  it('principle 5 — one scale break: the great door rises well over the arcade, under an oculus, at the focus', () => {
    const door = scene.faces.filter((f) => f.group === 'stage:door'), arcade = geom.bays.find((b) => b.apex && !b.portal);
    expect(door.length).toBeGreaterThan(0);
    const portalBay = geom.bays.find((b) => b.portal);
    expect(portalBay.side).toBe(GOTHIC_NAVE.portal.side);
    expect(portalBay.apex).toBeGreaterThan(1.5 * arcade.apex);   // half again the arcade's height
    expect(Math.max(...door.flatMap((f) => f.corners.map((c) => c[2])))).toBeGreaterThan(1.4 * arcade.apex);
    const glassAbove = scene.faces.filter((f) => f.group === 'stage:glass' && f.corners.every((c) => c[2] > portalBay.apex && Math.abs(c[1] - plan.rooms[0].y1) < 1));
    expect(glassAbove.length).toBeGreaterThanOrEqual(GOTHIC_NAVE.portal.oculus.sides);
    // torches flank it
    const flank = torches.filter((t) => Math.abs(t.at[1] - plan.rooms[0].y1) < 1);
    expect(flank).toHaveLength(2);
  });
  it('principle 6 — distinct inside the radius: no two neighbouring bays on a wall dress alike when both are bare', () => {
    const cut = naveCutouts(plan, geom.bays, geom.columns);
    const dressOf = (b) => { const m = (b.u0 + b.u1) / 2, onBay = cut.filter((f) => ['stage:banner', 'stage:ivy'].includes(f.group) && f.corners.some((c) => Math.abs((c[0] - b.F.o[0]) * b.F.U[0] + (c[1] - b.F.o[1]) * b.F.U[1] - m) < (b.u1 - b.u0) / 2)); return onBay.length ? onBay[0].group : 'bare'; };
    const walls = new Map(); for (const b of geom.bays.filter((b) => !b.portal)) (walls.get(b.side) || walls.set(b.side, []).get(b.side)).push(b);
    for (const list of walls.values()) for (let i = 1; i < list.length; i++) expect(dressOf(list[i]) === 'bare' && dressOf(list[i - 1]) === 'bare').toBe(false);
  });
  it('principle 7 — the ceiling is its own material: the painted vault, not the walls\' stone or the floor\'s', () => {
    const tex = (g) => new Set(scene.faces.filter((f) => f.group === g && !f.blend).map((f) => f.texture));
    const ceiling = tex('stage:ceiling'), walls = tex('stage:wall'), floor = tex('stage:floor');
    expect([...ceiling]).toEqual([GOTHIC_NAVE.vault.key]);
    for (const k of ceiling) { expect(walls.has(k)).toBe(false); expect(floor.has(k)).toBe(false); }
    // and its value sits below the walls' (principle 1's vault is darkest): the plaster tile is darker than the stone
    expect(lum(tileMean(GOTHIC_NAVE.vault.key))).toBeLessThan(Math.min(...[...walls].map((k) => lum(tileMean(k)))));
  });
  it('principle 8 — the floor is not the walls\' grid: a hexagonal runner between kerbs, irregular flags either side', () => {
    const r = plan.rooms[0], c = (r.x0 + r.x1) / 2, F = GOTHIC_NAVE.floor, floor = scene.faces.filter((f) => f.group === 'stage:floor' && !f.blend);
    const zone = (x) => (Math.abs(x - c) < F.runner / 2 ? 'hex' : Math.abs(x - c) < F.runner / 2 + F.kerb ? 'kerb' : 'field');
    const want = { hex: F.hex.key, field: F.field.key };
    for (const f of floor) {
      const m = f.corners.reduce((a, q) => a + q[0] / f.corners.length, 0), z = zone(m);
      for (const q of f.corners) expect(['hex', 'kerb', 'field'].indexOf(zone(q[0] + Math.sign(m - q[0]) * 1e-6))).toBe(['hex', 'kerb', 'field'].indexOf(z));   // no face straddles two zones
      if (z !== 'kerb') expect(f.texture).toBe(want[z]);
    }
    expect(floor.filter((f) => zone(f.corners.reduce((a, q) => a + q[0] / 4, 0)) === 'kerb').length).toBeGreaterThan(10);
    expect(floor.some((f) => f.texture && f.texture.startsWith('flagstone'))).toBe(false);
  });
});
