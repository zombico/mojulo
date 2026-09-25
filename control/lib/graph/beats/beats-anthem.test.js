import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { buildBeatsKernel, sliceKernelText } from './beats-kernel.js';
import { renderBeatsOffline, renderBeatsPlan } from './beats-render.js';
import { validateBeatsManifest, normalizeBeatsManifest } from './beats-manifest.js';
import { expandBeatsManifest, parseChord, voiceChord, nameOf, distance } from './beats-authoring.js';
import { beatsFeatures } from './beats-features.js';
import { decodeWav, rms, peak, pitchHz, t60, bandEnergy, centroid, magnitudeSpectrum } from './audio-measure.js';

// Anthem styles — the machine gates, phase by phase. Every behavior here is
// opt-in (a new field, gesture, articulation, patch or model name);
// beats-render.baseline.test.js pins that recipes without them render
// byte-identical. None of this is an ears gate: nobody listened here.

const K = buildBeatsKernel();
const SR = 44100;
const comp = (parts, extra = {}) => ({ kind: 'beats-composition', title: 'anthem probe', bpm: 120, seed: 7, parts, ...extra });
const norm = (m) => {
  const v = validateBeatsManifest(m);
  if (!v.ok) throw new Error(v.errors.join('\n'));
  return normalizeBeatsManifest(m);
};
async function render(manifest, opts = {}) {
  const r = await renderBeatsOffline(norm(manifest), { tail: 0.5, ...opts });
  return { ...decodeWav(r.wav), wav: r.wav, meta: r.meta };
}

describe('the slices before anthem styles are untouched', () => {
  it('the era-all page kernel (every pre-anthem feature on) is byte for byte the orchestra-and-era kernel', () => {
    // pinned from 2aede88's kernel with every feature on: the anthem regions,
    // all off, must leave that text exactly as it was.
    const t = readFileSync(new URL('./beats-kernel.js', import.meta.url), 'utf8');
    const text = sliceKernelText(t.slice(t.indexOf('function buildBeatsKernel()'), t.lastIndexOf('}') + 1), (f) => f !== 'anthem');
    expect(createHash('sha256').update(text).digest('hex')).toBe('23eb1333de88e3aeb0fa29865614968cc5d3b49ecaa4518736ef0e2f1d478ba9');
  });
});

describe('phase 0 — composition cue parts', () => {
  const HIT = [{ type: 'thump', from: 'C2', to: 'C1', decay: 0.4 }, { type: 'burst', decay: 0.2, vol: 0.5 }];

  it('gate: a cue part renders byte-identical to the same gestures fired from a pattern track at the same times', async () => {
    const pattern = { kind: 'beats-pattern', title: 'p', bpm: 120, seed: 7, steps: 16, tracks: [{ name: 'fx', cue: HIT, vary: true, mask: [1, 0, 0, 0, 0.7, 0, 0, 0, 0.9, 0, 0, 0, 0.5, 0, 0, 0] }] };
    const composition = comp([{ name: 'fx', cue: HIT, events: [{ at: '0:0:0', v: 1 }, { at: '0:1:0', v: 0.7 }, [2, null, null, 0.9], { at: 3, v: 0.5 }] }]);
    const a = await renderBeatsOffline(norm(pattern), { loops: 1, tail: 0.5 });
    const b = await renderBeatsOffline(norm(composition), { tail: 0.5 });
    expect(b.wav.length).toBe(a.wav.length);
    expect(b.wav.equals(a.wav)).toBe(true);
  });

  it('each hit is a variant (1, 2, 3 …); vary: false fires the plain cue every time', () => {
    const plan = renderBeatsPlan(norm(comp([{ name: 'fx', cue: HIT, events: [0, 1, 2] }])));
    expect(plan.entries.map((e) => e.variant)).toEqual([1, 2, 3]);
    const plain = renderBeatsPlan(norm(comp([{ name: 'fx', cue: HIT, vary: false, events: [0, 1, 2] }])));
    expect(plain.entries.map((e) => e.variant)).toEqual([undefined, undefined, undefined]);
  });

  it('a cue part keeps its place in the event order: the pitched parts get the feel seeds the transport gives them', () => {
    const lead = { name: 'lead', instrument: 'acoustic-guitar', events: [['0:0:0', ['E3', 'B3'], '0:1:0'], ['0:2:0', 'G3']] };
    const asPatch = renderBeatsPlan(norm(comp([lead, { name: 'hit', patch: 'kick', events: [['0:1:0', 'C4']] }])));
    const withCue = renderBeatsPlan(norm(comp([lead, { name: 'hit', gesture: HIT[0], events: ['0:1:0'] }])));
    const notes = withCue.entries.filter((e) => e.type === 'note');
    expect(notes).toEqual(asPatch.entries.filter((e) => e.channel === 'lead'));
    expect(withCue.entries.filter((e) => e.type === 'cue')).toHaveLength(1);
  });

  it('the compact events are stored as written; the expansion is a plain tuple list', () => {
    const m = norm(comp([{ name: 'fx', cue: HIT, events: ['0:0:0', { at: '1:0:0', v: 0.6 }] }]));
    expect(m.parts[0].events).toEqual(['0:0:0', { at: '1:0:0', v: 0.6 }]);
    expect(m.parts[0].patch).toBeUndefined();
    expect(expandBeatsManifest(m).parts[0].events).toEqual([['0:0:0', 'C4'], ['1:0:0', 'C4', null, 0.6]]);
    const lit = expandBeatsManifest(m);
    expect(expandBeatsManifest(lit)).toBe(lit); // idempotent: nothing left to expand
  });

  it('it is heard: an impact cue part puts energy where its events are', async () => {
    const { channels } = await render(comp([{ name: 'fx', cue: HIT, events: ['0:2:0'] }]), { bitDepth: 32 });
    const y = channels[0];
    expect(rms(y, 0, Math.round(0.95 * SR))).toBeLessThan(1e-6);
    expect(rms(y, Math.round(1.0 * SR), Math.round(1.2 * SR))).toBeGreaterThan(0.01);
  });

  it('validation teaches cue parts; detection adds anthem (and sfx for the per-hit variants)', () => {
    const bad = (p) => validateBeatsManifest(comp([p])).errors.join('\n');
    expect(bad({ name: 'x', cue: HIT, patch: 'organ', events: [0] })).toMatch(/exactly ONE voice/);
    expect(bad({ name: 'x', cue: [{ type: 'nope' }], events: [0] })).toMatch(/cue\[0\]\.type must be one of/);
    expect(bad({ name: 'x', cue: HIT, events: [] })).toMatch(/non-empty array of hit times/);
    expect(bad({ name: 'x', cue: HIT, vary: 'yes', events: [0] })).toMatch(/vary must be true \| false/);
    expect(bad({ name: 'x', cue: HIT, events: [{ v: 0.5 }] })).toMatch(/time must be/);
    expect(bad({ name: 'x', gesture: HIT[0], form: [], events: [0] })).toMatch(/form is not for a cue part/);
    expect(beatsFeatures(norm(comp([{ name: 'x', cue: HIT, events: [0] }])))).toEqual(['voice', 'mix', 'sfx', 'ev', 'anthem']);
    expect(beatsFeatures(norm(comp([{ name: 'x', cue: HIT, vary: false, events: [0] }])))).toEqual(['voice', 'mix', 'ev', 'anthem']);
  });
});

