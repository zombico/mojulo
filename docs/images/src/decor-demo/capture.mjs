// Record decor-demo's rooms from a session record: replay the calls that wrote (design_interior, update_sketch) in
// order into a fresh data dir, and around each ask film the room it settled on with forge_motion, before and after.
//
//   node docs/images/src/decor-demo/capture.mjs <workDir> [session.json]     # default: <workDir>/session.json
//
// The recipes are the session's; the kernels draw them on every read, so a replay re-renders the same session after a
// kernel change without asking the agent again. It stops if a replayed recipe differs from the one the session
// stored. The camera walks across the room at eye height looking at the wall the ask changed (a `surface` edge), else
// at the room's focal wall, and films the before from the same place.
import { execFile } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, rmSync, copyFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONTROL, runJson } from '../lib/browser.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const Database = createRequire(path.join(CONTROL, 'package.json'))('better-sqlite3');
const WRITES = new Set(['design_interior', 'update_sketch']);
const EDGES = ['N', 'E', 'S', 'W'];
// the walk: a 1080 × 1000 render, 36 frames, standing eye height and a look a little below it, set in from the walls
// (World page units: feet, y negated)
const W = 1080, H = 1000, FRAMES = 36, EYE = 6.4, LOOK = 3.4, INSET = 2.7, FOV = 62;

/** The recipes a data dir holds for these refs → { ref: manifest }. */
export function recipesOf(dataDir, refs) {
  const db = new Database(path.join(dataDir, 'mojulo-lite.db'), { readonly: true, fileMustExist: true });
  try {
    const q = db.prepare('select manifest_json from sketches where ref = ?');
    return Object.fromEntries(refs.map((r) => [r, JSON.parse(q.get(r)?.manifest_json ?? 'null')]));
  } finally { db.close(); }
}

/** A walk across a room looking at one wall: the camera keeps to the opposite wall and slides along it. */
function walk(rect, edge) {
  const x0 = rect.x, x1 = rect.x + rect.w, y0 = rect.y, y1 = rect.y + rect.h, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const [look, from, to] = {
    E: [[x1, cy], [x0 + INSET, y1 - INSET], [x0 + INSET, y0 + INSET]],
    W: [[x0, cy], [x1 - INSET, y0 + INSET], [x1 - INSET, y1 - INSET]],
    N: [[cx, y0], [x0 + INSET, y1 - INSET], [x1 - INSET, y1 - INSET]],
    S: [[cx, y1], [x1 - INSET, y0 + INSET], [x0 + INSET, y0 + INSET]],
  }[edge];
  const page = ([x, y], z) => [x, -y, z];
  const lookAt = page(look, LOOK);
  return { motion: 'flythrough', params: { width: W, height: H, keyframes: [{ pos: page(from, EYE), lookAt, fov: FOV }, { pos: page(to, EYE), lookAt, fov: FOV }] }, frames: FRAMES };
}
/** The wall a call's `surface` dresses, if it names one. */
const surfaceEdge = (input) => EDGES.find((e) => input?.surface?.[e]) ?? null;

