import { describe, it, expect } from 'vitest';
import { tierMonomers, SECTION_PX } from './tier.js';
import { expandEquipment, EQUIPMENT_ITEMS } from './expand.js';
import { SEEDED_STYLES } from './styles.js';
import { lowerObjectFaces } from '../worlds/workbench.js';
import { DEFAULT_LIGHT } from '../polygonizer/vexar.js';
import { DEFAULT_CROSS_SECTIONS, DEFAULT_SAMPLES } from '../polygonizer/lathe-faces.js';

const tris = (m) => lowerObjectFaces({ kind: 'workbench', units: 'cm', ...m }, DEFAULT_LIGHT).reduce((n, f) => n + f.corners.length - 2, 0);
const STYLES = Object.keys(SEEDED_STYLES);
// pixels per cm of the item: a 1.7 m hero at 720p third-person, at 1080p, at 4K close
const PPU = [1.41, 2.12, 10.2];

describe('equipment/tier: an item drawn for the pixels it covers', () => {
  it('only takes away: no lathe, sweep or field finer than its builder (or its lowerer\'s default) wrote it', () => {
    for (const item of EQUIPMENT_ITEMS) for (const style of STYLES) {
      const { monomers: M } = expandEquipment({ type: 'equipment', item, style, seed: 3 });
      for (const ppu of PPU) {
        const T = tierMonomers(M, { ppu });
        (M.lathes || []).forEach((L, i) => {
          expect(T.lathes[i].samples ?? DEFAULT_SAMPLES).toBeLessThanOrEqual(L.samples ?? DEFAULT_SAMPLES);
          expect(T.lathes[i].crossSections ?? DEFAULT_CROSS_SECTIONS).toBeLessThanOrEqual(L.crossSections ?? DEFAULT_CROSS_SECTIONS);
        });
        (M.sweeps || []).forEach((S, i) => {
          if (S.sides != null) expect(T.sweeps[i].sides).toBeLessThanOrEqual(S.sides);
          expect(T.sweeps[i].path.length).toBeLessThanOrEqual(S.path.length);
          expect(T.sweeps[i].path[0]).toBe(S.path[0]);
          expect(T.sweeps[i].path.at(-1)).toBe(S.path.at(-1));
        });
        (M.fields || []).forEach((F, i) => expect(T.fields[i].cells).toBeLessThanOrEqual(F.cells));
      }
    }
  });

  it('a nearer item never costs fewer triangles, and a far one fewer than as built', () => {
    for (const item of ['sword', 'staff', 'shield']) for (const style of STYLES) {
      const { monomers: M } = expandEquipment({ type: 'equipment', item, style, seed: 3 });
      const n = PPU.map((ppu) => tris(tierMonomers(M, { ppu })));
      expect(n[0]).toBeLessThanOrEqual(n[1]);
      expect(n[1]).toBeLessThanOrEqual(n[2]);
      expect(n[0], `${item} ${style}`).toBeLessThan(tris(M));
    }
  });

  it('keeps the samples a lathe\'s harmonics need, and a cross section per span of its profile', () => {
    const L = { axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 1 }, profile: [{ t: 0, radius: 1 }, { t: 0.5, radius: 2 }, { t: 1, radius: 1 }], harmonics: [{ n: 4, amplitude: 0.1 }] };
    const [T] = tierMonomers({ lathes: [L] }, { ppu: 0.5 }).lathes;
    expect(T.samples).toBeGreaterThanOrEqual(16);
    expect(T.crossSections).toBeGreaterThanOrEqual(2);
    expect(T.crossSections).toBeLessThanOrEqual(Math.max(2, Math.ceil(0.5 / SECTION_PX)));
  });

  it('is deterministic and leaves what it does not read untouched', () => {
    const { monomers: M } = expandEquipment({ type: 'equipment', item: 'greatsword', style: 'celestial', seed: 3 });
    expect(JSON.stringify(tierMonomers(M, { ppu: 2 }))).toBe(JSON.stringify(tierMonomers(M, { ppu: 2 })));
    expect(tierMonomers(M, { ppu: 2 }).lofts).toBe(M.lofts);
  });
});
