/**
 * engine-portability.js — the advisory portable-profile check
 * (godot-handoff.plan.md G6, option B). Given a manifest + extracted scores,
 * reports whether the authored gameplay lives entirely inside the vocabulary
 * the engine kernels speak — at authoring/export time, not as a post-mortem.
 * ADVISORY ONLY: mojulo advises, the operator decides (the edifice posture).
 * Engine-agnostic: the vocabulary is the shared score contract, so one
 * assessment serves the Godot kernel and the Unreal sibling alike.
 */

export const MECHANICS_VOCAB = ['reach-exit', 'collect', 'hazard-damage', 'fail-on-death', 'survive'];
// the mechanics that wait on hits (hit:<id>): they travel when combat does (the cosmos sweep credits them together);
// frags also rides the cast's down, kill and spawn and a sequence per contender; regen and abilities timers, keys and
// the cast's status: all on Godot's bus (a round's own damage, frags' damage: true, is the web's: Godot's hits say none)
export const HIT_MECHANICS = ['hp-pool', 'defeat-all', 'frags', 'regen', 'abilities'];
// what a Godot export keeps: the kernel's own mechanics, and those whose lowered events its bus runs whole (win-when is a
// watch and the contract's end; hp-pool and defeat-all count the hits kernel/combat.gd deals, since kernel 0.17.0). The
// cosmos registry reads this list (power.mechanics).
export const GODOT_MECHANICS = [...MECHANICS_VOCAB, 'win-when', ...HIT_MECHANICS];
// the motion rules a Godot export keeps: kernel/walker.gd walks the pilot (and jumps it, the platform rule), and a suit
// follows it on a spring arm (the follow camera); the controllable runtime's other rules (glide, fly, drive, patrol,
// movers…) do not travel. The cosmos registry reads it.
export const GODOT_RULES = ['walk', 'platform', 'follow'];
const COMPLETION_KINDS = ['reach-exit', 'survive'];

// engine: 'godot' — its kernel runs the bus (a level's contract ends it) and carries the store (a flag gate holds);
// the other engines do neither, so for them a bus level's win and a flag gate are still lost
export function assessPortability({ manifest, levels, engine = null }) {
  const godot = engine === 'godot';
  const flags = [];
  const perLevel = {};
  for (const { ref, score } of levels) {
    const lf = [];
    const kinds = (score.mechanics ?? []).map((m) => m?.kind).filter(Boolean);
    const unknown = kinds.filter((k) => !(godot ? GODOT_MECHANICS : MECHANICS_VOCAB).includes(k));
    if (unknown.length) lf.push(`mechanics outside the vocabulary: ${unknown.join(', ')}`);
    // a level whose behaviour rides the bus ends through its contract's `on` (an event mapped to end), which travels
    if (!kinds.some((k) => COMPLETION_KINDS.includes(k)) && !(godot && score.ledger?.bus_carried)) {
      lf.push('no completion mechanic (reach-exit / survive) — the win condition lives in runtime code, which does not travel');
    }
    if (score.ledger?.skipped_movers) lf.push('mover/platform integrator channels do not travel');
    if (score.ledger?.skipped_physics) lf.push('live physics channels do not travel');
    // the behaviour travels as the bus (bus-abi.js): a row the kernel does not perform is named, the logic still runs
    const bus = score.ledger?.bus_carried?.godot;
    if (bus?.absent?.length) lf.push(`behaviour the Godot kernel does not perform yet: ${bus.absent.join(', ')} (the bus runs; nothing feeds or draws these)`);
    // the fight travels as its adjudication (combat-score.js): what stays the web's is named
    if (godot && score.ledger?.combat_carried) lf.push('the hero\'s fight travels (its swings and rounds, and the reactions of what they hit): the combo\'s stun, scaling and juggle, the clash, tackle and shove-down set pieces, the deferred wreck finisher, a loadout\'s other slots and every AI\'s attack stay on the web');
    // world-contract-tiers W5: the T1 advisory — an enclosed volume with nothing to light it.
    // Reported, never gated: the operator adds fixtures, opens the roof, or exports unlit.
    if (score.ledger?.contract?.advisories?.includes('imports_dark')) {
      lf.push('imports_dark — a ceiling over the spawn, no lights, no openings: any renderer that does transport imports this dark. Add fixtures (potLights), open the roof, or export unlit');
    }
    perLevel[ref] = { portable: lf.length === 0, flags: lf };
    for (const f of lf) flags.push(`${ref}: ${f}`);
  }
  if (manifest?.kind === 'game') {
    for (const lv of manifest.levels ?? []) {
      // with a store, a flag gate is the store's (kernel/store.gd evaluates it); without one only completion gates hold
      if (lv?.gate && !lv.gate.completed && !(godot && manifest.store)) flags.push(`gate on '${lv.ref}' is not a completion gate — approximated as unlocked`);
    }
    for (const k of ['setup', 'difficulty']) {
      if (manifest[k] != null) flags.push(`'${k}' shell UI does not travel`);
    }
  }
  return { profile: 'engine-score/1', portable: flags.length === 0, flags, perLevel };
}
