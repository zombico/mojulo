// THE CARDS IN GODOT (since kernel 0.31.0): what the page draws as additive camera-facing sprites travels in score.json
// for kernel/level.gd to draw: the fixtures' glows, the game sfx layers (their beads moved by kernel/sfx.gd, held equal
// to the web's verb shelf by the sprites corpus) and the UI language's states and gestures (score.fx).
import { describe, it, expect } from 'vitest';
import { extractEngineScore } from './engine-score.js';
import { corpus, runSprites, scenarioById, SCENARIOS } from './sprites-conformance.js';
import { runCorpus } from './engines/runners.js';
import { compare } from './engines/conformance.js';
import { SPRITE_VERB_IDS } from '../game/glyph-sfx-sprites.js';

const GODOT = process.env.MOJULO_GODOT;
const quad = (z = 3) => [[0, 0, z], [1, 0, z], [1, 1, z], [0, 1, z]];
const lamp = { corners: quad(), fill: '#ffcc66', glow: '0 0 28px 9px rgba(255,204,102,0.8)' };
const score = (payload, engine) => extractEngineScore({ ref: 'r', manifest: {} }, payload, engine ? { engine } : {});

describe('the cards a Godot level draws', () => {
  it('a fixture\'s glow as the page collects it, unless the payload turns glow off; none for an engine that draws none', () => {
    const s = score({ faces: [lamp, { corners: quad(0), fill: '#888888' }], glow: { scale: 2, opacity: 0.5 } });
    expect(s.glows).toHaveLength(1);
    expect(s.glows[0]).toMatchObject({ pos: [0.5, 0.5, 3], opacity: 0.5 });
    expect(s.glows[0].color.map((c) => Math.round(c * 255))).toEqual([255, 204, 102]);
    expect(s.glows[0].size).toBeCloseTo((2.5 + 37 / 11) * 2, 9);
    expect(score({ faces: [lamp], glow: false })).not.toHaveProperty('glows');
    expect(score({ faces: [lamp] }).glows[0].opacity).toBe(0.95);
    expect(score({ faces: [lamp] }, 'unity')).not.toHaveProperty('glows');
  });

  it('the game sfx layers and the UI language ride as data; a level with neither carries no key', () => {
    const spriteSfx = [{ verb: 'sparkle', cc: [8, 11, 0], color: [1, 0.95, 0.7], rate: 1, size: 0.6, params: {} }, { verb: 'nope' }];
    const fx = { states: { coin: 'float' }, on: { 'pk_*': { gesture: 'burst', target: 'coin' } } };
    const s = score({ spriteSfx, fx });
    expect(s.spriteSfx).toEqual([spriteSfx[0]]);
    expect(s.fx).toEqual(fx);
    const none = score({ faces: [] });
    for (const k of ['glows', 'spriteSfx', 'fx']) expect(none).not.toHaveProperty(k);
  });

  it('the sprites corpus reads every verb, and a tuned one, at a run of clock readings', () => {
    expect(SCENARIOS.filter((s) => !s.id.endsWith('-tuned')).map((s) => s.verb)).toEqual(SPRITE_VERB_IDS);
    // a sparkle twinkles: some reading draws a card the one before hid
    const snaps = runSprites(scenarioById('sprites-sparkle')).map((x) => JSON.parse(x).cards);
    expect(snaps.some((c, i) => i > 0 && c.some((x, k) => x && !snaps[i - 1][k]))).toBe(true);
  });

  it.skipIf(!GODOT)('kernel/sfx.gd moves every bead as the web\'s verbs do (MOJULO_GODOT)', () => {
    const sc = corpus();
    const { out, errors } = runCorpus('godot', 'sprites', sc, { bin: GODOT });
    expect(errors).toEqual([]);
    expect(compare('sprites', sc, out).filter((r) => !r.equal)).toEqual([]);
  }, 600000);

  const PLANTS = [
    { name: 'a heal wound the wrong pitch', from: 'var a := s * 12.566 + float(w) * PI', to: 'var a := s * 12.567 + float(w) * PI' },
    { name: 'a sparkle scattered elsewhere', from: 'return _frac(sin(a * 12.9898 + b * 78.233) * 43758.5453)', to: 'return _frac(sin(a * 12.9898 + b * 78.233) * 43758.545)' },
    { name: 'a beacon stacked a step short', from: 'var u := float(k) / float(n - 1)', to: 'var u := float(k) / float(n)' },
    { name: 'a faint card drawn', from: 'if not (b is Dictionary) or float(b["w"]) < 0.05:', to: 'if not (b is Dictionary) or float(b["w"]) < 0.06:' },
    { name: 'a ward ring flattened', from: 'o.append(_bead(x + ring * cos(a), y + 0.22 * sin(a * 3.0)', to: 'o.append(_bead(x + ring * cos(a), y + 0.21 * sin(a * 3.0)' },
  ];
  it.skipIf(!GODOT)('every planted bug in the verbs is caught by the corpus (MOJULO_GODOT)', () => {
    const sc = corpus();
    for (const p of PLANTS) {
      const { out } = runCorpus('godot', 'sprites', sc, { bin: GODOT, mutate: [{ file: 'sfx.gd', from: p.from, to: p.to }] });
      expect(compare('sprites', sc, out).some((r) => !r.equal), p.name).toBe(true);
    }
  }, 900000);
});
