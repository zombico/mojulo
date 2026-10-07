/**
 * field-score — open-country and field music generated from the field-orchestra principles.
 *
 *   const id = scoreIdentity(gameSeed);                    // one per game: key, palette, hall, motif
 *   fieldScore('highlands', { seed: cueSeed, identity: id }) → a beats-composition recipe
 *
 * The principles are fixed (card `beats-field-orchestra`): layers enter one at a time, three or four lines in
 * idyllic music and five in adventurous, a lead answered rather than stacked, a drone, pedal or soft bass under it,
 * one hall, no V–i at the seam, idyllic under mezzo forte and adventurous under forte. Everything inside them is
 * rolled from the seeds:
 * - The IDENTITY is one per game. It sets the home tonic, a palette flavour (orchestral, folk, chamber, synth-era,
 *   silk-road) and its instruments per role, the hall, and a motif rhythm every cue quotes. Two games differ at
 *   the root, while one game's cues sound like one score.
 * - The CUE seed sets the mode, tempo and meter, a progression from the mood's harmony family, the melodies
 *   (chord tones on the strong beats, steps between, rests), and the gear change.
 *
 * Same identity and seed, same music: pure and deterministic. Pick a fresh seed per game and per cue, or every
 * game sounds alike. The hand-written `field-moods.js` takes are the worked set this generalizes.
 */
import { INSTRUMENTS } from './instruments.js';
import { parseChord, midiOf, nameOf } from './beats-authoring.js';

