/**
 * A BRAWL'S CAST — the FOES department's page of a beat-em-up or a run & gun: who the street's crowd is. The crowd is
 * the game's own bestiary (foes.js), never a list of the brawl's stock bodies: a wave is written by ROLE or by a foe's
 * id, as a fight's is (fights.js FIGHT_ROLES, castRoles), and each foe fights on the street as what it IS.
 *
 *   BRAWL_PLAYS            { <foe class>: <crowd type> } how a class fights on the street (brawl/brawl-crowd.js
 *                          CROWD_TYPES: the body's moves, health and timing). A new foe class is a row
 *   brawlPlay(entry, { gun? }) → the crowd type a bestiary entry plays: its class's, its rank over it (a boss or a
 *                          miniboss a big body; an elite never the street's weakest); on a run & gun (`gun`) a foe that
 *                          does not shoot still carries a gun, since everyone on that street does
 *   readBrawlWaves(waves)  → the waves as written, checked: [{ foes: { <role or foe id>: n }, name?, formation?,
 *                          pattern?, entrance?, cover?, ambush?, after? }] (a bare { <role or id>: n } is its `foes`)
 *   brawlCast(G, waves, { gun?, plays? }) → { waves, foes, says }
 *       waves   the street's (brawl-waves.js readRangeWaves): each crowd entry { type, n, foe: '<id>' }
 *       foes    the bestiary ids that come, in the order they first do (each one body to make)
 *       says    advice: a foe drawn as a jointed figure (a beast: only a person's body stands on the street yet)
 *       plays   the creator's own { <foe id>: <crowd type> } over the read
 *   brawlBodies(G, cast)   → { <foe id>: true | false }: does it have a body the street can draw (a person or a people,
 *                          made through the hero door; a beast and a model made elsewhere have none yet)
 *   withBodies(waves, rosterAt) → the waves with each crowd entry's `roster` (the page's roster index its body is drawn
 *                          from) where its foe has one, and no `foe` (the page's word is the index)
 *
 *
 * THE STREET — the LEVEL DESIGN department's page of a brawl: how far the street runs, where it holds the players, and
 * who comes at each stop. A street is a first free screen (the controls have their room: nothing comes), then its STOPS,
 * each a screen the camera is held on until its wave has fallen, then its BOSS's screen when it has one.
 *   street: { open?: m, stops: [{ wave: { <role or foe id>: n }, length?: m, name? }], boss?: '<role or foe id>' |
 *             { foe, with?: { <role or foe id>: n }, hp?, cpu?, length?, stages? } }
 *     boss.stages   the boss fight in acts (brawl-crowd.js readStages): how many (2 to 5: each a level harder than the
 *                   one before, its health shared evenly), or each written, [{ at?, cpu?, plays?, name?, calls? }]:
 *                   the share of its health it begins at, how it fights from there, what it is called, and who it
 *                   calls in as it begins ({ <role or foe id>: n }, cast as a stop's wave is)
 *   STREET                 its numbers: the free screen and a stop's length unsaid, how many stops a street may have
 *   readStreet(v)          → the street as written, checked (throws, teaching)
 *   brawlStreet(G, street, { gun?, plays? }) → { screens, waves, foes, boss, says }
 *       screens  the belt's (brawl-belt.js): the free one, a gated one a stop, the boss's last
 *       waves    the street's (brawl-crowd.js readWaves): { screen, crowd: [{ type, n, foe }], boss?: { foe, hp?, cpu? } }
 *       boss     the foe that stands as its boss, or null
 *       says     advice, never a refusal: a foe with no body, a street that ends with no boss, a stop that meets fewer
 *                than the one before it
 *   withStreetBodies(waves, rosterAt) → the waves as the page takes them: a crowd entry's `roster`, a boss's `fighter`
 *                (its body's roster index) or, with no body, a fighter's intent it is stood in by
 *
 * A STREET AS A LEVEL of a designed game (`levels.<id>.street`): the street's design with the level's own words beside
 * it, laid on the game's hero and its made foes.
 *   levels.<id>.street: { …the street (open?, stops, boss?), kit?, lives?, guns?, players? }
 *       players  how many play from its start, 1 to 4 on one screen (1). Its seats are the game's hero, then the cast
 *                who join the party, each in its own body; a seat with nobody to fill it is a stand-in fighter, said.
 *                Everyone who has a body can be played: a second controller drops in as the next of them
 *       kit    the stage kit its rooms are built in (brawl-levels.js BRAWL_STAGE_KITS; the open-air plaza unsaid)
 *       lives  the falls the player may take (1 to 9; 3)
 *       tuning how hard it hits, a card (brawl/brawl-tunings.js: measured | arcade | heroes: every seat a hero with a
 *              power, the game's hero its own actions page's `attack`, heroPower). Unsaid, a run & gun's street is
 *              the arcade's (soldiers fall to a couple of rounds, the hero to a few hits, five falls) and a
 *              beat-em-up's the sim's own numbers
 *       powers the seats' own powers in seat order (null keeps a seat's): each a power of the shelf's or one DESIGNED
 *              (brawl/brawl-powers.js readPower: { kind, name?, beam?, stock?, strength?, speed?, size?, pierce? }); a
 *              designed one far from what the street was measured with is advised (a `balance` law), never refused
 *       guns   a run & gun's street: true, or the guns carried, the first held; unsaid, the game's intent decides
 *              (`intent.from: 'run-and-gun'`)
 *   readLevelStreet(v)     → { design, kit, lives, guns } checked (throws, teaching)
 *   streetFoeIds(G)        → the bestiary ids the world's streets bring, each one figure to make (foes.js fieldedIds)
 *   heroPower(G)           → { id, beam } | null the street power the game's hero throws (its actions page's `attack`)
 *   streetLevel(G, words, { title?, ref?, heroRef?, foeRefs? }) → { manifest, laws }: the level's world, its brawl block
 *                          and its game contract; the hero the game's own (a stand-in fighter, said, where it has none),
 *                          each foe with a body drawn from its made ref
 *
 * Pure.
 */
