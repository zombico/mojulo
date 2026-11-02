// the actor's interpretation: a read played in a style by a role; nothing given, the persona's read byte for byte
import { describe, it, expect } from 'vitest';
import { BASELINE } from './baseline.js';
import { actRead, GLANCE } from './interpret.js';
import { STYLES, STYLE_NAMES, STYLE_FLAVORS, GESTURE_WORDS, styleOf, styleErrors } from './style.js';
import { roleErrors, roleOf, STATUS } from './role.js';
import { actorReadings, readReadings } from './readings.js';
import { readScript, READ_GAZE } from '../persona/read.js';
import { deliveryOf } from '../persona/delivery.js';
import { perform } from '../face-acting/perform.js';
import { EMOTES } from '../polygonizer/figure-emotes.js';
import { FLAVORS } from '../gameworld/feel/flavor.js';
import { readFileSync } from 'node:fs';
import { personaManifest, personaReads, personaTakes, readSummary, personaErrors } from '../persona/persona.js';

const SOLO = BASELINE.solo;
const played = (style, role) => { const read = actRead({ ...SOLO, ...(style ? { style } : {}), ...(role ? { role } : {}) }); return { read, take: perform({ beats: read.beats, seconds: read.seconds, seed: 1, ...(read.intensity !== undefined ? { intensity: read.intensity } : {}) }) }; };
// (the styles chosen by their cards, not by name: the most and the least of a dial)
const most = (f) => [...STYLE_NAMES].sort((a, b) => f(STYLES[b]) - f(STYLES[a]))[0];
const least = (f) => [...STYLE_NAMES].sort((a, b) => f(STYLES[a]) - f(STYLES[b]))[0];

describe('the style cards', () => {
  it('each card is valid, and a tune of one is checked', () => {
    for (const n of STYLE_NAMES) expect(styleErrors(n)).toEqual([]);
    expect(styleErrors({ from: STYLE_NAMES[0], face: { intensity: 0.8 } })).toEqual([]);
    expect(styleOf({ from: STYLE_NAMES[0], face: { intensity: 0.8 } }).face.onset).toBe(STYLES[STYLE_NAMES[0]].face.onset);
    expect(styleErrors('mime')[0]).toMatch(/not a style/);
    expect(styleErrors({ from: STYLE_NAMES[0], gesture: { vocab: ['juggle'] } })[0]).toMatch(/vocab/);
    expect(styleErrors({ from: STYLE_NAMES[0], face: { onset: 'slow' } })[0]).toMatch(/onset/);
    expect(styleErrors({ from: STYLE_NAMES[0], mood: 1 })[0]).toMatch(/not mood/);
  });

  it('name only the body\'s gestures and the feel\'s flavors', () => {
    expect([...GESTURE_WORDS].sort()).toEqual(Object.keys(EMOTES).sort());
    expect([...STYLE_FLAVORS].sort()).toEqual(Object.keys(FLAVORS).sort());
  });

  it('a role is checked and resolved', () => {
    expect(roleErrors({ status: 'high', emote: 'wary', face: 'determined' })).toEqual([]);
    expect(roleErrors({ status: 'royal' })[0]).toMatch(/status/);
    expect(roleErrors({ mood: 'x' })[0]).toMatch(/not mood/);
    expect(roleOf({}).status).toBe('even');
  });
});

