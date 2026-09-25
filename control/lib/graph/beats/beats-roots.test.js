import { describe, expect, it } from 'vitest';

import { renderBeatsOffline } from './beats-render.js';
import { validateBeatsManifest, normalizeBeatsManifest } from './beats-manifest.js';
import { expandBeatsManifest } from './beats-authoring.js';
import { decodeWav, pitchHz, bandEnergy, rms, centroid, peak } from './audio-measure.js';
import { beatsFeatures } from './beats-features.js';
import { INSTRUMENTS } from './instruments.js';

// Roots styles (country, blues, the guitar soloist) — the machine gates, phase
// by phase. Every behavior here is opt-in (a new field, groove style, voicing,
// articulation or instrument); beats-render.baseline.test.js pins that recipes
// without them render byte-identical. None of this is an ears gate.

const comp = (parts, extra = {}) => ({ kind: 'beats-composition', title: 'roots probe', bpm: 120, seed: 7, parts, ...extra });
const norm = (m) => {
  const v = validateBeatsManifest(m);
  if (!v.ok) throw new Error(v.errors.join('\n'));
  return normalizeBeatsManifest(m);
};
const expand = (m) => expandBeatsManifest(norm(m));
const frac = (q) => Math.round((q - Math.floor(q)) * 1e4) / 1e4;