import { bestiaryOf, isPeople, isModel, modeChain } from './foes.js';
import { brawlLevel, readBrawlLevel, BRAWL_STAGE_KITS } from '../brawl/brawl-levels.js';
import { readGun } from '../brawl/brawl-guns.js';
import { readScreen } from '../game/screen.js';
import { TUNINGS, STREET_TUNINGS, tuningOf, roomTune, seatPower } from '../brawl/brawl-tunings.js';
import { ATTACK_POWER, POWER_IDS, readPower, powerAdvice } from '../brawl/brawl-powers.js';
import { castRoles, FIGHT_ROLES } from './fights.js';
import { FOE_CLASSES } from '../foes/index.js';
import { CROWD_TYPES } from '../brawl/brawl-crowd.js';
import { readRangeWaves } from '../brawl/brawl-waves.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const fail = (m) => new Error(`gameworld: brawl${m}`);

export const BRAWL_PLAYS = Object.freeze({
  walker: 'thug', swarm: 'thug', patrol: 'thug', guard: 'sword', summoner: 'caster',
  hopper: 'jumper', swooper: 'jumper', charger: 'charger', pursuer: 'charger',
  lurker: 'knife', stalker: 'knife', brute: 'heavy',
  turret: 'rifleman', hunter: 'gunner', lobber: 'grenadier',
});
// (what a foe that does not shoot carries where everyone shoots, by how big it stands)
const GUN_PLAY = Object.freeze({ minion: 'rifleman', elite: 'gunner', miniboss: 'bazooka', boss: 'bazooka' });
const WAVE_WORDS = ['foes', 'name', 'formation', 'pattern', 'entrance', 'cover', 'ambush', 'after', 'beat'];

/** The crowd type a bestiary entry plays on the street. */
export function brawlPlay(entry, { gun = false } = {}) {
  const c = FOE_CLASSES[entry?.class], rank = entry?.rank ?? 'minion', base = BRAWL_PLAYS[entry?.class] ?? 'thug';
  const shoots = ['shot', 'lob'].includes(c?.attack?.kind);
  if (gun) return shoots ? (rank === 'boss' || rank === 'miniboss' ? 'bazooka' : base) : GUN_PLAY[rank] ?? 'rifleman';
  if (shoots) return base;
  if (rank === 'boss' || rank === 'miniboss') return 'heavy';
  return rank === 'elite' && base === 'thug' ? 'charger' : base;
}

/** The waves as written, checked. */
export function readBrawlWaves(waves) {
  if (!Array.isArray(waves) || !waves.length || waves.length > 20) throw fail('.waves is a list of 1 to 20 waves, each { foes: { <role or foe id>: n }, name?, formation?, pattern? } (or the foes alone)');
  return waves.map((w0, i) => {
    if (!isObj(w0)) throw fail(`.waves[${i}] is { foes: { <role or foe id>: n }, … }`);
    const w = isObj(w0.foes) ? w0 : { foes: w0 };
    for (const k of Object.keys(w)) if (!WAVE_WORDS.includes(k)) throw fail(`.waves[${i}].${k} is not a wave's word (${WAVE_WORDS.join(', ')})`);
    const ids = Object.keys(w.foes);
    if (!ids.length) throw fail(`.waves[${i}].foes names who comes: { <role or foe id>: n }`);
    for (const id of ids) if (!(Number.isInteger(w.foes[id]) && w.foes[id] >= 1 && w.foes[id] <= 8)) throw fail(`.waves[${i}].foes.${id} is how many come, 1 to 8`);
    return w;
  });
}