export async function capture(work, from = path.join(work, 'session.json')) {
  if (path.resolve(from) !== path.join(work, 'session.json')) copyFileSync(from, path.join(work, 'session.json'));
  const S = JSON.parse(readFileSync(path.join(work, 'session.json'), 'utf8'));
  const HOUSE = JSON.parse(readFileSync(path.join(here, 'house.json'), 'utf8'));
  const data = path.join(work, 'replay');
  rmSync(data, { recursive: true, force: true });
  const env = { ...process.env, MOJULO_DATA_DIR: data, MOJULO_OUTCOMES_DIR: path.join(data, 'outcomes') };
  mkdirSync(env.MOJULO_OUTCOMES_DIR, { recursive: true });
  const call = (tool, args) => {
    const res = runJson(env, ['scripts/mcp-stdio.mjs', 'call', tool, '--json', JSON.stringify(args)]);
    if (res.ok === false || res.code) throw new Error(`${tool}: ${res.error || res.reason}`);
    return res;
  };
  const ff = (args) => new Promise((resolve, reject) => execFile(FFMPEG, ['-loglevel', 'error', '-y', ...args], (e) => (e ? reject(e) : resolve())));
  const forge = async (ref, name, shot) => {
    const res = call('forge_motion', { title: `decor demo · ${name}`, subject: { world_ref: ref }, shot: { ...shot, fps: 12 }, export: 'mp4' });
    const dir = path.join(work, 'clips', name);
    rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
    await ff(['-i', path.join(env.MOJULO_OUTCOMES_DIR, res.mp4_path.replace(/^\/outcomes\//, '')), '-vf', 'scale=540:500:flags=lanczos', path.join(dir, '%03d.png')]);
    console.log(`  ${name}: ${res.frames} frames`);
    return name;
  };
  // a room's rectangle on the plan, by its tag: the plan numbers its rooms 101, 102 … in order
  const rectOf = (tag) => {
    const r = HOUSE.manifest.rooms[Number(tag) - 101];
    if (!r) throw new Error(`no room ${tag} on the plan`);
    return r;
  };

  call('mint_building', HOUSE);
  const shots = { house: await forge(HOUSE.ref, 'house', { motion: 'orbit', params: { from: -12, to: 12, width: W, height: H }, frames: FRAMES }), turns: [] };
  const rooms = new Map();   // tag → { ref, focal }
  for (const [i, turn] of S.turns.entries()) {
    const writes = turn.tools.filter((x) => WRITES.has(x.name) && !x.error);
    const last = writes.filter((x) => x.name === 'design_interior').at(-1);
    const asked = writes.map((x) => surfaceEdge(x.input)).filter(Boolean).at(-1);
    const seen = last && rooms.get(last.tag);
    const replay = () => {
      for (const x of writes) {
        // a mint gets the ref the session's mint got, so its later revisions find it
        const res = call(x.name, x.name === 'design_interior' && !x.input.ref ? { ...x.input, ref: x.ref } : x.input);
        if (x.name === 'design_interior') rooms.set(res.interior.room.tag, { ref: res.ref, name: res.interior.room.name, focal: res.interior.focal?.wall });
      }
    };
    if (!last) { replay(); shots.turns.push(null); continue; }
    let before;
    if (seen) before = await forge(seen.ref, `t${i + 1}-before`, walk(rectOf(last.tag), asked || seen.focal));
    replay();
    const now = rooms.get(last.tag);
    const edge = asked || seen?.focal || now.focal || 'E';
    if (!seen) before = await forge(HOUSE.ref, `t${i + 1}-before`, walk(rectOf(last.tag), edge));
    const after = await forge(now.ref, `t${i + 1}-after`, walk(rectOf(last.tag), edge));
    shots.turns.push({ tag: last.tag, room: now.name, wall: edge, before, after, revisited: !!seen });
  }

  // the machine gate: the replay stored what the session stored
  if (S.recipes) {
    const got = recipesOf(data, Object.keys(S.recipes));
    for (const [ref, m] of Object.entries(S.recipes)) if (JSON.stringify(got[ref]) !== JSON.stringify(m)) throw new Error(`replay: ${ref} differs from the session's recipe`);
    console.log(`replay: ${Object.keys(S.recipes).length} recipes match the session's`);
  }
  writeFileSync(path.join(work, 'shots.json'), JSON.stringify(shots, null, 1));
  return shots;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const work = path.resolve(process.argv[2] || '.');
  mkdirSync(work, { recursive: true });
  const from = process.argv[3] ? path.resolve(process.argv[3]) : path.join(work, 'session.json');
  if (!existsSync(from)) throw new Error(`no session record at ${from}`);
  await capture(work, from);
}