describe('phase 1 — the shuffle feel (pure)', () => {
  const eighths = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5].map((q) => [q, 'C4', 0.5, 0.8]);

  it('gate: at shuffle 1 the offbeat eighth lands on the triplet (2/3 of the beat), downbeats stay', () => {
    const ev = expand(comp([{ name: 'p', instrument: 'grand-piano', events: eighths }], { shuffle: 1 })).parts[0].events;
    expect(ev.filter((_, i) => i % 2 === 0).map((e) => frac(e[0]))).toEqual([0, 0, 0, 0]);
    expect(ev.filter((_, i) => i % 2 === 1).map((e) => frac(e[0]))).toEqual([0.6667, 0.6667, 0.6667, 0.6667]);
    // a held note still meets the next one: the long-short triplet pair.
    expect(ev[0][2]).toBeCloseTo(2 / 3, 5);
    expect(ev[1][2]).toBeCloseTo(1 / 3, 5);
    // at 120 bpm the offbeat is 333.3 ms after the beat (±1 ms), not 250.
    expect(Math.abs((ev[1][0] - ev[0][0]) * 500 - 333.33)).toBeLessThan(1);
  });

  it('a lazy swing sits between; shuffle: false keeps a part straight; kits and phrases swing too', () => {
    const m = comp([
      { name: 'p', instrument: 'grand-piano', events: eighths },
      { name: 'o', instrument: 'organ', shuffle: false, events: eighths },
      { name: 'r', instrument: 'rhodes', form: [{ phrase: 'lick', at: '1:0:0' }] },
    ], { shuffle: 0.6, phrases: { lick: [[0, 'E4', 0.5], [0.5, 'G4', 0.5]] } });
    const x = expand(m);
    expect(frac(x.parts[0].events[1][0])).toBe(0.6);
    expect(x.parts[1].events.map((e) => e[0])).toEqual(eighths.map((e) => e[0]));
    expect(x.parts[1].shuffle).toBeUndefined();
    const id = x.parts[2].form[0].phrase;
    expect(id).toMatch(/~shuffle600$/);
    expect(frac(x.phrases[id][1][0])).toBe(0.6);
    expect(x.phrases.lick[1][0]).toBe(0.5); // the shared phrase is untouched
    expect(x.shuffle).toBeUndefined();
  });

  it('gate: shuffle 0 changes nothing; a shuffled score renders byte-identical to its expansion', async () => {
    const straight = comp([{ name: 'p', instrument: 'grand-piano', events: eighths }]);
    expect(JSON.stringify(expand({ ...straight, shuffle: 0 }).parts)).toBe(JSON.stringify(norm(straight).parts));
    const m = comp([{ name: 'p', instrument: 'grand-piano', events: eighths }, { name: 'dr', instrument: 'drum-kit', groove: { style: 'shuffle', bars: 1 } }], { shuffle: 1 });
    const lit = { ...comp(expand(m).parts) };
    const a = await renderBeatsOffline(norm(m), { tail: 0.3 });
    const b = await renderBeatsOffline(norm(lit), { tail: 0.3 });
    expect(a.wav.equals(b.wav)).toBe(true);
  });

  it('the shuffle grooves swing on their own (a full triplet) unless the part or the entry says otherwise', () => {
    const hats = (g, extra = {}) => expand(comp([{ name: 'dr', instrument: 'drum-kit', groove: g, ...extra }])).parts[0].events.filter((e) => e[1] === 'F#2').map((e) => frac(e[0]));
    expect(hats({ style: 'shuffle', bars: 1 })).toEqual([0, 0.6667, 0, 0.6667, 0, 0.6667, 0, 0.6667]);
    expect(hats({ style: 'shuffle', bars: 1, shuffle: 0.6 })).toEqual([0, 0.6, 0, 0.6, 0, 0.6, 0, 0.6]);
    expect(hats({ style: 'shuffle', bars: 1 }, { shuffle: false })).toEqual([0, 0.5, 0, 0.5, 0, 0.5, 0, 0.5]);
    // a straight groove stays straight unless a shuffle is asked for.
    expect(hats({ style: 'eight-beat', bars: 1 })).toEqual([0, 0.5, 0, 0.5, 0, 0.5, 0, 0.5]);
  });

  it('the new grooves have their signatures', () => {
    const bar = (style, extra = {}) => expand(comp([{ name: 'dr', instrument: 'drum-kit', groove: { style, bars: 1 } }], extra)).parts[0].events;
    const at = (ev, note) => ev.filter((e) => e[1] === note).map((e) => Math.round(e[0] * 1e4) / 1e4);
    expect(at(bar('shuffle-boogie'), 'C2')).toEqual([0, 1, 2, 3]); // kick on every beat
    const train = bar('train');
    expect(at(train, 'D2')).toHaveLength(16);
    expect(train.filter((e) => e[1] === 'D2' && e[3] > 0.8).map((e) => e[0])).toEqual([1, 3]); // the backbeat
    expect(at(bar('two-beat'), 'C#2')).toEqual([1, 3]); // the cross-stick on 2 and 4
    expect(at(bar('two-beat'), 'C2')).toEqual([0, 2]);
    // 12/8: twelve eighths on the ride, the backbeat on the 2nd and 4th dotted beats.
    const slow = bar('slow-twelve-eight', { meter: '12/8' });
    expect(at(slow, 'D#3')).toHaveLength(12);
    expect(at(slow, 'D2')).toEqual([1.5, 4.5]);
  });

  it('fills: the shuffle family plays triplet fills; the straight grooves keep their old seeded picks', () => {
    const fills = (style, seed, extra = {}) => expand(comp([{ name: 'dr', instrument: 'drum-kit', groove: { style, bars: 8, fills: 'every-2', seed } }], extra)).parts[0].events;
    const trip = expand(comp([{ name: 'dr', instrument: 'drum-kit', groove: { style: 'shuffle', bars: 2, fills: 'every-2', fill: 'triplet' } }])).parts[0].events.filter((e) => e[0] >= 6);
    expect([...new Set(trip.map((e) => frac(e[0])))].sort()).toEqual([0, 0.3333, 0.6667]);
    // a straight triplet fill (no swing) places true triplets.
    const straightTrip = expand(comp([{ name: 'dr', instrument: 'drum-kit', groove: { style: 'eight-beat', bars: 2, fills: 'every-2', fill: 'triplet' } }])).parts[0].events.filter((e) => e[0] >= 6 && e[1] !== 'F#2');
    expect([...new Set(straightTrip.map((e) => frac(e[0])))].sort()).toEqual([0, 0.3333, 0.6667]);
    // the straight pool is the original five: no seed ever picks a triplet there.
    for (let seed = 0; seed < 40; seed++) {
      const ev = fills('eight-beat', seed);
      expect(ev.some((e) => frac(e[0]) === 0.3333 || frac(e[0]) === 0.6667)).toBe(false);
    }
  });

  it('validation teaches the shuffle', () => {
    const errs = (m) => validateBeatsManifest(m).errors.join('\n');
    expect(errs(comp([{ name: 'p', instrument: 'grand-piano', events: eighths }], { shuffle: 2 }))).toMatch(/shuffle must be in \[0, 1\]/);
    expect(errs(comp([{ name: 'p', instrument: 'grand-piano', shuffle: 'yes', events: eighths }]))).toMatch(/shuffle must be false \(play straight\) or in \[0, 1\]/);
    expect(errs(comp([{ name: 'dr', instrument: 'drum-kit', groove: { style: 'slow-twelve-eight', bars: 1 } }]))).toMatch(/set meter: '12\/8'/);
    expect(errs({ kind: 'beats-pattern', title: 'p', bpm: 120, seed: 1, shuffle: 1, tracks: [{ name: 'a', instrument: 'drum-kit', notes: ['C2'], mask: [1] }] })).toMatch(/shuffle is a beats-composition field/);
  });
});

