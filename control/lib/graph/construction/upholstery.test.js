import { describe, it, expect, beforeAll } from 'vitest';
import { resolveFabric, cellRgb, warpUp, fabricError, fabricTile, bakeFabricKey, fabricSvg, inkTone } from './fabric.js';
import { lowerSoft, validateSoft, sinkMm } from './soft.js';
import { coverLayout, partPieces, coverPages } from './covers.js';
import { lowerFrame, validateFrames, frameStamps } from './frame.js';
import { manualPages } from './manual.js';
import { hatchRuns } from '../scene/hatch-lines.js';
import { weldFaces } from '../scene/wire-svg.js';
import { resolveMaterial } from '../polygonizer/materials.js';
import { DEFAULT_LIGHT } from '../polygonizer/vexar.js';
import { ensureExactKernel } from '../polygonizer/field-exact.js';

const soft1 = (s, extra = {}) => lowerSoft(s, { unitScale: 0.001, light: DEFAULT_LIGHT, mat: resolveMaterial('cloth'), fabric: 'linen', ...extra });
const openEdges = (faces, group) => {
  const key = (c) => c.map((v) => Math.round(v * 1000)).join(',');
  const E = new Map();
  for (const f of faces.filter((x) => x.group === group)) f.corners.forEach((c, i) => { const a = key(c), b = key(f.corners[(i + 1) % f.corners.length]); const k = a < b ? `${a}|${b}` : `${b}|${a}`; E.set(k, (E.get(k) || 0) + 1); });
  return [...E.values()].filter((v) => v === 1).length;
};

