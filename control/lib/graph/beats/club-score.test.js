import { createHash } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import { clubScore, clubGates, CLUB_MOODS, CLUB_MOOD_NAMES } from './club-score.js';
import { fieldScore, scoreIdentity } from './field-score.js';
import { validateBeatsManifest } from './beats-manifest.js';
import { parseFieldSpec, fieldCue } from './field-cue.js';
import { resolveWorldAudio } from './beats-world.js';
import { suggestScore, levelScoreContext, sceneStyle } from './score-suggest.js';

const SEEDS = Array.from({ length: 40 }, (_, i) => i * 7919 + 3);
const part = (m, name) => m.parts.find((p) => p.name === name);

describe('club score: the principles hold for every seed', () => {
  it('every mood × 40 seeds × 2 identities is valid, warning-free and passes the club gates', () => {
    for (const mood of CLUB_MOOD_NAMES) for (const seed of SEEDS) for (const id of [undefined, 7]) {
      const m = clubScore(mood, { seed, identity: id });
      const v = validateBeatsManifest(m);
      expect([...v.errors, ...(v.warnings || []), ...clubGates(m, mood)], `${mood} ${seed} ${id}`).toEqual([]);
    }
  });

  it('builds and drops: the kick on its own row, the bass, stabs and pad ducked under it, no kick in the break', () => {
    for (const mood of CLUB_MOOD_NAMES) {
      const m = clubScore(mood, { seed: 5, identity: 7 });
      for (const n of ['bass', 'stabs', 'pad']) expect(part(m, n).duck, `${mood} ${n}`).toMatchObject({ by: 'kick' });
      expect(part(m, 'kick').events.some((e) => e[0] >= 64 && e[0] < 80)).toBe(false);   // bars 16–19
      expect(part(m, 'bass').events[0][0]).toBeGreaterThanOrEqual(16);                     // the bass enters at the build
      expect(part(m, 'lead').events[0][0]).toBeGreaterThanOrEqual(80);                     // the riff waits for drop B
      expect(part(m, 'riser').cue[0].type).toBe('riser');
    }
    expect(part(clubScore('drive', { seed: 5 }), 'kick').events.filter((e) => e[0] < 4)).toHaveLength(4);   // four on the floor
    expect(part(clubScore('drift', { seed: 5 }), 'kick').events.filter((e) => e[0] < 4)).toHaveLength(2);   // half-time
  });

  it('the tempo stays in its band and the seeds vary', () => {
    for (const mood of CLUB_MOOD_NAMES) {
      const ms = SEEDS.map((seed) => clubScore(mood, { seed }));
      expect(ms.every((m) => m.bpm >= CLUB_MOODS[mood].tempo[0] && m.bpm <= CLUB_MOODS[mood].tempo[1])).toBe(true);
      expect(new Set(ms.map((m) => m.key)).size, mood).toBeGreaterThanOrEqual(10);
      expect(new Set(ms.map((m) => JSON.stringify(part(m, 'lead').events))).size, mood).toBeGreaterThanOrEqual(36);
    }
  });

  it("one game, one key: a club cue and a field cue sharing an identity share its tonic and hall", () => {
    for (const g of [11, 222, 3333]) {
      const id = scoreIdentity(g), c = clubScore('rave', { seed: 1, identity: g }), f = fieldScore('battle', { seed: 1, identity: g });
      expect(c.key.replace(/m$/, '')).toBe(f.key.replace(/m$/, ''));
      expect(c.room).toEqual(id.room);
    }
  });

  it('a cast replaces the voices by job and nothing else', () => {
    const plain = clubScore('rave', { seed: 9, identity: 4 });
    const cast = clubScore('rave', { seed: 9, identity: 4, cast: { ground: 'acid-bass', lead: 'hoover', colour: 'orchestra-hit', motion: 'fm-bell', pad: 'string-machine', kit: 'drum-machine-88' } });
    expect(part(cast, 'bass').instrument).toBe('acid-bass');
    expect(part(cast, 'lead').instrument).toBe('hoover');
    expect(part(cast, 'kick').instrument).toBe('drum-machine-88');
    const notes = (m) => JSON.stringify(m.parts.map((p) => p.events || p.rhythm || null));
    expect(notes(cast)).toBe(notes(plain));
    expect([cast.bpm, cast.key, cast.progression]).toEqual([plain.bpm, plain.key, plain.progression]);
  });
});

describe('club score: a new change never moves a minted cue', () => {
  // the five moods, 40 seeds × 2 identities, hashed when the club style landed (2026-10-13). A legitimate change to
  // the writing re-pins with a reason.
  it('drift … peak are byte-identical to their pin', () => {
    const h = createHash('sha256');
    for (const mood of CLUB_MOOD_NAMES) for (const seed of SEEDS) for (const id of [undefined, 7]) h.update(JSON.stringify(clubScore(mood, { seed, identity: id })));
    expect(h.digest('hex')).toBe('e3bb3bfef8643fc2c1d3f24088909e5bf33b99db56c5d29938b3cf08293796cd');
  });
});

describe('club: reached as a score style', () => {
  it("'club:<mood>' and { style: 'club' } parse; a club mood implies the style; the field and club lists teach", () => {
    expect(parseFieldSpec('club:drive')).toEqual({ mood: 'drive', style: 'club' });
    expect(parseFieldSpec({ score: { mood: 'rave', game: 3 } })).toEqual({ mood: 'rave', style: 'club', game: 3 });
    expect(parseFieldSpec('field:plains')).toEqual({ mood: 'plains' });
    expect(() => parseFieldSpec('club:plains')).toThrow(/club moods: drift, deep, drive, rave, peak/);
    expect(() => parseFieldSpec({ score: { mood: 'disco' } })).toThrow(/or the club moods/);
    expect(fieldCue({ mood: 'deep', style: 'club', seed: 4 })).toEqual(clubScore('deep', { seed: 4 }));
  });

  it('a world soundtrack: looped, and sfx auto takes the synth palette', () => {
    const a = resolveWorldAudio({ soundtrack: 'club:drive', sfx: 'auto' }, { ref: 'lab-1', mechanics: ['collect'] });
    expect(a.soundtrack).toMatchObject({ kind: 'beats-composition', loop: true });
    expect(a.palette).toBe('synth');
  });

  it('the scene picks the style; asked for, it wins', () => {
    expect(sceneStyle({ kind: 'stage', theme: 'abandoned research lab' })).toBe('club');
    expect(sceneStyle({ base: 'terrain', theme: 'forest' })).toBe('field');
    const lab = levelScoreContext({ kind: 'stage', kit: 'research-lab', title: 'x' });
    expect(suggestScore(lab)).toMatchObject({ style: 'club', audio: { soundtrack: expect.stringMatching(/^club:/) } });
    expect(suggestScore({ ...lab, goal: 'battle' }).mood).toBe('rave');
    expect(suggestScore({ ...lab, goal: 'battle', final: true }).mood).toBe('peak');
    expect(suggestScore({ ...lab, goal: 'race' }).mood).toBe('drive');
    expect(suggestScore({ ...lab, style: 'field' }).style).toBeUndefined();
    expect(suggestScore({ base: 'terrain', theme: 'forest', style: 'club' }).mood).toBe('drift');
    expect(suggestScore(lab).brief).toMatchObject({ style: 'club', energy: 'club', tempo: CLUB_MOODS[suggestScore(lab).mood].tempo });
  });
});
