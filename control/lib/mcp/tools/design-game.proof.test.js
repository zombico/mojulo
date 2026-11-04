// Isolate to in-memory SQLite before any import that pulls db/index.js.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { designGameHandler } from './design-game.js';
import { MEADOWMARK, MEADOWMARK_HERO } from '@/lib/graph/gameworld/index';

// A chapter's run (design_game { ref, chapter, run: true }, chapters.js chapterSteps): a department proofs its chapter,
// made with what its orders name, ahead of the approvals it waits on, and nothing else of the book. The build that
// follows keeps what the proof made when the book has not moved.

const made = (out) => out.ran.filter((r) => r.action === 'make' || r.action === 'remake').map((r) => r.key);

beforeEach(() => { closeDb(); });

describe('design_game: a chapter\'s run', () => {
  it('the levels of a gated book, unreviewed: made ahead and said so; the build after the verdicts keeps them', async () => {
    const W = { ...MEADOWMARK, mode: 'gated' };
    const read = await designGameHandler({ world: W, ref: 'gp' });
    // a whole run makes nothing: every level waits on the world's parts
    expect((await designGameHandler({ ref: 'gp', run: true })).ran.every((r) => r.action === 'waiting')).toBe(true);

    const proof = await designGameHandler({ ref: 'gp', chapter: 'levels', run: true });
    expect(proof.readout).toBe('chapter');
    // its levels, and nothing of the build (no game, no walks)
    expect(proof.ran.length).toBeGreaterThan(1);
    expect(proof.ran.every((r) => r.key.startsWith('level-') && r.action === 'make')).toBe(true);
    for (const r of proof.ran) expect(r.ahead, r.key).toEqual(expect.arrayContaining([expect.stringMatching(/^world \(proposed\)$/)]));
    expect(SketchRepository.getByRef('gp-game')).toBeFalsy();
    expect(Object.keys(proof.made ?? {}).every((k) => k.startsWith('level-'))).toBe(true);
    // the rest of the book has not moved: its parts are as they were
    expect((await designGameHandler({ ref: 'gp' })).parts).toEqual(read.parts);

    // the verdicts, then the build: the proofed levels kept (the same orders), the game made over them
    const build = await designGameHandler({ ref: 'gp', approve: read.parts.map((p) => p.id), run: true });
    expect(build.ran.filter((r) => r.key.startsWith('level-')).every((r) => r.action === 'keep')).toBe(true);
    expect(made(build)).toContain('game');
  }, 300000);

  it('the hero\'s page: the hero alone; the systems\': the hero they name and the systems, ahead of the hero\'s verdicts', async () => {
    await designGameHandler({ world: { ...MEADOWMARK_HERO, mode: 'gated' }, ref: 'gh' });
    const hero = await designGameHandler({ ref: 'gh', chapter: 'hero', run: true });
    expect(made(hero)).toEqual(['hero']);
    expect(hero.ran.map((r) => r.key)).toEqual(['hero']);
    expect(hero.run).toMatchObject({ steps: 1, made: 1 });

    const systems = await designGameHandler({ ref: 'gh', chapter: 'systems', run: true });
    // the hero kept (made a call ago), the systems made ahead of the hero's verdicts, and only those two
    expect(systems.run).toMatchObject({ steps: 2, made: 1 });
    expect(systems.ran).toEqual([expect.objectContaining({ key: 'systems', action: 'make', ahead: expect.arrayContaining(['hero:base (proposed)']) })]);
    expect(SketchRepository.getByRef('gh-systems')).toBeTruthy();
    expect(SketchRepository.getByRef('gh-hero-equipped')).toBeFalsy();
  }, 300000);
});
