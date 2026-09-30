// Roofs, drainage and ceilings: coverings laid as tiles at the render ladder's levels, the maps, gutters and drains by
// tradition, the steel and concrete houses' hung ceilings, and a framed roof decked, battened and covered by stage.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { layCovering, COVERINGS, COVERING_KEYS, coveringOf, validateCovering, bakeCoveringKey, coveringKey } from './roofing.js';
import { planDrainage, roofDrainLines, validateDrainage, DRAINAGE_TRADITIONS } from './drainage.js';
import { CATALOG, TRADITIONS, ASSEMBLIES } from './catalog.js';
import { surfaceTexture } from '../landscape/surface-textures.js';
import { expandRepeats } from '../polygonizer/rock-pool.js';
import { structurizeHouse, storeyLevels } from '../polygonizer/floorplan-structure.js';
import { buildRoof } from '../architecture/roof.js';
import { makeLight } from '../polygonizer/vexar.js';

const GABLE = [
  { key: 'near', corners: [[0, -1, 10], [30, -1, 10], [30, 12, 17], [0, 12, 17]] },
  { key: 'far', corners: [[0, 25, 10], [30, 25, 10], [30, 12, 17], [0, 12, 17]] },
];
const house = (extra) => { const m = { storeys: 2, seed: 4, tier: 'house', windows: true, ...extra }; return structurizeHouse({ ...m, ...storeyLevels(m) }, m); };
const MM2_PER_SQFT = 92903.04;

describe('roof coverings', () => {
  it('lays each covering at its gauge and cover, within 10% of the plane area over one unit', () => {
    for (const k of COVERING_KEYS) {
      const d = COVERINGS[k];
      const r = layCovering(GABLE, k, {});
      if (d.profile === 'seam') { expect(r.report.units).toBeGreaterThan(40); continue; }
      const cover = Array.isArray(d.cover) ? d.cover.reduce((a, b) => a + b, 0) / d.cover.length : d.cover;
      const want = (r.report.areaSqFt * MM2_PER_SQFT) / (d.gauge * cover) * (d.profile === 'barrel' ? 2 : 1);   // a pan and a cover per column
      expect(Math.abs(r.report.units - want) / want).toBeLessThan(0.1);
      expect(r.report.caps.lines).toBe(1);                                // the ridge, capped
    }
  });

  it('stamps identical units as tinted repeats, and the stamped set expands to real faces', () => {
    const r = layCovering(GABLE, 'plain-tile', {});
    expect(r.repeats.length).toBeGreaterThan(0);
    const inst = r.repeats.reduce((a, x) => a + x.transforms.length, 0);
    expect(inst).toBeGreaterThan(0.95 * r.report.units);
    expect(r.repeats.every((x) => x.transforms.every((t) => t.tint && t.tint.length === 3))).toBe(true);
    const flat = expandRepeats(r.repeats);
    expect(flat.length).toBe(r.repeats.reduce((a, x) => a + x.template.length * x.transforms.length, 0));
    const noInst = layCovering(GABLE, 'plain-tile', { instance: false });
    expect(noInst.repeats).toEqual([]);
    expect(noInst.report.units).toBe(r.report.units);
  });

  it('draws the map at surface and the far colour at mass; every map resolves', () => {
    const s = layCovering(GABLE, { type: 'pantile', detail: 'surface' }, {});
    expect(s.repeats).toEqual([]);
    expect(s.faces.filter((f) => f.texture).length).toBe(2);
    expect(surfaceTexture(s.faces[0].texture)).toMatch(/^data:image\/png;base64,/);
    const m = layCovering(GABLE, { type: 'pantile', detail: 'mass' }, {});
    expect(m.faces.every((f) => !f.texture)).toBe(true);
    const barrel = layCovering(GABLE, { type: 'barrel', detail: 'surface' }, {});
    expect(barrel.faces[0].texture).toBe('clay-terracotta');                 // the library's own texture, named
    for (const [name, e] of Object.entries(CATALOG)) if (e.map && e.map.texture) expect(surfaceTexture(e.map.texture), name).toBeTruthy();
    const b = bakeCoveringKey(coveringKey('kawara', [92, 96, 102]));
    expect(b.W * b.H * 3).toBe(b.rgb.length);
  });

  it('picks the level from the eyes: tiles near, the map further, the colour far', () => {
    const eye = (d) => [{ pos: [4.5, -d, 4], focalPx: 1000 }];
    expect(layCovering(GABLE, 'slate', { eyes: eye(10) }).report.planes[0].level).toBe('units');
    expect(layCovering(GABLE, 'slate', { eyes: eye(120) }).report.planes[0].level).toBe('surface');
    expect(layCovering(GABLE, 'slate', { eyes: eye(900) }).report.planes[0].level).toBe('mass');
  });

  it('names every covering material in the catalog, and validates', () => {
    for (const k of COVERING_KEYS) expect(CATALOG[COVERINGS[k].material].kind).toBe('roofing');
    expect(coveringOf(true, 'clay-sand')).toMatchObject({ type: 'barrel', material: 'roofing:clay-sand' });
    expect(coveringOf(true, 'shingle-brown')).toMatchObject({ type: 'asphalt-shingle', material: 'roofing:shingle-brown' });
    expect(coveringOf(true, null).type).toBe('standing-seam');
    expect(validateCovering('pantile')).toEqual([]);
    expect(validateCovering({ type: 'thatch' })[0]).toMatch(/covering.type/);
    expect(validateCovering({ type: 'slate', material: 'brick:red' })[0]).toMatch(/roofing name/);
  });

  it('leaves an uncovered roof exactly as it was', () => {
    const fp = { x: 2, y: 2, w: 44, d: 32, z: 20 };
    const light = makeLight();
    for (const style of ['bungalow', 'mission', 'manor', 'butterfly', 'tofu-stacked']) {
      const a = buildRoof(fp, { style, light });
      const b = buildRoof(fp, { style, light, covering: undefined });
      expect(JSON.stringify(b)).toBe(JSON.stringify(a));
      expect(a.repeats).toBeUndefined();
    }
    const covered = buildRoof(fp, { style: 'mission', light, covering: true });
    expect(covered.covering.covering).toBe('barrel');
    expect(covered.repeats.length).toBeGreaterThan(0);
  });
});

