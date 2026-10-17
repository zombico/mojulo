// react — a beast's reactions, built from its own posed body: a flinch that recoils and comes home to the stand, a
// fall that ends on its side, a rise that starts where the fall ends; a legless body on its own coil, a swimmer none yet.
import { describe, it, expect } from 'vitest';
import { reactsOf, reactionFrames, REACTIONS, REACTION_SECONDS } from './react.js';
import { motionSpec } from '../../../mcp/tools/animal.js';

const trunk = (f) => { const zs = Object.entries(f.bones).filter(([id]) => /^spine\d+$/.test(id)).map(([, b]) => b.head[2]); return zs.reduce((s, z) => s + z, 0) / zs.length; };

describe('a beast takes a blow', () => {
  it('on legs or legless on the ground it has a flinch, a fall and a rise; a swimmer none yet', () => {
    expect(reactsOf('wolf')).toEqual(['flinch', 'fall', 'rise']);
    expect(reactsOf('baldEagle')).toEqual(['flinch', 'fall', 'rise']);
    expect(reactsOf('snake')).toEqual(['flinch', 'fall', 'rise']);
    expect(reactsOf('salmon')).toEqual([]);
    expect(Object.keys(REACTION_SECONDS)).toEqual(Object.keys(REACTIONS));
  });

  it('the flinch drops low and comes home to the stand; the fall ends on its side, where the rise begins', () => {
    const flinch = reactionFrames('wolf', 'flinch', 21), fall = reactionFrames('wolf', 'fall', 21), rise = reactionFrames('wolf', 'rise', 21);
    expect(JSON.stringify(flinch[0])).toBe(JSON.stringify(flinch.at(-1)));
    expect(trunk(flinch[4])).toBeLessThan(trunk(flinch[0]) - 0.02);   // recoiled, low
    expect(trunk(fall.at(-1))).toBeLessThan(trunk(fall[0]) * 0.75);   // down
    expect(JSON.stringify(rise[0])).toBe(JSON.stringify(fall.at(-1)));
    expect(JSON.stringify(rise.at(-1))).toBe(JSON.stringify(fall[0]));
    expect(JSON.stringify(reactionFrames('wolf', 'fall', 21))).toBe(JSON.stringify(fall));   // deterministic
    expect(() => reactionFrames('salmon', 'flinch')).toThrow(/swims/);
  });

  it('a legless body rears back into its strike coil to flinch, and lies laid out flat when it falls', () => {
    const top = (f) => Math.max(...Object.values(f.bones).flatMap((b) => [b.head[2], b.tail[2]]));
    const flinch = reactionFrames('snake', 'flinch', 21), fall = reactionFrames('snake', 'fall', 21);
    expect(top(flinch[4])).toBeGreaterThan(top(flinch[0]) + 0.1);   // reared up out of the coil
    expect(top(fall.at(-1))).toBeLessThan(top(fall[0]));   // flatter than its coil
    expect(JSON.stringify(flinch[0])).toBe(JSON.stringify(flinch.at(-1)));
    expect(reactionFrames('octopus', 'fall', 8).length).toBe(8);
  });

  it('an animal\'s motion takes the words, and refuses one its body cannot do', () => {
    expect(motionSpec('wolf', ['walk', 'flinch', 'fall'])).toMatchObject({ gaits: ['walk'], reactions: ['flinch', 'fall'] });
    expect(motionSpec('wolf', { reactions: 'all' })).toMatchObject({ gaits: [], reactions: ['flinch', 'fall', 'rise'] });
    expect(motionSpec('wolf', ['walk'])).not.toHaveProperty('reactions');
    expect(() => motionSpec('salmon', ['flinch'])).toThrow(/no reaction 'flinch'/);
  });
});
