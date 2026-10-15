/**
 * engine-portability.js — the advisory portable-profile check
 * (godot-handoff.plan.md G6, option B). Given a manifest + extracted scores,
 * reports whether the authored gameplay lives entirely inside the vocabulary
 * the engine kernels speak — at authoring/export time, not as a post-mortem.
 * ADVISORY ONLY: mojulo advises, the operator decides (the edifice posture).
 * Engine-agnostic: the vocabulary is the shared score contract, so one
 * assessment serves the Godot kernel and the Unreal sibling alike.
 *
 * For Godot it reads the one portability source (godot-marks.js) and the bus contract (bus-abi.js): a mechanic's mark
 * is FOUND by lowering it and reading the bus rows it uses, never by list membership, and the cosmos registry reads
 * the same marks. Its verdict stamps, it never refuses:
 *   plays         nothing the level needs is lost or approximated
 *   plays-partly  something is drawn simpler, or a look or a feel stays the web's; the game still plays
 *   hollow        something the game turns on does not run (a terminal that cannot fire, a pilot that cannot move, a
 *                 fact nothing feeds, a story that does not travel): it imports and runs, and it is not the game
 */
import { lowerMechanic, MECHANIC_KINDS } from '../game/mechanics.js';
import { KITS } from '../game/kits.js';
import { busCoverage } from './bus-abi.js';
import { RULE_MARKS, PAGE_MARKS, EVENT_MARKS, FIGURE_MARKS, worstMark } from './godot-marks.js';

export const MECHANICS_VOCAB = ['reach-exit', 'collect', 'hazard-damage', 'fail-on-death', 'survive'];
// the mechanics that wait on hits (hit:<id>): they travel when combat does (the cosmos sweep credits them together);
// frags also rides the cast's down, kill and spawn and a sequence per contender; regen and abilities timers, keys and
// the cast's status: all on Godot's bus (a round's own damage, frags' damage: true, is the web's: Godot's hits say none)
export const HIT_MECHANICS = ['hp-pool', 'defeat-all', 'frags', 'regen', 'abilities'];

// ── a mechanic's mark, found by lowering it ──────────────────────────────────────────────────────────────────────────
// One small sample per kind (the smallest params its lowering takes); MECHANIC_KINDS without one fails the ratchet.
const SAMPLE_STORE = { slices: [{ name: 'bag', kind: 'inventory' }, { name: 'hero', kind: 'character', init: { stats: { hp: 100 } } }, { name: 'flags', kind: 'flags' }] };
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
});
// what a lowered mechanic hands the SHELL beside its world (the bus carries the world): its mark in Godot
export const MECHANIC_EXTRAS = Object.freeze({
  doors: { godot: 'built', how: 'a door between levels: kernel/game.gd applies the transit and enters the linked level by its own door (godot-game-shell.test.js)' },
  keep: { godot: 'built', how: 'the kept numbers ride the envelope and kernel/game.gd keeps their bests in user://bests.json' },
  aftermath: { godot: 'absent', how: 'what broke is the web\'s: nothing breaks in Godot (breakables_held)' },
  bag: { godot: 'approximated', how: 'the store carries the inventory between levels; the web shell\'s fill of the level\'s bag from it at start is not ported' },
});
const ROW_MARK = { built: 'built', partial: 'approximated', absent: 'absent' };

export function mechanicMark(kind) {
  const low = lowerMechanic(kind, MECHANIC_SAMPLES[kind], { storeSchema: SAMPLE_STORE, player: 'player' });
  const { godot } = busCoverage(low.world || {});
  const rows = [...godot.partial, ...godot.absent];
  const extras = Object.keys(MECHANIC_EXTRAS).filter((k) => low[k] !== undefined);
  const mark = worstMark(godot.partial.length ? 'approximated' : 'built', godot.absent.length ? 'absent' : 'built', extras.map((k) => MECHANIC_EXTRAS[k].godot));
  const how = [...godot.absent.map((r) => `${r} absent`), ...godot.partial.map((r) => `${r} partial`), ...extras.map((k) => MECHANIC_EXTRAS[k].how)].join('; ');
  return Object.freeze({ godot: mark, rows, ...(how ? { how } : {}) });
}
export const MECHANIC_MARKS = Object.freeze(Object.fromEntries(MECHANIC_KINDS.map((k) => [k, mechanicMark(k)])));

// what a Godot export keeps: every mechanic whose lowered events its bus runs (built or approximated). The cosmos
// registry reads MECHANIC_MARKS (power.mechanics); godot-project.js reads this list.
export const GODOT_MECHANICS = Object.freeze(MECHANIC_KINDS.filter((k) => MECHANIC_MARKS[k].godot !== 'absent'));
// the motion rules a Godot export keeps (RULE_MARKS, not absent): the walker, its spring arm, first person, and the
// platform rule's jump (in its fixed numbers). The cosmos registry reads RULE_MARKS.
export const GODOT_RULES = Object.freeze(Object.keys(RULE_MARKS).filter((k) => RULE_MARKS[k].godot !== 'absent'));

