/**
 * Manji-program — the tree IR for polygonizer's manji-driven authoring.
 *
 * A manji-program-tree is the vector-space representation of an
 * illustration: macro-to-micro nested manji programs terminating in
 * named marks. See
 * [lite-template/integration/0604/polygonizer-manji-tree.plan.md] for
 * the design.
 *
 * This module provides:
 *   - The tree node and terminal mark schemas (documented inline).
 *   - `resolvePreset` — expands a manji-program preset (the field
 *     mandala-pattern cards carry) into a concrete spine manji program
 *     plus a labeled slot grammar.
 *   - `walkManjiTree` — walks the tree, evaluating each manji at its
 *     world anchor and emitting a flat list for the renderer.
 *   - `validateManjiTree` — runs `validateCardinalManji` on every
 *     program node in the tree.
 *
 * Out of scope: rendering. The walker emits enough data
 * (evaluated manjis, slot world positions, terminal marks) for the
 * renderer to realize marks; mark realization itself happens elsewhere.
 */

import {
  ANCHOR_PATTERNS,
  bbox3DOf,
  bboxOf,
  cardinalManji,
  cardinalManji3D,
  evaluateManji,
  evaluateManji3D,
  validateCardinalManji,
  validateCardinalManji3D,
} from './manji.js';
import { projectTwoPoint } from './pure-mandala.js';
import { buildEndpointResolver } from './line-between.js';
import {
  walkLimbChain,
  validateLimbChainSpec,
  composeRotation,
  rotateAroundPivot,
} from './limb-chain.js';
import { evaluateScalarOrFieldRef, nullFieldResolver, buildLazyFieldResolver, isVectorFieldKind } from './fields.js';

/**
 * Resolve a tree node's anchor components ({x, y, z}) into a world
 * anchor, applying the parentAnchor offset + axisSigns reflection +
 * parentScale multiplier. Each component accepts either a literal
 * number or `{ field: '<id>' }`; field refs evaluate through the
 * walker's lazy field resolver at the partially-built world anchor.
 *
 * Evaluation order: x first, then y (each at parent's xyz so their
 * field positions don't depend on each other), then z at the
 * (worldX, worldY, parentZ) point so `anchor.z = { field: 'terrain' }`
 * naturally evaluates the terrain field AT the child's xy position
 * and uses the result as the child's local z. That's the landscape
 * authoring shape we just unlocked. See
 * lite-template/integration/0605/landscape-substrate.plan.md.
 */
function resolveAnchorComponents(rawAnchor, parentAnchor, parentScale, axisSigns, fieldResolver) {
  // x evaluates at the parent's world position — most common case is a
  // literal so the position barely matters.
  const localX = evaluateScalarOrFieldRef(rawAnchor.x, fieldResolver, parentAnchor, 0);
  const worldX = parentAnchor.x + parentScale * axisSigns.x * localX;
  // y evaluates at the parent's world position too. (Two refs into
  // distinct fields are also fine — they just don't co-depend.)
  const localY = evaluateScalarOrFieldRef(rawAnchor.y, fieldResolver, parentAnchor, 0);
  const worldY = parentAnchor.y + parentScale * axisSigns.y * localY;
  // z evaluates at the partial world (x, y, parentZ). For a terrain
  // wave-surface field, this gives the surface height at the child's xy.
  const partialAnchor = { x: worldX, y: worldY, z: parentAnchor.z };
  const localZ = evaluateScalarOrFieldRef(rawAnchor.z, fieldResolver, partialAnchor, 0);
  const worldZ = parentAnchor.z + parentScale * axisSigns.z * localZ;
  return { x: worldX, y: worldY, z: worldZ };
}

/**
 * Apply field-coupled `lengthScale` resolution to a spine spec before
 * passing it to cardinalManji3D. Each bar's `lengthScale` accepts either
 * a number or `{ field: '<id>' }`; field refs evaluate at the node's
 * worldAnchor position via the supplied resolver.
 *
 * Spine bars without lengthScale fall through unchanged. Same with
 * spines whose `bar*.lengthScale` is already a literal number — the
 * helper is a pure pass-through in the common case.
 */
function resolveSpineLengthScales(spine, fieldResolver, worldAnchor) {
  if (!spine || typeof spine !== 'object') return spine;
  let mutated = null;
  for (const key of ['bar1', 'bar2', 'bar3']) {
    const bar = spine[key];
    if (!bar || bar.lengthScale === undefined || bar.lengthScale === null) continue;
    if (Number.isFinite(bar.lengthScale)) continue;
    const resolved = evaluateScalarOrFieldRef(
      bar.lengthScale, fieldResolver, worldAnchor, 1,
    );
    if (!mutated) mutated = { ...spine };
    mutated[key] = { ...bar, lengthScale: resolved };
  }
  return mutated || spine;
}

// ----- Subtree modifiers: replicate + reflect ---------------------------
//
// `replicate` and `reflect` are tree-IR modifiers the walker honors. They
// preserve the cardinal-kernel invariant: replicate is pure positional
// duplication (no per-instance rotation), and reflect mirrors a subtree
// across a cardinal axis (cardinals map to cardinals — N↔S under N-S
// reflection, E↔W under E-W, Zenith↔Nadir under Zenith-Nadir).
//
// Both modifiers stack with the regular node fields (anchor, scale,
// children). A node carrying `replicate` is a transparent multiplier:
// it emits no spine itself; the walker visits the inner `node` once per
// offset. A node carrying `reflect` applies the axis-sign flip to its
// own spine, slots, and recursively to every descendant.
//
// See lite-template/integration/0605/manji-program-library-expansion.plan.md
// for the design rationale.

const REFLECTION_SIGN_VECTORS = {
  'N-S': { x: -1, y: 1, z: 1 },
  'E-W': { x: 1, y: -1, z: 1 },
  'Zenith-Nadir': { x: 1, y: 1, z: -1 },
};

export const REFLECT_AXES = Object.keys(REFLECTION_SIGN_VECTORS);

function combineReflect(currentSigns, reflectSpec) {
  if (!reflectSpec) return currentSigns;
  const list = Array.isArray(reflectSpec) ? reflectSpec : [reflectSpec];
  let result = { ...currentSigns };
  for (const axis of list) {
    const mask = REFLECTION_SIGN_VECTORS[axis];
    if (!mask) {
      throw new Error(
        `reflect: unknown axis '${axis}' (must be one of: ${REFLECT_AXES.join(', ')})`,
      );
    }
    result = { x: result.x * mask.x, y: result.y * mask.y, z: result.z * mask.z };
  }
  return result;
}

function resolveReplicateOffsets2D(replicate) {
  if (!replicate || typeof replicate !== 'object') {
    throw new Error('replicate must be an object with `pattern` or `offsets`');
  }
  if (Array.isArray(replicate.offsets)) {
    return replicate.offsets.map((o) => ({
      x: Number(o?.x ?? 0),
      y: Number(o?.y ?? 0),
    }));
  }
  if (replicate.pattern) {
    const pattern = ANCHOR_PATTERNS[replicate.pattern];
    if (!pattern) {
      throw new Error(
        `replicate.pattern: unknown pattern '${replicate.pattern}' (must be one of: ${Object.keys(ANCHOR_PATTERNS).join(', ')})`,
      );
    }
    return pattern.placeAnchors(1, replicate.params || {});
  }
  throw new Error('replicate must carry either `pattern` or `offsets`');
}

function resolveReplicateOffsets3D(replicate) {
  if (!replicate || typeof replicate !== 'object') {
    throw new Error('replicate must be an object with `pattern` or `offsets`');
  }
  if (Array.isArray(replicate.offsets)) {
    return replicate.offsets.map((o) => ({
      x: Number(o?.x ?? 0),
      y: Number(o?.y ?? 0),
      z: Number(o?.z ?? 0),
    }));
  }
  if (replicate.pattern) {
    const pattern = ANCHOR_PATTERNS[replicate.pattern];
    if (!pattern) {
      throw new Error(
        `replicate.pattern: unknown pattern '${replicate.pattern}' (must be one of: ${Object.keys(ANCHOR_PATTERNS).join(', ')})`,
      );
    }
    return pattern.placeAnchors(1, replicate.params || {}).map((p) => ({
      x: p.x,
      y: p.y,
      z: 0,
    }));
  }
  throw new Error('replicate must carry either `pattern` or `offsets`');
}

function instantiateReplicatedNode2D(innerSpec, offset, index) {
  const baseAnchor = innerSpec?.anchor || {};
  const anchor = {
    x: Number(baseAnchor.x ?? 0) + offset.x,
    y: Number(baseAnchor.y ?? 0) + offset.y,
  };
  const next = { ...innerSpec, anchor };
  if (innerSpec?.id) next.id = `${innerSpec.id}#${index}`;
  return next;
}

