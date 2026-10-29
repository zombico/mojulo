// A realistic hero's recorded lines in the engine packs (face-acting/recordings.js): each held recording shipped once
// beside the GLB, and each engine's own importer playing it with its take: Godot keys it on the take's animation as an
// audio track (figure_face.gd), Unreal imports it as a SoundWave and cues it with a PlaySound notify on the take's
// AnimSequence (import_mojulo.py). Absent a recording, nothing changes. (The packs built whole from a minted hero ride the
// realistic export's E2E suite.)
import { describe, expect, it } from 'vitest';
import { voiceFiles } from './engines/pack.js';
import { extractEngineScore } from './engine-score.js';
import { emitGodotProject, FIGURE_FACE_GD } from './godot-project.js';
import { emitUnrealAsset } from './unreal-project.js';

const WAV = Buffer.from('RIFF....WAVE');
const LINES = [{ clip: 'face:line', at: 0.5, recording: 'aaaaaaaaaaaaaaaa', bytes: WAV }, { clip: 'face:again', at: 0, recording: 'aaaaaaaaaaaaaaaa', bytes: WAV },
  { clip: 'face:line', at: 2, recording: 'bbbbbbbbbbbbbbbb', bytes: null }];

describe('the recorded lines in a pack', () => {
  it('ship once a recording, those this machine holds', () => {
    expect(voiceFiles(LINES, 'voice')).toEqual([{ rel: 'voice/aaaaaaaaaaaaaaaa.wav', bytes: WAV }]);
    expect(voiceFiles(undefined, 'voice')).toEqual([]);
  });
  it('play with their takes in Godot: keyed as an audio track on the take\'s animation, at a Voice player at the head', () => {
    expect(FIGURE_FACE_GD).toMatch(/_voice\(face\)/);
    expect(FIGURE_FACE_GD).toMatch(/res:\/\/voice\/%s\.wav/);
    expect(FIGURE_FACE_GD).toMatch(/add_track\(Animation\.TYPE_AUDIO\)/);
    expect(FIGURE_FACE_GD).toMatch(/audio_track_insert_key\(t, float\(line\.get\("at", 0\.0\)\), load\(file\)\)/);
    expect(FIGURE_FACE_GD).toMatch(/BoneAttachment3D/);
    const score = extractEngineScore({ ref: 'hero', manifest: {} }, { entities: [] });
    const figure = { name: 'bare', clip: 'idle', clips: ['idle'], view: 0, viewName: 'view 0', joints: 60, face: true };
    const said = emitGodotProject({ ref: 'hero', score, manifestHash: 'h', kernelVersion: '0', figure: { ...figure, voice: 1, voiceMissing: 1 } });
    expect(said.ledger.figure_voice.note).toMatch(/^1 recorded line .* 1 line named a recording this machine does not hold/);
    expect(said.files.find((f) => f.file === 'README.md').text).toMatch(/recorded line/);
    // (no recording, no row and no paragraph)
    const silent = emitGodotProject({ ref: 'hero', score, manifestHash: 'h', kernelVersion: '0', figure });
    expect(silent.ledger.figure_voice).toBeUndefined(); expect(silent.files.find((f) => f.file === 'README.md').text).not.toMatch(/recorded line/);
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
