/**
 * casting — what each instrument on the shelf can do in a generated score, for the agent that casts it. Pure data
 * plus the checks; nothing here changes a note.
 *
 * The generators write parts by job (field-score.js): `colour` (heard alone first, an arpeggio or roll), `ground`
 * (the bass: drone, pedal, roots or a walking line), `lead` (the melodies, two answering), `brass` (a call, or the
 * doubling of the last phrase), `pad` (held chords far off), `motion` (an ostinato), `kit` (the percussion). The agent
 * chooses who plays each job from what the scene should feel like (`score.cast`); these rows say who can, and how
 * they read. `castAdvice` reports a casting that will sound wrong (a bass that cannot reach the bass, a held chord
 * on a plucked string); a casting that cannot work at all (an unknown name, a kit on a pitched job) is refused.
 */
import { INSTRUMENTS } from './instruments.js';
import { midiOf } from './beats-authoring.js';

export const CAST_ROLES = ['colour', 'ground', 'lead', 'brass', 'pad', 'motion', 'kit'];
export const ROLE_JOBS = {
  colour: 'heard alone first, then under everything: an arpeggio, a roll or pizzicato on the chords',
  ground: 'the bass under the harmony: a drone, a pedal, roots on the beat or a walking line (needs the low notes)',
  lead: 'the melodies: two instruments that answer each other ([first, second]; one name for both)',
  brass: 'a call in the energetic moods, and the octave doubling of the last phrase (any melodic voice will do)',
  pad: 'held chords far off in the B sections (needs a sustained sound)',
  motion: 'the ostinato under an energetic or battle cue: sixteenths in battle, eighths otherwise',
  kit: 'the percussion (a kit)',
};

// family → [envelope, what it says]. env: sustain (bowed, blown, held synth), pluck, strike (struck, mallets), kit.
const FAMILY = {
  bowed: ['sustain', 'warm, singing; low is grave and heavy, high is yearning or tense'],
  brass: ['sustain', 'noble, heroic, martial; soft horns are distant and solemn, trumpets bright and declarative'],
  woodwind: ['sustain', 'pastoral, airy, intimate; flute light, oboe plaintive, clarinet warm, bassoon dry or comic'],
  plucked: ['pluck', 'folk, intimate, travelling; a nylon string is soft and Spanish, a banjo rustic'],
  'electric-guitar': ['pluck', 'rock and pop; clean is glassy, driven is aggressive'],
  bass: ['pluck', 'the low end of a band: round (picked, upright) or percussive (slap)'],
  keys: ['strike', 'domestic, reflective; a piano is intimate, an organ sacred or churchy, a clavinet funky'],
  mallet: ['strike', 'innocent, magical, toy-like; bells sacred, a vibraphone cool and jazzy'],
  synth: ['sustain', 'electronic: pads wide and nostalgic, plucks and leads bright and driving'],
  'synth-bass': ['pluck', 'electronic low end: acid squelch, a reese growl, a wobble, a round FM bass'],
  timpani: ['strike', 'ceremony and threat: rolls build, a single stroke lands'],
  kit: ['kit', 'drums'],
};