function instantiateReplicatedNode3D(innerSpec, offset, index) {
  const baseAnchor = innerSpec?.anchor || {};
  // For each axis: a literal numeric base accumulates with the offset;
  // a field-ref base is preserved untouched (the field describes the
  // axis value, not a numeric offset that replicate can sum into). v1
  // doesn't try to combine field refs with offsets — landscape
  // authoring uses replicate for xy positions and the field for z, so
  // the two never collide.
  const combine = (base, off) => {
    if (Number.isFinite(base)) return base + off;
    if (base === undefined || base === null) return off;
    return base;
  };
  const anchor = {
    x: combine(baseAnchor.x, offset.x),
    y: combine(baseAnchor.y, offset.y),
    z: combine(baseAnchor.z, offset.z),
  };
  const next = { ...innerSpec, anchor };
  if (innerSpec?.id) next.id = `${innerSpec.id}#${index}`;
  return next;
}

function reflectPointAround2D(p, anchor, signs) {
  return {
    x: anchor.x + signs.x * (p.x - anchor.x),
    y: anchor.y + signs.y * (p.y - anchor.y),
  };
}

function reflectPointAround3D(p, anchor, signs) {
  return {
    x: anchor.x + signs.x * (p.x - anchor.x),
    y: anchor.y + signs.y * (p.y - anchor.y),
    z: anchor.z + signs.z * (p.z - anchor.z),
  };
}

function reflectEvaluatedManji2D(manji, anchor, signs) {
  if (signs.x === 1 && signs.y === 1) return manji;
  const ref = (p) => reflectPointAround2D(p, anchor, signs);
  const newBars = manji.bars.map((bar) => ({
    points: Object.fromEntries(Object.entries(bar.points).map(([k, v]) => [k, ref(v)])),
    segments: bar.segments.map((s) => ({ from: ref(s.from), to: ref(s.to) })),
  }));
  const newArmTips = manji.armTips.map(ref);
  const allPoints = newBars.flatMap((b) => Object.values(b.points));
  return { ...manji, bars: newBars, armTips: newArmTips, bbox: bboxOf(allPoints) };
}

function reflectEvaluatedManji3D(manji, anchor, signs) {
  if (signs.x === 1 && signs.y === 1 && signs.z === 1) return manji;
  const ref = (p) => reflectPointAround3D(p, anchor, signs);
  const newBars = manji.bars.map((bar) => {
    const { negCardinal, posCardinal, ...pts } = bar.points;
    const reflectedPts = Object.fromEntries(
      Object.entries(pts).map(([k, v]) => [k, ref(v)]),
    );
    return {
      axis: bar.axis,
      points: { ...reflectedPts, negCardinal, posCardinal },
      segments: bar.segments.map((s) => ({ from: ref(s.from), to: ref(s.to) })),
    };
  });
  const newArmTips = manji.armTips.map(ref);
  return { ...manji, bars: newBars, armTips: newArmTips, bbox: bbox3DOf(newArmTips) };
}

export const TERMINAL_KINDS = Object.freeze([
  'line', 'polygon', 'dot',
  'brick-fill', 'hatch', 'stipple', 'wash', 'wisp',
]);

export function isTerminal(node) {
  return node !== null
    && typeof node === 'object'
    && typeof node.kind === 'string'
    && TERMINAL_KINDS.includes(node.kind);
}

// Leaf marks are the dimensional-wave primitives previously authored as
// top-level manifest arrays (`connections[]`, `waveFields[]`). When
// authored as tree nodes they behave like terminals (no children, no
// spine) but carry endpoint paths instead of anchor+kind. The walker
// emits them with a `leafMark` field that captures both the spec and
// the `selfId` (nearest enclosing manji node's emitted id) so paths
// like `self/slot/<id>` can resolve later.
//
// See lite-template/integration/0605/wave-and-line-in-tree.plan.md.

export const LEAF_MARK_KINDS = Object.freeze(['connection', 'wave-field', 'wave-manji', 'lathe', 'limb-chain', 'vajra', 'taiji']);

export function isLeafMark(node) {
  return node !== null
    && typeof node === 'object'
    && typeof node.kind === 'string'
    && LEAF_MARK_KINDS.includes(node.kind);
}

// Rewrite endpoint paths on a leaf-mark spec per the `pathBindings`
// map authored on a calling `programRef` node. Exact-string matches
// only; unbound paths fall through unchanged. Returns a new spec —
// never mutates the input (preset children are shared across mints).
//
// For container-preset cards that author `self/slot/<X>` corner paths,
// pathBindings lets a host with differently-named slots invoke the
// card by name without renaming its own slots:
//
//   { slot: 'fill', node: {
//     programRef: 'calm-water',
//     pathBindings: {
//       'self/slot/NW': 'world/slot/water-NW',
//       'self/slot/NE': 'world/slot/water-NE',
//       'self/slot/SE': 'world/slot/water-SE',
//       'self/slot/SW': 'world/slot/water-SW',
//     },
//   } }
function rewritePath(pathStr, bindings) {
  if (!bindings || typeof pathStr !== 'string') return pathStr;
  return Object.hasOwn(bindings, pathStr) ? bindings[pathStr] : pathStr;
}

// Rewrite a `self/...` endpoint-path string into an absolute form using
// the calling node's enclosing manji id. Non-self paths and {x,y,z}
// values pass through. Used when a shelf card declares `fields` whose
// positions reference `self` — those references need to be substituted
// at inline-time, same way leaf-mark endpoint paths are.
function rewriteSelfInPositionSpec(spec, selfId) {
  if (typeof spec !== 'string') return spec;
  if (!spec.startsWith('self/')) return spec;
  if (!selfId) {
    throw new Error(
      `card-declared field path '${spec}': 'self' has no enclosing manji node in scope`,
    );
  }
  return `${selfId}/${spec.slice('self/'.length)}`;
}

// Apply self-substitution AND pathBindings to a card-declared field
// declaration. The fields module accepts endpoint-path strings in
// `center` (radial) and `from` / `to` (gradient); only those slots are
// touched. Order matches how leaf-mark specs are processed —
// pathBindings rewrites matched literals first, then any remaining
// `self/...` paths fall through to selfId substitution.
function substituteSelfInFieldDecl(decl, selfId, bindings) {
  if (!decl || typeof decl !== 'object') return decl;
  const rewrite = (spec) => {
    let s = spec;
    if (bindings && typeof s === 'string' && Object.hasOwn(bindings, s)) {
      s = bindings[s];
    }
    return rewriteSelfInPositionSpec(s, selfId);
  };
  if (decl.kind === 'radial') {
    return { ...decl, center: rewrite(decl.center) };
  }
  if (decl.kind === 'gradient') {
    return {
      ...decl,
      from: rewrite(decl.from),
      to:   rewrite(decl.to),
    };
  }
  return decl;
}

function applyPathBindingsToLeafSpec(spec, bindings) {
  if (!bindings || !spec || typeof spec !== 'object') return spec;
  if (spec.kind === 'wave-field') {
    const corners = Array.isArray(spec.corners) ? spec.corners : [];
    return { ...spec, corners: corners.map((c) => rewritePath(c, bindings)) };
  }
  if (spec.kind === 'connection') {
    return {
      ...spec,
      from: rewritePath(spec.from, bindings),
      to:   rewritePath(spec.to,   bindings),
    };
  }
  if (spec.kind === 'wave-manji') {
    // Only string singularities are paths; {x,y,z} values pass through.
    if (typeof spec.singularity !== 'string') return spec;
    return { ...spec, singularity: rewritePath(spec.singularity, bindings) };
  }
  if (spec.kind === 'lathe') {
    return {
      ...spec,
      ...(typeof spec.axisFrom === 'string' ? { axisFrom: rewritePath(spec.axisFrom, bindings) } : {}),
      ...(typeof spec.axisTo === 'string'   ? { axisTo:   rewritePath(spec.axisTo,   bindings) } : {}),
    };
  }
  if (spec.kind === 'vajra') {
    return {
      ...spec,
      ...(typeof spec.proximal === 'string' ? { proximal: rewritePath(spec.proximal, bindings) } : {}),
      ...(typeof spec.center === 'string'   ? { center:   rewritePath(spec.center,   bindings) } : {}),
      ...(typeof spec.distal === 'string'   ? { distal:   rewritePath(spec.distal,   bindings) } : {}),
    };
  }
  if (spec.kind === 'taiji') {
    return {
      ...spec,
      ...(typeof spec.yin === 'string'    ? { yin:    rewritePath(spec.yin,    bindings) } : {}),
      ...(typeof spec.yang === 'string'   ? { yang:   rewritePath(spec.yang,   bindings) } : {}),
      ...(typeof spec.center === 'string' ? { center: rewritePath(spec.center, bindings) } : {}),
    };
  }
  return spec;
}

