/**
 * Storyboard fidelity vocabulary — closed, board-level (the comic
 * pipeline's fidelity dial, transposed to boards). Fidelity is a FINISH
 * DISCIPLINE, orthogonal to the Style Lock: the preset says what drawing
 * language the production speaks; fidelity says how far each frame is
 * taken in it. Worker-facing: every level renders a "## Fidelity" section
 * into the frame brief, with its own avoid lines merged in.
 *
 * The ladder mirrors real board production:
 *   thumbnail    — gesture roughs; speed over polish (the comic 'nemu').
 *   working      — clean readable board drawing; the default.
 *   color-script — small color/mood studies; palette + light are the
 *                  deliverable, drawing is secondary.
 *   concept      — full concept-art frames: the frame's JOB is production
 *                  design — environment, costume, materials, lighting
 *                  language — one-shot the feel of the film.
 */

export const FIDELITY_LEVELS = {
  thumbnail: {
    name: 'thumbnail roughs',
    deliverable: [
      'the deliverable is a ROUGH: gesture lines and value masses only — the staging read, nothing else',
      'two or three values; faces as blank shapes; hands as mitts; energy over accuracy',
      'it should look like it took two minutes — a board artist thinking on paper',
    ],
    avoid: [
      'no cleanup, no rendered lighting, no surface detail',
      'no polish of any kind — a finished-looking thumbnail is a failed thumbnail',
    ],
  },
  working: {
    name: 'working board',
    deliverable: [
      'a clean board drawing: readable staging, clear silhouettes, indicated tone',
      'production-board finish — drawn, not painted; detail only where it serves the read',
    ],
    avoid: [
      'no full paint rendering — this is a drawing with tone, not an illustration',
    ],
  },
  'color-script': {
    name: 'color script',
    deliverable: [
      'the deliverable is PALETTE and LIGHT, not drawing: a small color study of the shot',
      'simplified masses, mood-true color relationships, the light source felt',
      'palette continuity across the sequence is the point — hold the same key from frame to frame as the script directs',
    ],
    avoid: [
      'no linework detail, no faces, no rendering of surfaces — color relationships only',
    ],
  },
  concept: {
    name: 'concept art',
    deliverable: [
      'a full concept-art frame: this frame\'s job is to DESIGN the production, not just stage the shot',
      'establish the environment design, costume, materials, and lighting language — decisions, not suggestions',
      'render to portfolio concept-art finish; invent confidently within the brief — an accepted frame becomes the production\'s design reference',
    ],
    avoid: [
      'no generic placeholder design — every surface and garment is a design decision',
    ],
  },
};

export const FIDELITY_KINDS = Object.keys(FIDELITY_LEVELS);

export function isFidelity(level) {
  return Object.prototype.hasOwnProperty.call(FIDELITY_LEVELS, level);
}

export function fidelityEntry(level) {
  const entry = FIDELITY_LEVELS[level];
  if (!entry) throw new Error(`unknown fidelity level: ${level} (one of: ${FIDELITY_KINDS.join(', ')})`);
  return { level, ...entry };
}

/** The brief section — rendered into every frame brief at this fidelity. */
export function fidelityLines(level) {
  const entry = fidelityEntry(level);
  return [
    `## Fidelity — ${entry.level} (${entry.name})`,
    ...entry.deliverable.map((line) => `- ${line}`),
    ...entry.avoid.map((line) => `- AVOID: ${line}`),
    ...(level !== 'concept'
      ? ['- the Style Lock (if any) still applies — fidelity sets the finish level WITHIN that drawing discipline']
      : []),
  ];
}
