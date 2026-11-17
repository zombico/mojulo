/**
 * style-meter — a game's STYLE METER (worlds/controllable/style.js): how well the hero fights, read off every live level
 * as it is played. Laid on every level as its `styleMeter`, as the tempo is laid as `tempo`.
 *
 *   gameworld.styleMeter: 'auto' | false | true | { tiers?, step?, gain?, repeat?, memory?, grace?, decay? }
 *     'auto'   on a game whose feel's template is the stylish one (STYLISH: its kit plays strings, a launcher and the air),
 *              the meter as it stands; on any other, none
 *     true     the meter as it stands, whatever the game
 *     { … }    its own numbers and words over the runtime's (style.js)
 *
 *   readStyleMeter(raw)        → raw, or throws naming what it takes (the world's read)
 *   styleMeterOfGame(G)        → { styleMeter, from: 'operator' | 'feel', why } every level's `styleMeter`, or null
 *   styleMeterSuggestion(G)    → what 'auto' would lay on a world that writes none, or null (offered, never laid unasked:
 *                                a meter changes every level's bytes)
 *   vitalsOf(G)                → the HUD's vitals on a game that carries the meter: { look, full: { hp?, halo } } (the
 *                                lengths the HP and the gauge reach by the game's end, so the HUD is laid out at its
 *                                fully grown length from the first level; hp unsaid: twice the hero's at the start, read
 *                                on the page), or null
 *   levelRankOf(G, level)      → a level's `game.rank` on a game that carries the meter (game/rank.js: the rank on its
 *                                results): { par? } the seconds it is judged against, counted on paper from its tasks
 *                                (PAR: a fight's walk in, and each foe of it); a level with no tasks has no par, and
 *                                is ranked on its style and how clean it was alone. null: the game carries no meter
 *
 * Pure.
 */
import { readFeel } from './feel/lower.js';
import { fightOf, fightWaves } from './fights.js';

/** The gauge's most stocks by a game's end, unsaid (a stylish game's gauge grows from a few to ten). */
export const HALO_FULL = 10;
export function vitalsOf(G) {
  const M = styleMeterOfGame(G);
  if (!M) return null;
  const V = isObj(M.styleMeter.vitals) ? M.styleMeter.vitals : {};
  return { look: V.look ?? VITALS_LOOKS[0], full: { ...(V.hp ? { hp: V.hp } : {}), halo: V.halo ?? HALO_FULL } };
}
/** The par, on paper: the seconds a fight's walk in is given, and each of its foes. */
export const PAR = Object.freeze({ task: 10, foe: 8 });
export function levelRankOf(G, level) {
  if (!styleMeterOfGame(G)) return null;
  let par = 0;
  for (const T of G?.levels?.[level]?.goal?.tasks ?? []) {
    const F = fightOf(G, T.fight);
    if (!F) continue;
    par += PAR.task;
    for (const W of fightWaves(G, F.kind, F.waves ?? null)) for (const n of Object.values(W)) par += PAR.foe * n;
  }
  return par ? { par } : {};
}

/** The feel templates whose game the meter is made for. */
export const STYLISH = Object.freeze(['fallen-angel']);
const KEYS = ['tiers', 'step', 'gain', 'repeat', 'memory', 'grace', 'decay', 'halo', 'vitals'];
/** How the HP and the Halo Meter are drawn together (the HUD host's vitals): the forms answer each other by overlap, by
 * contrast, or as an echo of one form. */
export const VITALS_LOOKS = Object.freeze(['overlap', 'contrast', 'echo']);
const GAINS = ['hit', 'air', 'launch', 'switch', 'parry', 'down', 'shot'];
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const no = (m) => { throw new Error(`gameworld: styleMeter ${m}`); };