// [instrument names, family, fallback range for the unranged ones, its own words]
const ROWS = [
  [['violin', 'violin-2', 'violin-3', 'fiddle'], 'bowed'],
  [['viola', 'viola-2', 'viola-3'], 'bowed'],
  [['cello', 'cello-2', 'cello-3'], 'bowed'],
  [['contrabass', 'contrabass-2', 'contrabass-3'], 'bowed'],
  [['erhu'], 'bowed', null, 'a two-string fiddle: nasal, keening, East Asian'],
  [['trumpet', 'trumpet-2', 'trumpet-3', 'french-horn', 'french-horn-2', 'french-horn-3', 'trombone', 'trombone-2', 'trombone-3', 'tuba', 'tuba-2', 'tuba-3'], 'brass'],
  [['fm-brass'], 'brass', ['C3', 'C6'], 'a synth brass: 80s, bright and stabby'],
  [['flute', 'flute-2', 'flute-3', 'clarinet', 'clarinet-2', 'clarinet-3', 'oboe', 'oboe-2', 'oboe-3', 'bassoon', 'bassoon-2', 'bassoon-3'], 'woodwind'],
  [['harmonica'], 'woodwind', null, 'a blues harp: lonesome, the road, the frontier'],
  [['acoustic-guitar', 'acoustic-guitar-2', 'nylon-guitar', 'nylon-guitar-2', 'classical-guitar', 'classical-guitar-2', 'flamenco-guitar', 'flamenco-guitar-2', 'gypsy-jazz-guitar', 'gypsy-jazz-guitar-2', 'banjo'], 'plucked'],
  [['shamisen'], 'plucked', null, 'a three-string lute: sharp, percussive, Japanese'],
  [['harp', 'harp-2'], 'plucked', null, 'a harp: glistening, mythic, a dream or a memory'],
  [['twang-guitar', 'crunch-guitar', 'pedal-steel'], 'electric-guitar', null, 'country and roots: twang, a crunch, a steel slide crying'],
  [['electric-guitar', 'electric-clean', 'muted-guitar'], 'electric-guitar', ['E2', 'E6']],
  [['distorted-guitar', 'rock-guitar', 'rock-lead', 'lead-guitar', 'drop-guitar'], 'electric-guitar', ['B1', 'E6'], 'high gain: heavy, aggressive, a riff or a soaring solo'],
  [['picked-bass', 'slap-bass', 'upright-bass'], 'bass'],
  [['piano', 'grand-piano', 'grand-piano-2', 'grand-piano-3', 'harpsichord'], 'keys'],
  [['rhodes', 'clavinet', 'fm-keys'], 'keys', ['E2', 'G6'], 'electric keys: mellow (rhodes), funky (clavinet), glassy 80s (fm-keys)'],
  [['organ', 'organ-rotary', 'fm-organ'], 'keys', ['C2', 'C7'], 'an organ: sacred, gospel, or a rock swirl (rotary); it holds'],
  [['celesta', 'music-box', 'glockenspiel', 'xylophone', 'marimba', 'vibraphone', 'tubular-bells', 'crotales', 'steel-drum', 'fm-bell'], 'mallet', ['C4', 'C7']],
  [['poly-strings', 'string-machine'], 'synth', ['C2', 'C6'], 'a synth string pad: wide, nostalgic, 80s'],
  [['trance-pluck', 'rave-stab', 'orchestra-hit'], 'synth', ['C3', 'C6'], 'short and bright: a trance pluck, a rave stab, an 80s orchestra hit'],
  [['supersaw-lead', 'hoover'], 'synth', ['C3', 'C6'], 'huge and driving: a trance supersaw, a hoover scream'],
  [['acid-bass', 'reese-bass', 'wobble-bass', 'fm-bass'], 'synth-bass', ['E1', 'C4']],
  [['timpani'], 'timpani'],
  [['drum-kit', 'drum-kit-90s-rock', 'acoustic-kit', 'stadium-kit', 'stadium-kit-gated', 'brush-kit', 'blues-kit', 'orchestral-perc', 'latin-perc', 'palmas', 'drum-machine-88', 'drum-machine-909', 'drum-machine-bright'], 'kit'],
];
// sustained exceptions inside a plucked or struck family, and the reverse
const SUSTAINS = new Set(['organ', 'organ-rotary', 'fm-organ', 'pedal-steel', 'harmonica']);
const DECAYS = new Set(['trance-pluck', 'rave-stab', 'orchestra-hit']);

export const CASTING = {};
for (const [names, family, range, words] of ROWS) {
  for (const name of names) {
    const [env, says] = FAMILY[family];
    const r = INSTRUMENTS[name]?.range ?? range ?? null;
    CASTING[name] = {
      family,
      env: SUSTAINS.has(name) ? 'sustain' : DECAYS.has(name) ? 'pluck' : env,
      ...(r ? { low: r[0], high: r[1] } : {}),
      says: words ?? says,
    };
  }
}

