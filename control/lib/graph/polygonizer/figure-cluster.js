/**
 * figure-cluster — the meru frame for a character: one scale, one identity, gated per role.
 *
 * A character built as a body plus mounted gear is already a CLUSTER of independently authored
 * recipes. The Roman proved they compose; it also proved what is missing when nothing holds the
 * cluster together. Its gear took four placement passes and came out badly oversized, because
 * `attachments[].size` is an ABSOLUTE STAND number and nothing says what STAND is: measured at
 * `headTop`, the default armature stands ~0.93 and a `chibi` ~0.52, so the only way to pick one is
 * to guess and look. That failure happened to ONE author with the whole thing in view. Fan the roles out and it happens once per agent, in
 * different directions, with nothing to reconcile them.
 *
 * The fix is the discipline the object protocol already enforces on heights, applied to scale:
 *
 *   **Declare a role's size as a FRACTION of the figure, never as an absolute.**
 *
 * The substrate multiplies. A spear is 1.19 figures long and a shield is 0.34 figures across, and
 * those numbers are true of a chibi, an adult and a brute alike — so a role authored once ports to
 * every cast, and two agents cannot disagree about what "0.43" means. An absolute can be wrong;
 * a fraction can only be wrong about proportion, which is what the eyes gate is for.
 *
 * What this module holds, and nothing else does:
 *   - THE UNIT. `measureFigure` poses the armature and reports its height, so scale is MEASURED
 *     rather than guessed. This is the meru's `unitScale` in the figure's own frame.
 *   - THE IDENTITY LOCK. <=5 named traits in one sentence, required, restated on every role. The
 *     anti-drift device the object protocol calls the most load-bearing step; a cluster whose roles
 *     are authored independently is exactly where drift gets in.
 *   - THE INTERFACE. Each role declares its mount as data rather than passing a tuned literal, so
 *     the contract between body and gear is inspectable, validated, and gate-able.
 *   - THE LEDGER. Every role's own gates (closure, contribution, connectivity) on its OWN bounds,
 *     collected into one readout — the only scale at which a slender member is resolvable at all.
 *
 * Deliberately NOT here: deciding WHAT the roles are. Allocation is the other half, and it has no
 * worked example yet. This half assumes the decomposition and makes executing it safe.
 *
 * Pure and deterministic: fixed iteration order, no dice.
 */

import { articulate } from './figure-vajra.js';
import { castArmature } from './figure-cast.js';
import { HEAD_H } from './figure-head.js';
import { validateAttachments } from './figure-attach.js';

// The figure's own unit: ground to the crown landmark of the POSED armature. Not the render
// bounding box — that moves with gear, hair and garments, and a unit that depends on what is
// mounted on it cannot be the thing the mounts are measured against.
export const FIGURE_UNIT_NODE = 'headTop';

/**
 * A role is measured against the thing it BELONGS to, not always the whole figure.
 *
 * The portability run found this: with one figure-relative unit, the spear and shield ported from
 * chibi to adult perfectly and the helmet arrived oversized — because a chibi's head is a much
 * larger share of its body than an adult's, and a helmet is a fraction of the HEAD. A single unit
 * quietly re-proportions headgear on every cast change.
 *
 *   'figure'  ground to the crown landmark — for gear that relates to the whole body
 *             (a spear's length, a cloak's drop, a shield worn across the torso).
 *   'head'    the skull's own height, `headScale` included — for anything worn ON the head,
 *             which then reads naturally as "1.1 heads across".
 */
export const SPAN_UNITS = Object.freeze(['figure', 'head']);

/**
 * Measure the posed armature a cluster is built on.
 * @returns {{ height:number, cast:?string, nodes:object, node:string }}
 */
export function measureFigure(body = {}) {
  const base = body.cast ? castArmature(body.cast) : null;
  const nodes = articulate(body.pose || {}, base);
  const top = nodes[FIGURE_UNIT_NODE];
  const height = top && Number.isFinite(top.z) ? top.z : 0;
  // The skull's own height at this figure's head scale — the sculpted head, not the armature bone
  // between headBase and headTop, so "1.1 heads" means what it sounds like.
  const headScale = Number.isFinite(body.proto?.headScale) ? body.proto.headScale : 1;
  const head = HEAD_H * headScale;
  return { height, head, cast: body.cast || null, nodes, node: FIGURE_UNIT_NODE };
}

