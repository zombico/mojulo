import { describe, it, expect, beforeAll } from 'vitest';
import { hardwarePart, hardwareError, boltLength, boreTerm, partPolys, toolOf } from './hardware.js';
import { SHEETS, sheetColor, sheetTile, bakeSheetKey, bandFor } from './sheets.js';
import { boxToCentreline } from './members.js';
import { lowerFrame, validateFrames, frameStamps } from './frame.js';
import { nestParts, isFurniture } from './furniture-checks.js';
import { fittingPositions } from './furniture-joints.js';
import { spanChecks } from './checks.js';
import { memberFrame } from './members.js';
import { ensureExactKernel } from '../polygonizer/field-exact.js';

// a knock-down bookcase: 18 mm white MFC on cams and dowels, a hardboard back in grooves, a loose shelf on pins
const bookcase = {
  id: 'bookcase', unit: 'mm',
  members: [
    { id: 'side-l', box: { min: [0, 0, 0], max: [18, 300, 1800] }, material: 'mfc' },
    { id: 'side-r', box: { min: [782, 0, 0], max: [800, 300, 1800] }, material: 'mfc' },
    { id: 'top', box: { min: [18, 0, 1782], max: [782, 300, 1800] }, material: 'mfc' },
    { id: 'bottom', box: { min: [18, 0, 60], max: [782, 300, 78] }, material: 'mfc' },
    { id: 'plinth', box: { min: [18, 20, 0], max: [782, 38, 60] }, material: 'mfc' },
    { id: 'shelf', box: { min: [18, 0, 900], max: [782, 280, 918] }, material: 'mfc' },
    { id: 'shelf-a', box: { min: [19, 0, 480], max: [781, 278, 498] }, material: 'mfc' },
    { id: 'back', box: { min: [12, 282, 72], max: [788, 285, 1788] }, material: 'hardboard', grain: 'z' },
  ],
  joints: [
    ...['top', 'bottom', 'shelf', 'plinth'].flatMap((a) => [{ type: 'cam-lock', a, b: 'side-l' }, { type: 'cam-lock', a, b: 'side-r' }]),
    { type: 'shelf-pin', a: 'shelf-a', b: 'side-l' }, { type: 'shelf-pin', a: 'shelf-a', b: 'side-r' },
    ...['side-l', 'side-r', 'top', 'bottom'].map((b) => ({ type: 'groove', a: 'back', b })),
  ],
};
const noBack = { ...bookcase, id: 'no-back', members: bookcase.members.filter((m) => m.id !== 'back'), joints: bookcase.joints.filter((j) => j.type !== 'groove') };
const leg = (id, x, y) => ({ id, box: { min: [x, y, 0], max: [x + 45, y + 45, 725] } });
const table = (depth) => ({
  id: 'table', unit: 'mm', species: 'walnut',
  members: [
    leg('leg-fl', 0, 0), leg('leg-fr', 855, 0), leg('leg-bl', 0, 555), leg('leg-br', 855, 555),
    { id: 'apron-f', box: { min: [45, 12, 630], max: [855, 32, 725] } }, { id: 'apron-b', box: { min: [45, 568, 630], max: [855, 588, 725] } },
    { id: 'apron-l', box: { min: [12, 45, 630], max: [32, 555, 725] } }, { id: 'apron-r', box: { min: [868, 45, 630], max: [888, 555, 725] } },
  ],
  joints: [['apron-f', 'leg-fl'], ['apron-f', 'leg-fr'], ['apron-b', 'leg-bl'], ['apron-b', 'leg-br'], ['apron-l', 'leg-fl'], ['apron-l', 'leg-bl'], ['apron-r', 'leg-fr'], ['apron-r', 'leg-br']]
    .map(([a, b]) => ({ type: 'mortise-tenon', a, b, pegs: 0, ...(depth ? { depth } : {}) })),
});

