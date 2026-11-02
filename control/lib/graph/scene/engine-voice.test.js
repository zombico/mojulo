// A realistic hero's recorded lines in the engine packs (face-acting/recordings.js): each held recording shipped once
// beside the GLB, and the engine's own importer playing it with its take: Unreal imports it as a SoundWave and cues it
// with a PlaySound notify on the take's AnimSequence (import_mojulo.py). Absent a recording, nothing changes. (The pack
// built whole from a minted hero rides the realistic export's E2E suite.)
import { describe, expect, it } from 'vitest';
import { voiceFiles } from './engines/pack.js';
import { emitUnrealAsset } from './unreal-project.js';

const WAV = Buffer.from('RIFF....WAVE');
const LINES = [{ clip: 'face:line', at: 0.5, recording: 'aaaaaaaaaaaaaaaa', bytes: WAV }, { clip: 'face:again', at: 0, recording: 'aaaaaaaaaaaaaaaa', bytes: WAV },
  { clip: 'face:line', at: 2, recording: 'bbbbbbbbbbbbbbbb', bytes: null }];

describe('the recorded lines in a pack', () => {
  it('ship once a recording, those this machine holds', () => {
    expect(voiceFiles(LINES, 'voice')).toEqual([{ rel: 'voice/aaaaaaaaaaaaaaaa.wav', bytes: WAV }]);
    expect(voiceFiles(undefined, 'voice')).toEqual([]);
  });
  it('play with their takes in Unreal: imported as SoundWaves and cued on the takes\' AnimSequences', () => {
    const voice = [{ clip: 'face:line', at: 0.5, file: 'Voice/aaaaaaaaaaaaaaaa.wav' }];
    const E = emitUnrealAsset({ ref: 'sk_hero', manifestHash: 'h', figure: { name: 'bare', clip: 'idle', clips: ['idle'], joints: 60 }, voice });
    const py = E.files.find((f) => f.file === 'import_mojulo.py').text;
    expect(py).toContain(`VOICE = ${JSON.stringify(voice)}`);
    expect(py).toMatch(/^ {4}import_voice\(CONTENT_ROOT\)$/m);
    expect(py).toMatch(/AnimNotify_PlaySound/); expect(py).toMatch(/remove_animation_notify_events_by_track\(anim, 'Voice'\)/);
    expect(E.files.find((f) => f.file === 'README.md').text).toMatch(/## Recorded lines/);
    const silent = emitUnrealAsset({ ref: 'sk_hero', manifestHash: 'h' }).files;
    expect(silent.find((f) => f.file === 'import_mojulo.py').text).toContain('VOICE = []');
    expect(silent.find((f) => f.file === 'README.md').text).not.toMatch(/## Recorded lines/);
  });
});