/**
 * Resolve a manji-program preset spec into a concrete spine manji
 * program plus labeled slot grammar.
 *
 * Preset shape:
 *   {
 *     spine: { bar1: {...}, bar2: {...} },    // cardinalManji params
 *     slotPattern: { id, params? },            // ANCHOR_PATTERNS id + params
 *     slotLabels: [string],                    // labels paired with anchors
 *     centerSlotId?: string,                   // optional center slot
 *   }
 *
 * Returns:
 *   {
 *     spineProgram,                            // cardinalManji output
 *     slots: [{ id, position, radialAngleDeg }] // unit-space positions
 *   }
 */
export function resolvePreset(preset) {
  if (!preset || typeof preset !== 'object') {
    throw new Error('resolvePreset: preset object required');
  }
  const spineProgram = preset.spine ? cardinalManji(preset.spine) : null;

  const slotPatternId = preset.slotPattern?.id;
  if (slotPatternId && !ANCHOR_PATTERNS[slotPatternId]) {
    throw new Error(`resolvePreset: unknown slotPattern '${slotPatternId}'`);
  }
  const pattern = slotPatternId ? ANCHOR_PATTERNS[slotPatternId] : null;
  const patternParams = preset.slotPattern?.params || {};
  const positions = pattern ? pattern.placeAnchors(1, patternParams) : [];
  const labels = Array.isArray(preset.slotLabels) ? preset.slotLabels : [];

  const slots = positions.map((position, i) => ({
    id: labels[i] || `slot-${i}`,
    position,
    radialAngleDeg: angleDeg(position),
  }));
  if (preset.centerSlotId) {
    slots.unshift({
      id: preset.centerSlotId,
      position: { x: 0, y: 0 },
      radialAngleDeg: 0,
    });
  }
  return { spineProgram, slots };
}

function angleDeg(point) {
  const mag = Math.hypot(point.x, point.y);
  if (mag < 1e-12) return 0;
  return (Math.atan2(point.y, point.x) * 180) / Math.PI;
}

/**
 * Walk a manji-tree, returning a flat array of evaluated nodes.
 *
 * Tree node shape (one of):
 *   { programRef: 'snowflake-sixfold', anchor?, scale?, children?: [...] }
 *   { inlineProgram: { bar1: {...}, bar2: {...} }, anchor?, scale?, children?: [...] }
 *   { spine, slotPattern, slotLabels, centerSlotId, anchor?, scale?, children?: [...] }
 *   { kind: 'line' | 'polygon' | ..., anchor?, scale?, params? }    // terminal
 *
 * Child binding shape:
 *   { slot: 'arm-0', slotScale?: number, node: <tree node> }
 *
 * Returns array of emitted records:
 *   { id, depth, slotPath, anchor, scale, spineProgram, spineManji, slots, terminal? }
 */
export function walkManjiTree(root, resolveProgramRef = () => null, options = {}) {
  const { rootAnchor = { x: 0, y: 0 }, rootScale = 1 } = options;
  const out = [];

  function visit(node, parentAnchor, parentScale, depth, slotPath, axisSigns) {
    if (!node) return;

    if (node.replicate) {
      if (!node.node) {
        throw new Error('walkManjiTree: replicate node must carry inner `node` spec');
      }
      const groupAnchor = node.anchor
        ? {
            x: parentAnchor.x + parentScale * axisSigns.x * Number(node.anchor.x ?? 0),
            y: parentAnchor.y + parentScale * axisSigns.y * Number(node.anchor.y ?? 0),
          }
        : { ...parentAnchor };
      const groupScale = parentScale * (node.scale ?? 1);
      const offsets = resolveReplicateOffsets2D(node.replicate);
      offsets.forEach((offset, i) => {
        const instanced = instantiateReplicatedNode2D(node.node, offset, i);
        visit(instanced, groupAnchor, groupScale, depth, [...slotPath, `replicate#${i}`], axisSigns);
      });
      return;
    }

    const localSigns = combineReflect(axisSigns, node.reflect);

    const worldAnchor = node.anchor
      ? {
          x: parentAnchor.x + parentScale * axisSigns.x * Number(node.anchor.x ?? 0),
          y: parentAnchor.y + parentScale * axisSigns.y * Number(node.anchor.y ?? 0),
        }
      : { ...parentAnchor };
    const worldScale = parentScale * (node.scale ?? 1);

    if (isTerminal(node)) {
      out.push({
        id: node.id || `terminal-${depth}-${out.length}`,
        depth,
        slotPath,
        anchor: worldAnchor,
        scale: worldScale,
        terminal: node,
      });
      return;
    }

    const preset = resolveNodeToPreset(node, resolveProgramRef);
    let spineManji = preset.spineProgram
      ? evaluateManji(preset.spineProgram, worldAnchor, worldScale)
      : null;
    if (spineManji) {
      spineManji = reflectEvaluatedManji2D(spineManji, worldAnchor, localSigns);
    }
    const slotsWorld = preset.slots.map((slot) => ({
      id: slot.id,
      worldPosition: {
        x: worldAnchor.x + worldScale * localSigns.x * slot.position.x,
        y: worldAnchor.y + worldScale * localSigns.y * slot.position.y,
      },
      localPosition: slot.position,
      radialAngleDeg: slot.radialAngleDeg,
    }));

    out.push({
      id: node.id || `node-${depth}-${out.length}`,
      depth,
      slotPath,
      anchor: worldAnchor,
      scale: worldScale,
      programRef: node.programRef || null,
      role: node.role || null,
      spineProgram: preset.spineProgram,
      spineManji,
      slots: slotsWorld,
    });

    const childBindings = Array.isArray(node.children) ? node.children : [];
    for (const binding of childBindings) {
      const slotId = binding.slot;
      const slot = slotsWorld.find((s) => s.id === slotId);
      if (!slot) {
        throw new Error(
          `walkManjiTree: child binding references unknown slot '${slotId}' (available: ${slotsWorld.map((s) => s.id).join(', ') || '<none>'})`,
        );
      }
      visit(
        binding.node,
        slot.worldPosition,
        worldScale * (binding.slotScale ?? 1),
        depth + 1,
        [...slotPath, slotId],
        localSigns,
      );
    }
  }

  visit(root, rootAnchor, rootScale, 0, [], { x: 1, y: 1, z: 1 });
  return out;
}

function resolveNodeToPreset(node, resolveProgramRef) {
  if (node.programRef) {
    const preset = resolveProgramRef(node.programRef);
    if (!preset) {
      throw new Error(`walkManjiTree: cannot resolve programRef '${node.programRef}'`);
    }
    return resolvePreset(preset);
  }
  if (node.inlineProgram) {
    return { spineProgram: node.inlineProgram, slots: [] };
  }
  if (node.spine || node.slotPattern || node.slotLabels || node.centerSlotId) {
    return resolvePreset(node);
  }
  throw new Error(
    'walkManjiTree: node must carry programRef, inlineProgram, or inline preset fields (spine/slotPattern/...)',
  );
}

/**
 * Run `validateCardinalManji` on every program node in the tree.
 * Returns a flat array of error strings (empty when valid).
 */
export function validateManjiTree(root, resolveProgramRef = () => null) {
  const errors = [];

  function visit(node, slotPath) {
    if (!node || isTerminal(node)) return;
    const here = slotPath.join('/') || '<root>';
    if (node.replicate) {
      if (!node.node) {
        errors.push(`${here}: replicate node missing inner 'node' spec`);
        return;
      }
      try {
        resolveReplicateOffsets2D(node.replicate);
      } catch (err) {
        errors.push(`${here}: ${err.message}`);
      }
      visit(node.node, [...slotPath, 'replicate']);
      return;
    }
    if (node.reflect) {
      const list = Array.isArray(node.reflect) ? node.reflect : [node.reflect];
      for (const axis of list) {
        if (!REFLECTION_SIGN_VECTORS[axis]) {
          errors.push(`${here}: reflect axis '${axis}' is not a known cardinal axis (must be one of: ${REFLECT_AXES.join(', ')})`);
        }
      }
    }
    let preset = null;
    try {
      preset = resolveNodeToPreset(node, resolveProgramRef);
    } catch (err) {
      errors.push(`${here}: ${err.message}`);
      return;
    }
    if (preset.spineProgram) {
      for (const err of validateCardinalManji(preset.spineProgram)) {
        errors.push(`${here}: ${err}`);
      }
    }
    for (const binding of node.children || []) {
      visit(binding.node, [...slotPath, binding.slot]);
    }
  }

  visit(root, []);
  return errors;
}

