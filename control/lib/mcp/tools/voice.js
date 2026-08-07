/**
 * create_voice / get_voice / get_voice_vocab — the Mojulo Voice entry point
 * (control/lib/graph/voice/voice-worker.plan.md).
 *
 * The speech sibling of Mojulo Beats: a voice REGISTER is a tiny
 * deterministic recipe for how a voice sounds — axes (confidence, depth)
 * over a calibrated bank of stock Kokoro embeddings, resolved to blend
 * weights by a pure lerp (voice-register.js). Rows ride the `sketches`
 * table as storage (kind `voice-register`, no blobs) but surface as their
 * own thing: the /maker/voice rail. The sketch framing never reaches the
 * operator.
 *
 * Rendering is NOT here — mojulo designs the voice; an external worker
 * speaks it (the voice seam, same posture as image-outcomes). The resolved
 * `voiceArg` is the handoff: the local backend's speak CLI accepts it
 * verbatim. Key capabilities live behind get_voice_vocab (its own drawer)
 * so the forward_context contribution stays one routing row.
 */

import { promises as fs } from 'node:fs';

import { registerTool } from '@/lib/mcp/server';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { SketchFolderRepository } from '@/lib/db/repositories/sketch-folders';
import { listVoiceSamples, nextVoiceSamplePath, normalizeSampleAxes } from '@/lib/graph/voice/voice-sample-store';
import {
  KIND_VOICE_REGISTER,
  VOICE_BANKS,
  isVoiceRegisterKind,
  resolveVoiceRegister,
  validateVoiceRegister,
} from '@/lib/graph/voice/voice-register';

function requireVoiceSketch(ref) {
  if (!ref || typeof ref !== 'string') throw new Error('`ref` is required (string)');
  const sketch = SketchRepository.getByRef(ref);
  if (!sketch) throw new Error(`No voice register exists at ref '${ref}'`);
  if (!sketch.manifest || !isVoiceRegisterKind(sketch.manifest.kind)) {
    throw new Error(
      `'${ref}' is not a voice register (kind: ${sketch.manifest?.kind ?? 'none'}). `
      + 'Voice refs are minted by create_voice.',
    );
  }
  return sketch;
}

// The worker handoff line, restated on every read so a cold agent knows how
// to render the register (bicycle property 1 — until the V1 durable seam
// lands, the drive is this ad-hoc CLI loop).
function workerHint(resolved) {
  return `Render locally (optional backend, docs/local-voice-worker.md): `
    + `cd ~/mojulo-voicegen && venv/bin/python speak.py --text "<line>" `
    + `--voice "${resolved.voiceArg}" --speed ${resolved.speed} --out <path>.wav`;
}

export function mintVoice({ title, params, ref, folderRef } = {}) {
  if (!title || typeof title !== 'string') throw new Error('`title` is required (string)');
  if (ref !== undefined && (typeof ref !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(ref))) {
    throw new Error('`ref` must be 1-64 chars of [A-Za-z0-9_-] if provided');
  }
  if (folderRef != null) {
    if (typeof folderRef !== 'string' || !folderRef) throw new Error('`folderRef` must be a non-empty string or null');
    if (!SketchFolderRepository.getByRef(folderRef)) throw new Error(`Folder '${folderRef}' not found`);
  }
  const manifest = { ...(params && typeof params === 'object' ? params : {}), kind: KIND_VOICE_REGISTER, title };
  const { valid, errors } = validateVoiceRegister(manifest);
  if (!valid) throw new Error(`Invalid voice register:\n - ${errors.join('\n - ')}`);
  const resolved = resolveVoiceRegister(manifest);
  const { weights, voiceArg, ...normalized } = resolved;

  let sketch;
  try {
    sketch = SketchRepository.create({ title, manifest: normalized, ref, folderRef: folderRef ?? null });
  } catch (err) {
    if (err && /UNIQUE constraint failed/.test(err.message || '')) {
      throw new Error(`A sketch with ref '${ref}' already exists`);
    }
    throw err;
  }
  return {
    ok: true,
    ref: sketch.ref,
    url: '/maker/voice',
    resolved: { weights, voiceArg, speed: normalized.speed, language: normalized.language },
    next: workerHint({ voiceArg, speed: normalized.speed }),
  };
}