/** A brawl's waves cast from the world's bestiary. */
export function brawlCast(G, waves, { gun = false, plays = null } = {}) {
  const B = bestiaryOf(G ?? {}), R = castRoles(G), W = readBrawlWaves(waves), foes = [], says = [];
  if (plays !== null) {
    if (!isObj(plays)) throw fail('.plays is { <foe id>: <crowd type> }');
    for (const [id, t] of Object.entries(plays)) {
      if (!B[id]) throw fail(`.plays.${id}: the bestiary holds ${Object.keys(B).join(', ')}`);
      if (!CROWD_TYPES[t]) throw fail(`.plays.${id} is one of ${Object.keys(CROWD_TYPES).join(', ')}`);
    }
  }
  const out = W.map((w, i) => {
    const crowd = Object.entries(w.foes).map(([word, n]) => {
      const id = FIGHT_ROLES[word] ? R[word] : word;
      if (!B[id]) throw fail(`.waves[${i}].foes.${word}: a role (${Object.keys(FIGHT_ROLES).join(', ')}) or one of the bestiary's (${Object.keys(B).join(', ')})`);
      if (!foes.includes(id)) foes.push(id);
      // (A SUMMONER, the foe shelf's: it calls its own `summons` entry on the street, as many at once as it says (the
      // street's most), bound unless said: brawl-crowd.js readSummons)
      const S = B[id].summons, type = plays?.[id] ?? brawlPlay(B[id], { gun });
      if (S && !gun && CROWD_TYPES[type]?.hangs) {
        if (!foes.includes(S.foe)) foes.push(S.foe);
        return { type, n, foe: id, summons: { type: plays?.[S.foe] ?? brawlPlay(B[S.foe], { gun }), n: Math.max(1, Math.min(4, S.count ?? 2)), bound: S.bound !== false, foe: S.foe } };
      }
      return { type, n, foe: id };
    });
    const { foes: _f, ...rest } = w;
    return { ...rest, crowd };
  });
  // (read as the street reads them, so a fault is said here: its formations, its counts)
  try { readRangeWaves(out.map(({ crowd, ...w }) => ({ ...w, crowd: crowd.map(({ type, n }) => ({ type, n })) }))); } catch (e) { throw fail(`.waves: ${e.message.replace(/^brawl: /, '')}`); }
  const bodies = brawlBodies(G, { foes });
  for (const id of foes) if (!bodies[id]) says.push(`${id} is drawn as a jointed figure: only a person's body stands on the street yet (skin it as a person or a people to give it one)`);
  return { waves: out, foes, says };
}

/** Which of the cast have a body the street can draw. */
export function brawlBodies(G, cast) {
  const B = bestiaryOf(G ?? {});
  return Object.fromEntries(cast.foes.map((id) => [id, !!B[id] && isPeople(B[id]) && !isModel(B[id])]));
}

/** The waves as the page takes them: each crowd entry's body by its roster index, where its foe has one. */
export function withBodies(waves, rosterAt) {
  return waves.map((w) => ({ ...w, crowd: w.crowd.map(({ foe, ...c }) => (Number.isInteger(rosterAt?.[foe]) ? { ...c, roster: rosterAt[foe] } : c)) }));
}

export const STREET = Object.freeze({ open: 14, stop: 16, stops: [1, 12], length: [8, 48], kit: 'island-plaza', lives: 3 });
const STREET_WORDS = ['open', 'stops', 'boss'], STOP_WORDS = ['wave', 'length', 'name'], BOSS_WORDS = ['foe', 'with', 'hp', 'cpu', 'length', 'stages'];
const STAGE_WORDS = ['at', 'cpu', 'plays', 'name', 'calls'];
// (the levels a boss's stages step up through when they say none: versus-cpu.js CPU_LEVELS, in order)
const CPU_STEPS = ['novice', 'regular', 'veteran', 'ace'];
const metres = (v, at) => { if (!(typeof v === 'number' && v >= STREET.length[0] && v <= STREET.length[1])) throw fail(`${at} is a screen's length, ${STREET.length[0]} to ${STREET.length[1]} m`); return v; };

