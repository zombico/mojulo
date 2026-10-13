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

  it('every instrument\'s jobs follow from what it is: a kit only the kit, the bass from D2 down, a pad from a sustain', () => {
    for (const [name, c] of Object.entries(CASTING)) {
      const roles = rolesFor(name);
      if (c.env === 'kit') { expect(roles, name).toEqual(['kit']); continue; }
      expect(roles.includes('ground'), name).toBe(!!c.low && midiOf(c.low) <= 38);
      expect(roles.includes('pad'), name).toBe(c.env === 'sustain');
      for (const r of ['colour', 'lead', 'brass', 'motion']) expect(roles, name).toContain(r);
    }
  });
});

describe('readCast and castAdvice', () => {
  it('refuses exactly what cannot work: a kit on a pitched job, a pitched voice as the kit, a job or name that is not', () => {
    for (const [name, c] of Object.entries(CASTING)) for (const job of CAST_ROLES) {
      const fits = job === 'kit' ? c.env === 'kit' : c.env !== 'kit';
      const read = () => readCast({ [job]: job === 'lead' ? [name, name] : name });
      if (fits) expect(read, `${job} ${name}`).not.toThrow();
      else expect(read, `${job} ${name}`).toThrow(new RegExp(name));
    }
    expect(() => readCast({ drums: 'drum-kit' })).toThrow(new RegExp(`the jobs: ${CAST_ROLES.join(', ')}`));
    expect(() => readCast({ lead: 'kazoo' })).toThrow(/'kazoo'/);
    expect(() => readCast({ lead: ['flute-3', 'oboe-3', 'erhu'] })).toThrow(/lead/);
    expect(readCast({ lead: 'erhu' })).toEqual({ lead: ['erhu', 'erhu'] });
  });

  it('advises exactly the castings that do not fit their job, naming the job and the instrument', () => {
    const other = (n) => (n === 'oboe-3' ? 'flute-3' : 'oboe-3');   // two different leads, so only the fit is advised
    for (const [name, c] of Object.entries(CASTING)) for (const job of CAST_ROLES) {
      if (job === 'kit' || c.env === 'kit') continue;
      const advice = castAdvice({ [job]: job === 'lead' ? [name, other(name)] : name });
      expect(advice.length === 0, `${job} ${name}`).toBe(rolesFor(name).includes(job));
      for (const line of advice) { expect(line).toContain(job); expect(line).toContain(name); }
    }
    expect(castAdvice({ lead: 'erhu' }).join()).toContain('erhu');   // one voice answering itself is named
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
