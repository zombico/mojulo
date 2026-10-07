// fabricate_solid: the plan first (nothing minted), then a scad source or a workbench frame minted with the plan beside it.

process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, expect, it } from 'vitest';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { loadOpenscad } from '@/lib/graph/scad/scad-render';
import { fabricateSolidHandler } from './fabricate.js';
import { mintSolidHandler } from './mint-solid.js';
import { exportModelHandler } from './sketch-model-export.js';

const hasWasm = (await loadOpenscad()) != null;
const NEEDS = [{ id: 'lid', function: 'fasten', tags: ['serviceable'], count: 4 }, { id: 'axle', function: 'spin', shaftD: 8 }];

// A carcass's top and bottom on two sides: four cam-lock corners, a hardboard back in grooves.
const box = (min, max, material = 'mfc', extra = {}) => ({ box: { min, max }, material, ...extra });
const CARCASS = [{ id: 'cabinet', unit: 'mm', members: [
  { id: 'side-l', ...box([0, 0, 0], [18, 300, 800]) }, { id: 'side-r', ...box([582, 0, 0], [600, 300, 800]) },
  { id: 'top', ...box([18, 0, 782], [582, 300, 800]) }, { id: 'bottom', ...box([18, 0, 60], [582, 300, 78]) },
], joints: [
  { type: 'cam-lock', a: 'top', b: 'side-l' }, { type: 'cam-lock', a: 'top', b: 'side-r' },
  { type: 'cam-lock', a: 'bottom', b: 'side-l' }, { type: 'cam-lock', a: 'bottom', b: 'side-r' },
] }];

let mintedCams;

