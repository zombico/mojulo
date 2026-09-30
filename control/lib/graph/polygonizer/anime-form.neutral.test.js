/** The port stays pinned under mojulo's own options: an absent, empty or explicitly neutral SCULPT (the graphic face) or
 * HAIR FORM (the hair bases) builds the studio's head bit for bit — the same per-part digest as anime-form.test.js, over
 * the same fixture (anime-form.fixture.json, the port of the studio's model.js on dmath) — and each word moves only its own parts.
 * Kept beside the port's own test so that file stays the studio's contract alone. */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { buildAnime, animeFresh, animeReadRecipe, sculptOf, hairFormOf, SCULPT_NEUTRAL, HAIR_FORM_NEUTRAL } from './anime-form.js';
import { sculptBuild, resolveAnimeSculpt } from './anime-sculpt.js';

const FIXTURE = JSON.parse(readFileSync(fileURLToPath(new URL('./anime-form.fixture.json', import.meta.url)), 'utf8'));
const hashOf = (arr) => createHash('sha256').update(Buffer.from(new Float64Array(arr).buffer)).digest('hex');
/** anime-form.test.js's digest, the fixture's own shape */
function digest(model) {
  const out = {};
  for (const [k, v] of Object.entries(model.parts)) out[k] = { n: v.length, sha: hashOf(v) };
  out.cage = { n: model.cage.length, sha: hashOf(model.cage) }; out.guides = { n: model.guides.length, sha: hashOf(model.guides) };
  out.locks = { n: model.locks.length, sha: hashOf(model.locks.flatMap((l) => [...l.root, ...l.control, ...l.tip, l.width, l.start, l.count])), names: model.locks.map((l) => l.name).join(',') };
  out.headPolygons = { n: model.headPolygons.length, sha: hashOf(model.headPolygons.flat(2)) };
  return out;
}

