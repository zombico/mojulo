// equipment — the laws as tests: every sample builds closed and deterministic, the focal grows with `stylize` on every
// archetype, a face-item's stone spans 6 % → 34 % of the face, a setting touches its stone, the readability floor
// holds on grown branches, inline cards work and typos name the choices.
import { describe, expect, it } from 'vitest';
import { expandEquipment, validateBuild, withEquipment, hasEquipment, EQUIPMENT_ITEMS, LAWS_VERSION } from './expand.js';
import { SEEDED_STYLES, validateStyleCard } from './styles.js';
import { proportion } from './principles.js';
import { planWorkbench, lowerObjectFaces, WORKBENCH_LIGHT } from '../worlds/workbench.js';
import { solidComponentsStable } from '../polygonizer/solid-components.js';

const build = (item, style, extra = {}) => ({ type: 'equipment', item, style, seed: 3, ...extra });
const at = (item, style, stylize) => expandEquipment(build(item, style, { dials: { stylize } }));

describe('every seeded style × item', () => {
  for (const style of Object.keys(SEEDED_STYLES)) for (const item of EQUIPMENT_ITEMS) {
    it(`${style} ${item} builds closed and deterministic`, () => {
      const a = expandEquipment(build(item, style)), b = expandEquipment(build(item, style));
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
      const { stats } = planWorkbench({ kind: 'workbench', units: 'cm', build: build(item, style) });
      expect(stats.ledger.closed).toBe(true);
      expect(stats.equipment.item).toBe(item);
      expect(stats.equipment.laws).toBe(LAWS_VERSION);
      expect(stats.equipment.sockets.grip).toBeTruthy();
    });
  }
  it('every seeded card is plain JSON and valid', () => {
    for (const card of Object.values(SEEDED_STYLES)) {
      expect(JSON.parse(JSON.stringify(card))).toEqual(card);
      expect(validateStyleCard(card)).toEqual([]);
    }
  });
});

describe('law 1 / 2: the focal grows with stylize on every archetype', () => {
  const S = [0, 0.33, 0.66, 1];
  for (const [item, style, at_] of [['sword', 'elven', 'pommel'], ['sword', 'dwarven', 'guard'], ['staff', 'druid', 'head'], ['bow', 'elven', 'riser'], ['shield', 'celestial', 'boss']]) {
    it(`${style} ${item}: the stone's share rises monotonically (${at_})`, () => {
      const shares = S.map((s) => at(item, style, s).trace.focal);
      expect(shares.every((f) => f && f.at === at_)).toBe(true);
      for (let i = 1; i < S.length; i++) expect(shares[i].share).toBeGreaterThan(shares[i - 1].share);
    });
  }
  it('law 1b: a shield stone spans 6 % of the face when realistic and 34 % when stylized', () => {
    expect(at('shield', 'celestial', 0).trace.focal.share).toBeCloseTo(0.06, 2);
    expect(at('shield', 'celestial', 1).trace.focal.share).toBeCloseTo(0.34, 2);
  });
  it('law 2: detail gets fewer and bigger (pitch up, notches down) and a curve exaggerates', () => {
    const a = proportion({ stylize: 0 }), b = proportion({ stylize: 1 });
    expect(b.pitch).toBeGreaterThan(a.pitch); expect(b.notches).toBeLessThan(a.notches); expect(b.curve).toBeGreaterThan(a.curve);
  });
});

describe('law 3: the setting touches its stone', () => {
  const bodies = (manifest, groups) => {
    const faces = lowerObjectFaces(manifest, WORKBENCH_LIGHT).filter((f) => groups.includes(f.group));
    return solidComponentsStable(faces, { cells: 128 }).count;
  };
  it('a dwarven block guard grows a boss around its ruby: one body', () => {
    for (const s of [0.33, 1]) expect(bodies(withEquipment({ build: build('sword', 'dwarven', { dials: { stylize: s } }) }), ['guard', 'bezel', 'stone'])).toBe(1);
  });
  it('a flush setting (stylize < 0.25) has no boss; a stylized one does', () => {
    expect(at('sword', 'dwarven', 0).trace.focal.setting).toBe('flush');
    expect(at('sword', 'dwarven', 0.5).trace.focal.setting).toBe('boss');
  });
});

describe('law 4 / 7: grown branches', () => {
  it('no branch section is thinner than the readability floor, and the druid staff wears oak bark', () => {
    const e = at('staff', 'druid', 0.8);
    const branches = e.monomers.lofts.filter((l) => l.group === 'branches');
    expect(branches.length).toBeGreaterThan(4);
    for (const l of branches) for (const st of l.stations) expect(Math.max(...st.profile.map(([u, v]) => Math.hypot(u, v)))).toBeGreaterThanOrEqual(e.trace.minFeature / 2 - 1e-3);
    expect(branches.every((l) => l.bark?.species === 'oak' && l.bark.tile > 0)).toBe(true);
  });
});

describe('the recipe surface', () => {
  it('absent a build, a manifest passes through by identity', () => {
    const m = { kind: 'workbench', lathes: [] };
    expect(withEquipment(m)).toBe(m); expect(hasEquipment(m)).toBe(false);
  });
  it('the expansion merges BEFORE an author\'s own monomers', () => {
    const own = { axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 1 }, profile: [{ t: 0, radius: 1 }, { t: 1, radius: 1 }] };
    const m = withEquipment({ build: build('dagger', 'historical'), lathes: [own] });
    expect(m.lathes[m.lathes.length - 1]).toBe(own);
    expect(m.lathes.length).toBeGreaterThan(1);
  });
  it('an inline card builds, and a new direction is data', () => {
    const card = { ...JSON.parse(JSON.stringify(SEEDED_STYLES.druid)), id: 'frost', gem: { gem: 'sapphire', cut: 'natural', glow: 0.5 } };
    card.language.staff.bark = 'silverfir';
    expect(validateBuild(build('staff', card))).toEqual([]);
    const e = expandEquipment(build('staff', card));
    expect(e.trace.focal.gem).toBe('sapphire'); expect(e.trace.bark).toBe('silverfir');
  });
  it('a gem word, an override, or none', () => {
    expect(at('sword', 'dwarven', 0.5).trace.focal.gem).toBe('ruby');
    expect(expandEquipment(build('sword', 'dwarven', { gem: 'amethyst' })).trace.focal.gem).toBe('amethyst');
    expect(expandEquipment(build('sword', 'dwarven', { gem: null })).trace.focal).toBeUndefined();
  });
  it('typos name the choices', () => {
    const errs = validateBuild({ type: 'equipment', item: 'swrod', style: 'elvish', parts: { blade: 'katana', helm: 'x' }, gem: 'emerald', dials: { stylize: 2, focus: 'tip' } });
    const text = errs.join('\n');
    for (const want of ['dagger, sword', 'historical, elven', "'katana' is not one of straight", 'build.parts.helm', "'emerald'", 'stylize: a number 0–1']) expect(text).toContain(want);
    expect(() => expandEquipment({ type: 'equipment', item: 'staff', style: 'druid', laws: 99 })).toThrow(/laws 99|carries laws/);
  });
  it('a focus the item cannot take is refused', () => {
    expect(validateBuild(build('staff', 'druid', { dials: { focus: 'pommel' } })).join()).toContain('head, none');
  });
});
