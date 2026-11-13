// Isolate to an in-memory SQLite — must run before any import that pulls in db/index.js.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { closeDb } from '@/lib/db/index';
import { BASELINE } from '@/lib/graph/actor/baseline.js';
import { resolveSceneCast, planSceneFilm, screenplayErrors, writeSceneFilm, readGrain, packTitle } from './scene-film.js';
import { forgeMotionHandler } from './motion.js';

// the scene film's core (scene-film.js): the cast resolved from personas and heroes, the scene planned without a mint,
// a hero that cannot act refused before the first slow mint, and forge_motion's screenplay family refusing what it
// cannot film. The pack itself is actor/scene-film.js's (its own tests); the mint is the realistic hero's (minutes).

const ROWS = {
  pp_ada: { manifest: { kind: 'layered', hero: { cast: 'female', head: 'relational' } } },
  pp_box: { manifest: { kind: 'layered', hero: { cast: 'male', head: 'landmark' } } },
  pp_news: { manifest: { kind: 'persona', persona: { hero: 'pp_ada', register: 'briefing', style: 'action-star', role: { status: 'high' } } } },
};
const getRow = (r) => ROWS[r] ?? null;
const scene = (cast) => ({ ...BASELINE.blocked, cast: { ...BASELINE.blocked.cast, ...cast } });

beforeEach(() => closeDb());

describe('the cast', () => {
  it('plays a persona as itself, its hero the body, the part\'s own words winning', () => {
    const { cast, heroes, sources } = resolveSceneCast(scene({ mara: { persona: 'pp_news', mark: 'door', style: 'thespian' } }), { getRow });
    expect(cast.mara).toEqual({ register: 'briefing', style: 'thespian', role: { status: 'high' }, mark: 'door' });
    expect(heroes.mara).toEqual({ ref: 'pp_ada' });
    expect(sources.mara).toMatch(/persona pp_news/);
  });

  it('gives a style to every part without one, and none to a part that has one', () => {
    const { cast } = resolveSceneCast(scene({ mara: { persona: 'pp_news', mark: 'door' } }), { getRow, style: 'extra' });
    expect(cast.mara.style).toBe('action-star');
    expect(cast.jon.style).toBe('extra');
  });

  it('reads a hero as a ref, a spec or nothing', () => {
    const spec = { form: 'realistic', cast: 'male' };
    const { heroes } = resolveSceneCast(scene({ mara: { hero: 'pp_ada', mark: 'door' }, jon: { hero: spec, mark: 'window' } }), { getRow });
    expect(heroes).toEqual({ mara: { ref: 'pp_ada' }, jon: { spec } });
    expect(resolveSceneCast(BASELINE.blocked, { getRow }).heroes).toEqual({ mara: null, jon: null });
  });

  it('refuses a part that is not a persona, both a persona and a hero, or a word it does not take', () => {
    expect(() => resolveSceneCast(scene({ mara: { persona: 'pp_ada' } }), { getRow })).toThrow(/'pp_ada' is a layered, not a persona/);
    expect(screenplayErrors(scene({ mara: { persona: 'pp_news', hero: 'pp_ada' } })).join()).toMatch(/a persona or a hero, not both/);
    expect(screenplayErrors(scene({ mara: { voice: 'x' } })).join()).toMatch(/not voice/);
    expect(screenplayErrors({ cast: {}, script: '' })).toHaveLength(2);
    expect(screenplayErrors({ ...BASELINE.blocked, shots: [] }).join()).toMatch(/not shots/);
  });
});

describe('the plan, before any mint', () => {
  it('blocks, covers and notes the scene the persona plays', () => {
    const P = planSceneFilm(scene({ mara: { persona: 'pp_news', mark: 'door' } }), { getRow });
    expect(Object.keys(P.S.actors)).toEqual(['mara', 'jon']);
    expect(P.S.actors.mara.register).toBe('briefing');
    expect(P.coverage.shots.length).toBeGreaterThan(1);
    expect(Array.isArray(P.notes)).toBe(true);
  });

  it('keys the grain by word or number', () => {
    expect([readGrain('twos'), readGrain(3), readGrain('3'), readGrain(null)]).toEqual([2, 3, 3, null]);
    expect(() => readGrain('fours')).toThrow(/ones \| twos \| threes/);
  });

  it('names the pack as a file-safe word', () => {
    expect(packTitle('The Key — Act 1')).toBe('the-key-act-1');
    expect(packTitle('!!!')).toBe('scene');
  });

  it('refuses a hero whose face cannot act before it mints anything', async () => {
    const outDir = mkdtempSync(path.join(tmpdir(), 'scene-film-'));
    await expect(writeSceneFilm({ outDir, screenplay: scene({ mara: { hero: 'pp_box', mark: 'door' } }), getRow })).rejects.toThrow(/cast\.mara: hero 'pp_box' cannot act a scene/);
    expect(existsSync(path.join(outDir, 'actors'))).toBe(false);
  });
});

describe("forge_motion's screenplay family", () => {
  const forge = (over) => forgeMotionHandler({ title: 'The key', subject: { screenplay: BASELINE.blocked }, ...over });
  it('is filmed in Blender, shot by its coverage, with its own params', async () => {
    await expect(forge({ export: 'gif' })).rejects.toThrow(/filmed in Blender: export: 'blender'/);
    await expect(forge({ shot: { motion: 'orbit' } })).rejects.toThrow(/shot by its coverage/);
    await expect(forge({ shot: { params: { frames: 3 } } })).rejects.toThrow(/look, style, grain, grade, hero \(not frames/);
    await expect(forge({ shot: { params: { look: 'noir' } } })).rejects.toThrow(/film \| anime/);
    await expect(forgeMotionHandler({ title: 't', subject: { screenplay: BASELINE.blocked, world_ref: 'sk_x' } })).rejects.toThrow(/family of its own/);
  });
  it('refuses a cast ref the store does not have, before writing', async () => {
    await expect(forge({ subject: { screenplay: scene({ mara: { persona: 'sk_nobody' } }) } })).rejects.toThrow(/'sk_nobody' is no sketch, not a persona/);
  });
});
