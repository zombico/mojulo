import { describe, it, expect } from 'vitest';
import { SFX_PALETTES, SFX_PALETTE_NAMES, SFX_CUE_IDS, MECHANIC_SFX, paletteCues, paletteForIdentity, levelSfx } from './sfx-palettes.js';
import { validateBeatsManifest } from './beats-manifest.js';
import { scoreIdentity } from './field-score.js';
import { midiOf } from './beats-authoring.js';
import { resolveWorldAudio } from './beats-world.js';
import { MECHANIC_KINDS, composeMechanics } from '../game/mechanics.js';
import { getMechanicVocabCatalog } from '../game/mechanic-cards/loader.js';
import { PALETTES } from './field-score.js';

// ── a mechanic's events, from the real thing: each mechanic card's own example, composed into a winnable level ───
// (a reach-exit beside it; the producers a mechanic needs; the parameter that turns a race's rivals on). A mechanic
// whose card carries no example uses FIXTURE until it gains one.
const FIXTURE = { push: { kind: 'push', origin: [0, 0, 0], cols: 4, rows: 4, blocks: [[1, 1]], plates: [[2, 2]] } };
const EXAMPLES = (() => {
  const out = { ...FIXTURE };
  for (const c of getMechanicVocabCatalog().values()) {
    const m = /```json\n([\s\S]*?)```/.exec(c.body);
    if (!m) continue;
    let parsed; try { parsed = JSON.parse(m[1]); } catch { continue; }
    for (const x of Array.isArray(parsed) ? parsed : [parsed]) if (x && MECHANIC_KINDS.includes(x.kind)) out[x.kind] = x;
  }
  return out;
})();
const WITH = { crops: ['clock'], 'defeat-all': ['hp-pool'] };
const TURN_ON = { laps: { rivals: ['rival-1'] } };
// what a level with this mechanic can hear: the events it emits (reactions, watches, timers, sequences), the events
// its reactions listen for (facts such as hit:<id>), and the outcomes its contract ends on
function surfaced(kind) {
  const exit = { kind: 'reach-exit', at: [30, 0, 0] };
  const list = [{ ...EXAMPLES[kind], ...(TURN_ON[kind] || {}) }, ...(WITH[kind] || []).map((k) => EXAMPLES[k]), ...(kind === 'reach-exit' ? [] : [exit])];
  const r = composeMechanics(list);
  const out = new Set(Object.keys(r.on || {}));
  const walk = (o, key) => {
    if (Array.isArray(o)) return o.forEach((x) => walk(x, key));
    if (!o || typeof o !== 'object' || key === 'sources' || key === 'hud' || key === 'entities') return;
    if (typeof o.type === 'string' && (o.do === 'emit' || key === 'watches' || key === 'timers' || key === 'sequences')) out.add(o.type);
    if (typeof o.on === 'string' && key === 'reactions') out.add(o.on);
    for (const [k, v] of Object.entries(o)) walk(v, k);
  };
  walk(r.events, 'events');
  return { events: [...out].filter((t) => !t.startsWith('__')), outcomes: Object.keys(r.on || {}) };
}
const globMatch = (pat, t) => (pat === '*' ? true : pat.includes('*') ? new RegExp(`^${pat.split('*').map((x) => x.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`).test(t) : pat === t);

