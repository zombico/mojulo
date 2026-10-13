/**
 * club-score — electronic game music, the second score style beside field-score's orchestra. Pure and deterministic.
 *
 *   clubScore('drive', { seed, identity, cast }) → a beats-composition recipe (a 32-bar loop)
 *   audio.soundtrack: 'club:drive' | { score: { style: 'club', mood: 'drive', game, cast } }
 *
 * The writing is what makes it electronic, not the voices: a kick on its own row with the bass, pad and stabs ducked
 * under it (the sidechain pump), a riff that repeats bar by bar under a hypnotic chart, hats on the off-beats, and a
 * form that builds and drops: intro (kick and hats) → build (the bass and the clap) → drop A (stabs and the arp) →
 * the break (no kick: the pad and the arp, a riser) → drop B (the lead riff, a crash) → out. The loop seam returns to
 * the intro's kick, never V–i.
 *
 * The game's score identity (field-score.js scoreIdentity) gives the tonic, the motif and the hall, so a game that
 * mixes field and club cues keeps one key. Each mood picks its voices from its own shelf by the identity's dice;
 * `cast` (casting.js) replaces them by job: ground = the bass, lead = the riff, colour = the stabs, motion = the arp,
 * pad = the pad, kit = the drums.
 */
import { parseChord, nameOf } from './beats-authoring.js';
import { scoreIdentity } from './field-score.js';
import { readCast } from './casting.js';