// ----- 3D walker + perspective projection -----------------------------
//
// 3D manji-trees mirror the 2D shape but author cardinalManji3D programs
// at each node. The 3D walker accumulates world (x, y, z) anchors and
// emits 3D evaluated manjis. `projectManjiTree` then projects every
// 3D point through pure-mandala's existing two-point perspective camera
// (`projectTwoPoint`), producing drawing-space (screenX, screenY,
// depthT) coordinates the renderer can paint back-to-front by depthT.
//
// 3D preset shape (currently inline-only; no 3D anchor-pattern lookup
// equivalent to ANCHOR_PATTERNS for 2D — slots are listed explicitly):
//
//   {
//     spine: { bar1, bar2, bar3 },              // cardinalManji3D spec (any subset)
//     slots: [{ id, position: { x, y, z } }],   // explicit 3D unit positions
//   }

export function resolvePreset3D(preset) {
  if (!preset || typeof preset !== 'object') {
    throw new Error('resolvePreset3D: preset object required');
  }
  const spineProgram = preset.spine ? cardinalManji3D(preset.spine) : null;
  const rawSlots = Array.isArray(preset.slots) ? preset.slots : [];
  const slots = rawSlots.map((slot, i) => ({
    id: slot.id || `slot-${i}`,
    position: {
      x: Number(slot.position?.x ?? 0),
      y: Number(slot.position?.y ?? 0),
      z: Number(slot.position?.z ?? 0),
    },
  }));
  const children = Array.isArray(preset.children) ? preset.children : null;
  // Pass `rotation` and `rotationPivot` through so figure cards can ship a
  // pose at the X-manji-center hub. Calling nodes can override by setting
  // these fields on the invocation; the walker prefers the calling node's
  // value when both are present.
  const rotation = Array.isArray(preset.rotation) ? preset.rotation : null;
  const rotationPivot = preset.rotationPivot && typeof preset.rotationPivot === 'object'
    ? preset.rotationPivot
    : null;
  return { spineProgram, slots, children, rotation, rotationPivot };
}

