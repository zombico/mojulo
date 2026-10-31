// persona: a script read in a register, one clock for the face, the captions and the body; the face a gen-7 game's only
import { describe, it, expect } from 'vitest';
import { DELIVERY, DELIVERY_NAMES, deliveryOf, deliveryErrors } from './delivery.js';
import { readScript, takeOf, parseScript, spoken, stressed } from './read.js';
import { captionCues, srt, vtt, CAPTION } from './captions.js';
import { speakerFidelity } from './fidelity.js';
import { gazeFaults } from '../face-acting/gaze.js';
import { performanceTrack, RELATIONAL_FACE_TARGETS, eyesOfWeights } from '../polygonizer/relational-face-rig.js';

const SCRIPT = `Good evening. The storm that crossed Halden Bay last night left 4,000 homes without power, and the county expects repairs to run into the weekend.

In sport, the Harbor Kings won *again* [pause] 3-2 at home. (A season's best.)`;

describe('read: a script in a register', () => {
  it('parses paragraphs, lines, pauses and asides; nothing else is markup', () => {
    const P = parseScript(SCRIPT);
    expect(P).toHaveLength(2);
    expect(P[0].map((p) => Object.keys(p)[0])).toEqual(['line', 'line']);
    expect(P[1]).toEqual([{ line: 'In sport, the Harbor Kings won *again*' }, { pause: null }, { line: '3-2 at home.' }, { aside: "A season's best." }]);
    expect(parseScript('Hold. [pause 1.5] Go.')[0][1]).toEqual({ pause: 1.5 });
    expect(() => parseScript('  ')).toThrow(/script is text/);
  });

  it('says a number as a reader does', () => {
    expect(spoken('4,000')).toBe('four thousand');
    expect(spoken('1984')).toBe('nineteen eighty four');
    expect(spoken('2005')).toBe('two thousand five');
    expect(spoken('7:30')).toBe('seven thirty');
    expect(spoken('3-2')).toBe('three to two');
    expect(spoken('21st')).toBe('twenty first');
    expect(spoken('3.5%')).toBe('three point five percent');
  });

  it('stresses the script\'s marks first, then numbers and names, at most `per` a line', () => {
    expect(stressed('Then Halden lost 40 votes.', { names: true, numbers: true, per: 1 })).toBe('Then *Halden* lost 40 votes.');
    expect(stressed('Then *we* lost 40 votes.', { names: true, numbers: true, per: 1 })).toBe('Then *we* lost 40 votes.');
    expect(stressed('Then Halden lost 40 votes.', { names: false, numbers: false, per: 0 })).toBe('Then Halden lost 40 votes.');
  });

  it('is deterministic: the same script and register, the same read and take, byte for byte', () => {
    const a = readScript({ script: SCRIPT, register: 'anchor' }), b = readScript({ script: SCRIPT, register: 'anchor' });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.stringify(takeOf(a, { seed: 3 }))).toBe(JSON.stringify(takeOf(b, { seed: 3 })));
    expect(srt(captionCues(a))).toBe(srt(captionCues(b)));
  });

  it('lays lines end to end on one clock, each word inside its line, the script\'s own tokens shown', () => {
    const R = readScript({ script: SCRIPT });
    for (let i = 0; i < R.lines.length; i++) {
      const L = R.lines[i];
      expect(L.end).toBeGreaterThan(L.at);
      if (i) expect(L.at).toBeGreaterThanOrEqual(R.lines[i - 1].end);
      expect(L.words.map((w) => w.w).join(' ')).toBe(L.text);
      for (const w of L.words) { expect(w.t).toBeGreaterThanOrEqual(L.at - 1e-3); expect(w.t + w.dur).toBeLessThanOrEqual(L.end + 1e-3); }
    }
    expect(R.lines.flatMap((L) => L.words).find((w) => w.w === '4,000')).toBeTruthy();
    expect(R.lines.at(-1).aside).toBe(true);
    expect(R.seconds).toBeGreaterThan(R.lines.at(-1).end);
  });

  it('a register changes pace, stress and carriage: the quickest reads the script sooner and leans on more', () => {
    const byRate = [...DELIVERY_NAMES].sort((a, b) => DELIVERY[a].rate - DELIVERY[b].rate), slow = byRate[0], fast = byRate.at(-1);
    const S = readScript({ script: SCRIPT, register: slow }), F = readScript({ script: SCRIPT, register: fast });
    expect(F.seconds).toBeLessThan(S.seconds);
    const emph = (R) => R.lines.flatMap((L) => L.words).filter((w) => w.emph).length;
    if (DELIVERY[fast].stress.per > DELIVERY[slow].stress.per) expect(emph(F)).toBeGreaterThan(emph(S));
    // (the same words either way: a register is how, never what)
    expect(F.lines.map((L) => L.text)).toEqual(S.lines.map((L) => L.text));
    expect(F.beats[0].head).toEqual({ ...DELIVERY[fast].head });
  });

  it('a tune is a register with its own dials, checked', () => {
    const T = deliveryOf({ from: 'anchor', rate: 1.2, gaze: { para: 'away' } });
    expect(T.name).toBe('anchor');
    expect(T.rate).toBe(1.2);
    expect(T.gaze).toEqual({ ...DELIVERY.anchor.gaze, para: 'away' });
    expect(deliveryErrors('anchor')).toEqual([]);
    expect(deliveryErrors('crooner')[0]).toMatch(/not a register/);
    expect(deliveryErrors({ from: 'anchor', rate: 5, gaze: { line: 'sky' } })).toHaveLength(2);
    expect(() => readScript({ script: SCRIPT, register: 'crooner' })).toThrow(/not a register/);
  });

  it('the face\'s take keeps the eyes on the law every frame', () => {
    const T = takeOf(readScript({ script: SCRIPT, register: 'anchor' }), { seed: 1 }), K = performanceTrack(T);
    const look = RELATIONAL_FACE_TARGETS.map((n, j) => [n, j]).filter(([n]) => n.startsWith('eyeLook'));
    for (const row of K.w) expect(gazeFaults(eyesOfWeights(Object.fromEntries(look.map(([n, j]) => [n, row[j]]))))).toEqual([]);
  });

  it('the body carries the delivery where there is no face: a gesture on a stressed word, one to close', () => {
    const name = DELIVERY_NAMES.find((n) => DELIVERY[n].body.stress && DELIVERY[n].body.close), R = readScript({ script: SCRIPT, register: name });
    const stressedWords = R.lines.flatMap((L) => L.words).filter((w) => w.emph);
    expect(R.body.filter((b) => b.cause === 'stress').map((b) => b.t)).toEqual(stressedWords.map((w) => w.t));
    expect(R.body.at(-1)).toMatchObject({ cause: 'close', gesture: DELIVERY[name].body.close });
    for (const b of R.body) expect(b.t).toBeLessThanOrEqual(R.seconds);
  });
});

