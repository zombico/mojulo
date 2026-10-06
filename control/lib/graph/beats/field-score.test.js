import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { fieldScore, scoreIdentity, SCORE_MOODS, PALETTES } from './field-score.js';
import { fieldGates } from './field-gates.js';
import { INSTRUMENTS } from './instruments.js';

// The generator — machine gates on its two promises: every seed keeps the
// principles (fieldGates), and different seeds do not sound alike (variety
// counted over many seeds). None of this is an ears gate.

const MOODS = Object.keys(SCORE_MOODS);
const SEEDS = Array.from({ length: 60 }, (_, i) => (i + 1) * 7919 + 3);
const leadOf = (m) => m.parts.find((p) => p.name === 'leadA');

describe('field score: the principles hold for every seed', () => {
  it('every palette names instruments on the shelf', () => {
    for (const [flavour, P] of Object.entries(PALETTES)) for (const [role, list] of Object.entries(P)) for (const inst of list) expect(INSTRUMENTS[inst], `${flavour}.${role}: ${inst}`).toBeTruthy();
  });

  it('every mood × 60 seeds passes the field gates (valid, warning-free, layered, in budget, open seam, dynamics, motion)', () => {
    for (const mood of MOODS) for (const seed of SEEDS) {
      expect(fieldGates(fieldScore(mood, { seed }), SCORE_MOODS[mood].energy), `${mood} ${seed}`).toEqual([]);
    }
  });

  it('is deterministic: the same identity and seed give the same recipe; an identity seed and its object agree', () => {
    for (const mood of MOODS) {
      expect(JSON.stringify(fieldScore(mood, { seed: 42, identity: 7 }))).toBe(JSON.stringify(fieldScore(mood, { seed: 42, identity: 7 })));
      expect(JSON.stringify(fieldScore(mood, { seed: 42, identity: 7 }))).toBe(JSON.stringify(fieldScore(mood, { seed: 42, identity: scoreIdentity(7) })));
    }
  });

  it('teaches: an unknown mood, a missing seed', () => {
    expect(() => fieldScore('swamp', { seed: 1 })).toThrow(/the moods: plains, desert, village, forest, highlands, expedition, wayfarer/);
    expect(() => fieldScore('plains', {})).toThrow(/fresh one per cue/);
    expect(() => scoreIdentity(-1)).toThrow(/fresh one per game/);
  });
});

describe('field score: a new mood never moves an old one', () => {
  // the seven field moods, 60 seeds × 3 identities, hashed when the cue families joined (2026-10-06). New moods add
  // rows and leanings; they must not change a note of these. A legitimate change to them re-pins with a reason.
  it('plains … wayfarer are byte-identical to their pin', () => {
    const h = createHash('sha256');
    for (const mood of ['plains', 'desert', 'village', 'forest', 'highlands', 'expedition', 'wayfarer'])
      for (let s = 0; s < 60; s++) for (const id of [undefined, 7, 9001]) h.update(JSON.stringify(fieldScore(mood, { seed: s * 7919 + 3, identity: id })));
    expect(h.digest('hex')).toBe('026d068355749d75bc7bc1fbb80ff3ee656559377165cf97aa2727bf76ab8a91');
  });
});

describe('field score: different seeds do not sound alike', () => {
  it('per mood over 60 seeds: every melody differs, most keys and tempos appear, several charts and ensembles', () => {
    for (const mood of MOODS) {
      const ms = SEEDS.map((seed) => fieldScore(mood, { seed }));
      const distinct = (f) => new Set(ms.map(f)).size;
      // a melody is the whole lead line, pitches in their rhythm (two cues in one key over one chart may open alike)
      expect(distinct((m) => leadOf(m).events.map((e) => `${e[0]}:${e[1]}`).join(',')), mood).toBe(60);
      expect(distinct((m) => m.key), mood).toBeGreaterThanOrEqual(10);
      expect(distinct((m) => m.bpm), mood).toBeGreaterThanOrEqual(15);
      expect(distinct((m) => m.progression[0].chords.split(' ').slice(0, 8).join(' ')), mood).toBeGreaterThanOrEqual(3);
      expect(distinct((m) => m.parts.map((p) => p.instrument).join('+')), mood).toBeGreaterThanOrEqual(45);
    }
  });

  it('across all moods: no two recipes alike; every palette flavour and most lead instruments are used', () => {
    const all = MOODS.flatMap((mood) => SEEDS.map((seed) => fieldScore(mood, { seed })));
    expect(new Set(all.map((m) => JSON.stringify(m))).size).toBe(all.length);
    expect(new Set(SEEDS.map((s) => scoreIdentity(s).flavour)).size).toBe(Object.keys(PALETTES).length);
    expect(new Set(all.map((m) => leadOf(m).instrument)).size).toBeGreaterThanOrEqual(8);
  });
});

describe('field score: one game sounds like one score', () => {
  it('cues sharing an identity share its tonic, palette, hall and motif rhythm', () => {
    for (const idSeed of [11, 222, 3333, 44444]) {
      const id = scoreIdentity(idSeed);
      const cues = MOODS.map((mood) => [mood, fieldScore(mood, { seed: 900 + idSeed, identity: id })]);
      const basePalette = new Set(Object.values(PALETTES[id.flavour]).flat().concat('tuba', 'glockenspiel', 'timpani', 'contrabass', 'upright-bass', 'fm-bass'));
      for (const [mood, m] of cues) {
        // a mood may name its own palette (the tavern's folk) or ostinato instrument: those join the game's voices
        const M = SCORE_MOODS[mood], own = new Set([...(M.palette ? Object.values(PALETTES[M.palette]).flat() : []), ...(M.motion ? [M.motion] : []), ...(M.kit ? [M.kit] : [])]);
        const palette = new Set([...basePalette, ...own]);
        expect(m.key.replace(/m$/, ''), mood).toBe(['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'][id.tonic]);
        for (const p of m.parts) expect(palette.has(p.instrument), `${mood}: ${p.instrument} in ${id.flavour}`).toBe(true);
        if (!SCORE_MOODS[mood].dry) expect(m.room, mood).toEqual(id.room);
      }
      // the motif rhythm opens every phrase: the first bar's durations agree within an energy.
      const firstBar = (m) => { const q = m.meter ? 3 : 4, ev = leadOf(m).events, b0 = Math.floor(ev[0][0] / q); return ev.filter((e) => Math.floor(e[0] / q) === b0).map((e) => e[2]).join(','); };
      for (const energy of ['idyllic', 'adventurous']) {
        const byMeter = new Map();
        for (const [mood, m] of cues) if (SCORE_MOODS[mood].energy === energy) { const k = m.meter || '4/4'; if (!byMeter.has(k)) byMeter.set(k, new Set()); byMeter.get(k).add(firstBar(m)); }
        for (const [meter, set] of byMeter) expect(set.size, `${idSeed} ${energy} ${meter}`).toBe(1);
      }
    }
  });

  it('two games differ at the root: over 60 identities, many tonics and every flavour', () => {
    const ids = SEEDS.map(scoreIdentity);
    expect(new Set(ids.map((i) => i.tonic)).size).toBe(12);
    expect(new Set(ids.map((i) => `${i.flavour}:${i.colour}:${i.leads.join('/')}`)).size).toBeGreaterThanOrEqual(30);
  });
});
