/**
 * THE CUE SHEET — the game's score, by request (the music department's `score` chapter, chapters.js). Every department
 * that needs music asks for it where it needs it; the music department answers each request with a cue on the game's
 * one identity (beats/field-score.js scoreIdentity: its key, hall, motif), in the audio direction's style and cast
 * (audio-direction.js). The sound sheet's sibling (sound-sheet.js): solved from what the game already is, overridden
 * by writing, never stored.
 *
 *   who asks                 the request                                  its id
 *   the flow (production)    the title, the menus, the credits            title · menu · credits
 *   the levels (worlds)      each level's place                           level:<id>
 *   the foes                 a level's fights; a level's boss             fight:<id> · boss:<id>
 *   the story (cinematics)   each cinematic the flow plays                cinematic:<scene>
 *   production               the outcomes                                 victory · defeat
 *
 *   gameworld.music.cues: { '<request id>': '<mood>' | { mood, style?, seed?, cast? } | false }
 *     a mood      a field score's (beats/field-score.js SCORE_MOODS) or a club's (beats/club-score.js CLUB_MOODS)
 *     false       a chosen silence
 *   Requests that are answered alike share one cue (the menus are not three tracks).
 *
 *   cueSheet(world, { game? })  → { direction, identity, requests: [{ id, by, for, role, loop, mood, style, source:
 *                                 'own' | 'suggested' | 'stand-in' | 'silence' | 'owed', why, cue: <soundtrack word> |
 *                                 null }], owed: [line], unasked: [id] }
 *                                 (`game`: the seed the run gives the game's identity where the direction names none;
 *                                 `cue` is what a level or the flow plays: beats-world.js `audio.soundtrack`)
 *   onScore(G)                  → the game has a `music`: its levels are scored from the sheet
 *   levelScore(world, level, { game?, sheet? })  → { soundtrack?, combat? } for a level's audio, or null
 *   readCues(cues)              → cues, or throws naming the mood that is none (the world's read)
 *
 * STAND-INS: the generators have no title theme and no cue that ends yet. Until they do, the title, the menus, the
 * credits and the cinematics are answered by the nearest mood that exists, said as a stand-in and listed as owed.
 *
 * Pure: the world in, the sheet out. A game with no `music` is asked nothing by a run: its levels are what they were.
 */
import { readGameworld } from './world.js';
import { gameStages } from './levels.js';
import { worldFlow } from './game-flow.js';
import { defaultFlow } from '../game/flow.js';
import { audioDirection, readCues } from './audio-direction.js';

export { readCues };
import { suggestScore, levelScoreContext } from '../beats/score-suggest.js';
import { SCORE_MOODS } from '../beats/field-score.js';
import { CLUB_MOODS } from '../beats/club-score.js';
import { seedOfRef } from '../beats/field-cue.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const isField = (m) => Object.prototype.hasOwnProperty.call(SCORE_MOODS, m), isClub = (m) => Object.prototype.hasOwnProperty.call(CLUB_MOODS, m);
/** Whether a game's levels are scored from the sheet: it has a `music`. */
export const onScore = (G) => G?.music !== undefined;

// the flow's screens by what they ask for: the title its own, the credits their own, every other a menu
const SCREEN_ASKS = Object.freeze({ title: 'title', attract: 'title', credits: 'credits', end: 'credits' });
// what stands in until the generators have a title theme and a cue that ends: by the direction's style
const STAND_INS = Object.freeze({
  field: { title: 'wayfarer', menu: 'shop', credits: 'triumph' },
  club: { title: 'deep', menu: 'deep', credits: 'lofi' },
});
// a cinematic by its slot in the game, then by its words
const SLOT_MOODS = Object.freeze({ opening: 'ceremony', prologue: 'tension', ending: 'triumph' });
const SCENE_MOODS = [
  { test: /betray|treach|traitor/, mood: 'betrayal' }, { test: /death|dies|funeral|grave|mourn|loss|farewell|goodbye/, mood: 'sorrow' },
  { test: /pray|shrine|temple|vow|oath|bless/, mood: 'prayer' }, { test: /crown|wedding|festival|parade|ceremon/, mood: 'ceremony' },
  { test: /victor|triumph|saved|freed|peace|home/, mood: 'triumph' },
];

