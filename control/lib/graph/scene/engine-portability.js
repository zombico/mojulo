/**
 * engine-portability.js — the advisory portable-profile check (godot-handoff.plan.md G6, option B). Given a manifest +
 * extracted scores, reports whether the authored gameplay lives inside what an engine's kernel speaks — at
 * authoring/export time, not as a post-mortem. ADVISORY ONLY: mojulo advises, the operator decides (the edifice
 * posture).
 *
 * An engine with marks (engines/registry.js: a runtime kernel) is read against its marks module and the bus contract
 * (bus-abi.js): a mechanic's mark is FOUND by lowering it and reading the bus rows it uses, never by list membership,
 * and the cosmos registry reads the same marks. Its verdict stamps, it never refuses:
 *   plays         nothing the level needs is lost or approximated
 *   plays-partly  something is drawn simpler, or a look or a feel stays the web's; the game still plays
 *   hollow        something the game turns on does not run (a terminal that cannot fire, a pilot that cannot move, a
 *                 fact nothing feeds, a story that does not travel): it imports and runs, and it is not the game
 * An engine without marks (Unity, Unreal: a closed kernel of five mechanics) is read against MECHANICS_VOCAB: flags,
 * no verdict.
 */
import { lowerMechanic, MECHANIC_KINDS } from '../game/mechanics.js';
import { KITS } from '../game/kits.js';
import { busCoverage } from './bus-abi.js';
import { worstMark, LEDGER_INFO, SHELL_INFO } from './engines/marks.js';
import { DEFAULT_ENGINE, engineOf, marksOf } from './engines/registry.js';

export const MECHANICS_VOCAB = ['reach-exit', 'collect', 'hazard-damage', 'fail-on-death', 'survive'];
// the mechanics that wait on hits (hit:<id>): they travel when combat does (the cosmos sweep credits them together);
// frags also rides the cast's down, kill and spawn and a sequence per contender; regen and abilities timers, keys and
// the cast's status: all on Godot's bus (a round's own damage, frags' damage: true, is the web's: Godot's hits say none)
export const HIT_MECHANICS = ['hp-pool', 'defeat-all', 'frags', 'regen', 'abilities'];

// ── a mechanic's mark, found by lowering it ──────────────────────────────────────────────────────────────────────────
// One small sample per kind (the smallest params its lowering takes); MECHANIC_KINDS without one fails the ratchet.
const SAMPLE_STORE = { slices: [{ name: 'bag', kind: 'inventory' }, { name: 'hero', kind: 'character', init: { stats: { hp: 100 } } }, { name: 'flags', kind: 'flags' }, { name: 'party', kind: 'party' }] };
export const MECHANIC_SAMPLES = Object.freeze({
  'reach-exit': { at: [10, 0, 0] },
  door: { id: 'd', at: [5, 0, 0] },
  survive: { seconds: 10 },
  collect: { pickups: [{ item: 'coin', at: [3, 0, 0] }] },
  'hazard-damage': { hazards: [{ at: [4, 0, 0], damage: 10 }] },
  'fail-on-death': {},
  'win-when': { when: { var: 'score', gte: 3 } },
  'hp-pool': { entities: [{ id: 'foe', hp: 3 }] },
  'defeat-all': { count: 1 },
  supplies: { drops: [{ at: [2, 0, 0], gives: 'ammo', amount: 6 }, { at: [3, 0, 0], gives: 'health', amount: 10 }] },
  unseen: {},
  laps: { checkpoints: [{ at: [5, 0, 0] }, { at: [10, 0, 0] }], laps: 2 },
  'on-beat': { misses: 3 },
  waves: { waves: [{ foes: ['foe-1'] }], path: [[0, 0], [10, 0]] },
  push: { origin: [0, 0, 0], cols: 3, rows: 3, blocks: [[1, 1]], plates: [[2, 2]] },
  clock: {},
  crops: { plots: [{ at: [2, 2, 0] }] },
  aftermath: {},
  bag: {},
  score: { points: [{ on: 'pickup:coin' }] },
  respawn: { at: [0, 0, 0] },
  frags: { rivals: ['bot-1'] },
  control: { teams: { red: ['player', 'hero'], blue: ['bot-1'] }, at: [0, 0, 0] },   // the ratchet plays as player, the bus corpus as hero
  regen: {},
  abilities: { heal: true },
  party: {},
});

