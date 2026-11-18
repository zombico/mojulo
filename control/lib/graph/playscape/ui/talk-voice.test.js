import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { bindSceneVoices } from '../../face-acting/recordings.js';
import { readScenes, sceneProgram } from './scenes.js';
import { talkLines, withTalkTakes, linePerform, TALK_LEAD, TALK_TAIL } from './talk-lines.js';
import { readSpeakers } from './talk-box.js';
import { sceneScript, sceneVoicesOn } from '../../scene/channels/scene-channel.js';

// Recorded voices, when the creator wants them: a line's WAV bound where the world is written, said on its own timeline
// by the speaker's face, and played by the page as the line's take begins. One case per step: the slot, the binding,
// the program, the page; a line with no voice is as it was.

let dir = null, wav = null, prevOut;
// a WAV of a voice's shape: a second of a buzz rising and falling, 16-bit mono at 16 kHz
function writeWav(file, seconds = 1, rate = 16000) {
  const n = Math.round(seconds * rate), b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) { const t = i / rate, env = Math.sin(Math.PI * t / seconds) * (0.5 + 0.5 * Math.sin(2 * Math.PI * 4 * t)); b.writeInt16LE(Math.round(12000 * env * Math.sin(2 * Math.PI * 160 * t)), 44 + i * 2); }
  writeFileSync(file, b);
}
beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'mojulo-voice-'));
  prevOut = process.env.MOJULO_OUTCOMES_DIR; process.env.MOJULO_OUTCOMES_DIR = dir;
  wav = path.join(dir, 'line.wav'); writeWav(wav);
});
afterAll(() => { if (prevOut === undefined) delete process.env.MOJULO_OUTCOMES_DIR; else process.env.MOJULO_OUTCOMES_DIR = prevOut; if (dir) rmSync(dir, { recursive: true, force: true }); });

const world = (voice) => ({
  // (a speaker with no face to talk with: a box)
  entities: [{ id: 'mayor', body: { type: 'mesh', shape: 'box', size: [0.6, 0.6, 1.7] } }],
  play: { scenes: [{ id: 'gate', when: { start: true }, beats: [{ line: { who: 'mayor', say: 'The road is shut.', ...(voice !== undefined ? { voice } : {}) } }, { line: { who: 'mayor', say: 'Go home.' } }] }] },
});

describe('recorded voices', () => {
  it('the slot: a WAV\'s path or { audio } as the door takes it, a bound recording as it keeps it; anything else teaches', () => {
    expect(() => readScenes(world('line.wav').play)).not.toThrow();
    expect(() => readScenes(world({ audio: 'line.wav' }).play)).not.toThrow();
    expect(() => readScenes(world({ recording: '0123456789abcdef', seconds: 1.2, timing: 'aligned' }).play)).not.toThrow();
    expect(() => readScenes(world(3).play)).toThrow(/the line recorded/);
    // an unbound path is not heard: the program carries only a bound recording
    expect(sceneProgram(world('line.wav').play)[0].beats[0].voice).toBeUndefined();
  });

  it('bound where the world is written: saved by its content, timed by its words; a world without voices is the same object', () => {
    const W = bindSceneVoices(world(wav)), V = W.play.scenes[0].beats[0].line.voice;
    expect(V.recording).toMatch(/^[0-9a-f]{16}$/);
    expect(V.seconds).toBeCloseTo(1, 2);
    expect(V.timing).toBe('aligned');
    expect(V.phonemes.length).toBeGreaterThan(3);
    expect(bindSceneVoices(world())).toEqual(world());
    const plain = world(); expect(bindSceneVoices(plain)).toBe(plain);
    expect(() => bindSceneVoices(world(path.join(dir, 'missing.wav')))).toThrow(/play\.scenes\[0\]\.beats\[0\]\.line\.voice/);
  });

  it('the program: a recorded line has a take whoever says it, its face said on the recording\'s clock, its voice slim', () => {
    const W = bindSceneVoices(world(wav)), program = sceneProgram(W.play), T = talkLines(W, program);
    expect(T.takes).toHaveLength(1);
    expect(T.takes[0]).toMatchObject({ clip: 'talk:gate:0', figure: null, voice: W.play.scenes[0].beats[0].line.voice.recording });
    expect(T.takes[0].seconds).toBeCloseTo(TALK_LEAD + 1 + TALK_TAIL, 2);
    const P = withTalkTakes(program, T.takes);
    expect(P[0].beats[0].voice).toEqual({ recording: T.takes[0].voice, at: TALK_LEAD });
    expect(P[0].beats[0].take.clip).toBe('talk:gate:0');
    expect(P[0].beats[1].take).toBeUndefined();
    // the face says it on the recording's own timeline (its timed phonemes)
    const say = linePerform(program[0].beats[0]).beats[0].say;
    expect(say).toMatchObject({ recording: T.takes[0].voice, timing: 'aligned', text: 'The road is shut.' });
  });

  it('the page plays voices only when it carries some; the speakers sheet keeps each one\'s casting', () => {
    const W = bindSceneVoices(world(wav)), program = sceneProgram(W.play), P = withTalkTakes(program, talkLines(W, program).takes);
    const id = P[0].beats[0].voice.recording;
    expect(sceneVoicesOn({ scenes: P, voices: { [id]: 'UklGRg==' } })).toBe(true);
    expect(sceneVoicesOn({ scenes: P })).toBe(false);
    expect(sceneScript({ voices: true })).toContain('__voxStep(v)');
    expect(sceneScript({})).not.toContain('__vox');
    expect(readSpeakers({ speakers: { mayor: { voice: 'am_adam' } } })).toEqual({ mayor: { portrait: 'live', voice: 'am_adam' } });
    expect(() => readSpeakers({ speakers: { mayor: { voice: 7 } } })).toThrow(/recorded in/);
  });
});