export function walkManjiTree3D(root, resolveProgramRef = () => null, options = {}) {
  const {
    rootAnchor = { x: 0, y: 0, z: 0 },
    rootScale = 1,
    // Host-declared fields for walk-time structure-scalar resolution.
    // Pass `manifest.fields` here; the walker internally constructs a
    // LAZY resolver over `out` so endpoint paths inside field
    // declarations resolve against whichever ancestor nodes have been
    // emitted by the time the field is evaluated. Card-emitted fields
    // are NOT available here (they accumulate during the walk); the
    // v1 restriction is documented in
    // lite-template/integration/0605/structure-manji-unlocks.plan.md.
    fields: hostFields = null,
  } = options;
  const out = [];
  const fieldResolver = hostFields
    ? buildLazyFieldResolver(hostFields, () => out)
    : nullFieldResolver();

  // parentSelfId carries the id of the nearest enclosing emitted manji
  // node so leaf marks (connection / wave-field) can resolve `self/...`
  // endpoint paths. Initially null — root-depth leaves under a non-manji
  // root will throw at endpoint-resolution time with a clear message.
  function visit(node, parentAnchor, parentScale, depth, slotPath, axisSigns, parentSelfId) {
    if (!node) return;

    if (node.replicate) {
      if (!node.node) {
        throw new Error('walkManjiTree3D: replicate node must carry inner `node` spec');
      }
      const groupAnchor = node.anchor
        ? resolveAnchorComponents(node.anchor, parentAnchor, parentScale, axisSigns, fieldResolver)
        : { ...parentAnchor };
      // node.scale on a replicate-bearing wrapper can be field-borne;
      // evaluate at the group anchor (the wrapper's position).
      const groupScale = parentScale * evaluateScalarOrFieldRef(
        node.scale, fieldResolver, groupAnchor, 1,
      );
      const offsets = resolveReplicateOffsets3D(node.replicate);
      // Per-instance scale modulation. `scaleStep` defaults to 1 (no
      // taper); values < 1 shrink, > 1 amplify. The §5 generalization
      // from waveform-physics-design.md applied to replicate: position
      // is axis 1 (pattern offsets), scaleStep is axis 2 (per-instance).
      // See lite-template/integration/0605/structure-manji-unlocks.plan.md.
      const scaleStep = Number.isFinite(node.scaleStep) ? node.scaleStep : 1;
      offsets.forEach((offset, i) => {
        const instanced = instantiateReplicatedNode3D(node.node, offset, i);
        const instanceScale = groupScale * Math.pow(scaleStep, i);
        // `instantiateReplicatedNode3D` rewrites `id` → `id#index` so each
        // replica becomes its own emitted node — `self` will resolve to
        // the replica's instance id, not the original spec's id.
        visit(instanced, groupAnchor, instanceScale, depth, [...slotPath, `replicate#${i}`], axisSigns, parentSelfId);
      });
      return;
    }

    const localSigns = combineReflect(axisSigns, node.reflect);

    const worldAnchor = node.anchor
      ? resolveAnchorComponents(node.anchor, parentAnchor, parentScale, axisSigns, fieldResolver)
      : { ...parentAnchor };
    // node.scale accepts a number or `{ field: '<id>' }`. Field refs
    // evaluate at the node's worldAnchor — the "natural sample point"
    // for a node-local scalar.
    const localScale = evaluateScalarOrFieldRef(
      node.scale, fieldResolver, worldAnchor, 1,
    );
    const worldScale = parentScale * localScale;

    if (isLeafMark(node)) {
      // Leaf marks are dimensional-wave primitives (connection / wave-field
      // / wave-manji / lathe / limb-chain) authored inline as tree nodes.
      // They carry no spine and no children; the renderer reads
      // `leafMark.spec` to sample and project, using `leafMark.selfId` to
      // resolve `self/...` endpoint paths.
      //
      // Limb-chain is special: its FK walk emits NEW slots on the enclosing
      // manji's emitted record so subsequent leaf marks (lathes, connection
      // tubes, adornments) can reference the chain's joints by name. The
      // mutation happens here at walk time because the joint positions are
      // pure-function output of (origin + fold + segments) and don't need
      // a separate pass. Authoring discipline: place limb-chains BEFORE
      // their consumers in the children array.
      if (node.kind === 'limb-chain') {
        emitLimbChainSlots(node, parentSelfId, out, scaleForChain(worldScale));
      }
      // A named vajra emits its three bead positions as slots on the
      // enclosing manji, so the bonded points become addressable
      // mandala-space landmarks (`self/slot/<id>-proximal|-center|-distal`)
      // that connections, adornments, or another vajra can bind to.
      if (node.kind === 'vajra') {
        emitVajraSlots(node, parentSelfId, out);
      }
      // A named taiji emits its two poles + hub as slots
      // (`self/slot/<id>-yin|-center|-yang`), so the chiral coupling's
      // bound points become addressable — e.g. to wind a taiji onto a
      // vajra's bead slots, or to bind adornments to a pole.
      if (node.kind === 'taiji') {
        emitTaijiSlots(node, parentSelfId, out);
      }
      out.push({
        id: node.id || `leafmark3d-${depth}-${out.length}`,
        depth,
        slotPath,
        anchor: worldAnchor,
        scale: worldScale,
        leafMark: {
          kind: node.kind,
          selfId: parentSelfId,
          spec: node,
        },
      });
      return;
    }

    if (isTerminal(node)) {
      out.push({
        id: node.id || `terminal3d-${depth}-${out.length}`,
        depth,
        slotPath,
        anchor: worldAnchor,
        scale: worldScale,
        terminal: node,
      });
      return;
    }

    // Container preset short-circuit: when a `programRef` resolves to a
    // manjiProgram with no spine and no slots but `children`, the walker
    // treats the calling node as transparent and inlines the card's
    // children at this point. The host's enclosing-manji id stays in
    // scope as `parentSelfId`, so `self/slot/<id>` inside the card
    // resolves to the host's slot — making the card a true callable
    // preset, not a recipe template. See lite-template/integration/0605/
    // wave-and-line-in-tree.plan.md Step 5b.
    //
    // `pathBindings` (optional) — alias map authored on the calling
    // programRef node. Each entry rewrites an endpoint path in the
    // preset's leaf-mark children at inline time. Lets a host whose slot
    // names don't match the card's contract still invoke the card by
    // name, by mapping e.g. `'self/slot/NW' → 'world/slot/water-NW'`.
    // Matching is exact-string; unbound paths fall through unchanged.
    if (node.programRef) {
      const program = resolveProgramRef(node.programRef);
      if (program
          && !program.spine
          && (!Array.isArray(program.slots) || program.slots.length === 0)
          && Array.isArray(program.children)
          && program.children.length > 0) {
        const bindings = node.pathBindings && typeof node.pathBindings === 'object'
          ? node.pathBindings
          : null;
        // Card-declared fields ride alongside `children` and get hoisted
        // into the walker's emit stream as side-channel `cardField`
        // records. Any `self/...` positions in the declarations are
        // substituted using the calling node's enclosing manji id, so
        // the field's geometry is anchored to the host's lattice — not
        // to the card's authoring-time `self`. The renderer + mint
        // validator collect these and merge into the manifest's field
        // map. See lite-template/integration/0605/shelf-cards-declare-fields.plan.md.
        if (program.fields && typeof program.fields === 'object' && !Array.isArray(program.fields)) {
          for (const [fieldId, decl] of Object.entries(program.fields)) {
            out.push({
              depth: depth + 1,
              slotPath: [...slotPath, `inline-fields`],
              cardField: {
                id: fieldId,
                decl: substituteSelfInFieldDecl(decl, parentSelfId, bindings),
                sourceCardId: node.programRef,
              },
            });
          }
        }
        program.children.forEach((presetChild, i) => {
          const rewritten = applyPathBindingsToLeafSpec(presetChild, bindings);
          visit(
            rewritten,
            worldAnchor,
            worldScale,
            depth + 1,
            [...slotPath, `inline-${i}`],
            localSigns,
            parentSelfId,
          );
        });
        return;
      }
    }

    // Resolve field-borne lengthScale on each bar BEFORE the preset is
    // compiled into a spine program. Pre-resolution keeps manji.js
    // arithmetic-only — fields stay a polygonizer-layer concept.
    const nodeWithResolvedSpine = (node.spine && typeof node.spine === 'object')
      ? { ...node, spine: resolveSpineLengthScales(node.spine, fieldResolver, worldAnchor) }
      : node;
    const preset = resolveNode3DToPreset(nodeWithResolvedSpine, resolveProgramRef);
    let spineManji = preset.spineProgram
      ? evaluateManji3D(preset.spineProgram, worldAnchor, worldScale)
      : null;
    if (spineManji) {
      spineManji = reflectEvaluatedManji3D(spineManji, worldAnchor, localSigns);
    }
    // Node-level rotation — the X-manji's center as a rotational hub. A
    // node with `rotation: [{axis, angle}, ...]` and an optional
    // `rotationPivot: {x,y,z}` (defaults to the manji's local origin)
    // rotates its slot positions in local space before world transform.
    // Limb-chains read this rotation via the emitted record so their
    // fold vectors and rotation axes get the SAME rotation applied —
    // chains operate in the parent's local frame, so a leaning torso
    // takes the legs with it.
    const rotationSource = Array.isArray(node.rotation) ? node.rotation : preset.rotation;
    const pivotSource = (node.rotationPivot && typeof node.rotationPivot === 'object')
      ? node.rotationPivot
      : preset.rotationPivot;
    const nodeRotation = composeRotation(rotationSource);
    const nodeRotationPivot = (pivotSource && Number.isFinite(pivotSource.x)
      && Number.isFinite(pivotSource.y) && Number.isFinite(pivotSource.z))
      ? pivotSource
      : { x: 0, y: 0, z: 0 };

    const slotsWorld = preset.slots.map((slot) => {
      const reflected = {
        x: localSigns.x * slot.position.x,
        y: localSigns.y * slot.position.y,
        z: localSigns.z * slot.position.z,
      };
      const rotated = nodeRotation
        ? rotateAroundPivot(nodeRotation, reflected, nodeRotationPivot)
        : reflected;
      return {
        id: slot.id,
        worldPosition: {
          x: worldAnchor.x + worldScale * rotated.x,
          y: worldAnchor.y + worldScale * rotated.y,
          z: worldAnchor.z + worldScale * rotated.z,
        },
        localPosition: slot.position,
      };
    });

    const emittedId = node.id || `node3d-${depth}-${out.length}`;
    out.push({
      id: emittedId,
      depth,
      slotPath,
      anchor: worldAnchor,
      scale: worldScale,
      // Stored for limb-chain leaves to read and apply to their fold +
      // segment-rotation axes (local-frame chain transformation).
      nodeRotation,
      // Carry the input node's `programRef` (if any) onto the emitted
      // record so role-aware renderers can pick render presets per card
      // family without re-resolving the card.
      programRef: node.programRef || null,
      role: node.role || null,
      spineProgram: preset.spineProgram,
      spineManji,
      slots: slotsWorld,
    });

    // Inline the card's own `children` after its slots are emitted, so
    // `self/slot/<id>` paths inside leaf marks resolve against the card
    // (its emitted id is in scope as parentSelfId). Spine-bearing
    // programRef cards use this to ship their own composition — e.g. a
    // figure card shipping its three lathes + limb connection leaves
    // alongside its landmark slot vocabulary.
    //
    // Restricted to `node.programRef`: an inline-spec node's
    // `node.children` is a host-side slot-binding array (visited below),
    // not card-shipped leaf marks. Only programRef-resolved presets
    // surface here as `preset.children`.
    if (node.programRef && Array.isArray(preset.children) && preset.children.length > 0) {
      const presetBindings = node.pathBindings && typeof node.pathBindings === 'object'
        ? node.pathBindings
        : null;
      preset.children.forEach((presetChild, i) => {
        const rewritten = applyPathBindingsToLeafSpec(presetChild, presetBindings);
        visit(
          rewritten,
          worldAnchor,
          worldScale,
          depth + 1,
          [...slotPath, `card-${i}`],
          localSigns,
          emittedId,
        );
      });
    }

    const childBindings = Array.isArray(node.children) ? node.children : [];
    for (const binding of childBindings) {
      const slot = slotsWorld.find((s) => s.id === binding.slot);
      if (!slot) {
        throw new Error(
          `walkManjiTree3D: child binding references unknown slot '${binding.slot}' (available: ${slotsWorld.map((s) => s.id).join(', ') || '<none>'})`,
        );
      }
      // slotScale can be a number or `{ field: '<id>' }`. Evaluate at
      // the slot's world position — the natural sample point for the
      // child placement.
      const resolvedSlotScale = evaluateScalarOrFieldRef(
        binding.slotScale, fieldResolver, slot.worldPosition, 1,
      );
      visit(
        binding.node,
        slot.worldPosition,
        worldScale * resolvedSlotScale,
        depth + 1,
        [...slotPath, binding.slot],
        localSigns,
        emittedId,
      );
    }
  }

  visit(root, rootAnchor, rootScale, 0, [], { x: 1, y: 1, z: 1 }, null);
  return out;
}

function resolveNode3DToPreset(node, resolveProgramRef) {
  if (node.programRef) {
    const preset = resolveProgramRef(node.programRef);
    if (!preset) {
      throw new Error(`walkManjiTree3D: cannot resolve programRef '${node.programRef}'`);
    }
    return resolvePreset3D(preset);
  }
  if (node.inlineProgram) {
    return { spineProgram: node.inlineProgram, slots: [] };
  }
  if (node.spine || node.slots) {
    return resolvePreset3D(node);
  }
  throw new Error(
    'walkManjiTree3D: node must carry programRef, inlineProgram, or inline preset fields (spine/slots)',
  );
}

/**
 * Validate structure-manji scalar field references against the
 * host manifest's `fields` block. Walks the tree, finds every
 * `{ field: '<id>' }` reference on a structure scalar (scale,
 * slotScale, bar.lengthScale, scaleStep), and asserts the id exists
 * in `manifestFields`.
 *
 * v1 restriction: structure scalars can only reference host-declared
 * fields, NOT card-emitted fields. The walker resolves these at walk
 * time (before card-emitted fields exist). See
 * lite-template/integration/0605/structure-manji-unlocks.plan.md.
 *
 * Returns a flat array of error strings (empty when valid).
 */