const lowered = new Map();
const lowerSample = (kind) => lowered.get(kind) || lowered.set(kind, lowerMechanic(kind, MECHANIC_SAMPLES[kind], { storeSchema: SAMPLE_STORE, player: 'player' })).get(kind);

/** A mechanic's mark in an engine: the worst of the bus rows its lowering uses and the shell extras it hands over. */
export function mechanicMark(kind, engine = DEFAULT_ENGINE) {
  const low = lowerSample(kind);
  const { [engine]: cov } = busCoverage(low.world || {}, engine);
  const rows = [...cov.partial, ...cov.absent];
  const EXTRAS = marksOf(engine).MECHANIC_EXTRAS;
  const extras = Object.keys(EXTRAS).filter((k) => low[k] !== undefined);
  const mark = worstMark(cov.partial.length ? 'approximated' : 'built', cov.absent.length ? 'absent' : 'built', extras.map((k) => EXTRAS[k][engine]));
  const how = [...cov.absent.map((r) => `${r} absent`), ...cov.partial.map((r) => `${r} partial`), ...extras.map((k) => EXTRAS[k].how)].join('; ');
  return Object.freeze({ [engine]: mark, rows, ...(how ? { how } : {}) });
}
const tables = new Map();
/** Every mechanic's mark in an engine (the cosmos registry reads it for power.mechanics). */
export function mechanicMarks(engine = DEFAULT_ENGINE) {
  if (!tables.has(engine)) tables.set(engine, Object.freeze(Object.fromEntries(MECHANIC_KINDS.map((k) => [k, mechanicMark(k, engine)]))));
  return tables.get(engine);
}

/** The mechanics an engine's export keeps: every one whose lowered events its bus runs (built or approximated). */
export const carriedMechanics = (engine = DEFAULT_ENGINE) => MECHANIC_KINDS.filter((k) => mechanicMarks(engine)[k][engine] !== 'absent');
/** The motion rules an engine's export keeps (its RULE_MARKS, not absent). */
export const carriedRules = (engine = DEFAULT_ENGINE) => {
  const R = marksOf(engine).RULE_MARKS;
  return Object.keys(R).filter((k) => R[k][engine] !== 'absent');
};

/** A kit's mark: the mechanics its level template lowers to, and the platform rule for the platformer. */
export function kitMark(id, engine = DEFAULT_ENGINE) {
  const kit = KITS[id], M = mechanicMarks(engine), R = marksOf(engine).RULE_MARKS;
  const lv = kit.levelChannel({ ref: 'x', exit: [10, 0, 0], pickups: [{ item: 'coin', at: [3, 0, 0] }], hazards: [{ at: [4, 0, 0], damage: 10 }], lethal: true, seconds: 10 });
  const kinds = [...new Set(lv.mechanics.map((x) => x.kind))];
  const marks = kinds.map((k) => M[k][engine]);
  if (id === 'platformer') marks.push(R.platform[engine]);
  const worst = worstMark(marks);
  const short = kinds.filter((k) => M[k][engine] !== 'built');
  return Object.freeze({ [engine]: worst, how: `its mechanics ${kinds.join(', ')}${short.length ? ` (${short.join(', ')} not whole)` : ''}${id === 'platformer' ? `; the platform rule: ${R.platform.how}` : ''}` });
}

// a ledger row's mark: an info row says what travels (no mark); the rest are the engine's
const ledgerMark = (marks, k) => (LEDGER_INFO.includes(k) ? { info: true } : marks.LEDGER_MARKS[k]);