export async function createVoiceHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('create_voice requires an object: { title, params }');
  }
  const { title, params, ref, folder_ref: folderRef } = input;
  try {
    return mintVoice({ title, params, ref, folderRef });
  } catch (err) {
    // Error-as-drawer: a failed mint points at the capability manual.
    throw new Error(`${err.message} — capability manual: get_voice_vocab({}).`);
  }
}

export async function getVoiceHandler(input) {
  const sketch = requireVoiceSketch(input?.ref);
  const resolved = resolveVoiceRegister(sketch.manifest);
  const samples = listVoiceSamples(sketch.ref).map((s) => ({
    axes: { confidence: s.confidence, depth: s.depth },
    n: s.n,
    url: `/api/sketches/${encodeURIComponent(sketch.ref)}/voice-sample.wav?c=${s.confidence}&d=${s.depth}`,
    text: s.sidecar?.text ?? null,
    source: s.sidecar?.source ?? null,
  }));
  return {
    ok: true,
    ref: sketch.ref,
    title: sketch.title,
    manifest: sketch.manifest,
    resolved: {
      weights: resolved.weights,
      voiceArg: resolved.voiceArg,
      speed: resolved.speed,
      language: resolved.language,
    },
    samples,
    next: samples.length
      ? workerHint(resolved)
      : `${workerHint(resolved)} — then bind_voice_sample({ ref: '${sketch.ref}', wav_path, axes }) so the /maker/voice shelf can play it. Bind the axis EDGES too ({confidence:0}, {confidence:1}, …) to make the card's sliders audible pole to pole.`,
  };
}

// WAV magic: 'RIFF' at 0 + 'WAVE' at 8 — the machine half of the sample
// gate (the V1 submit gate grows duration + non-silence on this seam).
function assertWav(bytes) {
  if (
    bytes.length < 12
    || bytes.toString('ascii', 0, 4) !== 'RIFF'
    || bytes.toString('ascii', 8, 12) !== 'WAVE'
  ) {
    throw new Error('the submitted sample is not a WAV (bind the rendered audio, not the recipe)');
  }
}

export async function bindVoiceSampleHandler(input) {
  const { ref, wav_path: wavPath, wav_base64: wavBase64, axes, text, source } = input || {};
  const sketch = requireVoiceSketch(ref);
  if ((wavPath ? 1 : 0) + (wavBase64 ? 1 : 0) !== 1) {
    throw new Error('bind_voice_sample requires exactly one of wav_path | wav_base64');
  }
  const bytes = wavPath ? await fs.readFile(wavPath) : Buffer.from(wavBase64, 'base64');
  assertWav(bytes);
  // Axis-stamped slot: default to the register's own axes; pass explicit
  // axes when binding the pole renders that make the card's sliders audible.
  const slotAxes = normalizeSampleAxes(axes ?? sketch.manifest.axes);
  const slot = nextVoiceSamplePath(sketch.ref, slotAxes);
  await fs.writeFile(slot.path, bytes);
  // Provenance rides a sidecar next to the slot (the recipe stays clean).
  await fs.writeFile(
    `${slot.path}.json`,
    JSON.stringify({ axes: slot.axes, text: text || null, source: source || null, n: slot.n }, null, 2),
  );
  return {
    ok: true,
    ref: sketch.ref,
    axes: slot.axes,
    n: slot.n,
    bytes: bytes.length,
    url: `/api/sketches/${encodeURIComponent(sketch.ref)}/voice-sample.wav?c=${slot.axes.confidence}&d=${slot.axes.depth}`,
    next: `Sample bound at confidence ${slot.axes.confidence} / depth ${slot.axes.depth} (append-only slot ${slot.n}). The /maker/voice card plays the nearest rendered point as its sliders move.`,
  };
}

