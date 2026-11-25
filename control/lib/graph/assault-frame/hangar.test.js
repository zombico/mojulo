import { describe, it, expect } from 'vitest';
import { HANGAR_SLICE, buildOfFlags, flagsOfBuild } from './hangar.js';
import { readBuild } from './assemble.js';
import { STOCK } from './parts.js';

// THE HANGAR'S WORD IN THE SAVE (hangar.js): a build kept as flags, one a slot. One case: a build out and back.
describe('the hangar\'s word in the save', () => {
  it('keeps a build as a flag a slot, an empty slot as none, and reads it back as the build', () => {
    const B = readBuild({ from: Object.keys(STOCK)[0], head: 'hd-bulwark', core: 'cr-citadel', backL: null });
    const ev = flagsOfBuild(B);
    expect(ev.every((e) => e.type === 'setFlag' && e.slice === HANGAR_SLICE && typeof e.value === 'string')).toBe(true);
    const flags = Object.fromEntries(ev.map((e) => [e.key, e.value]));
    expect(readBuild(buildOfFlags({ flags }))).toEqual(B);
    // (no flag, no build: the level's own frame stands; a part no table has is left out)
    expect(buildOfFlags({ flags: {} })).toBeNull();
    expect(buildOfFlags({ flags: { 'frame.core': 'cr-nothing' } })).toBeNull();
  });
});
