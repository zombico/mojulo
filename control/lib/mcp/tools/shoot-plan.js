/**
 * The shoot-plan tools: `create_shoot_plan` and `update_shoot_plan`. A shoot plan is a world's cameras keyed in After
 * Effects terms plus a cut list (lib/graph/shoot/), stored on the world recipe as `manifest.shoot` and drawn by its
 * World page: each camera as an object with its frustum, point of interest and motion path, LOOK THROUGH, the shots.
 *
 * Both tools read the world first (its moving subjects, its faces, its metres per unit), write through
 * `update_sketch`'s patch path so the world pays its own gate and keeps its revision, and answer with the readout:
 * timings, path lengths and speeds in metres, what each camera follows, the frames where a camera jumps, and the
 * places a move passes through the world (clearance). Gates advise; nothing here refuses a plan it can read.
 */
import { registerTool } from '@/lib/mcp/server';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { updateSketchHandler } from '@/lib/mcp/tools/sketch-mint';

const SUBJECT_LIST_MAX = 80;

async function readWorld(ref) {
  if (!ref || typeof ref !== 'string') throw new Error('`ref` is the world sketch (`sk_…`) the plan shoots');
  const sketch = SketchRepository.getByRef(ref);
  if (!sketch) throw new Error(`No sketch exists at ref '${ref}'`);
  const { resolveWorldScene } = await import('@/lib/graph/worlds/world-scene');
  const { payload } = (await resolveWorldScene(sketch)) || {};
  if (!payload || !Array.isArray(payload.faces)) {
    throw new Error(`'${ref}' (${sketch.manifest?.kind || 'no kind'}) is not a 3D world, so it has nowhere to put a camera — compose_world or mint_solid makes one`);
  }
  const { shootSubjects } = await import('@/lib/graph/shoot/subjects');
  return { sketch, payload, subjects: shootSubjects(payload) };
}

function subjectsSays(subjects, at) {
  const kinds = {};
  for (const s of subjects.values()) kinds[s.kind] = (kinds[s.kind] || 0) + 1;
  if (!Number.isFinite(at)) return Object.keys(kinds).length ? { counts: kinds, hint: 'pass subjects_at: <seconds> to list where each one is' } : { counts: {} };
  const r2 = (v) => Math.round(v * 100) / 100;
  const list = [...subjects.values()].slice(0, SUBJECT_LIST_MAX).map((s) => {
    const { pos, heading } = s.at(at);
    return { id: s.id, at: pos.map(r2), heading_deg: Math.round(heading * 180 / Math.PI) };
  });
  return { counts: kinds, at_s: at, list };
}

async function commit({ ref, raw, world, note, notes = [] }) {
  const { normalizeShoot, shootReadout, liveNotes } = await import('@/lib/graph/shoot/plan');
  const { worldIsLive } = await import('@/lib/graph/shoot/subjects');
  const { shootClearance, shootTraffic } = await import('@/lib/graph/shoot/clearance');
  const { plan, warnings } = normalizeShoot(raw, { subjects: world.subjects });
  if (!plan) throw new Error(`Nothing in the plan is a camera with a keyed position: ${warnings.join('; ')} — manual: get_motion_vocab({ id: 'shoot' })`);
  await updateSketchHandler({ ref, patch: [{ op: 'set', path: '/shoot', value: plan }], ...(note ? { note } : {}) });
  const clearance = shootClearance(plan, world.payload.faces, { subjects: world.subjects });
  const traffic = shootTraffic(plan, world.subjects);
  return {
    ok: true,
    ref,
    world_url: `/api/sketches/${encodeURIComponent(ref)}/world`,
    readout: shootReadout(plan, { subjects: world.subjects, metersPerUnit: world.payload.metersPerUnit ?? 1 }),
    ...(clearance.length || traffic.length ? { clearance: {
      ...(clearance.length ? { passes_through: clearance } : {}),
      ...(traffic.length ? { runs_into: traffic } : {}),
      note: 'advisory: passes_through = a move crosses the world\'s faces; runs_into = an eye inside a moving car or walker while its shot plays',
    } } : {}),
    ...(notes.length ? { did: notes } : {}),
    ...(warnings.length ? { warnings } : {}),
    ...(worldIsLive(world.payload) ? { live: { note: 'this world plays live (entities / physics): the plan runs on its clock and cannot rewind', notes: liveNotes(plan, world.subjects) } } : {}),
    plan,
  };
}

export async function createShootPlanHandler(input = {}) {
  const { ref, plan, note, subjects_at: subjectsAt } = input;
  const world = await readWorld(ref);
  if (plan === undefined) return { ok: true, ref, subjects: subjectsSays(world.subjects, subjectsAt ?? 0), note: 'no plan given: these are the things a key can follow' };
  if (!plan || typeof plan !== 'object') throw new Error('`plan` is { fps?, cameras: [{ id?, type?, lens?, keys: [{ t, pos, poi?, ease? }] }], shots? }');
  const had = world.sketch.manifest?.shoot ? 'replaced the plan that was there' : null;
  const out = await commit({ ref, raw: plan, world, note, notes: had ? [had] : [] });
  return { ...out, subjects: subjectsSays(world.subjects, subjectsAt) };
}