// a kit's mark: the mechanics its level template lowers to, and the platform rule for the platformer
export function kitMark(id) {
  const kit = KITS[id];
  const lv = kit.levelChannel({ ref: 'x', exit: [10, 0, 0], pickups: [{ item: 'coin', at: [3, 0, 0] }], hazards: [{ at: [4, 0, 0], damage: 10 }], lethal: true, seconds: 10 });
  const kinds = [...new Set(lv.mechanics.map((x) => x.kind))];
  const marks = kinds.map((k) => MECHANIC_MARKS[k].godot);
  if (id === 'platformer') marks.push(RULE_MARKS.platform.godot);
  const worst = worstMark(marks);
  const short = kinds.filter((k) => MECHANIC_MARKS[k].godot !== 'built');
  return Object.freeze({ godot: worst, how: `its mechanics ${kinds.join(', ')}${short.length ? ` (${short.join(', ')} not whole)` : ''}${id === 'platformer' ? `; the platform rule: ${RULE_MARKS.platform.how}` : ''}` });
}

// ── the ledger rows an export writes (engine-score.js), each with what it costs a Godot export ──────────────────────
// `info` rows say what travels; the rest flag. `core` marks what a game turns on (the verdict reads it). An unknown
// ledger key fails engine-portability.test.js: a row nobody reads is a silent drop by another name.
export const LEDGER_MARKS = Object.freeze({
  greybox_declared: { info: true }, skipped_runtime: { info: true }, sfx_carried: { info: true }, combat_music_carried: { info: true },
  hud_declared: { info: true }, lights_carried: { info: true }, look_declared: { info: true }, crystals_carried: { info: true },
  water_carried: { info: true }, address_carried: { info: true }, contract: { info: true }, bus_carried: { info: true },
  bodies_solid: { godot: 'approximated', flag: 'solid bodies (body.collide) push the walkers out of them on the web; in Godot the pilot passes through them' },
  combat_carried: { info: true }, rules_carried: { info: true }, channels_carried: { info: true }, figures_carried: { info: true }, events_carried: { info: true },
  skipped_movers: { godot: 'absent', flag: 'mover/platform integrator channels do not travel' },
  skipped_physics: { godot: 'absent', flag: 'live physics channels do not travel' },
  skipped_fx: { godot: 'absent', flag: 'camera-facing fx (billboards, glows) are not drawn' },
  skipped_sprite_sfx: { godot: 'absent', flag: 'sprite sfx are not drawn' },
  sky_approximated: { godot: 'absent', flag: 'the backdrop image the page loads by URL is not carried' },
  weather_partial: { godot: 'approximated', flag: 'the weather plays its fog, colour and light; rain, snow, dust, petals and lightning stay the web\'s' },
  tone_graded_on_page: { godot: 'built', flag: 'the tone is graded in Godot as on the page (kernel/tone.gdshader)' },
  breakables_held: { godot: 'approximated', flag: 'what breaks on the web is held whole' },
  crystal_light_performed: { godot: 'approximated', flag: 'the crystal light plays, its stones at rest (movers do not travel)' },
  looks_carried: { godot: 'approximated', flag: 'the cast\'s looks ride as data: nothing wears one until a script calls looks.wear' },
});

// the shell keys a game manifest may carry, and what each costs (kernel/game.gd: a level list, gates, the store, the
// save); an unknown game key is named, never dropped
export const SHELL_MARKS = Object.freeze({
  menu: { godot: 'approximated', flag: 'the menu\'s entries are played as a level list' },
  music: { info: true }, theme: { godot: 'approximated', flag: 'the theme skins the HUD only' },
  setup: { godot: 'absent', flag: 'the pre-level setup screen does not travel' },
  difficulty: { godot: 'absent', flag: 'the difficulty pick does not travel' },
  front: { godot: 'absent', flag: 'the title and credits do not travel' },
  run: { godot: 'built', flag: 'a run draws its order with the web shell\'s roll and keeps the deepest (kernel/game.gd)' },
  links: { godot: 'built', flag: 'door links travel: a door applies what the session gathered and enters the linked level (kernel/game.gd)' },
  shell: { godot: 'approximated', flag: 'the light play shell is played as the kernel\'s level list' },
});

const flag = (godot, text, core = false) => ({ godot, text, core });

