// storeys, swept: the storeyed programs on every room shell, dressed and lowered as levels, then WALKED. A walker of the
// level's body (0.3 m round, stepping 0.35) steers along the level's route to its goal: the colliders stop it as the
// page's walk rule does (core.js resolveBlocking), and it stands on the highest floor or tread under its probe (the
// rule's `probe` over its feet), as the page's ground ray does. It reaches the goal on the goal's storey, never falls,
// never sticks.

import { describe, it, expect } from 'vitest';
import { assembleStageScene, STAGE_KITS } from './stage.js';
import { withBuildingLevel } from '../structure/level.js';
import { buildCore } from '../worlds/controllable/core.js';

const E = {};
buildCore(E);
// one room kit per shell: each a distinct way to build the rooms the stair climbs through
const firstOf = (ids, key) => ids.filter((id, i) => ids.findIndex((x) => key(x) === key(id)) === i);
const ROOM_KITS = firstOf(Object.keys(STAGE_KITS).filter((k) => STAGE_KITS[k].grid && STAGE_KITS[k].shell !== 'plaza'), (k) => STAGE_KITS[k].shell ?? 'crypt');
const EYE = 1.7, BODY = 0.3, STEP = 0.35, SPEED = 4.5, DT = 1 / 30;

/** The page's ground ray, over the scene's upward faces: the highest under (x, y) at or below where it is cast from. */
function groundOf(faces) {
  const cells = new Map();
  const up = faces.filter((f) => f.normal && f.normal[2] > 0.7);
  for (const f of up) {
    const xs = f.corners.map((c) => c[0]), ys = f.corners.map((c) => c[1]);
    for (let i = Math.floor(Math.min(...xs)); i <= Math.floor(Math.max(...xs)); i++) for (let j = Math.floor(Math.min(...ys)); j <= Math.floor(Math.max(...ys)); j++) {
      const k = `${i},${j}`; if (!cells.has(k)) cells.set(k, []); cells.get(k).push(f);
    }
  }
  const inPoly = (x, y, cs) => { let c = false; for (let i = 0, j = cs.length - 1; i < cs.length; j = i++) { const a = cs[i], b = cs[j]; if ((a[1] > y) !== (b[1] > y) && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
  return (x, y, from) => {
    let best = null;
    for (const f of cells.get(`${Math.floor(x)},${Math.floor(y)}`) || []) {
      if (!inPoly(x, y, f.corners)) continue;
      const n = f.normal, p = f.corners[0], z = p[2] - (n[0] * (x - p[0]) + n[1] * (y - p[1])) / n[2];
      if (z <= from + 0.05 && (best === null || z > best)) best = z;
    }
    return best;
  };
}

/** Walk the level's route to its goal: → { ok, at, why }. */
function walk(scene, mech, spawn, probe) {
  const ground = groundOf(scene.faces), cols = scene.colliders;
  const pos = [spawn[0], spawn[1], spawn[2] + EYE];
  const targets = [...(mech.via || []), mech.at];
  let k = 0, since = 0;
  for (let t = 0; t < 120 / DT; t++) {
    const goal = k === targets.length - 1, q = targets[k];
    if (goal && Math.hypot(pos[0] - q[0], pos[1] - q[1], pos[2] - q[2]) < mech.radius) return { ok: true, at: pos };
    const dx = q[0] - pos[0], dy = q[1] - pos[1], d = Math.hypot(dx, dy);
    if (!goal && d < 0.6) { k++; since = 0; continue; }
    const s = Math.min(d, SPEED * DT);
    if (d > 1e-6) { pos[0] += (dx / d) * s; pos[1] += (dy / d) * s; }
    E.resolveBlocking(pos, pos[2] - EYE, EYE, BODY, cols, STEP);
    const g = ground(pos[0], pos[1], pos[2] - EYE + probe);
    if (g === null) return { ok: false, at: pos, why: `fell at waypoint ${k}` };
    pos[2] = g + EYE;
    if ((since += DT) > 8) return { ok: false, at: pos.map((v) => +v.toFixed(2)), why: `stuck before waypoint ${k} ${q}` };
  }
  return { ok: false, at: pos, why: 'out of time' };
}

describe('the storeyed programs, on every room shell, are walked to their goal upstairs', () => {
  ROOM_KITS.forEach((kit, k) => {
    it(`${kit}: the tower's lookout and the keep's treasury are reached up their stairs`, () => {
      ['tower', 'keep'].forEach((use, u) => {
        const seed = 1 + ((2 * k + u) % 3);
        const m = withBuildingLevel({ kind: 'stage', kit, program: { use, seed }, level: {} }, 'lv');
        const scene = assembleStageScene(m, { unshaded: true });
        const mech = m.game.mechanics.find((x) => x.kind === 'reach-exit');
        const rule = m.entities[0].rule;
        expect(rule.probe, `${kit} ${use} s${seed}: the walker looks for its ground over its feet`).toBeGreaterThan(rule.step ?? STEP);
        const r = walk(scene, mech, m.entities[0].transform.pos.map((v, i) => (i === 2 ? v - EYE : v)), rule.probe);
        expect(r.ok, `${kit} ${use} s${seed}: ${r.why} at ${r.at}`).toBe(true);
        expect(mech.at[2], `${kit} ${use} s${seed}: the goal is upstairs`).toBeGreaterThan(4);
      });
    });
  });
});
