/**
 * scene-gltf-level — level-as-layout semantics for the GLB export
 * (interchange.plan.md I4).
 *
 * facesToGlb historically exported geometry only; this module derives the
 * SCENE from the same resolved payload — glTF perspective cameras from the
 * payload's camera list (Blender/Godot open with mojulo's framing), one named
 * node per entity placement, and small JSON-plain `extras` under the `moj:`
 * namespace (spawn point, analytic AABB colliders, the game-contract summary,
 * per-entity id/rule/body). Default-on: a GLB is a derived snapshot regenerated
 * on demand, not a pinned surface — the enrichment is a documented output
 * change of the export, never of any emitted world PAGE.
 *
 * Everything here is PURE data derivation (payload → plain objects);
 * scene-gltf.js owns the byte plumbing. All values live in the pre-root z-up
 * frame — the writer's y-up root rotation converts cameras and entity nodes
 * exactly like geometry.
 */

// The runtime's default figure-facing convention: a body faces local +y, so the
// mesh yaw is heading + (body.yawOffset ?? -π/2) — mirrored from
// channels/controllable/index.js so a placed rig faces its heading on import.
const DEFAULT_YAW_OFFSET = -Math.PI / 2;

const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross3 = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
function norm3(v) {
  const l = Math.hypot(v[0], v[1], v[2]);
  return l > 0 ? [v[0] / l, v[1] / l, v[2] / l] : null;
}

/** Quaternion [x,y,z,w] for a rotation about +Z — the instanced-repeats convention. */
export const zRotationQuat = (rz) => [0, 0, Math.sin(rz / 2), Math.cos(rz / 2)];

// Column-basis rotation matrix → quaternion [x,y,z,w] (standard Shepperd branches).
function basisQuat(x, y, z) {
  const m00 = x[0], m10 = x[1], m20 = x[2];
  const m01 = y[0], m11 = y[1], m21 = y[2];
  const m02 = z[0], m12 = z[1], m22 = z[2];
  const tr = m00 + m11 + m22;
  if (tr > 0) {
    const s = Math.sqrt(tr + 1) * 2;
    return [(m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s, s / 4];
  }
  if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    return [s / 4, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s];
  }
  if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    return [(m01 + m10) / s, s / 4, (m12 + m21) / s, (m02 - m20) / s];
  }
  const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
  return [(m02 + m20) / s, (m12 + m21) / s, s / 4, (m10 - m01) / s];
}

/**
 * lookAtRotation(pos, target) → quaternion [x,y,z,w] posing a glTF camera node
 * in the z-up frame: the camera looks down its local -Z with +Y up (glTF §5.10),
 * so the node basis is z = -(target-pos)/|·|, x = up×z, y = z×x with the world
 * up +Z (fallback +Y when looking straight up/down).
 */
export function lookAtRotation(pos, target) {
  const f = norm3(sub3(target, pos));
  if (!f) return [0, 0, 0, 1];
  const z = [-f[0], -f[1], -f[2]];
  let up = [0, 0, 1];
  if (Math.abs(dot3(up, z)) > 0.999) up = [0, 1, 0];
  const x = norm3(cross3(up, z));
  if (!x) return [0, 0, 0, 1];
  const y = cross3(z, x);
  return basisQuat(x, y, z);
}

/**
 * levelCameras(payload) → [{ name, translation, rotation, yfov, aspectRatio,
 * znear, zfar }] — one glTF perspective camera per payload camera carrying a
 * two-point worldFraming ({ cameraPosition, lookAt, horizontalFov }). yfov is
 * the same horizontal→vertical solve the live /world page runs (scene-three's
 * verticalFov) at the payload viewBox aspect, in radians as glTF wants; near/far
 * match the world camera's 0.1 → 8000 span.
 */
export function levelCameras(payload = {}) {
  const cams = Array.isArray(payload.cameras) ? payload.cameras : [];
  const vb = payload.viewBox && Number.isFinite(payload.viewBox.width) && Number.isFinite(payload.viewBox.height)
    ? payload.viewBox
    : { width: 1120, height: 780 };
  const aspect = vb.width / vb.height;
  const out = [];
  cams.forEach((cam, i) => {
    const wf = cam && cam.worldFraming;
    const pos = wf && Array.isArray(wf.cameraPosition) ? wf.cameraPosition : null;
    const target = wf && Array.isArray(wf.lookAt) ? wf.lookAt : null;
    if (!pos || pos.length < 3 || !target || target.length < 3) return;
    const h = ((Number.isFinite(wf.horizontalFov) ? wf.horizontalFov : 60) * Math.PI) / 180;
    out.push({
      name: typeof cam.name === 'string' && cam.name ? cam.name : `view ${i}`,
      translation: [pos[0], pos[1], pos[2]],
      rotation: lookAtRotation(pos, target),
      yfov: 2 * Math.atan(Math.tan(h / 2) / aspect),
      aspectRatio: aspect,
      znear: 0.1,
      zfar: 8000,
    });
  });
  return out;
}

