import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { CASTING, CAST_ROLES, rolesFor, readCast, castAdvice } from './casting.js';
import { INSTRUMENTS } from './instruments.js';
import { kitOf, expandBeatsManifest, midiOf } from './beats-authoring.js';
import { fieldScore, SCORE_MOODS } from './field-score.js';
import { fieldGates } from './field-gates.js';
import { parseFieldSpec, fieldCue } from './field-cue.js';
import { normalizeBeatsManifest } from './beats-manifest.js';

const SEEDS = Array.from({ length: 24 }, (_, i) => i * 7919 + 3);

describe('the casting table', () => {
  it('covers the shelf exactly, and its kits are the kits', () => {
    expect(Object.keys(CASTING).sort()).toEqual(Object.keys(INSTRUMENTS).sort());
    for (const name of Object.keys(INSTRUMENTS)) expect(CASTING[name].env === 'kit', name).toBe(!!kitOf({ instrument: name }));
  });

  it('every instrument is named in the beats-casting card', () => {
    const card = readFileSync(new URL('./beats-vocab/beats-casting.md', import.meta.url), 'utf8');
    for (const name of Object.keys(CASTING)) expect(card, name).toContain(`\`${name}\``);
  });

  it('a kit plays only the kit; the bass needs the low end; a pad a sustain', () => {
    expect(rolesFor('drum-machine-909')).toEqual(['kit']);
    expect(rolesFor('contrabass-3')).toContain('ground');
    expect(rolesFor('acid-bass')).toContain('ground');
    expect(rolesFor('flute-3')).not.toContain('ground');
    expect(rolesFor('organ')).toContain('pad');
    expect(rolesFor('harp-2')).not.toContain('pad');
  });
});

describe('readCast and castAdvice', () => {
  it('refuses what cannot work, by name', () => {
    expect(() => readCast({ drums: 'drum-kit' })).toThrow(new RegExp(`the jobs: ${CAST_ROLES.join(', ')}`));
    expect(() => readCast({ lead: 'kazoo' })).toThrow(/'kazoo' is not on the shelf/);
    expect(() => readCast({ kit: 'flute-3' })).toThrow(/not a kit/);
    expect(() => readCast({ ground: 'drum-machine-909' })).toThrow(/is a kit/);
    expect(() => readCast({ lead: ['flute-3', 'oboe-3', 'erhu'] })).toThrow(/one instrument or \[first, second\]/);
    expect(readCast({ lead: 'erhu' })).toEqual({ lead: ['erhu', 'erhu'] });
  });

  it('advises what will sound wrong', () => {
    expect(castAdvice({ ground: 'contrabass-3', pad: 'viola-3', lead: ['flute-3', 'oboe-3'] })).toEqual([]);
    const a = castAdvice({ ground: 'flute-3', pad: 'harp-2', lead: 'erhu' });
    expect(a.join('\n')).toMatch(/ground 'flute-3' reaches down only to C4/);
    expect(a.join('\n')).toMatch(/pad 'harp-2' does not hold a note/);
    expect(a.join('\n')).toMatch(/both leads are 'erhu'/);
  });
});

describe('a cast changes the voices and nothing else', () => {
  const CAST = { colour: 'shamisen', ground: 'contrabass-3', lead: ['erhu', 'flute-3'], brass: 'french-horn-3', pad: 'viola-3', motion: 'cello-3', kit: 'orchestral-perc' };

  it('the same key, tempo, chart and rhythm; the cast instruments in their jobs', () => {
    for (const mood of ['plains', 'highlands', 'tension', 'battle']) for (const seed of SEEDS.slice(0, 6)) {
      const plain = fieldScore(mood, { seed, identity: 7 }), cast = fieldScore(mood, { seed, identity: 7, cast: CAST });
      expect([cast.key, cast.bpm, cast.progression], `${mood} ${seed}`).toEqual([plain.key, plain.bpm, plain.progression]);
      // the octave doubling joins only where its instrument's range fits: a different brass may add or drop it
      const names = (m) => m.parts.map((p) => p.name).filter((n) => n !== 'double');
      expect(names(cast)).toEqual(names(plain));
      const by = Object.fromEntries(cast.parts.map((p) => [p.name, p.instrument]));
      expect(by.ground).toBe('contrabass-3');
      if (by.leadB) expect([by.leadA, by.leadB].filter((x) => x !== 'french-horn-3').every((x) => ['erhu', 'flute-3'].includes(x))).toBe(true);
      if (by.perc) expect(by.perc).toBe('orchestral-perc');
      if (SCORE_MOODS[mood].energy === 'idyllic') expect(by.colour).toBe('shamisen');
      else expect(by.motion).toBe('cello-3');
    }
  });

  it('keeps the field principles for a sound cast, over many seeds', () => {
    for (const mood of ['plains', 'forest', 'highlands', 'expedition', 'tension', 'battle', 'victory', 'defeat']) for (const seed of SEEDS) {
      expect(fieldGates(fieldScore(mood, { seed, cast: CAST }), SCORE_MOODS[mood].energy), `${mood} ${seed}`).toEqual([]);
    }
  });

  it('an unranged synth bass cast as the ground sits in the bass', () => {
    const m = expandBeatsManifest(normalizeBeatsManifest(fieldScore('highlands', { seed: 42, identity: 7, cast: { ground: 'acid-bass' } })));
    const ground = m.parts.find((p) => p.name === 'ground');
    const lowest = Math.min(...ground.events.flatMap((e) => (Array.isArray(e[1]) ? e[1] : [e[1]]).map(midiOf)));
    expect(lowest).toBeLessThan(48);
  });

  it('rides a field spec: parsed, stored, and lowered by fieldCue', () => {
    const p = parseFieldSpec({ score: { mood: 'forest', seed: 3, game: 9, cast: { lead: 'erhu' } } });
    expect(p.cast).toEqual({ lead: ['erhu', 'erhu'] });
    expect(fieldCue(p).parts.find((x) => x.name === 'leadA').instrument).toBe('erhu');
    expect(() => parseFieldSpec({ score: { mood: 'forest', cast: { lead: 'kazoo' } } })).toThrow(/not on the shelf/);
  });
});
