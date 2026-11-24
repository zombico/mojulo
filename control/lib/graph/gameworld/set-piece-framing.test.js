// THE FRAMING GATE: every frame a set piece's camera directs, the hero is seen. Each kind's level is run on the bus (its
// site's blocks as the colliders and the ground, a bot that runs the line and jumps its gaps), and each frame the track
// camera holds the hero it is asked: is the camera outside every block, is there no block between it and the hero's
// chest, is the hero inside the frame (30° of the look), and is it neither in the lens (1.6 m) nor lost (18 m). The
// machine gate's: the eyes gate is the operator's.
import { describe, it, expect } from 'vitest';
import { composeLive } from '../worlds/controllable/compose.js';
import { stuntLevel } from './stunt-room.js';
import { SET_PIECE_KIND_IDS } from './set-piece-kinds.js';

const CW = composeLive();
const DT = 1 / 60;
const GAPS = { 'rooftop-run': [17], collapse: [45.2], climb: [39.4] };

// the ray from a to b meets the box (the slab test), its ends trimmed by `trim` metres
function blocks(a, b, box, trim = 0.25) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.hypot(...d);
  if (L < 2 * trim) return false;
  let t0 = trim / L, t1 = 1 - trim / L;
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-9) { if (a[i] < box.min[i] || a[i] > box.max[i]) return false; continue; }
    let u = (box.min[i] - a[i]) / d[i], v = (box.max[i] - a[i]) / d[i];
    if (u > v) [u, v] = [v, u];
    t0 = Math.max(t0, u); t1 = Math.min(t1, v);
    if (t0 > t1) return false;
  }
  return true;
}
const inside = (p, box, m = 0.15) => p.every((v, i) => v > box.min[i] + m && v < box.max[i] - m);

export function framingOf(kind) {
  const S = stuntLevel({ id: 'g', feel: 'lost-nomad' }, { spec: { kind }, cast: 'stand-in' }), M = S.manifest;
  const boxes = M.colliders;
  const tops = [...boxes, ...(M.breakables ?? [])];
  const ground = (p) => { let z = 0; for (const b of tops) if (p[0] >= b.min[0] && p[0] <= b.max[0] && p[1] >= b.min[1] && p[1] <= b.max[1] && b.max[2] <= p[2] + 0.6 && b.max[2] > z) z = b.max[2]; return z; };
  const w = CW.createWorld({ entities: M.entities.filter((e) => e.pilotable), camera: M.camera, colliders: boxes, chase: M.chase });
  w.pilotId = 'hero';
  const h = w.byId.hero, jumps = GAPS[kind], out = { frames: 0, insideBlock: 0, blocked: 0, outOfFrame: 0, tooClose: 0, tooFar: 0, worst: [] };
  let jumpT = -1;
  for (let i = 0; i < 60 * 60 && !w.chase.done.length; i++) {
    const jump = w.chase.on && jumps.some((j) => w.chase.s > j - 0.6 && w.chase.s < j + 0.3) && h.grounded !== false && i - jumpT > 30;
    if (jump) jumpT = i;
    CW.stepWorld(w, { forward: 1, strafe: 0, boost: 1, jump: jump ? 1 : 0, jumpHeld: i - jumpT < 8 ? 1 : 0 }, DT, { ground });
    const C = w.camera;
    if (!w.chase.on || !C.track || i < 30) continue;
    out.frames++;
    const cp = C.transform.pos, chest = [h.transform.pos[0], h.transform.pos[1], h.transform.pos[2] + 1.2];
    const look = C.lookAt, lv = [look[0] - cp[0], look[1] - cp[1], look[2] - cp[2]], hv = [chest[0] - cp[0], chest[1] - cp[1], chest[2] - cp[2]];
    const cos = (lv[0] * hv[0] + lv[1] * hv[1] + lv[2] * hv[2]) / (Math.hypot(...lv) * Math.hypot(...hv));
    const a = boxes.some((b) => inside(cp, b)), bl = !a && boxes.some((b) => blocks(cp, chest, b)), off = cos < Math.cos((30 * Math.PI) / 180);
    const dist = Math.hypot(...hv), near = dist < 1.6, far = dist > 18;
    if (a) out.insideBlock++; if (bl) out.blocked++; if (off) out.outOfFrame++; if (near) out.tooClose++; if (far) out.tooFar++;
    if ((a || bl || off || near || far) && out.worst.length < 6) out.worst.push({ s: +w.chase.s.toFixed(1), key: C.track.key, inside: a, blocked: bl, off, dist: +dist.toFixed(1) });
  }
  out.done = w.chase.done.slice();
  return out;
}

describe('a set piece\'s camera sees its hero', () => {
  for (const kind of SET_PIECE_KIND_IDS) {
    it(`${kind}: never inside a block, never behind one, the hero in frame, neither in the lens nor lost`, () => {
      const F = framingOf(kind);
      expect(F.frames, kind).toBeGreaterThan(200);
      expect({ insideBlock: F.insideBlock, blocked: F.blocked, outOfFrame: F.outOfFrame, tooClose: F.tooClose, tooFar: F.tooFar, worst: F.worst }).toEqual({ insideBlock: 0, blocked: 0, outOfFrame: 0, tooClose: 0, tooFar: 0, worst: [] });
    });
  }
});