/**
 * levelEntityNodes(payload) → [{ id, name, figure, translation, heading,
 * yawOffset, extras }] — one identifiable placement per payload entity. `figure`
 * is the figures-map key the body references (the writer reuses that rig's I1
 * wrapper node when it exported one; otherwise the entity becomes an empty TRS
 * node). Extras are small `moj:`-namespaced strings: the entity id, its rule
 * type, and the body source — the manifest-level ref when world-scene recorded
 * one (payload.figureSources: unitRef/figureRef/vehicleRef/polygomerRef), else
 * the body's own shape (figure key / glyph form / type).
 */
export function levelEntityNodes(payload = {}) {
  const list = Array.isArray(payload.entities) ? payload.entities : [];
  const sources = payload.figureSources && typeof payload.figureSources === 'object' ? payload.figureSources : {};
  const out = [];
  list.forEach((e, i) => {
    if (!e || typeof e !== 'object') return;
    const t = e.transform && typeof e.transform === 'object' ? e.transform : {};
    const pos = Array.isArray(t.pos) && t.pos.length >= 3 ? [t.pos[0], t.pos[1], t.pos[2]] : [0, 0, 0];
    const heading = Number.isFinite(t.heading) ? t.heading : 0;
    const body = e.body && typeof e.body === 'object' ? e.body : {};
    const figKey = typeof body.figure === 'string' ? body.figure : null;
    const id = String(e.id ?? i);
    const extras = { 'moj:entity': id };
    if (e.rule && typeof e.rule.type === 'string') extras['moj:rule'] = e.rule.type;
    const bodyDesc = figKey && typeof sources[figKey] === 'string' ? sources[figKey]
      : body.type === 'glyph' ? `glyph:${typeof body.form === 'string' ? body.form : ''}`
        : figKey ? `figure:${figKey}`
          : typeof body.type === 'string' ? body.type : null;
    if (bodyDesc) extras['moj:body'] = bodyDesc;
    out.push({
      id,
      name: `entity:${id}`,
      figure: figKey,
      translation: pos,
      heading,
      yawOffset: Number.isFinite(body.yawOffset) ? body.yawOffset : DEFAULT_YAW_OFFSET,
      extras,
    });
  });
  return out;
}

// The level's spawn point: an explicit walk spawn wins; else the piloted entity
// (payload.pilot when it names one, else the first `pilotable` entity, else the
// first placed entity) — mirroring the controllable engine's seat order.
function spawnPoint(payload) {
  const wk = payload.walk;
  if (wk && typeof wk === 'object' && Array.isArray(wk.spawn)
    && wk.spawn.length >= 2 && wk.spawn.every(Number.isFinite)) {
    return wk.spawn.length >= 3
      ? [wk.spawn[0], wk.spawn[1], wk.spawn[2]]
      : [wk.spawn[0], wk.spawn[1], Number.isFinite(wk.eye) ? wk.eye : 0];
  }
  const ents = (Array.isArray(payload.entities) ? payload.entities : [])
    .filter((e) => e && e.transform && Array.isArray(e.transform.pos) && e.transform.pos.length >= 3);
  if (!ents.length) return null;
  const named = typeof payload.pilot === 'string' ? ents.find((e) => e.id === payload.pilot) : null;
  const seat = named || ents.find((e) => e.pilotable) || ents[0];
  return [seat.transform.pos[0], seat.transform.pos[1], seat.transform.pos[2]];
}

/**
 * levelSceneExtras(payload) → extras object | null — the scene-level `moj:`
 * summary: spawn point, the analytic AABB collider list ({min,max} boxes, the
 * invisible collision hull under the visual faces), and a short game-contract
 * digest when the world carries a `game` channel (levelRef, allowed results,
 * `type→slice` event signatures, consumed slices). Values stay small and
 * JSON-plain — a summary for external tools, never the contract itself.
 */
export function levelSceneExtras(payload = {}) {
  const extras = {};
  const spawn = spawnPoint(payload);
  if (spawn) extras['moj:spawn'] = spawn;
  if (Array.isArray(payload.colliders) && payload.colliders.length) {
    const boxes = payload.colliders
      .filter((c) => c && Array.isArray(c.min) && c.min.length >= 3 && Array.isArray(c.max) && c.max.length >= 3)
      .map((c) => ({ min: [c.min[0], c.min[1], c.min[2]], max: [c.max[0], c.max[1], c.max[2]] }));
    if (boxes.length) extras['moj:colliders'] = boxes;
  }
  const g = payload.game;
  if (g && typeof g === 'object') {
    const sum = {};
    if (typeof g.levelRef === 'string') sum.levelRef = g.levelRef;
    if (Array.isArray(g.produces?.results)) sum.results = g.produces.results.filter((r) => typeof r === 'string');
    if (Array.isArray(g.produces?.events)) {
      sum.events = g.produces.events
        .filter((e) => e && typeof e === 'object')
        .map((e) => `${e.type}→${e.slice}`);
    }
    if (Array.isArray(g.consumes) && g.consumes.length) {
      sum.consumes = g.consumes
        .filter((c) => c && typeof c.slice === 'string')
        .map((c) => (c.pick && Number.isInteger(c.pick.max) ? `${c.slice}(pick ${c.pick.max})` : c.slice));
    }
    extras['moj:game'] = sum;
  }
  return Object.keys(extras).length ? extras : null;
}