describe('actRead', () => {
  it('adds nothing where nothing is given: the persona\'s read, byte for byte', () => {
    expect(JSON.stringify(actRead(SOLO))).toBe(JSON.stringify(readScript(SOLO)));
  });

  it('is deterministic, and its seed moves its choices', () => {
    const s = STYLE_NAMES[0];
    expect(JSON.stringify(actRead({ ...SOLO, style: s }))).toBe(JSON.stringify(actRead({ ...SOLO, style: s })));
    expect(JSON.stringify(actRead({ ...SOLO, style: s, seed: 2 }))).not.toBe(JSON.stringify(actRead({ ...SOLO, style: s })));
  });

  it('a role alone plays the register its own way: its emote under every beat, its face, its status in the carriage, the register\'s gestures', () => {
    const low = Object.keys(STATUS).find((k) => STATUS[k].pitch < 0);
    const R = actRead({ ...SOLO, role: { emote: 'wary', face: 'worried', status: low } }), D = deliveryOf(SOLO.register), base = readScript(SOLO);
    expect(R.beats.every((b) => b.emote === 'wary' && b.face === 'worried')).toBe(true);
    expect(R.beats[0].head.pitch).toBe(D.head.pitch + STATUS[low].pitch);
    expect(R.body).toEqual(base.body);
    expect(R.style).toBeUndefined();
  });

  it('the voice: the slowest style reads the same script longer than the quickest', () => {
    const slow = least((c) => c.voice.rate), quick = most((c) => c.voice.rate);
    expect(actRead({ ...SOLO, style: slow }).seconds).toBeGreaterThan(actRead({ ...SOLO, style: quick }).seconds);
  });

  it('the face: the boldest style\'s face sits further from rest and moves more than the quietest\'s', () => {
    const bold = played(most((c) => c.face.intensity)), quiet = played(least((c) => c.face.intensity));
    const B = actorReadings(bold).face, Q = actorReadings(quiet).face;
    expect(B.level).toBeGreaterThan(Q.level);
    expect(B.energy).toBeGreaterThan(Q.energy);
  });

  it('the gestures: a style with no vocabulary gestures nowhere; the busiest gestures more than the stillest', () => {
    const none = STYLE_NAMES.find((n) => !STYLES[n].gesture.vocab.length);
    expect(actRead({ ...SOLO, style: none }).body).toEqual([]);
    const busy = most((c) => c.gesture.vocab.length ? c.gesture.stress + c.gesture.line : -1), still = least((c) => c.gesture.vocab.length ? c.gesture.stress + c.gesture.line : 9);
    const B = actRead({ ...SOLO, style: busy }), S = actRead({ ...SOLO, style: still });
    expect(B.body.length).toBeGreaterThan(S.body.length);
    for (const b of B.body) expect(STYLES[busy].gesture.vocab).toContain(b.gesture);
  });

  it('the gaze: a style that names its own look never meets the lens; a glance leaves the line\'s look and comes back', () => {
    const off = STYLE_NAMES.find((n) => STYLES[n].gaze.line && STYLES[n].gaze.line !== 'lens');
    expect(readReadings(actRead({ ...SOLO, style: off })).gaze.share.lens ?? 0).toBe(0);
    const R = actRead({ ...SOLO, style: { from: STYLE_NAMES[0], gaze: { glance: 1 } } }), base = readScript(SOLO);
    const long = base.lines.filter((L) => L.end - L.at >= GLANCE.shortest && !L.aside).length;
    expect(R.beats.filter((b) => b.gaze === READ_GAZE.away && b.say === undefined && b.state === 'speaking').length).toBeGreaterThanOrEqual(long);
    const none = actRead({ ...SOLO, style: { from: STYLE_NAMES[0], gaze: { glance: 0 } } });
    expect(none.beats.length).toBe(base.beats.length);
  });

  it('keeps the read\'s clock: every line spoken once, the beats in order', () => {
    for (const n of STYLE_NAMES) {
      const R = actRead({ ...SOLO, style: n });
      expect(R.beats.filter((b) => b.say !== undefined)).toHaveLength(R.lines.length);
      for (let i = 1; i < R.beats.length; i++) expect(R.beats[i].at).toBeGreaterThanOrEqual(R.beats[i - 1].at);
    }
  });
});

describe('the persona is the actor', () => {
  const s = STYLE_NAMES[0];
  it('a persona with no style and no role is the record it always was', () => {
    const P = personaManifest({ hero: 'h', reads: { a: { script: 'Hello there.' } } }).persona;
    expect(Object.keys(P)).toEqual(['hero', 'register', 'reads']);
  });

  it('a style on the persona plays every read; a read\'s own wins; its take carries the face\'s intensity', () => {
    const P = personaManifest({ hero: 'h', register: SOLO.register, style: s, reads: { a: { script: SOLO.script }, b: { script: SOLO.script, style: STYLE_NAMES[1] } } }).persona;
    const R = personaReads(P), T = personaTakes(P, R);
    expect(R.a.style).toBe(s);
    expect(R.b.style).toBe(STYLE_NAMES[1]);
    expect(T.a.intensity).toBe(STYLES[s].face.intensity);
    expect(readSummary('a', R.a).style).toBe(s);
  });

  it('a bad style or role is the persona\'s error', () => {
    expect(personaErrors({ hero: 'h', style: 'mime' }).join()).toMatch(/style/);
    expect(personaErrors({ hero: 'h', reads: { a: { script: 'Hi.', role: { status: 'royal' } } } }).join()).toMatch(/role\.status/);
  });
});

describe('the manual', () => {
  it('names every style under its actor heading (a new style is a card line too)', () => {
    const card = readFileSync(new URL('../solid-vocab/persona.md', import.meta.url), 'utf8');
    const section = card.slice(card.indexOf('## The actor'), card.indexOf('## On a screen'));
    for (const name of STYLE_NAMES) expect(section, name).toContain(`\`${name}\``);
  });
});
