// THE SOUNDS OF A PLACE AND THE GROUND BY PLACE (audio.emitters, audio.surfaces). The concepts: each names a cue of the
// level's own and is refused when it names none; a surface is the ground under steps, so it asks for footsteps; what
// the page is handed is what was written, bounds as a pair; and a level that writes neither carries not a byte of
// either, in its payload or in its page's script.
import { describe, expect, it } from 'vitest';
import { resolveWorldAudio } from './beats-world.js';
import { audioChannelScript } from '../scene/channels/audio.js';

const cue = [{ type: 'burst', decay: 0.05, vol: 0.2 }];
const base = { sfx: { cues: { drip: cue, clank: cue } }, footsteps: true };

describe('the sounds of a place and the ground by place', () => {
  it('hands the page what was written, a steady wait as a pair', () => {
    const A = resolveWorldAudio({ ...base, emitters: [{ at: [1, 2, 3], cue: 'drip', every: [1, 4], reach: 9 }, { at: [0, 0, 0], cue: 'clank', every: 2, reach: 20, level: 0.5 }], surfaces: [{ box: [0, 0, 0, 2, 2, 1], step: 'clank' }] });
    expect(A.emitters).toEqual([{ at: [1, 2, 3], cue: 'drip', every: [1, 4], reach: 9 }, { at: [0, 0, 0], cue: 'clank', every: [2, 2], reach: 20, level: 0.5 }]);
    expect(A.surfaces).toEqual([{ box: [0, 0, 0, 2, 2, 1], step: 'clank' }]);
    const page = audioChannelScript(A);
    expect(page).toContain('__beatsPlaces'); expect(page).toContain('__fsOf');
  });
  it('refuses a cue the level has not, a box turned inside out, a wait too short, and a surface with no footsteps', () => {
    expect(() => resolveWorldAudio({ ...base, emitters: [{ at: [0, 0, 0], cue: 'hiss', every: 2, reach: 9 }] })).toThrow(/names a cue of audio.sfx.cues/);
    expect(() => resolveWorldAudio({ ...base, emitters: [{ at: [0, 0, 0], cue: 'drip', every: 0.05, reach: 9 }] })).toThrow(/every: seconds/);
    expect(() => resolveWorldAudio({ ...base, surfaces: [{ box: [2, 0, 0, 0, 2, 1], step: 'clank' }] })).toThrow(/low corner then high/);
    expect(() => resolveWorldAudio({ sfx: base.sfx, surfaces: [{ box: [0, 0, 0, 2, 2, 1], step: 'clank' }] })).toThrow(/add audio.footsteps first/);
  });
  it('adds nothing where neither is written', () => {
    const A = resolveWorldAudio(base), page = audioChannelScript(A);
    expect(A.emitters).toBeUndefined(); expect(A.surfaces).toBeUndefined();
    expect(page).not.toContain('__beatsPlaces'); expect(page).not.toContain('__fsOf');
  });
});
