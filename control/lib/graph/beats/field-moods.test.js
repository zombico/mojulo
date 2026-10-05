import { describe, expect, it } from 'vitest';

import { fieldSoundtrack, FIELD_MOODS } from './field-moods.js';
import { validateBeatsManifest, normalizeBeatsManifest } from './beats-manifest.js';
import { expandBeatsManifest, kitOf, parseChord } from './beats-authoring.js';

// The open-country moods — machine gates on the principles they claim (card
// `beats-orchestra`, "Open country"). None of this is an ears gate.

const MOODS = Object.keys(FIELD_MOODS);
const LEADS = /^(flute|oboe|clarinet|bassoon|trumpet|french-horn)$/;
// the budgets by energy: idyllic is the country at rest, adventurous is a step up.
const BUDGET = { idyllic: { parts: 4, leads: 1, vel: 0.65 }, adventurous: { parts: 5, leads: 2, vel: 0.8 } };
const expanded = (mood) => expandBeatsManifest(normalizeBeatsManifest(fieldSoundtrack(mood)));
const barLen = (m) => (m.meter === '6/8' ? 3 : 4);
// a part's sounding events: its own, plus its form's phrases placed at their bars
// (expansion leaves `form` for the kernel, so the gates place the phrases here).
function eventsOf(p, m, len) {
  const own = p.events || [];
  const placed = (p.form || []).flatMap((f) => {
    const at0 = Number(String(f.at).split(':')[0]) * len;
    return (m.phrases[f.phrase] || []).map((e) => [at0 + e[0], e[1], e[2], e[3]]);
  });
  return own.concat(placed);
}
// the bars a part sounds in.
function barsOf(p, m, len) {
  const out = new Set();
  for (const ev of eventsOf(p, m, len)) {
    const at = Array.isArray(ev) ? ev[0] : ev.at, d = Array.isArray(ev) ? ev[2] : ev.d;
    if (typeof at !== 'number') continue;
    for (let b = Math.floor(at / len); b < Math.ceil((at + (typeof d === 'number' ? d : 0.25)) / len - 1e-9); b++) out.add(b);
    out.add(Math.floor(at / len));
  }
  return out;
}
const chart = (m) => m.progression.flatMap((e) => Array(e.repeat || 1).fill(e.chords.split(/\s+/)).flat());

describe('field moods', () => {
  it('every mood is a valid, warning-free beats composition', () => {
    for (const mood of MOODS) {
      const v = validateBeatsManifest(fieldSoundtrack(mood));
      expect(v.errors || [], mood).toEqual([]);
      expect(v.warnings || [], mood).toEqual([]);
    }
  });

  it('is deterministic per seed, the seed moves it, an unknown mood teaches', () => {
    for (const mood of MOODS) {
      expect(JSON.stringify(fieldSoundtrack(mood, 3))).toBe(JSON.stringify(fieldSoundtrack(mood, 3)));
      expect(fieldSoundtrack(mood, 3).seed).not.toBe(fieldSoundtrack(mood, 4).seed);
      expect(fieldSoundtrack(mood).seed).toBe(FIELD_MOODS[mood].base);
    }
    expect(() => fieldSoundtrack('swamp')).toThrow(/the moods: plains, desert, village, forest, highlands, expedition, wayfarer/);
  });

  it('layers: the first two bars are one pitched colour alone', () => {
    for (const mood of MOODS) {
      const m = expanded(mood), len = barLen(m);
      const early = m.parts.filter((p) => !kitOf(p) && [0, 1].some((b) => barsOf(p, m, len).has(b)));
      expect(early.map((p) => p.name), mood).toHaveLength(1);
    }
  });

  it('space: the pitched parts and the leads sounding together stay inside the mood\'s budget', () => {
    for (const mood of MOODS) {
      const m = expanded(mood), len = barLen(m), B = BUDGET[FIELD_MOODS[mood].energy];
      const pitched = m.parts.filter((p) => !kitOf(p));
      const leads = pitched.filter((p) => LEADS.test(p.instrument) && p.chordVoice === undefined);
      expect(leads.every((p) => barsOf(p, m, len).size > 0), mood).toBe(true); // the gate sees the leads
      const bars = Math.max(...pitched.flatMap((p) => [...barsOf(p, m, len)]));
      for (let b = 0; b <= bars; b++) {
        expect(pitched.filter((p) => barsOf(p, m, len).has(b)).length, `${mood} bar ${b}`).toBeLessThanOrEqual(B.parts);
        expect(leads.filter((p) => barsOf(p, m, len).has(b)).length, `${mood} bar ${b}`).toBeLessThanOrEqual(B.leads);
      }
    }
  });

  it('the seam is open: the loop never closes V–i', () => {
    for (const mood of MOODS) {
      const m = fieldSoundtrack(mood), c = chart(m);
      const [a, b] = c.slice(-2).map((s) => parseChord(s, m.key));
      const tonic = parseChord(m.key.endsWith('m') ? 'i' : 'I', m.key).root;
      expect(b.root === tonic && a.root === (tonic + 7) % 12, mood).toBe(false);
    }
  });

  it('soft: idyllic stays under mezzo forte (0.65), adventurous under forte (0.8)', () => {
    for (const mood of MOODS) {
      const m = expanded(mood);
      const vels = m.parts.filter((p) => !kitOf(p)).flatMap((p) => eventsOf(p, m, barLen(m)).map((e) => (Array.isArray(e) ? e[3] : e.v)).filter((v) => typeof v === 'number'));
      expect(Math.max(...vels), mood).toBeLessThanOrEqual(BUDGET[FIELD_MOODS[mood].energy].vel);
    }
  });

  it('adventurous moods move: some part plays eight or more hits in most bars; every mood has an energy', () => {
    for (const mood of MOODS) {
      const { energy } = FIELD_MOODS[mood];
      expect(Object.keys(BUDGET), mood).toContain(energy);
      if (energy !== 'adventurous') continue;
      const m = expanded(mood), len = barLen(m);
      const hits = new Map();
      for (const p of m.parts) for (const ev of p.events || []) { const at = Array.isArray(ev) ? ev[0] : ev.at; if (typeof at !== 'number') continue; const k = `${p.name}:${Math.floor(at / len)}`; hits.set(k, (hits.get(k) || 0) + 1); }
      const bars = Math.max(...[...hits.keys()].map((k) => Number(k.split(':')[1])));
      let moving = 0;
      for (let b = 0; b <= bars; b++) if (m.parts.some((p) => (hits.get(`${p.name}:${b}`) || 0) >= 8)) moving++;
      expect(moving / (bars + 1), mood).toBeGreaterThan(0.5);
    }
  });
});
