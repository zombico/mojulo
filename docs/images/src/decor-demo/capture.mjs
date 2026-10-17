// Film decor-demo from a session record: replay the calls that made something (the house, the rooms, the agent's own
// videos) in order into a fresh data dir, and around each ask film what it made with forge_motion.
//
//   node docs/images/src/decor-demo/capture.mjs <workDir> [session.json]     # default: <workDir>/session.json
//
// The recipes are the session's; the kernels draw them on every read, so a replay re-renders the same session after a
// kernel change without asking the agent again. It stops if a replayed recipe differs from the one the session
// stored. Per ask, in order: the house it built (a slow orbit), each room it designed (a walk at eye height facing
// the wall the ask changed, a `surface` edge, else looking into the room toward its focal wall; a room it had designed
// before is filmed before the ask too, from the same place), and the video it made itself (its stitched film, else its
// clips end to end).
import { execFile } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, copyFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONTROL, runJson } from '../lib/browser.mjs';

const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const Database = createRequire(path.join(CONTROL, 'package.json'))('better-sqlite3');
const MAKES = new Set(['mint_building', 'design_interior', 'update_sketch', 'forge_motion', 'stitch_motion']);
const FILMS = new Set(['forge_motion', 'stitch_motion']);
const EDGES = ['N', 'E', 'S', 'W'];
// the walk: a 1080 × 1000 render, 36 frames, standing eye height and a look a little below it, set in from the walls
// (World page units: feet, y negated); every clip is framed into the 540 × 500 pane
const W = 1080, H = 1000, FRAMES = 36, EYE = 6.4, LOOK = 3.4, FLOOR_LOOK = 1.6, INSET = 2.7, FOV = 62, ROOM_FOV = 70;
const PANE = 'scale=540:500:force_original_aspect_ratio=decrease:flags=lanczos,pad=540:500:(ow-iw)/2:(oh-ih)/2:color=0x0f1117';

/** The recipes a data dir holds for these refs → { ref: manifest }. */
export function recipesOf(dataDir, refs) {
  const db = new Database(path.join(dataDir, 'mojulo-lite.db'), { readonly: true, fileMustExist: true });
  try {
    const q = db.prepare('select manifest_json from sketches where ref = ?');
    return Object.fromEntries(refs.map((r) => [r, JSON.parse(q.get(r)?.manifest_json ?? 'null')]));
  } finally { db.close(); }
}

/** JSON with its keys sorted at every depth, so two recipes compare by content, not by the order their keys landed. */
const canonical = (v) => JSON.stringify(v, (_, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : 1))) : x));

/** A walk across a room toward one wall: the camera keeps to the opposite wall and slides along it, looking at that
 * wall when the ask dressed it, else into the room toward it (so what stands in the room is in frame). */
function walk(rect, edge, { atWall = false } = {}) {
  const x0 = rect.x, x1 = rect.x + rect.w, y0 = rect.y, y1 = rect.y + rect.h, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const [look, from, to] = {
    E: [[x1, cy], [x0 + INSET, y1 - INSET], [x0 + INSET, y0 + INSET]],
    W: [[x0, cy], [x1 - INSET, y0 + INSET], [x1 - INSET, y1 - INSET]],
    N: [[cx, y0], [x0 + INSET, y1 - INSET], [x1 - INSET, y1 - INSET]],
    S: [[cx, y1], [x1 - INSET, y0 + INSET], [x0 + INSET, y0 + INSET]],
  }[edge];
  const page = ([x, y], z) => [x, -y, z];
  const lookAt = atWall ? page(look, LOOK) : page([(look[0] + cx) / 2, (look[1] + cy) / 2], FLOOR_LOOK);
  const fov = atWall ? FOV : ROOM_FOV;
  return { motion: 'flythrough', params: { width: W, height: H, keyframes: [{ pos: page(from, EYE), lookAt, fov }, { pos: page(to, EYE), lookAt, fov }] }, frames: FRAMES };
}
/** The wall a call's `surface` dresses, if it names one. */
const surfaceEdge = (input) => EDGES.find((e) => input?.surface?.[e]) ?? null;