const MOUNT_PASSTHROUGH = ['at', 't', 'fit', 'anchor', 'rotate', 'align'];
const MOUNT_LOCAL = ['spanOf'];   // resolved here, never passed through to the attachment
// A role bigger than this many figure-heights is almost certainly a misplaced decimal — the
// mistake `span` exists to prevent, caught rather than merely made impossible to express.
const SPAN_SANITY = 4;

/**
 * Resolve a cluster spec into a figure manifest plus a ledger.
 *
 * spec: {
 *   identity,                       REQUIRED — <=5 traits, one sentence. The anti-drift device.
 *   body: { cast, proto, garment, hair, pose },
 *   roles: [{ id, recipe, mount: { at, span, offset?, fit?, anchor?, t?, rotate?, align? } }],
 * }
 *
 * `mount.span` is the role's extent as a FRACTION of figure height; `mount.offset` is likewise
 * fractional, so a whole cluster ports to another cast unchanged.
 *
 * @param {object} spec
 * @param {?function} planner  optional `planWorkbench` — pass it to gate each role. Omitted, the
 *                             manifest still resolves and the ledger simply carries no gate rows,
 *                             which keeps this module free of the world/scene import chain.
 */
export function resolveCluster(spec = {}, planner = null) {
  const errors = validateCluster(spec);
  if (errors.length) throw new Error(errors.join('; '));

  const body = spec.body || {};
  const unit = measureFigure(body);
  const warnings = [];
  if (!(unit.height > 0)) warnings.push(`The posed armature measured zero height at \`${FIGURE_UNIT_NODE}\` — every role's span resolves to zero. Check the cast and pose.`);

  const roles = [];
  const attachments = (spec.roles || []).map((role) => {
    const m = role.mount || {};
    const spanOf = m.spanOf === 'head' ? 'head' : 'figure';
    const base = spanOf === 'head' ? unit.head : unit.height;
    const size = m.span * base;
    // Offsets stay FIGURE-relative whatever the span is measured in: an offset is a position on the
    // body, and positions belong to the body's frame even when a size belongs to a part's.
    const offset = Array.isArray(m.offset) ? m.offset.map((v) => v * unit.height) : undefined;
    const row = { id: role.id, span: m.span, spanOf, size: Math.round(size * 10000) / 10000, at: m.at };

    if (planner) {
      try {
        const { stats } = planner(role.recipe);
        row.monomers = stats.monomers;
        row.faces = stats.faces;
        row.closed = stats.ledger.closed;
        row.bodies = stats.components?.bodies ?? null;
        row.stable = stats.components?.stable ?? null;
        // The float/sink lint reads a recipe as if it sat on the studio floor. A role is authored at
        // its own origin and SEATED by its mount, so that warning is always false here — the same
        // filtering the object lowering does per segment.
        const own = (stats.warnings || []).filter((w) => !/sinks|floats/.test(w));
        if (own.length) row.warnings = own;
        for (const w of own) warnings.push(`role '${role.id}': ${w}`);
        if (!stats.ledger.closed) warnings.push(`role '${role.id}' is not a closed shell — it will print with a hole.`);
      } catch (err) {
        row.error = err && err.message ? err.message : String(err);
        warnings.push(`role '${role.id}' failed to plan: ${row.error}`);
      }
    }
    roles.push(row);

    const mount = { id: role.id, recipe: role.recipe, size };
    for (const k of MOUNT_PASSTHROUGH) if (m[k] !== undefined) mount[k] = m[k];
    if (offset) mount.offset = offset;
    return mount;
  });

  const manifest = {
    kind: 'figure',
    ...(body.cast ? { cast: body.cast } : {}),
    ...(body.proto ? { proto: body.proto } : {}),
    ...(body.garment ? { garment: body.garment } : {}),
    ...(body.hair ? { hair: body.hair } : {}),
    ...(body.pose ? { pose: body.pose } : {}),
    attachments,
    // The identity lock rides the recipe so a later pass — or a different agent — restates the same
    // one instead of inventing a neighbouring character.
    identity: spec.identity,
  };

  return {
    manifest,
    ledger: {
      identity: spec.identity,
      unit: { height: Math.round(unit.height * 10000) / 10000, head: Math.round(unit.head * 10000) / 10000, node: unit.node, cast: unit.cast },
      roles,
      ...(warnings.length ? { warnings } : {}),
    },
  };
}

