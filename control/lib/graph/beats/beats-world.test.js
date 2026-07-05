import { describe, expect, it } from 'vitest';

import { resolveWorldAudio } from './beats-world.js';
import { emitThreeWorld } from '../scene/scene-three.js';
import { sketchRenderMode, classifyBucket, isBucket } from '../sketch/sketch-manifest.js';

// ── the Phase-5 exit criteria, structurally (beats.plan.md → B2/B3) ────────────
// "a recipe with `audio` omitted is byte-identical to today" and "muted capture
// runs stay byte-identical" — enforced here as: the audio channel contributes
// ZERO bytes unless a payload carries `audio` on a non-capture run.

const FACES = [{ pts: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]], color: '#888888' }];

const SOUNDTRACK = {
  kind: 'beats-ambient',
  title: 'hum',
  bpm: 84,
  seed: 7,
  progression: [{ chord: ['D3', 'F3', 'A3'], root: 'D2' }],
  channels: [{ name: 'pads', role: 'harmony', patch: 'pad' }],
};

describe('emitThreeWorld audio channel', () => {
  it('audio omitted / null / capture ⇒ zero audio bytes (byte-identity)', () => {
    const bare = emitThreeWorld({ faces: FACES });
    const nulled = emitThreeWorld({ faces: FACES, audio: null });
    expect(nulled).toBe(bare);
    expect(bare).not.toContain('__beats');
    const audio = resolveWorldAudio({ soundtrack: SOUNDTRACK, wind: true });
    const captured = emitThreeWorld({ faces: FACES, audio, capture: true });
    expect(captured).not.toContain('__beats');
  });

  it('audio present ⇒ the kernel, unlock, and HUD toggle ride the page', () => {
    const audio = resolveWorldAudio({ soundtrack: SOUNDTRACK, wind: true, footsteps: true });
    const html = emitThreeWorld({ faces: FACES, audio });
    expect(html).toContain('__beatsUnlock');                       // gesture unlock on the canvas
    expect(html).toContain('buildBeatsKernel');                    // self-contained kernel source
    expect(html).toContain('startAmbient');                        // soundtrack transport
    expect(html).toContain('__AUDIO.footsteps.step');              // gait binding
    expect(html).toContain("addEventListener('pointerdown', __beatsUnlock)");
  });
});

describe('resolveWorldAudio', () => {
  it('validates + normalizes an inline soundtrack and loops compositions', () => {
    const out = resolveWorldAudio({ soundtrack: SOUNDTRACK });
    expect(out.soundtrack.channels[0].patch).toBe('pad');
    const comp = resolveWorldAudio({
      soundtrack: { kind: 'beats-composition', title: 'sting', bpm: 120, parts: [{ name: 'p', events: [['0:0:0', 'C4']] }] },
    });
    expect(comp.soundtrack.loop).toBe(true);
    expect(() => resolveWorldAudio({ soundtrack: { kind: 'beats-ambient', title: 'x' } })).toThrow(/invalid recipe/);
    // a pattern groove (B5.1) is a valid soundtrack; normalization expands its grid.
    const pat = resolveWorldAudio({
      soundtrack: { kind: 'beats-pattern', title: 'groove', bpm: 132, tracks: [{ name: 'kick', gesture: { type: 'thump' }, mask: [1, 0, 0, 0] }] },
    });
    expect(pat.soundtrack.steps).toBe(32);
    expect(pat.soundtrack.tracks[0].mask).toHaveLength(32);
  });

  it('derives wind + footstep defaults; night reads quieter', () => {
    const day = resolveWorldAudio({ wind: true, footsteps: true });
    const night = resolveWorldAudio({ wind: true }, { time: 'night' });
    expect(day.wind.level).toBeGreaterThan(night.wind.level);
    expect(day.footsteps.step[0].type).toBe('burst');
    expect(day.footsteps.land[0].type).toBe('thump');
  });

  it('rejects sfx.on pointing at an unknown cue; passes valid cue maps', () => {
    const cues = { ding: [{ type: 'sweep', from: 'C6', to: 'E6', dur: 0.06 }] };
    const ok = resolveWorldAudio({ sfx: { cues, on: { pickup: 'ding' } } });
    expect(ok.on.pickup).toBe('ding');
    expect(() => resolveWorldAudio({ sfx: { cues, on: { pickup: 'nope' } } })).toThrow(/unknown cue 'nope'/);
    expect(() => resolveWorldAudio({ sfx: { cues: { bad: [{ type: 'wobble' }] } } })).toThrow(/invalid cues/);
  });

  it('empty / absent specs resolve to null (the channel stays un-emitted)', () => {
    expect(resolveWorldAudio(null)).toBe(null);
    expect(resolveWorldAudio({})).toBe(null);
  });
});

describe('render-mode wiring', () => {
  it('beats kinds render as the beats player, never CreationMap', () => {
    expect(sketchRenderMode({ kind: 'beats-ambient' })).toBe('beats');
    expect(sketchRenderMode({ kind: 'beats-composition' })).toBe('beats');
    expect(sketchRenderMode({ kind: 'beats-pattern' })).toBe('beats');
    expect(sketchRenderMode({ kind: 'beats-sfx' })).toBe('beats');
  });

  it('beats kinds classify into the beats bucket (the /maker/beats shelf)', () => {
    expect(isBucket('beats')).toBe(true);
    expect(classifyBucket({ kind: 'beats-ambient' })).toBe('beats');
    expect(classifyBucket({ kind: 'beats-sfx' })).toBe('beats');
    expect(classifyBucket({ kind: 'fractal-city' })).toBe('world');   // unchanged
    expect(classifyBucket({})).toBe('diagram');                       // unchanged
  });
});