describe('drainage', () => {
  it('puts a gutter on every eave that sheds water, by roof form', () => {
    const fp = { x0: 0, x1: 40, y0: 0, y1: 30 };
    expect(roofDrainLines(fp, 20, 'mission').lines.map((l) => l.kind)).toEqual(['eave', 'eave']);
    expect(roofDrainLines(fp, 20, 'bungalow').lines.length).toBe(4);
    expect(roofDrainLines(fp, 20, 'bungalow').lines.filter((l) => l.outlets).length).toBe(2);
    expect(roofDrainLines(fp, 20, 'modern-shed').lines.length).toBe(1);
    expect(roofDrainLines(fp, 20, 'butterfly').lines[0].kind).toBe('valley');
    expect(roofDrainLines(fp, 20, 'tofu-deck').lines[0].kind).toBe('scupper-edge');
  });

  it('drains a house by its tradition, every check passing', () => {
    for (const tradition of Object.keys(DRAINAGE_TRADITIONS)) {
      const h = house({ roof: 'bungalow', drainage: { tradition } });
      const d = h.drainage;
      expect(d.tradition).toBe(tradition);
      expect(d.gutters.runs).toBe(4);
      expect(d.downpipes.count).toBeGreaterThanOrEqual(4);
      expect(d.outlets.count).toBe(d.downpipes.count);
      expect(d.checks.filter((c) => !c.ok)).toEqual([]);
      expect(d.elements.every((e) => CATALOG[e.material])).toBe(true);
      if (DRAINAGE_TRADITIONS[tradition].below) expect(d.below.chambers).toBeGreaterThan(0);
    }
    expect(house({ roof: 'bungalow', drainage: { tradition: 'japanese' } }).repeats.some((r) => /drainage:chain/.test(r.group))).toBe(true);
    expect(house({ roof: 'bungalow', drainage: { tradition: 'japanese', downpipe: 'pipe' } }).drainage.downpipes.kind).toBe('downpipe');
  });

  it('keeps a downpipe clear of the openings in the wall it runs down', () => {
    const h = house({ roof: 'mission', drainage: true });
    const pipes = h.drainage.elements.filter((e) => e.key.startsWith('drain:pipe:'));
    const runs = h.levels.flatMap((l) => l.structure.wallGraph.runs.filter((r) => !r.interior));
    for (const p of pipes) {
      const foot = p.sweep.path[p.sweep.path.length - 2];
      for (const r of runs) {
        const across = r.orientation === 'h' ? 1 : 0, along = 1 - across;
        if (Math.abs(foot[across] - r.at) > 1) continue;
        for (const op of r.openings || []) expect(foot[along] > op.a && foot[along] < op.b, `${p.key} over an opening`).toBe(false);
      }
    }
  });

  it('adds nothing when absent, and validates', () => {
    // absent, the house is the one it was before roofs were covered and drained: hashes captured at 23fd35b
    const sha = (faces) => createHash('sha256').update(JSON.stringify(faces)).digest('hex').slice(0, 16);
    const a = house({ roof: 'mission' });
    expect(sha(a.faces)).toBe('8ec8e5ab0925809e');
    expect(sha(house({ roof: 'bungalow', view: 'exterior' }).faces)).toBe('e1fad9e5078d783c');
    expect(a.drainage).toBeUndefined();
    expect(validateDrainage({ tradition: 'martian' })[0]).toMatch(/tradition/);
    expect(validateDrainage({ outlet: 'gully' })).toEqual([]);
    expect(planDrainage({ levels: a.levels, footprint: a.footprint }, true, {})).toBeNull();   // no roof, no gutters
  });
});

