/**
 * field-cue — the seam between the field-score generator and the tools that call it (worlds, create_beats, the
 * level-design suggestion). Pure except `mintFieldSpec`, which rolls fresh seeds at authoring time.
 *
 *   audio.soundtrack: 'field:plains'                                  // a world; the seed comes from its ref
 *   audio.soundtrack: { score: { mood: 'plains', seed: 81723, game: 4410 } }
 *   create_beats({ kind: 'beats-composition', title, score: { mood: 'highlands', game: 4410 } })
 *
 * `seed` picks the cue, `game` picks the identity (key, palette, hall, motif). Share one `game` across a game's
 * cues so they sound like one score; leave `seed` out and a fresh one is rolled, so no two games sound alike.
 * `role` is the cue's dramatic job. Battle roles belong to the battle generator, not this one.
 */
import { randomInt } from 'node:crypto';
import { SCORE_MOODS, fieldScore } from './field-score.js';

export const FIELD_ROLES = ['field', 'travel', 'town', 'interior', 'story'];
const BATTLE_ROLES = new Set(['battle', 'encounter', 'boss', 'victory']);
const FIELD_RE = /^field:([a-z-]+)$/;
const isSeed = (n) => Number.isInteger(n) && n >= 0;
const moodList = () => Object.keys(SCORE_MOODS).join(', ');

/**
 * Read a field-score request: `'field:<mood>'` or `{ score: { mood, seed?, game?, role? } }` (the bare inner
 * object is accepted too). Anything else → null, so callers fall through to their other soundtrack forms.
 * Throws a teaching error when it IS a field request but a field is wrong.
 */
export function parseFieldSpec(spec) {
  let s;
  if (typeof spec === 'string') {
    const m = FIELD_RE.exec(spec);
    if (!m) return null;
    s = { mood: m[1] };
  } else if (spec && typeof spec === 'object' && !Array.isArray(spec) && spec.score && typeof spec.score === 'object') {
    s = spec.score;
  } else if (spec && typeof spec === 'object' && typeof spec.mood === 'string' && !spec.kind) {
    s = spec;
  } else {
    return null;
  }
  if (!SCORE_MOODS[s.mood]) throw new Error(`field score: no mood '${s.mood}' — the moods: ${moodList()}`);
  for (const k of ['seed', 'game']) {
    if (s[k] !== undefined && !isSeed(s[k])) throw new Error(`field score: ${k} must be a non-negative integer (leave it out for a fresh one)`);
  }
  if (s.role !== undefined) {
    if (BATTLE_ROLES.has(s.role)) throw new Error(`field score: role '${s.role}' is battle music, which the field score does not write — use an adventurous mood (highlands, expedition, wayfarer) until the battle score lands`);
    if (!FIELD_ROLES.includes(s.role)) throw new Error(`field score: role '${s.role}' — the roles: ${FIELD_ROLES.join(', ')}`);
  }
  const out = { mood: s.mood };
  if (s.seed !== undefined) out.seed = s.seed;
  if (s.game !== undefined) out.game = s.game;
  if (s.role !== undefined) out.role = s.role;
  return out;
}

/** A fresh seed: what keeps two users' games from sounding alike. */
export function freshSeed() { return randomInt(0, 2 ** 31 - 1); }

/** Fill a parsed spec's missing seed (and game, when asked) with fresh ones. Authoring time only. */
export function mintFieldSpec(parsed, { game = false } = {}) {
  const out = { ...parsed };
  if (out.seed === undefined) out.seed = freshSeed();
  if (game && out.game === undefined) out.game = freshSeed();
  return out;
}

