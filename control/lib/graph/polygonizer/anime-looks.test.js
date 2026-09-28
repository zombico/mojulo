/** Looks (anime-looks.js): presets as words that compose. The tables are disjoint; every preset builds a closed head whose
 * eyes read (unless its pose closes them) with no advice at its own values; composition keeps its laws. */
import { describe, it, expect } from 'vitest';
import { ANIME_LOOKS, LOOK_TABLES, LOOK_WORDS, validateLook, resolveLook, lookEntries, composeAnime } from './anime-looks.js';
import { animeHead, animeFaceWarnings, animeHairWarnings, animeExpressionWarnings, ANIME_FACE_MOVES, ANIME_HAIR_MOVES, ANIME_POSES } from './anime-head.js';
import { tuneWarnings } from './hero-form.js';
import { compileLayered, auditLayered } from './station-loft.js';
import { layeredExposure } from './station-loft-exposure.js';

const failures = (m) => Object.entries(auditLayered(m)).filter(([, r]) => !r.pass).map(([n]) => n);
const closedEyes = (e) => e.blink >= 0.985;

describe('looks: the tables', () => {
  it('five tables, one meaning per word', () => {
    expect(new Set(LOOK_WORDS).size).toBe(LOOK_WORDS.length);
    expect(LOOK_TABLES.archetype).toEqual(Object.keys(ANIME_LOOKS));
    expect(LOOK_TABLES.face).toEqual(Object.keys(ANIME_FACE_MOVES)); expect(LOOK_TABLES.pose).toEqual(Object.keys(ANIME_POSES));
    for (const w of Object.keys(ANIME_HAIR_MOVES)) expect(LOOK_TABLES.hair).toContain(w);
  });
  it('an archetype names only shape: face, hair, expression, tune — never palette, cast, register or head', () => {
    for (const [name, L] of Object.entries(ANIME_LOOKS)) { expect(Object.keys(L).every((k) => ['note', 'face', 'hair', 'expression', 'tune'].includes(k)), name).toBe(true); expect(validateLook(name)).toEqual([]); }
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
  it('hair traits direct clumps: peekaboo drops one bang; messy is authored, not dice', () => {
    expect(resolveLook('peekaboo').hair.locks).toEqual({ 'fringe-3': { ty: -0.16, tx: 0.03, tz: -0.02 } });
    expect(resolveLook(['messy', 'messy']).hair.locks['back-3']).toEqual({ tx: -0.12 });
    expect(JSON.stringify(resolveLook('messy'))).toBe(JSON.stringify(resolveLook('messy')));
  });
  it('lookEntries keeps the order the words were said in', () => {
    expect(lookEntries(['rival', 'tareme']).face).toEqual(['sharp', 'tsurime', 'narrow-eyes', 'tareme']);
  });
});

describe('looks: every preset builds', () => {
  const words = [...LOOK_TABLES.archetype, ...LOOK_TABLES.face, ...Object.keys(ANIME_HAIR_MOVES), ...LOOK_TABLES.pose];
  for (const preset of ['female', 'male']) for (const w of words) it(`${preset} · ${w}: closed, the eyes read, no advice at its own values`, () => {
    const eff = composeAnime({ lookResolved: resolveLook([w]), face: {}, hair: { style: null, locks: {} } }, preset === 'male' ? 'short' : 'bob');
    expect([...animeFaceWarnings(eff.face, preset), ...animeHairWarnings(eff.hair), ...animeExpressionWarnings(eff.expression), ...tuneWarnings(eff.tune)]).toEqual([]);
    const mesh = compileLayered(animeHead({ preset, face: eff.face, hair: eff.hair, expression: eff.expression }));
    expect(failures(mesh)).toEqual([]);
    if (!closedEyes(eff.expression)) { const ex = layeredExposure(mesh, { res: 192 }); for (const e of ['irisR', 'irisL']) expect(['reads', 'faint']).toContain(ex.parts[e]?.flag); }
  });
});
