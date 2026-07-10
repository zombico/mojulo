import { describe, expect, it } from 'vitest';

import { resolveWorldAudio, emitSceneSoundtrackScript } from './beats-world.js';
import { emitThreeWorld } from '../scene/scene-three.js';
import { renderSceneHtml } from '../scene/scene-html.js';
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

  // ── B5.3: audio.bindings — sim state → channel macros ──────────────────────
  it('resolves bindings against the soundtrack and rejects unknown channels/macros', () => {
    const bindings = [
      { source: 'depth', range: [0, 12], target: { channel: 'pads', macro: 'tone', range: [1, 0.2] } },
      { source: 'proximity', point: [4, 4, 0], range: [10, 1], target: { channel: 'pads', macro: 'level', range: [0.4, 1] } },
    ];
    const out = resolveWorldAudio({ soundtrack: SOUNDTRACK, bindings });
    expect(out.bindings).toHaveLength(2);
    expect(out.bindings[0].target.macro).toBe('tone');
    expect(out.bindings[1].point).toEqual([4, 4, 0]);

    expect(() => resolveWorldAudio({ soundtrack: SOUNDTRACK, bindings: [{ source: 'depth', range: [0, 1], target: { channel: 'nope', macro: 'tone', range: [1, 0] } }] }))
      .toThrow(/not a soundtrack channel/);
    expect(() => resolveWorldAudio({ soundtrack: SOUNDTRACK, bindings: [{ source: 'depth', range: [0, 1], target: { channel: 'pads', macro: 'wah', range: [1, 0] } }] }))
      .toThrow(/target.macro must be one of/);
    expect(() => resolveWorldAudio({ soundtrack: SOUNDTRACK, bindings: [{ source: 'gravity', range: [0, 1], target: { channel: 'pads', macro: 'tone', range: [1, 0] } }] }))
      .toThrow(/source must be one of/);
    expect(() => resolveWorldAudio({ soundtrack: SOUNDTRACK, bindings: [{ source: 'proximity', range: [0, 1], target: { channel: 'pads', macro: 'tone', range: [1, 0] } }] }))
      .toThrow(/needs a reference/);
    // bindings without a soundtrack have nothing to drive.
    expect(() => resolveWorldAudio({ bindings })).toThrow(/add audio.soundtrack/);
  });

  it('bindings ride the emitted page and drive the macro setters', () => {
    const audio = resolveWorldAudio({
      soundtrack: SOUNDTRACK,
      bindings: [{ source: 'depth', range: [0, 12], target: { channel: 'pads', macro: 'tone', range: [1, 0.2] } }],
    });
    const html = emitThreeWorld({ faces: FACES, audio });
    expect(html).toContain('__beatsBind');
    expect(html).toContain('setTone');
    // absent bindings ⇒ evaluator not emitted... but the kernel still carries the setters.
    const plain = emitThreeWorld({ faces: FACES, audio: resolveWorldAudio({ soundtrack: SOUNDTRACK }) });
    expect(plain).toContain('__AUDIO.bindings && __AUDIO.bindings.length');
  });
});

describe('CSS3D scene soundtrack (B4)', () => {
  // a minimal two-point room manifest the CSS3D room renderer accepts.
  const ROOM = {
    kind: 'fractal-city',
    seed: 7,
    title: 'humming city',
  };

  it('soundtrack script emits for soundtrack/wind, empty otherwise', () => {
    const audio = resolveWorldAudio({ soundtrack: SOUNDTRACK, wind: true });
    const script = emitSceneSoundtrackScript(audio);
    expect(script).toContain('buildBeatsKernel');
    expect(script).toContain('startAmbient');
    expect(script).toContain('__beatsUnlock');
    expect(emitSceneSoundtrackScript(null)).toBe('');
    // sfx-only audio has nothing for the scene path (no bus there).
    expect(emitSceneSoundtrackScript({ cues: { ding: [] } })).toBe('');
  });

  it('renderSceneHtml injects the soundtrack live, never on capture, never without audio', () => {
    const plain = renderSceneHtml({ manifest: ROOM });
    expect(plain).not.toContain('__beatsUnlock');
    const withAudio = renderSceneHtml({ manifest: { ...ROOM, audio: { soundtrack: SOUNDTRACK } } });
    expect(withAudio).toContain('__beatsUnlock');
    expect(withAudio.indexOf('</body>')).toBeGreaterThan(withAudio.indexOf('__beatsUnlock'));
    const captured = renderSceneHtml({ manifest: { ...ROOM, audio: { soundtrack: SOUNDTRACK } } }, { capture: true });
    expect(captured).toBe(plain);   // bakes byte-identical to a soundtrack-less page
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