describe('fabricate_solid', () => {
  it('needs alone hand back the plan and mint nothing', async () => {
    const r = await fabricateSolidHandler({ host: 'printed', needs: NEEDS });
    expect(r).toMatchObject({ ok: true, phase: 'plan', minted: false });
    expect(r.fabrication.needs.map((n) => [n.strategy, n.executor])).toEqual([['heatset-bolt', 'scad'], ['ball-bearing', 'scad']]);
    expect(r.fabrication.executors).toEqual(['scad']);
    expect(r.fabrication.modules).toContain('mj_bearing_seat');
    expect(r.next).toMatch(/`source`: an OpenSCAD program/);
  });

  it('a wood need is planned as a frame joint, and the next step says to write it in `frames`', async () => {
    const r = await fabricateSolidHandler({ host: 'wood', tags: ['flat-pack'], needs: [{ id: 'corners', function: 'fasten', count: 4 }, { id: 'door', function: 'hinge', tags: ['hidden'] }] });
    expect(r.fabrication.needs.map((n) => [n.strategy, n.executor])).toEqual([['cam-lock', 'frames'], ['concealed-cup', 'frames']]);
    expect(r.fabrication.joints).toEqual([{ need: 'corners', type: 'cam-lock', count: 4 }, { need: 'door', type: 'hinge', count: 1 }]);
    expect(r.fabrication.cuts).toEqual([]);
    expect(r.next).toMatch(/`frames`: a workbench frames entry/);
  });

  it('a bad needs list, or both bodies at once, is taught with the manual pointer', async () => {
    const { ensureToolsRegistered, invokeRegisteredTool } = await import('@/lib/mcp/server');
    await ensureToolsRegistered();
    await expect(fabricateSolidHandler({ needs: [{ function: 'weld' }] })).rejects.toThrow(/not one of fasten/);
    await expect(fabricateSolidHandler({ needs: NEEDS, source: 'cube(1);', frames: CARCASS })).rejects.toThrow(/not both/);
    await expect(invokeRegisteredTool('fabricate_solid', { needs: [] })).rejects.toThrow(/non-empty array.*get_solid_vocab\(\{ id: 'fabricate' \}\)/);
  });

  it('with frames mints a workbench row; the bill of materials is the frame\'s own hardware report', async () => {
    const r = await fabricateSolidHandler({ host: 'wood', tags: ['flat-pack'], ref: 'sk_fab_cabinet', title: 'cabinet',
      needs: [{ id: 'corners', function: 'fasten', count: 4 }, { id: 'feet', function: 'spin', host: 'printed', shaftD: 8 }], frames: CARCASS });
    expect(r.ok).toBe(true);
    const f = r.stats.fabrication;
    expect(f.executor).toBe('frames');
    expect(f.unplaced).toEqual([]);
    const cams = f.bom.find((l) => l.code === 'cam-15');
    expect(cams).toMatchObject({ from: 'frames', label: expect.any(String) });
    expect(cams.count).toBe(r.stats.frames[0].furniture.hardware.find((h) => h.code === 'cam-15').count);
    mintedCams = cams.count;
    expect(f.export).toBe("export_model({ ref: 'sk_fab_cabinet', format: 'bom' })");
    expect(f.bom.some((l) => l.part === 'cam-lock' && l.from === 'plan')).toBe(false);   // the estimate gave way to the report
    expect(f.bom.find((l) => l.code === '688')).toMatchObject({ from: 'plan' });          // the printed need stays on the plan
    expect(f.elsewhere).toEqual(['feet (scad)']);
    expect(r.stats.warnings.join(' ')).toMatch(/feet \(scad\) is planned for the other executor/);
    const m = SketchRepository.getByRef('sk_fab_cabinet').manifest;
    expect(m.kind).toBe('workbench');
    expect(m.fabricate).toMatchObject({ executor: 'frames', host: 'wood', plan: { version: expect.stringMatching(/^fabricator-v/) } });
    expect(m.units, 'the frames\' unit is the row\'s when it declares none').toBe('mm');
  });

  it('the bill of materials exports as CSV and Markdown, the frame\'s fittings recounted from the stored frames', async () => {
    const minted = SketchRepository.getByRef('sk_fab_cabinet');
    expect(minted, 'minted by the test above').toBeTruthy();
    const r = await exportModelHandler({ ref: 'sk_fab_cabinet', format: 'bom', write: false });
    expect(r).toMatchObject({ ok: true, format: 'bom', source: 'fabricate (frames)' });
    const rows = r.csv.trim().split('\r\n');
    expect(rows[0]).toBe('item,kind,count,code,label,grade,standard,buy,tool,provenance,for');
    const cams = rows.find((row) => row.split(',')[3] === 'cam-15').split(',');
    expect(+cams[2], 'the count the mint\'s frame report gave').toBe(mintedCams);
    expect(rows.some((row) => row.split(',')[3] === '688'), 'the printed need\'s bearings are bought too').toBe(true);
    expect(rows.some((row) => row.split(',')[1] === 'sheet'), 'the sheets to cut').toBe(true);
    const again = await exportModelHandler({ ref: 'sk_fab_cabinet', format: 'bom', write: false });
    expect(again.csv).toBe(r.csv);
  });

  it('a row with nothing to buy is not eligible for a bill of materials, and says how to get one', async () => {
    SketchRepository.create({ ref: 'sk_fab_plain', title: 'plain', manifest: { kind: 'scad', source: 'cube(10);' } });
    const out = await exportModelHandler({ ref: 'sk_fab_plain', format: 'bom', write: false });
    expect(out).toMatchObject({ ok: false, eligible: false, reason: expect.stringMatching(/fabricate_solid/) });
  });

  it('a frame without the planned joint is warned about, not refused', async () => {
    const screwed = [{ ...CARCASS[0], joints: CARCASS[0].joints.map((j) => ({ ...j, type: 'confirmat' })) }];
    const r = await fabricateSolidHandler({ host: 'wood', tags: ['flat-pack'], needs: [{ function: 'fasten' }], frames: screwed });
    expect(r.ok).toBe(true);
    expect(r.stats.fabrication.unplaced).toEqual(['cam-lock']);
    expect(r.stats.warnings.join(' ')).toMatch(/no frame joint of type cam-lock/);
  });

  it.skipIf(!hasWasm)('with a source mints a scad row, the plan beside it, unplaced cuts said', async () => {
    const source = 'difference() { cube([40, 40, 10]); translate([20, 20, 10]) mj_bearing_seat("688"); }';
    const r = await fabricateSolidHandler({ host: 'printed', needs: NEEDS, source, title: 'axle block', ref: 'sk_fab_block' });
    expect(r.ok).toBe(true);
    expect(r.stats.fabrication.bom.map((b) => b.part)).toEqual(['heat-set-insert', 'radial-bearing', 'socket-bolt']);
    expect(r.stats.fabrication.unplaced).toEqual(['mj_counterbore', 'mj_heatset_hole']);
    expect(r.next.some((s) => s.add === 'fabricate'), 'a fabricated row is not sent back to fabricate').toBe(false);
    const m = SketchRepository.getByRef('sk_fab_block').manifest;
    expect(m.kind).toBe('scad');
    expect(m.fabricate).toMatchObject({ executor: 'scad', needs: NEEDS });
  });

  it.skipIf(!hasWasm)('the assembler refuses a fabricated scad row and says where it assembles instead', async () => {
    await expect(mintSolidHandler({ kind: 'assembler', spec: { items: [{ source: { ref: 'sk_fab_block' } }] } }))
      .rejects.toThrow(/scad row — the assembler composes workbench parts only.*`parts` entry.*`mechanism`.*fabricate_solid/);
  });

  // A base and a lid that meet at z = 20, the lid's four heat-set joints and a shaft's two bearings placed by the needs.
  const PLACED = [
    { id: 'lid', function: 'fasten', tags: ['serviceable'], count: 4, at: [[6, 6, 20], [34, 6, 20], [6, 34, 20], [34, 34, 20]], parts: { into: 'base', head: 'lid' } },
    { id: 'axle', function: 'spin', shaftD: 8, part: 'base', at: [{ at: [20, 0, 10], axis: 'y+' }, { at: [20, 40, 10], axis: 'y-' }] },
  ];
  const BODY = 'module base() difference() { cube([40, 40, 20]); fab_cuts("base"); }\nmodule lid() difference() { translate([0, 0, 20]) cube([40, 40, 10]); fab_cuts("lid"); }';

  it.skipIf(!hasWasm)('needs that say where get their cuts written into the source, and the source renders with them', async () => {
    const plain = await fabricateSolidHandler({ host: 'printed', needs: PLACED.map(({ at, parts, part, ...n }) => n), source: BODY.replace(/fab_cuts\("\w+"\); /g, ''), parts: { base: 'base();', lid: 'lid();' }, ref: 'sk_fab_plain_box' });
    const r = await fabricateSolidHandler({ host: 'printed', needs: PLACED, source: BODY, parts: { base: 'base();', lid: 'lid();' }, ref: 'sk_fab_placed' });
    expect(r.ok).toBe(true);
    expect(r.stats.fabrication).toMatchObject({ placementWritten: true, unplaced: [] });
    expect(r.stats.fabrication.placement.placed.map((p) => `${p.need}:${p.part}`)).toEqual(['lid:base', 'lid:lid', 'axle:base']);
    const m = SketchRepository.getByRef('sk_fab_placed').manifest;
    expect(m.source).toMatch(/^\/\/ <fabricate placement>[\s\S]*module fab_cuts\(part\)[\s\S]*\/\/ <\/fabricate placement>\nmodule base\(\)/);
    expect(r.stats.triangles ?? r.stats.faces, 'the cuts add faces to the solid').toBeGreaterThan(plain.stats.triangles ?? plain.stats.faces);
  });

  it.skipIf(!hasWasm)('a re-plan by ref alone keeps the needs, and with new needs rewrites the plan, the placement and the bill in place', async () => {
    const same = await fabricateSolidHandler({ ref: 'sk_fab_placed' });
    expect(same).toMatchObject({ ok: true, phase: 'replan', minted: false, changes: { needs: [], bom: [] } });
    const heavier = PLACED.map((n) => (n.id === 'lid' ? { ...n, loadN: 3000, at: n.at.map(([x, y]) => [x + 1, y, 20]) } : n));
    const r = await fabricateSolidHandler({ ref: 'sk_fab_placed', needs: heavier });
    expect(r.changes.needs).toEqual([{ need: 'lid', size: { from: 'M3', to: 'M4' } }]);
    expect(r.changes.bom).toEqual(expect.arrayContaining([{ line: 'M3x16-socket (8.8)', removed: 4 }, { line: expect.stringMatching(/^M4x\d+-socket \(8\.8\)$/), added: 4 }]));
    expect(r.next).toMatch(/placement block in the source is rewritten/);
    const m = SketchRepository.getByRef('sk_fab_placed').manifest;
    expect(m.source.split('// <fabricate placement>')).toHaveLength(2);
    expect(m.source).toContain('translate([7, 6, 20]) mj_heatset_hole("M4"');
    expect(m.fabricate.needs).toEqual(heavier);
    expect((await exportModelHandler({ ref: 'sk_fab_placed', format: 'bom', write: false })).csv).toMatch(/M4x\d+-socket/);
  });

  it.skipIf(!hasWasm)('a scad row minted without a plan takes one by ref, and a mint onto a taken ref says to re-plan', async () => {
    SketchRepository.create({ ref: 'sk_fab_adopt', title: 'block', manifest: { kind: 'scad', source: 'difference() { cube([30, 30, 10]); translate([15, 15, 10]) mj_bearing_seat("688"); }', units: 'mm' } });
    await expect(fabricateSolidHandler({ ref: 'sk_fab_adopt' })).rejects.toThrow(/has no plan yet — pass its `needs`/);
    const r = await fabricateSolidHandler({ ref: 'sk_fab_adopt', needs: [{ id: 'axle', function: 'spin', shaftD: 8 }] });
    expect(r.changes).toMatchObject({ version: { from: null }, needs: [{ need: 'axle', added: 'ball-bearing' }] });
    expect(r.stats.fabrication.unplaced).toEqual([]);
    expect(SketchRepository.getByRef('sk_fab_adopt').manifest.fabricate.executor).toBe('scad');
    await expect(fabricateSolidHandler({ ref: 'sk_fab_adopt', needs: NEEDS, source: 'cube(1);' })).rejects.toThrow(/already exists — call fabricate_solid\(\{ ref: 'sk_fab_adopt', needs\? \}\) without a body/);
  });

  it('a frames row re-plans from its stored frames: the fittings recounted, nothing re-minted', async () => {
    const r = await fabricateSolidHandler({ ref: 'sk_fab_cabinet', needs: [{ id: 'corners', function: 'fasten', count: 4 }], host: 'wood', tags: ['flat-pack'] });
    expect(r.phase).toBe('replan');
    expect(r.changes.needs).toEqual([{ need: 'feet', removed: 'ball-bearing' }]);
    expect(r.stats.fabrication.bom.find((l) => l.code === 'cam-15').count).toBe(mintedCams);
    expect(r.stats.fabrication.bom.some((l) => l.code === '688')).toBe(false);
  });

  it('mint_solid no longer carries the fabricate door', async () => {
    await expect(mintSolidHandler({ kind: 'scad', via: 'fabricate', spec: { needs: NEEDS } })).rejects.toThrow(/has no via 'fabricate'/);
  });
});