/** The jobs an instrument can take: a kit only the kit; the bass needs a low end at D2 or under; a pad a sustain. */
export function rolesFor(name) {
  const c = CASTING[name];
  if (!c) return [];
  if (c.env === 'kit') return ['kit'];
  const roles = ['colour', 'lead', 'brass', 'motion'];
  if (c.low && midiOf(c.low) <= 38) roles.push('ground');
  if (c.env === 'sustain') roles.push('pad');
  return roles;
}

const asLeads = (v) => (Array.isArray(v) ? v : [v]);

/**
 * Read a `score.cast`: { colour?, ground?, lead?: name | [a, b], brass?, pad?, motion?, kit? }. Throws a teaching error
 * for what cannot work (an unknown job or instrument, a kit on a pitched job or a pitched instrument as the kit);
 * returns the cast normalized (lead as a pair).
 */
export function readCast(cast) {
  if (cast === undefined) return undefined;
  if (!cast || typeof cast !== 'object' || Array.isArray(cast)) throw new Error(`score.cast is { ${CAST_ROLES.join('?, ')}? }: an instrument for each job (get_beats_vocab({ id: 'beats-casting' }))`);
  const out = {};
  for (const [role, v] of Object.entries(cast)) {
    if (!CAST_ROLES.includes(role)) throw new Error(`score.cast.${role} is not a job — the jobs: ${CAST_ROLES.join(', ')}`);
    const names = role === 'lead' ? asLeads(v) : [v];
    if (role === 'lead' && (names.length < 1 || names.length > 2)) throw new Error('score.cast.lead is one instrument or [first, second]');
    for (const n of names) {
      if (typeof n !== 'string' || !INSTRUMENTS[n]) throw new Error(`score.cast.${role}: '${n}' is not on the shelf (get_beats_vocab({ id: 'beats-casting' }) lists them)`);
      const isKit = CASTING[n]?.env === 'kit';
      if (role === 'kit' && !isKit) throw new Error(`score.cast.kit: '${n}' is not a kit`);
      if (role !== 'kit' && isKit) throw new Error(`score.cast.${role}: '${n}' is a kit; a kit plays only the kit job`);
    }
    out[role] = role === 'lead' ? (names.length === 1 ? [names[0], names[0]] : names) : names[0];
  }
  return out;
}

/** What will sound wrong in a cast (advice; the score is written anyway). [] when every job fits. */
export function castAdvice(cast) {
  const c = readCast(cast) || {};
  const out = [];
  for (const [role, v] of Object.entries(c)) {
    for (const n of role === 'lead' ? v : [v]) {
      if (!rolesFor(n).includes(role)) {
        const row = CASTING[n];
        out.push(role === 'ground' ? `ground '${n}' reaches down only to ${row.low ?? 'C3'}: the bass will sit an octave or two high (a contrabass, tuba, bass guitar or synth bass reaches it)`
          : role === 'pad' ? `pad '${n}' does not hold a note (${row.env}): the B sections' held chords will be a ${row.env === 'pluck' ? 'string of plucks' : 'run of strikes'}`
          : `${role} '${n}' does not usually take this job`);
      }
    }
  }
  if (c.lead && c.lead[0] === c.lead[1]) out.push(`both leads are '${c.lead[0]}': the answer is the same voice (fine for a solo, but the field principle is two)`);
  return out;
}

/** Apply a read cast over an identity's voices (field-score.js): each named job replaces the identity's choice. */
export function castVoices(voices, cast) {
  if (!cast) return voices;
  const v = { ...voices };
  for (const role of ['colour', 'ground', 'brass', 'pad', 'motion', 'kit']) if (cast[role]) v[role] = cast[role];
  if (cast.lead) v.leads = cast.lead.slice();
  return v;
}