/** The street as written, checked. */
export function readStreet(v) {
  if (!isObj(v)) throw fail('.street is { open?, stops: [{ wave: { <role or foe id>: n }, length?, name? }], boss? }');
  for (const k of Object.keys(v)) if (!STREET_WORDS.includes(k)) throw fail(`.street.${k} is not a street's word (${STREET_WORDS.join(', ')})`);
  if (v.open !== undefined) metres(v.open, '.street.open');
  if (!Array.isArray(v.stops) || v.stops.length < STREET.stops[0] || v.stops.length > STREET.stops[1]) throw fail(`.street.stops is where the street holds its players, ${STREET.stops[0]} to ${STREET.stops[1]} of them, each { wave: { <role or foe id>: n }, length?, name? }`);
  v.stops.forEach((st, i) => {
    if (!isObj(st) || !isObj(st.wave)) throw fail(`.street.stops[${i}] is { wave: { <role or foe id>: n }, length?, name? }`);
    for (const k of Object.keys(st)) if (!STOP_WORDS.includes(k)) throw fail(`.street.stops[${i}].${k} is not a stop's word (${STOP_WORDS.join(', ')})`);
    if (st.length !== undefined) metres(st.length, `.street.stops[${i}].length`);
  });
  if (v.boss !== undefined && typeof v.boss !== 'string') {
    if (!isObj(v.boss) || typeof v.boss.foe !== 'string') throw fail('.street.boss is a role or a foe\'s id, or { foe, with?, hp?, cpu?, length? }');
    for (const k of Object.keys(v.boss)) if (!BOSS_WORDS.includes(k)) throw fail(`.street.boss.${k} is not a boss's word (${BOSS_WORDS.join(', ')})`);
    if (v.boss.length !== undefined) metres(v.boss.length, '.street.boss.length');
    // (its stages: how many, or each one written)
    const St = v.boss.stages;
    if (St !== undefined && !(Number.isInteger(St) && St >= 2 && St <= 5)) {
      if (!Array.isArray(St) || St.length < 2 || St.length > 5) throw fail('.street.boss.stages is how many stages the boss fight has (2 to 5), or each written: [{ at?, cpu?, plays?, name?, calls?: { <role or foe id>: n } }]');
      St.forEach((st, k) => {
        if (!isObj(st)) throw fail(`.street.boss.stages[${k}] is { at?, cpu?, plays?, name?, calls? }`);
        for (const w of Object.keys(st)) if (!STAGE_WORDS.includes(w)) throw fail(`.street.boss.stages[${k}].${w} is not a stage's word (${STAGE_WORDS.join(', ')})`);
        if (st.calls !== undefined && (k === 0 || !isObj(st.calls) || !Object.keys(st.calls).length)) throw fail(`.street.boss.stages[${k}].calls is who the boss calls in as that stage begins, { <role or foe id>: n } (its first stage calls none: \`with\` stands beside it from the start)`);
      });
    }
  }
  return v;
}

