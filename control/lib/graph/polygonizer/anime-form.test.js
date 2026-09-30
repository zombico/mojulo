/** The port reproduces the Anime Form Studio: `buildAnime` is the studio's model.js (anime-form.fixture.json records that
 * file's sha256) operation for operation, with its transcendentals from util/dmath.js, and per-part hashes at the
 * fixture's recipes are pinned bit for bit, the same on every CPU and Node version. The studio's own digests, frozen on
 * macOS arm64's native Math, matched the port there before it took dmath; re-freezing them from model.js with Math's
 * transcendentals bound to dmath restores that independent check. */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { buildAnime, animeFresh, animeReadRecipe, animeFaceDefs, animeEffectiveFace, animeToOBJ, ANIME_SCHEMA, ANIME_FEMALE_BASELINE } from './anime-form.js';

const FIXTURE = JSON.parse(readFileSync(fileURLToPath(new URL('./anime-form.fixture.json', import.meta.url)), 'utf8'));
const hashOf = (arr) => createHash('sha256').update(Buffer.from(new Float64Array(arr).buffer)).digest('hex');
function digest(model) {
  const out = {};
  for (const [k, v] of Object.entries(model.parts)) out[k] = { n: v.length, sha: hashOf(v) };
  out.cage = { n: model.cage.length, sha: hashOf(model.cage) }; out.guides = { n: model.guides.length, sha: hashOf(model.guides) };
  out.locks = { n: model.locks.length, sha: hashOf(model.locks.flatMap((l) => [...l.root, ...l.control, ...l.tip, l.width, l.start, l.count])), names: model.locks.map((l) => l.name).join(',') };
  out.headPolygons = { n: model.headPolygons.length, sha: hashOf(model.headPolygons.flat(2)) };
  return out;
}

describe('anime-form: the port is the studio', () => {
  for (const c of FIXTURE.cases) it(c.name, () => { expect(digest(buildAnime(animeReadRecipe(c.recipe), c.options))).toEqual(c.digest); });
  it('the fixture names the studio source it ports (its hash is recorded)', () => {
    expect(FIXTURE.studioSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(FIXTURE.cases.length).toBeGreaterThanOrEqual(9);
  });
});

describe('anime-form: the recipe contract', () => {
  it('a fresh design is a v3 recipe at its base; the effective face adds the baseline', () => {
    const r = animeFresh('female'); expect(r.schema).toBe(ANIME_SCHEMA); expect(r.hair.style).toBe('bob');
    expect(animeEffectiveFace(r).lower).toBeCloseTo(ANIME_FEMALE_BASELINE.lower, 12);
    expect(animeFresh('male').face.tilt).toBe(0.035);
  });
  it('v1 and v2 recipes migrate to v3 (the studio loader)', () => {
    const v1 = { ...animeFresh('female'), schema: 'anime-form-studio-v1' };
    for (const [k, v] of Object.entries(ANIME_FEMALE_BASELINE)) v1.face[k] = v;
    const r = animeReadRecipe(v1); expect(r.schema).toBe(ANIME_SCHEMA); expect(r.face.lower).toBeCloseTo(1, 12);
  });
  it('refuses what the studio refuses', () => {
    expect(() => animeReadRecipe({ schema: 'x' })).toThrow(/Anime Form Studio recipe/);
    const wide = animeFresh('male'); wide.face.nose = 9; expect(() => animeReadRecipe(wide)).toThrow(/Nose projection/);
    const lock = animeFresh('male'); lock.locks = { 'fringe-9': { cx: 0, cy: 0, cz: 0, tx: 0, ty: 0, tz: 0 } }; expect(() => animeReadRecipe(lock)).toThrow(/lock name/);
    expect(animeFaceDefs('female').length).toBe(23);
  });
  it('`weld` moves only the sclera, and only by its rim lift (≤ 0.001 units)', () => {
    const r = animeFresh('female'), a = buildAnime(r), b = buildAnime(r, { weld: true });
    for (const k of Object.keys(a.parts)) if (k !== 'sclera') expect(b.parts[k]).toEqual(a.parts[k]);
    expect(b.parts.sclera.length).toBe(a.parts.sclera.length);
    expect(Math.max(...a.parts.sclera.map((v, i) => Math.abs(v - b.parts.sclera[i])))).toBeLessThanOrEqual(0.001 + 1e-12);
  });
  it('the OBJ keeps the named parts and indexes within bounds', () => {
    const obj = animeToOBJ(buildAnime(animeFresh('male')));
    for (const p of ['skin', 'hair', 'sclera', 'iris', 'pupil', 'ink', 'mouth']) expect(obj).toContain(`o ${p}\n`);
    const v = obj.split('\n').filter((l) => l.startsWith('v ')).length, max = Math.max(...obj.split('\n').filter((l) => l.startsWith('f ')).flatMap((l) => l.slice(2).split(' ').map(Number)));
    expect(max).toBeLessThanOrEqual(v);
  });
});
