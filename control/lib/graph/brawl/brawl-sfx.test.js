import { describe, it, expect } from 'vitest';
import { gunAudio, streetAudio, brawlAudio, BRAWL_SOUNDS, RANGE_SOUNDS, STREET_SOUNDS } from './brawl-sfx.js';
import { sfxSound } from '../sfx-shelf/resolve.js';
import { fightCues } from '../versus/versus-sfx.js';
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

// THE BRAWLER'S SOUND SHEET: its blows thrown and landed and its bodies' voices, each a shelf word, voiced in the
// sheet's style (the newest voices first), over the fight's own cue ids.
describe('the brawler\'s sound sheet', () => {
  it('every word is a row of the shelf with a voice, so no cue of the sheet is silent', () => {
    const { cues } = brawlAudio().sfx;
    expect(Object.keys(cues).sort()).toEqual(Object.keys(BRAWL_SOUNDS).sort());
    for (const g of Object.values(cues)) expect(Array.isArray(g) && g.length).toBeTruthy();
  });
  it('re-voices the fight\'s cue ids a blow already plays, and adds what the fight never sounded', () => {
    const fight = Object.keys(fightCues()), ours = Object.keys(BRAWL_SOUNDS);
    expect(ours.filter((id) => fight.includes(id)).length).toBeGreaterThan(4);
    for (const id of ['swing', 'jump', 'shout', 'grunt', 'cry']) { expect(ours).toContain(id); expect(fight).not.toContain(id); }
  });
  it('is voiced in its style: the mouth where the mouth has a voice, another style a different sound', () => {
    const mouth = brawlAudio().sfx.cues, real = brawlAudio({ style: 'realistic' }).sfx.cues;
    expect(sfxSound(BRAWL_SOUNDS.swing, { style: 'mouth' }).style).toBe('mouth');
    expect(JSON.stringify(mouth.swing)).not.toBe(JSON.stringify(real.swing));
    // (a word the mouth voices none of falls back: the same sound either way)
    const fell = Object.keys(BRAWL_SOUNDS).find((id) => sfxSound(BRAWL_SOUNDS[id], { style: 'mouth' }).style !== 'mouth');
    expect(JSON.stringify(mouth[fell])).toBe(JSON.stringify(real[fell]));
  });
});

