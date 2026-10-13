/**
 * score-suggest — the field score a game level calls for, read from the level itself. Pure.
 *
 * The place picks the mood first (field-cue.js suggestFieldScore: the base, theme and title words, night out of
 * doors). The play then moves it: each mood sits on a valence/arousal plane (Russell's circumplex: how pleasant, how
 * stirred), the level's mechanics, weather and place in the run add offsets to the place's point, and the nearest
 * mood wins. Mode, tempo and register carry most of what a listener hears as mood, and the cues add roughly
 * linearly (Eerola, Friberg & Bresin 2013), so a sum of offsets is a fair model. The music itself is still
 * fieldScore's; only the choice is made here. With no play in the context the answer is the place's, unchanged.
 */
import { SCORE_MOODS, moodTempo } from './field-score.js';
import { ROLE_JOBS } from './casting.js';
import { CLUB_MOODS } from './club-score.js';
import { suggestFieldScore } from './field-cue.js';

// [valence, arousal] per mood: valence −1 (dark) … 1 (bright), arousal 0 (still) … 1 (driving).
export const MOOD_PLANE = {
  plains: [0.5, 0.3], desert: [0.1, 0.3], village: [0.6, 0.25], forest: [0.3, 0.2], highlands: [0.4, 0.6],
  expedition: [-0.1, 0.55], wayfarer: [0.6, 0.6], town: [0.6, 0.4], tavern: [0.6, 0.45], shop: [0.5, 0.2],
  chapel: [0.3, 0.1], night: [0.1, 0.1], ceremony: [0.4, 0.5], prayer: [0.2, 0.05], sorrow: [-0.6, 0.1],
  tension: [-0.5, 0.65], betrayal: [-0.7, 0.7], triumph: [0.8, 0.75],
  battle: [-0.3, 0.85], boss: [-0.6, 0.95], victory: [0.9, 0.8], defeat: [-0.8, 0.15],
};
// Where the play may move a level: the moods that say an energy, not a place. A place mood (desert, tavern, chapel …)
// is kept when the place asks for it and never reached from another; story moods that mark one moment (prayer,
// sorrow, betrayal, ceremony) are never reached at all. Tension crosses any role (a fight happens anywhere); triumph
// is only for the run's last level (CROSS).
const MOVES = ['highlands', 'expedition', 'wayfarer', 'night', 'tension'];
const CROSS = new Set(['tension', 'triumph']);
const ROLE_STEP = 0.25; // the cost of leaving the place's role (a field level stays field music unless pushed hard)

// A FIGHT (foes with hp, defeat-all, waves, or a battle / shoot / defend goal) is scored as battle music, the boss on
// the run's last level: the place still says the identity, the fight says the cue. Everything else moves the point.
const FIGHT = new Set(['hp-pool', 'defeat-all', 'waves']);
const isFight = (c) => c.mechanics.some((k) => FIGHT.has(k)) || c.goal === 'battle' || c.goal === 'shoot' || c.goal === 'defend';
// what the play does to the point: [valence, arousal, why]
const DANGER = new Set(['hazard-damage', 'fail-on-death']);
const PLAY = [
  { when: (c) => c.mechanics.some((k) => DANGER.has(k)), d: [-0.2, 0.25], why: 'danger underfoot: a darker, warier turn' },
  { when: (c) => c.mechanics.includes('unseen') || c.goal === 'sneak', d: [-0.7, 0.4], why: 'stealth: held breath, a minor pedal' },
  { when: (c) => c.mechanics.includes('laps') || c.goal === 'race', d: [0.1, 0.4], why: 'a race: a driving pulse' },
  { when: (c) => c.mechanics.includes('survive') || c.goal === 'avoid', d: [-0.1, 0.3], why: 'against the clock: more urgency' },
  { when: (c) => c.mechanics.includes('collect') || c.mechanics.includes('crops') || c.goal === 'collect' || c.goal === 'farm', d: [0.1, 0], why: 'gathering: a lighter step' },
  { when: (c) => c.final, d: [0, 0.15], why: 'the last level: a lift for the finish' },
];
const STORMY = /rain|storm|downpour|thunder|monsoon|blizzard|storm-coast/;
const SNOWY = /snow|alpine/;
const WEATHER = [
  { when: (c) => STORMY.test(c.climate), d: [-0.1, 0.05], why: 'a storm: darker and restless' },
  { when: (c) => !STORMY.test(c.climate) && SNOWY.test(c.climate), d: [0, -0.1], why: 'snow: stiller' },
];

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