// The key-capabilities drawer — pulled on demand, never in forward_context.
const VOICE_VOCAB = `# Mojulo Voice — the voice-register capability drawer

A voice register is a tiny deterministic recipe for HOW a voice sounds — the
beats posture transposed to speech. The recipe is the artifact; WAVs are
disposable derived renders an external worker produces. No dice exist:
resolution is a pure lerp, so same manifest → same blend → same waveform.

## The recipe (create_voice params)

- \`bank\` — a calibrated voice space for one language/register family.
  Banks today: ${Object.keys(VOICE_BANKS).map((b) => `\`${b}\``).join(', ')} (the scheme is
  language-agnostic; jp-female is the first implementation, en/zh banks are
  planned). A bank pins **poles** (stock Kokoro embeddings assigned to axis
  ends by the operator's ears) and a **depth anchor** (a cross-gender
  embedding with a bounded ceiling share).
- \`axes.confidence\` ∈ [0,1] — meek → authoritative (the operator's
  chihaya → motoko framing). A lerp between the bank's poles. Default 0.5.
- \`axes.depth\` ∈ [0,1] — native timbre → the depth-anchor ceiling (0.3 for
  jp-female; past it identity breaks — a listening-derived bound). Default 0.
- \`speed\` — explicit playback rate; omitted, it derives from confidence
  (meek 0.90 → authoritative 1.03). Pacing is half the register.
- \`direction\` — free-text performance notes for the rendering agent.
  Punctuation is a REAL control: Kokoro pauses at commas/ellipses, lifts at
  question marks. Uncertainty = trailing ellipses + hedges; authority =
  short declaratives + hard periods.
- \`poles\` / \`depth\` overrides — per-manifest re-pinning; this IS the
  calibration workflow, not an escape hatch. jp-female ships
  \`calibrated: false\` (provisional: meek=jf_nezumi, authority=jf_alpha)
  until the operator's listening pass pins the poles.

## Why blends are legitimate recipes

Kokoro's 54 voices are points in one learned style space; a convex mix of
embeddings is a valid new voice (proven live — a 50/50 blend interpolates
even pacing, not just timbre). The resolved \`weights\` are the whole recipe:
no cloning, no fine-tuning, no per-voice downloads.

## Rendering (the voice seam — mojulo never speaks)

\`create_voice\` / \`get_voice\` return \`resolved.voiceArg\`
(e.g. \`jf_alpha:0.572,jf_nezumi:0.308,jm_kumo:0.12\`) — the handoff token.
Worker shapes, resolved by the agent in the seat (capability ladder):
1. Native TTS in your harness → condition it on the register's axes +
   direction yourself.
2. The optional local backend (docs/local-voice-worker.md;
   \`install-local-voicegen.sh\`, sibling dir \`~/mojulo-voicegen\`):
   \`venv/bin/python speak.py --text "<line>" --voice "<voiceArg>"
   --speed <speed> --out <path>.wav\` — Kokoro-82M on ONNX; \`speak.py\`
   handles Japanese G2P (misaki) and blend math; \`speak.mjs\` is the
   English-only fast path. Success prints a JSON handback
   \`{ ok, path, seconds, rms, ... }\`.
3. Neither → point the operator at the install doc; the register is still a
   complete artifact without a render.

After rendering, \`bind_voice_sample({ ref, wav_path, text, source })\` saves
the WAV append-only onto the register so the /maker/voice shelf plays it
(\`/api/sketches/<ref>/voice-sample.wav\`).

## Roadmap (voice-worker.plan.md)

V1: the durable render handoff (request/pull/submit/accept_voice_render —
the image-render bicycle transposed; machine gate = WAV magic + duration +
non-silence rms, ears gate = the accepting agent). V2: natively
voice-capable workers over the same queue. V3: consumers — bot spoken
replies, world narration via the manifest \`audio\` channel, film voiceover.`;

