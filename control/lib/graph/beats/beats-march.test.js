import { describe, expect, it } from 'vitest';

import { renderBeatsOffline } from './beats-render.js';
import { validateBeatsManifest, normalizeBeatsManifest } from './beats-manifest.js';
import { expandBeatsManifest, roleOf, BANDS } from './beats-authoring.js';
import { decodeWav, rms } from './audio-measure.js';

// Battle and march principles as vocabulary — the machine gates. Every name
// here is opt-in (a rhythm, a voicing mode, a groove style, a fill, a band);
// beats-render.baseline.test.js pins that recipes without them render
// byte-identical. None of this is an ears gate.

const comp = (parts, extra = {}) => ({ kind: 'beats-composition', title: 'march probe', bpm: 120, seed: 7, parts, ...extra });
const norm = (m) => {
  const v = validateBeatsManifest(m);
  if (!v.ok) throw new Error(v.errors.join('\n'));
  return normalizeBeatsManifest(m);
};
const expand = (m) => expandBeatsManifest(norm(m));
const errorsOf = (m) => validateBeatsManifest(m).errors || [];

describe('rhythms and the pedal (chart voicing)', () => {
  it('dotted: the long-short pair on every beat; dotted-quarter: the long-short pair on every half', () => {
    const at = (rhythm) => expand(comp([{ name: 'b', instrument: 'trumpet', chordVoice: 'root', rhythm }], { key: 'C', progression: ['C'] })).parts[0].events.map((e) => e[0]);
    expect(at('dotted')).toEqual([0, 0.75, 1, 1.75, 2, 2.75, 3, 3.75]);
    expect(at('dotted-quarter')).toEqual([0, 1.5, 2, 3.5]);
  });

  it('pedal holds the tonic under any chord; pedal-5 holds the fifth', () => {
    const notes = (mode, key) => expand(comp([{ name: 'b', instrument: 'contrabass', chordVoice: mode }], { key, progression: ['i', 'iv', 'bII', 'bVII'] })).parts[0].events.map((e) => e[1]);
    expect(notes('pedal', 'Cm')).toEqual(['C2', 'C2', 'C2', 'C2']);
    expect(notes('pedal-5', 'Cm')).toEqual(['G2', 'G2', 'G2', 'G2']);
    expect(notes('pedal', 'F#m')).toEqual(['F#2', 'F#2', 'F#2', 'F#2']);
  });

  it('the pedal follows a key change and its own octave', () => {
    const ev = expand(comp([{ name: 'b', instrument: 'contrabass', chordVoice: 'pedal', octave: 1 }], { key: 'C', progression: ['I', 'IV', 'I', 'V'], modulate: [{ at: '2:0:0', semitones: 4 }] })).parts[0].events;
    expect(ev.map((e) => e[1])).toEqual(['C1', 'C1', 'E1', 'E1']);
  });

  it('a pedal without a key teaches', () => {
    const errs = errorsOf(comp([{ name: 'b', instrument: 'contrabass', chordVoice: 'pedal' }], { progression: ['Cm', 'Db'] }));
    expect(errs.some((e) => /holds the key's tonic.*set the recipe's `key`/.test(e))).toBe(true);
  });
});

