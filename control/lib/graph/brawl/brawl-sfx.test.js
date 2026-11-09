import { describe, it, expect } from 'vitest';
import { gunAudio, streetAudio, RANGE_SOUNDS, STREET_SOUNDS } from './brawl-sfx.js';
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
  it('the street\'s own (a mount\'s crash, a wreck\'s metal, the ground dug out of) voiced with guns or without', () => {
    const own = streetAudio().sfx.cues, armed = gunAudio([readGun('sidearm')]).sfx.cues;
    for (const id of Object.values(STREET_SOUNDS)) { expect(own[id]?.length, id).toBeGreaterThan(0); expect(armed[id], id).toBeTruthy(); }
    expect(own['dry-fire']).toBeUndefined();
  });
  it('a passed-in gun brings its own voice; one with no voice on the shelf is left out', () => {
    const { cues } = gunAudio([readGun({ from: 'sidearm', sound: 'bazooka-shot', hit: 'no-such-sound' })]).sfx;
    expect(cues['bazooka-shot']).toBeTruthy();
    expect(cues['no-such-sound']).toBeUndefined();
  });
});