// the engine's reading of one level's score: every way it is less than the web, as { [engine]: mark, text, core }
function engineFlags(score, engine) {
  const M = marksOf(engine), name = engineOf(engine).name, file = engineOf(engine).marksPath.split('/').pop();
  const flag = (mark, text, core = false) => ({ [engine]: mark, text, core });
  const out = [];
  const L = score.ledger || {};
  // the mechanics, by their found marks
  const MECH = mechanicMarks(engine);
  for (const k of [...new Set((score.mechanics ?? []).map((x) => x?.kind).filter(Boolean))]) {
    const mk = MECH[k];
    if (!mk) out.push(flag('absent', `mechanic '${k}' is not one the kernel knows`, true));
    else if (mk[engine] !== 'built') out.push(flag(mk[engine], `mechanic '${k}': ${mk.how}`, mk[engine] === 'absent'));
  }
  // the rules the level's entities run (the pilot's, the camera's, the cast's)
  const rules = L.rules_carried || {};
  for (const [type, row] of Object.entries(rules.by || {})) {
    const mk = M.RULE_MARKS[type];
    if (!mk) { out.push(flag('absent', `rule '${type}' is not marked (${file} RULE_MARKS)`, true)); continue; }
    // the pilot's rule runs whole but for the opt-in moves the kernel does not (PLATFORM_LOST), each named
    if (row.lost && row.lost.length) out.push(flag('approximated', `rule '${type}' (${row.camera && !row.pilot ? 'the camera' : type === 'ai' ? 'the minds' : 'the pilot'}): the kernel runs it but for ${row.lost.join(', ')} (${file} PLATFORM_KEYS, CAMERA_LOST, AI_LOST, WEAPON_LOST)`, false));
    // the page's camera runs in the kernel only when it watches the pilot the kernel walks by its rule
    if (row.unwatched != null) out.push(flag('approximated', `rule '${type}' (the camera) watches '${row.unwatched}', not a pilot the kernel walks by its rule: the walker's own first-person or spring-arm view stands in`, false));
    // only the pilot runs its walk or platform rule in the kernel: another walker stands where it was placed
    const others = (type === 'walk' || type === 'platform') ? row.count - (row.pilot ? 1 : 0) : 0;
    if (others > 0) out.push(flag('approximated', `rule '${type}' (${others} character${others > 1 ? 's' : ''} besides the pilot): only the pilot runs its rule in the kernel; ${others > 1 ? 'they stand' : 'it stands'} where placed`, false));
    if (mk[engine] === 'built') continue;
    const who = row.pilot ? 'the pilot' : row.camera ? 'the camera' : `${row.count} character${row.count > 1 ? 's' : ''}`;
    out.push(flag(mk[engine], `rule '${type}' (${who}): ${mk.how}`, mk[engine] === 'absent' && (row.pilot || !row.camera)));
  }
  // the page's channels the level fills that do not travel whole
  for (const k of L.channels_carried?.keys || []) {
    const mk = M.PAGE_MARKS[k];
    if (!mk) out.push(flag('absent', `page channel '${k}' is not marked (${file} PAGE_MARKS)`));
    else if (mk[engine] !== 'built') out.push(flag(mk[engine], `${k}: ${mk.how}`, false));
  }
  // what the page does to a rigged figure beyond its clips
  for (const k of L.figures_carried?.keys || []) {
    const mk = M.FIGURE_MARKS[k];
    if (!mk) out.push(flag('absent', `figure overlay '${k}' is not marked (${file} FIGURE_MARKS)`));
    else if (mk[engine] !== 'built') out.push(flag(mk[engine], `figures (${k}): ${mk.how}`, false));
  }
  // the events keys the export drops (scenes, quests) or carries in part
  for (const k of L.events_carried?.keys || []) {
    const mk = M.EVENT_MARKS[k];
    if (!mk) out.push(flag('absent', `events '${k}' is not marked (${file} EVENT_MARKS): it does not travel`, true));
    else if (mk[engine] !== 'built') out.push(flag(mk[engine], `events.${k}: ${mk.how}`, mk[engine] === 'absent'));
  }
  // the bus rows the kernel performs in part, or not at all: the logic runs, nothing feeds or draws them
  const bus = L.bus_carried?.[engine];
  if (bus?.absent?.length) out.push(flag('absent', `behaviour the ${name} kernel does not perform yet: ${bus.absent.join(', ')} (the bus runs; nothing feeds or draws these)`, true));
  if (bus?.partial?.length) out.push(flag('approximated', `behaviour the ${name} kernel performs in part: ${bus.partial.join(', ')}`));
  // a level left by a named exit, or a door to another level: travel between levels does not travel
  for (const [k, row] of Object.entries(L)) {
    const mk = ledgerMark(M, k);
    if (!mk) { out.push(flag('absent', `ledger row '${k}' is not marked (engines/marks.js LEDGER_INFO, ${file} LEDGER_MARKS)`)); continue; }
    if (mk.info || mk[engine] === 'built') continue;
    out.push(flag(mk[engine], `${mk.flag}${row?.count ? ` (${row.count})` : ''}`, !!mk.core));
  }
  if (L.combat_carried) out.push(flag('approximated', 'the hero\'s fight travels (its swings and rounds, and the reactions of what they hit): the combo\'s stun, scaling and juggle, the clash, tackle and shove-down set pieces, the deferred wreck finisher, a loadout\'s other slots and every AI\'s attack stay on the web'));
  return out;
}