export function validateStructureManjiFieldRefs(tree, manifestFields) {
  const errors = [];
  const known = new Set(
    manifestFields && typeof manifestFields === 'object' && !Array.isArray(manifestFields)
      ? Object.keys(manifestFields)
      : [],
  );
  function checkRef(value, path) {
    if (value === undefined || value === null) return;
    if (Number.isFinite(value)) return;
    if (value && typeof value === 'object' && typeof value.field === 'string') {
      if (!known.has(value.field)) {
        const available = [...known].join(', ') || '<none>';
        errors.push(
          `${path}: unknown field '${value.field}' (available: ${available}). Structure scalars can only reference manifest-declared fields, not card-emitted ones.`,
        );
        return;
      }
      // Vector field consumers must specify a component.
      const decl = manifestFields[value.field];
      if (decl && isVectorFieldKind(decl.kind)) {
        const c = value.component;
        if (c !== 'x' && c !== 'y' && c !== 'z') {
          errors.push(
            `${path}: field '${value.field}' is a vector field (kind=${decl.kind}); consumer must specify { component: 'x' | 'y' | 'z' }`,
          );
        }
      }
      return;
    }
    errors.push(`${path}: must be a number or { field: '<id>' }; got ${JSON.stringify(value)}`);
  }
  function checkAnchor(anchor, anchorPath) {
    if (!anchor || typeof anchor !== 'object') return;
    for (const axis of ['x', 'y', 'z']) {
      if (anchor[axis] !== undefined && anchor[axis] !== null) {
        checkRef(anchor[axis], `${anchorPath}.${axis}`);
      }
    }
  }
  function visit(node, here) {
    if (!node || isTerminal(node) || isLeafMark(node)) return;
    if (node.replicate) {
      checkAnchor(node.anchor, `${here}.anchor`);
      checkRef(node.scale, `${here}.scale`);
      if (node.scaleStep !== undefined && node.scaleStep !== null && !Number.isFinite(node.scaleStep)) {
        errors.push(`${here}.scaleStep: must be a finite number; got ${JSON.stringify(node.scaleStep)}`);
      }
      visit(node.node, `${here}/replicate`);
      return;
    }
    checkAnchor(node.anchor, `${here}.anchor`);
    checkRef(node.scale, `${here}.scale`);
    if (node.spine && typeof node.spine === 'object') {
      for (const key of ['bar1', 'bar2', 'bar3']) {
        const bar = node.spine[key];
        if (bar && bar.lengthScale !== undefined && bar.lengthScale !== null) {
          checkRef(bar.lengthScale, `${here}.spine.${key}.lengthScale`);
        }
      }
    }
    for (const binding of node.children || []) {
      if (binding.slotScale !== undefined && binding.slotScale !== null) {
        checkRef(binding.slotScale, `${here}/${binding.slot}.slotScale`);
      }
      visit(binding.node, `${here}/${binding.slot}`);
    }
  }
  visit(tree, '<root>');
  return errors;
}

/**
 * Collect card-declared fields from a walker's emitted-node stream and
 * merge with a host manifest's `fields` block. Returns the merged
 * `{ <id>: <decl> }` map plus any collision errors.
 *
 * Precedence: host (`manifestFields`) wins over card-declared. Any
 * duplicate card-emitted field id throws a collision error — including
 * the same card invoked twice. v1 has no per-invocation namespacing;
 * operators who need two field-declaring cards in one scene either use
 * cards with distinct field ids or wait for the follow-up that
 * namespaces by slot path.
 */
export function collectMergedFields(emittedNodes, manifestFields) {
  const errors = [];
  const merged = {};
  const cardOwner = new Map(); // field id → sourceCardId, for collision messages
  for (const node of emittedNodes) {
    if (!node?.cardField) continue;
    const { id, decl, sourceCardId } = node.cardField;
    if (Object.hasOwn(merged, id)) {
      const owner = cardOwner.get(id);
      if (owner === sourceCardId) {
        errors.push(
          `card field id '${id}' emitted twice by '${sourceCardId}' — v1 cards can be invoked at most once per scene; namespacing is a follow-up`,
        );
      } else {
        errors.push(
          `card field id '${id}' declared by both '${owner}' and '${sourceCardId}'`,
        );
      }
    }
    merged[id] = decl;
    cardOwner.set(id, sourceCardId);
  }
  // Host fields win — overlay them last.
  if (manifestFields && typeof manifestFields === 'object' && !Array.isArray(manifestFields)) {
    for (const [id, decl] of Object.entries(manifestFields)) {
      merged[id] = decl;
    }
  }
  return { merged, errors };
}

/**
 * Validate leaf-mark endpoints against a walker's emitted-node table.
 * Each leaf mark carries its own `selfId` (the nearest enclosing manji's
 * emitted id at the leaf's tree position); endpoint paths starting with
 * `self/` resolve against that id. Absolute paths resolve as usual.
 *
 * Returns a flat array of error strings (empty when valid). Intended
 * to run at mint time after `walkManjiTree3D`, so bad endpoint paths
 * surface as 400s rather than 500s at render time. Tree-shape errors
 * (missing kind, malformed corners, etc.) are caught earlier by
 * `validateManjiTree3D`; this pass is purely about resolvability.
 */
export function validateLeafMarkEndpoints(emittedNodes) {
  const errors = [];
  const resolve = buildEndpointResolver(emittedNodes);
  for (const node of emittedNodes) {
    if (!node?.leafMark) continue;
    const { kind, selfId, spec } = node.leafMark;
    const here = node.slotPath?.join('/') || '<root>';
    if (kind === 'connection') {
      for (const end of ['from', 'to']) {
        try {
          resolve(spec[end], selfId);
        } catch (err) {
          errors.push(`${here} (connection).${end}: ${err.message}`);
        }
      }
    } else if (kind === 'wave-field') {
      const corners = Array.isArray(spec.corners) ? spec.corners : [];
      corners.forEach((c, i) => {
        try {
          resolve(c, selfId);
        } catch (err) {
          errors.push(`${here} (wave-field).corners[${i}]: ${err.message}`);
        }
      });
    } else if (kind === 'wave-manji') {
      // Only string singularities need endpoint resolution; {x,y,z}
      // values are world-space points and pass through to the printer.
      if (typeof spec.singularity === 'string') {
        try {
          resolve(spec.singularity, selfId);
        } catch (err) {
          errors.push(`${here} (wave-manji).singularity: ${err.message}`);
        }
      }
    } else if (kind === 'lathe') {
      for (const end of ['axisFrom', 'axisTo']) {
        if (typeof spec[end] === 'string') {
          try {
            resolve(spec[end], selfId);
          } catch (err) {
            errors.push(`${here} (lathe).${end}: ${err.message}`);
          }
        }
      }
    } else if (kind === 'limb-chain') {
      if (typeof spec.origin === 'string') {
        try {
          resolve(spec.origin, selfId);
        } catch (err) {
          errors.push(`${here} (limb-chain).origin: ${err.message}`);
        }
      }
    } else if (kind === 'vajra') {
      for (const end of ['proximal', 'center', 'distal']) {
        if (typeof spec[end] === 'string') {
          try {
            resolve(spec[end], selfId);
          } catch (err) {
            errors.push(`${here} (vajra).${end}: ${err.message}`);
          }
        }
      }
    } else if (kind === 'taiji') {
      for (const end of ['yin', 'yang', 'center']) {
        if (typeof spec[end] === 'string') {
          try {
            resolve(spec[end], selfId);
          } catch (err) {
            errors.push(`${here} (taiji).${end}: ${err.message}`);
          }
        }
      }
    }
  }
  return errors;
}