/** A brawl's street laid from the world's bestiary. */
export function brawlStreet(G, street, { gun = false, plays = null } = {}) {
  const S = readStreet(street), B = bestiaryOf(G ?? {}), R = castRoles(G);
  const bossWords = S.boss === undefined ? null : typeof S.boss === 'string' ? { foe: S.boss } : S.boss;
  // (a boss's stages, brawl-crowd.js readStages: how many (each a level up from the one before, sharing its health
  // evenly) or each written; who a stage calls is cast as a stop's wave is)
  const stagesIn = bossWords?.stages === undefined ? null : Number.isInteger(bossWords.stages)
    ? Array.from({ length: bossWords.stages }, (_, k) => ({ cpu: CPU_STEPS[Math.min(CPU_STEPS.length - 1, Math.max(0, CPU_STEPS.indexOf(bossWords.cpu ?? 'regular')) + k)] }))
    : bossWords.stages;
  const callers = (stagesIn ?? []).map((st, k) => (st.calls ? { k, foes: st.calls } : null)).filter(Boolean);
  const C = brawlCast(G, [...S.stops.map((st) => ({ foes: st.wave, ...(st.name ? { name: st.name } : {}) })), ...(bossWords?.with ? [{ foes: bossWords.with }] : []), ...callers.map((c) => ({ foes: c.foes }))], { gun, plays });
  const screens = [{ length: S.open ?? STREET.open }, ...S.stops.map((st) => ({ length: st.length ?? STREET.stop, gate: true }))];
  const waves = S.stops.map((_, i) => ({ screen: i + 1, crowd: C.waves[i].crowd, ...(C.waves[i].name ? { name: C.waves[i].name } : {}) }));
  const foes = C.foes.slice(), says = C.says.slice();
  let boss = null;
  if (bossWords) {
    const id = FIGHT_ROLES[bossWords.foe] ? R[bossWords.foe] : bossWords.foe;
    if (!B[id]) throw fail(`.street.boss: a role (${Object.keys(FIGHT_ROLES).join(', ')}) or one of the bestiary's (${Object.keys(B).join(', ')})`);
    boss = id;
    if (!foes.includes(id)) { foes.push(id); if (!brawlBodies(G, { foes: [id] })[id]) says.push(`${id} is drawn as a jointed figure: only a person's body stands on the street yet (skin it as a person or a people to give it one)`); }
    // (THE BOSS'S RELATIONS, the foe shelf's: its PAIR stands beside it, one down enraging the other (a pair that
    // revives is enraged on the street: said); each entry it BECOMES is a form it is defeated into, an act a form)
    const P = B[id].pair, chain = modeChain(B, id).slice(1);
    for (const f of [...(P ? [P.foe] : []), ...chain]) if (!foes.includes(f)) foes.push(f);
    if (P?.down === 'revive') says.push(`${id} and ${P.foe} revive each other in the round; on the street one down enrages the other`);
    const pairWords = P ? { foe: P.foe, down: 'enrage' } : null, forms = chain;
    screens.push({ length: bossWords.length ?? STREET.stop, boss: true });
    const withAt = S.stops.length, callsAt = withAt + (bossWords.with ? 1 : 0);
    const called = callers.flatMap((c, n) => C.waves[callsAt + n].crowd.map((e) => ({ ...e, stage: c.k })));
    const written = stagesIn ? stagesIn.map(({ calls: _c, ...st }) => st) : null;
    // (its forms laid on its acts in turn: the acts it has, else one an act a form, its health shared evenly)
    const stages0 = written ?? (forms.length ? Array.from({ length: forms.length + 1 }, () => ({})) : null);
    const stages = stages0 ? stages0.map((st, k) => (k > 0 && forms[k - 1] ? { ...st, form: { foe: forms[k - 1] }, ...(st.name ? {} : { name: forms[k - 1] }) } : st)) : null;
    if (written && forms.length > written.length - 1) says.push(`${id} becomes ${forms.length} forms but its fight has ${written.length - 1} acts after the first: the last ${forms.length - (written.length - 1)} are not reached`);
    waves.push({ screen: screens.length - 1, crowd: [...(bossWords.with ? C.waves[withAt].crowd : []), ...called], boss: { foe: id, ...(bossWords.hp ? { hp: bossWords.hp } : {}), ...(bossWords.cpu ? { cpu: bossWords.cpu } : {}), ...(stages ? { stages } : {}), ...(pairWords ? { pair: pairWords } : {}) } });
  } else says.push('the street ends on its last stop: it names no boss');
  // (a street builds: a stop that meets fewer than the one before it is said)
  const met = waves.filter((w) => !w.boss).map((w) => w.crowd.reduce((a, c) => a + c.n, 0));
  met.forEach((n, i) => { if (i > 0 && n < met[i - 1]) says.push(`stop ${i + 1} meets ${n}, fewer than the ${met[i - 1]} before it: a street builds toward its end`); });
  return { screens, waves, foes, boss, says };
}

/** The street's waves as the page takes them. */
export function withStreetBodies(waves, rosterAt) {
  const at = (foe) => (Number.isInteger(rosterAt?.[foe]) ? rosterAt[foe] : null);
  // (each foe by its body: a crowd entry's and its summons', a boss's, its pair's and each form it becomes)
  const summonsOf = (S) => (S ? { summons: (({ foe, ...x }) => (at(foe) !== null ? { ...x, roster: at(foe) } : x))(S) } : {});
  const fighterOf = ({ foe, ...b }) => (at(foe) !== null ? { ...b, fighter: at(foe) } : { ...b, archetype: 'grappler', id: foe, name: foe });
  return waves.map(({ boss, ...w }) => ({
    ...w, crowd: w.crowd.map(({ foe, summons, ...c }) => ({ ...(at(foe) !== null ? { ...c, roster: at(foe) } : c), ...summonsOf(summons) })),
    ...(boss ? { boss: (({ pair, stages, ...b }) => ({ ...fighterOf(b), ...(pair ? { pair: fighterOf(pair) } : {}), ...(stages ? { stages: stages.map(({ form, ...st }) => ({ ...st, ...(form ? { form: fighterOf(form) } : {}) })) } : {}) }))(boss) } : {}),
  }));
}