export async function capture(work, from = path.join(work, 'session.json')) {
  if (path.resolve(from) !== path.join(work, 'session.json')) copyFileSync(from, path.join(work, 'session.json'));
  const S = JSON.parse(readFileSync(path.join(work, 'session.json'), 'utf8'));
  const data = path.join(work, 'replay');
  rmSync(data, { recursive: true, force: true });
  const outcomes = path.join(data, 'outcomes');
  const env = { ...process.env, MOJULO_DATA_DIR: data, MOJULO_OUTCOMES_DIR: outcomes };
  mkdirSync(outcomes, { recursive: true });
  const call = (tool, args) => {
    const res = runJson(env, ['scripts/mcp-stdio.mjs', 'call', tool, '--json', JSON.stringify(args)]);
    if (res.ok === false || res.code) throw new Error(`${tool}: ${res.error || res.reason}`);
    return res;
  };
  const ff = (args) => new Promise((resolve, reject) => execFile(FFMPEG, ['-loglevel', 'error', '-y', ...args], (e) => (e ? reject(e) : resolve())));
  const frames = async (video, name) => {
    const dir = path.join(work, 'clips', name);
    rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
    await ff(['-i', path.join(outcomes, video.replace(/^\/outcomes\//, '')), '-vf', PANE, path.join(dir, '%03d.png')]);
    console.log(`  ${name}: ${readdirSync(dir).length} frames`);
    return name;
  };
  const forge = async (ref, name, shot) => frames(call('forge_motion', { title: `decor demo · ${name}`, subject: { world_ref: ref }, shot: { ...shot, fps: 12 }, export: 'mp4' }).mp4_path, name);

  const refMap = new Map();   // the session's refs → the replay's (a motion ref is new on every render)
  const mapped = (input) => JSON.parse([...refMap].reduce((s, [a, b]) => s.split(a).join(b), JSON.stringify(input)));
  const rooms = new Map();    // tag → { ref, name, focal }
  let house = null;           // { ref, manifest }
  const rectOf = (tag) => {
    const r = !house?.manifest?.levels && house?.manifest?.rooms?.[Number(tag) - 101];   // the plan numbers its rooms 101, 102 … in order
    if (!r) throw new Error(`no room ${tag} on the house's plan`);
    return r;
  };

  const shots = { turns: [] };
  for (const [i, turn] of S.turns.entries()) {
    const makes = turn.tools.filter((x) => MAKES.has(x.name) && !x.error);
    const designed = [...new Map(makes.filter((x) => x.name === 'design_interior').map((x) => [x.tag, x])).values()];
    const askedOf = (tag) => makes.filter((x) => x.name === 'design_interior' && x.tag === tag).map((x) => surfaceEdge(x.input)).filter(Boolean).at(-1);
    const out = [];
    // a room designed before: filmed as it stands, from where its after will be filmed
    const befores = new Map();
    for (const x of designed) {
      const seen = rooms.get(x.tag);
      if (seen) befores.set(x.tag, await forge(seen.ref, `t${i + 1}-${x.tag}-before`, walk(rectOf(x.tag), askedOf(x.tag) || seen.focal || 'E', { atWall: !!askedOf(x.tag) })));
    }
    const films = [];
    for (const x of makes) {
      const input = mapped(x.input);
      const minted = (x.name === 'mint_building' || x.name === 'design_interior') && !input.ref && x.ref;
      // a mint gets the ref the session's got, so its later revisions find it, and what the mint drew for itself (a
      // house's seed) from the session's stored recipe, so the replay draws the same house
      const drew = minted && x.name === 'mint_building' && S.recipes?.[x.ref]
        ? { manifest: { ...Object.fromEntries(Object.entries(S.recipes[x.ref]).filter(([key]) => !(key in input.manifest))), ...input.manifest } } : {};
      const res = call(x.name, minted ? { ...input, ...drew, ref: x.ref } : input);
      if (x.motion_ref && res.motion_ref) refMap.set(x.motion_ref, res.motion_ref);
      if (x.name === 'mint_building') house = { ref: res.ref };
      if (x.name === 'design_interior') rooms.set(res.interior.room.tag, { ref: res.ref, name: res.interior.room.name, focal: res.interior.focal?.wall });
      if (FILMS.has(x.name)) films.push({ by: x.name, video: res.mp4_path || res.gif_path });
    }
    if (house) house.manifest = recipesOf(data, [house.ref])[house.ref];
    if (makes.some((x) => x.name === 'mint_building')) out.push({ kind: 'house', clip: await forge(house.ref, `t${i + 1}-house`, { motion: 'orbit', params: { from: -12, to: 12, width: W, height: H }, frames: FRAMES }) });
    for (const x of designed) {
      const now = rooms.get(x.tag), edge = askedOf(x.tag) || now.focal || 'E';
      const after = await forge(now.ref, `t${i + 1}-${x.tag}`, walk(rectOf(x.tag), edge, { atWall: !!askedOf(x.tag) }));
      out.push({ kind: 'room', tag: x.tag, room: now.name, wall: edge, before: befores.get(x.tag) || null, after });
    }
    const stitched = films.filter((f) => f.by === 'stitch_motion').at(-1);
    const reel = stitched ? [stitched] : films;
    if (reel.length) out.push({ kind: 'film', by: stitched ? 'stitch_motion' : 'forge_motion', clips: await Promise.all(reel.map((f, j) => frames(f.video, `t${i + 1}-film-${j + 1}`))) });
    shots.turns.push(out);
  }

  // the machine gate: the replay stored what the session stored
  if (S.recipes) {
    const got = recipesOf(data, Object.keys(S.recipes));
    for (const [ref, m] of Object.entries(S.recipes)) if (canonical(got[ref]) !== canonical(m)) throw new Error(`replay: ${ref} differs from the session's recipe`);
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
