import { describe, it, expect } from 'vitest';
import { gunAudio, RANGE_SOUNDS } from './brawl-sfx.js';
import { GUN_IDS, readGun } from './brawl-guns.js';

// THE RUN & GUN'S SOUNDS: every gun on the shelf has its shot and its landing voiced from the SFX shelf, and the range's
// own (a round whizzing past, a gun run dry, a magazine seated); a gun passed in brings its voice; one the shelf cannot
// voice is left out, never an error.
describe('brawl sfx', () => {
  it('every gun\'s shot and landing, and the range\'s own sounds, voiced (realistic)', () => {
    const guns = GUN_IDS.map((g) => readGun(g)), { cues } = gunAudio(guns).sfx;
    for (const g of guns) for (const k of ['sound', 'hit']) expect(cues[g[k]]?.length, `${g.id} ${k}`).toBeGreaterThan(0);
    for (const id of Object.values(RANGE_SOUNDS)) expect(cues[id]?.length, id).toBeGreaterThan(0);
  });
  it('a passed-in gun brings its own voice; one with no voice on the shelf is left out', () => {
    const { cues } = gunAudio([readGun({ from: 'sidearm', sound: 'bazooka-shot', hit: 'no-such-sound' })]).sfx;
    expect(cues['bazooka-shot']).toBeTruthy();
    expect(cues['no-such-sound']).toBeUndefined();
  });
});