describe('construction/fabric — cloth from a weave draft', () => {
  it('weaves houndstooth from a 2/2 twill with four dark and four light threads each way', () => {
    const R = resolveFabric('houndstooth');
    expect([R.nx, R.ny]).toEqual([8, 8]);
    const rows = []; for (let j = 7; j >= 0; j--) { let s = ''; for (let i = 0; i < 8; i++) s += cellRgb(R, i, j)[0] < 100 ? '#' : '.'; rows.push(s); }
    // the tooth: the classic 8 × 8 houndstooth cell
    expect(rows).toEqual(['.##.....', '..##....', '#..#....', '##......', '#####..#', '######..', '####.##.', '####..##']);
    expect(R.match).toBe(false);                                        // a 9.6 mm repeat hides a mismatch
    expect(R.directional).toBe(false);
  });
  it('weaves gingham in three tones, a herringbone that turns, and a ticking that is directional', () => {
    const g = resolveFabric('gingham');
    const tones = new Set(); for (let i = 0; i < 24; i++) for (let j = 0; j < 24; j++) tones.add(cellRgb(g, i, j).join());
    expect(tones.size).toBe(2);                                          // red or white on top at every crossing …
    expect(cellRgb(g, 0, 0)).toEqual(cellRgb(g, 1, 0));                  // … solid in the red block,
    expect(cellRgb(g, 12, 0)).not.toEqual(cellRgb(g, 13, 0));            // mixed where a red weft crosses white warp
    const h = { kind: 'herringbone', o: 2, u: 2, k: 4 };
    // the twill's diagonal runs one way for four threads and back the other way for the next four
    for (let j = 0; j < 4; j++) for (let i = 0; i < 3; i++) { expect(warpUp(h, i + 1, j)).toBe(warpUp(h, i, j + 1)); expect(warpUp(h, i + 5, j)).toBe(warpUp(h, i + 4, j - 1)); }
    expect(resolveFabric('ticking').directional).toBe(true);
    expect(resolveFabric('tartan')).toMatchObject({ match: true, repeatMm: [112, 112] });
  });
  it('validates a cloth, bakes its tile and draws it at true size in colour, draft or tone', () => {
    expect(fabricError('chintz')).toMatch(/a preset/);
    expect(fabricError({ weave: 'twill-5/5', warp: 'navy' })).toMatch(/fabric.weave/);
    expect(fabricError({ weave: 'twill', warp: ['navy', 0] })).toMatch(/fabric.warp/);
    expect(fabricError({ weave: 'plain', warp: '#224466', rollMm: 5000 })).toMatch(/rollMm/);
    // a tile is the least common multiple of the weave's repeat and the colour orders: bounded, and said so by name
    const odd = ['navy', 256, 'cream', 256, 'navy', 256, 'cream', 253];               // 1021 threads, against 46
    expect(fabricError({ weave: 'herringbone-23', warp: odd })).toMatch(/fabric: the pattern repeats every 46966 × 4084 threads .* over the 4194304 crossings/);
    expect(resolveFabric({ weave: 'herringbone-23', warp: odd })).toBeNull();
    const crafted = 'fabric:' + Buffer.from(JSON.stringify({ weave: 'herringbone-23', warp: odd })).toString('base64url');
    expect(bakeFabricKey(crafted)).toBeNull();                                          // a 575 MB buffer, before
    expect(fabricError({ weave: 'herringbone-24', warp: ['navy', 256, 'cream', 256, 'navy', 256, 'cream', 256] })).toBeNull();   // 3072 × 1024
    const t = fabricTile({ weave: 'twill-2/1', warp: ['#1d2a44', 6, 'cream', 6] });
    const b = bakeFabricKey(t.key);
    expect([b.nu, b.nv]).toEqual([36, 36]);                              // 12 threads, 3 px a thread
    expect(t.tileM).toEqual([0.0072, 0.0072]);
    for (const ink of ['colour', 'draft', 'tone']) {
      const svg = fabricSvg('tartan', { widthMm: 50, heightMm: 30, ink });
      expect(svg).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" width="50mm" height="30mm"/);
      if (ink !== 'colour') expect(svg).not.toMatch(/#(?!000|fff)[0-9a-f]{6}/);   // one ink
    }
    expect([inkTone([20, 20, 20]), inkTone([240, 236, 220])]).toEqual([3, 0]);
  });
});

describe('construction/soft — cushions fluffed from the field primitives', () => {
  it('validates soft parts', () => {
    const e = validateSoft([{ id: 'a', kind: 'mattress', box: { min: [0, 0, 0], max: [500, 500, 100] } }, { id: 'b', kind: 'pillow', box: { min: [0, 0, 0], max: [500, 500, 10] }, tufting: { rows: 2, cols: 3 } }], 'soft', { unitScale: 0.001 });
    expect(e.join('\n')).toMatch(/soft\[0\]\.kind: one of cushion/);
    expect(e.join('\n')).toMatch(/soft\[1\]\.box: every side at least 20 mm/);
    expect(e.join('\n')).toMatch(/a cushion or a pad is tufted/);
  });
  it('fluffs a boxed cushion: closed, crowned past its box, piped at both seams', () => {
    const r = soft1({ id: 'c', kind: 'cushion', box: { min: [0, 0, 300], max: [600, 580, 440] }, piping: true });
    expect(openEdges(r.faces, 'c')).toBe(0);
    const zs = r.faces.filter((f) => f.group === 'c').flatMap((f) => f.corners.map((c) => c[2]));
    expect(Math.max(...zs)).toBeGreaterThan(445);                        // the crown stands past the 440 mm box
    expect(r.extras).toEqual(['c:piping']);
    expect(r.row).toMatchObject({ kind: 'cushion', fill: 'foam-hr35', sizeMm: [600, 580, 140], piping: 2, foamMm: [610, 590, 140] });
    expect(r.row.sinkMm).toBeGreaterThan(25);
    expect(r.row.sinkMm).toBeLessThan(60);
  });
  it('closes a pillow to a seam along every edge, and tufts a pad with buttons', () => {
    const p = soft1({ id: 'p', kind: 'pillow', box: { min: [0, 0, 0], max: [450, 450, 150] } });
    expect(openEdges(p.faces, 'p')).toBe(0);
    const near = p.faces.filter((f) => f.group === 'p').flatMap((f) => f.corners).filter((c) => c[0] > 440);
    expect(Math.max(...near.map((c) => Math.abs(c[2] - 75)))).toBeLessThan(0.4 * 75);   // thin at the edge seam
    const t = soft1({ id: 't', kind: 'pad', box: { min: [0, 700, 300], max: [1200, 900, 800] }, tufting: { pattern: 'diamond', rows: 3, cols: 5 } });
    expect(t.row.buttons).toBe(5 + 4 + 5);                                // alternate rows staggered
    expect(t.pleats.length).toBeGreaterThan(8);
  });
  it('sinks a firmer foam less', () => {
    expect(sinkMm('foam-hr40', 140)).toBeLessThan(sinkMm('foam-hr35', 140));
    expect(sinkMm('foam-hr35', 140)).toBeLessThan(sinkMm('foam-30', 140));
    expect(sinkMm('feather', 140)).toBe(84);
  });
});

describe('construction — a sofa', () => {
  let sofa, low;
  beforeAll(async () => {
    await ensureExactKernel();
    sofa = { id: 'sofa', unit: 'mm', build: { type: 'sofa' }, fabric: 'herringbone' };
    low = lowerFrame(sofa);
  });
  it('validates its dials', () => {
    expect(validateFrames([{ unit: 'mm', build: { type: 'sofa', seats: 6 } }])[0]).toMatch(/seats: 1 to 4/);
    expect(validateFrames([{ unit: 'mm', build: { type: 'sofa', seatH: 300 } }])[0]).toMatch(/leaves -?\d+ mm of cushion/);
    expect(validateFrames([{ unit: 'mm', build: { type: 'sofa', back: 'slung' } }])[0]).toMatch(/back: 'loose', 'tight' or 'tufted'/);
    expect(validateFrames([sofa])).toEqual([]);
  });
  it('builds a frame that goes together, holds its sitters and sits within the trade\'s ranges', () => {
    const { report } = low;
    expect(report.assembly.order).not.toBeNull();
    expect(report.assembly.subassemblies.map((s) => s.group)).toEqual(['base', 'arm-l', 'arm-r', 'back']);
    const f = report.furniture;
    expect(f.interference).toEqual([]);
    expect(f.fasteners).toEqual([]);
    expect(f.racking.every((r) => r.resisted)).toBe(true);
    const rails = report.span.filter((s) => s.member === 'rail-f' || s.member === 'rail-b');
    expect(rails.every((s) => s.ok)).toBe(true);
    expect(report.build.dials.railLoadKNm).toBeCloseTo(1.61, 2);         // three 100 kg sitters landing at twice their weight
    expect(f.seating).toMatchObject({ sitters: 3, seatHeightMm: 440, depthMm: 556, backAngleDeg: 102, widthPerSitterMm: 600, out: [] });
    expect(Object.values(f.seating.tips).some((t) => t.tips)).toBe(false);
    const springs = report.joints.find((j) => j.type === 'springs');
    expect(springs).toMatchObject({ gauge: 8, springs: 17 });
    expect(springs.pitchMm).toBeLessThanOrEqual(130);
    expect(frameStamps(report, 's')).toEqual([]);
  });
  it('hides the frame inside its padding, and shows it bare in the frame view', () => {
    const { report, faces } = low;
    expect(report.hidden).toEqual(expect.arrayContaining(['rail-f', 'rail-b', 'cb-fl', 'arm-l-in', 'back-panel']));
    const groups = new Set(faces.map((f) => f.group));
    expect(groups.has('rail-f')).toBe(false);
    expect(groups.has('seat-1')).toBe(true);
    expect(groups.has('leg-fl')).toBe(true);
    expect([...groups].some((g) => /insert-bolt:.*:bolt/.test(g))).toBe(true);   // the bolts the owner drives stay
    expect(faces.some((f) => typeof f.texture === 'string' && f.texture.startsWith('fabric:'))).toBe(true);
    const bare = lowerFrame({ ...sofa, view: 'frame' });
    const bg = new Set(bare.faces.map((f) => f.group));
    expect(bg.has('rail-f')).toBe(true);
    expect(bg.has('seat-1')).toBe(false);
    expect([...bg].some((g) => /springs:.*:spring1$/.test(g))).toBe(true);
  });
  it('cuts its covers and lays them on the roll', () => {
    const c = low.report.covers[0];
    expect(c).toMatchObject({ fabric: 'herringbone', rollMm: 1400, railroad: false, match: false });
    expect(c.metres).toBeGreaterThan(12);
    expect(c.metres).toBeLessThan(20);
    expect(c.bias.strips).toBeGreaterThan(0);
    // a patterned cloth costs more, and says so; railroading a wide piece cuts it whole
    const tartan = lowerFrame({ ...sofa, fabric: 'tartan' }).report.covers[0];
    expect(tartan.metres).toBeGreaterThan(tartan.metresUnmatched);
    const rail = lowerFrame({ ...sofa, fabric: 'linen', railroad: true }).report.covers[0];
    expect(rail.seams).toBe(0);
  });
  it('stamps what a dial pushes outside the ranges, and a cloth too weak for a seat', () => {
    const tall = lowerFrame({ id: 't', unit: 'mm', build: { type: 'sofa', seats: 2, seatH: 500, legH: 180, fill: 'foam-30' }, fabric: 'gingham' });
    const st = frameStamps(tall.report, 't').join('\n');
    expect(st).toMatch(/seat height 500 mm is outside the usual 400–480 mm/);
    expect(st).toMatch(/leg-fl is 180 mm tall on one hanger bolt/);
    expect(st).toMatch(/foam-30: seat foam under 35 kg\/m³/);
    expect(st).toMatch(/gingham is rated 15000 Martindale rubs/);
    expect(frameStamps(lowerFrame({ id: 'v', unit: 'mm', build: { type: 'sofa', seats: 1, arms: 'none' }, fabric: 'velvet' }).report, 'v').join('\n')).toMatch(/has a nap: cut every piece the same way up/);
  });
  it('writes a manual: sections as parts, cushions in last, hatched soft forms, and the cloth', () => {
    const { plan, pages } = manualPages(sofa);
    expect(plan.parts.map((p) => [p.material, p.count])).toEqual([['section', 1], ['section', 2], ['section', 1], ['timber', 6], ['soft', 3], ['soft', 3]]);
    expect(plan.hardware.map((h) => h.code)).toEqual(['hanger-bolt-M8x70', 'washer-M8', 'M8x40-socket', 'M8x30-socket']);
    expect(plan.steps.at(-2).adds).toEqual(['seat-1', 'seat-2', 'seat-3']);
    expect(plan.steps.at(-1).adds).toEqual(['back-1', 'back-2', 'back-3']);
    expect(pages.map((p) => p.name)).toEqual(expect.arrayContaining(['cover', 'inventory', 'cloth', 'cut-01']));
    // the hatch: thin round-capped strokes on the cover
    expect(pages[0].svg).toMatch(/stroke-width="0.12" stroke-linecap="round" stroke-linejoin="round"/);
  });
});

describe('scene/hatch-lines — cross-contour hatching', () => {
  it('hatches a dark cloth more than a light one, and only the groups asked', () => {
    const c = soft1({ id: 'c', kind: 'cushion', box: { min: [0, 0, 0], max: [600, 580, 140] } });
    const src = weldFaces(c.faces);
    const cam = { position: [-1800, -3600, 2600], R: null, f: 0.05, principal: [105, 148] };
    // a camera looking at the cushion from the front-left, above
    const fwd = [300 - cam.position[0], 290 - cam.position[1], 70 - cam.position[2]]; const l = Math.hypot(...fwd); const F = fwd.map((v) => v / l);
    const right = [F[1], -F[0], 0].map((v) => v / Math.hypot(F[1], F[0]));
    const down = [F[1] * right[2] - F[2] * right[1], F[2] * right[0] - F[0] * right[2], F[0] * right[1] - F[1] * right[0]].map((v) => -v);
    cam.R = [right, down, F];
    const lines = (lightness) => hatchRuns(src, cam, { groups: new Map([['c', { axes: c.frame.axes, lightness }]]), spacing: 0.8 });
    const dark = lines(0.1), light = lines(0.9);
    expect(dark.length).toBeGreaterThan(light.length);
    expect(hatchRuns(src, cam, { groups: new Map([['other', { axes: c.frame.axes, lightness: 0.1 }]]) })).toEqual([]);
    expect(JSON.stringify(lines(0.1))).toBe(JSON.stringify(dark));       // deterministic
  });
});

describe('construction/covers — pieces', () => {
  it('cuts a boxed cushion into plates, boxing and a zip boxing', () => {
    const c = soft1({ id: 'c', kind: 'cushion', box: { min: [0, 0, 0], max: [600, 580, 140] }, piping: true });
    const { pieces, pipingMm } = partPieces(c);
    expect(pieces.map((p) => [p.name, p.count, p.u, p.v])).toEqual([['plate', 2, 600, 580], ['boxing', 1, 1610, 140], ['zip boxing', 2, 750, 90]]);
    expect(pipingMm).toBe(4 * (600 + 580));
    const lay = coverLayout([c], { fabric: 'linen' });
    expect(lay.seams).toBe(1);                                           // the boxing, longer than the cloth is wide
    expect(lay.placed.every((p) => p.x >= 0 && p.x + p.w <= 1400)).toBe(true);
  });
  it('writes a part named in the recipe as text on the cutting page, escaped', () => {
    const c = soft1({ id: 'seat & <back>', kind: 'cushion', box: { min: [0, 0, 0], max: [600, 580, 140] } });
    const svg = coverPages(coverLayout([c], { fabric: 'linen' })).join('');
    expect(svg).toContain('>seat &amp; &lt;back&gt;</text>');
    expect(svg).not.toContain('<back>');
  });
});