const LEVEL_WORDS = ['kit', 'ground', 'things', 'scenes', 'lives', 'guns', 'players', 'tuning', 'powers'];
/** the street a level takes when it says no stops: three that build, the cast's boss on a novice's mind (a first
 * street's: measured, brawl/brawl-playthrough.js) */
export const STREET_UNSAID = Object.freeze({ stops: [{ wave: { grunt: 2 } }, { wave: { grunt: 3, shooter: 1 } }, { wave: { elite: 1, grunt: 3 } }], boss: Object.freeze({ foe: 'boss', cpu: 'novice' }) });
export const STREET_SEATS = 4;
// (a stand-in's style by its seat, so four of them are told apart: the brawl's four, brawl-moves.js BRAWL_STYLES)
const STAND_INS = ['all-rounder', 'rushdown', 'zoner', 'grappler'];
/** A level's street as written: its design and the level's own words. */
export function readLevelStreet(v0) {
  // (`true`, or a street that says no stops: the street unsaid, on the place it names)
  const v = v0 === true ? {} : v0;
  if (!isObj(v)) throw fail('.street is true, or { open?, stops?, boss?, ground? | kit?, things?, scenes?, lives?, guns?, players?, tuning?, powers? }');
  const said = Object.fromEntries(Object.entries(v).filter(([k]) => !LEVEL_WORDS.includes(k)));
  const design = said.stops === undefined ? { ...STREET_UNSAID, ...said } : said;
  readStreet(design);
  // (ITS PLACE, `ground`: a place of its own in a kit's stead, a level's words (brawl/brawl-levels.js: a town's street,
  // a stage on a kit, a blockout; its dress, its rise, turn and drift), the street's stops laid along it)
  if (v.ground !== undefined) {
    if (v.kit !== undefined) throw fail('.street.ground is its place: no `kit` beside it (a stage\'s kit is said in its ground)');
    if (!isObj(v.ground) || v.ground.screens !== undefined || v.ground.belt?.screens !== undefined) throw fail('.street.ground is a place { kind: town | stage | greybox, … }: its screens are the street\'s stops, not said in it');
    try { readBrawlLevel(v.ground.kind === 'greybox' ? v.ground : { ...v.ground }, 'ground'); } catch (e) { throw fail(`.street.${e.message.replace(/^brawl: /, '')}`); }
  }
  if (v.things !== undefined && !Array.isArray(v.things)) throw fail('.street.things is what stands and lies on it [{ kind, what, at, n?, holds? }] (unsaid: its play\'s own)');
  if (v.scenes !== undefined && v.scenes !== false && !isObj(v.scenes)) throw fail('.street.scenes is its scenes { <id>: [beat…] }, or false for none');
  if (v.kit !== undefined && !BRAWL_STAGE_KITS.includes(v.kit)) throw fail(`.street.kit is one of ${BRAWL_STAGE_KITS.join(', ')}`);
  if (v.lives !== undefined && !(Number.isInteger(v.lives) && v.lives >= 1 && v.lives <= 9)) throw fail('.street.lives is the falls the player may take, 1 to 9');
  if (v.guns !== undefined && v.guns !== true) {
    if (!Array.isArray(v.guns) || !v.guns.length || v.guns.length > 6) throw fail('.street.guns is true (a run & gun\'s street) or 1 to 6 guns, the first held');
    v.guns.forEach((g, k) => { try { readGun(g, `guns[${k}]`); } catch (e) { throw fail(`.street.${e.message.replace(/^brawl: /, '')}`); } });
  }
  if (v.players !== undefined && !(Number.isInteger(v.players) && v.players >= 1 && v.players <= STREET_SEATS)) throw fail(`.street.players is how many play from its start, 1 to ${STREET_SEATS} on one screen`);
  if (v.tuning !== undefined && !STREET_TUNINGS.includes(v.tuning)) throw fail(`.street.tuning is one of ${STREET_TUNINGS.map((id) => `${id} (${TUNINGS[id].says})`).join('; ')}`);
  // (ITS POWERS: the seats' own, in seat order, each a power of the shelf's or one designed (brawl/brawl-powers.js
  // readPower); a seat it does not say takes the card's (the hero's own attack, the team's), and a street with no card
  // that gives powers gives those it says alone)
  if (v.powers !== undefined) {
    if (!Array.isArray(v.powers) || !v.powers.length || v.powers.length > STREET_SEATS) throw fail(`.street.powers is 1 to ${STREET_SEATS} powers in seat order, each one of ${POWER_IDS.join(', ')} or designed: { kind, name?, beam?, stock?, strength?, speed?, size?, pierce? } (null keeps a seat's own)`);
    v.powers.forEach((P, k) => { if (P !== null) { try { readPower(P, 'power'); } catch (e) { throw fail(`.street.powers[${k}]${e.message.replace(/^brawl: power/, '')}`); } } });
    if (v.guns !== undefined) throw fail('.street.powers: a run & gun\'s street is fought with guns (powers are a beat-em-up\'s)');
  }
  return { design, kit: v.kit ?? STREET.kit, ground: v.ground ?? null, things: v.things ?? null, scenes: v.scenes === undefined ? null : v.scenes, lives: v.lives ?? null, guns: v.guns ?? null, players: v.players ?? 1, tuning: v.tuning ?? null, powers: v.powers ?? null };
}
const gunsOf = (G, L) => L.guns !== null || G?.intent?.from === 'run-and-gun';