export async function getVoiceVocabHandler() {
  return { content: [{ type: 'text', text: VOICE_VOCAB }] };
}

export function registerVoiceTools() {
  registerTool({
    name: 'create_voice',
    description:
      'Mint a VOICE REGISTER (Mojulo Voice — the SPEECH mint, sibling to beats): a tiny deterministic recipe for how a voice sounds — two operator-framed axes (`confidence`: meek → authoritative; `depth`: native timbre → darker via a bounded cross-gender anchor) over a calibrated bank of stock Kokoro embeddings, resolved to blend weights by a pure lerp (same manifest → same waveform; no dice). Returns the resolved `voiceArg` an external speech worker renders — mojulo designs the voice, it never speaks. Capabilities, banks, and the worker loop live behind `get_voice_vocab`. Reach for "make/tune a voice", "a more confident / deeper / meeker voice", "a Japanese female narrator voice".',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: "The register's name (e.g. 'Misaki')." },
        params: {
          type: 'object',
          description: 'The recipe: { bank?, axes?: { confidence?, depth? }, speed?, direction?, poles? } — manual via get_voice_vocab.',
          additionalProperties: true,
        },
        ref: { type: 'string', description: 'Optional explicit ref (1-64 chars [A-Za-z0-9_-]).' },
        folder_ref: { type: 'string', description: 'Optional sketch folder to file under.' },
      },
      required: ['title'],
    },
    handler: createVoiceHandler,
  });

  registerTool({
    name: 'get_voice',
    description:
      'Read a voice register back: the manifest (bank, axes, speed, direction) plus the resolved blend — `weights`, the `voiceArg` handoff token, and the render hint for the local speech backend. The read anchor before re-minting a variant. Read-only.',
    inputSchema: {
      type: 'object',
      properties: { ref: { type: 'string', description: 'The voice register ref.' } },
      required: ['ref'],
    },
    handler: getVoiceHandler,
  });

  registerTool({
    name: 'bind_voice_sample',
    description:
      "Bind a worker-rendered WAV onto a voice register (append-only, axis-stamped slots in `data/outcomes/<ref>/`; served at `/api/sketches/<ref>/voice-sample.wav`) so the /maker/voice shelf can PLAY the register. `axes` stamps WHICH point of the register's tunable space the render speaks (defaults to the register's own axes) — bind the edges too ({confidence:0}, {confidence:1}, {depth:1}) and the card's sliders become audible pole to pole, playing the nearest rendered point. Derived render with provenance (`text`, `source`), never the artifact. Provide exactly one of `wav_path` (primary) or `wav_base64`. Checked at the door: RIFF/WAVE magic.",
    inputSchema: {
      type: 'object',
      properties: {
        ref: { type: 'string', description: 'The voice register ref.' },
        wav_path: { type: 'string', description: 'Absolute path to the rendered WAV on this host (primary).' },
        wav_base64: { type: 'string', description: 'Base64-encoded WAV bytes (remote-worker fallback). Exactly one of wav_path | wav_base64.' },
        axes: {
          type: 'object',
          description: "The axis point this render speaks, e.g. { confidence: 1, depth: 0 } (motoko edge). Defaults to the register's own axes.",
          properties: {
            confidence: { type: 'number' },
            depth: { type: 'number' },
          },
        },
        text: { type: 'string', description: 'The line that was spoken (provenance).' },
        source: { type: 'string', description: 'Worker/backend id for provenance (e.g. local-kokoro).' },
      },
      required: ['ref'],
    },
    handler: bindVoiceSampleHandler,
  });

  registerTool({
    name: 'get_voice_vocab',
    description:
      'The Mojulo Voice capability drawer: the voice-register recipe shape (banks, the confidence/depth axes, speed coupling, direction notes), why embedding blends are legitimate deterministic recipes, the calibration workflow, and the worker capability ladder (native TTS → local Kokoro backend). Pull before your first create_voice.',
    inputSchema: { type: 'object', properties: {} },
    handler: getVoiceVocabHandler,
  });
}