describe('construction/hardware — the catalog', () => {
  it('sizes a bolt, nut and washer from their standards', () => {
    const b = hardwarePart('M6x30-hex');
    expect(b).toMatchObject({ d: 6, P: 1, length: 30, clear: 6.6, head: { shape: 'hex', s: 10, k: 4 }, drive: 'spanner-10', label: 'M6×30 ISO 4017' });
    expect(hardwarePart('nut-M6')).toMatchObject({ s: 10, length: 5.2 });
    expect(hardwarePart('washer-M6')).toMatchObject({ d: 6.4, od: 12, length: 1.6 });
    expect(hardwarePart('washer-M6-large')).toMatchObject({ od: 18 });
    expect(hardwarePart('M8x40-csk').head).toMatchObject({ shape: 'csk', dk: 17.92 });
    expect(hardwarePart('M7x30-hex')).toBeNull();
    expect(hardwareError('M7x30-hex')).toMatch(/unknown hardware/);
  });
  it('names the tool a part needs', () => {
    expect(toolOf(hardwarePart('wood-4x30')).label).toBe('Pozidriv PZ2 screwdriver');
    expect(toolOf(hardwarePart('confirmat-7x50')).label).toBe('4 mm hex key');
    expect(toolOf(hardwarePart('dowel-8x35')).label).toBe('hammer');
  });
  it('picks the shortest preferred bolt that leaves thread past the nut', () => {
    // M10 through 36 mm with two washers and a nut: 36 + 2·2 + 8.4 = 48.4, plus 2 pitches → 51.4 → 55
    expect(boltLength('M10', 36, { washers: 2 })).toEqual({ length: 55, proudMm: 6.6 });
    expect(boltLength('M10', 36, { washers: 2 }).proudMm).toBeGreaterThanOrEqual(hardwarePart('M10x55-hex').P);
  });
  it('asks for a stepped hole whose countersink seats the head', () => {
    const P = hardwarePart('wood-4x30');
    const t = boreTerm(P, { at: [0, 0, 0], axis: [0, 0, 1], through: 18, material: 'particleboard' });
    expect(t.kind).toBe('lathe');
    const L = t.axisTo[2] - t.axisFrom[2];
    const rAt = (s) => { const u = (s / 1000 - t.axisFrom[2]) / L; let r = 0; for (const q of t.profile) if (q.t <= u + 1e-9) r = q.radius; return r * 1000; };
    expect(rAt(0)).toBeCloseTo(P.head.dk / 2 + 1, 3);               // the cone opens a millimetre past the head
    expect(rAt(10)).toBeCloseTo((P.d + 0.5) / 2, 3);                 // clearance through the first part
    expect(rAt(25)).toBeCloseTo((P.d * 0.6) / 2, 3);                  // the pilot in particleboard
    const polys = partPolys(P, { at: [0, 0, 0], axis: [0, 0, 1] });
    const top = Math.min(...polys.flatMap((p) => p.corners.map((c) => c[2])));
    expect(top).toBeCloseTo(0, 6);                                     // the head is flush with the face
  });
});

describe('construction/sheets — boards and their faces', () => {
  it('gives MFC a decor face and a raw core edge, banded to match by default', () => {
    const c = sheetColor('mfc', {});
    expect(c.face.mode).toBe('paint');
    expect(c.edge).toEqual({ mode: 'figure', rgb: SHEETS.mfc.base });
    expect(bandFor('mfc', undefined, '-y')).toBe('abs');
    expect(bandFor('mfc', { front: 'none' }, '-y')).toBe('none');
    expect(bandFor('particleboard', undefined, '-y')).toBe('none');
  });
  it('keys a tile with no colour, so a stain reuses the bytes', () => {
    const k = sheetTile('particleboard', 'face', { thickMm: 18 }).key;
    expect(sheetTile('particleboard', 'face', { thickMm: 18 }).key).toBe(k);
    expect(sheetColor('particleboard', { finish: { stain: '#aa7744' } }).face.mode).toBe('figure');
    const a = bakeSheetKey(sheetTile('plywood', 'edge-long', { thickMm: 18 }).key), b = bakeSheetKey(sheetTile('plywood', 'edge-long', { thickMm: 18 }).key);
    expect(a.rgb.equals(b.rgb)).toBe(true);
  });
  it('shows plywood plies on its edge: glue lines at the ply pitch', () => {
    const { rgb, nu, nv } = bakeSheetKey(sheetTile('plywood', 'edge-long', { thickMm: 18 }).key);
    const col = Array.from({ length: nv }, (_, j) => rgb[(j * nu + 5) * 3]);
    const dark = col.filter((v) => v < 170).length;
    expect(dark).toBeGreaterThan(nv * 0.05);                           // glue lines and end-grain plies
    expect(dark).toBeLessThan(nv * 0.8);
  });
});