/** The bestiary ids the world's streets bring. */
export function streetFoeIds(G) {
  const out = [];
  // (a level as written keeps it at `street`; a world read keeps it at `brawlStreet`, a town's own street beside it)
  const wordsOf = (L) => L?.brawlStreet ?? (L?.street === true || (isObj(L?.street) && (Array.isArray(L.street.stops) || L.street.ground !== undefined || !Object.keys(L.street).some((k) => ['pattern', 'streetscape'].includes(k)))) ? L.street : null);
  for (const L of Object.values(G?.levels ?? {})) {
    const words = wordsOf(L);
    if (!words) continue;
    try { const R = readLevelStreet(words); for (const id of brawlStreet(G, R.design, { gun: gunsOf(G, R) }).foes) if (!out.includes(id)) out.push(id); } catch { /* the reader says what is wrong with it */ }
  }
  return out;
}

/** The street power a game's hero throws: its actions page's first power with an `attack` (a beam), played as the
 * street's power of that form (brawl-powers.js ATTACK_POWER) and drawn in that beam; null where it throws none. */
export function heroPower(G) {
  const P = (G?.characters?.hero?.actions?.powers ?? []).find((p) => isObj(p) && typeof p.attack === 'string' && ATTACK_POWER[p.attack]);
  return P ? { id: ATTACK_POWER[P.attack], beam: P.attack } : null;
}