// the Godot reading of one level's score: every way it is less than the web, as { godot, text, core }
function godotFlags(score) {
  const out = [];
  const L = score.ledger || {};
  // the mechanics, by their found marks
  for (const k of [...new Set((score.mechanics ?? []).map((x) => x?.kind).filter(Boolean))]) {
    const mk = MECHANIC_MARKS[k];
    if (!mk) out.push(flag('absent', `mechanic '${k}' is not one the kernel knows`, true));
    else if (mk.godot !== 'built') out.push(flag(mk.godot, `mechanic '${k}': ${mk.how}`, mk.godot === 'absent'));
  }
  // the rules the level's entities run (the pilot's, the camera's, the cast's)
  const rules = L.rules_carried || {};
  for (const [type, row] of Object.entries(rules.by || {})) {
    const mk = RULE_MARKS[type];
    if (!mk) { out.push(flag('absent', `rule '${type}' is not marked (godot-marks.js RULE_MARKS)`, true)); continue; }
    // the pilot's rule runs whole but for the opt-in moves the kernel does not (PLATFORM_LOST), each named
    if (row.lost && row.lost.length) out.push(flag('approximated', `rule '${type}' (${row.camera && !row.pilot ? 'the camera' : type === 'ai' ? 'the minds' : 'the pilot'}): the kernel runs it but for ${row.lost.join(', ')} (godot-marks.js PLATFORM_KEYS, CAMERA_LOST, AI_LOST, WEAPON_LOST)`, false));
    // the page's camera runs in the kernel only when it watches the pilot the kernel walks by its rule
    if (row.unwatched != null) out.push(flag('approximated', `rule '${type}' (the camera) watches '${row.unwatched}', not a pilot the kernel walks by its rule: the walker's own first-person or spring-arm view stands in`, false));
    // only the pilot runs its walk or platform rule in the kernel: another walker stands where it was placed
    const others = (type === 'walk' || type === 'platform') ? row.count - (row.pilot ? 1 : 0) : 0;
    if (others > 0) out.push(flag('approximated', `rule '${type}' (${others} character${others > 1 ? 's' : ''} besides the pilot): only the pilot runs its rule in the kernel; ${others > 1 ? 'they stand' : 'it stands'} where placed`, false));
    if (mk.godot === 'built') continue;
    const who = row.pilot ? 'the pilot' : row.camera ? 'the camera' : `${row.count} character${row.count > 1 ? 's' : ''}`;
    out.push(flag(mk.godot, `rule '${type}' (${who}): ${mk.how}`, mk.godot === 'absent' && (row.pilot || !row.camera)));
  }
  // the page's channels the level fills that do not travel whole
  for (const k of L.channels_carried?.keys || []) {
    const mk = PAGE_MARKS[k];
    if (!mk) out.push(flag('absent', `page channel '${k}' is not marked (godot-marks.js PAGE_MARKS)`));
    else if (mk.godot !== 'built') out.push(flag(mk.godot, `${k}: ${mk.how}`, false));
  }
  // what the page does to a rigged figure beyond its clips
  for (const k of L.figures_carried?.keys || []) {
    const mk = FIGURE_MARKS[k];
    if (!mk) out.push(flag('absent', `figure overlay '${k}' is not marked (godot-marks.js FIGURE_MARKS)`));
    else if (mk.godot !== 'built') out.push(flag(mk.godot, `figures (${k}): ${mk.how}`, false));
  }
  // the events keys the export drops (scenes, quests) or carries in part
  for (const k of L.events_carried?.keys || []) {
    const mk = EVENT_MARKS[k];
    if (!mk) out.push(flag('absent', `events '${k}' is not marked (godot-marks.js EVENT_MARKS): it does not travel`, true));
    else if (mk.godot !== 'built') out.push(flag(mk.godot, `events.${k}: ${mk.how}`, mk.godot === 'absent'));
  }
  // the bus rows the kernel performs in part, or not at all: the logic runs, nothing feeds or draws them
  const bus = L.bus_carried?.godot;
  if (bus?.absent?.length) out.push(flag('absent', `behaviour the Godot kernel does not perform yet: ${bus.absent.join(', ')} (the bus runs; nothing feeds or draws these)`, true));
  if (bus?.partial?.length) out.push(flag('approximated', `behaviour the Godot kernel performs in part: ${bus.partial.join(', ')}`));
  // a level left by a named exit, or a door to another level: travel between levels does not travel
  for (const [k, row] of Object.entries(L)) {
    const mk = LEDGER_MARKS[k];
    if (!mk) { out.push(flag('absent', `ledger row '${k}' is not marked (engine-portability.js LEDGER_MARKS)`)); continue; }
    if (mk.info || mk.godot === 'built') continue;
    out.push(flag(mk.godot, `${mk.flag}${row?.count ? ` (${row.count})` : ''}`, !!mk.core));
  }
  if (L.combat_carried) out.push(flag('approximated', 'the hero\'s fight travels (its swings and rounds, and the reactions of what they hit): the combo\'s stun, scaling and juggle, the clash, tackle and shove-down set pieces, the deferred wreck finisher, a loadout\'s other slots and every AI\'s attack stay on the web'));
  return out;
}