// engine with marks (Godot, Roblox): its kernel runs the bus (a level's contract ends it) and carries the store (a flag
// gate holds); the other engines do neither, so for them a bus level's win and a flag gate are still lost
export function assessPortability({ manifest, levels, engine = null }) {
  const marked = !!marksOf(engine);
  const flags = [];
  const perLevel = {};
  const lost = [];
  for (const { ref, score } of levels) {
    const lf = [];
    const kinds = (score.mechanics ?? []).map((m) => m?.kind).filter(Boolean);
    if (!marked) {
      const unknown = kinds.filter((k) => !MECHANICS_VOCAB.includes(k));
      if (unknown.length) lf.push(`mechanics outside the vocabulary: ${unknown.join(', ')}`);
    }
    // a level whose behaviour rides the bus ends through its contract's `on` (an event mapped to end), which travels
    if (!kinds.some((k) => ['reach-exit', 'survive'].includes(k)) && !(marked && score.ledger?.bus_carried)) {
      lf.push('no completion mechanic (reach-exit / survive) — the win condition lives in runtime code, which does not travel');
    }
    if (!marked) {
      if (score.ledger?.skipped_movers) lf.push('mover/platform integrator channels do not travel');
      if (score.ledger?.skipped_physics) lf.push('live physics channels do not travel');
    }
    // world-contract-tiers W5: the T1 advisory — an enclosed volume with nothing to light it.
    // Reported, never gated: the operator adds fixtures, opens the roof, or exports unlit.
    if (score.ledger?.contract?.advisories?.includes('imports_dark')) {
      lf.push('imports_dark — a ceiling over the spawn, no lights, no openings: any renderer that does transport imports this dark. Add fixtures (potLights), open the roof, or export unlit');
    }
    const gf = marked ? engineFlags(score, engine) : [];
    for (const f of gf) { lf.push(f.text); lost.push({ level: ref, ...f }); }
    perLevel[ref] = { portable: lf.length === 0, flags: lf, ...(marked ? { verdict: verdictOf(gf, lf.length, engine) } : {}) };
    for (const f of lf) flags.push(`${ref}: ${f}`);
  }
  if (manifest?.kind === 'game') {
    const SHELL = marked ? marksOf(engine).SHELL_MARKS : null;
    for (const lv of manifest.levels ?? []) {
      // with a store, a flag gate is the store's (the kernel's store evaluates it); without one only completion gates hold
      if (lv?.gate && !lv.gate.completed && !(marked && manifest.store)) flags.push(`gate on '${lv.ref}' is not a completion gate — approximated as unlocked`);
    }
    if (!marked) {
      for (const k of ['setup', 'difficulty']) {
        if (manifest[k] != null) flags.push(`'${k}' shell UI does not travel`);
      }
    } else {
      for (const [k, mk] of Object.entries(SHELL)) {
        if (manifest[k] == null || SHELL_INFO.includes(k) || mk[engine] === 'built') continue;
        flags.push(`game: ${mk.flag}`);
        lost.push({ level: null, [engine]: mk[engine], text: mk.flag, core: !!mk.core });
      }
    }
  }
  const out = { profile: 'engine-score/1', portable: flags.length === 0, flags, perLevel };
  if (!marked) return out;
  return { ...out, verdict: verdictOf(lost, flags.length, engine), lost };
}

/** The export's stamp (export-godot.mjs, export_game): the verdict and what it rests on, beside an unchanged `ok`.
 * A pack without an engine assessment (the arcade leg's reducer, held equal by its replay probe) plays when portable. */
export function exportVerdict(portability, engine = DEFAULT_ENGINE) {
  const p = portability || {};
  return {
    verdict: p.verdict ?? (p.portable === false ? 'plays-partly' : 'plays'),
    lost: (p.lost || []).filter((f) => f[engine] === 'absent').map((f) => (f.level ? `${f.level}: ${f.text}` : f.text)),
    approximated: (p.lost || []).filter((f) => f[engine] === 'approximated').map((f) => (f.level ? `${f.level}: ${f.text}` : f.text)),
  };
}

function verdictOf(found, nFlags, engine) {
  if (found.some((f) => f.core && f[engine] === 'absent')) return 'hollow';
  return nFlags ? 'plays-partly' : 'plays';
}
