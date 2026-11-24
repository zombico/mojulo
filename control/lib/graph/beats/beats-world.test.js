import { describe, expect, it, vi } from 'vitest';

import { resolveWorldAudio, emitSceneSoundtrackScript } from './beats-world.js';
import { emitThreeWorld } from '../scene/scene-three.js';
import { renderSceneHtml } from '../scene/scene-html.js';
import { sketchRenderMode, classifyBucket, isBucket } from '../sketch/sketch-manifest.js';
import { audioChannelScript } from '../scene/channels/audio.js';
import { buildBus } from '../worlds/event-bus.js';

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

describe('a moveset\'s sounds (audio.moves)', () => {
  const thud = [{ type: 'thump', from: 'A2', to: 'A1', dur: 0.1 }];
  const sfx = { cues: { cut: thud, heavy: thud, clang: thud } };
  it('names its events\' cues: the swing and the hit by weapon and weight, the rest one cue each; the page plays them', () => {
    const A = resolveWorldAudio({ sfx, moves: { swing: { sword: { light: 'cut', heavy: 'heavy' } }, parry: 'clang' } });
    expect(A.moves).toEqual({ swing: { sword: { light: 'cut', heavy: 'heavy' } }, parry: 'clang' });
    expect(audioChannelScript(A)).toContain('__beatsMoves');
    // (absent, not a byte of it)
    expect(audioChannelScript(resolveWorldAudio({ sfx }))).not.toContain('__beatsMoves');
  });
  it('refuses a cue the level has not, an event it does not know, and a weight that is none', () => {
    expect(() => resolveWorldAudio({ sfx, moves: { block: 'boom' } })).toThrow(/audio\.moves\.block: 'boom' is no cue of audio\.sfx\.cues/);
    expect(() => resolveWorldAudio({ sfx, moves: { jump: 'cut' } })).toThrow(/audio\.moves\.jump is not a moveset's event/);
    expect(() => resolveWorldAudio({ sfx, moves: { hit: { sword: { mighty: 'cut' } } } })).toThrow(/a move's weight is light, heavy, finisher/);
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

// ── bus stingers hear the whole drained stream ────────────────────────────────
// The reducer cascades reaction-emitted events (goal:reached, pickup:*) internally, so they never
// arrive as the wrapper's argument; the stinger reads the state.log delta, as the game channel does.
describe('audio.sfx.on', () => {
  // run the channel's stinger block against a real bus, with the cue call recorded.
  function stingers(on, reactions, facts) {
    const script = audioChannelScript({ cues: { ding: [{ type: 'tone' }], step: [{ type: 'thump' }] }, on });
    const block = script.slice(script.indexOf('// bus stingers'), script.indexOf('// footsteps'));
    const bus = buildBus();
    const heard = [];
    const __AUDIO = { cues: { ding: 'ding', step: 'step' }, on };
    new Function('__AUDIO', '__BUS', '__beatsCue', block)(__AUDIO, bus, (cue) => heard.push(cue));
    bus.processEvents(bus.createBusState({ reactions }, [{ id: 'gem', on: true }]), facts);
    return heard;
  }

  it('fires on an event a reaction emits (the cascade), not only on incoming facts', () => {
    const reactions = [{ on: 'enter', do: 'emit', type: 'pickup:gem' }, { on: 'pickup:gem', do: 'emit', type: 'goal:reached' }];
    expect(stingers({ 'pickup:*': 'ding', 'goal:reached': 'step' }, reactions, [{ type: 'enter', a: 'player', b: 'gem' }])).toEqual(['ding', 'step']);
  });

  it('still fires on incoming facts; a burst of one cue inside 60 ms is one sound, spaced events each sound', () => {
    expect(stingers({ enter: 'step' }, [], [{ type: 'enter', a: 'player', b: 'gem' }, { type: 'enter', a: 'player', b: 'door' }])).toEqual(['step']);
    let t = 1000;
    const clock = vi.spyOn(performance, 'now').mockImplementation(() => t);
    try {
      const script = audioChannelScript({ cues: { step: [{ type: 'thump' }] }, on: { enter: 'step' } });
      const block = script.slice(script.indexOf('// bus stingers'), script.indexOf('// footsteps'));
      const bus = buildBus(), heard = [];
      new Function('__AUDIO', '__BUS', '__beatsCue', block)({ cues: { step: 'step' }, on: { enter: 'step' } }, bus, (c) => heard.push(c));
      const state = bus.createBusState({ reactions: [] }, []);
      bus.processEvents(state, [{ type: 'enter', a: 'p', b: 'x' }]);
      t += 30; bus.processEvents(state, [{ type: 'enter', a: 'p', b: 'x' }]);
      t += 100; bus.processEvents(state, [{ type: 'enter', a: 'p', b: 'x' }]);
      expect(heard).toEqual(['step', 'step']);
    } finally { clock.mockRestore(); }
  });
});

describe('a stinger is not a soundtrack', () => {
  it("refuses 'field:victory' under a level and says where it goes", () => {
    expect(() => resolveWorldAudio({ soundtrack: 'field:victory' }, { ref: 'lv' })).toThrow(/stinger.*music\.victory/);
    expect(resolveWorldAudio({ soundtrack: 'field:battle' }, { ref: 'lv' }).soundtrack).toMatchObject({ kind: 'beats-composition', loop: true });
  });
});

// A CUE'S SOUND (playscape/ui/cues.js `sound`): the words a level's play names, each voiced by its sound sheet as a cue
// on `sfx:<word>`; a level that names none carries none
describe('the sounds a level\'s play names', () => {
  it('each word a cue of the sheet on its own event', () => {
    const A = resolveWorldAudio({ sfx: { sheet: {} } }, { sounds: ['chime', 'door'] });
    expect(A.on).toMatchObject({ 'sfx:chime': 'sfx-chime', 'sfx:door': 'sfx-door' });
    expect(A.cues['sfx-chime']).toBeTruthy();
    expect(Object.keys(resolveWorldAudio({ sfx: { sheet: {} } }).on ?? {}).some((k) => k.startsWith('sfx:'))).toBe(false);
    expect(() => resolveWorldAudio({ sfx: { sheet: {} } }, { sounds: ['no-such-sound'] })).toThrow(/not a sound on the SFX shelf/);
  });
});

// THE MUSIC AN EVENT CHANGES TO (a cue's `music`, playscape/ui/cues.js): each mood a level's play names a piece in the
// soundtrack's identity; on the page, `music:<mood>` fades the place's score out and the piece in, `music:place` back.
// A level that names none carries none of it
describe('the music an event changes to', () => {
  it('each mood a piece in the place\'s identity; stop and place none; named by none, not a byte', () => {
    const A = resolveWorldAudio({ soundtrack: 'field:forest' }, { ref: 'lv', music: ['place', 'sorrow', 'stop'] });
    expect(Object.keys(A.pieces)).toEqual(['sorrow']);
    expect(A.pieces.sorrow).toMatchObject({ loop: true });
    const plain = resolveWorldAudio({ soundtrack: 'field:forest' }, { ref: 'lv' });
    expect(plain.pieces).toBeUndefined();
    expect(audioChannelScript(plain)).not.toContain('__musicTo');
  });

  it('on the page: the piece faded in on its own engine as the score stops, and the place\'s score back', () => {
    vi.useFakeTimers();
    try {
      const audio = resolveWorldAudio({ soundtrack: 'field:forest' }, { ref: 'lv', music: ['sorrow', 'place'] });
      const script = audioChannelScript(audio);
      const block = script.slice(script.indexOf('let __piece = null'), script.indexOf('window.__mojMusicTo'));
      const ctx = { currentTime: 1 };
      const engine = () => {
        const gain = { value: 0.9, ramps: [], cancelScheduledValues() {}, setValueAtTime(v) { this.value = v; }, linearRampToValueAtTime(v) { this.ramps.push(v); this.value = v; } };
        return { started: 0, stopped: 0, master: { gain }, startComposition() { this.started++; }, startPattern() { this.started++; }, startAmbient() { this.started++; }, stop() { this.stopped++; } };
      };
      const made = [], eng = engine(), bus = buildBus();
      const run = new Function('__AUDIO', '__BUS', '__beatsCtx', '__beatsEng', '__beatsMuted', '__beatsVol', '__BEATS', '__BEATS_PATCHES',
        `${block}; return { get piece() { return __piece; }, get eng() { return __pieceEng; } };`);
      const env = run(audio, bus, ctx, eng, false, 1, { createEngine: () => { const e = engine(); made.push(e); return e; } }, {});
      const state = bus.createBusState({ reactions: [] }, []);
      bus.processEvents(state, [{ type: 'music:sorrow' }]);
      expect(env.piece).toBe('sorrow');
      expect(eng.stopped).toBe(1);
      expect(made).toHaveLength(1);
      expect(made[0].started).toBe(1);
      expect(made[0].master.gain.ramps.at(-1)).toBeCloseTo(0.9, 6);
      // (the same mood again: nothing)
      bus.processEvents(state, [{ type: 'music:sorrow' }]);
      expect(made).toHaveLength(1);
      bus.processEvents(state, [{ type: 'music:place' }]);
      expect(env.piece).toBe(null);
      expect(made[0].master.gain.ramps.at(-1)).toBe(0);
      vi.advanceTimersByTime(2000);
      expect(made[0].stopped).toBe(1);
      expect(eng.started).toBe(1);
    } finally { vi.useRealTimers(); }
  });
});