/** A street level of a designed game: its world, its brawl and its contract. */
export function streetLevel(G, words, { title, ref, heroRef = null, foeRefs = null, party = null, layThings = null, layScenes = null } = {}) {
  const L = readLevelStreet(words), gun = gunsOf(G, L);
  // (its TUNING, brawl/brawl-tunings.js: the card it names; unsaid, a run & gun's is the arcade's, a beat-em-up's the
  // sim's own numbers. The card gives the falls allowed, the band and how a stop's crowd comes in where the street says none)
  const card = tuningOf(L.tuning ?? (gun ? 'arcade' : 'measured')), tune = roomTune(card);
  const S0 = brawlStreet(G, L.design, { gun });
  // (its army: each one a wave names comes `army` strong, eight of a kind and twelve a stop at most)
  const armied = (crowd) => { if (!card.army) return crowd; let room = 12; return crowd.map((c) => { const n = Math.max(1, Math.min(8, c.n * card.army, room)); room -= n; return { ...c, n }; }); };
  const entered = (crowd, k) => { const how = card.entrances ? card.entrances[k % card.entrances.length] : 'walk'; return crowd.map((c) => (c.entrance || how === 'walk' ? c : { ...c, entrance: how })); };
  const S = card.entrances || card.army ? { ...S0, waves: S0.waves.map((w, k) => ({ ...w, crowd: entered(armied(w.crowd), k) })) } : S0;
  const has = brawlBodies(G, S), bodied = S.foes.filter((id) => has[id] && foeRefs?.[id]);
  // (its seats: the game's hero, then the cast who join the party, each in its own body; a seat it starts with that
  // nobody fills is a stand-in fighter, said)
  const made = [...(heroRef ? [{ id: 'hero', hero: { ref: heroRef } }] : []), ...(party ?? []).filter((m) => m?.ref).map((m) => ({ id: m.id, name: m.name ?? m.id, hero: { ref: m.ref } }))].slice(0, STREET_SEATS);
  const short = Math.max(0, L.players - made.length);
  const seated = [...made, ...Array.from({ length: made.length ? short : Math.max(1, L.players) }, (_, k) => ({ id: `stand-in-${made.length + k + 1}`, name: `P${made.length + k + 1}`, archetype: STAND_INS[(made.length + k) % STAND_INS.length] }))];
  // (a card that gives POWERS (the heroes'): each seat a hero with its power, brawl/brawl-powers.js: the game's hero its
  // own where its actions page throws one (its first `attack`, played as the street's power of that form, drawn in that
  // beam), every other seat the team's in seat order)
  const own = heroPower(G);
  const powerAt = (h, k) => L.powers?.[k] ?? seatPower(card, k, h.id === 'hero' && heroRef ? own : null);
  const heroes = card.powers || L.powers ? seated.map((h, k) => { const P = powerAt(h, k); return P ? { ...h, power: P } : h; }) : seated;
  // (a designed power far from what the street was measured with: advised, never refused)
  const told = L.powers ? L.powers.flatMap((P, k) => (P && typeof P === 'object' ? powerAdvice(P, seated[k]?.name ?? (seated[k]?.id === 'hero' ? 'the hero' : `seat ${k + 1}`)) : [])) : [];
  const rosterAt = Object.fromEntries(bodied.map((id, k) => [id, heroes.length + k]));
  const roster = [...heroes, ...bodied.map((id) => ({ id: `foe-${id}`, name: id, hero: { ref: foeRefs[id] } }))];
  const register = ['anime', 'western'].includes(G?.juice?.register) ? G.juice.register : null;
  // ITS PLACE: the kit's rooms, or the ground it names (a town's street, a stage, a blockout, with its dress and its
  // bends), the street's screens laid along either
  const place = L.ground ? (L.ground.kind === 'greybox' ? { ...L.ground, belt: { ...(L.ground.belt ?? {}), screens: S.screens } } : { ...L.ground, screens: S.screens }) : { kind: 'stage', kit: L.kit, screens: S.screens, ...(card.depth ? { depth: [...card.depth] } : {}) };
  const B0 = brawlLevel(place).brawl;
  // (on a place of its own, what stands on it is its play's (breakables with food; a run & gun's cover from its dress
  // and its gun crates: `layThings`, the starter's) and it arrives and leaves by the starter's scenes, unless it says)
  const things = L.things ?? (L.ground && layThings ? layThings(gun ? 'gun' : 'brawl', B0.belt, B0.dress ?? null) : null);
  const scenes = L.scenes === false ? null : L.scenes ?? (L.ground && layScenes ? layScenes(B0.belt, title ?? null) : null);
  const practice = { roster, playable: heroes.length, players: Array.from({ length: L.players }, (_, i) => i), dummies: [], ...(things ? { things } : {}), stakes: L.lives ?? card.lives ?? STREET.lives, ...(tune ? { tune } : {}), street: { waves: withStreetBodies(S.waves, rosterAt), ...(scenes ? { scenes } : {}) }, ...(gun ? { range: Array.isArray(L.guns) ? { guns: L.guns } : {} } : {}) };
  const m = brawlLevel(place, { ...(title ? { title } : {}), ...(register ? { register } : {}), practice });
  const game = { levelRef: ref ?? 'street', consumes: [], produces: { results: ['success', 'fail'], events: [] }, presets: { default: {} }, complete: { text: 'the street' } };
  const standIns = heroes.length - made.length;
  const says = [...S.says, ...(standIns ? [made.length ? `${standIns} of its ${L.players} seats ${standIns === 1 ? 'is a stand-in fighter' : 'are stand-in fighters'}: the game has a hero and ${made.length - (heroRef ? 1 : 0)} who join its party (a cast member that \`joins\` takes a seat)` : `the street is played by ${standIns === 1 ? 'a stand-in fighter' : 'stand-in fighters'}: the world has no hero yet`] : [])];
  const laws = [{ concern: 'cast', law: 'street', holds: !says.length, says: says.length ? says.join('; ') : `the street's ${S.waves.length} stops are met by the game's own cast (${S.foes.join(', ')})` }, ...(told.length ? [{ concern: 'balance', law: 'power', holds: false, says: told.join('; ') }] : [])];
  // (a street runs across the screen: an upright one shows a sliver of it. Advised, never refused, as a fight's is)
  const upright = (() => { try { return G?.screen ? readScreen(G.screen).orientation === 'portrait' : false; } catch { return false; } })();
  if (upright) laws.push({ concern: 'screen', law: 'frame-fits', holds: false, says: 'a street runs across the screen, and this game is made for an upright one: its players and the crowd are cut off at the sides. Give the world `screen: \'screen\'` (or a tablet) for a beat-em-up or a run & gun' });
  return { manifest: { ...m, game }, laws };
}