describe('phase 2 — bass lines and comping voices (pure)', () => {
  const midi = (n) => { const m = /^([A-G])(#?)(-?\d+)$/.exec(n); return (Number(m[3]) + 1) * 12 + { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] ? 1 : 0); };
  const TWELVE = [{ chords: 'A7 D7 A7 A7 D7 D7 A7 A7 E7 D7 A7 E7' }];
  const part = (p, extra = {}) => expand(comp([{ name: 'b', instrument: 'picked-bass', ...p }], { key: 'A', progression: TWELVE, ...extra })).parts[0].events;

  it('root-fifth: the boom-chick alternates root and fifth; walkup steps into each new root', () => {
    const ev = part({ chordVoice: 'root-fifth', bars: [0, 2] });
    expect(ev.map((e) => e[1])).toEqual(['A2', 'E2', 'D3', 'A2']); // A up a fourth to D: the nearest octave
    const up = expand(comp([{ name: 'b', instrument: 'picked-bass', chordVoice: 'root-fifth', walkup: true }], { key: 'G', progression: ['G', 'C'] })).parts[0].events;
    // G … then A, B stepping up into C (two quarters in G major), then C.
    expect(up.map((e) => e[1])).toEqual(['G2', 'A2', 'B2', 'C3', 'G2']);
    expect(up.map((e) => e[0])).toEqual([0, 2, 3, 4, 6]);
  });

  it('gate: walk — every chord starts on its root, the last beat approaches the next root by a step, the line stays in the bass', () => {
    for (const seed of [1, 2, 3]) {
      const ev = expand(comp([{ name: 'b', instrument: 'picked-bass', chordVoice: 'walk' }], { key: 'A', progression: TWELVE, seed })).parts[0].events;
      expect(ev).toHaveLength(48);
      const roots = TWELVE[0].chords.split(' ').map((c) => ({ A7: 9, D7: 2, E7: 4 })[c]);
      for (let b = 0; b < 12; b++) {
        const bar = ev.filter((e) => e[0] >= b * 4 && e[0] < b * 4 + 4).map((e) => midi(e[1]));
        expect(bar[0] % 12).toBe(roots[b]);
        if (b < 11) {
          const nextRoot = ev.find((e) => e[0] === (b + 1) * 4)[1];
          expect(Math.abs(bar[3] - midi(nextRoot))).toBeLessThanOrEqual(2);
        }
        for (const x of bar) { expect(x).toBeGreaterThanOrEqual(28); expect(x).toBeLessThanOrEqual(55); }
      }
    }
    const line = (seed) => expand(comp([{ name: 'b', instrument: 'picked-bass', chordVoice: 'walk' }], { key: 'A', progression: TWELVE, seed })).parts[0].events.map((e) => e[1]).join(' ');
    expect(line(5)).toBe(line(5));
    expect(line(5)).not.toBe(line(6));
  });

  it('boogie, boogie-walk, roll, pompe, rasgueado and pima have their shapes', () => {
    const one = (p) => expand(comp([{ name: 'x', instrument: 'rock-guitar', ...p }], { progression: ['A7'] })).parts[0].events;
    expect(one({ chordVoice: 'boogie' }).map((e) => e[1].join('+'))).toEqual(['A2+E3', 'A2+E3', 'A2+F#3', 'A2+F#3', 'A2+G3', 'A2+G3', 'A2+F#3', 'A2+F#3']);
    expect(one({ chordVoice: 'boogie-walk' }).map((e) => e[1])).toEqual(['A2', 'C#3', 'E3', 'F#3', 'G3', 'F#3', 'E3', 'C#3']);
    expect(one({ chordVoice: 'roll' }).map((e) => e[1])).toEqual(['A3', 'C#4', 'A4', 'E4', 'C#4', 'A4', 'E4', 'A4']);
    const pompe = one({ chordVoice: 'pompe' });
    expect(pompe.map((e) => e[1].length)).toEqual([3, 5, 3, 5]);
    expect(pompe[1][3]).toBeGreaterThan(pompe[0][3]); // the backbeat is the accent
    expect(pompe[1][2]).toBeLessThanOrEqual(0.18); // choked
    const ras = one({ chordVoice: 'rasgueado', strokes: 5, rhythm: 'whole' });
    expect(ras.map((e) => Math.round(e[0] * 1e4) / 1e4)).toEqual([0, 0.0833, 0.1667, 0.25, 0.3333]);
    expect(ras[4][3]).toBeGreaterThan(ras[0][3]);
    expect(one({ chordVoice: 'pima' }).map((e) => e[1]).slice(0, 6)).toEqual(['A2', 'A3', 'C#4', 'E4', 'C#4', 'A3']);
  });

  it('validation teaches walkup and strokes', () => {
    const errs = (p) => validateBeatsManifest(comp([{ name: 'x', instrument: 'picked-bass', ...p }], { progression: ['A'] })).errors.join('\n');
    expect(errs({ chordVoice: 'walk', walkup: true })).toMatch(/walkup is true \| false on a chordVoice: 'root-fifth'/);
    expect(errs({ chordVoice: 'rasgueado', strokes: 9 })).toMatch(/strokes is 3–5/);
    expect(errs({ strokes: 4, events: [] })).toMatch(/strokes belongs to a chart-voicing part/);
  });
});

describe('phase 3 — the soloist (pure) and the new articulations', () => {
  const midi = (n) => { const m = /^([A-G])(#?)(-?\d+)$/.exec(n); return (Number(m[3]) + 1) * 12 + { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] ? 1 : 0); };
  const BLUES = [{ chords: 'I7 I7 I7 I7 IV7 IV7 I7 I7 V7 IV7 I7 V7', repeat: 2 }];
  const song = (style, extra = {}, part = {}) => comp([{ name: 'lead', instrument: 'lead-guitar', solo: { style, bars: [0, 24] }, ...part }],
    { key: 'A', progression: BLUES, seed: 3, ...extra });
  const solo = (m) => expand(m).parts[0].events;
  const notesOf = (e) => (Array.isArray(e.n) ? e.n : [e.n]).map(midi);
  const CHORD = { 0: [9, 1, 4, 7], 5: [2, 6, 9, 0], 7: [4, 8, 11, 2] }; // A7, D7, E7 as pitch classes
  const barChord = [0, 0, 0, 0, 5, 5, 0, 0, 7, 5, 0, 7];

  it('gate: strong beats land on chord tones (≥ 0.7), nothing outside the scale or the chord, it ends home', () => {
    for (const style of ['blues', 'country', 'virtuoso-rock', 'classical']) {
      for (const seed of [1, 2, 3]) {
        const key = style === 'virtuoso-rock' || style === 'classical' ? 'Am' : 'A';
        const ev = solo(song(style, { key, progression: key === 'Am' ? [{ chords: 'i iv V7 i', repeat: 6 }] : BLUES, seed }));
        const chordPcs = (q) => { const b = Math.floor(q / 4); return key === 'Am' ? [[9, 0, 4], [2, 5, 9], [4, 8, 11, 2], [9, 0, 4]][b % 4] : CHORD[barChord[b % 12]]; };
        const strong = ev.filter((e) => Math.abs(e.at - Math.round(e.at)) < 1e-6 && !(e.art && typeof e.art === 'object' && ['bend', 'dive'].includes(e.art.type)) && e.art !== 'pm');
        const ok = strong.filter((e) => notesOf(e).every((x) => chordPcs(e.at).includes(x % 12)));
        expect(ok.length / strong.length).toBeGreaterThanOrEqual(0.7);
        const SC = { blues: [0, 3, 5, 6, 7, 10], country: [0, 2, 4, 7, 9], 'virtuoso-rock': [0, 2, 3, 5, 7, 8, 10], classical: [0, 2, 3, 5, 7, 8, 11] }[style];
        for (const e of ev) for (const x of notesOf(e)) {
          const rel = (x - 9 + 120) % 12;
          expect(SC.includes(rel) || chordPcs(e.at).includes(x % 12)).toBe(true);
        }
        // home when the chord under the ending holds it (Am: A or C); the 24-bar blues
        // ends on its turnaround E7, so the solo lands on E or G# there.
        const end = midi(ev[ev.length - 1].n) % 12;
        expect(key === 'Am' ? [9, 0] : [4, 8]).toContain(end);
      }
    }
  });

  it('gate: the build arc gets denser and higher from the first quarter to the last; repeatable; compact', () => {
    let denser = 0, higher = 0;
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const ev = solo(song('virtuoso-rock', { seed })).slice(0, -1); // the held ending aside
      const quarter = (a, b) => ev.filter((e) => e.at >= a * 96 / 4 && e.at < b * 96 / 4);
      const first = quarter(0, 1), last = quarter(3, 4);
      const mean = (l) => l.reduce((s, e) => s + notesOf(e)[0], 0) / Math.max(1, l.length);
      if (last.length > first.length) denser++;
      if (mean(last) > mean(first)) higher++;
    }
    expect(denser).toBeGreaterThanOrEqual(5);
    expect(higher).toBeGreaterThanOrEqual(5);
    const a = JSON.stringify(solo(song('blues', { seed: 9 }))), b = JSON.stringify(solo(song('blues', { seed: 9 })));
    expect(a).toBe(b);
    expect(a).not.toBe(JSON.stringify(solo(song('blues', { seed: 10 }))));
    const m = song('blues');
    const lit = comp(expand(m).parts, {});
    expect(JSON.stringify(norm(m)).length).toBeLessThan(JSON.stringify(lit).length / 10);
  });

  it('each style keeps its grid: classical metrical (≥ a sixteenth), virtuoso and flamenco allow bursts, gypsy jazz swings under a shuffle', () => {
    const gaps = (ev) => { const t = [...new Set(ev.map((e) => e.at))].sort((x, y) => x - y); return t.slice(1).map((x, i) => x - t[i]); };
    const classical = solo(song('classical', { key: 'Am', progression: [{ chords: 'i iv V7 i', repeat: 6 }] }, { instrument: 'nylon-guitar' }));
    expect(Math.min(...gaps(classical))).toBeGreaterThanOrEqual(0.25 - 1e-6);
    expect(Math.min(...gaps(solo(song('virtuoso-rock', { key: 'Am', progression: [{ chords: 'i bVI bVII i', repeat: 6 }] }))))).toBeLessThan(0.25);
    const gypsy = solo(song('gypsy-jazz', { key: 'Am', shuffle: 0.6, progression: [{ chords: 'i6 i6 iv6 iv6 V7 V7 i6 i6', repeat: 3 }] }));
    const offs = gypsy.filter((e) => Math.abs(frac(e.at) - 0.6) < 1e-3);
    expect(offs.length).toBeGreaterThan(0);
    expect(gypsy.some((e) => Math.abs(frac(e.at) - 0.5) < 1e-6)).toBe(false); // no straight offbeat eighth survives
  });

  it('a fiddle or an organ gets the arts it can play: hammer/pull glide, pluck-only arts drop', () => {
    const ev = solo(song('virtuoso-rock', { key: 'Am', progression: [{ chords: 'i bVI bVII i', repeat: 6 }] }, { instrument: 'violin-2' }));
    const types = new Set(ev.map((e) => (typeof e.art === 'string' ? e.art : e.art && e.art.type)).filter(Boolean));
    for (const t of ['hammer', 'pull', 'tap', 'nat', 'pm', 'harm', 'rake']) expect(types.has(t)).toBe(false);
  });

  it('rake and rest lower to plain events', () => {
    const ev = expand(comp([{ name: 'g', instrument: 'lead-guitar', events: [{ at: 1, n: 'E5', d: 1, v: 0.8, art: { type: 'rake', n: 3, vib: 20 } }, [2, 'A4', 1, 0.7, 'rest']] }])).parts[0].events;
    expect(ev.filter((e) => e.art === 'pm').map((e) => e.at)).toEqual([0.8125, 0.875, 0.9375]);
    expect(ev.find((e) => e.n === 'E5').art).toEqual({ type: 'vib', depth: 20 });
    const rest = ev.find((e) => e.n === 'A4' && e.at === 2);
    expect(rest.art).toBe('tenuto');
    expect(rest.v).toBeCloseTo(0.77, 6);
  });

  it('validation teaches the solo', () => {
    const errs = (solo, extra = {}) => validateBeatsManifest(comp([{ name: 'l', instrument: 'lead-guitar', solo }], { key: 'A', progression: ['A7'], ...extra })).errors.join('\n');
    expect(errs({ style: 'polka', bars: 4 })).toMatch(/solo.style must be one of: blues, country, virtuoso-rock, classical, flamenco, gypsy-jazz/);
    expect(errs({ style: 'blues', bars: 4, scale: 'klezmer' })).toMatch(/solo.scale must be 'auto' or one of/);
    expect(errs({ style: 'blues', bars: 4, licks: ['nope'] })).toMatch(/solo.licks must be a list from/);
    expect(errs({ style: 'blues', bars: 4 }, { progression: undefined })).toMatch(/solo plays over the chart/);
  });
});

describe('phase 3 — hammer-on, pull-off and the natural harmonic (kernel, anthem region)', () => {
  const SR = 44100;
  const one = async (events, instrument) => {
    const r = await renderBeatsOffline(norm(comp([{ name: 'g', instrument, events }])), { tail: 0.3, bitDepth: 32 });
    return decodeWav(r.wav).channels[0];
  };
  // the pick's signature: 4–12 kHz attack energy, the loudest 512-sample window
  // just after the onset against the loudest in the 70 ms before it (dB).
  const attack = (y, t) => {
    let before = 0, after = 0;
    for (let k = 1; k <= 6; k++) before = Math.max(before, bandEnergy(y, SR, Math.round((t - 0.012 * k - 0.012) * SR), 512, 4000, 12000));
    for (let k = 0; k < 6; k++) after = Math.max(after, bandEnergy(y, SR, Math.round((t - 0.004 + 0.006 * k) * SR), 512, 4000, 12000));
    return 10 * Math.log10(after / before);
  };

  it('gate: a hammer-on or pull-off sounds no pick (≥ 10 dB less attack than a picked note) and lands on its pitch', async () => {
    for (const inst of ['lead-guitar', 'nylon-guitar']) {
      const picked = await one([[0, 'E4', 0.5, 0.8], [0.5, 'G4', 1, 0.8]], inst);
      const ham = await one([[0, 'E4', 0.5, 0.8], [0.5, 'G4', 1, 0.8, 'hammer']], inst);
      const pull = await one([[0, 'G4', 0.5, 0.8], [0.5, 'E4', 1, 0.8, 'pull']], inst);
      expect(attack(picked, 0.25) - attack(ham, 0.25)).toBeGreaterThanOrEqual(10);
      expect(attack(picked, 0.25) - attack(pull, 0.25)).toBeGreaterThanOrEqual(10);
      expect(Math.abs(1200 * Math.log2(pitchHz(ham, SR, Math.round(0.32 * SR), 4096, 392) / 392))).toBeLessThan(10);
      expect(Math.abs(1200 * Math.log2(pitchHz(pull, SR, Math.round(0.32 * SR), 4096, 329.63) / 329.63))).toBeLessThan(10);
    }
  });

  it('gate: a natural harmonic sounds the k-th partial (±1 %)', async () => {
    for (const k of [2, 3, 4]) {
      const y = await one([[0, 'E3', 2, 0.8, { type: 'nat', k }]], 'nylon-guitar');
      const f = pitchHz(y, SR, Math.round(0.15 * SR), 4096, 164.81 * k);
      expect(Math.abs(f / (164.81 * k) - 1)).toBeLessThan(0.01);
    }
  });
});

describe('phase 4 — the roots instruments, the wah, the rotary and the band templates', () => {
  const SR = 44100;
  const render = async (parts, extra = {}) => {
    const r = await renderBeatsOffline(norm(comp(parts, extra)), { tail: 0.3, bitDepth: 32 });
    return decodeWav(r.wav).channels;
  };
  const env = (y, win) => { const w = Math.round(win * SR), out = []; for (let i = 0; i + w <= y.length; i += w) out.push(rms(y, i, i + w)); return out; };

  it('every roots instrument plays (audible, finite) and a kit keeps to its pieces', async () => {
    const plays = { 'twang-guitar': ['E4', 'G4'], 'crunch-guitar': ['A2', 'E3'], 'pedal-steel': ['E4', 'B4'], banjo: ['G3', 'D4'], harmonica: ['C5', 'E5'], 'upright-bass': ['A1', 'E2'], fiddle: ['A4', 'E5'], 'organ-rotary': ['C4', 'E4'], 'classical-guitar': ['E3', 'B3'], 'flamenco-guitar': ['E3', 'B3'], 'gypsy-jazz-guitar': ['A3', 'C4'], 'brush-kit': ['D2', 'C2', 'C#2'], 'blues-kit': ['D2', 'C2'], palmas: ['D#2', 'E2', 'C#2'] };
    for (const [inst, notes] of Object.entries(plays)) {
      expect(INSTRUMENTS[inst], inst).toBeTruthy();
      const [L] = await render([{ name: 'x', instrument: inst, events: notes.map((n, i) => [i * 0.5, n, 0.5, 0.8]) }]);
      expect(peak(L), inst).toBeGreaterThan(0.02);
      expect(peak(L), inst).toBeLessThan(1);
      expect(L.every(Number.isFinite), inst).toBe(true);
    }
    expect(validateBeatsManifest(comp([{ name: 'p', instrument: 'palmas', events: [[0, 'D2', 1, 0.8]] }])).errors.join('\n')).toMatch(/has no drum-kit piece/);
  });

  it('gate: the pedal steel swells (≥ 150 ms to its peak); the twang slapback repeats at 110 ± 2 ms', async () => {
    const [L] = await render([{ name: 's', instrument: 'pedal-steel', events: [[0, 'E4', 4, 0.8]] }]);
    const e = env(L, 0.005).slice(0, 400);
    expect(e.indexOf(Math.max(...e)) * 5).toBeGreaterThanOrEqual(150);
    const ev = [[0, 'E4', 0.1, 0.9]];
    const [a] = await render([{ name: 's', patch: 'guitarTwang', events: ev }]);
    const [b] = await render([{ name: 's', patch: 'guitarTwang', chain: INSTRUMENTS['twang-guitar'].chain.filter((f) => f.type === 'delay'), events: ev }]);
    const on = a.findIndex((x) => Math.abs(x) > 1e-4), echo = b.findIndex((x, i) => Math.abs(x - a[i]) > 1e-4);
    expect(Math.abs((echo - on) / SR * 1000 - 110)).toBeLessThanOrEqual(2);
  });

  it('gate: the wah follows the playing (centroid correlates with level)', async () => {
    const evs = Array.from({ length: 16 }, (_, k) => [k * 0.5, 'E3', 0.5, 0.15 + k * 0.05]);
    const [L] = await render([{ name: 'w', instrument: 'electric-clean', chain: [{ type: 'wah' }], events: evs }]);
    const xs = [], ys = [];
    for (let k = 0; k < 16; k++) { const i = Math.round((k * 0.25 + 0.06) * SR); xs.push(rms(L, i, i + 2048)); ys.push(centroid(L, SR, i, 2048)); }
    const mean = (v) => v.reduce((a, b) => a + b) / v.length, mx = mean(xs), my = mean(ys);
    const r = xs.reduce((s, x, k) => s + (x - mx) * (ys[k] - my), 0) / Math.sqrt(xs.reduce((s, x) => s + (x - mx) ** 2, 0) * ys.reduce((s, y) => s + (y - my) ** 2, 0));
    expect(r).toBeGreaterThan(0.5);
    expect(ys[15]).toBeGreaterThan(ys[0] * 1.3);
  });

  it('gate: the rotary spins at its speeds (horn 6.7 / 0.83 Hz, drum 5.9 / 0.67 Hz, ±5 %)', async () => {
    const am = async (note, speed) => {
      const [L, R] = await render([{ name: 'o', patch: 'organ', patchParams: { wave: 'sine', unison: 1, detune: 0 }, chain: [{ type: 'rotary', speed }], events: [[0, note, 16, 0.8]] }]);
      const y = L.map((x, i) => x + R[i]);
      const e = env(y.subarray ? y.subarray(Math.round(0.5 * SR), Math.round(7.5 * SR)) : y.slice(Math.round(0.5 * SR), Math.round(7.5 * SR)), 0.005);
      const m = e.reduce((a, b) => a + b) / e.length, z = e.map((x) => x - m);
      let best = 0, bf = 0;
      for (let f = 0.3; f <= 10; f += 0.01) { let re = 0, im = 0; for (let k = 0; k < z.length; k++) { const ph = 2 * Math.PI * f * k * 0.005; re += z[k] * Math.cos(ph); im += z[k] * Math.sin(ph); } if (re * re + im * im > best) { best = re * re + im * im; bf = f; } }
      return bf;
    };
    for (const [note, speed, want] of [['C7', 'fast', 6.7], ['C7', 'slow', 0.83], ['C4', 'fast', 5.9], ['C4', 'slow', 0.67]]) {
      expect(Math.abs((await am(note, speed)) / want - 1), `${note} ${speed}`).toBeLessThan(0.05);
    }
  });

  it('wah and rotary ride the anthem slice; a page without them carries none of it', () => {
    const f = (chain) => beatsFeatures(norm(comp([{ name: 'o', instrument: 'organ', ...(chain ? { chain } : {}), events: [[0, 'C4', 1]] }])));
    expect(f([{ type: 'rotary' }])).toContain('anthem');
    expect(f([{ type: 'wah' }])).toContain('anthem');
    expect(f(null)).not.toContain('anthem');
    expect(beatsFeatures(norm(comp([{ name: 'o', instrument: 'organ-rotary', events: [[0, 'C4', 1]] }])))).toContain('anthem');
  });

  it('the band templates: country, blues, soloist, nylon — the soloist leads, blues and nylon do not double-track', () => {
    const parts = [
      { name: 'rhythm', instrument: 'acoustic-guitar', events: [[0, 'E3']] },
      { name: 'lead', instrument: 'nylon-guitar', solo: { style: 'flamenco', bars: 2 } },
      { name: 'bass', instrument: 'upright-bass', events: [[0, 'E2']] },
    ];
    for (const band of ['country', 'blues', 'soloist', 'nylon']) {
      const x = expand(comp(parts, { band, key: 'E', progression: ['Am', 'E'] }));
      const lead = x.parts.find((p) => p.name === 'lead');
      expect(lead.send, band).toBeGreaterThan(x.parts.find((p) => p.name === 'rhythm').send); // the lead role, though its patch is a comping nylon
      expect(x.parts.some((p) => p.name === 'rhythm~double'), band).toBe(band === 'country' || band === 'soloist');
      expect(x.room, band).toBeTruthy();
    }
  });

  it('validation teaches the wah and the rotary', () => {
    const errs = (chain) => validateBeatsManifest(comp([{ name: 'o', instrument: 'organ', chain, events: [[0, 'C4', 1]] }])).errors.join('\n');
    expect(errs([{ type: 'rotary', speed: 'warp' }])).toMatch(/speed must be 'slow' \(chorale\) or 'fast'/);
    expect(errs([{ type: 'wah', at: 2 }])).toMatch(/at must be in \[0, 1\]/);
  });
});
