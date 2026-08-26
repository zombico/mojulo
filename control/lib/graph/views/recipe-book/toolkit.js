/**
 * recipe-book toolkit — the INJECTED primitive API for Door-2 builders
 * (recipe-book.plan.md, seam 4). Book builders are pure and import NOTHING;
 * anything of mojulo's they need is handed to them here, as `ctx.toolkit` on
 * every `plan(recipe, ctx)` / `assemble(recipe, ctx)` call. Tier-0 builders
 * simply ignore it.
 *
 * Grown by DEMONSTRATED NEED, not speculation — each namespace exists because
 * a shipped book kind required it (the plan's Tier audit is the sizing guide;
 * Tier-3 builders must never size this surface):
 *   • effects (Tier-2, first consumer: aurora) — the volume-raymarch scaffold
 *     + shared SDF snippets, exactly what the core Tier-2 views import.
 *
 * COMPATIBILITY PROMISE: like the recipes themselves, this surface is
 * append-only. A book builder written against version N must keep working —
 * bump `version` when a namespace is ADDED so builders can feature-check
 * (`ctx.toolkit.version >= 2`); never remove or reshape what shipped.
 */

import { buildVolumeFrag } from '@/lib/graph/effects/volume-raymarch';
import { SDF_GLSL } from '@/lib/graph/effects/sdf-glsl';

export const BOOK_TOOLKIT_VERSION = 1;

let _toolkit = null;
export function buildBookToolkit() {
  if (_toolkit) return _toolkit;
  _toolkit = Object.freeze({
    version: BOOK_TOOLKIT_VERSION,
    effects: Object.freeze({ buildVolumeFrag, SDF_GLSL }),
  });
  return _toolkit;
}
