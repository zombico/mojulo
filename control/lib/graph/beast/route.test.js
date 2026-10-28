// The egocube's route to the seventh generation (egocube/plan.js `beastOf`): a beast-kin's sheet of a kin the cards know
// is lowered onto the tiered body through the hero door, its notes as the beast's words; `gen: 6` keeps the creature
// biped; a people with no card stays on it; clothed from the cut when person enough, else bare, the ledger saying which.
import { describe, it, expect } from 'vitest';
import { rollEgocube } from '../egocube/egocube.js';
import { planFromSheet, beastOnTiered, CLOTHED_H } from '../egocube/plan.js';
import { BEAST_KINS } from './cards.js';
import { beastWords } from './tiered.js';
import { validateHeroSpec, heroRecord, heroPlanOf, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { withDefaultForm, withDefaultWalk } from '../polygonizer/motion-stamp.js';
import { compileLayered } from '../polygonizer/station-loft.js';

const roll = (facets, extra = {}) => rollEgocube({ seed: 3, facets, ...extra });
const KINS = Object.keys(BEAST_KINS);

describe('the egocube\'s route to the tiered body', () => {
  it('a beast-kin\'s sheet is the hero door\'s call: its kin, legs, tail, claws, cover, head and expression from the sheet', () => {
    for (const kin of KINS) {
      const sheet = roll({ ancestry: kin, humanity: 0.3 }), P = planFromSheet(sheet);
      expect(P.door, kin).toBe('hero'); expect(P.beast).toBe(true); expect(P.create.as).toBe('hero');
      const { spec } = P.create, b = spec.beast, hints = sheet.ancestry.plan || {};
      expect(spec.form).toBe('tiered'); expect(b.kin).toBe(kin);
      expect(b.legs, kin).toBe(Object.values(sheet.derives).some((l) => l.includes('legs = digitigrade')) ? 'digitigrade' : 'plantigrade');
      expect(b.claws).toBe(hints.claws ?? 'none'); expect(b.tail).toBe(hints.tail ?? 'none');
      expect(b.cover).toBe(kin === 'avian' ? 'feathers' : hints.cover?.kind ?? 'none');
      expect(spec.tune.stature).toBeGreaterThanOrEqual(0.85); expect(spec.tune.stature).toBeLessThanOrEqual(1.15);
      // (its build the tiered body's own, the cast's build form; a child's the pole's cast)
      expect(spec.cast).toEqual(sheet.facets.age === 'child' ? sheet.facets.pole : { pole: sheet.facets.pole, build: sheet.facets.build });
      expect(validateHeroSpec(spec), kin).toEqual([]);
      for (const r of P.ledger) expect(Boolean(r.at) !== Boolean(r.pending), `${kin}: ${r.line}`).toBe(true);
    }
    const legs = (kin) => planFromSheet(roll({ ancestry: kin, humanity: 0.3 })).create.spec.beast.legs;
    expect(new Set(KINS.map(legs))).toEqual(new Set(['digitigrade', 'plantigrade']));   // (both procedures reached)
  });

  it('the frame\'s wings ride the arms and a second pair of arms is the beast\'s; the ledger says where each landed', () => {
    const bird = planFromSheet(roll({ ancestry: 'avian', humanity: 0.3 })), bug = planFromSheet(roll({ ancestry: 'insectoid', humanity: 0.3 }));
    expect(bird.create.spec.beast.wings).toBe('arms');
    expect(bird.ledger.find((r) => /wings on the arms/.test(r.line)).at).toMatch(/spec\.beast\.wings/);
    expect(bug.create.spec.beast.arms).toBe(4);
    expect(bug.ledger.find((r) => /second pair of arms/.test(r.line)).at).toMatch(/spec\.beast\.arms/);
  });

  it('`gen: 6` keeps the creature biped; a people with no card stays on it', () => {
    const sheet = roll({ ancestry: 'lupine', humanity: 0.3 });
    const six = planFromSheet(sheet, { gen: 6 });
    expect(six.door).toBe('creature'); expect(six.create.spec.plan).toBeTruthy(); expect(six.beast).toBeUndefined();
    const quill = { reads: 'porcupine-kin', humanity: [0.2, 0.5], cover: { brown: '#5a4632' }, cues: [{ at: 1, ch: 'structure', line: 'a blunt muzzle', derives: ['door = creature'] }] };
    const own = roll({ ancestry: 'quill', humanity: 0.3 }, { lineages: { quill } });
    expect(planFromSheet(own).door).toBe('creature');
    expect(beastOnTiered(sheet)).toBe(true); expect(beastOnTiered(own)).toBe(false);
    expect(beastOnTiered(roll({ ancestry: 'lupine', humanity: 0.9 }))).toBe(false);   // (above the door: a person)
  });

  it('clothed from the cut when designed and person enough; under CLOTHED_H bare, the ledger saying so', () => {
    const person = planFromSheet(roll({ ancestry: 'feline', humanity: 0.4 }), { dress: 'designed' });
    expect(person.create.spec.outfit).toBeTruthy(); expect(person.outfit).toBeTruthy();
    expect(validateHeroSpec(person.create.spec)).toEqual([]);
    const beast = planFromSheet(roll({ ancestry: 'lupine', humanity: CLOTHED_H - 0.03 }), { dress: 'designed' });
    expect(beast.create.spec.outfit).toBeUndefined();
    const dress = beast.ledger.filter((x) => x.channel === 'dress');
    expect(dress.length).toBeGreaterThan(0); for (const r of dress) expect(r.pending).toMatch(/adornment/);
  });

  it('the call mints: the tiered body compiles from it, deterministic', () => {
    const spec = planFromSheet(roll({ ancestry: 'lupine', humanity: 0.3 })).create.spec;
    const mint = () => { const hero = heroRecord(withDefaultWalk(beastWords(withDefaultForm(spec)))), { recipe, dials } = expandLayeredManifest({ kind: 'layered', hero });
      return compileLayered(recipe, dials); };
    const a = mint(); expect(a.faces.length).toBeGreaterThan(1000);
    expect(JSON.stringify(mint().vertices)).toBe(JSON.stringify(a.vertices));
    // (the face's derives reach the library head as its expression; a control outside −1 … 1 is refused)
    expect(Object.keys(spec.beast.expression).length).toBeGreaterThan(0);
    expect(heroPlanOf(heroRecord(withDefaultWalk(beastWords(withDefaultForm(spec))))).heads[0].expression).toEqual(spec.beast.expression);
    for (const bad of [{ browRaise: 2 }, ['browRaise'], 'sneer']) expect(validateHeroSpec({ ...spec, beast: { ...spec.beast, expression: bad } }).join()).toMatch(/beast\.expression/);
  }, 60_000);
});