describe('the march grooves and the rudiment fills', () => {
  const bar = (groove, instrument = 'orchestral-perc') => expand(comp([{ name: 'dr', instrument, groove }])).parts[0].events;

  it('march: bass drum on every beat, the snare cadence with pickups; only kick and snare notes', () => {
    const ev = bar({ style: 'march', bars: 1 });
    expect(ev.filter((e) => e[1] === 'C2').map((e) => e[0])).toEqual([0, 1, 2, 3]);
    expect(ev.filter((e) => e[1] === 'D2').map((e) => e[0])).toEqual([0, 0.75, 1, 1.5, 1.75, 2, 2.75, 3, 3.5, 3.75]);
    expect(new Set(ev.map((e) => e[1]))).toEqual(new Set(['C2', 'D2']));
  });

  it('processional: a slow tread with a two-stroke pickup into the next bar', () => {
    const ev = bar({ style: 'processional', bars: 1 });
    expect(ev.filter((e) => e[1] === 'C2').map((e) => e[0])).toEqual([0, 2]);
    expect(ev.filter((e) => e[1] === 'D2').map((e) => e[0])).toEqual([1, 3, 3.5, 3.75]);
  });

  it('the march family fills with rudiments; long-roll swells over the whole bar', () => {
    const ev = bar({ style: 'march', bars: 4, fills: 'every-4' });
    const last = ev.filter((e) => e[0] >= 12);
    const rudiment = ev.filter((e) => e[0] >= 14 && e[0] < 16);
    expect(rudiment.length).toBeGreaterThan(0);
    expect(last.every((e) => e[1] === 'C2' || e[1] === 'D2')).toBe(true);
    const roll = bar({ style: 'processional', bars: 1, fills: 'section', fill: 'long-roll' });
    const sn = roll.filter((e) => e[1] === 'D2');
    expect(sn.length).toBe(32);
    expect(sn[31][3]).toBeGreaterThan(sn[0][3]); // a crescendo
  });

  it('each rudiment has its shape', () => {
    const fill = (fill) => bar({ style: 'march', bars: 1, fills: 'section', fill }).filter((e) => e[1] === 'D2');
    const para = fill('paradiddle').filter((e) => e[0] >= 2);
    expect(para.length).toBe(8);
    expect(para[0][3]).toBeGreaterThan(para[1][3]); // the first of each four accented
    const drag = fill('drag').filter((e) => e[0] >= 1.9);
    expect(drag.length).toBe(12); // two grace strokes into each of four eighths
    const five = fill('five-stroke').filter((e) => e[0] >= 3);
    expect(five.map((e) => e[0])).toEqual([3, 3.125, 3.25, 3.375, 3.5]);
    expect(five[4][3]).toBeGreaterThan(five[3][3]);
  });

  it('a rock kit plays the march too; unknown styles and fills still teach', () => {
    expect(bar({ style: 'march', bars: 1 }, 'drum-kit').length).toBeGreaterThan(10);
    const errs = errorsOf(comp([{ name: 'dr', instrument: 'orchestral-perc', groove: { style: 'polka', bars: 1, fill: 'flamacue' } }]));
    expect(errs.some((e) => /style must be one of: .*march, processional/.test(e))).toBe(true);
    expect(errs.some((e) => /fill must be one of: .*paradiddle, drag, five-stroke, long-roll/.test(e))).toBe(true);
  });
});

describe('the orchestra as a band', () => {
  it('woodwinds and timpani have roles; harp stays with the strings, the bassoon with the bass', () => {
    expect(roleOf({ instrument: 'flute' })).toBe('woodwind');
    expect(roleOf({ instrument: 'oboe' })).toBe('woodwind');
    expect(roleOf({ instrument: 'bassoon' })).toBe('bass');
    expect(roleOf({ instrument: 'timpani' })).toBe('timpani');
    expect(roleOf({ instrument: 'harp' })).toBe('strings');
  });

  it('orchestra-battle and orchestra-processional: one hall, sustained sections wet, percussion and bass dry', () => {
    const parts = [
      { name: 'vn', instrument: 'violin', events: [[0, 'C5']] },
      { name: 'hn', instrument: 'french-horn', events: [[0, 'G3']] },
      { name: 'fl', instrument: 'flute', events: [[0, 'E5']] },
      { name: 'ti', instrument: 'timpani', events: [[0, 'C2']] },
      { name: 'pc', instrument: 'orchestral-perc', events: [[0, 'D2']] },
    ];
    for (const band of ['orchestra-battle', 'orchestra-processional']) {
      const x = expand(comp(parts, { band }));
      const send = (n) => x.parts.find((p) => p.name === n).send;
      expect(x.room, band).toEqual(BANDS[band].room);
      expect(send('vn'), band).toBeGreaterThan(send('ti'));
      expect(send('hn'), band).toBeGreaterThan(send('pc'));
      expect(send('fl'), band).toBeGreaterThan(send('pc'));
      expect(x.parts.some((p) => /~double$/.test(p.name)), band).toBe(false);
    }
    // the processional's hall is longer and wetter.
    expect(BANDS['orchestra-processional'].room.decay).toBeGreaterThan(BANDS['orchestra-battle'].room.decay);
  });

  it('a woodwind or timpani part under an existing band is untouched (no such role there)', () => {
    const x = expand(comp([{ name: 'fl', instrument: 'flute', events: [[0, 'E5']] }], { band: 'anime-rock' }));
    expect(x.parts[0].send).toBeUndefined();
    expect(x.parts[0].pan).toBeUndefined();
  });
});

