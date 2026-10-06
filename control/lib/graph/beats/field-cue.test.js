// field-cue: the field score as a callable (worlds, create_beats) and as a suggestion (compose_world).
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach } from 'vitest';
import { parseFieldSpec, mintFieldSpec, fieldCue, seedOfRef, suggestFieldScore, FIELD_ROLES } from './field-cue.js';
import { fieldScore, scoreIdentity, SCORE_MOODS } from './field-score.js';
import { resolveWorldAudio } from './beats-world.js';
import { closeDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { createBeatsHandler } from '@/lib/mcp/tools/beats';
import { composeWorld } from '@/lib/mcp/tools/compose-world';

beforeEach(() => { closeDb(); });

describe('parseFieldSpec', () => {
  it('reads the short form, the score object and the bare inner object', () => {
    expect(parseFieldSpec('field:plains')).toEqual({ mood: 'plains' });
    expect(parseFieldSpec({ score: { mood: 'forest', seed: 3, game: 9, role: 'travel' } })).toEqual({ mood: 'forest', seed: 3, game: 9, role: 'travel' });
    expect(parseFieldSpec({ mood: 'desert' })).toEqual({ mood: 'desert' });
  });

  it('passes every other soundtrack form through as null', () => {
    expect(parseFieldSpec('default')).toBeNull();
    expect(parseFieldSpec({ beatsRef: 'x' })).toBeNull();
    expect(parseFieldSpec({ kind: 'beats-ambient', mood: 'x' })).toBeNull();
    expect(parseFieldSpec(undefined)).toBeNull();
  });

  it('teaches on a bad mood, seed or role, and sends battle roles elsewhere', () => {
    expect(() => parseFieldSpec('field:swamp')).toThrow(/the moods: plains/);
    expect(() => parseFieldSpec({ score: { mood: 'plains', seed: -1 } })).toThrow(/non-negative integer/);
    expect(() => parseFieldSpec({ score: { mood: 'plains', role: 'boss' } })).toThrow(/battle music/);
    expect(() => parseFieldSpec({ score: { mood: 'plains', role: 'lobby' } })).toThrow(new RegExp(FIELD_ROLES.join(', ')));
  });
});

describe('seeds', () => {
  it('mints fresh seeds only where missing, and different ones each time', () => {
    const a = mintFieldSpec({ mood: 'plains' }, { game: true });
    const b = mintFieldSpec({ mood: 'plains' }, { game: true });
    expect(Number.isInteger(a.seed) && Number.isInteger(a.game)).toBe(true);
    expect([a.seed, a.game]).not.toEqual([b.seed, b.game]);
    expect(mintFieldSpec({ mood: 'plains', seed: 5 })).toEqual({ mood: 'plains', seed: 5 });
  });

  it('a ref gives a stable non-negative integer seed, distinct across refs', () => {
    expect(seedOfRef('world-a')).toBe(seedOfRef('world-a'));
    expect(seedOfRef('world-a')).not.toBe(seedOfRef('world-b'));
    expect(Number.isInteger(seedOfRef('x')) && seedOfRef('x') >= 0).toBe(true);
  });

  it('fieldCue is fieldScore with the game as identity', () => {
    expect(fieldCue({ mood: 'plains', seed: 11, game: 4 })).toEqual(fieldScore('plains', { seed: 11, identity: scoreIdentity(4) }));
    expect(fieldCue({ mood: 'plains' }, { fallbackSeed: 11 })).toEqual(fieldScore('plains', { seed: 11 }));
    expect(() => fieldCue({ mood: 'plains' })).toThrow(/needs a seed/);
  });
});

describe('world soundtrack', () => {
  it("'field:<mood>' resolves to a looping composition seeded by the world's ref", () => {
    const a = resolveWorldAudio({ soundtrack: 'field:highlands' }, { ref: 'w1' }).soundtrack;
    const b = resolveWorldAudio({ soundtrack: 'field:highlands' }, { ref: 'w2' }).soundtrack;
    expect(a.kind).toBe('beats-composition');
    expect(a.loop).toBe(true);
    expect(resolveWorldAudio({ soundtrack: 'field:highlands' }, { ref: 'w1' }).soundtrack).toEqual(a);
    expect(b).not.toEqual(a);
  });

  it('a stored seed wins over the ref', () => {
    const spec = { soundtrack: { score: { mood: 'plains', seed: 42, game: 7 } } };
    expect(resolveWorldAudio(spec, { ref: 'w1' })).toEqual(resolveWorldAudio(spec, { ref: 'w2' }));
  });

  it('an unknown soundtrack string teaches the forms', () => {
    expect(() => resolveWorldAudio({ soundtrack: 'jazz' })).toThrow(/field:<mood>/);
  });
});

describe('create_beats score', () => {
  it('mints a field cue with fresh seeds, stores its provenance and says how to keep the identity', async () => {
    const r = await createBeatsHandler({ title: 'Meadow', score: { mood: 'plains' } });
    expect(r.ok).toBe(true);
    expect(r.energy).toBe('idyllic');
    expect(Number.isInteger(r.score.seed) && Number.isInteger(r.score.game)).toBe(true);
    expect(r.next).toContain(String(r.score.game));
    const stored = SketchRepository.getByRef(r.ref).manifest;
    expect(stored.kind).toBe('beats-composition');
    expect(stored.score).toEqual(r.score);
  });

  it('given seeds, replays exactly; two fresh calls differ', async () => {
    const a = await createBeatsHandler({ title: 'A', score: { mood: 'wayfarer', seed: 9, game: 3 } });
    const b = await createBeatsHandler({ title: 'A', score: { mood: 'wayfarer', seed: 9, game: 3 } });
    const strip = (m) => { const { title, ...rest } = m; return rest; };
    expect(strip(SketchRepository.getByRef(a.ref).manifest)).toEqual(strip(SketchRepository.getByRef(b.ref).manifest));
    const c = await createBeatsHandler({ title: 'C', score: { mood: 'wayfarer' } });
    const d = await createBeatsHandler({ title: 'D', score: { mood: 'wayfarer' } });
    expect(c.score).not.toEqual(d.score);
  });

  it('refuses score with params or another kind, and a bad mood points at the manual', async () => {
    await expect(createBeatsHandler({ title: 'x', score: { mood: 'plains' }, params: {} })).rejects.toThrow(/score OR params/);
    await expect(createBeatsHandler({ title: 'x', kind: 'beats-pattern', score: { mood: 'plains' } })).rejects.toThrow(/beats-composition/);
    await expect(createBeatsHandler({ title: 'x', score: { mood: 'tundra' } })).rejects.toThrow(/beats-field-orchestra/);
  });
});

// a small painted landscape (the terrain tests' fixture)
const LAND = { title: 'meadow', heartbeat: 'gentle-roughness', splatch: 'verdure-trio', seed: 'ct' };

describe('compose_world', () => {
  it("stores a fresh seed for 'field:<mood>' so each world differs, and asks for no suggestion", () => {
    const a = composeWorld({ base: 'painted-landscape', overrides: { ...LAND, audio: { soundtrack: 'field:plains' } } });
    const b = composeWorld({ base: 'painted-landscape', overrides: { ...LAND, audio: { soundtrack: 'field:plains' } } });
    const sa = SketchRepository.getByRef(a.ref).manifest.audio.soundtrack.score;
    const sb = SketchRepository.getByRef(b.ref).manifest.audio.soundtrack.score;
    expect(sa.mood).toBe('plains');
    expect(Number.isInteger(sa.seed)).toBe(true);
    expect(sa.seed).not.toBe(sb.seed);
    expect(a.music).toBeUndefined();
  });

  it('suggests a field score for an outdoor world with no audio, and stays quiet for a city', () => {
    const t = composeWorld({ base: 'painted-landscape', overrides: LAND });
    expect(t.music.suggest).toEqual({ soundtrack: `field:${t.music.mood}` });
    expect(t.music.mood).toBe('plains');
    expect(t.music.how).toContain('beats-field-orchestra');
    expect(composeWorld({ base: 'city', seed: 3 }).music).toBeUndefined();
  });
});

describe('suggestFieldScore', () => {
  it('reads the words of a world', () => {
    expect(suggestFieldScore({ base: 'painted-landscape', theme: 'desert-dunes' }).mood).toBe('desert');
    expect(suggestFieldScore({ base: 'controllable', title: 'Mountain pass' }).mood).toBe('highlands');
    expect(suggestFieldScore({ base: 'dungeon' }).mood).toBe('expedition');
    expect(suggestFieldScore({ base: 'historic', title: 'the old town' }).role).toBe('town');
    expect(suggestFieldScore({ base: 'terrain', time: 'night' }).mood).toBe('forest');
    expect(suggestFieldScore({ base: 'math' })).toBeNull();
  });
});
