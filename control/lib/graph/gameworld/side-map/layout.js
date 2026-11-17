/**
 * THE SIDE MAP'S LAYOUT (docs/side-map-principles.md): a zone chain (zones.js) laid on the along × up plane, in screens
 * (screen.js: the side map's camera for the hero's stature) and in the hero's reach (feel/reach.js). Each zone is laid
 * from where the last one left the walk; what the camera sees is its SWEPT area (a run's band one screen thick, a shaft's
 * one screen wide, a room's its size), what the play moves in is OPEN, and the rest is CLOSED (solid, painted later).
 *
 * The frame is the lane's (as the side strip's): `s` along the lane (+y), `z` up, the camera on the +x side; a solid is
 * drawn across the lane's width (x ±1.5). A floor stands two thirds of the way down its band: a band spans a third of a
 * screen under the floor and two thirds over it.
 *
 *   across  the course (course.js coursePlan) for what it teaches, at the run's length: floors and the gaps between,
 *           every gap open to the frame's bottom (a pit: falling out of it is a life); `pillars` a pit crossed on tops a
 *           jump apart; `ceiling` a held ceiling a jump and a body over the floor
 *   up      a shaft narrower than a screen, its walls closed out to the frame's edges, the next floor on its far wall's
 *           top: a CHIMNEY (rests on alternating walls, never more than three kicks apart, a pickup on each), LEDGES
 *           (tops a jump apart up the face), a SWITCHBACK (floors back and forth, a gap at alternate ends), a STAIR
 *           (short steps), a LADDER (climbed hand over hand); `rises`: its frame climbs on its own (the camera's)
 *   down    a CASCADE (steps down, a jump high each, going on along the lane) or a CHUTE (a one-way shaft, a shutter at
 *           its foot)
 *   room    floor, walls and ceiling at its size in screens, entered by a door at the floor (a boss's, its shutter)
 *
 *   layoutSideMap(map, { reach, stature }) → {
 *     screen, camera,                         the screen in metres and the side map's camera (screen.js)
 *     zones: [{ i, kind, run?, rect, exit, lock }]   each zone's swept rectangle, where the walk leaves it, the axis its
 *                                             camera holds ('z' across, 's' up and down, null a room)
 *     swept, open, solids: [{ s0, s1, z0, z1, zone, role }]   the camera's area, the play's, the closed parts
 *     blocks: [{ min, max, role }]            the solids as the level's boxes
 *     gaps, rests, ladders, doors, spawners, pickups, checkpoints, rises, advice
 *   }
 *
 * Pure and deterministic.
 */
import { coursePlan } from '../course.js';
import { sideMapCamera } from './screen.js';
import { readSideMap } from './zones.js';

const HALF = 1.5, TH = 0.4, PAD = 1.5, LAND = 4, LEDGE = 1.2, LADDER_SHAFT = 2.4;
const r3 = (v) => Math.round(v * 1000) / 1000;

