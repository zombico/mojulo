// Isolate to an in-memory SQLite — must run before any import that pulls in
// db/index.js. Same pattern as create-game.test.js.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import {
  createGameProjectHandler,
  getGameProjectHandler,
  updateGameProjectHandler,
  bindToGameProjectHandler,
  listGameProjectsHandler,
} from './game-projects.js';
import { mintGame } from './create-game.js';

beforeEach(() => {
  closeDb();
});

function mintLevel(ref, contract) {
  return SketchRepository.create({
    ref,
    title: ref,
    manifest: { kind: 'orbit-view', scenario: 'circular', game: contract },
  });
}

const STORE = {
  slices: [
    { name: 'bag', kind: 'inventory' },
    { name: 'campaign', kind: 'progression' },
  ],
};

const contract = (levelRef) => ({
  levelRef,
  produces: { events: [{ type: 'grant', slice: 'bag' }] },
});

// A full project world: two promotable levels, a game claiming one of them,
// a beats track, an sfx cue, and a figure sheet — the studio's whole shelf.
async function seedProjectWorld() {
  mintLevel('lvl-1', contract('lvl-1'));
  mintLevel('lvl-2', contract('lvl-2'));
  SketchRepository.create({ ref: 'candidate-world', title: 'Candidate', manifest: { kind: 'orbit-view', scenario: 'circular' } });
  SketchRepository.create({ ref: 'theme-track', title: 'Theme', manifest: { kind: 'beats-composition', bpm: 90 } });
  SketchRepository.create({ ref: 'hit-cue', title: 'Hit', manifest: { kind: 'beats-sfx' } });
  SketchRepository.create({ ref: 'hero-sheet', title: 'Hero', manifest: { kind: 'character-sheet' } });

  const project = await createGameProjectHandler({
    title: 'Crypt Saga',
    charter: 'A gated dungeon campaign in the 3D register.',
  });
  const game = await mintGame({
    title: 'Crypt Campaign',
    store: STORE,
    levels: [{ ref: 'lvl-1' }],
    music: { menu: 'theme-track' },
    ref: 'crypt-game',
    allowUnaudited: true,
    projectRef: project.ref,
  });
  return { project, game };
}

describe('create_game_project / list_game_projects', () => {
  it('mints a project with seed members and lists it with counts', async () => {
    SketchRepository.create({ ref: 'keyart', title: 'Key Art', manifest: { kind: 'image-outcome' } });
    const out = await createGameProjectHandler({
      title: 'Neon GP: The Game',
      charter: 'A racer.',
      members: [{ ref: 'keyart', role: 'graphic', label: 'cover' }],
    });
    expect(out.ok).toBe(true);
    expect(out.ref).toMatch(/^gp_/);
    expect(out.url).toBe(`/games/${out.ref}`);
    expect(out.members).toHaveLength(1);

    const list = await listGameProjectsHandler({});
    const row = list.projects.find((p) => p.ref === out.ref);
    expect(row.memberCounts).toEqual({ graphic: 1 });
    expect(row.playable).toBe(false);
  });
});

describe('create_game project_ref → the rules claim', () => {
  it('refuses an unknown project BEFORE minting anything', async () => {
    mintLevel('lvl-1', contract('lvl-1'));
    await expect(
      mintGame({ title: 'Orphan', store: STORE, levels: [{ ref: 'lvl-1' }], allowUnaudited: true, projectRef: 'gp_nope00000000' }),
    ).rejects.toThrow(/not found/);
    expect(SketchRepository.getByRef('Orphan')).toBeNull();
  });

  it('binds the minted game as the active rules member and reports the studio URL', async () => {
    const { project, game } = await seedProjectWorld();
    expect(game.project).toEqual({ ref: project.ref, url: `/games/${project.ref}` });
    const read = await getGameProjectHandler({ ref: project.ref });
    expect(read.activeRules.ref).toBe('crypt-game');
    expect(read.activeRules.playUrl).toBe('/api/sketches/crypt-game/game');

    const list = await listGameProjectsHandler({});
    expect(list.projects.find((p) => p.ref === project.ref).playable).toBe(true);
  });
});

describe('get_game_project — the derived layer', () => {
  it('derives implied members, level promotion status, and the audio split', async () => {
    const { project } = await seedProjectWorld();
    await bindToGameProjectHandler({
      ref: project.ref,
      members: [
        { ref: 'lvl-1', role: 'level' },            // also in the game manifest → promoted
        { ref: 'lvl-2', role: 'level' },            // has a game channel → contract
        { ref: 'candidate-world', role: 'level' },  // plain world → candidate
        { ref: 'sk_gone', role: 'level' },          // dangling → missing, never an error
        { ref: 'theme-track', role: 'audio' },
        { ref: 'hit-cue', role: 'audio' },
        { ref: 'hero-sheet', role: 'character', meta: { slice: 'bag' } },
      ],
    });
    const read = await getGameProjectHandler({ ref: project.ref });

    const levelStatus = Object.fromEntries(read.members.level.map((m) => [m.memberRef, m.levelStatus ?? (m.missing ? 'missing' : '?')]));
    expect(levelStatus).toEqual({
      'lvl-1': 'promoted',
      'lvl-2': 'contract',
      'candidate-world': 'candidate',
      'sk_gone': 'missing',
    });

    const audio = Object.fromEntries(read.members.audio.map((m) => [m.memberRef, m.audioKind]));
    expect(audio).toEqual({ 'theme-track': 'soundtrack', 'hit-cue': 'sfx' });

    // Implied: the manifest's own levels + music, flagged when also stored.
    expect(read.implied.levels).toEqual([{ ref: 'lvl-1', title: 'lvl-1', gated: false, alsoStored: true }]);
    expect(read.implied.music).toEqual([{ ref: 'theme-track', slot: 'menu', alsoStored: true }]);

    expect(read.members.character[0].meta).toEqual({ slice: 'bag' });
  });

  it('reads clean with no rules member (pre-mint project)', async () => {
    const out = await createGameProjectHandler({ title: 'Just a Dream' });
    const read = await getGameProjectHandler({ ref: out.ref });
    expect(read.activeRules).toBeNull();
    expect(read.implied).toEqual({ levels: [], music: [] });
  });

  it('teaches on an unknown ref', async () => {
    await expect(getGameProjectHandler({ ref: 'gp_missing000000' })).rejects.toThrow(/list_game_projects/);
  });
});

describe('update / bind actions', () => {
  it('moves the status machine and re-titles', async () => {
    const out = await createGameProjectHandler({ title: 'WIP' });
    const updated = await updateGameProjectHandler({ ref: out.ref, title: 'Shipped Saga', status: 'shipped' });
    expect(updated.project.title).toBe('Shipped Saga');
    expect(updated.project.status).toBe('shipped');
    const list = await listGameProjectsHandler({ status: 'shipped' });
    expect(list.projects.map((p) => p.ref)).toContain(out.ref);
  });

  it('removes members via action:remove and reports what actually deleted', async () => {
    const out = await createGameProjectHandler({ title: 'P' });
    await bindToGameProjectHandler({ ref: out.ref, members: [{ ref: 'sk_x', role: 'reference' }] });
    const removed = await bindToGameProjectHandler({
      ref: out.ref,
      action: 'remove',
      members: [{ ref: 'sk_x', role: 'reference' }, { ref: 'sk_never', role: 'reference' }],
    });
    expect(removed.members).toEqual([
      { ref: 'sk_x', role: 'reference', removed: true },
      { ref: 'sk_never', role: 'reference', removed: false },
    ]);
  });
});