export function validateManjiTree3D(root, resolveProgramRef = () => null) {
  const errors = [];
  function visit(node, slotPath) {
    if (!node || isTerminal(node)) return;
    const here = slotPath.join('/') || '<root>';
    if (isLeafMark(node)) {
      // Shape-validate leaf marks inline; endpoint resolvability is
      // deferred to mint-time when the emitted node table exists.
      if (node.kind === 'connection') {
        if (typeof node.from !== 'string') errors.push(`${here}: connection.from must be a string endpoint path`);
        if (typeof node.to !== 'string')   errors.push(`${here}: connection.to must be a string endpoint path`);
      } else if (node.kind === 'wave-field') {
        if (!Array.isArray(node.corners) || node.corners.length !== 4) {
          errors.push(`${here}: wave-field.corners must be a 4-element array of endpoint paths`);
        } else {
          node.corners.forEach((c, i) => {
            if (typeof c !== 'string') errors.push(`${here}: wave-field.corners[${i}] must be a string endpoint path`);
          });
        }
        if (node.waves !== undefined && !Array.isArray(node.waves)) {
          errors.push(`${here}: wave-field.waves must be an array when provided`);
        }
      } else if (node.kind === 'wave-manji') {
        if (typeof node.script !== 'string') {
          errors.push(`${here}: wave-manji.script must be a string (one of the printer archetypes)`);
        }
        if (node.singularity === undefined || node.singularity === null) {
          errors.push(`${here}: wave-manji.singularity required (endpoint path string or {x,y,z})`);
        } else if (typeof node.singularity !== 'string') {
          const s = node.singularity;
          if (!s || !Number.isFinite(s.x) || !Number.isFinite(s.y) || !Number.isFinite(s.z)) {
            errors.push(`${here}: wave-manji.singularity must be an endpoint path string or {x,y,z}`);
          }
        }
      } else if (node.kind === 'lathe') {
        for (const end of ['axisFrom', 'axisTo']) {
          const v = node[end];
          if (v === undefined || v === null) {
            errors.push(`${here}: lathe.${end} required (endpoint path string or {x,y,z})`);
          } else if (typeof v !== 'string') {
            if (!v || !Number.isFinite(v.x) || !Number.isFinite(v.y) || !Number.isFinite(v.z)) {
              errors.push(`${here}: lathe.${end} must be an endpoint path string or {x,y,z}`);
            }
          }
        }
        if (!Array.isArray(node.profile) || node.profile.length === 0) {
          errors.push(`${here}: lathe.profile must be a non-empty array of { t, radius } entries`);
        }
      } else if (node.kind === 'limb-chain') {
        for (const e of validateLimbChainSpec(node, here)) errors.push(e);
      } else if (node.kind === 'vajra') {
        for (const end of ['proximal', 'center', 'distal']) {
          const v = node[end];
          if (v === undefined || v === null) {
            errors.push(`${here}: vajra.${end} required (endpoint path string or {x,y,z})`);
          } else if (typeof v !== 'string') {
            if (!v || !Number.isFinite(v.x) || !Number.isFinite(v.y) || !Number.isFinite(v.z)) {
              errors.push(`${here}: vajra.${end} must be an endpoint path string or {x,y,z}`);
            }
          }
        }
        if (node.beads !== undefined && (typeof node.beads !== 'object' || node.beads === null)) {
          errors.push(`${here}: vajra.beads must be an object of { proximal, center, distal } radii when provided`);
        }
        if (node.blend !== undefined && (!Number.isFinite(node.blend) || node.blend < 0)) {
          errors.push(`${here}: vajra.blend must be a non-negative finite number when provided`);
        }
      } else if (node.kind === 'taiji') {
        for (const end of ['yin', 'yang']) {
          const v = node[end];
          if (v === undefined || v === null) {
            errors.push(`${here}: taiji.${end} required (endpoint path string or {x,y,z})`);
          } else if (typeof v !== 'string') {
            if (!v || !Number.isFinite(v.x) || !Number.isFinite(v.y) || !Number.isFinite(v.z)) {
              errors.push(`${here}: taiji.${end} must be an endpoint path string or {x,y,z}`);
            }
          }
        }
        if (node.center !== undefined && node.center !== null
          && typeof node.center !== 'string'
          && !(Number.isFinite(node.center.x) && Number.isFinite(node.center.y) && Number.isFinite(node.center.z))) {
          errors.push(`${here}: taiji.center must be an endpoint path string or {x,y,z} when provided`);
        }
        if (node.twist !== undefined && !Number.isFinite(node.twist)) {
          errors.push(`${here}: taiji.twist must be a finite number when provided (sign = chirality)`);
        }
        if (node.radius !== undefined && (!Number.isFinite(node.radius) || node.radius <= 0)) {
          errors.push(`${here}: taiji.radius must be a positive finite number when provided`);
        }
        if (node.profile !== undefined && node.profile !== 'spindle' && node.profile !== 'capsule') {
          errors.push(`${here}: taiji.profile must be 'spindle' or 'capsule' when provided`);
        }
      }
      return;
    }
    if (node.replicate) {
      if (!node.node) {
        errors.push(`${here}: replicate node missing inner 'node' spec`);
        return;
      }
      try {
        resolveReplicateOffsets3D(node.replicate);
      } catch (err) {
        errors.push(`${here}: ${err.message}`);
      }
      visit(node.node, [...slotPath, 'replicate']);
      return;
    }
    if (node.rotation !== undefined) {
      if (!Array.isArray(node.rotation)) {
        errors.push(`${here}: node.rotation must be an array of { axis, angle } if provided`);
      } else {
        node.rotation.forEach((r, j) => {
          if (!r || typeof r !== 'object') {
            errors.push(`${here}: node.rotation[${j}] must be an object { axis, angle }`);
            return;
          }
          if (!Number.isFinite(r.angle)) {
            errors.push(`${here}: node.rotation[${j}].angle must be a finite number (degrees)`);
          }
          if (r.axis !== undefined && r.axis !== 'binormal') {
            if (typeof r.axis === 'string'
                && r.axis !== 'N-S' && r.axis !== 'E-W' && r.axis !== 'Zenith-Nadir') {
              errors.push(`${here}: node.rotation[${j}].axis unknown label '${r.axis}'`);
            } else if (typeof r.axis !== 'string') {
              const ax = r.axis;
              const m = Array.isArray(ax)
                ? Math.hypot(ax[0] || 0, ax[1] || 0, ax[2] || 0)
                : (ax && typeof ax === 'object' ? Math.hypot(ax.x || 0, ax.y || 0, ax.z || 0) : 0);
              if (m < 1e-9) {
                errors.push(`${here}: node.rotation[${j}].axis must be a cardinal label or non-zero vector`);
              }
            }
          }
        });
      }
    }
    if (node.rotationPivot !== undefined) {
      const p = node.rotationPivot;
      if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z)) {
        errors.push(`${here}: node.rotationPivot must be {x,y,z} with finite numbers`);
      }
    }
    if (node.reflect) {
      const list = Array.isArray(node.reflect) ? node.reflect : [node.reflect];
      for (const axis of list) {
        if (!REFLECTION_SIGN_VECTORS[axis]) {
          errors.push(`${here}: reflect axis '${axis}' is not a known cardinal axis (must be one of: ${REFLECT_AXES.join(', ')})`);
        }
      }
    }
    if (node.pathBindings !== undefined) {
      if (!node.pathBindings || typeof node.pathBindings !== 'object' || Array.isArray(node.pathBindings)) {
        errors.push(`${here}: pathBindings must be an object of '<from-path>': '<to-path>' string pairs`);
      } else {
        for (const [from, to] of Object.entries(node.pathBindings)) {
          if (typeof from !== 'string' || typeof to !== 'string') {
            errors.push(`${here}: pathBindings entries must be string→string pairs (got '${from}': ${JSON.stringify(to)})`);
          }
        }
      }
    }
    let preset = null;
    try {
      preset = resolveNode3DToPreset(node, resolveProgramRef);
    } catch (err) {
      errors.push(`${here}: ${err.message}`);
      return;
    }
    if (preset.spineProgram) {
      for (const err of validateCardinalManji3D(preset.spineProgram)) {
        errors.push(`${here}: ${err}`);
      }
    }
    for (const binding of node.children || []) {
      visit(binding.node, [...slotPath, binding.slot]);
    }
  }
  visit(root, []);
  return errors;
}

/**
 * Project every 3D point in a walker's output through pure-mandala's
 * two-point perspective camera (`projectTwoPoint`). Returns a parallel
 * structure with `projectedSpine` (per-bar projected points + segments)
 * and `projectedSlots` (per-slot screen position + depthT) attached.
 *
 * Each projected point carries `{ x, y, depthT }` where depthT is in
 * roughly [0, 1] (front-to-back). The renderer can sort marks by
 * `depthT` for back-to-front paint order.
 *
 * Camera + room basis default to the same values `projectTwoPoint`
 * itself uses when fields are missing — letting the spike render with
 * zero-config inputs.
 */
export function projectManjiTree(emitted3D, cameraPrimitive = {}, roomBasis = {}) {
  return emitted3D.map((node) => {
    if (node.terminal) {
      return { ...node, projected: projectPoint3D(node.anchor, cameraPrimitive, roomBasis) };
    }
    const projectedSpine = node.spineManji
      ? projectSpine3D(node.spineManji, cameraPrimitive, roomBasis)
      : null;
    const projectedSlots = Array.isArray(node.slots)
      ? node.slots.map((slot) => ({
          ...slot,
          projected: projectPoint3D(slot.worldPosition, cameraPrimitive, roomBasis),
        }))
      : [];
    return { ...node, projectedSpine, projectedSlots };
  });
}

function projectPoint3D(point, cameraPrimitive, roomBasis) {
  const [x, y, depthT] = projectTwoPoint(point, cameraPrimitive, roomBasis);
  return { x, y, depthT };
}

function scaleForChain(worldScale) {
  return Number.isFinite(worldScale) && worldScale > 0 ? worldScale : 1;
}

