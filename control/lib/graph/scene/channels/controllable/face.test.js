// The realistic hero's FACE in play: the controllable channel builds morph targets on a faced body's parts and drives
// them by the state's facial track (the ambient blink on the world's clock); a page with no faced body emits none of
// it. And a hero's face under the runtime's state names (world-scene.js stateFace).
import { describe, it, expect } from 'vitest';
import { controllableChannelScript } from './index.js';
import { stateFace } from '../../../worlds/world-scene.js';

const fig = { rig: true, bones: [{ id: 'root', head: [0, 0, 0], tail: [0, 0, 1] }], parts: [{ pos: 'AAAAAAAAAAAAAAAAAACAPwAAAAAAAAAAAAAAAAAAgD8AAAAA', col: 'AAAAAAAAAAAAAAAA', faces: 1 }], clips: { idle: { k: 2, b: [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0.1] } }, figH: 1 };
const ent = [{ id: 'p', rule: { type: 'platform', eye: 0 }, transform: { pos: [0, 0, 0], heading: 0, pitch: 0 }, body: { type: 'figure-rig', figure: 'hero' } }];

describe('the face in play', () => {
  it('is emitted for a faced body alone', () => {
    const plain = controllableChannelScript(ent, null, { hero: fig });
    for (const needle of ['__rigMorph', '__rigFace', 'morphTargetInfluences']) expect(plain).not.toContain(needle);
    const q = Buffer.from(Int16Array.from([0, 0, 0, 0, 0, 32767]).buffer).toString('base64');
    const faced = { ...fig, face: { targets: ['blink'], weights: [0], tracks: { idle: { t: [0], w: [[0]] } }, ambient: { seconds: 2, t: [0, 1], w: [[0], [1]] }, ambientOver: ['idle'] }, parts: [{ ...fig.parts[0], morph: { i: Buffer.from(Uint32Array.from([0]).buffer).toString('base64'), q, s: 1e-3 } }] };
    const js = controllableChannelScript(ent, null, { hero: faced });
    for (const needle of ['__rigMorph(fig, part, geo)', 'mesh.updateMorphTargets()', '__rigFace(rig,', '__world.time || 0', '__mq(']) expect(js).toContain(needle);
  });
  it('plays each state\'s clip\'s track under the state\'s name, the ambient blink over the rest', () => {
    const own = { idle: { k: 1 }, walk: { k: 2 } }, lib = { k: 3 };
    const walk = { t: [0, 1], w: [[0], [1]] };
    const F = stateFace({ targets: ['blink'], tracks: { idle: { t: [0], w: [[0]] }, walk }, ambientOver: ['idle'], ambient: { seconds: 9 } }, own, { idle: own.idle, forward: own.walk, leap: lib });
    expect(Object.keys(F.tracks).sort()).toEqual(['forward', 'idle']);
    expect(F.tracks.forward).toBe(walk);
    expect(F.ambientOver.sort()).toEqual(['idle', 'leap']);
  });
});
