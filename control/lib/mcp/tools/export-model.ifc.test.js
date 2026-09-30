// export_model format: 'ifc' — a house as an IFC4 building model: written beside its recipe, the same bytes twice,
// every reference resolving, GlobalIds unique; a framed house carries its members and circuits; a non-house says why.

process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { mkdtempSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

process.env.MOJULO_OUTCOMES_DIR = mkdtempSync(path.join(os.tmpdir(), 'mojulo-ifc-outcomes-'));

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { exportModelHandler } from './sketch-model-export.js';

/** The STEP file's entities: every `#n` defined once, densely, and every reference defined. */
function stepCheck(text) {
  const data = text.slice(text.indexOf('DATA;') + 5, text.lastIndexOf('ENDSEC;'));
  const lines = data.split('\n').filter((l) => l.startsWith('#'));
  const ids = lines.map((l) => Number(/^#(\d+)=/.exec(l)[1]));
  const defined = new Set(ids);
  const dangling = [];
  for (const l of lines) for (const m of l.slice(l.indexOf('=') + 1).matchAll(/#(\d+)/g)) if (!defined.has(Number(m[1]))) dangling.push(m[0]);
  const guids = lines.filter((l) => /^#\d+=IFC(PROJECT|SITE|BUILDING|BUILDINGSTOREY|SPACE|WALL|SLAB|DOOR|WINDOW|MEMBER|BEAM|COLUMN|REL[A-Z]+|PROPERTYSET|ELEMENTQUANTITY|ROOF|OPENINGELEMENT|COVERING|PLATE|FOOTING|PIPESEGMENT|DISTRIBUTIONCIRCUIT|DISTRIBUTIONSYSTEM)\(/.test(l)).map((l) => /\('([^']{22})'/.exec(l)[1]);
  return { count: lines.length, dense: ids.every((n, i) => n === i + 1), dangling, guids };
}

const HOUSE = { kind: 'floorplan', storeys: 2, seed: 4, tier: 'house', windows: true, roof: 'mission', drainage: true };

describe('export_model ifc', () => {
  it('writes a house as IFC4 beside its recipe, deterministically', async () => {
    SketchRepository.create({ ref: 'sk_ifc_house', title: "a house's model", manifest: HOUSE });
    const res = await exportModelHandler({ ref: 'sk_ifc_house', format: 'ifc' });
    expect(res.ok).toBe(true);
    expect(res.format).toBe('ifc');
    expect(res.framed).toBe(false);
    expect(res.elements.IfcSpace).toBeGreaterThan(0);
    expect(res.elements.IfcWall).toBeGreaterThan(0);
    expect(res.elements.IfcWindow).toBeGreaterThan(0);
    expect(res.elements.IfcRoof).toBe(1);
    expect(res.elements.IfcPipeSegment).toBeGreaterThan(0);
    expect(path.basename(res.path)).toBe('model.ifc');
    const text = readFileSync(res.path, 'utf8');
    expect(text.startsWith('ISO-10303-21;')).toBe(true);
    expect(text).toContain("FILE_SCHEMA(('IFC4'));");
    expect(text).toContain("IFCPROJECT('");
    expect(text).toContain("'a house''s model'");                  // apostrophes doubled
    const c = stepCheck(text);
    expect(c.dense).toBe(true);
    expect(c.dangling).toEqual([]);
    expect(c.guids.every((g) => /^[0-3][0-9A-Za-z_$]{21}$/.test(g))).toBe(true);
    expect(new Set(c.guids).size).toBe(c.guids.length);
    expect(readFileSync(path.join(res.dir, 'README.md'), 'utf8')).toContain('## Opening this file (BIM)');
    const again = await exportModelHandler({ ref: 'sk_ifc_house', format: 'ifc', write: false });
    expect(again.bytes).toBe(res.bytes);
    expect(again.path).toBeUndefined();
  });

  it('a framed house carries its building model: members, linings, circuits', async () => {
    SketchRepository.create({ ref: 'sk_ifc_framed', title: 'framed', manifest: { ...HOUSE, drainage: undefined, framing: { system: 'platform', stage: 'rough-in' } } });
    const res = await exportModelHandler({ ref: 'sk_ifc_framed', format: 'ifc', write: false });
    expect(res.ok).toBe(true);
    expect(res.framed).toBe(true);
    expect(res.elements.IfcMember).toBeGreaterThan(100);
    expect(res.elements.IfcBeam).toBeGreaterThan(10);
    expect(res.elements.IfcCableSegment).toBeGreaterThan(0);
    expect(res.elements.IfcDistributionCircuit).toBeGreaterThan(0);
  });

  it('two houses never share a GlobalId', async () => {
    SketchRepository.create({ ref: 'sk_ifc_twin', title: 'twin', manifest: HOUSE });
    const a = await exportModelHandler({ ref: 'sk_ifc_house', format: 'ifc' });
    const b = await exportModelHandler({ ref: 'sk_ifc_twin', format: 'ifc' });
    const ga = new Set(stepCheck(readFileSync(a.path, 'utf8')).guids);
    expect(stepCheck(readFileSync(b.path, 'utf8')).guids.some((g) => ga.has(g))).toBe(false);
  });

  it('is not eligible for a single-floor plan or a non-house', async () => {
    SketchRepository.create({ ref: 'sk_ifc_floor', title: 'floor', manifest: { kind: 'floorplan', seed: 2 } });
    const floor = await exportModelHandler({ ref: 'sk_ifc_floor', format: 'ifc' });
    expect(floor.eligible).toBe(false);
    expect(floor.reason).toMatch(/levels: \[\{ role: 'ground' \}\]/);
    // the advice works: the one floor as a one-level stack exports
    SketchRepository.create({ ref: 'sk_ifc_floor_level', title: 'floor', manifest: { kind: 'floorplan', seed: 2, levels: [{ role: 'ground' }] } });
    const level = await exportModelHandler({ ref: 'sk_ifc_floor_level', format: 'ifc', write: false });
    expect(level.ok).toBe(true);
    expect(level.elements.IfcSpace).toBeGreaterThan(0);
    // storeys: 1 is still a single floor, and says so
    SketchRepository.create({ ref: 'sk_ifc_floor_one', title: 'floor', manifest: { kind: 'floorplan', seed: 2, storeys: 1 } });
    expect((await exportModelHandler({ ref: 'sk_ifc_floor_one', format: 'ifc' })).eligible).toBe(false);
    SketchRepository.create({ ref: 'sk_ifc_cyl', title: 'cyl', manifest: { kind: 'workbench', boxes: [{ min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 1, z: 1 } }] } });
    const cyl = await exportModelHandler({ ref: 'sk_ifc_cyl', format: 'ifc' });
    expect(cyl.eligible).toBe(false);
    expect(cyl.reason).toMatch(/houses/);
  });
});