/** The requests (see the header): what each department asks for, before it is answered. */
function spot(world, G) {
  const out = [];
  let stages = [];
  try { stages = gameStages(world).filter((s) => !s.building?.ref); } catch { stages = []; }
  const ids = G.ids ?? Object.keys(G.levels ?? {});
  // the flow: the game's own, else the default its front and levels make
  const F = worldFlow(G)?.flow ?? defaultFlow({ levels: ids, ...(G.front !== undefined ? { front: G.front } : {}) });
  const steps = Object.values(isObj(F?.steps) ? F.steps : {});
  const asks = new Set(steps.filter((s) => s?.kind === 'screen').map((s) => SCREEN_ASKS[s.screen] ?? 'menu'));
  for (const a of ['title', 'menu', 'credits']) if (asks.has(a)) out.push({ id: a, by: 'flow', for: a === 'title' ? 'the title screen' : a === 'menu' ? 'the menus (levels, options, results)' : 'the credits', role: a, loop: a !== 'credits' });
  // the story's cinematics the flow plays
  const moments = new Map((G.story ?? []).map((m) => [m.id, m]));
  for (const s of steps.filter((x) => x?.kind === 'cinematic' && typeof x.scene === 'string')) {
    if (out.some((r) => r.id === `cinematic:${s.scene}`)) continue;
    out.push({ id: `cinematic:${s.scene}`, by: 'story', for: `the cinematic '${s.scene}'`, role: 'story', loop: false, scene: s.scene, slot: moments.get(s.scene)?.when?.slot ?? null });
  }
  // each level's place; its fights where it fields foes; its boss
  ids.forEach((id, i) => {
    const L = G.levels?.[id] ?? {}, stage = stages.find((s) => s.level === id)?.manifest ?? null;
    out.push({ id: `level:${id}`, by: 'levels', for: `the level '${id}'`, role: 'place', loop: true, level: id, stage, final: ids.length > 1 && i === ids.length - 1 });
    if (L.foes !== undefined || L.goal?.gauntlet) out.push({ id: `fight:${id}`, by: 'foes', for: `the fights of '${id}'`, role: 'battle', loop: true, level: id });
    if (L.goal?.boss) out.push({ id: `boss:${id}`, by: 'foes', for: `the boss of '${id}'`, role: 'boss', loop: true, level: id });
  });
  // the outcomes
  out.push({ id: 'victory', by: 'build', for: 'a level won', role: 'stinger', loop: false }, { id: 'defeat', by: 'build', for: 'a level lost', role: 'stinger', loop: false });
  return out;
}

// the level's place in words the suggestion reads: its stage's own, and the world's kit and weather (a composed game's
// stages carry none of their own)
function placeContext(G, R) {
  const c = levelScoreContext(R.stage ?? {}, { final: R.final });
  const theme = [c.theme, G.style?.kit, G.style?.weather, R.level].filter((x) => typeof x === 'string').join(' ');
  return { ...c, theme, climate: [c.climate, typeof G.style?.weather === 'string' ? G.style.weather : ''].filter(Boolean).join(' '), mechanics: [] };
}

