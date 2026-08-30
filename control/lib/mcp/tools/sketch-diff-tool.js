/**
 * Split out of tools/sketches.js — see
 * lite-template/integration/_0828/mojulo-2.0-pure-creative.plan.md (Phase 1c).
 * sketches.js hosted six unrelated tool families in one 2038-line file; each
 * now owns its own module and sketches.js is the registration surface.
 */
// diff_sketches — the side-by-side visual diff mint.


import { SketchRepository } from '@/lib/db/repositories/sketches';
import { isBeatsKind } from '@/lib/graph/beats/beats-manifest';
import { isVoiceRegisterKind } from '@/lib/graph/voice/voice-register';
import { deriveSketchDiffManifest } from '@/lib/graph/sketch/sketch-diff';
import { mintSketch } from './sketch-mint.js';

export async function diffSketchesHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('diff_sketches requires { left_ref, right_ref }');
  }
  const {
    left_ref,
    right_ref,
    title,
    ref,
    min_similarity = 0.25,
    force = false,
  } = input;
  if (!left_ref || typeof left_ref !== 'string') {
    throw new Error('`left_ref` is required (string)');
  }
  if (!right_ref || typeof right_ref !== 'string') {
    throw new Error('`right_ref` is required (string)');
  }
  if (left_ref === right_ref) {
    throw new Error('`left_ref` and `right_ref` must be different sketch refs');
  }
  if (title !== undefined && typeof title !== 'string') {
    throw new Error('`title` must be a string if provided');
  }
  if (ref !== undefined) {
    if (typeof ref !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(ref)) {
      throw new Error('`ref` must be 1-64 chars of [A-Za-z0-9_-] if provided');
    }
  }
  if (
    typeof min_similarity !== 'number' ||
    !Number.isFinite(min_similarity) ||
    min_similarity < 0 ||
    min_similarity > 1
  ) {
    throw new Error('`min_similarity` must be a number between 0 and 1');
  }
  if (typeof force !== 'boolean') {
    throw new Error('`force` must be a boolean if provided');
  }

  const left = SketchRepository.getByRef(left_ref);
  if (!left) throw new Error(`No sketch exists at left_ref '${left_ref}'`);
  const right = SketchRepository.getByRef(right_ref);
  if (!right) throw new Error(`No sketch exists at right_ref '${right_ref}'`);

  // Beats guard rail (B9): geometry diffing two recipes produces a meaningless
  // picture — the musical diff is a report, not a picture.
  if ((left.manifest && isBeatsKind(left.manifest.kind)) || (right.manifest && isBeatsKind(right.manifest.kind))) {
    throw new Error(
      'These are beats artifacts — use diff_beats { refA, refB } (accepts ref@rev) for a '
      + 'structured musical diff: tempo/track/grid/progression changes, not SVG geometry.',
    );
  }
  if ((left.manifest && isVoiceRegisterKind(left.manifest.kind)) || (right.manifest && isVoiceRegisterKind(right.manifest.kind))) {
    throw new Error(
      'These are voice registers — compare them by reading both with get_voice: the recipes are '
      + 'two axes + a blend, small enough to diff by eye, not SVG geometry.',
    );
  }

  const diff = deriveSketchDiffManifest({
    left,
    right,
    leftRef: left_ref,
    rightRef: right_ref,
    title,
    minSimilarity: min_similarity,
    force,
  });
  if (!diff.comparable) {
    return {
      ok: false,
      verdict: 'too_different',
      similarity: diff.similarity,
      summary: diff.summary,
      message:
        'Sketches do not appear comparable enough for a useful visual diff. next: re-call with force:true if you really want the low-confidence comparison, or diff nearer revisions.',
    };
  }

  const minted = mintSketch({
    title: title || `Sketch diff: ${left_ref} -> ${right_ref}`,
    manifest: diff.manifest,
    ref,
  });
  return {
    ...minted,
    verdict: force && diff.similarity < min_similarity ? 'forced_low_confidence' : 'diff_created',
    similarity: diff.similarity,
    summary: diff.summary,
  };
}