// mojulo's SCULPT (the graphic face) stays off the studio's path: an absent, empty or explicitly neutral sculpt builds the
// studio's head bit for bit (the fixture), each word gates only its own parts, and the lens budget is its own option.
describe('anime-form: the sculpt keeps the port pinned', () => {
  const ROUND = { h: 1, hDn: 1, upper: { m: 2, p: 0.5, k: 0 }, lower: { m: 2, p: 0.5, k: 0 } };
  const NEUTRALS = { null: null, empty: {}, neutral: { ...SCULPT_NEUTRAL }, 'neutral, the round fissure and null words': { ...SCULPT_NEUTRAL, fissure: ROUND, lidWeight: null, brow: null, nose: null, noseLine: null, catchlight: null, lidCover: false, ear: null, lidShut: null, scleraShut: null } };
  for (const c of FIXTURE.cases) it(`explicit neutral sculpts are the studio: ${c.name}`, () => {
    for (const [name, sculpt] of Object.entries(NEUTRALS)) expect(digest(buildAnime(animeReadRecipe(c.recipe), { ...c.options, sculpt })), name).toEqual(c.digest);
  });
  it("the hero's options (weld, the hair fit, forms) under a neutral sculpt: every family, both bases", () => {
    for (const kind of ['female', 'male']) for (const style of ['bob', 'short', 'long']) {
      const r = animeFresh(kind); r.hair.style = style; const o = { weld: true, fitHair: true, forms: true }, ref = digest(buildAnime(r, o));
      for (const sculpt of Object.values(NEUTRALS)) expect(digest(buildAnime(r, { ...o, sculpt })), `${kind} ${style}`).toEqual(ref);
    }
    expect(sculptOf(SCULPT_NEUTRAL)).toBeNull(); expect(sculptOf({ fissure: { h: 1 } })).toBeNull(); expect(sculptOf({ pupil: 0.4 })).toEqual({ pupil: 0.4 });
  });
  it('each word alone moves only its own parts; a stroke or a lens never touches the skin, a word never the hair', () => {
    const r = animeFresh('male'), B = sculptBuild('male', resolveAnimeSculpt({})), ref = digest(buildAnime(r, { weld: true }));
    const moved = (sculpt, from = ref) => { const d = digest(buildAnime(r, { weld: true, sculpt })); return [...new Set([...Object.keys(d), ...Object.keys(from)])].filter((k) => JSON.stringify(d[k]) !== JSON.stringify(from[k])).sort(); };
    // the construction words: exactly their parts (a new part key only while its word is on)
    expect(moved({ pupil: B.pupil })).toEqual(['pupil']);
    expect(moved({ lowerRim: 1.5 })).toEqual(['ink']);
    expect(moved({ lidCover: B.lidCover })).toEqual(['iris', 'pupil']);
    expect(moved({ lidWeight: B.lidWeight })).toEqual(['ink', 'lid']);
    expect(moved({ brow: B.brow })).toEqual(['brow', 'ink']);
    expect(moved({ noseLine: B.noseLine })).toEqual(['nose']);
    // the surface words: the face's sampled parts, never the hair
    const FACE = ['cage', 'headPolygons', 'ink', 'iris', 'mouth', 'pupil', 'sclera', 'skin'];
    for (const k of ['eyeLevel', 'stomion', 'mouthWidth', 'nose', 'canthusSetback', 'fissure']) { const m = moved({ [k]: B[k] }); expect(m.length, k).toBeGreaterThan(0); expect(m.filter((p) => !FACE.includes(p)), k).toEqual([]); }
    // the dependants move only their own part beside the word they ride on
    const lens = { lidCover: B.lidCover }, lensRef = digest(buildAnime(r, { weld: true, sculpt: lens }));
    expect(moved({ ...lens, catchlight: B.catchlight }, lensRef)).toEqual(['catch']);
    expect(moved({ ...lens, irisSpan: 1.2, irisOval: 0.9 }, lensRef)).toEqual(['iris', 'pupil']);
    const lid = { lidWeight: B.lidWeight }, lidRef = digest(buildAnime(r, { weld: true, sculpt: lid }));
    expect(moved({ ...lid, lidTail: 0.3, lidTailAngle: 10, lidFlick: 15, lidLean: 0.4 }, lidRef)).toEqual(['lid']);
    // the ear's lift moves the skin alone (the ears are its closed volumes)
    expect(moved({ ear: B.ear })).toEqual(['skin']);
    // shutting: the lid band's lidShut and the brow's shutLift move nothing on an open eye, only their own part at a blink
    expect(moved({ ...lid, lidShut: B.lidShut }, lidRef)).toEqual([]);
    expect(moved({ brow: B.brow }, digest(buildAnime(r, { weld: true, sculpt: { brow: { ...B.brow, shutLift: undefined } } })))).toEqual([]);
    const rb = animeFresh('male'); rb.expression.blink = 1;
    const at = (sculpt) => digest(buildAnime(rb, { weld: true, sculpt })), diff = (a, b) => Object.keys(a).filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
    expect(diff(at({ ...lid, lidShut: B.lidShut }), at(lid))).toEqual(['lid']);
    expect(diff(at({ brow: B.brow }), at({ brow: { ...B.brow, shutLift: undefined } }))).toEqual(['brow']);
  });
  // scleraShut (the graphic bases' build field): shutting, the sclera's dish flattens and the lid band's lower edge tucks
  // further under the opening; nothing moves at or below a blink of 0.7, and nothing but those two parts past it
  it("the sclera's scleraShut moves only the sclera and the lid band, and only past a blink of 0.7", () => {
    for (const kind of ['male', 'female']) {
      const S = sculptBuild(kind, resolveAnimeSculpt({})), { scleraShut, ...rest } = S;
      expect(scleraShut, kind).toBe(0.1);
      for (const weld of [true, false]) for (const blink of [0, 0.5, 0.7, 0.85, 1]) {
        const r = animeFresh(kind); r.expression.blink = blink;
        const a = digest(buildAnime(r, { weld, sculpt: S })), b = digest(buildAnime(r, { weld, sculpt: rest }));
        expect(Object.keys(a).filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k])).sort(), `${kind} weld ${weld} blink ${blink}`).toEqual(blink > 0.7 ? ['lid', 'sclera'] : []);
      }
    }
  });
  it("the lens budget is its own option: 'game' moves only the iris and the pupil, never keyed on coarse", () => {
    for (const coarse of [false, true]) {
      const r = animeFresh('female'), a = digest(buildAnime(r, { coarse })), b = digest(buildAnime(r, { coarse, budget: 'game' }));
      expect(Object.keys(a).filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]))).toEqual(['iris', 'pupil']);
      expect(b.iris.n).toBeLessThan(a.iris.n / 2);
    }
  });
});

