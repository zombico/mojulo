// A fighter who is a character made with create_character: measured off its own skeleton, calibrated on the default
// male hero, its fight read off the sheet it was made from, refused by name when the store has no such character, and
// nothing at all for a roster without one; two characters walked into each other stop with their bodies apart.
import { describe, it, expect } from 'vitest';
import { heroRecord } from '@/lib/mcp/tools/layered.js';
import { resolveCharacters, bodyDials, characterBody } from './versus-character.js';
import { characterBase, figurePose, figureSegments, segmentOf } from './versus-figure.js';
import { newVersus, stepVersus } from './versus-core.js';
import { rigJoints } from './versus-rig.js';
import { POSES } from './versus-library.js';
import { rollEgocube } from '../egocube/egocube.js';
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
    const [plain, long] = await resolveCharacters([{ id: 'a', style: 'zoner', hero: { ref: 'him' } }, { id: 'b', style: 'zoner', hero: { ref: 'reach' } }], lookup);
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
    await expect(resolveCharacters([{ id: 'a', hero: { ref: 'him' }, cast: 'brute' }], lookup)).rejects.toThrow(/roster\[0\]: cast: a fighter's body is its character's/);
    await expect(resolveCharacters([{ id: 'a', hero: 'him' }], lookup)).rejects.toThrow(/roster\[0\]: hero is \{ ref \}/);
    await expect(resolveCharacters([{ id: 'a', hero: { ref: 'him' }, archetype: 'zoner' }], lookup)).rejects.toThrow(/'zoner' is a fight style: give it as style/);
    // unmeasured, a character never reaches the page as a stick default
    expect(readVersusManifest({ roster: [{ id: 'a', hero: { ref: 'him' } }] }).errors[0]).toMatch(/is a character .* measured from the store/);
  });

  it('a roster without a character comes back as given (adds nothing)', async () => {
    const roster = [{ id: 'a', archetype: 'grappler' }];
    expect(await resolveCharacters(roster, lookup)).toBe(roster);
    expect(rosterEntry(roster[0])).not.toHaveProperty('character');
  });

  it('the quick fight takes a character in its roster, and says what is wrong with one', () => {
    expect(() => readQuick({ goal: 'fight', roster: [{ id: 'a', style: 'rushdown', hero: { ref: 'him' } }] })).not.toThrow();
    expect(() => readQuick({ goal: 'fight', roster: [{ id: 'a', hero: { ref: 'him' }, cast: 'lithe' }] })).toThrow(/quick\.roster\[0\]: cast: a fighter's body is its character's/);
  });

  it('a character made from a sheet fights as the sheet reads, the entry\'s own words over it; one without a sheet is an all-rounder', async () => {
    const sheet = rollEgocube({ facets: { role: 'frontline', archetype: 'hero', motivation: 0.1 }, seed: 3 });
    const rows = { ...ROWS, made: { ...ROWS.him, egocube: { ref: 'cube', rev: 1, print: 'p' } } };
    const sheetOf = (rec) => (rec.ref === 'cube' ? sheet : null);
    const [read, over, plain] = await resolveCharacters([{ id: 'a', hero: { ref: 'made' } }, { id: 'b', hero: { ref: 'made' }, style: 'zoner', name: 'Kai' }, { id: 'c', hero: { ref: 'him' } }], (r) => rows[r] ?? null, sheetOf);
    expect(read).toMatchObject({ archetype: 'grappler', name: 'The Hero', sheet: 'cube', character: 'made' });
    expect(read.signature).toContain('reversal');
    expect(read.reads[0]).toMatchObject({ facet: 'role', value: 'frontline', word: 'grappler' });
    expect(over).toMatchObject({ archetype: 'zoner', name: 'Kai' });
    expect(plain).toMatchObject({ archetype: 'all-rounder', name: 'c' });
    expect(plain).not.toHaveProperty('reads');
  });
});

describe('versus: two characters at close range', () => {
  // a body's trunk as the arena draws it (its mesh posed on the sim's figure, the arms and legs left out), along the
  // plane in the world (mm): [back-most, front-most]
  const ARMS_LEGS = /arm|hand|thumb|index|middle|ring|little|elbow|thigh|shank|shin|knee|foot|toe|meta|hip/i;
  const trunkSpan = (pack, F, p) => {
    const B = characterBase(pack.bones), S = figureSegments(B, figurePose(B, rigJoints(F.body, POSES.guard), { face: p.face, stance: F.stance }));
    let lo = Infinity, hi = -Infinity;
    pack.parts.forEach((part, i) => {
      if (!part || ARMS_LEGS.test(pack.bones[i].id)) return;
      const { R, from, at } = S[segmentOf(pack.bones[i].id)], v = new Float32Array(Uint8Array.from(Buffer.from(part.pos, 'base64')).buffer);
      for (let k = 0; k < v.length; k += 3) {
        const fwd = R[1][0] * (v[k] - from[0]) + R[1][1] * (v[k + 1] - from[1]) + R[1][2] * (v[k + 2] - from[2]) + at[1];
        const x = p.x + p.face * fwd * 1000;
        lo = Math.min(lo, x); hi = Math.max(hi, x);
      }
    });
    return [lo, hi];
  };

  it('walked into each other, they stop where their trunks, as the arena draws them, are apart: the widest stance too', async () => {
    const [him, her] = await resolveCharacters([{ id: 'a', style: 'rushdown', hero: { ref: 'him' } }, { id: 'b', style: 'rushdown', hero: { ref: 'her' } }], lookup);
    const fighters = [him, her].map((e, k) => compileFighter(rosterEntry(e, k).recipe));
    const ctx = { fighters };
    let s = newVersus(ctx, { rules: { intro: 1 } });
    for (let k = 0; k < 90; k++) s = stepVersus(s, [{ x: 1, y: 0, b: 0 }, { x: -1, y: 0, b: 0 }], ctx);
    expect(s.p.map((p) => p.st)).toEqual(['walkF', 'walkF']);
    const [a, b] = s.p[0].x < s.p[1].x ? [0, 1] : [1, 0];
    const packs = await Promise.all([ROWS.him, ROWS.her].map(characterBody));
    const left = trunkSpan(packs[a], fighters[a], s.p[a]), right = trunkSpan(packs[b], fighters[b], s.p[b]);
    expect(right[0] - left[1]).toBeGreaterThan(0);
    // and no further apart than a hand's width: they still fight at close range
    expect(right[0] - left[1]).toBeLessThan(120);
  }, 60000);
});
