// A fighter who is a character made with create_character: measured off its own skeleton, calibrated on the default
// male hero, refused by name when the store has no such character, and nothing at all for a roster without one.
import { describe, it, expect } from 'vitest';
import { heroRecord } from '@/lib/mcp/tools/layered.js';
import { resolveCharacters, readCharacterEntry, bodyDials } from './versus-character.js';
import { rosterEntry, readVersusManifest } from './versus-page.js';
import { compileFighter } from './versus-compile.js';
import { readQuick } from '../gameworld/quick.js';

// rows as the store keeps them: a create_character hero is a layered row with its hero record
const ROWS = {
  him: { kind: 'layered', hero: heroRecord({ cast: 'male' }) },
  reach: { kind: 'layered', hero: heroRecord({ cast: 'male', tune: { armLength: 1.15 }, palette: { Top: '#aa2222' } }) },
  her: { kind: 'layered', hero: heroRecord({ cast: 'female' }) },
  crate: { kind: 'layered', recipe: { parts: {} } },
};
const lookup = (ref) => ROWS[ref] ?? null;

describe('versus: a character as a fighter', () => {
  it('measures the default male hero as the fight\'s canonical body, and a woman as her own', async () => {
    const [him, her] = await resolveCharacters([{ id: 'a', hero: { ref: 'him' } }, { id: 'b', hero: { ref: 'her' } }], lookup);
    expect(him).toMatchObject({ id: 'a', character: 'him', body: { arm: 1, leg: 1, torso: 1, girth: 1 } });
    expect(him.hero).toBeUndefined();
    expect(her.body.height).toBeLessThan(him.body.height);
    expect(her.body.girth).not.toBe(1);
  });

  it('a longer-armed character reaches further with the same moveset, in its own colour', async () => {
    const [plain, long] = await resolveCharacters([{ id: 'a', archetype: 'zoner', hero: { ref: 'him' } }, { id: 'b', archetype: 'zoner', hero: { ref: 'reach' } }], lookup);
    expect(long.body.arm).toBeGreaterThan(plain.body.arm);
    expect(long.color).toBe('#aa2222');
    const [P, L] = [plain, long].map((e, k) => compileFighter(rosterEntry(e, k).recipe));
    expect(L.moves['stand.L'].reach).toBeGreaterThan(P.moves['stand.L'].reach);   // the jab: an arm's reach
    expect(rosterEntry(long, 1)).toMatchObject({ character: 'reach', color: '#aa2222' });
  });

  it('a dial past what the fight reads is held at its edge and said', () => {
    const ref = { m: { height: 1.7, arm: 0.6, leg: 0.85, torso: 0.55 }, girth: 1 };
    const { body, held } = bodyDials({ height: 0.6, arm: 0.6, leg: 0.85, torso: 0.55 }, 3, ref);
    expect(body.height).toBe(1000);
    expect(body.girth).toBe(2);
    expect(held.map((h) => h.split(' ')[0])).toEqual(['height', 'arm', 'leg', 'torso', 'girth']);
  });

  it('refuses by name what is not a stored character, and a body beside one', async () => {
    await expect(resolveCharacters([{ id: 'a', hero: { ref: 'nobody' } }], lookup)).rejects.toThrow(/roster\[0\]\.hero\.ref 'nobody' is not a stored character/);
    await expect(resolveCharacters([{ id: 'a', hero: { ref: 'crate' } }], lookup)).rejects.toThrow(/'crate' is not a stored character/);
    expect(() => readCharacterEntry({ id: 'a', hero: { ref: 'him' }, cast: 'brute' }, 'roster[0]')).toThrow(/roster\[0\]\.cast: a character's body is its own/);
    expect(() => readCharacterEntry({ id: 'a', hero: 'him' }, 'roster[0]')).toThrow(/roster\[0\]\.hero is \{ ref \}/);
    // unmeasured, a character never reaches the page as a stick default
    expect(readVersusManifest({ roster: [{ id: 'a', hero: { ref: 'him' } }] }).errors[0]).toMatch(/is a character .* measured from the store/);
  });

  it('a roster without a character comes back as given (adds nothing)', async () => {
    const roster = [{ id: 'a', archetype: 'grappler' }];
    expect(await resolveCharacters(roster, lookup)).toBe(roster);
    expect(rosterEntry(roster[0])).not.toHaveProperty('character');
  });

  it('the quick fight takes a character in its roster, and says what is wrong with one', () => {
    expect(() => readQuick({ goal: 'fight', roster: [{ id: 'a', archetype: 'rushdown', hero: { ref: 'him' } }] })).not.toThrow();
    expect(() => readQuick({ goal: 'fight', roster: [{ id: 'a', hero: { ref: 'him' }, cast: 'lithe' }] })).toThrow(/quick\.roster\[0\]\.cast: a character's body is its own/);
  });
});