describe('captions: the read\'s words as subtitles', () => {
  const R = readScript({ script: SCRIPT });
  const cues = captionCues(R);

  it('each cue is the words it shows, timed by its first and last word, never into the next', () => {
    const words = R.lines.flatMap((L) => L.words);
    expect(cues.map((c) => c.text.replace(/\n/g, ' ')).join(' ')).toBe(words.map((w) => w.w).join(' '));
    let k = 0;
    for (let i = 0; i < cues.length; i++) {
      const c = cues[i], n = c.text.split(/\s+/).length, first = words[k], last = words[k + n - 1]; k += n;
      expect(c.start).toBe(first.t);
      expect(c.end).toBeLessThanOrEqual(Math.round((last.t + last.dur) * 1000) / 1000);
      if (i + 1 < cues.length) expect(c.end).toBeLessThanOrEqual(cues[i + 1].start);
      const rows = c.text.split('\n');
      expect(rows.length).toBeLessThanOrEqual(CAPTION.rows);
      for (const r of rows) expect(r.length).toBeLessThanOrEqual(CAPTION.width);
    }
  });

  it('writes SRT and WebVTT', () => {
    expect(srt(cues)).toMatch(/^1\n00:00:00,\d{3} --> 00:00:0\d,\d{3}\n/);
    expect(vtt(cues)).toMatch(/^WEBVTT\n\n00:00:00\.\d{3} --> /);
  });
});

describe('fidelity: the face is a gen-7 game\'s, with the realistic head', () => {
  const hero = { form: 'realistic' };
  it('a gen-7 game and a realistic hero: the face', () => {
    expect(speakerFidelity({ era: 'gen-7' }, hero)).toBe('face');
    expect(speakerFidelity({ era: 'gen-7' }, { ...hero, head: 'relational' })).toBe('face');
  });
  it('anywhere else the body: a gen-6 game (the default), a stylised hero, another head', () => {
    expect(speakerFidelity({ era: 'gen-6' }, hero)).toBe('body');
    expect(speakerFidelity({}, hero)).toBe('body');
    expect(speakerFidelity({ era: 'gen-7' }, { form: 'stylised' })).toBe('body');
    expect(speakerFidelity({ era: 'gen-7' }, { ...hero, head: 'legacy' })).toBe('body');
  });
});