describe('a march renders (machine gate only)', () => {
  it('a battle-band march with a pedal and a dotted brass call renders non-silent and deterministic', async () => {
    const m = comp([
      { name: 'snare', instrument: 'orchestral-perc', groove: { style: 'march', bars: 2, fills: 'section' } },
      { name: 'bass', instrument: 'contrabass', chordVoice: 'pedal' },
      { name: 'horns', instrument: 'french-horn', chordVoice: 'chord', rhythm: 'dotted' },
    ], { bpm: 140, key: 'Cm', progression: ['i', 'bII'], band: 'orchestra-battle' });
    const a = await renderBeatsOffline(norm(m), { tail: 0.3 });
    const b = await renderBeatsOffline(norm(m), { tail: 0.3 });
    expect(a.wav.equals(b.wav)).toBe(true);
    const { channels } = decodeWav(a.wav);
    expect(rms(channels[0])).toBeGreaterThan(0.005);
  });
});

describe('open country: the drone, the lilt, the travel groove, the pastoral band', () => {
  it('drone holds the open fifth on the key whatever the chart does', () => {
    const ev = expand(comp([{ name: 'd', instrument: 'cello', chordVoice: 'drone' }], { key: 'D', progression: ['I', 'bVII', 'IV', 'I'] })).parts[0].events;
    expect(ev.map((e) => e[1])).toEqual([['D2', 'A2'], ['D2', 'A2'], ['D2', 'A2'], ['D2', 'A2']]);
    const errs = errorsOf(comp([{ name: 'd', instrument: 'cello', chordVoice: 'drone' }], { progression: ['D', 'C'] }));
    expect(errs.some((e) => /holds the key's tonic and fifth/.test(e))).toBe(true);
  });

  it('lilt: quarter-eighth, quarter-eighth in every 6/8 bar', () => {
    const ev = expand(comp([{ name: 'h', instrument: 'harp', chordVoice: 'root', rhythm: 'lilt' }], { meter: '6/8', key: 'D', progression: ['I', 'IV'] })).parts[0].events;
    expect(ev.map((e) => e[0])).toEqual([0, 1, 1.5, 2.5, 3, 4, 4.5, 5.5]);
  });

  it('travel: a soft bass drum and a triangle, nothing else; a rock kit keeps only the bass drum', () => {
    const ev = expand(comp([{ name: 'p', instrument: 'orchestral-perc', groove: { style: 'travel', bars: 2 } }])).parts[0].events;
    expect(ev.length).toBe(6);
    expect(Math.max(...ev.map((e) => e[3]))).toBeLessThan(0.5);
    const six = expand(comp([{ name: 'p', instrument: 'orchestral-perc', groove: { style: 'travel', bars: 1 } }], { meter: '6/8' })).parts[0].events;
    expect(six.filter((e) => e[1] === 'C2').map((e) => e[0])).toEqual([0, 1.5]);
    const rock = expand(comp([{ name: 'p', instrument: 'drum-kit', groove: { style: 'travel', bars: 1 } }])).parts[0].events;
    expect(rock.map((e) => e[1])).toEqual(['C2', 'C2']);
  });

  it('orchestra-pastoral: the woodwind lead forward, the strings a quiet distant pad', () => {
    const x = expand(comp([
      { name: 'fl', instrument: 'flute', events: [[0, 'A5']] },
      { name: 'vn', instrument: 'violin', events: [[0, 'D4']] },
      { name: 'pc', instrument: 'orchestral-perc', events: [[0, 'C2']] },
    ], { band: 'orchestra-pastoral' }));
    const p = (n) => x.parts.find((q) => q.name === n);
    expect(p('vn').send).toBeGreaterThan(p('fl').send);
    expect(p('vn').trim).toBeLessThan(-5);
    expect(p('fl').trim).toBeUndefined(); // 0 dB: the lead
    expect(p('pc').trim).toBeLessThan(p('vn').trim);
  });
});