describe('phase 1 — harmony authoring (pure: chord symbols, numerals, a chart, modulate)', () => {
  const names = (sym, o = {}, key) => voiceChord(parseChord(sym, key), o).map(nameOf);

  it("gate: 'Am7' → A C E G in the voicing asked for", () => {
    expect(names('Am7')).toEqual(['A3', 'C4', 'E4', 'G4']);
    expect(names('Am7', { voicing: 'open' })).toEqual(['A3', 'E4', 'C5', 'G5']);
    expect(names('Am7', { voicing: 'spread' })).toEqual(['A2', 'E3', 'C4', 'G4']);
    expect(names('Am7', { voicing: 'close', octave: 4 })).toEqual(['A4', 'C5', 'E5', 'G5']);
    for (const v of ['close', 'open', 'spread', 'guitar']) expect(new Set(names('Am7', { voicing: v }).map((n) => n.replace(/-?\d+$/, '')))).toEqual(new Set(['A', 'C', 'E', 'G']));
    expect(names('E5', { voicing: 'power' })).toEqual(['E2', 'B2', 'E3']);
    expect(names('F/G')).toEqual(['G2', 'F3', 'A3', 'C4']);
    expect(names('Csus4')).toEqual(['C3', 'F3', 'G3']);
    expect(names('Bbadd9')).toEqual(['A#3', 'D4', 'F4', 'C5']);
  });

  it('numerals resolve in the key: the royal road in E, borrowed chords in A minor, secondary dominants', () => {
    expect(['IV', 'V', 'iii', 'vi'].map((s) => names(s, {}, 'E')[0])).toEqual(['A3', 'B3', 'G#3', 'C#3']);
    expect(names('vi', {}, 'E')).toEqual(['C#3', 'E3', 'G#3']);
    expect(['i', 'bVI', 'bVII'].map((s) => names(s, {}, 'Am'))).toEqual([['A3', 'C4', 'E4'], ['F3', 'A3', 'C4'], ['G3', 'B3', 'D4']]);
    expect(names('V/V', {}, 'C')).toEqual(['D3', 'F#3', 'A3']);
    expect(names('V7', {}, 'C')).toEqual(['G3', 'B3', 'D4', 'F4']);
    expect(names('iiø7', {}, 'Am')).toEqual(['B3', 'D4', 'F4', 'A4']);
  });

  it('gate: voice leading moves the voices no further than the naive root-position voicing', () => {
    const prog = ['C', 'Am', 'F', 'G', 'Em', 'Am', 'Dm7', 'G7', 'C'];
    let naive = 0, led = 0, pn = null, pl = null;
    for (const s of prog) {
      const n = voiceChord(parseChord(s)), l = voiceChord(parseChord(s), { prev: pl, lead: true });
      if (pn) { naive += distance(n, pn); led += distance(l, pl); }
      pn = n; pl = l;
    }
    expect(led).toBeLessThanOrEqual(naive);
    expect(led).toBeLessThan(naive / 2); // 110 → 22 semitones on this chart
  });

  const chart = (extra = {}) => comp([
    { name: 'gtr', instrument: 'rock-guitar', chordVoice: 'power', rhythm: '8ths' },
    { name: 'bass', patch: 'bassMono', chordVoice: 'octaves', rhythm: '8ths', bars: [0, 2] },
    { name: 'keys', instrument: 'grand-piano', chordVoice: 'chord', lead: true, rhythm: 'half' },
    { name: 'mel', patch: 'organ', events: [{ at: 0, chord: 'Am7', d: 1 }, ['1:0:0', 'E4', '0:1:0', 0.7], ['5:0:0', 'E4']] },
    { name: 'kit', instrument: 'drum-kit', events: [['0:0:0', 'C2'], ['4:0:0', ['C2', 'F#2']], ['5:0:0', 'D2']] },
  ], { bpm: 150, key: 'E', progression: [{ chords: 'IV V iii vi', repeat: 2 }], ...extra });

  it('a chart part voices the progression on its rhythm, inside its bars; the recipe stays compact', () => {
    const m = norm(chart());
    expect(m.progression).toEqual([{ chords: 'IV V iii vi', repeat: 2 }]);
    expect(m.parts[0].chordVoice).toBe('power');
    const x = expandBeatsManifest(m);
    const part = (n) => x.parts.find((p) => p.name === n);
    expect(part('gtr').events).toHaveLength(64); // 8 bars × 8ths
    expect(part('gtr').events[0]).toEqual([0, ['A2', 'E3', 'A3'], 0.46, 0.9]);
    expect(part('bass').events.map((e) => e[1]).slice(0, 4)).toEqual(['A2', 'A3', 'A2', 'A3']);
    expect(part('bass').events).toHaveLength(16); // bars [0, 2)
    expect(part('keys').events[2][1]).toEqual(['B3', 'D#4', 'F#4']);
    expect(part('mel').events[0]).toEqual([0, ['A3', 'C4', 'E4', 'G4'], 1]);
    for (const k of ['key', 'progression', 'modulate']) expect(x[k]).toBeUndefined();
    expect(x.parts.every((p) => p.chordVoice === undefined && p.rhythm === undefined)).toBe(true);
    expect(expandBeatsManifest(x)).toBe(x);
    // plain tuples: the chart alone doesn't pull the score substrate into a page.
    expect(beatsFeatures(m)).not.toContain('score');
  });

  it('gate: modulate shifts every pitched part from its bar on; the kit row keeps its notes (renders byte-identical)', async () => {
    const x = expandBeatsManifest(norm(chart({ modulate: [{ at: '4:0:0', semitones: 1 }] })));
    const base = expandBeatsManifest(norm(chart()));
    const ev = (m, n) => m.parts.find((p) => p.name === n).events;
    expect(ev(x, 'kit')).toEqual(ev(base, 'kit'));
    expect(ev(x, 'mel')[2]).toEqual(['5:0:0', 'F4']);
    expect(ev(x, 'mel')[1]).toEqual(['1:0:0', 'E4', '0:1:0', 0.7]);
    expect(ev(x, 'gtr').find((e) => e[0] === 16)[1]).toEqual(['A#2', 'F3', 'A#3']);
    const kitOnly = (extra) => comp([{ name: 'kit', instrument: 'drum-kit', events: [['0:0:0', 'C2'], ['1:0:0', ['C2', 'F#2']], ['1:2:0', 'D2']] }], extra);
    const a = await renderBeatsOffline(norm(kitOnly()), { tail: 0.3 });
    const b = await renderBeatsOffline(norm(kitOnly({ modulate: [{ at: '1:0:0', semitones: 2 }] })), { tail: 0.3 });
    expect(b.wav.equals(a.wav)).toBe(true);
    // and it is heard on a pitched part: the organ's A4 plays B4 after the change.
    const tone = (extra) => render(comp([{ name: 'o', patch: 'organ', events: [['0:0:0', 'A4', '1:0:0'], ['1:0:0', 'A4', '1:0:0']] }], extra), { bitDepth: 32 });
    const { channels } = await tone({ modulate: [{ at: '1:0:0', semitones: 2 }] });
    const { pitchHz } = await import('./audio-measure.js');
    expect(Math.abs(1200 * Math.log2(pitchHz(channels[0], SR, Math.round(0.8 * SR), 4096, 440) / 440))).toBeLessThan(5);
    expect(Math.abs(1200 * Math.log2(pitchHz(channels[0], SR, Math.round(2.8 * SR), 4096, 493.88) / 493.88))).toBeLessThan(5);
  });

  it('a form entry after the key change is transposed by where it starts; a part may opt out', () => {
    const m = norm(comp([
      { name: 'lead', patch: 'organ', form: [{ phrase: 'A', at: '0:0:0' }, { phrase: 'A', at: '2:0:0', transpose: 12 }] },
      { name: 'drone', patch: 'organ', modulate: false, events: [['2:0:0', 'E3', '1:0:0']] },
    ], { phrases: { A: [['0:0:0', 'C4'], { at: '0:1:0', chord: 'G7' }] }, modulate: [{ at: '2:0:0', semitones: 2 }] }));
    const x = expandBeatsManifest(m);
    expect(x.parts[0].form.map((f) => f.transpose || 0)).toEqual([0, 14]);
    expect(x.parts[1].events[0][1]).toBe('E3');
    expect(x.parts[1].modulate).toBeUndefined();
    expect(x.phrases.A[1]).toEqual(['0:1:0', ['G3', 'B3', 'D4', 'F4']]); // a phrase's chord lowers once, the form moves it
  });

  it('the pattern harmony bus takes symbols and numerals in its chord dictionary', () => {
    const pat = { kind: 'beats-pattern', title: 'p', bpm: 128, seed: 1, steps: 16, key: 'Am', chords: { a: 'i', b: 'bVI', c: 'bVII', d: ['E3', 'G#3', 'B3'] }, progression: ['a', 'b', 'c', 'd'], tracks: [{ name: 's', patch: 'pad', chordVoice: 'chord', mask: [1, 0, 0, 0] }] };
    const x = expandBeatsManifest(norm(pat));
    expect(x.chords).toEqual({ a: ['A3', 'C4', 'E4'], b: ['F3', 'A3', 'C4'], c: ['G3', 'B3', 'D4'], d: ['E3', 'G#3', 'B3'] });
    expect(renderBeatsPlan(norm(pat)).entries.filter((e) => e.t === 0).map((e) => e.note)).toEqual(['A3', 'C4', 'E4']);
  });

  it('validation teaches every harmony field', () => {
    const errs = (m) => validateBeatsManifest(m).errors.join('\n');
    expect(errs(chart({ key: undefined }))).toMatch(/'IV' is a Roman numeral — it needs the recipe's `key`/);
    expect(errs(chart({ progression: ['Hm'] }))).toMatch(/'Hm' is not a chord symbol/);
    expect(errs(chart({ progression: [{ chords: [] }] }))).toMatch(/chords must be a chord list/);
    expect(errs(chart({ progression: [['C', -1]] }))).toMatch(/must be a length in bars/);
    expect(errs(comp([{ name: 'a', patch: 'organ', chordVoice: 'root', events: [] }]))).toMatch(/chordVoice reads the chart: add a manifest-level progression/);
    expect(errs(comp([{ name: 'a', patch: 'organ', chordVoice: 'wat', rhythm: 'x', voicing: 'jazz', octave: 12, bars: [4, 2] }], { progression: ['C'] }))).toMatch(/chordVoice must be one of[\s\S]*rhythm must be a name[\s\S]*voicing must be one of[\s\S]*octave must be an integer[\s\S]*bars must be \[from, to\)/);
    expect(errs(comp([{ name: 'a', patch: 'organ', events: [{ at: 0, chord: 'Q7' }, { at: 1, chord: 'C', n: 'C4' }] }]))).toMatch(/'Q7' is not a chord symbol[\s\S]*n \(notes\) OR chord/);
    expect(errs(comp([{ name: 'a', patch: 'organ', events: [[0, 'C4']] }], { modulate: [{ at: 'x', semitones: 0 }] }))).toMatch(/modulate\[0\]\.at[\s\S]*semitones must be a whole number/);
    expect(errs(comp([{ name: 'a', patch: 'organ', rhythm: '8ths', events: [[0, 'C4']] }]))).toMatch(/rhythm belongs to a chart-voicing part/);
    expect(errs({ kind: 'beats-pattern', title: 'p', bpm: 120, seed: 1, modulate: [], tracks: [{ name: 'a', patch: 'pad', mask: [1] }] })).toMatch(/modulate is a beats-composition field/);
  });
});

describe('phase 2 — grooves and seeded fills (pure)', () => {
  const song = (groove, extra = {}, events) => comp([{ name: 'dr', instrument: 'stadium-kit', groove, ...(events ? { events } : {}) }], { bpm: 160, seed: 11, ...extra });
  const SECTIONS = [
    { style: 'rock-drive', bars: [0, 8], fills: 'every-4', crash: 'section' },
    { style: 'double-time-chorus', bars: [8, 16], fills: 'section', crash: 'both' },
  ];
  const hits = (m) => expandBeatsManifest(norm(m)).parts[0].events;
  const inBar = (ev, b) => ev.filter((e) => typeof e[0] === 'number' && e[0] >= b * 4 && e[0] < b * 4 + 4);

  it('gate: a groove renders byte-identical to its expanded literal events', async () => {
    const m = song([{ style: 'eight-beat', bars: [0, 2], fills: 'every-2', crash: 'section' }], { bpm: 140 });
    const lit = comp([{ name: 'dr', instrument: 'stadium-kit', events: hits(m) }], { bpm: 140, seed: 11 });
    const a = await renderBeatsOffline(norm(m), { tail: 0.3 });
    const b = await renderBeatsOffline(norm(lit), { tail: 0.3 });
    expect(a.wav.equals(b.wav)).toBe(true);
    // the premise: 32 bars of drums with fills are a few lines, not hundreds of events.
    const long = song(SECTIONS.concat([{ style: 'half-time', bars: [16, 32], fills: 'every-8', crash: 'section' }]));
    const longLit = comp([{ name: 'dr', instrument: 'stadium-kit', events: hits(long) }], { bpm: 160, seed: 11 });
    expect(JSON.stringify(norm(long)).length).toBeLessThan(JSON.stringify(norm(longLit)).length / 10);
  });

  it('gate: fills repeat under the same seed and differ across seeds', () => {
    const fillBars = (seed) => { const ev = hits(song([{ style: 'eight-beat', bars: [0, 32], fills: 'every-2', seed }])); return [1, 3, 5, 7, 9, 11, 13, 15].map((b) => inBar(ev, b).map((e) => e[1]).join(',')); };
    expect(fillBars(3)).toEqual(fillBars(3));
    expect(fillBars(3)).not.toEqual(fillBars(4));
    expect(new Set(fillBars(3)).size).toBeGreaterThan(1); // the vocabulary varies bar to bar
  });

  it('gate: the crash lands on each section downbeat (and after fills when asked)', () => {
    const ev = hits(song(SECTIONS));
    const crashAt = ev.filter((e) => e[1] === 'C#3').map((e) => e[0]);
    expect(crashAt).toContain(0);
    expect(crashAt).toContain(32);
    expect(crashAt.every((q) => q % 4 === 0)).toBe(true);
    // every section downbeat also has a kick, and no hat on top of the crash.
    for (const q of [0, 32]) {
      expect(ev.some((e) => e[0] === q && e[1] === 'C2')).toBe(true);
      expect(ev.some((e) => e[0] === q && ['F#2', 'A#2', 'D#3'].includes(e[1]))).toBe(false);
    }
  });

  it('the styles have their signatures', () => {
    const bar = (style) => inBar(hits(song([{ style, bars: 1 }])), 0);
    const at = (ev, note) => ev.filter((e) => e[1] === note).map((e) => e[0]);
    expect(at(bar('four-floor'), 'C2')).toEqual([0, 1, 2, 3]);
    expect(at(bar('half-time'), 'D2')).toEqual([2]);
    expect(at(bar('rock-drive'), 'C2')).toEqual([0, 1.5, 2]); // 1, the "and" of 2, 3
    expect(at(bar('rock-drive'), 'A#2')).toEqual([3.5]); // the open-hat lift
    expect(at(bar('double-time-chorus'), 'D2')).toEqual([0.5, 1.5, 2.5, 3.5]);
    expect(at(bar('blast'), 'C2')).toHaveLength(8);
    expect(at(bar('trance-drive'), 'A#2')).toEqual([0.5, 1.5, 2.5, 3.5]);
  });

  it('a written fill wins its bar from its first onset; notes a kit lacks fall back', () => {
    const ev = hits(song([{ style: 'eight-beat', bars: [0, 2] }], {}, [['1:2:0', 'A2'], ['1:3:0', 'F2']]));
    const bar1 = ev.filter((e) => typeof e[0] === 'number' && e[0] >= 4);
    expect(bar1.every((e) => e[0] < 6)).toBe(true); // generated hits stop at beat 3 of bar 1
    expect(ev.filter((e) => typeof e[0] === 'string')).toHaveLength(2);
    const k88 = expandBeatsManifest(norm(comp([{ name: 'dr', instrument: 'drum-machine-88', groove: { style: 'double-time-chorus', bars: 1 } }]))).parts[0].events;
    expect(k88.some((e) => e[1] === 'D#3')).toBe(false); // no ride on that machine …
    expect(k88.filter((e) => e[1] === 'F#2')).toHaveLength(8); // … the closed hat plays it
  });

  it('a groove follows the meter map (a 3/4 bar is twelve sixteenths)', () => {
    const ev = hits(song([{ style: 'eight-beat', bars: [0, 2], fills: 'every-2', fill: 'tom-run' }], { meter: '3/4' }));
    expect(ev.every((e) => e[0] < 6)).toBe(true);
    const tom = ev.filter((e) => ['C3', 'A2', 'F2'].includes(e[1])).map((e) => e[0]);
    expect(Math.min(...tom)).toBeGreaterThanOrEqual(3); // the fill ends bar 1 (3 → 6)
  });

  it('validation teaches grooves; a groove costs no kernel slice', () => {
    const errs = (g, inst = 'stadium-kit') => validateBeatsManifest(comp([{ name: 'dr', instrument: inst, groove: g }])).errors.join('\n');
    expect(errs({ style: 'polka', bars: 4 })).toMatch(/style must be one of: eight-beat/);
    expect(errs({ style: 'eight-beat', bars: [4, 2] })).toMatch(/bars must be \[from, to\)/);
    expect(errs({ style: 'eight-beat', bars: 4, fills: 'often', crash: 'loud', fill: 'solo' })).toMatch(/fills must be one of[\s\S]*fill must be one of[\s\S]*crash must be one of/);
    expect(errs({ style: 'eight-beat', bars: 4 }, 'grand-piano')).toMatch(/groove needs a drum kit part/);
    expect(validateBeatsManifest({ kind: 'beats-pattern', title: 'p', bpm: 120, seed: 1, tracks: [{ name: 'a', instrument: 'drum-kit', notes: ['C2'], mask: [1], groove: { style: 'eight-beat', bars: 1 } }] }).errors.join('\n')).toMatch(/groove is a beats-composition part field/);
    expect(beatsFeatures(norm(song(SECTIONS)))).not.toContain('anthem');
  });
});

describe('phase 3 — guitar and lead articulations', () => {
  const c = (a, b) => 1200 * Math.log2(a / b);
  const one = (art, n = 'A3', patch = 'guitarElectric', d = 2) => render(comp([{ name: 'g', patch, events: [{ at: 0, n, d, art }] }]), { bitDepth: 32 }).then((r) => r.channels[0]);

  it('gate: a bend reaches its target within ±10 cents (a whole step up, then released)', async () => {
    const y = await one({ type: 'bend', to: 2, at: 0.3, over: 0.15, release: { at: 1.2, over: 0.15 } }, 'A3', 'guitarElectric', 4);
    const f0 = pitchHz(y, SR, Math.round(0.08 * SR), 4096, 220);
    const top = pitchHz(y, SR, Math.round(0.6 * SR), 4096, 247);
    const back = pitchHz(y, SR, Math.round(1.45 * SR), 4096, 220);
    expect(Math.abs(c(top, f0) - 200)).toBeLessThan(10);
    expect(Math.abs(c(back, f0))).toBeLessThan(10);
  });

  it('a pre-bend starts bent and releases; a slide comes in from below; a dive falls an octave', async () => {
    const pre = await one({ type: 'bend', to: 1, pre: true, release: { at: 0.6, over: 0.1 } });
    expect(Math.abs(c(pitchHz(pre, SR, Math.round(0.1 * SR), 4096, 233), pitchHz(pre, SR, Math.round(1.0 * SR), 4096, 220)) - 100)).toBeLessThan(10);
    const sl = await one({ type: 'slide', in: -5, over: 0.25 }, 'A3', 'guitarElectric', 1);
    expect(c(pitchHz(sl, SR, 0, 2048, 165), 220)).toBeLessThan(-300);
    expect(Math.abs(c(pitchHz(sl, SR, Math.round(0.4 * SR), 4096, 220), 220))).toBeLessThan(10);
    const dv = await one({ type: 'dive', to: -12, at: 0.2, over: 0.4 });
    expect(Math.abs(c(pitchHz(dv, SR, Math.round(0.7 * SR), 4096, 110), pitchHz(dv, SR, Math.round(0.05 * SR), 4096, 220)) + 1200)).toBeLessThan(10);
  });

  it('gate: palm mute rings under 0.25 s (T60); the open string rings for seconds', async () => {
    const pm = await one('pm', 'E2');
    const open = await one(undefined, 'E2');
    expect(t60(pm, SR)).toBeLessThan(0.25);
    expect(t60(open, SR)).toBeGreaterThan(2);
  });

  it('gate: a pinch harmonic sounds its k-th partial — the pitch reads k × f and the band under it falls ≥ 15 dB', async () => {
    // the plan asked for the attack centroid ×2; a bright Karplus-Strong pluck's
    // spectrum is near flat, so its centroid barely moves when the low partials
    // go. The squeal is the pitch jump and the lost fundamental: gated on those.
    const plain = await one(undefined, 'G3', 'guitarElectric', 1);
    for (const k of [3, 4, 5]) {
      const h = await one({ type: 'harm', k }, 'G3', 'guitarElectric', 1);
      expect(Math.abs(c(pitchHz(h, SR, 2205, 4096, 196 * k), 196 * k))).toBeLessThan(17); // ±1 %
      const low = (y) => bandEnergy(y, SR, 0, 8192, 20, (k - 0.5) * 196) / bandEnergy(y, SR, 0, 8192, 20, 16000);
      expect(10 * Math.log10(low(h) / low(plain))).toBeLessThan(-15);
    }
  });

  it('vib wobbles the pitch by its depth; a bend can carry it at the top', async () => {
    const y = await one({ type: 'vib', depth: 50, rate: 5, delay: 0 }, 'A3', 'guitarElectric', 4);
    const fs = [];
    for (let s0 = 0.3; s0 < 1.5; s0 += 0.025) fs.push(c(pitchHz(y, SR, Math.round(s0 * SR), 1024, 220), 220));
    const span = Math.max(...fs) - Math.min(...fs);
    expect(span).toBeGreaterThan(60); // ±50 c peak (window-smoothed)
    expect(span).toBeLessThan(120);
    const plan = renderBeatsPlan(norm(comp([{ name: 'g', patch: 'guitarLead', events: [{ at: 0, n: 'E4', d: 2, art: { type: 'bend', to: 2, vib: 30 } }] }])));
    expect(plan.entries[0].pp.vib).toEqual({ depth: 30, rate: undefined, delay: undefined });
    expect(plan.entries[0].pp.pitchLane[2][1]).toBe(200);
  });

  it('power: true makes every single note root + fifth + octave, its phrases too', () => {
    const x = expandBeatsManifest(norm(comp([{ name: 'r', instrument: 'drop-guitar', power: true, events: [['0:0:0', 'E2', '0:0:1'], ['0:1:0', ['E2', 'G2']]], form: [{ phrase: 'R', at: '1:0:0' }] }], { phrases: { R: [['0:0:0', 'D2'], { at: '0:1:0', n: 'F2', art: 'pm' }] } })));
    expect(x.parts[0].events[0][1]).toEqual(['E2', 'B2', 'E3']);
    expect(x.parts[0].events[1][1]).toEqual(['E2', 'G2']); // a written chord is left alone
    expect(x.parts[0].form[0].phrase).toBe('R~power');
    expect(x.phrases['R~power']).toEqual([['0:0:0', ['D2', 'A2', 'D3']], { at: '0:1:0', n: ['F2', 'C3', 'F3'], art: 'pm' }]);
    expect(x.phrases.R[0][1]).toBe('D2');
  });

  it('a legato line on the supersaw lead glides (portamento: one note, the pitch moves)', async () => {
    const y = (await render(comp([{ name: 's', instrument: 'supersaw-lead', glide: 0.08, events: [{ at: 0, n: 'A4', d: 1, art: 'legato' }, { at: 1, n: 'E5', d: 1, art: 'legato' }] }]), { bitDepth: 32 })).channels[0];
    expect(Math.abs(c(pitchHz(y, SR, Math.round(0.3 * SR), 4096, 440), 440))).toBeLessThan(15);
    expect(Math.abs(c(pitchHz(y, SR, Math.round(0.8 * SR), 4096, 659.26), 659.26))).toBeLessThan(15);
    expect(renderBeatsPlan(norm(comp([{ name: 's', instrument: 'supersaw-lead', events: [{ at: 0, n: 'A4', d: 1, art: 'legato' }, { at: 1, n: 'E5', d: 1, art: 'legato' }] }]))).entries).toHaveLength(1);
  });

  it('validation teaches the guitar articulations; detection adds anthem (and strings for pm)', () => {
    const errs = (art) => validateBeatsManifest(comp([{ name: 'g', patch: 'guitarLead', events: [{ at: 0, n: 'E4', d: 1, art }] }])).errors.join('\n');
    expect(errs({ type: 'bend', to: 99 })).toMatch(/art\.to must be in \[-48, 24\]/);
    expect(errs({ type: 'slide' })).toMatch(/needs in \(semitones/);
    expect(errs({ type: 'harm', k: 1 })).toMatch(/k must be the partial that squeals/);
    expect(errs({ type: 'bend', release: 'soon' })).toMatch(/release must be true or \{ at\?, over\? \}/);
    expect(errs({ type: 'vib', depth: 900 })).toMatch(/depth must be cents in \[0, 400\]/);
    expect(errs({ type: 'shred' })).toMatch(/guitar and lead: bend, slide, dive, vib, pm, harm, pop/);
    expect(errs({ type: 'gliss', to: 'E5' })).toBe(''); // the orchestral `to` is still a note
    expect(validateBeatsManifest(comp([{ name: 'k', instrument: 'drum-kit', power: true, events: [[0, 'C2']] }])).errors.join('\n')).toMatch(/power is for a pitched part/);
    const f = (art) => beatsFeatures(norm(comp([{ name: 'g', instrument: 'rock-lead', events: [{ at: 0, n: 'E4', d: 1, art }] }])));
    expect(f('bend')).toContain('anthem');
    expect(f('pm')).toEqual(expect.arrayContaining(['strings', 'anthem', 'orch', 'score']));
    expect(f('legato')).not.toContain('anthem');
  });

  it('the new band patches render finite and sane over a long note', async () => {
    for (const patch of ['guitarDropChug', 'bassPick', 'bassSlap']) {
      const { channels } = await render(comp([{ name: 'a', patch, events: [['0:0:0', ['E2', 'B2'], '3:0:0', 0.9], ['3:0:0', 'E3', '0:1:0', 0.5]] }]), { bitDepth: 32 });
      for (const y of channels) { expect(y.every(Number.isFinite)).toBe(true); expect(peak(y)).toBeLessThan(1); expect(peak(y)).toBeGreaterThan(0.005); }
    }
  });
});

describe('phase 4 — section sweeps, production gestures, the orchestra hit', () => {
  const toneFreq = (v) => 120 * Math.pow(150, v);
  const noise = (sweeps, extra = {}) => comp([{ name: 'n', patch: 'burstSoft', patchParams: { attack: 0.005, decay: 0.05, sustain: 1, release: 0.05 }, events: [['0:0:0', 'C4', '4:0:0', 0.8]] }], { sweeps, ...extra });
  const N = 2048;
  // the −3 dB point of b relative to a (the same noise, unswept), ±4-bin smoothed.
  function cutoff(a, b, s0, dir = 'low') {
    const A = magnitudeSpectrum(a, s0, N), B = magnitudeSpectrum(b, s0, N);
    const r = (k) => { let x = 0, y = 0; for (let j = k - 4; j <= k + 4; j++) { x += B[j] * B[j]; y += A[j] * A[j]; } return Math.sqrt(x / y); };
    if (dir === 'low') { for (let k = 5; k < N / 2 - 5; k++) if (r(k) < Math.SQRT1_2) return (k * SR) / N; }
    else for (let k = N / 2 - 6; k > 5; k--) if (r(k) < Math.SQRT1_2) return (k * SR) / N;
    return null;
  }

  it('gate: a tone sweep\'s measured cutoff follows the ramp within 5 %', async () => {
    const a = (await render(noise(undefined), { bitDepth: 32, tail: 0.2 })).channels[0];
    const b = (await render(noise([{ row: 'n', param: 'tone', from: 0.95, to: 0.35, at: '1:0:0', over: '2:0:0' }]), { bitDepth: 32, tail: 0.2 })).channels[0];
    let worst = 0;
    for (let t = 2.1; t < 6; t += 0.4) {
      const want = toneFreq(0.95 - 0.6 * ((t - 2) / 4)); // exponential in Hz = linear in the macro
      worst = Math.max(worst, Math.abs(cutoff(a, b, Math.round(t * SR) - N / 2) / want - 1));
    }
    expect(worst).toBeLessThan(0.05);
    // before the sweep the row is at `from`; after it, at `to`.
    expect(Math.abs(cutoff(a, b, Math.round(7 * SR)) / toneFreq(0.35) - 1)).toBeLessThan(0.05);
  });

  it('a lowcut sweep opens a highpass; level fades; master sweeps sit on the whole mix', async () => {
    const a = (await render(noise(undefined), { bitDepth: 32, tail: 0.2 })).channels[0];
    const lc = (await render(noise([{ row: 'n', param: 'lowcut', from: 3000, to: 3000, at: 0, over: 1 }]), { bitDepth: 32, tail: 0.2 })).channels[0];
    expect(Math.abs(cutoff(a, lc, Math.round(2 * SR), 'high') / 3000 - 1)).toBeLessThan(0.05);
    const fade = (await render(noise([{ row: 'n', param: 'level', from: -40, to: 0, at: 0, over: '2:0:0' }]), { bitDepth: 32, tail: 0.2 })).channels[0];
    const db = (y, t) => 20 * Math.log10(rms(y, Math.round(t * SR), Math.round((t + 0.1) * SR)));
    expect(db(a, 0.5) - db(fade, 0.5)).toBeGreaterThan(25); // −30 dB at a quarter of the way in dB
    expect(Math.abs(db(a, 5) - db(fade, 5))).toBeLessThan(0.5);
    const m = (await render(noise([{ row: 'master', param: 'tone', from: 0.5, to: 0.5, at: 0, over: 1 }]), { bitDepth: 32, tail: 0.2 })).channels[0];
    expect(Math.abs(cutoff(a, m, Math.round(2 * SR)) / toneFreq(0.5) - 1)).toBeLessThan(0.08); // the bus compressor sits after it
  });

  it('gate: a riser\'s centroid and level both rise monotonically; its event holds its length', async () => {
    const m = norm(comp([{ name: 'fx', cue: [{ type: 'riser', bars: 4, tone: 'A3' }], events: ['0:0:0'] }]));
    expect(expandBeatsManifest(m).parts[0].events).toEqual([['0:0:0', 'C4', 16]]);
    expect(expandBeatsManifest(m).parts[0].cue).toEqual([{ type: 'riser', tone: 'A3', dur: 8 }]);
    const y = (await render(m, { bitDepth: 32 })).channels[0];
    const c = [], l = [];
    for (let k = 0; k < 8; k++) { const s0 = Math.round((k + 0.5) * SR); c.push(centroid(y, SR, s0, 4096)); l.push(rms(y, s0, s0 + 22050)); }
    for (let k = 1; k < 8; k++) { expect(c[k]).toBeGreaterThan(c[k - 1]); expect(l[k]).toBeGreaterThan(l[k - 1]); }
  });

  it('the rest of the gestures do what they say: downlifter falls, reverse cymbal peaks at its end, impact booms, scratch strokes', async () => {
    const env = async (g, n = 6) => { const y = (await render(comp([{ name: 'fx', cue: [g], events: ['0:0:0'] }]), { bitDepth: 32 })).channels[0]; return Array.from({ length: n }, (_, k) => rms(y, Math.round(k * 0.25 * SR), Math.round((k + 1) * 0.25 * SR))); };
    const down = await env({ type: 'downlifter', dur: 2 });
    for (let k = 1; k < 6; k++) expect(down[k]).toBeLessThan(down[k - 1]);
    const rev = await env({ type: 'reverse-cymbal', dur: 1.5 });
    for (let k = 1; k < 6; k++) expect(rev[k]).toBeGreaterThan(rev[k - 1]);
    const imp = await env({ type: 'impact' });
    expect(imp[0]).toBeGreaterThan(0.05);
    expect(imp[3]).toBeLessThan(imp[0] / 10);
    const scr = (await render(comp([{ name: 'fx', cue: [{ type: 'scratch', dur: 1, rate: 8 }], events: ['0:0:0'] }]), { bitDepth: 32 })).channels[0];
    expect(rms(scr, 0, SR)).toBeGreaterThan(0.02);
    // a variant scratch is a different scratch; a variant riser keeps its length.
    const plan = renderBeatsPlan(norm(comp([{ name: 'fx', cue: [{ type: 'riser', dur: 2 }], events: [0, 4] }])));
    const { buildBeatsKernel: bk } = await import('./beats-kernel.js');
    const k = bk();
    expect(k.cuePlan(plan.entries[1].gestures, 2)[0].len).toBe(2);
  });

  it('the orchestra hit: a loud stacked chord that is gone in a quarter second (the hall rings after)', async () => {
    const y = (await render(comp([{ name: 'h', instrument: 'orchestra-hit', events: [['0:0:0', ['C3', 'G3', 'C4', 'E4', 'G4', 'C5'], '0:1:0', 0.9]] }]), { bitDepth: 32 })).channels[0];
    expect(y.every(Number.isFinite)).toBe(true);
    expect(peak(y)).toBeLessThan(1);
    expect(rms(y, 0, 11025)).toBeGreaterThan(4 * rms(y, 11025, 22050));
  });

  it('validation teaches sweeps and the production gestures; detection adds anthem', () => {
    const errs = (m) => validateBeatsManifest(m).errors.join('\n');
    expect(errs(noise([{ row: 'nope', param: 'tone', from: 1, to: 0, at: 0, over: 4 }]))).toMatch(/row 'nope' is not a part/);
    expect(errs(noise([{ row: 'n', param: 'wah', from: 1, to: 0, at: 0, over: 4 }]))).toMatch(/param must be one of: tone, lowcut, level, send, pan/);
    expect(errs(noise([{ row: 'n', param: 'tone', from: 2, to: 0, at: 0, over: 0 }]))).toMatch(/from must be in \[0, 1\][\s\S]*over must be a length/);
    expect(errs(noise([{ row: 'master', param: 'pan', from: 0, to: 1, at: 0, over: 4 }]))).toMatch(/the master sweeps tone, lowcut or level/);
    expect(errs(noise([{ row: 'n', param: 'send', from: 0, to: 1, at: 0, over: 4 }]))).toMatch(/a send sweep rides the row's room send/);
    expect(errs({ kind: 'beats-pattern', title: 'p', bpm: 120, seed: 1, sweeps: [], tracks: [{ name: 'a', patch: 'pad', mask: [1] }] })).toMatch(/sweeps is a beats-composition field/);
    const g = (x) => errs(comp([{ name: 'fx', cue: [x], events: [0] }]));
    expect(g({ type: 'riser', dur: 2, bars: 2 })).toMatch(/give dur \(seconds\) OR bars/);
    expect(g({ type: 'riser', from: 5 })).toMatch(/from must be in \[20, 20000\]/);
    expect(g({ type: 'impact', tone: 'A3' })).toMatch(/tone is for a riser or downlifter/);
    expect(g({ type: 'scratch', rate: 99 })).toMatch(/rate must be in \[1, 30\]/);
    expect(errs({ kind: 'beats-sfx', title: 's', cues: { a: [{ type: 'riser', bars: 2 }] } })).toMatch(/bars \/ beats need a tempo/);
    expect(validateBeatsManifest({ kind: 'beats-sfx', title: 's', cues: { a: [{ type: 'impact' }] } }).ok).toBe(true);
    expect(beatsFeatures(norm(noise([{ row: 'n', param: 'tone', from: 1, to: 0, at: 0, over: 4 }])))).toContain('anthem');
    expect(beatsFeatures({ kind: 'beats-sfx', title: 's', cues: { a: [{ type: 'impact' }] } })).toEqual(['voice', 'mix', 'sfx', 'ev', 'anthem']);
  });
});

describe('phase 5 — era production: plate, master styles, the 90s kit, band templates', () => {
  const band = (extra = {}) => comp([
    { name: 'dr', instrument: 'drum-kit-90s-rock', groove: { style: 'rock-drive', bars: 4, fills: 'every-4' } },
    { name: 'gtr', instrument: 'rock-guitar', chordVoice: 'power', rhythm: '8ths' },
    { name: 'bass', instrument: 'picked-bass', chordVoice: 'octaves', rhythm: '8ths', octave: 1 },
    { name: 'lead', instrument: 'rock-lead', pan: -0.2, events: [['0:0:0', 'E4', '1:0:0']] },
  ], { bpm: 150, key: 'E', progression: ['IV', 'V', 'iii', 'vi'], ...extra });

  it('gate: the plate is denser than room2 in its first 50 ms (normalized echo density)', async () => {
    const { OfflineAudioContext } = await import('node-web-audio-api');
    const ir = async (model) => {
      const ctx = new OfflineAudioContext(2, SR, SR), e = K.createEngine(ctx);
      const b = e.buildChain([{ type: 'reverb', model, wet: 1, decay: 1.8 }], 7, 120); b.output.connect(ctx.destination);
      const buf = ctx.createBuffer(1, 1, SR); buf.getChannelData(0)[0] = 1;
      const s = ctx.createBufferSource(); s.buffer = buf; s.connect(b.input); s.start(0);
      return (await ctx.startRendering()).getChannelData(0);
    };
    // Abel & Huang: the share of samples beyond one standard deviation in each 10 ms
    // window, over the Gaussian's 0.3173 — 1 is fully dense, sparse reflections read low.
    const ned = (h) => { const w = Math.round(0.01 * SR), out = []; for (let s0 = Math.round(0.001 * SR); s0 + w <= Math.round(0.051 * SR); s0 += w) { let m = 0; for (let i = s0; i < s0 + w; i++) m += h[i] * h[i]; const sd = Math.sqrt(m / w); let c = 0; for (let i = s0; i < s0 + w; i++) if (Math.abs(h[i]) > sd) c++; out.push(c / w / 0.3173); } return out; };
    const plate = ned(await ir('plate')), room = ned(await ir('room2'));
    const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    expect(mean(plate)).toBeGreaterThan(mean(room));
    expect(plate[0]).toBeGreaterThan(room[0]); // dense from the first milliseconds
  });

  it('gate: loud-00s masters the export to −8 ± 1 LUFS at ≤ −0.3 dBTP; bright-90s to about −11', async () => {
    const { integratedLufs, truePeakDb } = await import('./beats-render.js');
    const trims = (m) => ({ ...m, parts: m.parts.map((p, i) => ({ ...p, trim: [-10, -12, -10, -8][i] })) });
    for (const [style, lufs, peakDb] of [['loud-00s', -8, -0.3], ['bright-90s', -11, -1]]) {
      const r = await renderBeatsOffline(norm(trims(band({ master: { style } }))), { tail: 0.3 });
      const { channels } = decodeWav(r.wav);
      expect(Math.abs(integratedLufs(channels, SR) - lufs)).toBeLessThan(1);
      expect(truePeakDb(channels)).toBeLessThanOrEqual(peakDb + 0.05); // 16-bit rounding
      expect(r.meta.export.style).toBe(style);
    }
    // an explicit export.normalize still wins (the style's bus plays, the export is only normalized).
    const r = await renderBeatsOffline(norm(trims(band({ master: { style: 'loud-00s' }, export: { normalize: { peak: -1 } } }))), { tail: 0.3 });
    expect(r.meta.export.style).toBeUndefined();
  });

  it('a row trim sits after the chain (it turns an amp down; at the head it could not)', async () => {
    const gtr = (trim) => render(comp([{ name: 'g', instrument: 'rock-guitar', trim, events: [['0:0:0', ['E2', 'B2', 'E3'], '1:0:0', 0.9]] }], { bpm: 150 }), { bitDepth: 32 }).then((x) => rms(x.channels[0], 4000, 40000));
    const a = await gtr(undefined), b = await gtr(-12);
    expect(20 * Math.log10(b / a)).toBeLessThan(-8);
  });

  it('the band template fills pan, send and trim by role, adds a room and double-tracks the rhythm guitar; a part\'s own values win', () => {
    const x = expandBeatsManifest(norm(band({ band: 'anime-rock' })));
    const p = (n) => x.parts.find((q) => q.name === n);
    expect(x.room.model).toBe('plate');
    expect(p('gtr').pan).toBe(-0.8);
    expect(p('gtr~double').pan).toBe(0.8);
    expect(p('gtr~double').events[0][0]).toBeCloseTo(0.012 * 150 / 60, 9); // 12 ms late
    expect(p('gtr').trim).toBe(-3);
    expect(p('lead').pan).toBe(-0.2); // its own
    expect(p('lead').send).toBe(0.18);
    expect(p('dr').send).toBe(0.12);
    expect(x.band).toBeUndefined();
    const own = expandBeatsManifest(norm(band({ band: 'trance-pop', room: { decay: 1 } })));
    expect(own.room).toEqual({ decay: 1 });
    const noDouble = expandBeatsManifest(norm(comp([{ name: 'g', instrument: 'rock-guitar', double: false, events: [[0, 'E2']] }], { band: 'anime-rock' })));
    expect(noDouble.parts.map((q) => q.name)).toEqual(['g']);
  });

  it('the 90s rock kit renders finite, its snare on a plate', async () => {
    const { channels } = await render(comp([{ name: 'dr', instrument: 'drum-kit-90s-rock', groove: { style: 'eight-beat', bars: 1, fills: 'every-2', fill: 'tom-run' } }]), { bitDepth: 32 });
    for (const y of channels) { expect(y.every(Number.isFinite)).toBe(true); expect(peak(y)).toBeLessThan(1); expect(peak(y)).toBeGreaterThan(0.01); }
  });

  it('validation teaches the production fields; detection adds anthem', () => {
    const errs = (m) => validateBeatsManifest(m).errors.join('\n');
    expect(errs(band({ master: { style: 'loud-80s' } }))).toMatch(/master.style must be one of: loud-00s, bright-90s/);
    expect(errs(band({ band: 'polka' }))).toMatch(/band must be one of: anime-rock, trance-pop/);
    expect(errs(comp([{ name: 'a', patch: 'organ', trim: 30, events: [[0, 'C4']] }]))).toMatch(/trim must be dB in \[-40, 12\]/);
    expect(errs(comp([{ name: 'a', patch: 'organ', double: { offset: 500 }, events: [[0, 'C4']] }]))).toMatch(/double must be true \| false or \{ offset\?/);
    expect(errs(comp([{ name: 'a', patch: 'organ', chain: [{ type: 'reverb', model: 'spring' }], events: [[0, 'C4']] }]))).toMatch(/or 'plate'/);
    expect(validateBeatsManifest(comp([{ name: 'a', patch: 'organ', events: [[0, 'C4']] }], { room: { model: 'plate', decay: 1.6 } })).ok).toBe(true);
    const f = (m) => beatsFeatures(norm(m));
    expect(f(comp([{ name: 'a', patch: 'organ', events: [[0, 'C4']] }], { master: { style: 'bright-90s' } }))).toEqual(['voice', 'mix', 'ev', 'anthem']);
    expect(f(comp([{ name: 'a', patch: 'organ', chain: [{ type: 'reverb', model: 'plate' }], events: [[0, 'C4']] }]))).toContain('anthem');
    expect(f(comp([{ name: 'a', patch: 'organ', events: [[0, 'C4']] }], { band: 'anime-rock' }))).toContain('anthem'); // the band adds a plate room + trims
  });
});

describe('the arrangement helpers the packs lean on', () => {
  it('a groove can keep only some pieces (a kick part to duck by) or drop them', () => {
    const ev = (g) => expandBeatsManifest(norm(comp([{ name: 'k', instrument: 'drum-machine-909', groove: g }]))).parts[0].events.map((e) => e[1]);
    expect(new Set(ev({ style: 'trance-drive', bars: 1, only: ['kick'] }))).toEqual(new Set(['C2']));
    expect(ev({ style: 'trance-drive', bars: 1, drop: ['kick'] })).not.toContain('C2');
    expect(validateBeatsManifest(comp([{ name: 'k', instrument: 'drum-kit', groove: { style: 'eight-beat', bars: 1, only: ['cowbell'] } }])).errors.join('\n')).toMatch(/only must be a list of pieces: kick, snare/);
  });

  it('a chart part can carry an articulation on every hit and a hold; its row gate stays the trance gate', () => {
    const x = expandBeatsManifest(norm(comp([{ name: 'g', instrument: 'drop-guitar', chordVoice: 'power', rhythm: '16ths', art: 'pm', hold: 0.5, gate: { mask: [1, 0] } }], { progression: ['E5'] })));
    const e = x.parts[0].events;
    expect(e[0]).toEqual([0, ['E2', 'B2', 'E3'], 0.125, 0.9, 'pm']);
    expect(x.parts[0].gate).toEqual({ mask: [1, 0] });
    expect(x.parts[0].art).toBeUndefined();
  });
});
