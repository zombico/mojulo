/**
 * Mojulo Voice — the voice-register primitive (voice-worker.plan.md).
 *
 * A voice register is a tiny deterministic recipe for HOW a voice sounds,
 * the beats posture transposed to speech: the recipe is the artifact, the
 * WAV is a disposable render an external worker produces through the voice
 * seam. Nothing here touches audio — this module is pure closed-vocabulary
 * math (axes → blend weights), unit-testable without ONNX.
 *
 * The model is language-agnostic by construction:
 *
 * - A **bank** is a calibrated voice space for one language/register family
 *   (jp-female is the first implementation, not the concept). A bank names
 *   its **poles** — stock Kokoro embeddings pinned, by the operator's ears,
 *   to the ends of each axis — and a **depth anchor** (a cross-gender
 *   embedding blended in at a bounded share to darken timbre).
 * - The **axes** are the operator-facing knobs, in operator terms:
 *     confidence ∈ [0,1] — meek ("chihaya") → authoritative ("motoko");
 *                          the interpolation between the two poles.
 *     depth      ∈ [0,1] — 0 = the bank's native timbre; 1 = the maximum
 *                          admissible share of the depth anchor (the
 *                          bank's `depth.ceiling`, past which identity
 *                          breaks — found by listening, not by math).
 * - Resolution is a lerp: same manifest → same weights → (through Kokoro's
 *   deterministic synthesis) the same waveform, forever. No dice at all —
 *   voice registers don't even need the seeded-dice rule; there is nothing
 *   random to seed.
 *
 * Pole assignments marked `calibrated: false` are provisional defaults; the
 * calibration protocol (plan.md) is the operator listening to the sweep and
 * pinning them. Manifests may override poles/depth inline — that is the
 * calibration workflow itself, not an escape hatch.
 */

export const KIND_VOICE_REGISTER = 'voice-register';

// Weights below this are dropped from the resolved blend (a 0.02% share is
// inaudible and only noises up the recipe).
const WEIGHT_EPSILON = 0.0005;

export const VOICE_BANKS = {
  'jp-female': {
    language: 'ja',
    poles: {
      // PROVISIONAL until the operator's calibration pass pins them.
      meek: 'jf_nezumi',
      authority: 'jf_alpha',
    },
    depth: { anchor: 'jm_kumo', ceiling: 0.3 },
    calibrated: false,
  },
};

export function isVoiceRegisterKind(kind) {
  return kind === KIND_VOICE_REGISTER;
}

function clamp01(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(1, Math.max(0, n));
}

/**
 * The confidence → pacing coupling: uncertainty reads slower. A derivation,
 * not a rule — an explicit manifest `speed` always wins.
 */
export function suggestedSpeed(confidence) {
  return Number((0.9 + 0.13 * clamp01(confidence, 0.5)).toFixed(3));
}

export function normalizeVoiceRegister(manifest = {}) {
  const bankName = manifest.bank || 'jp-female';
  const bank = VOICE_BANKS[bankName];
  if (!bank) {
    throw new Error(
      `unknown voice bank '${bankName}' (banks: ${Object.keys(VOICE_BANKS).join(', ')})`,
    );
  }
  const poles = { ...bank.poles, ...(manifest.poles || {}) };
  const depth = { ...bank.depth, ...(manifest.depth || {}) };
  if (!poles.meek || !poles.authority) {
    throw new Error("a voice bank needs both 'meek' and 'authority' poles");
  }
  const ceiling = clamp01(depth.ceiling, 0.3);
  const axes = {
    confidence: clamp01(manifest.axes?.confidence, 0.5),
    depth: clamp01(manifest.axes?.depth, 0),
  };
  const speed = manifest.speed == null ? suggestedSpeed(axes.confidence) : Number(manifest.speed);
  if (!(speed > 0)) throw new Error(`invalid speed: ${manifest.speed}`);
  return {
    kind: KIND_VOICE_REGISTER,
    title: manifest.title || null,
    bank: bankName,
    language: bank.language,
    poles,
    depth: { anchor: depth.anchor, ceiling },
    axes,
    speed,
    direction: manifest.direction || null,
  };
}

export function validateVoiceRegister(manifest) {
  const errors = [];
  try {
    normalizeVoiceRegister(manifest);
  } catch (err) {
    errors.push(err.message);
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Axes → blend weights. The whole primitive is this lerp:
 *
 *   k          = depth × ceiling          (the depth anchor's share)
 *   meek       = (1 − confidence) × (1 − k)
 *   authority  = confidence × (1 − k)
 *   anchor     = k
 *
 * Duplicate voice ids merge, near-zero weights drop, and the result is
 * ordered by descending weight (ties by name) so the same manifest always
 * prints the same blend string.
 */
export function resolveVoiceRegister(manifest) {
  const m = normalizeVoiceRegister(manifest);
  const k = m.axes.depth * m.depth.ceiling;
  const shares = [
    [m.poles.meek, (1 - m.axes.confidence) * (1 - k)],
    [m.poles.authority, m.axes.confidence * (1 - k)],
    [m.depth.anchor, k],
  ];
  const merged = new Map();
  for (const [id, w] of shares) {
    if (!id || w < WEIGHT_EPSILON) continue;
    merged.set(id, (merged.get(id) || 0) + w);
  }
  const entries = [...merged.entries()]
    .map(([id, w]) => [id, Number(w.toFixed(4))])
    .filter(([, w]) => w >= WEIGHT_EPSILON)
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  const weights = Object.fromEntries(entries);
  return {
    ...m,
    weights,
    // The backend CLI's --voice syntax: a single id when the blend collapses
    // to one voice, else "id:w,id:w" (speak.py normalizes the sum).
    voiceArg: entries.length === 1
      ? entries[0][0]
      : entries.map(([id, w]) => `${id}:${w}`).join(','),
  };
}
