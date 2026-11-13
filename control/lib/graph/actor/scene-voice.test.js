import { describe, it, expect } from 'vitest';
import { BASELINE } from './baseline.js';
import { actScene } from './scene.js';
import { sceneActOf } from './act.js';
import { performanceErrors } from '../face-acting/perform.js';
import { dubbedRead, dubAdvice, dubTake } from './dub.js';

// recorded lines in a scene (scene.js `voice`): a bound recording holds its line's clock and speaks its mouth; absent,
// the scene is as it was. Bound recordings stand in for the door's (no WAV: the scene is pure).
// (three lines: Mara, Jon, Mara; a cross and a turn between)
const B = { ...BASELINE.blocked, script: "MARA: You kept the *key*.\nJON (worried): I kept everything. [pause] That was the trouble.\nMara crosses to the table.\nJon turns to Mara.\nMARA (determined): Then send one *now*." };
const words = (list, t0 = 0.2, step = 0.3) => list.map((w, i) => ({ w, t: Math.round((t0 + i * step) * 1000) / 1000, dur: 0.25 }));
const rec = (id, seconds, list) => ({ recording: id.padEnd(16, '0'), seconds, timing: 'aligned', words: words(list), phonemes: [{ p: 'AA1', t: 0.2, dur: 0.2 }], text: 'x' });
const VOICE = { 1: rec('a1', 2.5, ['You', 'kept', 'the', 'key']), 3: rec('c3', 1.2, ['Then', 'send', 'one', 'now']) };

describe('a scene with recorded lines', () => {
  const plain = actScene(B), voiced = actScene({ ...B, voice: VOICE });

  it('is the scene it was when nothing is recorded', () => {
    expect(JSON.stringify(actScene({ ...B, voice: {} }))).toBe(JSON.stringify(plain));
  });

  it('holds each recorded line its recording\'s length, the rest as read', () => {
    const [m1, j1, m2] = voiced.turns;
    expect(m1.end - m1.at).toBeCloseTo(2.5, 3);
    expect(m1.recording).toBe(VOICE[1].recording);
    expect(j1.recording).toBeUndefined();
    expect(j1.end - j1.at).toBeCloseTo(plain.turns[1].end - plain.turns[1].at, 3);
    expect(m2.end - m2.at).toBeCloseTo(1.2, 3);
  });

  it('speaks the recording from the line\'s first beat, its words where the recording has them', () => {
    const A = voiced.actors.mara, T = voiced.turns[0];
    const says = A.read.beats.filter((b) => b.say && b.at >= T.at - 1e-6 && b.at < T.at + T.hold);
    expect(says).toHaveLength(1);
    expect(says[0].at).toBe(T.at);
    expect(says[0].say.recording).toBe(VOICE[1].recording);
    const L = A.read.lines.find((x) => x.at >= T.at - 1e-6 && x.at < T.end);
    expect(L.words.map((x) => x.t)).toEqual(VOICE[1].words.map((x) => Math.round((T.at + x.t) * 1000) / 1000));
    expect(performanceErrors(sceneActOf(A).perform.scene)).toEqual([]);
  });

  it('acts a part whose every line is recorded', () => {
    const S = actScene({ ...B, voice: { 2: rec('b2', 3, ['I', 'kept', 'everything', 'That', 'was', 'the', 'trouble']) } });
    const A = S.actors.jon;
    expect(A.read.beats.filter((b) => b.say).map((b) => b.say.recording)).toEqual([S.turns[1].recording]);
    expect(performanceErrors(sceneActOf(A).perform.scene)).toEqual([]);
  });
});

describe('a dub to picture', () => {
  const S = actScene({ ...B, voice: VOICE }), DUB = { 1: rec('f1', 2.6, ['Tu', 'as', 'gardé', 'la', 'clé']), 3: rec('f3', 9, ['Alors']) };
  it('keeps the picture and gives each dubbed line\'s mouth the dub', () => {
    const A = S.actors.mara, R = dubbedRead(A, S.turns, DUB);
    expect(R.beats.map((b) => b.at)).toEqual(A.read.beats.map((b) => b.at));
    expect(R.beats.filter((b) => b.say).map((b) => b.say.recording)).toEqual([DUB[1].recording, DUB[3].recording]);
    expect(R.body).toBe(A.read.body);
    expect(dubTake('pt-BR')).toBe('dub-pt-BR');
  });
  it('says where a dub runs into the next line, and by how much', () => {
    const over = dubAdvice(S.turns, { 2: rec('x2', 99, ['Non']) }, 'fr');
    expect(over).toHaveLength(1);
    expect(over[0].line).toBe(2);
    expect(dubAdvice(S.turns, DUB, 'fr')).toEqual([]);
  });
});
