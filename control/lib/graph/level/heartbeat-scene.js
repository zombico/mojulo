/**
 * THE HEARTBEAT, SEEN — the `heartbeat` world kind: a heartbeat (era/heartbeat.js) laid on a reference level and shown
 * as a GREYBOX, the land in values and nothing else: no kit's colours, no grass, no trees. Light falls from one sun so
 * the slopes read; the walk is a shade lighter so its line reads; a face too steep to walk is a shade darker. It is
 * walkable, so a heartbeat is judged the way it will be played.
 *
 *   { kind: 'heartbeat', heartbeat: <preset | document | { from, … }>, on?: { kit?, runs?, seed? } }
 *
 * `on` is the reference level: an outdoor kit (its frame and its far cliff; never its look), its trails' runs in
 * seconds (two of 16 by default) and its seed. A level lays the same heartbeat in its own frame and paints it with its
 * own kit, style or geocube.
 */
import { readHeartbeat } from '../era/heartbeat.js';
import { sequentialLevel, sequentialOrder } from './sequential.js';
import { levelFrame } from './ground.js';
import { readLevel } from './graph.js';
import { outTrailOf } from '../era/out-trail-board.js';
import { surveyLevelGround } from './ground-survey.js';

const r3 = (v) => Math.round(v * 1000) / 1000;
const no = (msg) => { throw new Error(`heartbeat: ${msg}`); };
// the greybox's values: ground, the walk, a face too steep to walk
export const HEARTBEAT_GREY = Object.freeze({ ground: '#8d8a83', walk: '#b9b4a9', face: '#6d6f74' });
const SUN = (() => { const v = [-0.35, -0.55, 0.76], L = Math.hypot(...v); return v.map((x) => x / L); })();
const shade = (hex, n) => { const s = 0.5 + 0.5 * Math.max(0, n[0] * SUN[0] + n[1] * SUN[1] + n[2] * SUN[2]); return `#${[1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * s).toString(16).padStart(2, '0')).join('')}`; };

/** The reference level a heartbeat is shown on: { kit, seed, nodes } as level/graph.js reads it. */
export function heartbeatReferenceLevel(heartbeat, on = {}) {
  for (const k of Object.keys(on)) if (!['kit', 'runs', 'seed'].includes(k)) no(`on.${k} is not a setting (on: kit, runs, seed)`);
  const runs = on.runs ?? [16, 16];
  if (!Array.isArray(runs) || runs.length < 1 || runs.length > 4) no('on.runs is the reference level\'s trails, one to four, each its run in seconds');
  return { kit: on.kit ?? 'isekai-meadow', seed: on.seed ?? 1, nodes: Object.fromEntries(runs.map((run, i) => [`stretch-${i + 1}`, { trail: { run } }])), ground: { heartbeat } };
}

/** The greybox: the land of every trail of a level as value-shaded quads on a lattice of `step` metres. */
export function greyboxFaces(level, step = 1) {
  const G = readLevel(level), F = levelFrame(G, sequentialOrder(G)), laid = sequentialLevel(G), faces = [], anchors = [];
  laid.stages.filter((s) => s.section === 'trail').forEach((s) => {
    const span = F.spans.find((p) => p.node === s.node), site = outTrailOf(s.manifest).site, o = span.origin;
    const nx = Math.round((site.W - site.grid.x0) / step), ny = Math.round(site.D / step), x0 = site.grid.x0;
    const z = (i, j) => site.ground(x0 + i * step, Math.min(site.D, j * step));
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const xa = x0 + i * step, ya = j * step, za = z(i, j), zb = z(i + 1, j), zc = z(i + 1, j + 1), zd = z(i, j + 1);
      const gx = ((zb - za) + (zc - zd)) / (2 * step), gy = ((zd - za) + (zc - zb)) / (2 * step), L = Math.hypot(gx, gy, 1), n = [-gx / L, -gy / L, 1 / L];
      const cx = xa + step / 2, cy = ya + step / 2, onWalk = site.trailDist(cx, cy) < site.halfWAt(cy);
      const kind = Math.hypot(gx, gy) > 1 ? 'face' : onWalk ? 'walk' : 'ground';
      faces.push({ corners: [[xa, ya + o, za], [xa + step, ya + o, zb], [xa + step, ya + step + o, zc], [xa, ya + step + o, zd]].map((p) => p.map(r3)),
        normal: n.map(r3), fill: shade(HEARTBEAT_GREY[kind], n), group: `heartbeat:${kind}` });
    }
    for (const a of site.out.anchors) if (Array.isArray(a.at)) anchors.push({ ...a, at: [a.at[0], a.at[1] + o, a.at[2]].map(r3) });
  });
  return { faces, anchors, frame: F };
}

/** The `heartbeat` world kind: { heartbeat, on? } → its greybox on the reference level, walkable. */
export function assembleHeartbeatScene(manifest, ctx = {}) {
  for (const k of Object.keys(manifest)) if (!['kind', 'heartbeat', 'on', 'title', 'walk'].includes(k)) no(`'${k}' is not a setting of the heartbeat kind (heartbeat, on); lay it on a level with levels.<id>.ground.heartbeat`);
  const hb = readHeartbeat(manifest.heartbeat ?? no('heartbeat is a preset id or a document'));
  const level = heartbeatReferenceLevel(hb, manifest.on);
  const { faces, anchors, frame } = greyboxFaces(level);
  const th = anchors.find((a) => a.beat === 'trailhead'), ex = anchors.filter((a) => a.beat === 'exit').pop();
  const eye = [th.at[0], th.at[1], th.at[2] + 1.7], mid = [(frame.x0 + frame.x1) / 2, frame.length / 2];
  const zMid = ex ? (th.at[2] + ex.at[2]) / 2 : th.at[2];
  const survey = surveyLevelGround(level, { top: 6 });
  return {
    title: ctx.title || `${hb.title} · heartbeat`,
    faces, anchors,
    cameras: [
      { name: 'over', worldFraming: { cameraPosition: [r3(frame.x1 + 70), r3(mid[1] - frame.length * 0.55), r3(zMid + 80)], lookAt: [r3(mid[0]), r3(mid[1]), r3(zMid)], horizontalFov: 55 } },
      { name: 'trailhead', worldFraming: { cameraPosition: eye.map(r3), lookAt: [r3(th.at[0]), r3(th.at[1] + 30), r3(th.at[2] + 2)], horizontalFov: 75 } },
    ],
    viewBox: { width: 1280, height: 720 }, bg: '#16171b',
    walk: manifest.walk === false ? false : { speed: 7, spawn: eye.map(r3), minEye: 1.7, gravity: 22, radius: 0.4 },
    heartbeat: { id: hb.id, title: hb.title, reads: hb.reads, why: hb.why, pulse: hb.pulse, rise: hb.rise ?? null, marks: hb.marks.length,
      on: { kit: level.kit, seed: level.seed, runs: Object.values(level.nodes).map((n) => n.trail.run), length: r3(frame.length) },
      map: survey.map, trails: survey.trails.map(({ node, walk, broken }) => ({ node, walk, broken })) },
  };
}
