import { describe, expect, it } from 'vitest';

import { planCellularScene, assembleCellularScene } from './cellular-view.js';
import { sketchRenderMode, classifyBucket } from '../../sketch/sketch-manifest.js';

const CELL = { kind: 'cellular-view', cellType: 'animal', seed: 7 };

describe('planCellularScene', () => {
  it('is deterministic — same seed yields byte-identical faces', () => {
    const a = planCellularScene(CELL), b = planCellularScene(CELL);
    expect(JSON.stringify(a.faces)).toBe(JSON.stringify(b.faces));
  });

  it('lays the cell out differently for a different seed', () => {
    const a = planCellularScene({ ...CELL, seed: 1 });
    const b = planCellularScene({ ...CELL, seed: 2 });
    expect(JSON.stringify(a.faces)).not.toBe(JSON.stringify(b.faces));
  });

  it('populates the animal organelles — small/complex shapes as faces, the nucleus as a lit sphere', () => {
    const plan = planCellularScene(CELL);
    const groups = new Set(plan.faces.map((f) => f.group));
    // small/numerous + non-sphere organelles stay merged lathe faces
    for (const t of ['org:mitochondria', 'org:er', 'org:golgi', 'org:lysosomes', 'org:ribosomes']) {
      expect(groups.has(t), `missing ${t}`).toBe(true);
    }
    // the big rounded nucleus is a lit sphere now (planets), not faces
    expect(groups.has('org:nucleus')).toBe(false);
    const planetGroups = new Set(plan.planets.map((p) => p.group));
    expect(planetGroups.has('org:nucleus')).toBe(true);
    // still one pick per organelle type (nucleus pick comes from the planet group)
    const pickNames = plan.picks.map((p) => p.name).sort();
    expect(pickNames).toContain('org:nucleus');
    expect(plan.picks.length).toBe(6);
    for (const f of plan.faces.filter((f) => f.group.startsWith('org:'))) expect(f.alpha).toBeGreaterThan(0);
    for (const p of plan.planets) expect(p.opacity).toBeGreaterThan(0);
  });

  it('renders a cytoplasm envelope that is a translucent lit sphere but NOT pickable (click passes through)', () => {
    const plan = planCellularScene(CELL);
    const cyto = plan.planets.find((p) => p.group === 'cytoplasm');
    expect(cyto).toBeTruthy();
    expect(cyto.opacity).toBeLessThan(0.5);                     // see-through jelly
    expect(plan.faces.some((f) => f.group === 'cytoplasm')).toBe(false);
    expect(plan.picks.some((p) => p.name === 'cytoplasm')).toBe(false);
  });

  it('respects the alpha + scale knobs and falls back on a bad cellType', () => {
    const plan = planCellularScene({ kind: 'cellular-view', cellType: 'martian', seed: 3, organelleAlpha: 0.5, jellyAlpha: 0.1, scale: 2 });
    expect(plan.stats.cellType).toBe('animal');                 // unknown type → animal
    expect(plan.planets.find((p) => p.group === 'org:nucleus').opacity).toBe(0.5);
    expect(plan.planets.find((p) => p.group === 'cytoplasm').opacity).toBe(0.1);
    // scale doubles the cell
    const r1 = planCellularScene({ cellType: 'animal', seed: 3, scale: 1 }).bounds.radius;
    expect(plan.bounds.radius).toBeCloseTo(r1 * 2, 4);
  });
});

describe('plant cell preset', () => {
  const PLANT = { kind: 'cellular-view', cellType: 'plant', seed: 5 };

  it('populates plant-specific organelles (vacuole, chloroplasts) and a boxy cell wall, no lysosomes', () => {
    const plan = planCellularScene(PLANT);
    const groups = new Set(plan.faces.map((f) => f.group));
    const planetGroups = new Set(plan.planets.map((p) => p.group));
    // chloroplasts (discs) + the boxy wall/cytoplasm stay faces; vacuole + nucleus are lit spheres
    for (const g of ['org:chloroplasts', 'cell_wall', 'cytoplasm']) {
      expect(groups.has(g), `missing face ${g}`).toBe(true);
    }
    for (const g of ['org:central_vacuole', 'org:nucleus']) {
      expect(planetGroups.has(g), `missing planet ${g}`).toBe(true);
    }
    expect(groups.has('org:lysosomes')).toBe(false);           // plants have no lysosomes here
    expect(plan.picks.some((p) => p.name === 'org:chloroplasts')).toBe(true);
    expect(plan.picks.some((p) => p.name === 'org:central_vacuole')).toBe(true);
  });

  it('makes the cell wall translucent jelly (not pickable) and the vacuole extra see-through', () => {
    const plan = planCellularScene(PLANT);
    expect(plan.picks.some((p) => p.name === 'cell_wall')).toBe(false);   // wall is a click-through layer
    expect(plan.faces.find((f) => f.group === 'cell_wall').alpha).toBeLessThan(0.5);
    // the watery vacuole overrides the default organelle opacity (more transparent)
    expect(plan.planets.find((p) => p.group === 'org:central_vacuole').opacity).toBe(0.3);
  });

  it('is deterministic per seed', () => {
    expect(JSON.stringify(planCellularScene(PLANT).faces)).toBe(JSON.stringify(planCellularScene(PLANT).faces));
  });
});

describe('assembleCellularScene', () => {
  it('returns an emitThreeWorld payload with organelle picks, preset cameras and no glow', () => {
    const payload = assembleCellularScene(CELL, { title: 'test cell' });
    expect(payload.faces.length).toBeGreaterThan(0);
    expect(payload.picks.length).toBe(6);
    expect(payload.cameras.map((c) => c.name)).toEqual(['angle', 'side', 'top']);
    expect(payload.glow).toBe(false);
    expect(payload.title).toBe('test cell');
  });
});

describe('cellular-view render routing', () => {
  it('routes to the World renderer, in the object concern bucket', () => {
    expect(sketchRenderMode({ kind: 'cellular-view' })).toBe('world');
    expect(classifyBucket({ kind: 'cellular-view' })).toBe('object');
  });
});