export async function updateShootPlanHandler(input = {}) {
  const { ref, ops, note, subjects_at: subjectsAt } = input;
  const world = await readWorld(ref);
  const stored = world.sketch.manifest?.shoot;
  if (!stored) throw new Error(`'${ref}' has no shoot plan yet — create_shoot_plan makes one`);
  if (!Array.isArray(ops) || !ops.length) {
    if (Number.isFinite(subjectsAt)) return { ok: true, ref, subjects: subjectsSays(world.subjects, subjectsAt) };
    throw new Error('`ops` is a non-empty list of edits (add_key, set_key, ease, retime, add_shot, set_camera, …)');
  }
  const { normalizeShoot } = await import('@/lib/graph/shoot/plan');
  const { applyShootOp } = await import('@/lib/graph/shoot/ops');
  let plan = normalizeShoot(stored, { subjects: world.subjects }).plan;
  if (!plan) throw new Error(`the stored plan on '${ref}' no longer reads; create_shoot_plan replaces it`);
  const notes = [];
  ops.forEach((op, i) => {
    let res;
    try { res = applyShootOp(plan, op); } catch (err) { throw new Error(`op ${i} (${op && op.op}): ${err.message}`); }
    notes.push(res.note);
    plan = normalizeShoot(res.plan, { subjects: world.subjects }).plan;
    if (!plan) throw new Error(`op ${i} (${op.op}) left no camera with a keyed position`);
  });
  const out = await commit({ ref, raw: plan, world, note, notes });
  return { ...out, ...(Number.isFinite(subjectsAt) ? { subjects: subjectsSays(world.subjects, subjectsAt) } : {}) };
}

const POINT = "[x,y,z] (world units) or { follow: 'car:2', offset?, frame?: 'subject' }";

export function registerShootPlanTools() {
  registerTool({
    name: 'create_shoot_plan',
    description:
      "Put cameras in a 3D world as visible objects with a SHOOT PLAN, in After Effects words: two-node (position + point of interest) or one-node cameras, a lens in mm ('35mm'), keys with Easy Ease / ease in / ease out / hold, and a cut list of shots. The World page draws each camera's frustum and motion path (a dot per frame) and can LOOK THROUGH it. A key may follow a moving car, walker or mover. Returns the readout (timings, metres, speeds, jumps) and where a move passes through geometry. Omit `plan` to list what can be followed. Manual: get_motion_vocab({ id: 'shoot' }). Edit with update_shoot_plan; render with forge_motion.",
    inputSchema: {
      type: 'object',
      properties: {
        ref: { type: 'string', description: 'The world sketch (`sk_…`) to shoot.' },
        plan: {
          type: 'object',
          additionalProperties: true,
          description: `{ fps?, cameras: [{ id?, type?: 'two-node'|'one-node', lens?: '35mm', keys: [{ t (s), pos, poi?, yaw?/pitch?, roll?, lens?, ease?: 'linear'|'easy ease'|'easy ease in'|'easy ease out'|'hold' }] }], shots?: [{ name, camera, span: [t0, t1], in?: transition }], pieces?: [{ kind, attach, keys }] } (manual: get_motion_vocab shoot). pos/poi: ${POINT}. Replaces the world's plan.`,
        },
        subjects_at: { type: 'number', description: 'List the followable subjects where they are at this time (s).' },
        note: { type: 'string', description: 'Revision note.' },
      },
      required: ['ref'],
    },
    handler: createShootPlanHandler,
  });

  registerTool({
    name: 'update_shoot_plan',
    description:
      "Edit a world's shoot plan in place, op by op, in camera-operator and After Effects terms: add_key / set_key (by time; `to` moves it) / remove_key, ease (one key, some, all: AE's F9), retime, set_camera (lens, path, one-node ↔ two-node keeping the view), add_camera / remove_camera, add_shot / set_shot (`in`: fade, wipe, iris, pipe, portal) / remove_shot / move_shot, add_piece / set_piece / piece_key / remove_piece (walls, floors, ceilings, pipes, frames riding a camera or in the world), set { fps }. Same readout and clearance as create_shoot_plan. Manual: get_motion_vocab({ id: 'shoot' }).",
    inputSchema: {
      type: 'object',
      properties: {
        ref: { type: 'string', description: 'The world sketch carrying the plan.' },
        ops: {
          type: 'array',
          minItems: 1,
          items: { type: 'object', additionalProperties: true, properties: { op: { type: 'string', enum: ['add_camera', 'remove_camera', 'set_camera', 'add_key', 'set_key', 'remove_key', 'ease', 'retime', 'add_shot', 'set_shot', 'remove_shot', 'move_shot', 'add_piece', 'set_piece', 'piece_key', 'remove_piece', 'set'] } }, required: ['op'] },
          description: `In order; cameras by id, keys by \`t\` (s), shots by name or index. E.g. { op:'set_key', camera:'a', t:2, lens:'85mm', ease:'easy ease in' }. pos/poi: ${POINT}.`,
        },
        subjects_at: { type: 'number', description: 'List the followable subjects where they are at this time (s).' },
        note: { type: 'string', description: 'Revision note.' },
      },
      required: ['ref'],
    },
    handler: updateShootPlanHandler,
  });
}
