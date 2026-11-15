/**
 * THE MISSION'S BRIEF — what a first level asks of its ground, read from the game as the game room's brief is
 * (gameroom/needs.js): never a list of games, always what the world already says. Its guns are the firing range's
 * (gameworld/loadout.js loadoutOf), each carried for a band; the bands the kit serves choose the sections, its run sizes
 * them, and each need says why.
 *
 *   readMission(v, at)   a level's `mission` as written → { seed?, sections?, foes?, hold?, waves?, gun? }; throws, teaching
 *     true                 the mission the brief reads
 *     seed                 the composition's dice (the level's own when absent)
 *     sections             the sections in order (sections.js SECTIONS), in place of the ones the kit's bands choose
 *     foes                 how many the lane stands (1 to 6, 3): every fight section in proportion
 *     hold, waves          the holdout's clock (15 to 180 s, 40) and its waves (1 to 5, 3)
 *     gun                  the emplacement's mount (combat/mount.js MOUNTS: a word, or true for the field gun)
 *   missionBrief(G, spec) → { guns: [{ name, band }], serves: { close, mid, long }, sections: [kind], yard, run, eye, width,
 *                             scale, hold, waves, gun, camera, why: { <need>: words } } | null (a world with no guns)
 *
 * Pure, no dice.
 */
import { loadoutOf } from '../gameworld/loadout.js';
import { ARMS_KIT } from '../gameworld/arms-kit.js';
import { feelCard } from '../gameworld/feel/lower.js';
import { SECTIONS, SECTION_IDS, ARCHETYPE_BAND, FIRE_BAND } from './sections.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const KEYS = ['seed', 'sections', 'foes', 'hold', 'waves', 'gun'];
export const MISSION_LIMITS = Object.freeze({ sections: [2, 8], foes: [1, 6], hold: [15, 180], waves: [1, 5] });
export const MISSION_DEFAULTS = Object.freeze({ foes: 3, hold: 40, waves: 3, gun: 'field-gun' });
// a mount the emplacement may stand (combat/mount.js MOUNTS, read where the gun is built: mission-level.js)
const GUN_WORD = /^[a-z][a-z-]{1,31}$/;

/** A level's `mission`, read. */
export function readMission(v, at = 'mission') {
  if (v === true) return {};
  const no = (m) => { throw new Error(`${at}${m}`); };
  if (!isObj(v)) no(` is true (the mission its guns ask for), or { ${KEYS.join('?, ')}? }`);
  for (const k of Object.keys(v)) if (!KEYS.includes(k)) no(`.${k} is not a mission setting (${KEYS.join(', ')})`);
  const L = MISSION_LIMITS, out = {};
  if (v.seed !== undefined) { if (!Number.isInteger(v.seed)) no('.seed is a whole number'); out.seed = v.seed; }
  if (v.sections !== undefined) {
    const S = v.sections;
    if (!Array.isArray(S) || S.length < L.sections[0] || S.length > L.sections[1]) no(`.sections is ${L.sections[0]} to ${L.sections[1]} of ${SECTION_IDS.join(', ')}, in the order they are played`);
    S.forEach((s, i) => { if (!SECTIONS[s]) no(`.sections[${i}]: '${s}' is not a section (${SECTION_IDS.join(', ')})`); });
    if (new Set(S).size !== S.length) no('.sections names a section twice: each is laid once');
    if (!S.some((s) => SECTIONS[s].task === 'reach')) no('.sections has no way out: end it with extract');
    out.sections = S.slice();
  }
  for (const k of ['foes', 'waves']) if (v[k] !== undefined) { if (!Number.isInteger(v[k]) || v[k] < L[k][0] || v[k] > L[k][1]) no(`.${k} is ${L[k][0]} to ${L[k][1]}`); out[k] = v[k]; }
  if (v.hold !== undefined) { if (!Number.isFinite(v.hold) || v.hold < L.hold[0] || v.hold > L.hold[1]) no(`.hold is the seconds the yard is held, ${L.hold[0]} to ${L.hold[1]}`); out.hold = v.hold; }
  if (v.gun !== undefined) { if (v.gun !== true && !(typeof v.gun === 'string' && GUN_WORD.test(v.gun))) no('.gun is true (a field gun) or a mount\'s word (battle-tank, light-tank, field-gun, howitzer, tower)'); out.gun = v.gun === true ? MISSION_DEFAULTS.gun : v.gun; }
  return out;
}

// the band a weapon is carried for: a kit word its archetype's, a weapon written by its fire type that type's
function bandOf(w) {
  if (typeof w === 'string') return ARCHETYPE_BAND[ARMS_KIT[w]?.as] ?? 'mid';
  if (w && w.fire) return FIRE_BAND[w.fire] ?? null;
  return 'mid';
}

/** The brief (see the header), or null for a world that carries no gun. */
export function missionBrief(G, spec = {}) {
  const L = loadoutOf(G);
  if (!L) return null;
  const guns = L.weapons.map((w) => ({ name: typeof w === 'string' ? w : w.name, band: bandOf(w) }));
  const has = (b) => guns.some((g) => g.band === b);
  // a band is served by a gun carried for it, or for a longer one: a rifle works across a room, a shotgun not down a hall
  const serves = { close: guns.some((g) => g.band), mid: has('mid') || has('long'), long: has('long') };
  const why = {};
  why.guns = `${guns.map((g) => `${g.name}${g.band ? ` (${g.band})` : ' (the free hand)'}`).join(', ')}: the firing range's, read from ${L.from === 'template' ? `the feel's template` : L.from === 'quick' ? 'the carried kit' : 'what the hero carries'}`;
  const card = G?.feel != null ? feelCard(G.feel) : null, run = card ? card.ground.run : 4.5;
  why.run = card ? `the feel's run, ${run} m/s` : 'a person\'s run, 4.5 m/s (no feel written)';
  const width = clamp(2 * Math.round((run * 3.5) / 2), 14, 22);
  why.width = `${width} m across: three and a half seconds of the run, room to flank and none to hide in`;
  const gun = spec.gun ?? null;
  const chosen = ['staging', 'contact', ...(serves.mid ? ['lane'] : []), ...(serves.long ? ['overwatch'] : []), ...(gun ? ['emplacement'] : []), 'holdout', 'extract'];
  const sections = spec.sections ?? chosen;
  why.sections = spec.sections ? 'written on the level' : `${serves.long ? 'a long gun: the long line too' : serves.mid ? 'no long gun: no long line' : 'close guns only: a room and a yard'}${gun ? `; a ${gun} to man` : ''}`;
  // the yard tests what the kit was taught: held at the mid band where a gun reaches it, else across a room
  const yard = serves.mid ? 'mid' : 'close';
  why.yard = yard === 'mid' ? 'the yard is held at the mid band: a gun carried reaches it' : 'the yard is a room\'s length: no gun carried reaches further';
  const foes = spec.foes ?? MISSION_DEFAULTS.foes;
  why.foes = `${foes} down the lane, every fight in proportion`;
  return {
    guns, serves, sections, yard, run, eye: 1.7, width, scale: foes / MISSION_DEFAULTS.foes,
    hold: spec.hold ?? MISSION_DEFAULTS.hold, waves: spec.waves ?? MISSION_DEFAULTS.waves, gun, camera: G?.camera ?? null, why,
  };
}
