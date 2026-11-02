// persona.char.test.js — what the persona makes of the actor's baseline (actor/baseline.js), pinned byte for byte before
// the actor exists: the solo speech's read, its face take, its cue sheet and captions, the record's takes and export
// files, and the two-hander's reads as the persona alone plays them. The actor reads a persona as an actor in one role;
// these pins are its promise that every persona minted before reads as it did (the actor's law 7). A pin moves only when
// a step says the persona's emission changes.
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';

import { BASELINE, sceneReads } from '../actor/baseline.js';
import { readScript, takeOf } from './read.js';
import { cueSheet } from './cues.js';
import { captionCues, srt, vtt } from './captions.js';
import { personaManifest } from './persona.js';
import { personaHero, personaFiles } from './bundle.js';

const hash = (x) => createHash('sha256').update(typeof x === 'string' ? x : JSON.stringify(x)).digest('hex').slice(0, 16);

const SOLO = { read: '96e09e92765e62e4', take: '10c9379208fbd023', cues: '3e932fe59356cc13', srt: '90ca7fe180e2f8f2', vtt: '0e951176001c7401' };
const RECORD = { perform: 'b59101aa051dcff8', filesFace: 'ce18d27d79767705', filesBody: '7d19870bee247972' };
const SCENE = { mara: { read: '263b604dabcdf12d', take: '5a6aac103bf6c14c' }, jon: { read: 'fd01dfb2ed1caf95', take: 'c52813f4b301df85' } };

describe('the persona on the actor\'s baseline', () => {
  it('reads the solo speech as pinned: its read, its face take, its cue sheet and its captions', () => {
    const R = readScript(BASELINE.solo), cues = captionCues(R);
    expect({ read: hash(R), take: hash(takeOf(R)), cues: hash(cueSheet('solo', R, { face: true })), srt: hash(srt(cues)), vtt: hash(vtt(cues)) }).toEqual(SOLO);
  });

  it('makes the pinned record: the hero\'s perform takes, and the export files with a face and without', () => {
    const P = personaManifest({ hero: 'hero-ref', register: BASELINE.solo.register, reads: { solo: { script: BASELINE.solo.script } } }).persona;
    const face = { hero: { form: 'realistic' } }, body = { hero: { form: 'stylized' } };
    expect({ perform: hash(personaHero(P, face).hero.perform), filesFace: hash(personaFiles(P, face)), filesBody: hash(personaFiles(P, body)) }).toEqual(RECORD);
  });

  it('plays the two-hander as pinned: each speaker\'s read and face take', () => {
    const S = sceneReads(BASELINE.scene);
    expect(Object.fromEntries(Object.entries(S.actors).map(([who, A]) => [who, { read: hash(A.read), take: hash(takeOf(A.read)) }]))).toEqual(SCENE);
  });
});