/**
 * Resolve a limb-chain leaf at walk time, computing joint world positions
 * via forward kinematics and mutating the enclosing manji's emitted slot
 * list so downstream consumers can reference `self/slot/<emit>` paths.
 *
 * Origin must be a `self/slot/<id>` path resolving against the enclosing
 * manji's existing slot list. The chain's segment lengths are scaled by
 * the host's worldScale before walking, so a card authored at unit scale
 * gives correct joint positions when invoked at any scale.
 */
function emitLimbChainSlots(node, parentSelfId, out, worldScale) {
  if (!parentSelfId) {
    throw new Error(
      "walkManjiTree3D: limb-chain has no enclosing manji in scope (origin paths like 'self/slot/<id>' require a parent manji)",
    );
  }
  const parent = out.find((r) => r.id === parentSelfId);
  if (!parent || !Array.isArray(parent.slots)) {
    throw new Error(
      `walkManjiTree3D: limb-chain's enclosing manji '${parentSelfId}' was not emitted with a slot list`,
    );
  }
  const origin = typeof node.origin === 'string' ? node.origin : '';
  const m = /^self\/slot\/(.+)$/.exec(origin);
  if (!m) {
    throw new Error(
      `walkManjiTree3D: limb-chain.origin must be 'self/slot/<id>' (got: ${JSON.stringify(origin)})`,
    );
  }
  const slotId = m[1];
  const origSlot = parent.slots.find((s) => s.id === slotId);
  if (!origSlot || !origSlot.worldPosition) {
    const have = parent.slots.map((s) => s.id).join(', ') || '<none>';
    throw new Error(
      `walkManjiTree3D: limb-chain.origin '${origin}': slot '${slotId}' not found on enclosing manji '${parentSelfId}' (have: ${have})`,
    );
  }
  const scale = scaleForChain(worldScale);
  const scaledSegments = (Array.isArray(node.segments) ? node.segments : []).map((s) => ({
    ...s,
    length: Number.isFinite(s.length) ? s.length * scale : 0,
  }));
  // Local-frame chains: when the enclosing manji has a node rotation,
  // apply it to the chain's fold vector AND each segment's rotation
  // axis. Card authors specify limb angles in the body's "rest frame"
  // (E-W = the figure's lateral axis, Z-N = the figure's vertical) and
  // the substrate rotates those into the parent's pose-frame for the
  // FK walk. Cardinal labels stay legible while the figure rotates as
  // a whole.
  const parentRotation = parent.nodeRotation;
  const specForWalk = parentRotation
    ? rotateChainSpec({ ...node, segments: scaledSegments }, parentRotation)
    : { ...node, segments: scaledSegments };
  const emitted = walkLimbChain(specForWalk, origSlot.worldPosition);
  for (const joint of emitted) {
    parent.slots.push({
      id: joint.id,
      worldPosition: joint.worldPosition,
      // chain-emitted joints have no local position (they're FK-derived);
      // localPosition stays undefined and consumers only read
      // worldPosition, mirroring the existing slot-resolver contract.
      emittedByLimbChain: true,
    });
  }
}

/**
 * Emit a vajra leaf's three bead positions as slots on the enclosing
 * manji's emitted record, so the bonded points become addressable
 * landmarks. Only fires for a NAMED vajra (an authored `id`) with an
 * enclosing manji in scope — anonymous or root-level vajras still render,
 * they just emit no slots. Bead points resolve like every other leaf
 * endpoint: inline `{x,y,z}` pass through, string paths resolve against
 * the nodes emitted so far. Unresolvable string refs are skipped here and
 * reported cleanly by validateLeafMarkEndpoints at mint, so this never
 * crashes the walk.
 */
function emitVajraSlots(node, parentSelfId, out) {
  if (!node.id || !parentSelfId) return;
  const parent = out.find((r) => r.id === parentSelfId);
  if (!parent || !Array.isArray(parent.slots)) return;
  const resolve = buildEndpointResolver(out);
  const resolvePoint = (v) => {
    if (typeof v === 'string') {
      try {
        return resolve(v, parentSelfId);
      } catch {
        return null;
      }
    }
    return (v && Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z)) ? v : null;
  };
  for (const key of ['proximal', 'center', 'distal']) {
    const pos = resolvePoint(node[key]);
    if (!pos) continue;
    parent.slots.push({
      id: `${node.id}-${key}`,
      worldPosition: { x: pos.x, y: pos.y, z: pos.z },
      emittedByVajra: true,
    });
  }
}

/**
 * Emit a taiji leaf's two poles + hub as slots on the enclosing manji, so
 * the chiral coupling's bound points become addressable landmarks
 * (`self/slot/<id>-yin|-center|-yang`). Like emitVajraSlots, only fires for
 * a NAMED taiji with an enclosing manji in scope. The hub defaults to the
 * midpoint of the two poles when `center` is not authored, so the slot
 * contract (`-yin` / `-center` / `-yang`) is always complete for a named
 * taiji. Unresolvable string refs are skipped here and reported by
 * validateLeafMarkEndpoints at mint.
 */
function emitTaijiSlots(node, parentSelfId, out) {
  if (!node.id || !parentSelfId) return;
  const parent = out.find((r) => r.id === parentSelfId);
  if (!parent || !Array.isArray(parent.slots)) return;
  const resolve = buildEndpointResolver(out);
  const resolvePoint = (v) => {
    if (typeof v === 'string') {
      try {
        return resolve(v, parentSelfId);
      } catch {
        return null;
      }
    }
    return (v && Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z)) ? v : null;
  };
  const yin = resolvePoint(node.yin);
  const yang = resolvePoint(node.yang);
  let center = resolvePoint(node.center);
  if (!center && yin && yang) {
    center = { x: (yin.x + yang.x) / 2, y: (yin.y + yang.y) / 2, z: (yin.z + yang.z) / 2 };
  }
  for (const [key, pos] of [['yin', yin], ['center', center], ['yang', yang]]) {
    if (!pos) continue;
    parent.slots.push({
      id: `${node.id}-${key}`,
      worldPosition: { x: pos.x, y: pos.y, z: pos.z },
      emittedByTaiji: true,
    });
  }
}

function rotateChainSpec(spec, rotationFn) {
  const fold = rotationFn(toVec(spec.fold));
  const segments = spec.segments.map((s) => {
    const out = { ...s };
    if (Array.isArray(s.rotations)) {
      out.rotations = s.rotations.map((r) => ({
        ...r,
        axis: rotateAxisIfVectorOrLabel(r.axis, rotationFn),
      }));
    }
    if (s.bendAxis !== undefined && s.bendAxis !== 'binormal') {
      out.bendAxis = rotateAxisIfVectorOrLabel(s.bendAxis, rotationFn);
    }
    if (s.direction !== undefined) {
      out.direction = rotationFn(toVec(s.direction));
    }
    return out;
  });
  return { ...spec, fold, segments };
}

function rotateAxisIfVectorOrLabel(axisSpec, rotationFn) {
  if (axisSpec === undefined || axisSpec === 'binormal') return axisSpec;
  if (typeof axisSpec === 'string') {
    const v = CARDINAL_AXIS_VECTORS_LOCAL[axisSpec];
    if (v) return rotationFn(v);
    return axisSpec;
  }
  return rotationFn(toVec(axisSpec));
}

function toVec(v) {
  if (Array.isArray(v)) return { x: Number(v[0]) || 0, y: Number(v[1]) || 0, z: Number(v[2]) || 0 };
  if (v && typeof v === 'object') return { x: Number(v.x) || 0, y: Number(v.y) || 0, z: Number(v.z) || 0 };
  return { x: 0, y: 0, z: -1 };
}

const CARDINAL_AXIS_VECTORS_LOCAL = Object.freeze({
  'N-S':          { x: 0, y: 1, z: 0 },
  'E-W':          { x: 1, y: 0, z: 0 },
  'Zenith-Nadir': { x: 0, y: 0, z: 1 },
});

function projectSpine3D(manji3D, cameraPrimitive, roomBasis) {
  return {
    bars: manji3D.bars.map((bar) => ({
      axis: bar.axis,
      points: {
        center: projectPoint3D(bar.points.center, cameraPrimitive, roomBasis),
        negEnd: projectPoint3D(bar.points.negEnd, cameraPrimitive, roomBasis),
        posEnd: projectPoint3D(bar.points.posEnd, cameraPrimitive, roomBasis),
        negTip: projectPoint3D(bar.points.negTip, cameraPrimitive, roomBasis),
        posTip: projectPoint3D(bar.points.posTip, cameraPrimitive, roomBasis),
      },
      segments: bar.segments.map((seg) => ({
        from: projectPoint3D(seg.from, cameraPrimitive, roomBasis),
        to: projectPoint3D(seg.to, cameraPrimitive, roomBasis),
      })),
    })),
  };
}
