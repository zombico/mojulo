/**
 * Camera vocabulary — the precision dial the spike showed was missing
 * (image-outcomes.plan.md I2). A camera is a CLOSED vocabulary entry, not a
 * freeform string the image model reads as vibes: each kind carries an
 * instruction phrasing (rendered into the worker brief), a horizon band,
 * and a subject-framing band the audit can check a render against.
 *
 * Constraint semantics: `horizonBand` is where the horizon should sit as a
 * fraction of frame height (null = the shot has no meaningful horizon, e.g.
 * an insert). `subjectHeightFrac` is the band the primary subject's height
 * should occupy as a fraction of frame height. Both are AUDIT dials, not
 * mint blockers — only kind membership is validated at mint. Per-instance
 * horizonY / vanishingPoint stay on the manifest's camera object.
 *
 * The entry fields align with the polygonizer two-point camera primitive
 * (vanishingPoints, horizonY, cropBox) so a world camera can lower into a
 * vocabulary entry later (plan I6).
 */

export const CAMERA_VOCAB = {
  'wide-establishing': {
    phrase: 'wide establishing shot — full scene geography readable, subject small in frame',
    horizonBand: [0.25, 0.55],
    subjectHeightFrac: [0.15, 0.45],
  },
  'wide-cinematic': {
    phrase: 'wide cinematic shot — expansive reveal, strong horizon, subject anchored against scale',
    horizonBand: [0.3, 0.7],
    subjectHeightFrac: [0.1, 0.4],
  },
  'insert-close-up': {
    phrase: 'insert close-up — a single object/detail fills the frame; no environment geography',
    horizonBand: null,
    subjectHeightFrac: [0.5, 0.95],
  },
  'close-up': {
    phrase: 'close-up — face/subject dominates the frame, background reduced to tone',
    horizonBand: null,
    subjectHeightFrac: [0.6, 0.95],
  },
  'low-angle-hero': {
    phrase: 'low-angle hero shot — camera below the subject looking up; subject towers, sky/ceiling behind',
    horizonBand: [0.45, 0.9],
    subjectHeightFrac: [0.5, 0.95],
  },
  'over-shoulder': {
    phrase: 'over-the-shoulder — foreground shoulder/head silhouette framing the subject beyond',
    horizonBand: [0.3, 0.6],
    subjectHeightFrac: [0.3, 0.7],
  },
};

export const CAMERA_KINDS = Object.keys(CAMERA_VOCAB);

export function isCameraKind(kind) {
  return Object.prototype.hasOwnProperty.call(CAMERA_VOCAB, kind);
}

export function cameraEntry(kind) {
  const entry = CAMERA_VOCAB[kind];
  if (!entry) throw new Error(`unknown camera kind: ${kind} (one of: ${CAMERA_KINDS.join(', ')})`);
  return { kind, ...entry };
}

export function cameraPhrase(kind) {
  return cameraEntry(kind).phrase;
}
