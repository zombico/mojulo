// The egocube's route to the seventh generation (egocube/plan.js `beastOf`): a beast-kin's sheet is lowered onto the
// tiered body through the hero door, its notes as the beast's words, a kin the presets know from its preset and a people
// of the operator's own composed by the cue lexicon (beast/lexicon.js); `gen: 6` keeps the creature biped; clothed from
// the cut when person enough, else bare, the ledger saying which.
import { describe, it, expect } from 'vitest';
import { rollEgocube } from '../egocube/egocube.js';
import { planFromSheet, beastOnTiered, CLOTHED_H } from '../egocube/plan.js';
import { BEAST_KINS } from './cards.js';
import { readAnatomy } from './lexicon.js';
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
      const derived = (w) => Object.values(sheet.derives).some((l) => l.includes(`legs = ${w}`));
      expect(b.legs, kin).toBe(derived('serpent') ? 'serpent' : derived('digitigrade') ? 'digitigrade' : 'plantigrade');
      expect(b.claws).toBe(hints.claws ?? 'none'); expect(b.tail).toBe(hints.tail ?? 'none');
      expect(b.cover).toBe(kin === 'avian' ? 'feathers' : hints.cover?.kind ?? 'none');
      expect(spec.tune.stature).toBeGreaterThanOrEqual(0.85); expect(spec.tune.stature).toBeLessThanOrEqual(1.15);
      // (its build the tiered body's own, the cast's build form; a child's the pole's cast)
      expect(spec.cast).toEqual(sheet.facets.age === 'child' ? sheet.facets.pole : { pole: sheet.facets.pole, build: sheet.facets.build });
      expect(validateHeroSpec(spec), kin).toEqual([]);
      for (const r of P.ledger) expect(Boolean(r.at) !== Boolean(r.pending), `${kin}: ${r.line}`).toBe(true);
    }
    const legs = (kin) => planFromSheet(roll({ ancestry: kin, humanity: 0.3 })).create.spec.beast.legs;
    expect(new Set(KINS.map(legs))).toEqual(new Set(['digitigrade', 'plantigrade', 'serpent']));   // (every procedure reached)
  });

  it('the frame\'s wings ride the arms and a second pair of arms is the beast\'s; the ledger says where each landed', () => {
    const bird = planFromSheet(roll({ ancestry: 'avian', humanity: 0.3 })), bug = planFromSheet(roll({ ancestry: 'insectoid', humanity: 0.3 }));
    expect(bird.create.spec.beast.wings).toBe('arms');
    expect(bird.ledger.find((r) => /wings on the arms/.test(r.line)).at).toMatch(/spec\.beast\.wings/);
    expect(bug.create.spec.beast.arms).toBe(4);
    expect(bug.ledger.find((r) => /second pair of arms/.test(r.line)).at).toMatch(/spec\.beast\.arms/);
  });

  it('its detail from the sheet: a ruff where its fur cue names one, a crest of spikes where its silhouette picks it; the ledger says where', () => {
    for (const kin of KINS) {
      const sheet = roll({ ancestry: kin, humanity: 0.3 }), P = planFromSheet(sheet), b = P.create.spec.beast;
      expect(b.ruff, kin).toBe(sheet.ancestry.plan?.cover?.where?.includes('ruff') ? 'ruff' : 'none');
      const crest = P.ledger.find((r) => /crest of spikes/.test(r.line));
      if (crest) { expect(b.ridge).toBe('spines'); expect(crest.at).toMatch(/spec\.beast\.ridge/); }
      const ruff = P.ledger.find((r) => r.channel === 'cover' && /\bruff\b/.test(r.line));
      if (ruff) expect(ruff.at).toMatch(/spec\.beast\.ruff/);
    }
    expect(KINS.some((k) => planFromSheet(roll({ ancestry: k, humanity: 0.3 })).create.spec.beast.ruff === 'ruff')).toBe(true);   // (reached)
  });

  it('`gen: 6` keeps the creature biped; a people of the operator\'s own takes the tiered body too, an undead form its own', () => {
    const sheet = roll({ ancestry: 'lupine', humanity: 0.3 });
    const six = planFromSheet(sheet, { gen: 6 });
    expect(six.door).toBe('creature'); expect(six.create.spec.plan).toBeTruthy(); expect(six.beast).toBeUndefined();
    const quill = { reads: 'porcupine-kin', humanity: [0.2, 0.5], cover: { brown: '#5a4632' }, cues: [{ at: 1, ch: 'structure', line: 'a blunt muzzle', derives: ['door = creature'] }] };
    const own = roll({ ancestry: 'quill', humanity: 0.3 }, { lineages: { quill } });
    expect(planFromSheet(own).door).toBe('hero'); expect(planFromSheet(own, { gen: 6 }).door).toBe('creature');
    expect(beastOnTiered(sheet)).toBe(true); expect(beastOnTiered(own)).toBe(true);
    expect(beastOnTiered(roll({ ancestry: 'lupine', humanity: 0.9 }))).toBe(false);   // (above the door: a person)
    expect(beastOnTiered(roll({ ancestry: 'zombie', humanity: 0.1 }))).toBe(false);   // (a form of its own)
  });

  it('a people of the operator\'s own is composed from its notes: its words the lexicon\'s, its skull its family\'s, what the composer lacks pending by name', () => {
    const gecko = { reads: 'gecko-kin', humanity: [0.2, 0.4], cover: { green: '#4f7a3a' }, cues: [
      { at: 1, ch: 'structure', line: 'a lizard\'s flat head, wide-mouthed', derives: ['door = creature'] },
      { at: 1, ch: 'frame', line: 'digitigrade legs and a thick tail' },
      { at: 1, ch: 'cover', line: 'fine scales all over' },
      { at: 1, ch: 'ornament', line: 'three-fingered hands' },
      { at: 1, ch: 'silhouette', line: 'hunched and wiry' },
      { at: 1, ch: 'ornament', line: 'small horns over the eyes' }] };
    const G = roll({ ancestry: 'gecko', humanity: 0.3 }, { lineages: { gecko } }), P = planFromSheet(G), { spec } = P.create, b = spec.beast;
    expect(P.door).toBe('hero'); expect(P.beast).toBe(true); expect(P.thesis).toMatch(/composed from its notes/);
    expect(b.kin).toBeUndefined();
    expect(b).toMatchObject({ legs: 'digitigrade', tail: 'thick', cover: 'scales', fingers: 3, hunch: 18 });
    // (its nearest skull, the dragon's, its horns kept because its lines ask for horns; a people that never asks goes without)
    expect(b.head.from).toBe('dragon'); expect(b.head.ornaments).toBeUndefined();
    const hornless = { ...gecko, cues: gecko.cues.filter((c) => !/horns/.test(c.line)) };
    expect(planFromSheet(roll({ ancestry: 'gecko', humanity: 0.3 }, { lineages: { gecko: hornless } })).create.spec.beast.head.ornaments).toEqual({ drop: ['horn'] });
    // (wiry: the lexicon leans the base's girths, the sheet's own variation drawn over them as a preset's are)
    expect(readAnatomy(G).words.mass.trunk).toBeLessThan(1); expect(P.ledger.find((r) => /wiry/.test(r.line)).at).toMatch(/spec\.beast\.mass/);
    expect(validateHeroSpec(spec)).toEqual([]);
    for (const r of P.ledger) expect(Boolean(r.at) !== Boolean(r.pending), r.line).toBe(true);
    expect(P.ledger.find((r) => /horns/.test(r.line)).at).toMatch(/dragon skull's own horns/);
    // (lines from its build and its archetype are the cast's, as a preset kin's are: the lexicon judges its people's only)
    for (const r of P.ledger.filter((x) => !x.from.startsWith('ancestry.') && ['frame', 'silhouette', 'stance'].includes(x.channel))) expect(r.pending ?? '').not.toMatch(/cue lexicon/);
    expect(P.ledger.find((r) => /digitigrade/.test(r.line)).at).toMatch(/spec\.beast\.legs.*spec\.beast\.tail|spec\.beast\.tail.*spec\.beast\.legs/);
    expect(P.ledger.find((r) => r.channel === 'structure').at).toMatch(/nearest library skull, the dragon's/);
    const hero = heroRecord(withDefaultWalk(beastWords(withDefaultForm(spec)))), { recipe, dials } = expandLayeredManifest({ kind: 'layered', hero });
    expect(compileLayered(recipe, dials).faces.length).toBeGreaterThan(1000);
    // (no family word the library knows: a person's head, its structure pending, named; a part it lacks named too)
    const seal = { reads: 'selkie (seal-kin)', humanity: [0.3, 0.45], cover: { grey: '#6a6e72' }, cues: [{ at: 1, ch: 'structure', line: 'a round face, whiskered', derives: ['door = creature'] }, { at: 1, ch: 'frame', line: 'cloven hooves' }, { at: 1, ch: 'ornament', line: 'small horns' }] };
    const S = planFromSheet(roll({ ancestry: 'seal', humanity: 0.35 }, { lineages: { seal } }));
    expect(S.create.spec.beast.head).toBeUndefined(); expect(S.thesis).toMatch(/a person's head/);
    expect(S.ledger.find((r) => r.channel === 'structure').pending).toMatch(/no library skull/);
    expect(S.ledger.find((r) => /hooves/.test(r.line)).pending).toMatch(/hooves/);
    expect(S.ledger.find((r) => /horns/.test(r.line)).pending).toMatch(/ornament/);   // (a person's head carries none)
    expect(validateHeroSpec(S.create.spec)).toEqual([]);
  }, 60_000);

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
