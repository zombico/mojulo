/**
 * A PLATFORMER'S FIRST LEVEL — the team's output unit and the production's vertical slice (production.js: the first level
 * the creator accepts): trails linked one after another, each teaching what the next tests, every gap sized by the hero's
 * reach (course.js) and every foe at its trail's density (foes.js).
 *
 *   basic     the base movement: gaps and steps the running jump clears (rolling), no foes
 *   meet      the first encounter: one long flat floor, a foe or two to learn the stomp or the blow on
 *   advanced  the card's advanced moves, each introduced past the running jump, then tested (climbing), no foes
 *   gauntlet  movement and attack together: basic gaps between floors to fight on, foes dense
 *   boss      only when the creator asks: one long floor, the level's boss (`goal.boss`), the fight its exit
 *
 * THE WIN'S KIND, the boss's (`goal: { boss: { win } }`): jobber (a throwaway boss: nothing carries on), rival or boss
 * (each a story hook by nature: a rival is met again, a boss pushes the antagonist's line on). It changes no fight, no
 * reward and no exit: it is the story's record, read by the next level's build and logged as the story accrues
 * (storyWins). The boss's rank is the fight's size; the win's kind the story's, and the two are independent.
 *
 * IN TWO DIMENSIONS (`dimension`, platformer-game.js). The teaching order is the same; what a trail is differs:
 *
 *   2d   the side-scroller's (the default): under a side camera the trails are the segments of ONE strip, one page, one
 *        turn; foes come in on the hero's rail, so the gauntlet is a swarm
 *   3d   the 3D platformer's: every trail is a COURSE of its own, a page and a turn each (played, won, the next one
 *        opened), named for where it is on the way up: the grounds (the yard movement is learned in, nothing in it to
 *        be hurt by), the meadow (the first foes), the climb (the advanced moves, each floor a tall step up), the ridge
 *        (movement and foes together, climbing) and, when asked, the summit (the boss). A foe in 3D is walked round as
 *        well as jumped, on a walkway three metres wide: none on the grounds, and dense where the strip's is a swarm
 *
 *   firstLevel({ name?, seed?, kit?, boss?, dimension? }) → a gameworld level: its walk (the trails, in order), its
 *       course and its foes' density by trail node, and its goal's boss when asked (boss: true | { win })
 *   firstLevelSegments(dimension?, boss?) → [{ id, teach, verticality, density, run }] the trails it lays, in order
 *   readBossWin(v, at) → the boss goal as written: true or { win }; throws, teaching
 *   storyWins(G) → [{ level, win }] the levels whose boss names its win, in the book's order: the story so far
 *
 * Pure: words in, a recipe out.
 */

export const WINS = Object.freeze({
  jobber: 'a throwaway boss: beaten, nothing carries on',
  rival: 'a story hook: the rival is met again (a later level\'s boss or encounter may name it)',
  boss: 'a story hook: the antagonist\'s line pushed forward (the main quest\'s beat, where the world has one)',
});

// each trail its teaching, its verticality, its foes and its run (seconds at the walk's 6 m/s: the line the course has;
// a side strip sizes each by its course instead, levels.js). A foe to stomp from the first trail on, the gauntlet a swarm
const SEGMENTS = Object.freeze([
  { id: 'basic', teach: 'basic', verticality: 'rolling', density: 'sparse', run: 16 },
  { id: 'meet', teach: 'meet', verticality: 'flat', density: 'dense', run: 12 },
  { id: 'advanced', teach: 'advanced', verticality: 'climbing', density: 'sparse', run: 24 },
  { id: 'gauntlet', teach: 'gauntlet', verticality: 'flat', density: 'swarm', run: 18 },
]);
const BOSS = Object.freeze({ id: 'boss', teach: 'boss', verticality: 'flat', density: 'none', run: 12 });
export const FIRST_LEVEL_SEGMENTS = Object.freeze([...SEGMENTS.map((s) => s.id), BOSS.id]);
// THE 3D PLATFORMER'S: a course a trail, each its own page and turn, the way up a hill (the header)
const COURSES_3D = Object.freeze([
  { id: 'grounds', teach: 'basic', verticality: 'rolling', density: 'none', run: 16 },
  { id: 'meadow', teach: 'meet', verticality: 'flat', density: 'sparse', run: 12 },
  { id: 'climb', teach: 'advanced', verticality: 'towering', density: 'sparse', run: 24 },
  { id: 'ridge', teach: 'gauntlet', verticality: 'climbing', density: 'dense', run: 18 },
]);
const SUMMIT = Object.freeze({ id: 'summit', teach: 'boss', verticality: 'flat', density: 'none', run: 12 });
export const FIRST_LEVEL_DIMENSIONS = Object.freeze(['2d', '3d']);
export const FIRST_LEVEL_COURSES = Object.freeze([...COURSES_3D.map((s) => s.id), SUMMIT.id]);

/** The trails a first level lays, in order: the strip's segments (2d), or the courses up the hill (3d). */
export function firstLevelSegments(dimension = '2d', boss = false) {
  if (!FIRST_LEVEL_DIMENSIONS.includes(dimension)) throw new Error(`firstLevel: dimension is ${FIRST_LEVEL_DIMENSIONS.join(' | ')} (a side-scroller's strip, or a 3D platformer's courses)`);
  const [segs, last] = dimension === '3d' ? [COURSES_3D, SUMMIT] : [SEGMENTS, BOSS];
  return boss ? [...segs, last] : [...segs];
}

/** A boss goal as written: true, or { win }. */
export function readBossWin(v, at) {
  if (v === true) return true;
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error(`gameworld: ${at}.goal.boss is true, or { win: ${Object.keys(WINS).join(' | ')} }`);
  for (const k of Object.keys(v)) if (k !== 'win') throw new Error(`gameworld: ${at}.goal.boss.${k} is not a boss setting (win)`);
  if (v.win !== undefined && !WINS[v.win]) throw new Error(`gameworld: ${at}.goal.boss.win is the kind of win: ${Object.entries(WINS).map(([k, w]) => `${k} (${w})`).join('; ')}`);
  return v.win !== undefined ? { win: v.win } : true;
}

/** The first level, laid as its trails, their courses and their foes; a boss only when asked. */
export function firstLevel({ name, seed, kit, boss = false, dimension = '2d' } = {}) {
  const segs = firstLevelSegments(dimension, !!boss);
  const nodes = Object.fromEntries(segs.map((s) => [s.id, { trail: { run: s.run, heartbeat: 0.2 } }]));
  return {
    ...(name ? { name } : {}), ...(seed !== undefined ? { seed } : {}),
    walk: { ...(kit ? { kit } : {}), nodes },
    course: Object.fromEntries(segs.map((s) => [s.id, { teach: s.teach, verticality: s.verticality }])),
    foes: { density: Object.fromEntries(segs.map((s) => [s.id, s.density])) },
    ...(boss ? { goal: { boss: boss === true ? true : readBossWin(boss, 'firstLevel') } } : {}),
  };
}

/** The story so far: each level whose boss names its win, in the book's order. */
export function storyWins(G) {
  return (G.ids ?? Object.keys(G.levels ?? {})).map((id) => ({ level: id, boss: G.levels[id]?.goal?.boss })).filter((x) => x.boss && typeof x.boss === 'object' && x.boss.win).map((x) => ({ level: x.level, win: x.boss.win }));
}