describe('construction/members — a box is its centreline twin', () => {
  it('runs the grain along the longest side and stands the thickness as depth', () => {
    expect(boxToCentreline({ min: [0, 0, 0], max: [18, 300, 1800] })).toEqual({ from: [9, 150, 0], to: [9, 150, 1800], stock: [300, 18], up: [1, 0, 0] });
    expect(boxToCentreline({ min: [0, 0, 0], max: [800, 300, 18] }, 'y').from).toEqual([400, 0, 9]);
  });
  it('lowers a box member to the same faces as its written twin', () => {
    const box = { id: 'p', unit: 'mm', members: [{ id: 's', box: { min: [0, 0, 0], max: [800, 300, 18] }, material: 'mfc' }] };
    const twin = { id: 'p', unit: 'mm', members: [{ id: 's', ...boxToCentreline(box.members[0].box), material: 'mfc' }] };
    const a = lowerFrame(box), b = lowerFrame(twin);
    expect(JSON.stringify(a.faces)).toBe(JSON.stringify(b.faces));
  });
});

describe('construction/furniture — checks that stamp, never refuse', () => {
  beforeAll(async () => { await ensureExactKernel(); });

  it('validates boxes and sheets', () => {
    expect(validateFrames([bookcase])).toEqual([]);
    const errs = validateFrames([{ members: [{ id: 'x', box: { min: [0, 0, 0], max: [0, 1, 1] }, material: 'mfc' }, { id: 'y', from: [0, 0, 0], to: [10, 0, 0], stock: [5, 1], material: 'mfc', edges: { front: 'pvc' } }] }]).join('\n');
    expect(errs).toMatch(/box: every side at least 1 mm/);
    expect(errs).toMatch(/edges.front: 'abs'/);
  });
  it('places the knock-down fittings a carcass takes and lists them', () => {
    const { report } = lowerFrame(bookcase);
    const f = report.furniture;
    const count = Object.fromEntries(f.hardware.map((h) => [h.code, h.count]));
    // four panels × two sides; the 300 mm panels take two cams with a dowel each, the 60 mm plinth one cam
    expect(count).toEqual({ 'cam-15': 14, 'cam-bolt-15': 14, 'dowel-8x35': 12, 'shelf-pin-5': 4 });
    expect(f.tools).toEqual(['4 mm hex key', 'Pozidriv PZ2 screwdriver', 'hammer']);
    const cam = report.joints.find((j) => j.joint === 'cam-lock:top-side-l');
    expect(cam).toMatchObject({ face: 'side-l', edge: 'top', camFace: 'bottom', cams: 2, camFloorMm: 5, rigidity: 'pin' });
    expect(f.fasteners).toEqual([]);
    expect(f.interference).toEqual([]);
  });
  it('finds the order a carcass goes together in: one side, the panels, the back, the other side, the loose shelf', () => {
    const { report } = lowerFrame(bookcase);
    const members = report.assembly.order.filter((id) => report.members.some((m) => m.id === id));
    expect(members).toEqual(['side-l', 'top', 'bottom', 'plinth', 'shelf', 'back', 'side-r', 'shelf-a']);
  });
  it('racks without a back, and holds square with one', () => {
    expect(lowerFrame(bookcase).report.furniture.racking).toEqual([{ plane: 'sideways (x–z)', resisted: true, by: 'panel back' }, { plane: 'front to back (y–z)', resisted: true, by: 'panel side-l' }]);
    const { report } = lowerFrame(noBack);
    expect(report.furniture.racking[0]).toEqual({ plane: 'sideways (x–z)', resisted: false });
    expect(frameStamps(report, 'b').join('\n')).toMatch(/racks sideways \(x–z\)/);
  });
  it('tips when a child pulls on a tall bookcase, and says to fix it to the wall', () => {
    const { report } = lowerFrame(bookcase);
    const f = report.furniture;
    // the centre of mass is a hand sum of the panels
    const vol = (m) => m.box.max.map((v, i) => v - m.box.min[i]).reduce((a, b) => a * b, 1) * 1e-9;
    const kg = bookcase.members.reduce((s, m) => s + vol(m) * SHEETS[m.material].density, 0);
    expect(Math.abs(f.massKg - f.hardwareKg - kg) / kg).toBeLessThan(0.01);
    expect(f.tip.standingMarginMm).toBeGreaterThan(0);
    expect(f.tip.pull.tips).toBe(true);
    expect(frameStamps(report, 'b').join('\n')).toMatch(/fix it to the wall/);
  });
  it('sags a long particleboard shelf under books, not a short one (span/600 now, span/300 with creep)', () => {
    const F = memberFrame([0, 0, 0], [0.9, 0, 0]);
    const M = (L) => ({ id: 's', material: 'particleboard', F: memberFrame([0, 0, 0], [L, 0, 0]), L, W: 0.3, D: 0.018, xMin: 0, xMax: L });
    const at = (L) => spanChecks([M(L)], () => [0, L], { shelfKgM: 30 })[0];
    expect(at(0.9).ok).toBe(false);
    expect(at(0.4).ok).toBe(true);
    const row = SHEETS.particleboard; const w = row.density * 9.81 * 0.3 * 0.018 + 30 * 9.81; const I = (0.3 * 0.018 ** 3) / 12;
    const hand = (5 * w * 0.9 ** 4) / (384 * row.E * 1e9 * I) * 1000;
    expect(Math.abs(at(0.9).instantMm - hand) / hand).toBeLessThan(0.005);
    expect(Math.abs(at(0.9).deflMm - (1 + row.kdef) * hand) / hand).toBeLessThan(0.02);
    expect([at(0.9).instantLimitMm, at(0.9).limitMm]).toEqual([1.5, 3]);
    expect(F.L).toBeCloseTo(0.9);
  });
  it('flags a screw that pokes out and a plain screw into a particleboard edge', () => {
    const lam = { id: 'lam', unit: 'mm', members: [{ id: 'a', box: { min: [0, 0, 0], max: [300, 200, 18] }, material: 'mfc' }, { id: 'b', box: { min: [0, 0, 18], max: [300, 200, 36] }, material: 'mfc' }], joints: [{ type: 'screwed', a: 'b', b: 'a', screw: 'wood-4x50' }] };
    const f1 = lowerFrame(lam).report.furniture;
    expect(f1.fasteners.find((x) => x.issue === 'pokes')).toMatchObject({ mm: 14, code: 'wood-4x50' });
    const edge = { id: 'edge', unit: 'mm', members: [{ id: 'side', box: { min: [0, 0, 0], max: [18, 300, 600] }, material: 'particleboard' }, { id: 'shelf', box: { min: [18, 0, 300], max: [600, 300, 318] }, material: 'particleboard' }], joints: [{ type: 'screwed', a: 'shelf', b: 'side' }] };
    const f2 = lowerFrame(edge).report.furniture;
    expect(f2.fasteners.some((x) => x.issue === 'edge-screw' && x.into === 'shelf')).toBe(true);
    const conf = { ...edge, joints: [{ type: 'confirmat', a: 'shelf', b: 'side' }] };
    expect(lowerFrame(conf).report.furniture.fasteners).toEqual([]);
  });
  it('builds a table from its end frames, and catches tenons that collide in a leg', () => {
    const { report } = lowerFrame(table());
    expect(report.assembly.order).not.toBeNull();
    expect(report.assembly.subassemblies[0].parts).toHaveLength(3);
    expect(report.furniture.interference.filter((i) => i.tenons)).toHaveLength(4);
    expect(lowerFrame(table(16)).report.furniture.interference).toEqual([]);
    expect(report.furniture.racking.every((r) => r.resisted)).toBe(true);
  });
  it('nests a carcass onto its sheets', () => {
    const cl = lowerFrame(bookcase).report.furniture.cutList;
    expect(cl.map((c) => [c.material, c.thickMm, c.sheets])).toEqual([['mfc', 18, 1], ['hardboard', 3, 1]]);
    const n = nestParts([{ id: 'a', l: 2000, w: 900 }, { id: 'b', l: 2000, w: 900 }, { id: 'c', l: 2000, w: 900 }], [2440, 1220], { rotate: false });
    expect(n.sheets).toBe(3);
    expect(nestParts([{ id: 'x', l: 3000, w: 100 }], [2440, 1220]).oversize).toEqual(['x']);
  });
  it('spaces fittings 37 mm in and no further apart than asked', () => {
    expect(fittingPositions(0, 0.3).map((v) => Math.round(v * 1000))).toEqual([37, 263]);
    expect(fittingPositions(0, 0.06)).toEqual([0.03]);
    const p = fittingPositions(0, 1.2, { spacing: 0.3 });
    expect(Math.max(...p.slice(1).map((v, i) => v - p[i]))).toBeLessThanOrEqual(0.3 + 1e-9);
  });
  it('is deterministic, and leaves a timber bent alone', () => {
    expect(JSON.stringify(lowerFrame(bookcase).faces)).toBe(JSON.stringify(lowerFrame(bookcase).faces));
    const bent = { id: 'b', unit: 'cm', members: [{ id: 'p', from: [0, 0, 0], to: [0, 0, 200], stock: [15, 15] }, { id: 't', from: [0, 0, 190], to: [200, 0, 190], stock: [15, 20] }], joints: [{ type: 'mortise-tenon', a: 't', b: 'p' }] };
    expect(isFurniture(bent)).toBe(false);
    expect(lowerFrame(bent).report.furniture).toBeUndefined();
  });
});
