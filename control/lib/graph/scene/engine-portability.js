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
const COMPLETION_KINDS = ['reach-exit', 'survive'];

export function assessPortability({ manifest, levels }) {
  const flags = [];
  const perLevel = {};
  for (const { ref, score } of levels) {
    const lf = [];
    const kinds = (score.mechanics ?? []).map((m) => m?.kind).filter(Boolean);
    const unknown = kinds.filter((k) => !MECHANICS_VOCAB.includes(k));
    if (unknown.length) lf.push(`mechanics outside the vocabulary: ${unknown.join(', ')}`);
    if (!kinds.some((k) => COMPLETION_KINDS.includes(k))) {
      lf.push('no completion mechanic (reach-exit / survive) — the win condition lives in runtime code, which does not travel');
    }
    if (score.ledger?.skipped_movers) lf.push('mover/platform integrator channels do not travel');
    if (score.ledger?.skipped_physics) lf.push('live physics channels do not travel');
    perLevel[ref] = { portable: lf.length === 0, flags: lf };
    for (const f of lf) flags.push(`${ref}: ${f}`);
  }
  if (manifest?.kind === 'game') {
    for (const lv of manifest.levels ?? []) {
      if (lv?.gate && !lv.gate.completed) flags.push(`gate on '${lv.ref}' is not a completion gate — approximated as unlocked`);
    }
    for (const k of ['setup', 'difficulty']) {
      if (manifest[k] != null) flags.push(`'${k}' shell UI does not travel`);
    }
  }
  return { profile: 'engine-score/1', portable: flags.length === 0, flags, perLevel };
}
