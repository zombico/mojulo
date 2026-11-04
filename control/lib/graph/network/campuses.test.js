// THE CAMPUSES (network/campuses.js): a complex by its name, its buildings stocked by their rooms' roles (era/stocking.js:
// a base's table, a hospital's own), joined by passages each of its own section where a link names one. One case a
// procedure, chosen in code from the catalog: a campus whose links name several sections (the hospital's public passages
// and its service tunnel) and one joined by a single section (the base's bunker tunnels). Each passage walked from one
// front door to the other's and back by the page's ground probe over the payload's own faces and boxes, things and all.
import { describe, it, expect } from 'vitest';
import { assembleStageScene } from '../era/stage.js';
import { readComplex } from './complex.js';
import { CAMPUSES, CAMPUS_IDS, campusOf } from './campuses.js';
import { SECTIONS } from './sections.js';
import { walker } from './walk-gate.js';
import { HOSPITAL_USES, PROGRAMS } from '../era/programs.js';
import { resolveLevel, MEADOWMARK } from '../gameworld/index.js';

const mixed = CAMPUS_IDS.find((id) => CAMPUSES[id].network.links.some((l) => !Array.isArray(l) && l.section));
const single = CAMPUS_IDS.find((id) => CAMPUSES[id].network.links.every(Array.isArray));
const sectionsOf = (id) => new Set([CAMPUSES[id].network.section, ...CAMPUSES[id].network.links.filter((l) => !Array.isArray(l)).map((l) => l.section)]);

for (const id of [mixed, single]) {
  describe(`the ${id} campus`, () => {
    const P = assembleStageScene({ kind: 'stage', complex: { campus: id } }, {});
    const byId = new Map(P.anchors.map((a) => [a.id, a])), law = (l) => P.complex.laws.find((x) => x.law === l);

    it('stands its buildings, joined by the links it names, each of its own section, every law holding', () => {
      expect(P.complex.campus).toBe(id);
      expect(P.complex.buildings.map((b) => b.id)).toEqual(CAMPUSES[id].buildings.map((b) => b.id));
      expect(P.complex.passages.length).toBe(CAMPUSES[id].network.links.length);
      expect(new Set(P.complex.passages.map((t) => t.section))).toEqual(sectionsOf(id));
      for (const l of P.complex.laws) expect(l.ok, `${l.law}: ${l.value}`).toBe(true);
      expect(law('complex-distinct').value).toMatch(/^every passage joins two looks that differ$/);
    });

    it('stocks its rooms by their roles: a hospital\'s beds and waiting chairs, never a base\'s sandbags', () => {
      const kinds = new Set(P.colliders.map((c) => c.of.match(/\/([a-z-]+)-\d+(@\d+)?$/)?.[1]).filter(Boolean));
      if (CAMPUSES[id].buildings.some((b) => HOSPITAL_USES.includes(b.use))) {
        for (const k of ['bed', 'chair-row']) expect(kinds.has(k), k).toBe(true);
        // (no sandbags in a hospital's lobby: its own table, its lobby a waiting room)
        const hosp = CAMPUSES[id].buildings.filter((b) => HOSPITAL_USES.includes(b.use)).map((b) => b.id);
        expect(P.colliders.some((c) => hosp.some((h) => c.of.startsWith(`${h}:in:lobby/`)) && /sandbags/.test(c.of))).toBe(false);
      } else {
        expect(kinds.has('bunk') || kinds.has('weapon-rack')).toBe(true);
      }
    });

    it('is walked through each passage from one front door to the other\'s, and back: no step over a riser, no wall, no gap, no box', () => {
      const walk = walker(P);
      for (const t of P.anchors.filter((a) => a.kind === 'tunnel')) {
        const pid = t.id.slice('tunnel-'.length), A = byId.get(t.from), B = byId.get(t.to);
        const way = [...A.down, ...A.ports.find((p) => p.id === pid).reach.slice(1), ...t.line.slice(1), ...B.ports.find((p) => p.id === pid).reach.slice().reverse().slice(1), ...B.down.slice().reverse().slice(1)];
        for (const pts of [way, way.slice().reverse()]) {
          const r = walk(pts);
          expect({ pid, steepest: r.steepest <= 0.36, crossed: r.crossed, gaps: r.gaps, boxes: r.boxes }).toEqual({ pid, steepest: true, crossed: [], gaps: [], boxes: [] });
        }
      }
    });
  });
}

describe('a campus read', () => {
  it('names its buildings of the uses it says, each wearing a look, never two alike that a link joins', () => {
    for (const id of CAMPUS_IDS) {
      const C = campusOf(id), look = new Map(C.buildings.map((b) => [b.id, b.look]));
      for (const b of C.buildings) expect(PROGRAMS[b.use]?.shape).toBe('core');
      for (const l of C.network.links) {
        const [a, b] = Array.isArray(l) ? l : l.between;
        expect(look.get(a)).not.toEqual(look.get(b));
      }
      for (const s of sectionsOf(id)) expect(SECTIONS[s]).toBeDefined();
    }
  });

  it('takes a network of the recipe\'s own over the campus\'s, and refuses what it cannot build, by name', () => {
    expect(readComplex({ campus: mixed, network: { section: 'service' } }).network.section).toBe('service');
    expect(() => readComplex({ campus: 'mall' })).toThrow(/campus 'mall' is not a campus/);
    expect(() => readComplex({ campus: mixed, buildings: [] })).toThrow(/give campus or buildings, not both/);
    expect(() => readComplex({ buildings: [{ id: 'a', use: 'command', at: [0, 0] }], network: { links: [{ between: ['a', 'a'], section: 'lane' }] } })).toThrow(/section 'lane' is not a section/);
    expect(() => readComplex({ buildings: [{ id: 'a', use: 'command', at: [0, 0] }], network: { links: [{ pair: ['a', 'a'] }] } })).toThrow(/network.links is/);
  });

  it('is a world\'s complex level by its name, played from its first building to its last', () => {
    const W = { ...MEADOWMARK, levels: { ...MEADOWMARK.levels, campus: { building: { complex: { campus: mixed } } } } };
    const B = resolveLevel(W, 'campus').building, ids = CAMPUSES[mixed].buildings.map((b) => b.id);
    expect(B.complex).toMatchObject({ campus: mixed });
    expect(B).toMatchObject({ from: ids[0], to: ids[ids.length - 1], use: CAMPUSES[mixed].buildings.at(-1).use });
  });
});
