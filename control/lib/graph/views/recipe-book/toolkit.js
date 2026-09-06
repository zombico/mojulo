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
 *   • solids (v2; first consumer: the workbench `code` kind, expressiveness.plan.md
 *     E3) — the field-term library + its polygonizer, the sweep frames, seeded
 *     noise and dice, the vector kit: a program composes solids without importing.
 *
 * COMPATIBILITY PROMISE: like the recipes themselves, this surface is
 * append-only. A book builder written against version N must keep working —
 * bump `version` when a namespace is ADDED so builders can feature-check
 * (`ctx.toolkit.version >= 2`); never remove or reshape what shipped.
 */

import { buildVolumeFrag } from '@/lib/graph/effects/volume-raymarch';
import { SDF_GLSL } from '@/lib/graph/effects/sdf-glsl';
import * as fieldTerms from '@/lib/graph/polygonizer/field-terms';
import { surfaceNetFaces } from '@/lib/graph/polygonizer/field-mesh';
import { fieldToFaces, fieldGrid } from '@/lib/graph/polygonizer/field-faces';
import { parseFieldExpr, compileFieldExpr } from '@/lib/graph/polygonizer/field-expr';
import { noise3, noise3Amplitude } from '@/lib/graph/polygonizer/fields';
import { transportFrames } from '@/lib/graph/polygonizer/sweep-faces';
import { mulberry32 } from '@/lib/graph/polygonizer/floorplan-glyphs';

export const BOOK_TOOLKIT_VERSION = 2;

let _toolkit = null;
export function buildBookToolkit() {
  if (_toolkit) return _toolkit;
  const {
    vec, padBounds, unionBounds,
    sphere, ellipsoid, roundCone, box, capsule, sweepField, extrudeField, latheField, exprField,
    union, intersect, subtract, smoothUnion, smoothIntersect, smoothSubtract, shell, round, stroke, displace,
    transformSolid, repeatSolid, twistSolid, bendSolid, taperSolid, elongateSolid,
    composeFieldTerms, validateFieldTerms, shapeFromSpec, FIELD_SHAPE_KINDS, FIELD_OPS,
  } = fieldTerms;
  _toolkit = Object.freeze({
    version: BOOK_TOOLKIT_VERSION,
    effects: Object.freeze({ buildVolumeFrag, SDF_GLSL }),
    // v2 — solids. `terms` are the field-terms constructors / combinators / domain ops
    // ({ d, bounds } terms); `compose(terms)` reads a recipe-shaped term list;
    // `surfaceNet(d, bounds, { cells })` polygonizes any (p) => number to closed quads;
    // `fieldFaces(spec)` is the whole `fields` monomer as baked faces.
    solids: Object.freeze({
      vec, padBounds, unionBounds,
      terms: Object.freeze({
        sphere, ellipsoid, roundCone, box, capsule, sweep: sweepField, extrude: extrudeField, lathe: latheField, expr: exprField,
        union, intersect, subtract, smoothUnion, smoothIntersect, smoothSubtract, shell, round, stroke, displace,
        transform: transformSolid, repeat: repeatSolid, twist: twistSolid, bend: bendSolid, taper: taperSolid, elongate: elongateSolid,
        fromSpec: shapeFromSpec, SHAPE_KINDS: FIELD_SHAPE_KINDS, OPS: FIELD_OPS,
      }),
      compose: composeFieldTerms,
      validateTerms: validateFieldTerms,
      expr: Object.freeze({ parse: parseFieldExpr, compile: compileFieldExpr }),
      surfaceNet: surfaceNetFaces,
      fieldFaces: fieldToFaces,
      fieldGrid,
      noise3, noise3Amplitude,
      mulberry32,
      transportFrames,
    }),
  });
  return _toolkit;
}
