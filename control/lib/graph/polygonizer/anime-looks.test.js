/** Looks (anime-looks.js): presets as words that compose. The tables are disjoint; every preset builds a closed head whose
 * eyes read (unless its pose closes them) with no advice at its own values; composition keeps its laws. */
import { describe, it, expect } from 'vitest';
import { ANIME_LOOKS, LOOK_TABLES, LOOK_WORDS, validateLook, resolveLook, lookEntries, composeAnime } from './anime-looks.js';
import { animeHead, animeFaceWarnings, animeHairWarnings, animeExpressionWarnings, ANIME_FACE_MOVES, ANIME_HAIR_MOVES, ANIME_POSES, ANIME_HAIR_BASE, resolveAnimeHair } from './anime-head.js';
import { tuneWarnings } from './hero-form.js';
import { ANIME_SCULPT_MOVES, animeSculptWarnings } from './anime-sculpt.js';
import { compileLayered, auditLayered } from './station-loft.js';
import { layeredExposure } from './station-loft-exposure.js';

const failures = (m) => Object.entries(auditLayered(m)).filter(([, r]) => !r.pass).map(([n]) => n);
const closedEyes = (e) => e.blink >= 0.985;

describe('looks: the tables', () => {
  it('six tables, one meaning per word', () => {
    expect(new Set(LOOK_WORDS).size).toBe(LOOK_WORDS.length);
    expect(LOOK_TABLES.archetype).toEqual(Object.keys(ANIME_LOOKS)); expect(LOOK_TABLES.sculpt).toEqual(Object.keys(ANIME_SCULPT_MOVES));
    expect(LOOK_TABLES.face).toEqual(Object.keys(ANIME_FACE_MOVES)); expect(LOOK_TABLES.pose).toEqual(Object.keys(ANIME_POSES));
    for (const w of Object.keys(ANIME_HAIR_MOVES)) expect(LOOK_TABLES.hair).toContain(w);
  });
  it('an archetype names only shape: face, sculpt, hair, expression, tune — never palette, cast, register or head', () => {
    for (const [name, L] of Object.entries(ANIME_LOOKS)) { expect(Object.keys(L).every((k) => ['note', 'face', 'sculpt', 'hair', 'expression', 'tune'].includes(k)), name).toBe(true); expect(validateLook(name)).toEqual([]); }
  });
  it('refuses an unknown word by name, with the tables', () => {
    expect(validateLook(['heroine', 'mohawk'])[0]).toMatch(/look\[1\]: unknown look word 'mohawk' \(archetypes heroine/);
    expect(validateLook([{ face: {} }])[0]).toMatch(/a look is a word/);
  });
});

describe('looks: composition', () => {
  it('ratios by product, offsets by sum; a family and a pose are last-wins', () => {
    const r = resolveLook(['tsurime', 'tareme']);
    expect(r.face.tilt).toBeCloseTo(0, 9); expect(r.face.eyeHeight).toBeCloseTo(0.94 * 1.04, 6);
    const h = resolveLook(['heroine', 'bob', 'angry']);
    expect(h.hair.style).toBe('bob'); expect(h.expression).toEqual({ ...ANIME_POSES.angry, smile: 0 });
    expect(h.hair.sweep).toBeCloseTo(0.2, 9);   // heroine's swept bangs stay under the new family
    expect(resolveLook('tsurime').hair.style).toBeNull(); expect(resolveLook('tsurime').expression).toBeNull();
  });
  it('the own layer is last, and a peeled word restores the prior values exactly', () => {
    const base = composeAnime({ lookResolved: resolveLook(['heroine']), face: { eyeHeight: 1.1 }, hair: { style: null, length: 1.1, locks: {} } }, 'bob');
    const more = composeAnime({ lookResolved: resolveLook(['heroine', 'tsurime']), face: { eyeHeight: 1.1 }, hair: { style: null, length: 1.1, locks: {} } }, 'bob');
    const peeled = composeAnime({ lookResolved: resolveLook(['heroine']), face: { eyeHeight: 1.1 }, hair: { style: null, length: 1.1, locks: {} } }, 'bob');
    expect(peeled).toEqual(base); expect(more.face.tilt).toBeCloseTo(base.face.tilt + 0.05, 9);
    expect(base.face.eyeHeight).toBeCloseTo(resolveLook('heroine').face.eyeHeight * 1.1, 6);
    expect(base.hair).toMatchObject({ style: 'long', length: 1.1 }); expect(base.tune.head).toBe(1);   // the anime proportions carry the head; the heroine adds none
    // the own family and pose win over the look's
    const own = composeAnime({ lookResolved: resolveLook(['heroine']), hair: { style: 'short', locks: {} }, expression: 'worried' }, 'bob');
    expect(own.hair.style).toBe('short'); expect(own.expression).toEqual({ blink: 0.1, smile: 0, open: 0, brow: -0.8 });
    // no look: the own layer alone, the base's family by default
    expect(composeAnime({ face: {}, hair: { style: null, locks: {} } }, 'short').hair.style).toBe('short');
  });
  it('the hair base: its form under every family, its cut only while nothing names a family; the advice reads past the words', () => {
    const own = (hair = {}) => ({ face: {}, hair: { style: null, locks: {}, ...hair } });
    const at = (hero, pole = 'female') => composeAnime(hero, pole === 'male' ? 'short' : 'bob', { hairBase: ANIME_HAIR_BASE[pole] });
    // nothing named: the cut (the female's side-parted sheet, the male's swept-back mass) over the form
    const f = at(own()); expect(f.hairCut).toBe('side-parted'); expect(f.hair).toMatchObject({ style: 'long', part: 0.15, thickness: 1.4, section: 'ridge', backNotch: 0.9 });
    const m = at(own(), 'male'); expect(m.hairCut).toBe('swept-back'); expect(m.hair).toMatchObject({ style: 'short', clump: 1.12, thickness: 1.5, crownAccents: 'none', hairline: { front: 0.7 } });
    // the own controls compose on the cut; a face-only look keeps it
    expect(at(own({ length: 1.1 })).hair.length).toBeCloseTo(1.32, 9); expect(at({ ...own(), lookResolved: resolveLook(['tsurime']) }).hairCut).toBe('side-parted');
    // a family named by the operator or a look: that family as designed, the form under it, no cut
    const bob = at(own({ style: 'bob' })); expect(bob.hairCut).toBeNull(); expect(bob.hair).toMatchObject({ style: 'bob', part: 0, length: 1, thickness: 1.4, lift: ANIME_HAIR_BASE.female.form.lift }); expect(bob.hair.locks).toEqual({});
    const heroine = at({ ...own(), lookResolved: resolveLook(['heroine']) }); expect(heroine.hairCut).toBeNull(); expect(heroine.hair).toMatchObject({ style: 'long', sweep: 0.2, part: 0.1 });
    // the form's words give way to the operator's; bald wears nothing
    expect(at(own({ lift: false, section: 'round' })).hair).toMatchObject({ lift: false, section: 'round' });
    expect(at({ face: {}, hair: 'none' }).hair).toBe('none'); expect(at({ face: {}, hair: 'none' }).hairCut).toBeNull();
    // an own layer stored as a LIST (a family word and its edits, as the door stores a manifest's words) names its family
    const listed = at({ face: {}, hair: ['long', { locks: { 'left-temple-0': { ty: 0.5 } } }] });
    expect(listed.hairCut).toBeNull(); expect(listed.hair).toMatchObject({ style: 'long', part: 0, thickness: 1.4 }); expect(listed.hair.locks).toEqual({ 'left-temple-0': { ty: 0.5 } });
    // without a base: exactly the composition before it
    expect(composeAnime(own(), 'bob').hair).toEqual({ ...resolveAnimeHair([{ style: null, locks: {} }]), style: 'bob' }); expect(composeAnime(own(), 'bob').hairCut).toBeNull();
    // the words' own values never advise (the cut's lock edits past ±0.2 are the word's); the operator's past them do
    expect(animeHairWarnings(f.hair, { words: f.hairWords })).toEqual([]);
    const pushed = at(own({ locks: { 'left-temple-0': { ty: 0.3 } } })); expect(animeHairWarnings(pushed.hair, { words: pushed.hairWords })).toEqual([expect.stringMatching(/hair\.locks\.left-temple-0\.ty 1\.08 is past the studio's ±0\.2 off the words' 0\.78/)]);
  });
  it('hair traits direct clumps: peekaboo drops one bang; messy is authored, not dice', () => {
    expect(resolveLook('peekaboo').hair.locks).toEqual({ 'fringe-3': { ty: -0.16, tx: 0.03, tz: -0.02 } });
    expect(resolveLook(['messy', 'messy']).hair.locks['back-3']).toEqual({ tx: -0.12 });
    expect(JSON.stringify(resolveLook('messy'))).toBe(JSON.stringify(resolveLook('messy')));
  });
  it('lookEntries keeps the order the words were said in', () => {
    expect(lookEntries(['rival', 'tareme']).face).toEqual(['sharp', 'tsurime', 'narrow-eyes', 'tareme']);
  });
});