describe('ceilings and the roof as built', () => {
  it('hangs a lay-in ceiling under a steel floor and plasterboard under a concrete one', () => {
    for (const [system, material] of [['steel', 'board:acoustic-tile-2x2'], ['concrete', 'board:plasterboard-12.5']]) {
      const h = house({ roof: 'bungalow', framing: { system, stage: 'lined' } });
      const ceilings = h.construction.elements.filter((e) => e.type === 'CEILING');
      expect(ceilings.length, system).toBeGreaterThan(0);
      expect(ceilings.every((e) => e.material === material)).toBe(true);
      for (const l of h.levels) {
        const own = ceilings.filter((e) => e.storey === l.index);
        expect(own.length).toBeGreaterThan(0);
        for (const e of own) expect(e.geom.lo[2]).toBeGreaterThanOrEqual(l.baseZ + 7.5 - 1e-6);
      }
    }
    expect(ASSEMBLIES[TRADITIONS['north-american'].suspended].layers[0].material).toBe('board:acoustic-tile-2x2');
  });

  it('decks, battens and covers a framed roof by stage and tradition', () => {
    const at = (system, stage, roof = 'mission') => house({ roof, framing: { system, stage } });
    const deck = at('platform', 'rough-in');
    expect(deck.framing.roof.stage).toBe('deck');
    expect(deck.construction.elements.filter((e) => e.key.startsWith('roof:deck:')).every((e) => e.material === 'board:osb-11')).toBe(true);
    expect(at('masonry', 'insulated').framing.roof.stage).toBe('battens');
    const covered = at('platform', 'lined', { style: 'mission', covering: 'pantile' });
    expect(covered.framing.roof).toMatchObject({ stage: 'covered', covering: 'pantile' });
    expect(covered.framing.roof.units).toBeGreaterThan(1000);
    expect(covered.construction.elements.filter((e) => e.type === 'ROOFING').length).toBe(2);
    expect(covered.roofing).toBeUndefined();                              // the finished roof is not drawn over it
    expect(at('platform', 'frame').framing.roof.stage).toBeUndefined();
  });
});