/** The zone chain laid on the plane. */
export function layoutSideMap(map, { reach, stature }) {
  const M = readSideMap(map), camera = sideMapCamera(stature), W = camera.screen.width, H = camera.screen.height;
  const run = reach.moves.run, J = run.height, LJ = run.long, kick = reach.wall?.climb ?? null;
  const door = r3(stature + J + 0.4);
  const out = { screen: camera.screen, camera, zones: [], swept: [], open: [], solids: [], gaps: [], rests: [], ladders: [], doors: [], spawners: [], pickups: [], checkpoints: [], rises: [], advice: [] };
  const rect = (list, s0, s1, z0, z1, zone, role) => { if (s1 - s0 > 1e-6 && z1 - z0 > 1e-6) list.push({ s0: r3(s0), s1: r3(s1), z0: r3(z0), z1: r3(z1), zone, ...(role ? { role } : {}) }); };
  const solid = (s0, s1, z0, z1, zone, role) => rect(out.solids, s0, s1, z0, z1, zone, role);
  const band = (z) => [z - H / 3, z + (2 * H) / 3];
  const advise = (zone, says) => out.advice.push({ zone, says });

  const LAY = {
    across(Z, i, s, z) {
      const L = Z.screens * W, floors = [];
      if (Z.pillars) {
        // a pit crossed on PILLARS: a landing, the tops a running jump's share apart at unlike heights, a landing
        const gap = r3(0.6 * LJ), lift = [0, 0.3, -0.25, 0.2, -0.1];
        floors.push({ s0: 0, s1: LAND, z: 0 });
        let at = LAND;
        for (let k = 0; k < Z.pillars; k++) { at += gap; floors.push({ s0: at, s1: at + LEDGE, z: r3(J * lift[k % lift.length]), pillar: true }); at += LEDGE; }
        at += gap;
        if (at + LAND > L) advise(i, `${Z.pillars} pillars need ${r3(at + LAND)} m and the run is ${r3(L)} m: it is laid longer`);
        floors.push({ s0: at, s1: Math.max(L, at + LAND), z: 0 });
      } else {
        const teach = Z.teach && Z.teach !== 'boss' ? Z.teach : 'boss';
        let plan;
        try { plan = coursePlan(reach, { teach, verticality: 'flat', length: L, lift: 0, end: PAD, floor: 0 }); }
        catch { plan = coursePlan(reach, { teach: 'boss', verticality: 'flat', length: Math.max(L, 30), lift: 0, end: PAD, floor: 0 }); advise(i, `${r3(L)} m (${Z.screens} screens) holds no ${teach} course: it is laid as one floor; give it more screens`); }
        floors.push({ s0: 0, s1: plan.floors[0].s0, z: 0 }, ...plan.floors, { s0: plan.floors.at(-1).s1, s1: Math.max(L, plan.floors.at(-1).s1), z: plan.floors.at(-1).z });
        for (const g of plan.gaps) out.gaps.push({ zone: i, s0: r3(s + g.s0), s1: r3(s + g.s1), w: g.w, dz: g.dz, teaches: g.teaches, kind: g.kind });
      }
      const len = Math.max(L, floors.at(-1).s1), lo = Math.min(...floors.map((f) => f.z)), hi = Math.max(...floors.map((f) => f.z));
      const [zb] = band(z + lo), zt = band(z + hi)[1];
      for (const f of floors) solid(s + f.s0, s + f.s1, zb, z + f.z, i, f.pillar ? 'pillar' : 'floor');
      const ceil = Z.ceiling ? z + hi + Math.max(door, 0.35 * H) : zt;
      if (Z.ceiling) solid(s, s + len, ceil, zt, i, 'ceiling');
      rect(out.open, s, s + len, z + lo, ceil, i);
      rect(out.swept, s, s + len, zb, zt, i);
      // where foes come from, along the run (a count), each over the floor under it
      const floorAt = (u) => floors.find((f) => u >= f.s0 && u <= f.s1) ?? floors[0];
      for (let k = 0; k < (Z.spawners ?? 0); k++) { const u = (len * (k + 0.5)) / Z.spawners, f = floorAt(u); out.spawners.push({ zone: i, at: [r3(s + u), r3(z + f.z)] }); }
      if (Z.beat === 'landing') out.pickups.push({ zone: i, at: [r3(s + len / 2), r3(z + floorAt(len / 2).z + 0.5)] });
      out.checkpoints.push({ zone: i, at: [r3(s + PAD / 2), r3(z)] });
      return { rect: [s, s + len, zb, zt], exit: [s + len, z + floors.at(-1).z], lock: 'z' };
    },
    up(Z, i, s, z) {
      const L = Z.screens * H, form = Z.climb;
      if (form === 'chimney' && !kick) advise(i, 'the hero kicks off no wall (its feel has no cling): a chimney cannot be climbed; climb it by ledges');
      const w = r3(form === 'chimney' ? Math.min(Math.max(0.9 * LJ, 2.4), 0.4 * W) : form === 'ladder' ? LADDER_SHAFT : Math.min(Math.max(3 * LJ, 8), 0.45 * W));
      const side = (W - w) / 2, c = s, top = z + L;
      // the shaft's floor, its near wall over the way in (a door's height open), its far wall up to the next floor
      solid(c, c + w, band(z)[0], z, i, 'floor');
      solid(c - side, c, z + door, top + (2 * H) / 3, i, 'wall');
      solid(c + w, c + w + side, band(z)[0], top, i, 'wall');
      rect(out.open, c, c + w, z, top + (2 * H) / 3, i);
      const rests = [];
      if (form === 'chimney' || form === 'stair' || form === 'ledges') {
        // a rest, on alternate walls: a chimney's within three kicks, a ledge stair's a jump up, a stair's a short step
        const step = form === 'chimney' ? 0.9 * Math.min(3 * (kick || J), L) : form === 'stair' ? 0.45 * J : 0.75 * J;
        for (let k = 1, at = z + step; at < top - 0.5; k++, at = z + k * step) {
          const left = k % 2 === 1, s0 = left ? c : c + w - (form === 'chimney' ? LEDGE : 0.45 * w), s1 = left ? c + (form === 'chimney' ? LEDGE : 0.45 * w) : c + w;
          solid(s0, s1, at - TH, at, i, 'rest');
          rests.push({ zone: i, s0: r3(s0), s1: r3(s1), z: r3(at), side: left ? 'near' : 'far' });
          if (form === 'chimney') out.pickups.push({ zone: i, at: [r3((s0 + s1) / 2), r3(at + 0.4)] });
        }
      } else if (form === 'switchback') {
        // floors across the shaft, a gap at alternate ends to jump up through
        const step = 0.8 * J, gap = Math.max(LEDGE * 2, 0.6 * LJ);
        for (let k = 1, at = z + step; at < top - 0.5; k++, at = z + k * step) {
          const s0 = k % 2 ? c + gap : c, s1 = k % 2 ? c + w : c + w - gap;
          solid(s0, s1, at - TH, at, i, 'rest');
          rests.push({ zone: i, s0: r3(s0), s1: r3(s1), z: r3(at), side: k % 2 ? 'far' : 'near' });
        }
      } else if (form === 'ladder') {
        out.ladders.push({ zone: i, foot: [r3(c + w / 2), r3(z)], lip: [r3(c + w), r3(top)], face: 'camera' });
      }
      out.rests.push(...rests);
      if (Z.rises) out.rises.push({ zone: i, from: r3(z), to: r3(top) });
      rect(out.swept, c - side, c + w + side, band(z)[0], top + (2 * H) / 3, i);
      out.checkpoints.push({ zone: i, at: [r3(c + w / 2), r3(z)] });
      return { rect: [c - side, c + w + side, band(z)[0], top + (2 * H) / 3], exit: [c + w, top], lock: 's' };
    },
    down(Z, i, s, z) {
      const L = Z.screens * H, c = s;
      if (Z.drop === 'chute') {
        const w = LADDER_SHAFT, side = (W - w) / 2, foot = z - L;
        solid(c - side, c, band(foot)[0], z, i, 'wall');
        solid(c + w, c + w + side, foot + door, band(z)[1], i, 'wall');
        solid(c, c + w, band(foot)[0], foot, i, 'floor');
        rect(out.open, c, c + w, foot, band(z)[1], i);
        rect(out.swept, c - side, c + w + side, band(foot)[0], band(z)[1], i);
        out.doors.push({ zone: i, at: [r3(c + w), r3(foot)], kind: 'shutter', why: 'a chute is one-way: its foot shuts behind' });
        out.checkpoints.push({ zone: i, at: [r3(c + w / 2), r3(foot)] });
        return { rect: [c - side, c + w + side, band(foot)[0], band(z)[1]], exit: [c + w, foot], lock: 's' };
      }
      // a CASCADE: steps down, each a jump high and a landing long
      const n = Math.max(1, Math.round(L / J)), d = L / n;
      let lo = z;
      for (let k = 1; k <= n; k++) {
        const zk = z - k * d, s0 = c + (k - 1) * LAND, s1 = c + k * LAND;
        solid(s0, s1, band(z - L)[0], zk, i, 'step');
        rect(out.swept, s0, s1, band(zk)[0], band(zk)[1], i);
        rect(out.open, s0, s1, zk, band(zk)[1], i);
        lo = zk;
      }
      out.checkpoints.push({ zone: i, at: [r3(c + LAND / 2), r3(z - d)] });
      return { rect: [c, c + n * LAND, band(lo)[0], band(z)[1]], exit: [c + n * LAND, lo], lock: 's' };
    },
    room(Z, i, s, z) {
      const wR = Z.room[0] * W, hR = Z.room[1] * H, c = s, zb = z - H / 3, top = zb + hR, wall = 0.6;
      solid(c, c + wR, zb, z, i, 'floor');
      solid(c, c + wR, top - wall, top, i, 'ceiling');
      solid(c, c + wall, z + door, top - wall, i, 'wall');
      solid(c + wR - wall, c + wR, z, top - wall, i, 'wall');
      rect(out.open, c + wall, c + wR - wall, z, top - wall, i);
      rect(out.swept, c, c + wR, zb, top, i);
      if (Z.teach === 'boss') out.doors.push({ zone: i, at: [r3(c), r3(z)], kind: 'shutter', why: 'the boss\'s room: its door shuts behind' });
      out.checkpoints.push({ zone: i, at: [r3(c + wall + 1), r3(z)] });
      return { rect: [c, c + wR, zb, top], exit: [c + wR, z], lock: null };
    },
  };

  let s = 0, z = 0;
  M.zones.forEach((Z, i) => {
    const F = LAY[Z.kind === 'room' ? 'room' : Z.run](Z, i, s, z);
    out.zones.push({ i, kind: Z.kind, ...(Z.run ? { run: Z.run } : {}), rect: F.rect.map(r3), exit: F.exit.map(r3), lock: F.lock, ...(Z.teach ? { teach: Z.teach } : {}), ...(Z.beat ? { beat: Z.beat } : {}), ...(Z.climb ? { climb: Z.climb } : {}), ...(Z.drop ? { drop: Z.drop } : {}) });
    [s, z] = F.exit;
  });
  out.blocks = out.solids.map((r) => ({ min: [-HALF, r.s0, r.z0], max: [HALF, r.s1, r.z1], role: r.role }));
  return out;
}