/** The game's cue sheet (see the header). */
export function cueSheet(world, { game = null } = {}) {
  const G = readGameworld(world);
  const D = audioDirection(G, { game }), own = readCues(G.music?.cues), identity = D.identity;
  const requests = spot(world, G), owed = [];
  const styleOf = (mood, said) => said ?? (isClub(mood) && !isField(mood) ? 'club' : isField(mood) && !isClub(mood) ? 'field' : D.style);
  const cueOf = (R, mood, style, extra = {}) => ({ score: {
    mood, ...(style === 'club' ? { style: 'club' } : {}),
    ...(identity !== null ? { game: identity } : {}),
    // (a flow's cue has no world ref to seed it: its own request's; a level's is its level's ref, as it ever was)
    ...(extra.seed !== undefined ? { seed: extra.seed } : R.by === 'levels' || R.by === 'foes' ? {} : { seed: seedOfRef(`${identity ?? 0}:${R.role}:${mood}`) }),
    ...(extra.cast ?? D.cast ? { cast: { ...(D.cast ?? {}), ...(extra.cast ?? {}) } } : {}),
  } });
  const rows = requests.map((R) => {
    const mine = own[R.id], base = { id: R.id, by: R.by, for: R.for, role: R.role, loop: R.loop };
    if (mine === false) return { ...base, mood: null, style: null, source: 'silence', why: 'the game says so: silence', cue: null };
    if (mine !== undefined) {
      const mood = typeof mine === 'string' ? mine : mine.mood, style = styleOf(mood, isObj(mine) ? mine.style : undefined);
      return { ...base, mood, style, source: 'own', why: 'the game says so', cue: cueOf(R, mood, style, isObj(mine) ? mine : {}) };
    }
    // the flow's: a stand-in until the title theme is written
    if (R.by === 'flow') {
      const mood = STAND_INS[D.style][R.role];
      owed.push(`${R.id}: no ${R.role === 'title' ? 'title theme' : R.role === 'menu' ? 'menu theme' : 'credits cue that ends'} yet; '${mood}' stands in`);
      return { ...base, mood, style: D.style, source: 'stand-in', why: `a stand-in (${mood}) until the game's theme is written`, cue: cueOf(R, mood, D.style) };
    }
    if (R.by === 'story') {
      const words = `${R.scene}`.toLowerCase(), mood = (R.slot && SLOT_MOODS[R.slot]) ?? SCENE_MOODS.find((x) => x.test.test(words))?.mood ?? 'tension';
      owed.push(`${R.id}: a loop stands in ('${mood}'): no cue written to the scene's length and ending yet`);
      return { ...base, mood, style: 'field', source: 'stand-in', why: `${R.slot ? `the game's ${R.slot}` : 'its words'}: ${mood}; a loop until a cue that ends is written`, cue: cueOf(R, mood, 'field') };
    }
    if (R.role === 'stinger') return { ...base, mood: R.id, style: 'field', source: 'suggested', why: `four bars, once, on the game's identity`, cue: cueOf(R, R.id, 'field') };
    if (R.role === 'place') {
      const S = suggestScore({ ...placeContext(G, R), style: D.own.style ?? 'auto' });
      const mood = S?.mood ?? (R.stage && !R.stage.building ? 'plains' : null);
      if (!mood) { owed.push(`${R.id}: its place calls for no music the generators write (a city block, a built interior): silent unless the game names a mood`); return { ...base, mood: null, style: null, source: 'owed', why: 'no mood for its place', cue: null }; }
      const style = styleOf(mood, S?.style);
      return { ...base, mood, style, source: 'suggested', why: S?.why ?? 'open country', cue: cueOf(R, mood, style) };
    }
    // a fight, a boss: the orchestra's battle and boss, an electronic game's rave and peak
    const mood = D.style === 'club' ? (R.role === 'boss' ? 'peak' : 'rave') : R.role === 'boss' ? 'boss' : 'battle';
    return { ...base, mood, style: D.style, source: 'suggested', why: R.role === 'boss' ? 'the boss: darker and faster' : 'a fight: coming in with the tension', cue: cueOf(R, mood, D.style) };
  });
  const asked = new Set(rows.map((r) => r.id));
  return { direction: D, identity, requests: rows, owed, unasked: Object.keys(own).filter((id) => !asked.has(id)) };
}

/**
 * A level's score from the sheet, for its audio: its place under it, its fights (or its boss) coming in with the
 * tension (beats/adaptive-music.js). Null: a game with no `music`, or a level whose place is silent.
 */
export function levelScore(world, level, { game = null, sheet = null } = {}) {
  const G = readGameworld(world);
  if (!onScore(G)) return null;
  const S = sheet ?? cueSheet(world, { game }), at = (id) => S.requests.find((r) => r.id === id)?.cue ?? null;
  const place = at(`level:${level}`), fight = at(`boss:${level}`) ?? at(`fight:${level}`);
  if (!place && !fight) return null;
  return place ? { soundtrack: place, ...(fight ? { combat: fight } : {}) } : { soundtrack: fight };
}
