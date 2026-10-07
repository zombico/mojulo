/**
 * The local meru, walked. A headless walker on the World's own rules (scene/channels/walk.js): gravity, the floor ray
 * straight down, the eye and shin rays ahead that stop it at a wall, and the opt-in CLIMB. It is steered along the
 * planned spiral from the seam, and must stand on the summit; then up the tower's climb, and must stand on the deck.
 */
import { describe, expect, it } from 'vitest';

import { assembleStageScene } from '../era/stage.js';
import { planLocalMeru } from './plan.js';

const RECIPE = { kind: 'stage', kit: 'isekai-meadow', seed: 8, meru: { after: { trail: true } } };
const DT = 1 / 60;

// every opaque face as triangles in a 1 m xy hash (a cutout is walked through, as the World does)
function worldOf(payload) {
  const cut = new Set(payload.cutouts || []), tris = [], cell = new Map(), C = 1;
  for (const f of payload.faces) {
    if (f.texture && cut.has(f.texture)) continue;
    const cs = f.corners;
    for (let k = 1; k + 1 < cs.length; k++) {
      const t = [cs[0], cs[k], cs[k + 1]], id = tris.push(t) - 1;
      const x0 = Math.floor(Math.min(...t.map((p) => p[0])) / C), x1 = Math.floor(Math.max(...t.map((p) => p[0])) / C);
      const y0 = Math.floor(Math.min(...t.map((p) => p[1])) / C), y1 = Math.floor(Math.max(...t.map((p) => p[1])) / C);
      for (let i = x0; i <= x1; i++) for (let j = y0; j <= y1; j++) { const key = `${i},${j}`; (cell.get(key) || cell.set(key, []).get(key)).push(id); }
    }
  }
  // Möller–Trumbore: the distance along d to triangle t from o, or Infinity
  const hit = (o, d, t) => {
    const e1 = [0, 1, 2].map((k) => t[1][k] - t[0][k]), e2 = [0, 1, 2].map((k) => t[2][k] - t[0][k]);
    const p = [d[1] * e2[2] - d[2] * e2[1], d[2] * e2[0] - d[0] * e2[2], d[0] * e2[1] - d[1] * e2[0]], det = e1[0] * p[0] + e1[1] * p[1] + e1[2] * p[2];
    if (Math.abs(det) < 1e-12) return Infinity;
    const s = [0, 1, 2].map((k) => o[k] - t[0][k]), u = (s[0] * p[0] + s[1] * p[1] + s[2] * p[2]) / det;
    if (u < 0 || u > 1) return Infinity;
    const q = [s[1] * e1[2] - s[2] * e1[1], s[2] * e1[0] - s[0] * e1[2], s[0] * e1[1] - s[1] * e1[0]], v = (d[0] * q[0] + d[1] * q[1] + d[2] * q[2]) / det;
    if (v < 0 || u + v > 1) return Infinity;
    const r = (e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2]) / det;
    return r > 1e-6 ? r : Infinity;
  };
  const near = (pts) => { const ids = new Set(); for (const [x, y] of pts) for (const id of cell.get(`${Math.floor(x / C)},${Math.floor(y / C)}`) || []) ids.add(id); return ids; };
  return {
    down(x, y, z) { let best = Infinity; for (const id of near([[x, y]])) best = Math.min(best, hit([x, y, z], [0, 0, -1], tris[id])); return best === Infinity ? null : z - best; },
    ahead(o, d, len) {
      const pts = []; for (let s = 0; s <= len + 1; s += 0.5) pts.push([o[0] + d[0] * s, o[1] + d[1] * s]);
      let best = Infinity; for (const id of near(pts)) best = Math.min(best, hit(o, d, tris[id])); return best;
    },
  };
}

// the walker: the walk channel's WALK step and its CLIMB, frame for frame
function walker(payload) {
  const W = payload.walk, world = worldOf(payload), eye = W.minEye, climbs = W.climbs || [];
  const g0 = world.down(W.spawn[0], W.spawn[1], W.spawn[2] + 1e-3);
  const me = { x: W.spawn[0], y: W.spawn[1], z: g0 + eye, vz: 0, yaw: 0, climb: null, ground: true };
  const climbHere = (feet) => climbs.find((c) => {
    const dx = me.x - c.top[0], dy = me.y - c.top[1], into = dx * c.N[0] + dy * c.N[1], side = -dx * c.N[1] + dy * c.N[0];
    return Math.abs(side) <= c.width / 2 && into >= -0.9 && into <= 0.35 && feet >= c.base[2] - 0.3 && feet <= c.top[2] + 0.1;
  }) || null;
  const stepClimb = (w, s) => {
    const feet = me.z - eye, c = climbHere(feet);
    if (!c) { me.climb = null; return false; }
    const facing = Math.cos(me.yaw) * c.N[0] + Math.sin(me.yaw) * c.N[1];
    if (me.climb !== c) {
      if (!((w && facing > 0.3 && feet < c.top[2] - 0.2) || (w && facing < -0.3 && feet > c.top[2] - 0.3))) return false;
      me.climb = c;
    }
    me.z += (w ? 1 : s ? -1 : 0) * (facing >= 0 ? 1 : -1) * c.speed * DT; me.vz = 0;
    const dx = me.x - c.top[0], dy = me.y - c.top[1], side = -dx * c.N[1] + dy * c.N[0];
    me.x = c.top[0] - c.N[0] * 0.5 - c.N[1] * side; me.y = c.top[1] - c.N[1] * 0.5 + c.N[0] * side;
    if (me.z - eye >= c.top[2]) { me.x = c.top[0] + c.N[0] * 0.8; me.y = c.top[1] + c.N[1] * 0.8; me.z = c.top[2] + eye; me.climb = null; }
    else if (me.z - eye <= c.base[2]) { me.z = c.base[2] + eye; me.climb = null; }
    return true;
  };
  const slide = (dx, dy) => {
    for (const [ax, ay] of [[dx, 0], [0, dy]]) {
      const d = Math.hypot(ax, ay); if (d < 1e-6) continue;
      const dir = [ax / d, ay / d, 0]; let allow = d;
      for (const zo of [0, -eye * 0.6]) allow = Math.min(allow, Math.max(0, world.ahead([me.x, me.y, me.z + zo], dir, d + W.radius) - W.radius));
      me.x += dir[0] * allow; me.y += dir[1] * allow;
    }
  };
  me.step = (w = true, s = false) => {
    if (climbs.length && stepClimb(w, s)) return;
    if (w) slide(Math.cos(me.yaw) * W.speed * DT, Math.sin(me.yaw) * W.speed * DT);
    me.vz -= W.gravity * DT; me.z += me.vz * DT;
    const g = world.down(me.x, me.y, me.z);
    if (g != null && me.z <= g + eye) { me.z = g + eye; me.vz = 0; me.ground = true; } else me.ground = false;
  };
  me.feet = () => me.z - eye;
  return me;
}