/** Mint-time validation. The span rule is the point, so it is enforced, not documented. */
export function validateCluster(spec = {}) {
  const errors = [];
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) return ['a cluster must be an object'];
  if (typeof spec.identity !== 'string' || !spec.identity.trim()) {
    errors.push('identity: required — <=5 named traits in ONE sentence (colour / material / silhouette / mass / signature detail). This is the anti-drift device; a cluster whose roles are authored independently is exactly where drift gets in.');
  }
  if (spec.body !== undefined && (!spec.body || typeof spec.body !== 'object' || Array.isArray(spec.body))) errors.push('body: must be an object { cast?, proto?, garment?, hair?, pose? }');
  const roles = spec.roles;
  if (!Array.isArray(roles) || !roles.length) { errors.push('roles: must be a non-empty array'); return errors; }

  const seen = new Set();
  roles.forEach((role, i) => {
    const at = `roles[${i}]`;
    if (!role || typeof role !== 'object' || Array.isArray(role)) { errors.push(`${at}: must be an object`); return; }
    if (typeof role.id !== 'string' || !role.id) errors.push(`${at}.id: required — roles are addressed by id`);
    else if (seen.has(role.id)) errors.push(`${at}.id: duplicate role id '${role.id}'`);
    else seen.add(role.id);
    if (!role.recipe || typeof role.recipe !== 'object') errors.push(`${at}.recipe: required — a workbench manifest`);
    const m = role.mount;
    if (!m || typeof m !== 'object' || Array.isArray(m)) { errors.push(`${at}.mount: required — { at, span, offset?, … }`); return; }
    if (m.size !== undefined) {
      errors.push(`${at}.mount.size: not allowed — declare \`span\` as a FRACTION of figure height instead. An absolute size is wrong the moment the cast changes (measured at headTop: the default armature ~0.93, a chibi ~0.52), and two agents cannot agree on one.`);
    }
    if (!(Number.isFinite(m.span) && m.span > 0)) errors.push(`${at}.mount.span: required — the role's extent as a positive fraction of figure height (a spear is ~1.19, a shield ~0.34, a helmet ~0.43)`);
    else if (m.span > SPAN_SANITY) errors.push(`${at}.mount.span: ${m.span} is more than ${SPAN_SANITY} figure-heights — check for a misplaced decimal, or say so in the identity if it is deliberate`);
    if (m.spanOf !== undefined && !SPAN_UNITS.includes(m.spanOf)) errors.push(`${at}.mount.spanOf: must be one of ${SPAN_UNITS.join(' | ')} — 'head' for anything worn on the head, which a cast re-proportions independently of body height`);
    if (m.offset !== undefined && !(Array.isArray(m.offset) && m.offset.length === 3 && m.offset.every(Number.isFinite))) {
      errors.push(`${at}.mount.offset: must be [x, y, z] FRACTIONS of figure height`);
    }
  });

  // The mount half is the attachment contract, so let it speak for itself rather than restating it.
  const asAttachments = roles
    .filter((r) => r && r.mount && typeof r.mount === 'object')
    .map((r) => ({ id: r.id, recipe: r.recipe, ...r.mount, span: undefined, size: 1 }));
  for (const e of validateAttachments(asAttachments, null)) {
    if (!/\.size:/.test(e)) errors.push(e.replace(/^attachments\[/, 'roles['));
  }
  return errors;
}