// a stage kit's place in words, for the kits whose name carries none (the rest read as they are: trail-valley,
// jungle-trail, isekai-meadow, island-plaza …).
const KIT_PLACES = { 'gothic-stone': 'dungeon crypt', 'gothic-nave': 'cathedral', 'isekai-bamboo': 'bamboo grove', 'isekai-sakura': 'garden', 'alien-night': 'alien planet', 'research-lab': 'abandoned research lab' };

// ── the style: the orchestra (field) or electronic (club) ─────────────────────
// A scene whose words say the future, a machine, a screen or a dance floor is scored electronic. The point the place
// and play reached on the plane says the energy; the nearest club mood takes it (a fight is a rave, the last fight the
// peak, a race a drive, exploring a drift or a deep groove).
const CLUB_WORDS = /sci-?fi|neon|cyber|futur|robot|android|\bmech|space|station|alien|planet|\blab\b|laborator|reactor|synth|\bclub|\brave|disco|arcade|hacker|matrix|digital|virtual|\bgrid|tron\b/;
export const CLUB_PLANE = { drift: [0.1, 0.25], deep: [0.4, 0.45], drive: [0, 0.7], rave: [-0.3, 0.85], peak: [-0.5, 0.95] };
const placeText = (c) => [c.base, c.kind, c.theme, c.title].filter((x) => typeof x === 'string').join(' ').toLowerCase();
/** 'club' when the scene's words say electronic, else 'field'. */
export function sceneStyle(context = {}) {
  return CLUB_WORDS.test(placeText(context)) ? 'club' : 'field';
}

/**
 * The scoring context a level manifest carries: its place words (base, kind, theme, a stage's kit, title), its time and weather,
 * and the kinds of its game mechanics. `goal` (a design_game quick goal) and `final` (the run's last level) come from
 * the caller, which knows the game around the level.
 */
export function levelScoreContext(manifest = {}, { goal = null, final = false } = {}) {
  const w = manifest.weather;
  const climate = typeof w === 'string' ? w : w && typeof w.climate === 'string' ? w.climate : w && w.climate && typeof w.climate === 'object' ? Object.keys(w.climate).join(' ') : '';
  const mechanics = Array.isArray(manifest.game?.mechanics) ? manifest.game.mechanics.map((m) => m && m.kind).filter(Boolean) : [];
  return {
    base: manifest.base, kind: manifest.kind, title: manifest.title,
    theme: [manifest.theme, typeof manifest.kit === 'string' ? KIT_PLACES[manifest.kit] ?? manifest.kit : null].filter((x) => typeof x === 'string' && x).join(' ') || undefined,
    time: manifest.time ?? manifest.lighting?.time, climate, mechanics, goal, final: !!final,
  };
}

// a point on the plane in words, for a brief
const feelingOf = ([v, a]) => `${v > 0.35 ? 'bright' : v > 0 ? 'warm' : v > -0.4 ? 'shadowed' : 'dark'}, ${a > 0.7 ? 'driving' : a > 0.45 ? 'moving' : a > 0.2 ? 'easy' : 'still'}`;

/**
 * The brief for the agent who casts the cue: what it should feel like (valence, arousal, in words), its tempo band,
 * and the jobs to cast (score.cast; card beats-casting). The music is written either way; the cast is a choice.
 */
export function scoreBrief(mood, style = 'field') {
  const club = style === 'club';
  const at = club ? CLUB_PLANE[mood] : MOOD_PLANE[mood];
  if (!at) return null;
  return {
    feeling: feelingOf(at), valence: at[0], arousal: at[1], style,
    tempo: club ? CLUB_MOODS[mood].tempo.slice() : moodTempo(mood), energy: club ? 'club' : SCORE_MOODS[mood].energy,
    ...(club ? { says: CLUB_MOODS[mood].says } : {}),
    cast: {
      jobs: club ? ['ground (the bass)', 'lead (the riff)', 'colour (the stabs)', 'motion (the arp)', 'pad', 'kit'] : Object.keys(ROLE_JOBS),
      how: "optional: score.cast = { <job>: '<instrument>' } for the feeling wanted; get_beats_vocab({ id: 'beats-casting' })",
    },
  };
}

