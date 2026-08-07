/**
 * dream-audit — the machine gate for the character-from-dream / shape-from-dream
 * loops. The loops' whole point is that an image worker is the model's EYES: it
 * DREAMS a reference (a character sheet, an exploded parts sheet), the agent
 * reads it, and reconstructs into closed-vocabulary substrate. The failure mode
 * is an agent that SKIPS the dream and reconstructs from its own imagination,
 * then passes the result off as a dream-reconstruction — a silent process
 * failure, because prose instructions get rationalized past.
 *
 * This is the same gate the render-handoff bicycle uses on animation cels: an
 * artifact that CLAIMS to be generated must ATTEST `invoked_generator: true`,
 * and the claim is machine-refused if the attestation is absent or malformed
 * (render-handoff.plan.md: "a cel the worker itself says was not generated is
 * machine-refused"). Here the artifact is a figure/character recipe claiming
 * dream provenance.
 *
 * HONEST LIMIT: mojulo is loopback and holds no vision on the authoring path, so
 * it CANNOT prove the agent actually invoked an image model — and it must NOT
 * probe the local worker (docs/local-image-worker.md: mojulo never checks for or
 * depends on it). So the gate is FORM + PRESENCE, not liveness: it converts a
 * silent skip into an explicit, recorded, structured attestation (source +
 * invoked_generator:true + prompt + a generation identifier). An agent that
 * skipped the dream cannot produce a valid audit without fabricating one — a
 * deliberate recorded lie, caught by the second gate (the operator's eyes; a
 * true reconstruction looks materially different from an imagined one). That is
 * the realistic ceiling of "ensure it used its image capability".
 */

// source = WHICH image capability did the dreaming.
//   'native'          — the driving agent's OWN image generation (e.g. Codex, an
//                       image-capable harness). Unverifiable to mojulo by
//                       construction; attestation-only.
//   'local:<detail>'  — a local worker (e.g. 'local:comfyui@127.0.0.1:8188').
export const DREAM_SOURCE_RE = /^(native|local:[\w.@:/-]+)$/;

export const DREAM_PROVENANCE_KIND = 'dream-reconstruction';

/**
 * Validate a dream_audit attestation. Returns an array of human-readable errors
 * (empty = valid). The four required attestations ARE the gate.
 */
export function validateDreamAudit(audit, label = 'dream_audit') {
  if (!audit || typeof audit !== 'object' || Array.isArray(audit)) {
    return [`${label}: must be an object attesting the dream — { source, invoked_generator, prompt, and one of job_id|image_sha256|seed|token }`];
  }
  const errors = [];
  // WHICH eyes.
  if (typeof audit.source !== 'string' || !DREAM_SOURCE_RE.test(audit.source)) {
    errors.push(`${label}.source: required — 'native' (the agent's own image generation) or 'local:<detail>' (e.g. 'local:comfyui@127.0.0.1:8188')`);
  }
  // THE gate: an image model was actually run to dream the reference.
  if (audit.invoked_generator !== true) {
    errors.push(`${label}.invoked_generator: must be true — a figure cannot claim ${DREAM_PROVENANCE_KIND} provenance unless an image generator was actually invoked to dream the reference. A character tuned from imagination is NOT a dream-reconstruction (mint it without dream_audit instead).`);
  }
  // WHAT was dreamed.
  if (typeof audit.prompt !== 'string' || audit.prompt.trim().length < 8) {
    errors.push(`${label}.prompt: required — the brief the image worker dreamed (≥ 8 chars)`);
  }
  // A handle on the SPECIFIC generation event (render-event provenance): a
  // ComfyUI prompt_id, a native job id, a seed, or the dreamed image's hash.
  const gen = audit.job_id ?? audit.image_sha256 ?? audit.seed ?? audit.token;
  if (gen === undefined || gen === null || String(gen).trim() === '') {
    errors.push(`${label}: required one of job_id | image_sha256 | seed | token — an identifier for the specific generation event`);
  }
  return errors;
}

/**
 * Validate + normalize into the stored `provenance` block. Throws on gate
 * failure (the mint is refused). The dreamed PIXELS are never persisted here —
 * doctrine discards the dream on lock; only this audit survives as provenance.
 */
export function normalizeDreamAudit(audit, label = 'dream_audit') {
  const errors = validateDreamAudit(audit, label);
  if (errors.length) throw new Error(`Refused — dream-reconstruction provenance failed the gate:\n - ${errors.join('\n - ')}`);
  const out = {
    kind: DREAM_PROVENANCE_KIND,
    source: audit.source,
    invoked_generator: true,
    prompt: audit.prompt.trim(),
  };
  for (const k of ['job_id', 'image_sha256', 'seed', 'token']) {
    if (audit[k] !== undefined && audit[k] !== null && String(audit[k]).trim() !== '') out[k] = audit[k];
  }
  if (typeof audit.notes === 'string' && audit.notes.trim()) out.notes = audit.notes.trim();
  return out;
}