// engine: 'godot' — its kernel runs the bus (a level's contract ends it) and carries the store (a flag gate holds);
// the other engines do neither, so for them a bus level's win and a flag gate are still lost
export function assessPortability({ manifest, levels, engine = null }) {
  const godot = engine === 'godot';
  const flags = [];
  const perLevel = {};
  const lost = [];
  for (const { ref, score } of levels) {
    const lf = [];
    const kinds = (score.mechanics ?? []).map((m) => m?.kind).filter(Boolean);
    if (!godot) {
      const unknown = kinds.filter((k) => !MECHANICS_VOCAB.includes(k));
      if (unknown.length) lf.push(`mechanics outside the vocabulary: ${unknown.join(', ')}`);
    }
    // a level whose behaviour rides the bus ends through its contract's `on` (an event mapped to end), which travels
    if (!kinds.some((k) => ['reach-exit', 'survive'].includes(k)) && !(godot && score.ledger?.bus_carried)) {
      lf.push('no completion mechanic (reach-exit / survive) — the win condition lives in runtime code, which does not travel');
    }
    if (!godot) {
      if (score.ledger?.skipped_movers) lf.push('mover/platform integrator channels do not travel');
      if (score.ledger?.skipped_physics) lf.push('live physics channels do not travel');
      const bus = score.ledger?.bus_carried?.godot;
      if (bus?.absent?.length) lf.push(`behaviour the Godot kernel does not perform yet: ${bus.absent.join(', ')} (the bus runs; nothing feeds or draws these)`);
    }
    // world-contract-tiers W5: the T1 advisory — an enclosed volume with nothing to light it.
    // Reported, never gated: the operator adds fixtures, opens the roof, or exports unlit.
    if (score.ledger?.contract?.advisories?.includes('imports_dark')) {
      lf.push('imports_dark — a ceiling over the spawn, no lights, no openings: any renderer that does transport imports this dark. Add fixtures (potLights), open the roof, or export unlit');
    }
    const gf = godot ? godotFlags(score) : [];
    for (const f of gf) { lf.push(f.text); lost.push({ level: ref, ...f }); }
    perLevel[ref] = { portable: lf.length === 0, flags: lf, ...(godot ? { verdict: verdictOf(gf, lf.length) } : {}) };
    for (const f of lf) flags.push(`${ref}: ${f}`);
  }
  if (manifest?.kind === 'game') {
    for (const lv of manifest.levels ?? []) {
      // with a store, a flag gate is the store's (kernel/store.gd evaluates it); without one only completion gates hold
      if (lv?.gate && !lv.gate.completed && !(godot && manifest.store)) flags.push(`gate on '${lv.ref}' is not a completion gate — approximated as unlocked`);
    }
    if (!godot) {
      for (const k of ['setup', 'difficulty']) {
        if (manifest[k] != null) flags.push(`'${k}' shell UI does not travel`);
      }
    } else {
      for (const [k, mk] of Object.entries(SHELL_MARKS)) {
        if (manifest[k] == null || mk.info || mk.godot === 'built') continue;
        flags.push(`game: ${mk.flag}`);
        lost.push({ level: null, godot: mk.godot, text: mk.flag, core: !!mk.core });
      }
    }
  }
  const out = { profile: 'engine-score/1', portable: flags.length === 0, flags, perLevel };
  if (!godot) return out;
  return { ...out, verdict: verdictOf(lost, flags.length), lost };
}

/** The export's stamp (export-godot.mjs, export_game): the verdict and what it rests on, beside an unchanged `ok`.
 * A pack without a Godot assessment (the arcade leg's reducer, held equal by its replay probe) plays when portable. */
export function exportVerdict(portability) {
  const p = portability || {};
  return {
    verdict: p.verdict ?? (p.portable === false ? 'plays-partly' : 'plays'),
    lost: (p.lost || []).filter((f) => f.godot === 'absent').map((f) => (f.level ? `${f.level}: ${f.text}` : f.text)),
    approximated: (p.lost || []).filter((f) => f.godot === 'approximated').map((f) => (f.level ? `${f.level}: ${f.text}` : f.text)),
  };
}

function verdictOf(found, nFlags) {
  if (found.some((f) => f.core && f.godot === 'absent')) return 'hollow';
  return nFlags ? 'plays-partly' : 'plays';
}
