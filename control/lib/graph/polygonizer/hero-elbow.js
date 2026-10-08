/**
 * hero-elbow — ELBOWS DOWN. A bent arm raised forward hinges in whatever plane the shoulder's roll leaves it in, so
 * an un-rolled arm raised to the front folds its forearm sideways across the chest, the elbow pointing out (a chicken
 * wing). An arm is never posed that way here: the shoulder rolls so the forearm folds UP and the elbow hangs beneath
 * it, at any raise.
 *
 * Per rig and side, the roll that puts the elbow lowest (the forearm's bend, off the upper arm's line, pointing as
 * high as it can) is found once for every 5° of shoulder pitch and read between, weighted by how far the arm is
 * raised (a hanging or back-swung arm keeps its own bend: no roll), followed up from the hanging arm a few degrees a
 * step so the roll never snaps as an arm swings up. `elbowsDown(R, pose)` adds it to each shoulder's roll.
 * Deterministic; a pose without shoulder pitches is returned as it is.
 */
import { rigNodesAt } from './station-loft-rig.js';

const PITCH = [0, 180], STEP = 5, ROLL = 110, TURN = 12;   // TURN: the most the roll moves per STEP (continuous: no snap)
const cache = new WeakMap();

/** the best roll at each STEP of pitch, for one side of one rig */
function table(R, S) {
  const memo = cache.get(R) || {}; if (memo[S]) return memo[S];
  const shoulder = `shoulder${S}`, elbow = `elbow${S}`, wrist = `wrist${S}`;
  const score = (pitch, roll) => {
    const n = rigNodesAt(R, { support: 'none', [`sh${S}`]: { pitch, roll }, [`elbow${S}`]: 70 }).nodes;
    const u = [n[elbow][0] - n[shoulder][0], n[elbow][1] - n[shoulder][1], n[elbow][2] - n[shoulder][2]]; const ul = Math.hypot(...u) || 1;
    const f = [n[wrist][0] - n[elbow][0], n[wrist][1] - n[elbow][1], n[wrist][2] - n[elbow][2]];
    const along = (f[0] * u[0] + f[1] * u[1] + f[2] * u[2]) / (ul * ul);
    return f[2] - along * u[2];   // the bend off the upper arm's line: its height (the elbow lowest when it is greatest)
  };
  // followed up from the hanging arm (no roll), each STEP searching only near the last: the roll changes smoothly
  const rows = []; let prev = 0;
  for (let p = PITCH[0]; p <= PITCH[1]; p += STEP) {
    let best = prev, bs = score(p, prev);
    for (let r = Math.max(-ROLL, prev - TURN); r <= Math.min(ROLL, prev + TURN); r += 1) { const v = score(p, r); if (v > bs + 1e-9) { bs = v; best = r; } }
    rows.push(best); prev = best;
  }
  memo[S] = rows; cache.set(R, memo); return rows;
}

/** the elbow-down roll for a shoulder pitch on one side (degrees), faded in as the arm rises from hanging */
export function elbowDownRoll(R, S, pitch) {
  // only a RAISED arm: hanging or swung back, the elbow already points down or back on its own
  if (!Number.isFinite(pitch) || pitch <= 0) return 0;
  const rows = table(R, S); const x = (Math.max(PITCH[0], Math.min(PITCH[1], pitch)) - PITCH[0]) / STEP;
  const i = Math.min(rows.length - 2, Math.floor(x)), t = x - i; const roll = rows[i] * (1 - t) + rows[i + 1] * t;
  const w = Math.min(1, Math.abs(Math.sin((pitch * Math.PI) / 180)) / Math.sin(Math.PI / 6));   // full past 30° of raise
  return roll * w;
}

/** a pose with each shoulder rolled so its elbow hangs below the forearm (the arm's own roll kept on top) */
export function elbowsDown(R, pose) {
  let out = pose;
  for (const S of ['L', 'R']) {
    const sh = pose?.[`sh${S}`]; if (!sh || !Number.isFinite(sh.pitch)) continue;
    if (out === pose) out = { ...pose };
    out[`sh${S}`] = { ...sh, roll: (sh.roll || 0) + elbowDownRoll(R, S, sh.pitch) };
  }
  return out;
}