// ── seeded dice ───────────────────────────────────────────────────────────────
function rngOf(...parts) {
  let h = 0x811C9DC5;
  for (const p of parts) for (const c of String(p)) { h ^= c.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  let a = h >>> 0;
  const next = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  next.pick = (list) => list[Math.floor(next() * list.length)];
  next.range = (lo, hi) => lo + Math.floor(next() * (hi - lo + 1));
  next.chance = (p) => next() < p;
  next.shuffle = (list) => { const a = list.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  return next;
}
const r3 = (x) => Math.round(x * 1000) / 1000;

// ── the palettes: instruments per role, by flavour (all on the shelf; see INSTRUMENTS) ──
// colour: the instrument heard alone first; ground: what holds the bass; lead: the melodies (the first two
// answer each other); brass: an adventurous call or a doubling; pad: distant held upper notes; motion: an
// adventurous ostinato; kit: the percussion.
export const PALETTES = {
  orchestral: { colour: ['harp', 'celesta', 'violin-3'], ground: ['cello-3', 'contrabass-3'], lead: ['flute', 'oboe', 'clarinet'], brass: ['french-horn-3', 'trumpet-3'], pad: ['violin-3', 'viola-3'], motion: ['violin-3', 'cello-3'], kit: ['orchestral-perc'] },
  folk: { colour: ['nylon-guitar', 'classical-guitar', 'banjo', 'acoustic-guitar', 'harp'], ground: ['upright-bass', 'cello-3'], lead: ['fiddle', 'harmonica', 'flute', 'clarinet'], brass: ['french-horn-3', 'trumpet-3'], pad: ['violin-3', 'viola-3'], motion: ['acoustic-guitar', 'banjo', 'fiddle'], kit: ['brush-kit', 'orchestral-perc'] },
  chamber: { colour: ['marimba', 'vibraphone', 'music-box', 'celesta', 'harp'], ground: ['contrabass-3', 'cello-3', 'bassoon'], lead: ['clarinet', 'oboe', 'flute', 'vibraphone'], brass: ['french-horn-3'], pad: ['viola-3', 'violin-3'], motion: ['marimba', 'violin-3'], kit: ['orchestral-perc', 'brush-kit'] },
  'synth-era': { colour: ['fm-bell', 'trance-pluck', 'rhodes', 'fm-keys'], ground: ['poly-strings', 'string-machine', 'fm-bass'], lead: ['flute', 'fm-keys', 'oboe', 'clarinet'], brass: ['fm-brass'], pad: ['poly-strings', 'string-machine'], motion: ['trance-pluck', 'fm-keys'], kit: ['drum-machine-88', 'orchestral-perc'] },
  'silk-road': { colour: ['shamisen', 'harp', 'nylon-guitar'], ground: ['cello-3', 'contrabass-3'], lead: ['erhu', 'flute', 'oboe'], brass: ['french-horn-3'], pad: ['viola-3', 'violin-3'], motion: ['shamisen', 'violin-3'], kit: ['orchestral-perc'] },
};
const FLAVOURS = Object.keys(PALETTES);
// a pitched part's playing pattern by role, per instrument family.
const PLUCKED = /guitar|banjo|shamisen|harp/;
const MALLET = /marimba|vibraphone|celesta|music-box|glockenspiel|fm-bell|trance-pluck/;
const KEYS = /rhodes|fm-keys/;
const SUSTAIN_GROUND = /poly-strings|string-machine/;

// ── modes and harmony families (numerals in the borrowed-chord convention: minor keys spell bVII, IV …) ──
const MODE = {
  ionian: { minor: false, steps: [0, 2, 4, 5, 7, 9, 11] }, mixolydian: { minor: false, steps: [0, 2, 4, 5, 7, 9, 10] },
  lydian: { minor: false, steps: [0, 2, 4, 6, 7, 9, 11] }, dorian: { minor: true, steps: [0, 2, 3, 5, 7, 9, 10] },
  aeolian: { minor: true, steps: [0, 2, 3, 5, 7, 8, 10] }, phrygian: { minor: true, steps: [0, 1, 3, 5, 7, 8, 10] },
};
// none closes V–i: every family loops open.
const FAMILIES = {
  'open-road': { mode: 'mixolydian', charts: [['I', 'bVII', 'IV', 'I'], ['I', 'IV', 'bVII', 'IV']] },
  'plagal-sway': { mode: 'ionian', charts: [['I', 'IV', 'I', 'IV'], ['I', 'IV', 'vi', 'IV'], ['I', 'vi', 'IV', 'I']] },
  'quiet-menu': { mode: 'ionian', charts: [['I', 'IV', 'ii', 'bVII']] },
  'lydian-wonder': { mode: 'lydian', charts: [['I', 'II', 'I', 'II'], ['I', 'II', 'vii', 'II']] },
  'dorian-vamp': { mode: 'dorian', charts: [['i', 'IV', 'i', 'IV'], ['i', 'IV', 'bIII', 'bVII']] },
  'aeolian-calm': { mode: 'aeolian', charts: [['i', 'bVI', 'bIII', 'bVII'], ['i', 'bVI', 'iv', 'bVII']] },
  'tritone-road': { mode: 'aeolian', charts: [['i', 'bVI', 'bV', 'bVI']] },
  'tonic-flip': { mode: 'aeolian', charts: [['i', 'I', 'bVII', 'bVI', 'iv', 'bVI', 'bVII', 'bVII']] },
  'aeolian-march': { mode: 'aeolian', charts: [['i', 'bVII', 'bVI', 'bVII']] },
  'phrygian-ridge': { mode: 'phrygian', charts: [['i', 'bII', 'i', 'bVII'], ['i', 'bII', 'bIII', 'bII']] },
  'dorian-drive': { mode: 'dorian', charts: [['i', 'IV', 'bVII', 'IV'], ['i', 'bIII', 'IV', 'bVII']] },
  'minor-rise': { mode: 'aeolian', charts: [['i', 'bVI', 'bIII', 'bVII']] },
  'festive-mixo': { mode: 'mixolydian', charts: [['I', 'bVII', 'IV', 'I'], ['I', 'IV', 'bVII', 'I']] },
  chorale: { mode: 'ionian', charts: [['I', 'IV', 'vi', 'IV'], ['I', 'vi', 'ii', 'IV'], ['I', 'iii', 'IV', 'I']] },
  lament: { mode: 'aeolian', charts: [['i', 'iv', 'bVI', 'bVII'], ['i', 'bVI', 'iv', 'iv'], ['i', 'bIII', 'iv', 'bVI']] },
  shock: { mode: 'phrygian', charts: [['i', 'bII', 'bV', 'bII'], ['i', 'bV', 'i', 'bII']] },
  'brass-hymn': { mode: 'ionian', charts: [['I', 'IV', 'I', 'bVII'], ['I', 'bVI', 'bVII', 'I']] },
};

// ── the moods: each a set of leanings the dice roll within ────────────────────
// role: the cue's dramatic job (field, travel, town, interior, story). The optional leanings a newer mood adds:
// tempo (its own band per meter), form (its own group order), palette (instruments from that flavour in any game),
// motion (the ostinato instrument), kit (the percussion, e.g. a procession's orchestral drums), brassLead, padAlways. A row without them plays as it always has.
export const SCORE_MOODS = {
  plains: { energy: 'idyllic', role: 'field', families: ['open-road', 'plagal-sway', 'lydian-wonder'], meters: ['6/8', '6/8', '4/4', '3/4'], ground: ['drone', 'pedal'], perc: ['travel', 'none'] },
  desert: { energy: 'idyllic', role: 'field', families: ['tritone-road', 'aeolian-calm', 'dorian-vamp'], meters: ['6/8', '3/4'], ground: ['pedal', 'drone'], perc: ['travel', 'none'], dry: true, noPad: true },
  village: { energy: 'idyllic', role: 'town', families: ['quiet-menu', 'plagal-sway', 'open-road'], meters: ['4/4', '3/4'], ground: ['root-fifth'], perc: ['none', 'travel'] },
  forest: { energy: 'idyllic', role: 'field', families: ['dorian-vamp', 'lydian-wonder', 'aeolian-calm'], meters: ['4/4', '3/4', '6/8'], ground: ['pedal', 'drone'], perc: ['none'], slow: true, sparkle: true },
  highlands: { energy: 'adventurous', role: 'field', families: ['tonic-flip', 'phrygian-ridge', 'dorian-drive'], meters: ['4/4'], ground: ['root'], perc: ['travel', 'processional'], gear: [0, 5] },
  expedition: { energy: 'adventurous', role: 'field', families: ['aeolian-march', 'minor-rise', 'tonic-flip'], meters: ['4/4', '6/8'], ground: ['root'], perc: ['processional', 'march'], gear: [4, 3] },
  wayfarer: { energy: 'adventurous', role: 'travel', families: ['festive-mixo', 'open-road', 'dorian-drive'], meters: ['4/4', '6/8'], ground: ['root-fifth'], perc: ['march'], gear: [7, 5] },
  // towns and interiors
  town: { energy: 'idyllic', role: 'town', families: ['festive-mixo', 'plagal-sway', 'open-road'], meters: ['4/4', '6/8'], ground: ['root-fifth'], perc: ['travel'] },
  tavern: { energy: 'idyllic', role: 'interior', families: ['dorian-vamp', 'festive-mixo'], meters: ['6/8', '3/4'], ground: ['root-fifth'], perc: ['travel', 'none'], palette: 'folk', tempo: { '6/8': [96, 116], '3/4': [104, 124] } },
  shop: { energy: 'idyllic', role: 'interior', families: ['quiet-menu', 'plagal-sway'], meters: ['4/4', '3/4'], ground: ['root-fifth'], perc: ['none'], form: ['intro', 'A', 'B', 'A'] },
  chapel: { energy: 'idyllic', role: 'interior', families: ['chorale', 'plagal-sway'], meters: ['3/4', '4/4'], ground: ['pedal'], perc: ['none'], slow: true, padAlways: true },
  night: { energy: 'idyllic', role: 'field', families: ['lydian-wonder', 'aeolian-calm', 'dorian-vamp'], meters: ['3/4', '6/8', '4/4'], ground: ['drone'], perc: ['none'], slow: true, sparkle: true, tempo: { '4/4': [66, 80], '3/4': [72, 88], '6/8': [66, 80] } },
  ceremony: { energy: 'processional', role: 'story', families: ['chorale', 'plagal-sway', 'brass-hymn'], meters: ['4/4'], ground: ['root'], perc: ['processional'], gear: [0], brassLead: true, kit: 'orchestral-perc' },
  // story cues
  prayer: { energy: 'idyllic', role: 'story', families: ['chorale', 'plagal-sway'], meters: ['4/4', '3/4'], ground: ['pedal'], perc: ['none'], slow: true, padAlways: true, tempo: { '4/4': [66, 80], '3/4': [72, 88] } },
  sorrow: { energy: 'idyllic', role: 'story', families: ['lament', 'aeolian-calm'], meters: ['4/4', '3/4'], ground: ['drone', 'pedal'], perc: ['none'], slow: true, padAlways: true, tempo: { '4/4': [66, 80], '3/4': [72, 88] } },
  tension: { energy: 'adventurous', role: 'story', families: ['phrygian-ridge', 'tritone-road'], meters: ['4/4', '6/8'], ground: ['pedal'], perc: ['none'], gear: [0], motion: 'cello-3', tempo: { '4/4': [100, 112], '6/8': [104, 116] } },
  betrayal: { energy: 'adventurous', role: 'story', families: ['shock', 'phrygian-ridge'], meters: ['4/4'], ground: ['root'], perc: ['none'], gear: [1], motion: 'cello-3' },
  triumph: { energy: 'processional', role: 'story', families: ['festive-mixo', 'brass-hymn'], meters: ['4/4'], ground: ['root'], perc: ['processional', 'march'], gear: [2, 5], brassLead: true, kit: 'orchestral-perc' },
};
const TEMPO = { idyllic: { '4/4': [76, 100], '3/4': [84, 108], '6/8': [78, 96] }, adventurous: { '4/4': [100, 124], '6/8': [104, 128] }, processional: { '4/4': [80, 96] } };
const BAR_Q = { '4/4': 4, '3/4': 3, '6/8': 3 };
const STEPS = { '4/4': 16, '3/4': 12, '6/8': 12 };
const NOTE_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

// ── melody rhythm cells per meter (quarters; a negative is a rest) ───────────
const CELLS = {
  '4/4': { calm: [[1, 1, 2], [2, 1, 1], [1.5, 0.5, 2], [1, 0.5, 0.5, 2], [3, 1]], busy: [[0.75, 0.25, 1, 2], [0.5, 0.5, 1, 1, 1], [1, 0.5, 0.5, 1, 1], [0.75, 0.25, 0.75, 0.25, 2], [1, 1, 1, 1]], end: [[3, -1], [2, -2], [4]] },
  '3/4': { calm: [[1, 1, 1], [2, 1], [1.5, 0.5, 1], [3]], busy: [[1, 0.5, 0.5, 1], [0.75, 0.25, 1, 1], [0.5, 0.5, 1, 1]], end: [[3], [2, -1]] },
  '6/8': { calm: [[1, 0.5, 1.5], [1.5, 1.5], [3]], busy: [[1, 0.5, 1, 0.5], [0.5, 0.5, 0.5, 1.5], [0.75, 0.25, 0.5, 1.5]], end: [[3], [1.5, -1.5]] },
};

// ── ranges: where a part may sit (sounding MIDI) ─────────────────────────────
function rangeOf(inst) {
  const r = INSTRUMENTS[inst] && INSTRUMENTS[inst].range;
  return r ? [midiOf(r[0]), midiOf(r[1])] : [48, 84];
}
// a melody's working register: inside the range, off its extremes, about a twelfth wide.
function tessitura(inst) {
  const [lo, hi] = rangeOf(inst);
  const a = Math.max(lo + 4, Math.min(60, hi - 22)), b = Math.min(hi - 5, a + 19);
  return [a, b];
}

/**
 * A game's score identity: the home tonic, the palette flavour and its instruments per role, the hall, and the
 * motif rhythm every cue quotes. Pure: the same seed gives the same identity.
 */
export function scoreIdentity(seed) {
  if (!Number.isInteger(seed) || seed < 0) throw new Error('scoreIdentity: seed must be a non-negative integer (pick a fresh one per game)');
  const R = rngOf('identity', seed);
  const flavour = R.pick(FLAVOURS), P = PALETTES[flavour];
  const leads = R.shuffle(P.lead).slice(0, 2);
  return {
    seed, tonic: R.range(0, 11), flavour,
    colour: R.pick(P.colour), ground: R.pick(P.ground), leads, brass: R.pick(P.brass), pad: R.pick(P.pad), motion: R.pick(P.motion), kit: R.pick(P.kit),
    room: { model: 'room2', decay: r3(1.6 + R() * 1.6), predelay: r3(0.008 + R() * 0.024), damp: r3(0.3 + R() * 0.35) },
    motif: R.range(0, 99),
  };
}

// one bar of melody over a chord: chord tones on the strong beats, scale steps between.
function melodyBar({ cell, chordPcs, scale, prev, lo, hi, R, vel, strongEvery }) {
  const out = [];
  let t = 0, p = prev;
  const avoid = (pc) => chordPcs.some((c) => (pc - c + 12) % 12 === 1); // no minor 9th over a chord tone
  const inRange = (x) => x >= lo && x <= hi;
  for (const d of cell) {
    if (d < 0) { t += -d; continue; }
    const strong = Math.abs(t / strongEvery - Math.round(t / strongEvery)) < 1e-9;
    let next;
    if (strong) {
      const cands = [];
      for (let x = lo; x <= hi; x++) if (chordPcs.includes(x % 12)) cands.push(x);
      cands.sort((a, b) => Math.abs(a - p) + R() * 2.5 - (Math.abs(b - p) + R() * 2.5));
      next = cands.find((x) => x !== p) ?? cands[0] ?? p;
    } else {
      const dir = p > (lo + hi) / 2 + 4 ? -1 : p < (lo + hi) / 2 - 4 ? 1 : R.chance(0.5) ? 1 : -1;
      const steps = R.chance(0.8) ? 1 : 2;
      let x = p, n = 0, guard = 0;
      while (n < steps && guard++ < 24) { x += dir; if (scale.includes(((x % 12) + 12) % 12)) n++; }
      if (!inRange(x) || avoid(((x % 12) + 12) % 12)) {
        const near = []; for (let y = lo; y <= hi; y++) if (chordPcs.includes(y % 12)) near.push(y);
        near.sort((a, b) => Math.abs(a - p) - Math.abs(b - p));
        x = near[0] ?? p;
      }
      next = x;
    }
    out.push([r3(t), next, d, r3(Math.min(1, vel * (strong ? 1 : 0.9)))]);
    p = next; t += d;
  }
  return { notes: out, last: p };
}

// a mood that names a palette (the tavern's folk) or an ostinato instrument plays the identity's tonic, hall and
// motif on those voices, rolled from their own seed so the identity's own rolls stay as they are.
function voicesOf(id, M) {
  if (!M.palette && !M.motion && !M.kit) return id;
  const v = { ...id };
  if (M.palette && M.palette !== id.flavour) {
    const P = PALETTES[M.palette], Rp = rngOf('reflavour', id.seed, M.palette);
    Object.assign(v, { flavour: M.palette, colour: Rp.pick(P.colour), ground: Rp.pick(P.ground), leads: Rp.shuffle(P.lead).slice(0, 2), brass: Rp.pick(P.brass), pad: Rp.pick(P.pad), motion: Rp.pick(P.motion), kit: Rp.pick(P.kit) });
  }
  if (M.motion) v.motion = M.motion;
  if (M.kit) v.kit = M.kit;
  return v;
}

/**
 * A field cue as a beats-composition recipe.
 *   mood      one of SCORE_MOODS: fields (plains, desert, forest, night, highlands, expedition, wayfarer),
 *             towns and interiors (village, town, tavern, shop, chapel), ceremony, and story cues (prayer, sorrow,
 *             tension, betrayal, triumph)
 *   seed      the cue's seed (a non-negative integer; fresh per cue)
 *   identity  the game's scoreIdentity (or its seed); omitted, the cue takes one from its own seed
 */
export function fieldScore(mood, { seed, identity } = {}) {
  const M = SCORE_MOODS[mood];
  if (!M) throw new Error(`fieldScore: no mood '${mood}' — the moods: ${Object.keys(SCORE_MOODS).join(', ')}`);
  if (!Number.isInteger(seed) || seed < 0) throw new Error('fieldScore: seed must be a non-negative integer (pick a fresh one per cue)');
  const id = identity == null ? scoreIdentity(seed) : Number.isInteger(identity) ? scoreIdentity(identity) : identity;
  const I = voicesOf(id, M);
  const R = rngOf('cue', mood, seed, id.seed);
  const adv = M.energy === 'adventurous' || M.energy === 'processional';

  // the harmonic frame
  const family = FAMILIES[R.pick(M.families)];
  const chartBase = R.pick(family.charts);
  const mode = MODE[family.mode];
  const meter = R.pick(M.meters);
  const [t0, t1] = (M.tempo && M.tempo[meter]) || TEMPO[M.energy][meter];
  const bpm = M.slow ? R.range(t0 - 6, t0 + 8) : R.range(t0, t1);
  const barQ = BAR_Q[meter], steps = STEPS[meter];
  const key = NOTE_NAMES[id.tonic] + (mode.minor ? 'm' : '');
  const scale = mode.steps.map((s) => (s + id.tonic) % 12);
  const gear = adv ? R.pick(M.gear) : 0;

  // the form: four-bar groups. idyllic: intro, A, B, A (, B), space; adventurous: intro, A, B, A' (geared), B', A'' (home, doubled).
  const groups = M.form ? M.form.slice() : adv ? ['intro', 'A', 'B', 'A', 'B', 'A'] : R.chance(0.5) ? ['intro', 'A', 'B', 'A', 'space'] : ['intro', 'A', 'B', 'A', 'B', 'space'];
  const bars = groups.length * 4;
  const chart = []; while (chart.length < bars) chart.push(...chartBase);
  chart.length = bars;
  const chordAt = (b) => parseChord(chart[b], key);

  // the instruments (the identity's palette; a mood swaps in what it needs)
  const P = PALETTES[I.flavour];
  let colour = I.colour;
  if (mood === 'desert' && !PLUCKED.test(colour)) colour = P.colour.find((x) => PLUCKED.test(x)) || colour;
  const [leadA0, leadB0] = I.leads;
  const leadA = adv && (R.chance(0.5) || M.brassLead) ? I.brass : leadA0;
  const leadB = leadA === I.brass ? leadA0 : leadB0;
  const parts = [];

  // colour / motion: alone for the first two bars
  if (adv) {
    const inst = I.motion;
    const eighths = Array.from({ length: steps }, (_, i) => (i % 2 ? 0 : i % (steps === 16 ? 4 : 6) === 0 ? 0.9 : 0.7));
    if (/cello/.test(inst)) parts.push({ name: 'motion', instrument: inst, chordVoice: 'octaves', rhythm: eighths, art: 'staccato', vel: 0.55, octave: 2 });
    else if (PLUCKED.test(inst) || MALLET.test(inst) || KEYS.test(inst)) parts.push({ name: 'motion', instrument: inst, chordVoice: 'arp', arp: R.pick(['up', 'updown']), rhythm: eighths, vel: 0.55, octave: 3 });
    else parts.push({ name: 'motion', instrument: inst, chordVoice: 'upper', rhythm: eighths, art: 'staccato', vel: 0.52, octave: 4 });
  } else {
    const lilt = meter === '6/8' ? [0.8, 0, 0, 0, 0.5, 0, 0.7, 0, 0, 0, 0.5, 0] : meter === '3/4' ? [0.8, 0, 0, 0, 0.55, 0, 0, 0, 0.6, 0, 0, 0] : R.chance(0.5) ? '8ths' : [0.8, 0, 0, 0, 0.5, 0, 0.6, 0, 0.75, 0, 0, 0, 0.5, 0, 0.6, 0];
    if (/violin/.test(colour)) parts.push({ name: 'colour', instrument: colour, chordVoice: 'arp', rhythm: lilt, art: 'pizz', vel: 0.55, octave: 4 });
    else if (/banjo/.test(colour)) parts.push({ name: 'colour', instrument: colour, chordVoice: 'roll', vel: 0.5, octave: 3 });
    else parts.push({ name: 'colour', instrument: colour, chordVoice: 'arp', arp: R.pick(['up', 'updown']), rhythm: lilt, vel: MALLET.test(colour) ? 0.48 : 0.55, octave: PLUCKED.test(colour) ? 3 : 4 });
  }

  // the ground, from bar 2
  const gStyle = R.pick(M.ground);
  // a walking bass needs a bass (a cello cannot reach its low fifths); low brass may take an adventurous root.
  const BASS = { folk: 'upright-bass', 'synth-era': 'fm-bass' };
  const gInst = gStyle === 'root-fifth' ? BASS[I.flavour] || 'contrabass-3'
    : adv && gStyle === 'root' && !BASS[I.flavour] && R.chance(0.5) ? 'tuba-3' : I.ground;
  const ground = { name: 'ground', instrument: gInst, bars: [2, bars] };
  if (gStyle === 'drone' || gStyle === 'pedal') Object.assign(ground, { chordVoice: SUSTAIN_GROUND.test(gInst) ? 'pedal' : gStyle, hold: 1, vel: 0.32, octave: /contrabass|upright|fm-bass/.test(gInst) ? 1 : 2 });
  else if (gStyle === 'root-fifth') Object.assign(ground, { chordVoice: 'root-fifth', art: /contrabass|upright|cello/.test(gInst) ? 'pizz' : undefined, vel: 0.5, ...(meter === '4/4' ? {} : { rhythm: steps === 12 ? [0.85, 0, 0, 0, 0, 0, 0.7, 0, 0, 0, 0, 0] : 'half' }) });
  else Object.assign(ground, { chordVoice: 'root', rhythm: steps === 16 ? 'half' : [0.85, 0, 0, 0, 0, 0, 0.7, 0, 0, 0, 0, 0], vel: 0.5, octave: 2 });
  if (ground.art === undefined) delete ground.art;
  // keep the ground's notes inside its range (the gear change moves them up)
  {
    const [lo] = rangeOf(gInst);
    const oct = ground.octave ?? 2, lowest = Math.min(...chart.map((s, b) => { const c = chordAt(b); return c ? (oct + 1) * 12 + c.root : 99; }));
    if (lowest < lo) ground.octave = oct + 1;
    if (ground.chordVoice === 'pedal' || ground.chordVoice === 'drone') { const t = ((ground.octave ?? 2) + 1) * 12 + id.tonic; if (t < lo) ground.octave = (ground.octave ?? 2) + 1; }
  }
  parts.push(ground);

  // melodies: the identity's motif rhythm opens every phrase
  const MR = rngOf('motif', id.seed, id.motif);
  const cellsOf = (kind) => CELLS[meter][kind];
  const motifCell = MR.pick(cellsOf(adv ? 'busy' : 'calm'));
  const leadEvents = { A: [], B: [] };
  const strongEvery = meter === '4/4' ? 2 : 1.5;
  function phrase(inst, startBar, pr, velBase, shift) {
    const [lo, hi0] = tessitura(inst), hi = hi0 - shift;
    let prev = Math.round((lo + hi) / 2);
    const out = [];
    for (let k = 0; k < 4; k++) {
      const b = startBar + k, ch = chordAt(b);
      const chordPcs = ch.intervals.map((iv) => (ch.root + iv) % 12);
      const cell = k === 0 || k === 2 ? motifCell : k === 3 ? pr.pick(cellsOf('end')) : pr.pick(cellsOf(adv ? 'busy' : 'calm'));
      const { notes, last } = melodyBar({ cell, chordPcs, scale, prev, lo, hi, R: pr, vel: velBase, strongEvery });
      for (const [t, n, d, v] of notes) out.push([r3(b * barQ + t), nameOf(n), d, v]);
      prev = last;
    }
    return out;
  }
  const groupShift = (gi) => (adv && (gi === 3 || gi === 4) ? gear : 0);
  groups.forEach((g, gi) => {
    if (g !== 'A' && g !== 'B') return;
    const inst = g === 'A' ? leadA : leadB;
    const pr = rngOf('phrase', seed, id.seed, mood, gi);
    // base velocity leaves the phrase arch (`shape`) its headroom under the energy's ceiling.
    leadEvents[g].push(...phrase(inst, gi * 4, pr, adv ? 0.62 : 0.52, groupShift(gi)));
  });
  parts.push({ name: 'leadA', instrument: leadA, events: leadEvents.A, shape: 'phrase' });
  if (leadEvents.B.length) parts.push({ name: 'leadB', instrument: leadB, events: leadEvents.B, shape: 'phrase' });

  // adventurous: the last A doubled an octave down by a second voice, when it fits its range
  if (adv) {
    const last = (groups.length - 1) * 4 * barQ;
    const dInst = leadA === I.brass ? leadA0 : I.brass;
    const [dlo, dhi] = rangeOf(dInst);
    const final = leadEvents.A.filter((e) => e[0] >= last - 1e-9);
    for (const off of [-12, 0]) {
      const notes = final.map((e) => midiOf(e[1]) + off);
      if (notes.every((x) => x >= dlo && x <= dhi)) { parts.push({ name: 'double', instrument: dInst, events: final.map((e, i) => [e[0], nameOf(notes[i]), e[2], r3(e[3] * 0.85)]), shape: 'phrase' }); break; }
    }
  }

  // pad: distant upper notes in the B groups, swelling in and out (idyllic; never in a dry mood)
  if (!M.noPad && (R.chance(adv ? 0.5 : 0.75) || M.padAlways)) {
    const bs = groups.map((g, gi) => (g === 'B' ? gi : -1)).filter((x) => x >= 0);
    const segs = bs.map((gi) => [gi * 4, gi * 4 + 4]);
    parts.push({ name: 'pad', instrument: I.pad, chordVoice: 'upper', rhythm: 'whole', hold: 0.9, vel: 0.4, octave: 4, bars: segs,
      dynamics: segs.flatMap(([a, z]) => [{ at: `${a}:0:0`, to: 'pp' }, { at: `${a + 1}:0:0`, to: 'p', over: '2:0:0' }, { at: `${z - 1}:0:0`, to: 'pp', over: '1:0:0' }]) });
  }

  // idyllic sparkle: a glint on the A groups, only when there is no pad (four parts at most)
  if (!adv && M.sparkle && !parts.some((p) => p.name === 'pad')) {
    const ev = [];
    groups.forEach((g, gi) => { if (g === 'A') { const ch = chordAt(gi * 4 + 2); ev.push([r3((gi * 4 + 2) * barQ), nameOf(84 + ((ch.root + ch.intervals[ch.intervals.length > 2 ? 2 : 1]) % 12)), 1, 0.3]); } });
    parts.push({ name: 'glint', instrument: 'glockenspiel', events: ev });
  }

  // adventurous: timpani into the geared sections and home again
  const modulate = [];
  if (adv && gear) {
    modulate.push({ at: `${12}:0:0`, semitones: gear }, { at: `${20}:0:0`, semitones: -gear });
    const [tlo, thi] = rangeOf('timpani');
    let tonic = 36 + id.tonic; while (tonic < tlo) tonic += 12;
    if (tonic + gear > thi) tonic -= 12;
    // a pickup on the fifth (above or below) into the downbeat; the pickup into the return home sounds inside
    // the geared section, so it is chosen with the gear on.
    const fifthFor = (up) => [tonic + 7, tonic - 5].find((f) => f + up >= tlo && f + up <= thi);
    const ev = [];
    if (tonic >= tlo) for (const [b, up] of [[11, 0], [19, gear]]) {
      const f = fifthFor(up);
      if (f == null) continue;
      ev.push([r3((b + 1) * barQ - 1), nameOf(f), 0.5, 0.55], [r3((b + 1) * barQ - 0.5), nameOf(f), 0.5, 0.6], [r3((b + 1) * barQ), nameOf(tonic), 1, 0.68]);
    }
    if (ev.length) parts.push({ name: 'timp', instrument: 'timpani', events: ev });
  }

  // percussion: light, never at the opening
  const perc = R.pick(M.perc);
  if (perc !== 'none') {
    const style = perc === 'march' ? 'march' : perc === 'processional' ? 'processional' : 'travel';
    const end = adv ? bars : bars - 4;
    const vel = style === 'travel' ? 1 : adv ? 0.5 : 0.4;
    const groove = adv
      ? [{ style, bars: [4, 11], vel }, { style, bars: [11, 12], fills: 'section', fill: 'long-roll', vel }, { style, bars: [12, 19], vel }, { style, bars: [19, 20], fills: 'section', fill: 'long-roll', vel }, { style, bars: [20, end], vel }]
      : [{ style, bars: [4, end], vel }];
    parts.push({ name: 'perc', instrument: I.kit, groove });
  }

  const m = {
    kind: 'beats-composition', title: `${mood[0].toUpperCase()}${mood.slice(1)} ${seed}`, bpm, meter, seed, key,
    band: M.energy === 'processional' ? 'orchestra-processional' : adv ? 'orchestra-field' : 'orchestra-pastoral',
    room: M.dry ? { model: 'room2', decay: r3(Math.min(1.5, id.room.decay)), predelay: id.room.predelay, damp: 0.6 } : id.room,
    progression: [{ chords: chart.join(' ') }],
    parts,
    export: { normalize: { lufs: -20 } },
  };
  if (meter === '4/4') delete m.meter;
  if (modulate.length) m.modulate = modulate;
  return m;
}