export function readStyleMeter(raw) {
  if (raw === undefined || raw === null || raw === false || raw === true || raw === 'auto') return raw;
  if (!isObj(raw)) no(`is 'auto' (the stylish template's), true, false, or { ${KEYS.join(', ')} }`);
  for (const k of Object.keys(raw)) if (!KEYS.includes(k)) no(`has no '${k}' (${KEYS.join(', ')})`);
  if (raw.tiers !== undefined && !(Array.isArray(raw.tiers) && raw.tiers.length >= 2 && raw.tiers.length <= 8 && raw.tiers.every((t) => typeof t === 'string' && t && t.length <= 16))) no('.tiers is the tiers\' names, lowest first, two to eight short words');
  for (const k of ['step', 'memory', 'grace', 'decay']) if (raw[k] !== undefined && !(Number.isFinite(raw[k]) && raw[k] >= 0)) no(`.${k} is a number, 0 or more`);
  if (raw.repeat !== undefined && !(Number.isFinite(raw.repeat) && raw.repeat >= 0 && raw.repeat <= 1)) no('.repeat is 0 to 1: what a move just used is worth again');
  if (raw.halo !== undefined) {
    if (!isObj(raw.halo)) no('.halo is { stocks?, per?, hit?, hurt?, at?, drain?, might?, swift?, heal? }: the Halo Meter, in stocks, and the transformation it buys');
    for (const [k, v] of Object.entries(raw.halo)) if (!['stocks', 'per', 'hit', 'hurt', 'at', 'drain', 'might', 'swift', 'heal'].includes(k) || !(Number.isFinite(v) && v >= 0)) no(`.halo.${k} is not one of stocks, per, hit, hurt, at, drain, might, swift, heal (each a number, 0 or more)`);
    if (raw.halo.stocks !== undefined && !(Number.isInteger(raw.halo.stocks) && raw.halo.stocks >= 1 && raw.halo.stocks <= 20)) no('.halo.stocks is a whole number, 1 to 20');
  }
  if (raw.vitals !== undefined) {
    if (!isObj(raw.vitals)) no(`.vitals is { look?, hp?, halo? }: how the HUD draws the HP and the gauge (look: ${VITALS_LOOKS.join(', ')}), and their lengths at the game's end`);
    for (const k of Object.keys(raw.vitals)) if (!['look', 'hp', 'halo'].includes(k)) no(`.vitals has no '${k}' (look, hp, halo)`);
    if (raw.vitals.look !== undefined && !VITALS_LOOKS.includes(raw.vitals.look)) no(`.vitals.look is one of ${VITALS_LOOKS.join(', ')}`);
    if (raw.vitals.hp !== undefined && !(Number.isFinite(raw.vitals.hp) && raw.vitals.hp > 0)) no('.vitals.hp is the most health the hero holds by the game\'s end');
    if (raw.vitals.halo !== undefined && !(Number.isInteger(raw.vitals.halo) && raw.vitals.halo >= 1 && raw.vitals.halo <= 20)) no('.vitals.halo is the most stocks the gauge holds by the game\'s end, 1 to 20');
  }
  if (raw.gain !== undefined) {
    if (!isObj(raw.gain)) no(`.gain is { ${GAINS.join(', ')} }`);
    for (const [k, v] of Object.entries(raw.gain)) if (!GAINS.includes(k) || !(Number.isFinite(v) && v >= 0)) no(`.gain.${k} is not a gain (${GAINS.join(', ')}: each a number, 0 or more)`);
  }
  return raw;
}

const poleOf = (G) => { try { return G?.feel != null ? readFeel(G.feel).pole : null; } catch { return null; } };

export function styleMeterOfGame(G) {
  const own = G?.styleMeter;
  if (own === undefined || own === null || own === false) return null;
  if (own === 'auto') { const pole = poleOf(G); return STYLISH.includes(pole) ? { styleMeter: { halo: {} }, from: 'feel', why: `its feel plays ${pole}, the stylish template: how it fights is what it is played for` } : null; }
  readStyleMeter(own);
  return { styleMeter: own === true ? {} : own, from: 'operator', why: 'the meter the world writes' };
}

export function styleMeterSuggestion(G) {
  if (!G || G.styleMeter !== undefined) return null;
  const pole = poleOf(G);
  return STYLISH.includes(pole) ? { suggest: 'auto', why: `its feel plays ${pole}, the stylish template: a meter that rewards varied strings, the air, a switch mid-string and a clean run` } : null;
}
