/**
 * cover-manifest — normalize a `kind:'cover'` recipe and expand its render
 * targets.
 *
 * A cover is a sovereign sketch recipe: an `artDirection` contract (§4 of
 * cover-composition.plan.md) + named slots (illustration · title · subtext ·
 * metadata). This module fills defaults (seeded per publication kind), so a
 * loose input from the tool layer becomes a complete, deterministic manifest the
 * scaffold / compositor / (later) render bicycle all read.
 *
 * Kept separate from the 5-kind image-outcomes manifest.js on purpose: the cover
 * is a new kind and its normalizer shouldn't destabilize that file. The render
 * seam dispatches to `coverRenderTargets` for `kind:'cover'` (wired in a later
 * increment); the compositor already reads this shape.
 *
 * Pure — no fs, no sharp.
 */
import { defaultsForKind, canvasFor } from './cover-archetypes.js';

export const COVER_KIND = 'cover';

const DEFAULT_PALETTE = { bg: '#1a1420', accent: '#e8c14a', ink: '#f5f0e6' };

const asList = (v) => (Array.isArray(v) ? v : v == null ? [] : [v]);

/** Fill a loose cover input into a complete manifest. Never throws on missing
 *  optional fields; a bare `{ slots: { title: { text } } }` normalizes. */
export function normalizeCoverManifest(input = {}) {
  const forKind = input.for_kind || 'novel';
  const kd = defaultsForKind(forKind);
  const ad = input.artDirection || {};

  const canvas = input.canvas && input.canvas.w && input.canvas.h
    ? { w: Math.round(input.canvas.w), h: Math.round(input.canvas.h) }
    : canvasFor(forKind, ad.composition?.aspect);

  const composition = {
    archetype: ad.composition?.archetype || kd.archetypes[0],
    focal: ad.composition?.focal || 'upper-third',
    ...(ad.composition?.titleZone ? { titleZone: ad.composition.titleZone } : {}),
  };

  const artDirection = {
    ...(ad.renderBrief ? { renderBrief: ad.renderBrief } : {}),
    palette: { ...DEFAULT_PALETTE, ...(ad.palette || {}) },
    type: { titleFont: kd.type.titleFont, textFont: kd.type.textFont, ...(ad.type || {}) },
    composition,
    ...(ad.relationship ? { relationship: ad.relationship } : {}),
    checklist: asList(ad.checklist),
  };

  const slotsIn = input.slots || {};
  const title = slotsIn.title || {};
  const slots = {
    illustration: {
      realizer: slotsIn.illustration?.realizer || 'painted',
      region: slotsIn.illustration?.region || 'full-bleed',
      brief: slotsIn.illustration?.brief || {},
    },
    title: {
      text: title.text != null ? String(title.text) : 'Untitled',
      realizer: title.realizer || 'painted',
      ...(title.treatment ? { treatment: title.treatment } : {}),
      ...(title.font ? { font: title.font } : {}),
    },
    subtext: asList(slotsIn.subtext).map((s) => ({
      role: s.role || 'author',
      text: String(s.text ?? ''),
      ...(s.font ? { font: s.font } : {}),
    })),
    metadata: asList(slotsIn.metadata).map((mm) => ({
      kind: mm.kind || 'note',
      value: String(mm.value ?? ''),
    })),
  };

  return { kind: COVER_KIND, for_kind: forKind, canvas, artDirection, slots };
}

/**
 * Render targets for a cover. The illustration is always painted (a target);
 * the title is a target only when its realizer is `painted` (carved/flat titles
 * are composited deterministically from the manifest, no target). Illustration
 * first so the background is painted before the title conditions on it.
 */
export function coverRenderTargets(manifest) {
  const m = manifest.kind === COVER_KIND ? manifest : normalizeCoverManifest(manifest);
  const targets = ['illustration'];
  if (m.slots.title?.realizer === 'painted') targets.push('title');
  return targets;
}