describe('sfx palettes', () => {
  it('every palette names the same cues, each valid and warning-free in any key', () => {
    for (const name of SFX_PALETTE_NAMES) {
      expect(Object.keys(SFX_PALETTES[name]).sort(), name).toEqual([...SFX_CUE_IDS].sort());
      for (const id of [undefined, 0, 3, 777, 4242]) {
        const v = validateBeatsManifest({ kind: 'beats-sfx', title: name, cues: paletteCues(name, id) });
        expect([...v.errors, ...(v.warnings || [])], `${name} ${id}`).toEqual([]);
      }
    }
  });

  it("the game's tonic moves every pitched gesture together (−5 … +6), and nothing else", () => {
    const id = scoreIdentity(31);
    const k = ((id.tonic + 5) % 12) - 5;
    const base = paletteCues('arcade'), moved = paletteCues('arcade', id);
    expect(midiOf(moved.jump[0].from) - midiOf(base.jump[0].from)).toBe(k);
    expect(midiOf(moved.pickup[1].to) - midiOf(base.pickup[1].to)).toBe(k);
    expect(moved.step).toEqual(base.step);   // noise has no key
    for (let seed = 0; seed < 40; seed++) { const t = scoreIdentity(seed).tonic, kk = ((t + 5) % 12) - 5; expect(kk).toBeGreaterThanOrEqual(-5); expect(kk).toBeLessThanOrEqual(6); }
  });

  it('every band a score identity can roll implies a palette that exists; no identity is arcade', () => {
    expect(paletteForIdentity(null)).toBe('arcade');
    for (const flavour of Object.keys(PALETTES)) expect(SFX_PALETTE_NAMES, flavour).toContain(paletteForIdentity({ flavour }));
  });

  it('every wired mechanic is a mechanic, and every cue it names is in the palettes', () => {
    for (const [kind, rows] of Object.entries(MECHANIC_SFX)) {
      expect(MECHANIC_KINDS, kind).toContain(kind);
      for (const cue of Object.values(rows)) expect(SFX_CUE_IDS, `${kind} → ${cue}`).toContain(cue);
    }
  });

  it('every mechanic has an example to hear (its card, or the fixture until its card carries one)', () => {
    expect(MECHANIC_KINDS.filter((k) => !EXAMPLES[k])).toEqual([]);
  });

  it('every row is an event its mechanic can surface: nothing is wired to a sound that never fires', () => {
    for (const [kind, rows] of Object.entries(MECHANIC_SFX)) {
      const { events } = surfaced(kind);
      for (const glob of Object.keys(rows)) expect(events.some((t) => globMatch(glob, t)), `${kind}: '${glob}' among ${events.join(', ')}`).toBe(true);
    }
  });

  it("every outcome a mechanic's contract ends on is heard: no level is won or lost in silence", () => {
    for (const kind of MECHANIC_KINDS) {
      const { outcomes } = surfaced(kind);
      const on = levelSfx({ mechanics: [kind, 'reach-exit'] }).on;
      for (const t of outcomes) expect(Object.keys(on).some((g) => globMatch(g, t)), `${kind}: outcome '${t}' has no cue`).toBe(true);
    }
  });
});

describe('levelSfx', () => {
  it("wires exactly the rows of the level's own mechanics, first row first, and nothing for a mechanic it lacks", () => {
    expect(levelSfx({ mechanics: [] }).on).toEqual({});
    for (const a of MECHANIC_KINDS) for (const b of MECHANIC_KINDS) {
      const on = levelSfx({ mechanics: [a, b] }).on;
      const expected = {};
      for (const k of [a, b]) for (const [g, c] of Object.entries(MECHANIC_SFX[k] || {})) if (!(g in expected)) expected[g] = c;
      expect(on, `${a} + ${b}`).toEqual(expected);
    }
  });

  it('the gait, weapon, melee and dodge sounds come from the same palette', () => {
    const L = levelSfx({ palette: 'foley' });
    expect(L.footsteps).toEqual({ step: L.cues.step, jump: L.cues.jump, land: L.cues.land });
    expect(L.weapon.shot).toBe(L.cues.shoot);
    expect(L.strike).toEqual({ swing: L.cues.swing, hit: L.cues.strike });
  });
});

describe("audio.sfx: 'auto' on a world", () => {
  it("resolves to the palette the soundtrack's identity implies, in its key, wired to the level's mechanics", () => {
    const a = resolveWorldAudio({ soundtrack: { score: { mood: 'forest', game: 4410 } }, sfx: 'auto' }, { ref: 'lv-1', mechanics: ['collect', 'door'] });
    const L = levelSfx({ identity: 4410, mechanics: ['collect', 'door'] });
    expect(a.palette).toBe(paletteForIdentity(scoreIdentity(4410)));
    expect(a.cues).toEqual(L.cues);
    expect(a.on).toEqual({ 'pickup:*': 'pickup', 'door:*': 'door' });
    expect(a.vary).toBe(true);
    expect(a.footsteps).toEqual(L.footsteps);
  });

  it('with no field score it is arcade in C; a named palette, written rows and cues win', () => {
    expect(resolveWorldAudio({ sfx: 'auto' }, { mechanics: [] }).palette).toBe('arcade');
    const own = [{ type: 'ring', note: 'C6', material: 'glass', decay: 0.3 }];
    const a = resolveWorldAudio({ sfx: { auto: 'synth', cues: { pickup: own, ping: own }, on: { 'pickup:gem': 'ping' }, vary: false }, footsteps: true }, { mechanics: ['collect'] });
    expect(a.palette).toBe('synth');
    expect(a.cues.pickup).toEqual(own);
    expect(Object.keys(a.on)).toEqual(['pickup:gem', 'pickup:*']);   // the written row first: it wins the match
    expect(a.vary).toBeUndefined();
    expect(a.footsteps.step).not.toEqual(levelSfx({ palette: 'synth' }).cues.step);   // footsteps: true keeps its own defaults
  });

  it('teaches an unknown palette, a bare string', () => {
    expect(() => resolveWorldAudio({ sfx: { auto: 'kazoo' } })).toThrow(/the palettes: arcade, foley, orchestral, synth/);
    expect(() => resolveWorldAudio({ sfx: 'loud' })).toThrow(/audio.sfx is 'auto'/);
  });
});
