// actor readings: the machine gate's instrument, read on the baseline the persona plays today
import { describe, it, expect } from 'vitest';
import { BASELINE, sceneReads } from './baseline.js';
import { actorReadings, faceReadings, readReadings, laws } from './readings.js';
import { readScript, takeOf } from '../persona/read.js';
import { DELIVERY } from '../persona/delivery.js';

const solo = (register) => { const read = readScript({ script: BASELINE.solo.script, register }); return { read, take: takeOf(read) }; };

describe('the baseline scene: the persona alone, on one clock', () => {
  const S = sceneReads(BASELINE.scene);

  it('every speaker reads, and the turns follow one another without overlap in the script\'s order', () => {
    expect(Object.keys(S.actors).sort()).toEqual(['jon', 'mara']);
    const turns = Object.entries(S.actors).flatMap(([who, A]) => A.speaks.map(([at, end]) => ({ who, at, end }))).sort((a, b) => a.at - b.at);
    for (let i = 1; i < turns.length; i++) expect(turns[i].at).toBeGreaterThanOrEqual(turns[i - 1].end);
    // (the speakers' order is the script's: a turn's sentences are consecutive lines of one speaker)
    const order = turns.map((T) => T.who).filter((w, i, a) => w !== a[i - 1]);
    expect(order).toEqual(BASELINE.scene.lines.map((L) => L.who));
  });

  it('each actor listens exactly while the other speaks', () => {
    expect(S.actors.mara.listens).toEqual(S.actors.jon.speaks);
    expect(S.actors.jon.listens).toEqual(S.actors.mara.speaks);
  });

  it('refuses a line by someone outside the cast', () => {
    expect(() => sceneReads({ cast: { a: { register: 'anchor' } }, lines: [{ who: 'b', line: 'Hello.' }] })).toThrow(/not in the cast/);
  });
});

describe('the readings', () => {
  it('are deterministic', () => {
    const a = solo('anchor'), b = solo('anchor');
    expect(JSON.stringify(actorReadings(a))).toBe(JSON.stringify(actorReadings(b)));
  });

  it('tell registers apart: the quickest register reads more words a minute and moves the face more than the slowest', () => {
    const names = Object.keys(DELIVERY), byRate = [...names].sort((x, y) => DELIVERY[x].rate - DELIVERY[y].rate);
    const slow = solo(byRate[0]), quick = solo(byRate.at(-1));
    expect(readReadings(quick.read).wordsPerMin).toBeGreaterThan(readReadings(slow.read).wordsPerMin);
    expect(faceReadings(quick.take).energy).toBeGreaterThan(faceReadings(slow.take).energy);
  });

  it('read where the reader looks: the shares of its gaze cover the read', () => {
    const G = readReadings(solo('speech').read).gaze;
    expect(Object.values(G.share).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 2);
    expect(G.share.lens).toBeGreaterThan(0.5);
  });

  it('a body law reads null, with its reason, until the body plays', () => {
    const L = laws(solo('anchor'));
    for (const k of ['overlap', 'weight', 'variation', 'possible']) { expect(L[k].reads).toBeNull(); expect(L[k].note).toMatch(/no body/); }
  });

  it('law 2 reads each stressed-word gesture against its word', () => {
    const { read, take } = solo('briefing'), L = laws({ read, take });
    expect(L.stroke.reads.gestures).toBe(read.body.filter((b) => b.cause === 'stress').length);
    expect(L.stroke.reads.lead.max).toBe(0);   // (the persona puts its cue on the word)
  });

  it('law 5: the persona alone regards no partner and never listens; a read that looks at its listener does', () => {
    const S = sceneReads(BASELINE.scene), A = S.actors.mara;
    const base = laws({ read: A.read, take: takeOf(A.read), listens: A.listens }).listening.reads;
    expect(base.regard).toBe(0);
    expect(base.listeningState).toBe(0);
    // (the same read, its partner's turns spent on the listener in the listening state: what the actor will write)
    const inTurn = (t) => A.listens.some(([a, b]) => t >= a && t < b);
    const beats = [...A.read.beats, ...A.listens.map(([a]) => ({ at: a, face: 'neutral', state: 'listening', gaze: 'listener' })), ...A.listens.map(([, b]) => ({ at: b, face: 'neutral', state: 'attentive' }))]
      .filter((B) => B.state === 'listening' || !inTurn(B.at)).sort((x, y) => x.at - y.at);
    const read = { ...A.read, beats }, L = laws({ read, take: takeOf(read), listens: A.listens }).listening.reads;
    expect(L.regard).toBeGreaterThan(0.9);
    expect(L.listeningState).toBeGreaterThan(0.9);
  });

  it('a solo read has no listening to read', () => {
    expect(laws(solo('anchor')).listening.reads).toBeNull();
  });
});