function rngOf(...parts) {
  let h = 0x811C9DC5;
  for (const p of parts) for (const c of String(p)) { h ^= c.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  let a = h >>> 0;
  const next = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  next.pick = (list) => list[Math.floor(next() * list.length)];
  next.range = (lo, hi) => lo + Math.floor(next() * (hi - lo + 1));
  next.chance = (p) => next() < p;
  return next;
}
const r3 = (x) => Math.round(x * 1000) / 1000;
const NOTE_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

// the energy ladder. drums: half (half-time, no four-on-the-floor), house (open hats on the off-beat), techno (closed
// sixteenths), rave (sixteenths, a ride of claps). Each voice list is the mood's shelf; the identity's dice pick one.
export const CLUB_MOODS = {
  drift: { tempo: [92, 104], drums: 'half', charts: [['i', 'bVI', 'bIII', 'bVII'], ['i', 'iv', 'bVI', 'bVII'], ['i', 'IV', 'i', 'IV']], bass: ['fm-bass', 'reese-bass'], lead: ['fm-bell', 'trance-pluck', 'fm-keys'], stab: ['fm-keys', 'rhodes'], arp: ['fm-bell', 'trance-pluck'], pad: ['poly-strings', 'string-machine'], kit: ['drum-machine-88', 'drum-machine-bright'], riff: 'long', says: 'a slow electronic drift: exploring, night, a lab at rest' },
  deep: { tempo: [118, 124], drums: 'house', charts: [['i', 'IV', 'i', 'IV'], ['i', 'bVII', 'bVI', 'bVII'], ['i', 'bIII', 'bVII', 'IV']], bass: ['fm-bass', 'reese-bass'], lead: ['rhodes', 'fm-keys', 'trance-pluck'], stab: ['rhodes', 'fm-keys', 'rave-stab'], arp: ['trance-pluck', 'fm-bell'], pad: ['poly-strings', 'string-machine'], kit: ['drum-machine-909', 'drum-machine-88'], riff: 'house', says: 'deep house: a hub, a menu, a city at night' },
  drive: { tempo: [126, 132], drums: 'techno', charts: [['i', 'i', 'i', 'i'], ['i', 'i', 'bII', 'i'], ['i', 'bVII', 'i', 'bVI']], bass: ['acid-bass'], lead: ['trance-pluck', 'rave-stab', 'fm-keys'], stab: ['rave-stab', 'fm-brass'], arp: ['trance-pluck', 'fm-bell'], pad: ['string-machine', 'poly-strings'], kit: ['drum-machine-909', 'drum-machine-bright'], riff: 'acid', says: 'acid techno: a chase, a race, a run against the clock' },
  rave: { tempo: [136, 140], drums: 'rave', charts: [['i', 'bVI', 'bIII', 'bVII'], ['i', 'bVI', 'bVII', 'i'], ['i', 'bII', 'bVI', 'bVII']], bass: ['reese-bass', 'wobble-bass'], lead: ['supersaw-lead', 'hoover'], stab: ['hoover', 'rave-stab'], arp: ['trance-pluck'], pad: ['poly-strings', 'string-machine'], kit: ['drum-machine-909', 'drum-machine-bright'], riff: 'offbeat', says: 'a rave: a fight, the arena' },
  peak: { tempo: [145, 150], drums: 'rave', charts: [['i', 'bVI', 'bIII', 'bVII'], ['i', 'bII', 'bVI', 'bVII']], bass: ['acid-bass', 'reese-bass'], lead: ['supersaw-lead'], stab: ['hoover', 'rave-stab'], arp: ['trance-pluck'], pad: ['poly-strings'], kit: ['drum-machine-909'], riff: 'acid', says: 'the peak: the boss, the finale' },
};
export const CLUB_MOOD_NAMES = Object.keys(CLUB_MOODS);

// the form: eight four-bar groups (32 bars)
const BREAK = [16, 20], DROPS = [8, 20], BARS = 32;
const on = (b, ...ranges) => ranges.some(([a, z]) => b >= a && b < z);

// one bar of the bass riff (16 steps): [step, degree (semitones over the chord root), length in steps, velocity]
function bassBar(kind, R, motif) {
  if (kind === 'long') return [[0, 0, 8, 0.6], [8, motif % 2 ? 7 : 0, 8, 0.5]];
  if (kind === 'house') return [[0, 0, 2, 0.7], [3, 0, 1, 0.55], [6, 12, 1, 0.6], [10, 0, 2, 0.65], [13, motif % 3 === 0 ? 7 : 10, 1, 0.55]];
  if (kind === 'offbeat') return [2, 6, 10, 14].map((s) => [s, 0, 2, 0.7]);
  // acid: every sixteenth, a seeded contour in the minor pentatonic, accents deepening the sweep
  const deg = [0, 0, 12, 3, 0, 7, 10, 0, 12, 0, 5, 0, 3, 0, 7, 12];
  const off = motif % 16;
  return Array.from({ length: 16 }, (_, s) => [s, deg[(s * 5 + off) % 16] * (R.chance(0.15) ? 0 : 1), 1, [0, 3, 6, 11, 14].includes((s + off) % 16) ? 0.85 : 0.55]);
}

/**
 * A club cue as a beats-composition recipe.
 *   mood      one of CLUB_MOODS: drift, deep, drive, rave, peak
 *   seed      the cue's seed (a non-negative integer; fresh per cue)
 *   identity  the game's scoreIdentity (or its seed); omitted, the cue takes one from its own seed
 *   cast      who plays each job (casting.js): ground = bass, lead = riff, colour = stabs, motion = arp, pad, kit
 */
export function clubScore(mood, { seed, identity, cast } = {}) {
  const M = CLUB_MOODS[mood];
  if (!M) throw new Error(`clubScore: no mood '${mood}' — the club moods: ${CLUB_MOOD_NAMES.join(', ')}`);
  if (!Number.isInteger(seed) || seed < 0) throw new Error('clubScore: seed must be a non-negative integer (pick a fresh one per cue)');
  const id = identity == null ? scoreIdentity(seed) : Number.isInteger(identity) ? scoreIdentity(identity) : identity;
  const C = readCast(cast) || {};
  const V = rngOf('club-voices', id.seed, mood);   // the game's choice of voices for this mood
  const R = rngOf('club-cue', mood, seed, id.seed);
  const voice = {
    bass: C.ground ?? V.pick(M.bass), lead: C.lead ? C.lead[0] : V.pick(M.lead), stab: C.colour ?? V.pick(M.stab),
    arp: C.motion ?? V.pick(M.arp), pad: C.pad ?? V.pick(M.pad), kit: C.kit ?? V.pick(M.kit),
  };
  const bpm = R.range(M.tempo[0], M.tempo[1]);
  const key = NOTE_NAMES[id.tonic] + 'm';
  const chartBase = R.pick(M.charts);
  const chart = Array.from({ length: BARS }, (_, b) => chartBase[b % chartBase.length]);
  const chordAt = (b) => parseChord(chart[b], key);
  const q = (b, step) => r3(b * 4 + step / 4);   // a bar and a sixteenth → quarters
  const hum = (v) => r3(Math.max(0.05, Math.min(0.9, v + (R() - 0.5) * 0.08)));
  const parts = [];

  // DRUMS: the kick on its own row (the others duck under it), hats, the clap, a crash on each drop, a snare roll in
  // the bar before drop B
  const half = M.drums === 'half';
  const kick = [], hats = [], clap = [];
  for (let b = 0; b < BARS; b++) {
    if (on(b, BREAK)) continue;
    for (const s of half ? [0, 10] : [0, 4, 8, 12]) kick.push([q(b, s), 'C2', 0.25, hum(0.85)]);
    if (b >= 4) for (const s of half ? [8] : [4, 12]) clap.push([q(b, s), 'D#2', 0.25, hum(0.7)]);
    if (M.drums === 'house') for (const s of [2, 6, 10, 14]) hats.push([q(b, s), 'A#2', 0.25, hum(0.5)]);
    else for (let s = half ? 0 : 0; s < 16; s += half ? 2 : 1) hats.push([q(b, s), 'F#2', 0.25, hum(s % 4 === 2 ? 0.6 : 0.32)]);
  }
  const fx = DROPS.map((b) => [q(b, 0), 'C#3', 2, 0.6]).concat(Array.from({ length: 8 }, (_, i) => [q(BREAK[1] - 1, 8 + i), 'D2', 0.25, r3(0.3 + i * 0.07)]));
  parts.push({ name: 'kick', instrument: voice.kit, events: kick });
  parts.push({ name: 'hats', instrument: voice.kit, events: hats });
  parts.push({ name: 'clap', instrument: voice.kit, events: clap.concat(fx).sort((a, z) => a[0] - z[0]) });

  // BASS: the riff, bar by bar on the chord's root, from the build on (not in the break); ducked by the kick
  const bassEv = [];
  const bar0 = bassBar(M.riff, R, id.motif);
  for (let b = 4; b < BARS; b++) {
    if (on(b, BREAK)) continue;
    const root = 36 + chordAt(b).root;   // C2 octave: the bass register
    const row = b % 4 === 3 && M.riff !== 'long' ? bassBar(M.riff, R, id.motif + b) : bar0;   // every fourth bar turns
    for (const [s, d, len, v] of row) bassEv.push([q(b, s), nameOf(root + d), r3(len / 4 * 0.9), hum(v)]);
  }
  parts.push({ name: 'bass', instrument: voice.bass, events: bassEv, duck: { by: 'kick', depth: 8 } });

  // STABS: chords on the off-beats in the drops; ducked
  parts.push({ name: 'stabs', instrument: voice.stab, chordVoice: 'upper', rhythm: [0, 0, 0.6, 0, 0, 0, 0.6, 0, 0, 0, 0.6, 0, 0, 0, 0.6, 0], vel: 0.55, octave: 4, bars: [[DROPS[0], BREAK[0]], [DROPS[1], 28]], duck: { by: 'kick', depth: 6 } });

  // ARP: sixteenths up the chord from the first drop through the break
  parts.push({ name: 'arp', instrument: voice.arp, chordVoice: 'arp', arp: R.pick(['up', 'updown']), rhythm: Array.from({ length: 16 }, (_, s) => (s % 4 === 0 ? 0.55 : 0.4)), vel: 0.45, octave: 4, bars: [DROPS[0], BARS] });

  // PAD: held chords from the break on; ducked
  parts.push({ name: 'pad', instrument: voice.pad, chordVoice: 'upper', rhythm: 'whole', hold: 0.95, vel: 0.6, octave: 4, bars: [BREAK[0], BARS], duck: { by: 'kick', depth: 5 } });

  // LEAD: a two-bar riff on the motif's rhythm, chord tones on the strong steps, through drop B
  const RR = rngOf('club-riff', id.seed, id.motif, seed);
  const hits = [0, 3, 6, 8, 10, 12, 14, 16, 19, 22, 24, 26, 28].filter((s, i) => i === 0 || RR.chance(0.62)).slice(0, 9);
  const leadEv = [];
  for (let b = DROPS[1]; b < 28; b += 2) {
    const ch = chordAt(b), tones = ch.intervals.map((iv) => 72 + ch.root + iv);
    let prev = tones[0];
    for (const h of hits) {
      const strong = h % 4 === 0;
      const cands = strong ? tones : tones.concat(tones.map((t) => t + 2));
      const next = cands.slice().sort((x, y) => Math.abs(x - prev) - Math.abs(y - prev))[RR.chance(0.4) ? 1 : 0] ?? prev;
      leadEv.push([q(b + Math.floor(h / 16), h % 16), nameOf(next), 0.4, r3(strong ? 0.7 : 0.58)]);
      prev = next;
    }
  }
  parts.push({ name: 'lead', instrument: voice.lead, events: leadEv });

  // FX: a riser through the break into drop B, an impact on each drop
  parts.push({ name: 'riser', cue: [{ type: 'riser', bars: 4 }], events: [`${BREAK[0]}:0:0`] });
  parts.push({ name: 'impact', cue: [{ type: 'impact' }], events: DROPS.map((b) => `${b}:0:0`) });

  return {
    kind: 'beats-composition', title: `${mood[0].toUpperCase()}${mood.slice(1)} ${seed}`, bpm, seed, key,
    room: id.room,
    progression: [{ chords: chart.join(' ') }],
    parts,
    export: { normalize: { lufs: -20 } },
  };
}

/** The club principles a machine can check. [] = all hold. */
export function clubGates(m, mood) {
  const out = [];
  const M = CLUB_MOODS[mood];
  const kick = (m.parts || []).find((p) => p.name === 'kick');
  if (!kick) return ['drums: no kick row'];
  const beats = new Set(kick.events.map((e) => e[0]));
  const drop = (b) => (M.drums === 'half' ? [b * 4] : [0, 1, 2, 3].map((k) => b * 4 + k));
  for (const b of [8, 9, 10, 11, 20, 21, 22, 23]) if (!drop(b).every((t) => beats.has(t))) { out.push(`drums: bar ${b} of a drop is missing its ${M.drums === 'half' ? 'downbeat' : 'four-on-the-floor'} kick`); break; }
  if ([16, 17, 18, 19].some((b) => drop(b).some((t) => beats.has(t)))) out.push('form: the break carries the kick');
  for (const p of m.parts) if (p.duck && !m.parts.some((x) => x.name === p.duck.by)) out.push(`duck: ${p.name} ducks under a missing row '${p.duck.by}'`);
  const chart = m.progression[0].chords.split(' ');
  const [a, z] = chart.slice(-2).map((s) => parseChord(s, m.key));
  const tonic = parseChord('i', m.key);
  if (a && z && z.root === tonic.root && a.root === (tonic.root + 7) % 12) out.push('seam: the loop closes V–i');
  const vel = Math.max(...m.parts.flatMap((p) => (p.events || []).map((e) => (Array.isArray(e) ? e[3] ?? 0 : 0))));
  if (vel > 0.9 + 1e-9) out.push(`dynamics: a hit at ${vel} (ceiling 0.9)`);
  if (m.bpm < M.tempo[0] || m.bpm > M.tempo[1]) out.push(`tempo: ${m.bpm} outside ${mood}'s ${M.tempo.join('–')}`);
  return out;
}