/**
 * suggestScore(context) → { mood, energy, role, why, also, audio, place, brief, style? } | null. `context.style` is
 * 'field', 'club' or 'auto' (the default: read from the scene's words, sceneStyle). `context` is levelScoreContext's
 * shape (any part may be absent). `place` is the mood the place alone asked for, so a caller can say what the play
 * changed. Null when the place calls for no field music (a city block, a math structure).
 */
export function suggestScore(context = {}) {
  const f = suggestFieldOnly(context);
  if (!f) return null;
  // the style: asked for, or read from the scene ('auto', the default)
  const style = context.style === 'field' || context.style === 'club' ? context.style : sceneStyle(context);
  if (style !== 'club') return f.result;
  // the club ladder from the point the place and play reached: a fight is a rave (the last one the peak); otherwise
  // the nearest of drift, deep and drive (the peak too on the last level)
  const reach = f.fight ? [f.final ? 'peak' : 'rave'] : ['drift', 'deep', 'drive', ...(f.final ? ['peak'] : [])];
  // energy carries a club cue more than brightness does: valence counts half
  const near = (m) => Math.hypot((CLUB_PLANE[m][0] - f.target[0]) * 0.5, CLUB_PLANE[m][1] - f.target[1]);
  const ranked = reach.slice().sort((a, b) => near(a) - near(b));
  const mood = ranked[0];
  const also = f.fight ? (f.final ? ['rave', 'drive'] : ['drive', 'peak']) : ranked.slice(1, 3);
  return {
    mood, style: 'club', energy: 'club', role: f.result.role, place: f.result.place, field: f.result.mood,
    why: `${f.result.why}; electronic for the scene: ${mood} (${CLUB_MOODS[mood].says})`,
    also, audio: { soundtrack: `club:${mood}` }, brief: scoreBrief(mood, 'club'),
  };
}

// the orchestral answer (the place's mood, a fight's battle cue, or the place moved by its play), with the point on
// the plane it reached, for the club ladder
function suggestFieldOnly(context) {
  const place = suggestFieldScore(context);
  if (!place) return null;
  const c = { mechanics: [], climate: '', ...context };
  c.climate = String(c.climate || '').toLowerCase();
  if (isFight(c)) {
    const mood = c.final ? 'boss' : 'battle', { energy, role } = SCORE_MOODS[mood];
    const why = `${place.mood} for the place; ${c.final ? 'the last fight: the boss, darker and faster' : 'a fight: battle music, the orchestra played as a band'}`;
    return { fight: true, final: c.final, target: MOOD_PLANE[mood], result: { mood, energy, role, why, also: c.final ? ['battle', 'tension'] : ['tension', 'expedition'], audio: { soundtrack: `field:${mood}` }, place: place.mood, brief: scoreBrief(mood) } };
  }
  const pushes = [...PLAY, ...WEATHER].filter((p) => p.when(c));
  const at = MOOD_PLANE[place.mood];
  if (!pushes.length) return { final: c.final, target: at, result: { ...place, place: place.mood, brief: scoreBrief(place.mood) } };
  const target = pushes.reduce((p, x) => [p[0] + x.d[0], p[1] + x.d[1]], at);
  const cost = (m) => dist(MOOD_PLANE[m], target) + (CROSS.has(m) || SCORE_MOODS[m].role === place.role ? 0 : ROLE_STEP);
  const reach = [...new Set([place.mood, ...MOVES, ...(c.final ? ['triumph'] : [])])];
  const ranked = reach.sort((a, b) => cost(a) - cost(b) || Object.keys(MOOD_PLANE).indexOf(a) - Object.keys(MOOD_PLANE).indexOf(b));
  const mood = ranked[0];
  const { energy, role } = SCORE_MOODS[mood];
  const why = [mood === place.mood ? place.why : `${place.mood} for the place, moved to ${mood}`, ...pushes.map((p) => p.why)].join('; ');
  return { final: c.final, target, result: { mood, energy, role, why, also: ranked.slice(1, 3), audio: { soundtrack: `field:${mood}` }, place: place.mood, brief: scoreBrief(mood) } };
}