/** A stable seed from a stored artifact's ref: unique per world, the same on every render. */
export function seedOfRef(ref) {
  let h = 0x811C9DC5;
  for (const c of String(ref)) { h ^= c.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return h & 0x7fffffff;
}

/**
 * The cue as a beats-composition recipe. `fallbackSeed` stands in when the spec carries no seed (a stored world
 * scores from its ref). With no `game`, the identity is rolled from the cue's own seed.
 */
export function fieldCue(parsed, { fallbackSeed } = {}) {
  const seed = parsed.seed !== undefined ? parsed.seed : fallbackSeed;
  if (!isSeed(seed)) throw new Error(`field score '${parsed.mood}' needs a seed — give score.seed, or let compose_world / create_beats roll one`);
  return fieldScore(parsed.mood, { seed, identity: parsed.game });
}

// ── the suggestion: read a world and name the mood that fits it ────────────────
// First match wins; the words are checked against the world's base, kind, theme and title.
const LEANINGS = [
  { mood: 'desert', role: 'field', words: /desert|dune|sand|arid|oasis|canyon|mesa|mars|badland|steppe/, why: 'dry open ground: a plucked colour, a drone, no pad' },
  { mood: 'forest', role: 'field', words: /forest|wood|grove|jungle|swamp|marsh|glade|thicket|garden|tree/, why: 'under a canopy: slower, a modal turn, a little sparkle' },
  { mood: 'village', role: 'town', words: /village|hamlet|town|farm|market|inn|tavern|historic|harbo|cottage|homestead|plaza/, why: 'people live here: a homely chart over a walking bass' },
  { mood: 'highlands', role: 'field', words: /mountain|peak|highland|cliff|ridge|alpine|glacier|snow|crag|summit|volcan/, why: 'height and weather: a brass call over moving strings' },
  { mood: 'expedition', role: 'field', words: /ruin|cave|dungeon|crypt|tomb|expedition|frontier|wild|colony|planet|moon|asteroid|abandoned/, why: 'unknown ground: a minor march, kept quiet enough to explore over' },
  { mood: 'wayfarer', role: 'travel', words: /road|journey|travel|caravan|port|ship|sail|river|coast|bridge|train|railway/, why: 'on the move: a bright walking tune' },
  { mood: 'plains', role: 'field', words: /plain|meadow|field|grass|hill|valley|prairie|countryside|pasture|landscape|terrain|island|lake/, why: 'open country: one colour alone, a drone, a lead answered' },
];
// bases that are outdoors or level-like enough that plains is a fair default when no word matches
const OUTDOOR = new Set(['terrain', 'painted-landscape', 'controllable', 'action', 'dungeon', 'historic', 'koenigsberg', 'manji-tree', 'animal']);
// built-up or abstract places: field music is the wrong voice there (town and interior cues come later)
const URBAN = new Set(['city', 'fractal-city', 'transport-hub', 'transportation-hub', 'school', 'math', 'math-structure', 'planetary', 'subway-station', 'subway-building', 'floorplan', 'restaurant', 'store', 'mall']);
const ENERGY_ALSO = { idyllic: ['highlands', 'wayfarer'], adventurous: ['plains', 'forest'] };

/**
 * suggestFieldScore({ base, kind, theme, title, time }) → { mood, energy, role, why, also, audio } | null.
 * Null when nothing about the world calls for field music (a city block, a math structure): stay quiet then.
 */
export function suggestFieldScore({ base, kind, theme, title, time } = {}) {
  if (URBAN.has(base || kind)) return null;
  const text = [base, kind, theme, title].filter((x) => typeof x === 'string').join(' ').toLowerCase();
  let pick = LEANINGS.find((l) => l.words.test(text));
  if (!pick && OUTDOOR.has(base || kind)) pick = LEANINGS.find((l) => l.mood === 'plains');
  if (!pick) return null;
  let { mood } = pick;
  let why = pick.why;
  if (time === 'night' && SCORE_MOODS[mood].energy === 'idyllic' && mood !== 'village') { mood = 'forest'; why = 'night: the slowest, most hushed field mood'; }
  const energy = SCORE_MOODS[mood].energy;
  return {
    mood, energy, role: pick.role, why,
    also: ENERGY_ALSO[energy].filter((m) => m !== mood),
    audio: { soundtrack: `field:${mood}` },
  };
}
