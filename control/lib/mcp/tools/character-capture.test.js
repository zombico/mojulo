// In-memory SQLite + no semantic index — must run before importing db/index.js.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

// capture_reference target 'character' (character-capture.js) through the real hero door: a captured hero IS the hero
// create_character makes from the lowered words (the stamp aside), an absent stamp adds nothing, an x-like verdict is
// recorded and captioned and gates nothing, and a second picture never moves a word the person changed.
import { describe, expect, it } from 'vitest';

import { getDb } from '@/lib/db/index.js';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { StashRepository } from '@/lib/db/repositories/stashes';
import { captureReferenceHandler } from './visual-reference.js';
import { createCharacterHandler, updateCharacterHandler } from './create-character.js';
import { lowerCharacterRead } from '@/lib/reference/character-lower';

getDb();

const HERO_BUDGET = 120_000;
const READ = { look: 'toon', register: 'round', likeness: { verdict: 'original' }, thesis: 'a harbour mechanic · column · steady · the red scarf', view: 'front', unseen: ['back'], gaps: ['the scarf\'s knot'], words: { cast: 'female', hair: 'bob', palette: { Top: '#aa3344' } } };
const capture = (insights, extra = {}) => captureReferenceHandler({ target: 'character', insights, ...extra });
const heroOf = (ref) => SketchRepository.getByRef(ref).manifest.hero;

describe('capture_reference — character', () => {
  it('is the hero create_character makes from the lowered words, the stamp aside, and files the read', async () => {
    const res = await capture(READ, { title: 'Mara' });
    expect(res.ok).toBe(true);
    expect(res).toMatchObject({ target: 'character', fidelity: 'likeness', passes: 1, look: 'toon', register: 'round', unseen: ['back'] });
    const captured = SketchRepository.getByRef(res.ref).manifest;
    expect(captured.hero.reference).toEqual({ likeness: 'original', stash: res.stash_ref });

    const { reference, ...words } = lowerCharacterRead(READ).spec;
    const door = await createCharacterHandler({ as: 'hero', spec: words, title: 'Mara' });
    const plain = SketchRepository.getByRef(door.ref).manifest;
    expect(plain.hero).not.toHaveProperty('reference');
    const { reference: _stamp, ...capturedHero } = captured.hero;
    expect(JSON.stringify({ ...captured, hero: capturedHero })).toBe(JSON.stringify(plain));

    const item = StashRepository.getFull(res.stash_ref).items.find((it) => it.id === res.item_id);
    expect(item.metadata).toMatchObject({ reference_target: 'character', hero_ref: res.ref, passes: 1 });
    expect(item.metadata.insights.thesis).toBe(READ.thesis);
    expect(item.metadata.minted).toEqual(captured.hero);
  }, HERO_BUDGET);

  it('records an x-like verdict and captions it, and the hero takes every word after like any other', async () => {
    const res = await capture({ ...READ, likeness: { verdict: 'x-like', like: 'a caped space ranger', changed: ['the name', 'the chest emblem'] } });
    expect(res.hero.reference.caption).toBe('X-like: inspired by a caped space ranger');
    const up = await updateCharacterHandler({ ref: res.ref, spec: { hair: 'ponytail', palette: { Top: '#112233' } } });
    expect(up.ok).toBe(true);
    expect(heroOf(res.ref).palette.Top).toBe('#112233');
    expect(heroOf(res.ref).reference.likeness).toBe('x-like');
  }, HERO_BUDGET);

  it('refines by a second picture without moving a word the person changed, unless the read replaces', async () => {
    const first = await capture(READ);
    await updateCharacterHandler({ ref: first.ref, spec: { hair: 'ponytail' } });
    const second = await capture({ ...READ, words: { ...READ.words, hair: 'pixie', palette: { Top: '#3344aa' } } }, { stash_ref: first.stash_ref });
    expect(second.passes).toBe(2);
    expect(second.ref).toBe(first.ref);
    expect(second.kept).toEqual(['hair']);
    expect(second.moved).toEqual(['palette.Top']);
    expect(heroOf(first.ref).hair).toBe('ponytail');
    expect(heroOf(first.ref).palette.Top).toBe('#3344aa');

    const third = await capture({ ...READ, words: { ...READ.words, hair: 'pixie', palette: { Top: '#3344aa' } } }, { stash_ref: first.stash_ref, replace: true });
    expect(third.passes).toBe(3);
    expect(third.kept).toEqual([]);
    expect(heroOf(first.ref).hair).toBe('pixie');
  }, HERO_BUDGET * 2);

  it('refuses a read without a likeness verdict before anything is made', async () => {
    const before = StashRepository.list().length;
    await expect(capture({ ...READ, likeness: undefined })).rejects.toThrow(/likeness/);
    expect(StashRepository.list().length).toBe(before);
  });
});
