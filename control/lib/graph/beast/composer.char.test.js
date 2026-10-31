// Characterization pin: the kin presets compose what their cards made (beast/cards.js, the people composer). Taken
// before the cards became presets over a neutral base, one kin per procedure the cards run (chosen in code): a
// plantigrade body with a hump, a digitigrade one with a ruff, a coil, a crest of spines with a thick tail, and the
// frame's additions (an abdomen, a second pair of arms, the arm-wings). The stored record and the plan, byte for byte.
// A change is legitimate only when the step says the presets' emission changes. And the composer itself: a beast of its
// words alone (no kin), a word over its preset's, every new word refused by name.
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { BEAST_KINS, BEAST_BASE } from './cards.js';
import { beastWords, beastCard } from './tiered.js';
import { beastCoverOf, beastCoatOf } from './cover.js';
import { HEAD_LIBRARY, headPlan, headFor } from '../creature-heads/index.js';
import { heroRecord, heroPlanOf, validateHeroSpec, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { withDefaultForm, withDefaultWalk } from '../polygonizer/motion-stamp.js';
import { compileLayered } from '../polygonizer/station-loft.js';
import { validateRig, bindLayered, auditRig } from '../polygonizer/station-loft-rig.js';

const mint = (spec) => heroRecord(withDefaultWalk(beastWords(withDefaultForm(spec))));
const h = (x) => createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 16);
const kinWith = (pred) => Object.keys(BEAST_KINS).find((k) => pred(BEAST_KINS[k]));
const CASES = {
  plantigrade: { cast: 'male', beast: { kin: kinWith((c) => !c.legs && c.hump > 0.3) } },
  digitigrade: { cast: 'male', beast: { kin: kinWith((c) => c.ruff === 'ruff'), legs: 'digitigrade' } },
  coil: { cast: 'female', beast: { kin: kinWith((c) => c.legs === 'serpent') } },
  ridged: { cast: { pole: 'male', build: 'brute' }, beast: { kin: kinWith((c) => c.ridge === 'spines'), legs: 'digitigrade' } },
  frame: { cast: 'male', beast: { kin: kinWith((c) => c.abdomen === 'gaster'), arms: 4 } },
  winged: { cast: 'female', beast: { kin: kinWith((c) => c.keel > 0.5), legs: 'digitigrade', wings: 'arms' } },
};
const PINS = {
  plantigrade: ['c41bb0eb0ae443b1', 'd7f91ee2a0c8ebed'], digitigrade: ['3d4175a71c6a8150', '075b0200012951a1'],
  coil: ['b39ad544cde718e3', '3f1e7c335efbfed4'], ridged: ['c4b932beabe405a8', '21c75f71c17b6632'],
  frame: ['3170050a18c41127', 'e2804beb1c150914'], winged: ['6a072679f6f5dfb7', '4f1319463ecd6e2f'],
};

describe('the kin presets compose what their cards made', () => {
  for (const [name, spec] of Object.entries(CASES)) it(name, () => {
    const R = heroRecord(withDefaultWalk(beastWords(withDefaultForm(spec)))), P = heroPlanOf(R);
    expect([h(R), h(P)]).toEqual(PINS[name]);
  }, 60_000);
});

describe('a beast of its words alone', () => {
  // (a skull the library holds, chosen in code: one drawn about the origin)
  const SKULL = Object.keys(HEAD_LIBRARY).find((id) => headPlan(id).units);
  const WORDS = { legs: 'digitigrade', tail: 'thick', claws: 'long', clawTone: '#e6dfcc', cover: 'scales', hunch: 10, mass: { trunk: 1.1, thigh: 1.2 }, hump: 0.2, ridge: 'spines', head: SKULL };
  const names = (hero) => heroPlanOf(mint(hero)).segments.map((s) => s.name).sort();

  it('no kin: the door takes it, its anatomy its words (the base a person\'s where it names nothing)', () => {
    expect(validateHeroSpec({ cast: 'male', beast: WORDS })).toEqual([]);
    const H = mint({ cast: 'male', beast: WORDS }), P = heroPlanOf(H), C = beastCard(H);
    expect(C.kin).toBeUndefined(); expect(C.fingers).toBe(BEAST_BASE.fingers); expect(C.claw).toBe('#e6dfcc'); expect(C.rest.hunch).toBe(10);
    expect(P.heads[0].plan).toBeTruthy(); expect(P.segments.some((s) => /^tail/.test(s.name))).toBe(true);
    expect(P.segments.some((s) => /Claw/.test(s.name))).toBe(true); expect(beastCoverOf(H)).toBe('scales');
    // (no head word: a person's, bald under its coat; a coil from the word, its coat whole)
    const bare = mint({ cast: 'female', beast: { legs: 'serpent' } });
    expect(heroPlanOf(bare).heads?.[0]?.plan).toBeFalsy(); expect(bare.hair?.style ?? bare.hair).toBe('none');
    expect(heroPlanOf(bare).segments.some((s) => s.name === 'coil')).toBe(true); expect(beastCoatOf(bare).has('Top')).toBe(true);
  }, 60_000);

  it('mints, binds and rigs whole', () => {
    const { recipe, dials } = expandLayeredManifest({ kind: 'layered', hero: mint({ cast: 'male', beast: WORDS }) }), R = validateRig(recipe.rig), mesh = compileLayered(recipe, dials);
    const A = auditRig(mesh, bindLayered(mesh, recipe, R), R);
    expect(A.badWeights).toBe(0); expect(A.restIdentity).toBeLessThan(1e-9);
  }, 60_000);

  it('a kin is a preset: its anatomy spelled out as words builds the same parts, and a word stands over its preset\'s', () => {
    const kin = Object.keys(BEAST_KINS).find((k) => BEAST_KINS[k].tail !== 'none' && headFor(k)), K = { ...BEAST_BASE, ...BEAST_KINS[kin] };
    const spelled = { legs: K.legs, fingers: K.fingers, toes: K.toes, claws: K.claws, tail: K.tail, abdomen: K.abdomen, ridge: K.ridge, ruff: K.ruff, cover: K.cover, coat: K.coat, hair: K.hair, mass: K.mass, hump: K.hump, keel: K.keel, hunch: K.rest.hunch, head: headFor(kin).id };
    expect(names({ cast: 'male', beast: spelled })).toEqual(names({ cast: 'male', beast: { kin } }));
    expect(names({ cast: 'male', beast: { kin, tail: 'none' } }).some((n) => /^tail/.test(n))).toBe(false);
  }, 60_000);

  it('each new word refused by name', () => {
    const errs = (beast) => validateHeroSpec({ cast: 'male', beast }).join(' | ');
    expect(errs({ clawTone: 'red' })).toMatch(/beast\.clawTone/);
    expect(errs({ hunch: 50 })).toMatch(/beast\.hunch/);
    expect(errs({ coat: 'top' })).toMatch(/beast\.coat/);
    expect(errs({ hair: 'yes' })).toMatch(/beast\.hair/);
    expect(errs({ kin: 'goblin' })).toMatch(/beast\.kin/);
    expect(errs({})).toBe('');
  });
});