// mojulo's HAIR FORM (the lift, the section, the cut's words) stays off the studio's path the same way: an absent,
// empty or explicitly neutral form builds the studio's head bit for bit, per part, with or without the hero's options, and
// each term moves only the hair (its parts, the lock curves and their guides), never the face.
describe('anime-form: the hair form keeps the port pinned', () => {
  const NEUTRALS = { undefined, null: null, empty: {}, neutral: { ...HAIR_FORM_NEUTRAL, lift: null, dome: false, sweepBack: 0, sweepSides: { amount: 0 }, hairline: { front: 0.53 }, fringeGroups: null, backNotch: false } };
  for (const c of FIXTURE.cases) it(`explicit neutral hair forms are the studio: ${c.name}`, () => {
    for (const [name, hairForm] of Object.entries(NEUTRALS)) expect(digest(buildAnime(animeReadRecipe(c.recipe), { ...c.options, hairForm })), name).toEqual(c.digest);
  });
  it('undefined and {} are byte-identical per part: both bases, every family, coarse and full, the fit and the forms on and off', () => {
    for (const kind of ['female', 'male']) for (const style of ['bob', 'short', 'long', 'hime']) for (const coarse of [false, true]) for (const [fitHair, forms] of [[false, false], [true, false], [false, true], [true, true]]) {
      const r = animeFresh(kind); r.hair.style = style; const o = { coarse, weld: true, fitHair, forms }, ref = digest(buildAnime(r, o));
      for (const [name, hairForm] of Object.entries(NEUTRALS)) expect(digest(buildAnime(r, { ...o, hairForm })), `${kind} ${style} ${coarse ? 'coarse' : 'full'} fit ${fitHair} forms ${forms}: ${name}`).toEqual(ref);
    }
    expect(hairFormOf(NEUTRALS.neutral)).toBeNull(); expect(hairFormOf({ sweepBack: 0.5 })).toEqual({ sweepBack: { amount: 0.5 } }); expect(hairFormOf({ ridge: 0.8, crown: 'grow' })).toEqual({ ridge: 0.8 });
  }, 120_000);   // about 8.5 s alone; the 30 s default times out under a loaded full suite
  it('each term alone moves only the hair: its parts, lock curves and guides — never the face', () => {
    const HAIR = ['guides', 'hair', 'locks'];
    const lift = { crown: 0.16, temple: 0.06, front: 0.06, back: 0.05 };
    for (const [kind, style, terms] of [
      ['male', 'short', { lift: { lift }, dome: { lift, dome: true }, section: { section: 'ridge' }, crownTuck: { crown: 'tuck' }, crownNone: { crown: 'none' }, sweepBack: { sweepBack: { amount: 1, rise: 1.85 } }, hairline: { hairline: { front: 0.8 } }, sweepSides: { sweepSides: { amount: 1, from: 1 } } }],
      ['female', 'long', { lift: { lift }, ridge: { ridge: 0.8 }, flute: { flute: 0.35 }, fringeGroups: { fringeGroups: [[1, 2, 3, 4, 5], [5, 6, 7]] }, backNotch: { backNotch: 0.9 } }]]) {
      const r = animeFresh(kind); r.hair.style = style; const o = { weld: true, fitHair: true, forms: true }, ref = digest(buildAnime(r, o));
      for (const [name, hairForm] of Object.entries(terms)) {
        const d = digest(buildAnime(r, { ...o, hairForm })), moved = Object.keys(ref).filter((k) => JSON.stringify(d[k]) !== JSON.stringify(ref[k])).sort();
        expect(moved.length, `${kind} ${name}`).toBeGreaterThan(0); expect(moved.filter((k) => !HAIR.includes(k)), `${kind} ${name}`).toEqual([]);
      }
    }
    // without the fit the lift has no hull to lift (the studio's cap stands), but its roots still pinch: the hair alone
    const r = animeFresh('male'), a = digest(buildAnime(r, {})), b = digest(buildAnime(r, { hairForm: { lift } }));
    expect(Object.keys(a).filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]))).toEqual(['hair']);
  });
});