describe('the local meru, walked on the World\'s own rules', () => {
  const payload = assembleStageScene(RECIPE), plan = planLocalMeru({ after: { kit: 'isekai-meadow', seed: 8, trail: true } });

  it('walks from the seam up the spiral and stands on the summit; then climbs the tower and stands on its deck', () => {
    const me = walker(payload), path = [plan.join.at, ...plan.path.map((q) => q.at), plan.summit.arrive];
    // steer along the planned walk: aim a metre and a half ahead of the nearest point passed
    let k = 0, t = 0;
    while (t < 90) {
      while (k < path.length - 1 && Math.hypot(path[k][0] - me.x, path[k][1] - me.y) < 1.5) k++;
      me.yaw = Math.atan2(path[k][1] - me.y, path[k][0] - me.x); me.step(); t += DT;
      if (k === path.length - 1 && Math.hypot(path[k][0] - me.x, path[k][1] - me.y) < 0.6) break;
    }
    // the walk takes about as long as its length at the walker's pace: nothing held it up
    expect(t).toBeLessThan((plan.length + plan.recipe.path.approach) / payload.walk.speed * 1.6 + 2);
    expect(me.feet()).toBeCloseTo(plan.summit.z, 0);
    expect(Math.hypot(me.x - plan.centre[0], me.y - plan.centre[1])).toBeLessThan(plan.summit.r);
    // to the climb's foot, face it, climb
    const c = payload.walk.climbs[0];
    for (let i = 0; i < 600 && Math.hypot(c.base[0] - me.x, c.base[1] - me.y) > 0.3; i++) { me.yaw = Math.atan2(c.base[1] - me.y, c.base[0] - me.x); me.step(); }
    me.yaw = Math.atan2(c.N[1], c.N[0]);
    for (let i = 0; i < 600 && me.feet() < c.top[2] - 0.01; i++) me.step();
    for (let i = 0; i < 30; i++) me.step(false);   // step off, stand
    expect(me.feet()).toBeCloseTo(plan.tower.deck, 1);
    expect(Math.hypot(me.x - plan.centre[0], me.y - plan.centre[1])).toBeLessThan(plan.tower.half);
  }, 120000);

  it('the climb comes back down: walked out over the lip from the deck, it lands at the foot', () => {
    const me = walker(payload), c = payload.walk.climbs[0];
    Object.assign(me, { x: c.top[0] + c.N[0] * 0.8, y: c.top[1] + c.N[1] * 0.8, z: c.top[2] + payload.walk.minEye });
    me.yaw = Math.atan2(-c.N[1], -c.N[0]);
    for (let i = 0; i < 900 && !(me.feet() <= c.base[2] + 0.05 && !me.climb); i++) me.step();
    expect(me.feet()).toBeCloseTo(plan.summit.z, 0);
  }, 60000);

  it('no way round the spiral: walked straight at the flank from all round its foot, no one reaches the summit', () => {
    for (let a = 0; a < 6; a++) {
      const ang = (a * Math.PI) / 3, r = plan.recipe.mound.foot + 1, m = walker(payload);
      Object.assign(m, { x: plan.centre[0] + Math.cos(ang) * r, y: plan.centre[1] + Math.sin(ang) * r, z: 30 });
      for (let i = 0; i < 400; i++) m.step(false);
      m.yaw = Math.atan2(plan.centre[1] - m.y, plan.centre[0] - m.x);
      for (let i = 0; i < 1800; i++) m.step();
      // a shelf's wall stops a scramble up the flank from below (the World's walk has no slope limit of its own)
      expect(m.feet()).toBeLessThan(plan.summit.z - 2);
    }
  }, 120000);

  it('without its climb the deck is out of reach: walking into the tower stays on the summit', () => {
    const me = walker({ ...payload, walk: { ...payload.walk, climbs: [] } }), c = payload.walk.climbs[0];
    Object.assign(me, { x: c.base[0], y: c.base[1], z: c.base[2] + payload.walk.minEye });
    me.yaw = Math.atan2(c.N[1], c.N[0]);
    for (let i = 0; i < 300; i++) me.step();
    expect(me.feet()).toBeLessThan(plan.summit.z + 1);
  }, 60000);
});
