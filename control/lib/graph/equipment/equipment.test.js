// equipment — the laws as tests: every sample builds closed and deterministic, the focal grows with `stylize` on every
// archetype, a face-item's stone spans 6 % → 34 % of the face, a setting touches its stone, the readability floor
// holds on grown branches, inline cards work and typos name the choices.
import { describe, expect, it } from 'vitest';
import { expandEquipment, validateBuild, withEquipment, hasEquipment, EQUIPMENT_ITEMS, LAWS_VERSION } from './expand.js';
import { SEEDED_STYLES, validateStyleCard } from './styles.js';
import { proportion } from './principles.js';
import { planWorkbench, lowerObjectFaces, persistedLedger, WORKBENCH_LIGHT } from '../worlds/workbench.js';
import { validateGear } from '../polygonizer/hero-gear.js';
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
  // F3: every setting grips its stone by the girdle (crystalGirdle), so stone ∪ setting is one body at every stylize
  const CRADLES = [['sword', 'elven', ['pommel']], ['sword', 'druid', ['guard', 'bezel']], ['staff', 'druid', ['branches']],
    ['staff', 'brutal', ['head'], { head: 'claw', focus: 'head' }, 'ruby'], ['staff', 'celestial', ['head', 'bezel']],
    ['bow', 'elven', ['riser', 'bezel']], ['shield', 'celestial', ['boss', 'bezel']]];
  for (const [item, style, groups, parts, gem] of CRADLES) {
    it(`${style} ${item}: the setting grips the stone at every stylize`, () => {
      for (const s of [0, 0.5, 1]) {
        const f = lowerObjectFaces(withEquipment({ build: build(item, style, { dials: { stylize: s }, ...(parts ? { parts } : {}), ...(gem ? { gem } : {}) }) }), WORKBENCH_LIGHT);
        expect(solidComponentsStable(f.filter((x) => x.group === 'stone' || groups.includes(x.group)), { cells: 128 }).count).toBe(1);
      }
    });
  }
  it('the cut follows the setting: a raw crystal set face-on becomes a cabochon; a cradle keeps it raw', () => {
    const face = withEquipment({ build: build('sword', 'druid') }).fields.flatMap((f) => f.terms).filter((t) => t.id === 'stone');
    expect(face.every((t) => t.shape.cut === 'cabochon')).toBe(true);
    const cradle = withEquipment({ build: build('staff', 'druid') }).fields.flatMap((f) => f.terms).filter((t) => t.id === 'stone');
    expect(cradle[0].shape.cut).toBe('natural');
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
  it('a role may be a metal surface; a bad one names the metals', () => {
    const card = JSON.parse(JSON.stringify(SEEDED_STYLES.dwarven));
    expect(card.roles.blade).toEqual({ metal: 'steel', finish: 'polished', film: { temper: 300 } });
    const lofts = expandEquipment(build('sword', 'dwarven')).monomers.lofts;
    expect(lofts.find((l) => l.group === 'blade').material).toEqual(card.roles.blade);
    card.roles.blade = { metal: 'mithril' };
    expect(validateStyleCard(card).join()).toMatch(/unknown metal 'mithril'.*steel/);
  });
  it('a focus the item cannot take is refused', () => {
    expect(validateBuild(build('staff', 'druid', { dials: { focus: 'pommel' } })).join()).toContain('head, none');
  });
  // a stone-cradling head with no stone to cradle, and a bow with no limb, used to validate clean and then throw a raw
  // TypeError (or build NaN coordinates) in the kernel
  it('a staff head that cradles a stone is refused by name when none resolves', () => {
    for (const [extra, why] of [[{ style: 'historical', parts: { head: 'branch' } }, "the 'historical' card carries no gem"], [{ style: 'historical', parts: { head: 'claw' } }, 'carries no gem'],
      [{ style: 'eastern', parts: { head: 'crescent' } }, 'carries no gem'], [{ style: 'brutal', parts: { head: 'block' } }, 'carries no gem'],
      [{ style: 'elven', gem: null }, 'gem: null'], [{ style: 'elven', dials: { focus: 'none' } }, "focus 'none'"]]) {
      const b = { type: 'equipment', item: 'staff', seed: 3, ...extra };
      const text = validateBuild(b).join('\n');
      expect(text).toContain('build.parts.head:'); expect(text).toContain(why); expect(text).toContain('plain, mace, ringed');
      expect(() => expandEquipment(b)).toThrow(/Invalid equipment build/);
    }
    // the same heads with a stone still build; the gemless heads never needed one
    expect(validateBuild(build('staff', 'historical', { parts: { head: 'branch', focus: 'head' }, gem: 'ruby' }))).toEqual([]);
    expect(validateBuild(build('staff', 'elven', { gem: null, parts: { head: 'mace' } }))).toEqual([]);
  });
  it('the hero gear door refuses the same stoneless head instead of throwing mid-plan', () => {
    expect(validateGear({ right: { item: 'staff', style: 'elven', gem: null } }).join()).toMatch(/^gear\.right: build\.parts\.head: 'branch' cradles a stone/);
  });
  it('a bow needs a limb: an inline card without one is refused, not built with NaN', () => {
    const card = JSON.parse(JSON.stringify(SEEDED_STYLES.elven)); delete card.language.bow;
    expect(validateBuild(build('bow', card)).join()).toMatch(/build\.parts\.limb: a bow needs a limb — one of longbow, recurve, horn, yumi/);
    expect(validateBuild(build('bow', card, { parts: { limb: 'yumi' } }))).toEqual([]);
  });
  it('counts and multipliers are bounded by name (a runaway number is refused, not built)', () => {
    expect(validateBuild(build('staff', 'druid', { parts: { limbs: 400, twigs: 400 } }))).toEqual(['build.parts.limbs: an integer 1–8', 'build.parts.twigs: an integer 0–6']);
    const card = JSON.parse(JSON.stringify(SEEDED_STYLES.brutal));
    Object.assign(card.edge, { barbs: 200000, fuller: 3 }); Object.assign(card.lean, { grip: 2000, width: 1 }); card.dials.ornament = 9; card.language.staff.limbs = 0;
    const errs = validateStyleCard(card);
    for (const want of ['style.edge.barbs: an integer 0–12', 'style.edge.fuller: a number 0–1', 'style.lean.grip: a multiplier 0.25–4', 'style.lean.width: not a lean', 'style.dials.ornament: an integer 0–3', 'style.language.staff.limbs: an integer 1–8']) expect(errs.join('\n')).toContain(want);
  });
});

describe('the ledger counts the item once', () => {
  it('planWorkbench lowers a build once: stats.faces and the persisted ledger match the lowered item', () => {
    const b = build('sword', 'historical');
    const once = lowerObjectFaces({ build: b }, WORKBENCH_LIGHT).length;
    const { stats } = planWorkbench({ kind: 'workbench', units: 'cm', build: b });
    expect(stats.faces).toBe(once);
    expect(persistedLedger(stats.ledger).faces).toBe(once);
    expect('build' in withEquipment({ build: b })).toBe(false);
  });
});
