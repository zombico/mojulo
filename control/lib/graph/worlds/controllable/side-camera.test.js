import { describe, expect, it } from 'vitest';
import { createWorld, stepWorld } from '@/lib/graph/worlds/controllable-world';

// THE SIDE CAMERA on a platformer's course (rules-basic.js side `band`, `ends`): its height eased while the hero stands,
// so a stair's risers do not jolt the frame, and the frame held in from the lane's ends, so it never looks past them.
// Absent both, the camera follows the hero's height and centres it everywhere, as it did.

const DT = 1 / 60;
const LANE = Array.from({ length: 41 }, (_, i) => [0, i]);
// a flight of stairs from y = 4: a 0.22 m riser every 0.4 m, ten of them, level beyond (the ground the page's probe reads
// off the course's treads)
const STAIRS = { ground: ([, y]) => (y < 4 ? 0 : 0.22 * Math.min(10, Math.floor((y - 4) / 0.4) + 1)) };
const mk = (cam = {}, at = [0, 1, 0]) => createWorld({
  entities: [{ id: 'h', pilotable: true, rule: { type: 'platform', eye: 0, speed: 6, lane: LANE }, transform: { pos: at, heading: Math.PI / 2 } }],
  camera: { rule: 'side', target: 'h', ...cam },
});
const run = (w, n, input = { forward: 1 }) => {
  const out = [];
  for (let f = 0; f < n; f++) { stepWorld(w, input, DT, STAIRS); out.push({ hero: w.byId.h.transform.pos[2], look: w.camera.lookAt[2], cam: w.camera.transform.pos[2] }); }
  return out;
};
const biggest = (s, k) => s.slice(1).reduce((m, x, i) => Math.max(m, Math.abs(x[k] - s[i][k])), 0);

describe('the band: the stairs do not jolt the frame', () => {
  it('the hero climbs the risers; its look eases up them, the frame never jumping a riser', () => {
    const w = mk({ band: [1, 2] });
    run(w, 60, {});                                                    // the camera settles on the hero standing
    const s = run(w, 150);
    expect(s[s.length - 1].hero).toBeGreaterThan(2);                  // it climbed the flight
    expect(biggest(s, 'hero')).toBeGreaterThan(0.2);                  // a riser at a time
    expect(biggest(s, 'look')).toBeLessThan(0.06);                     // the look eased
    expect(biggest(s, 'cam')).toBeLessThan(0.06);
    run(w, 120, {});                                                   // standing at the top, the frame settles on it
    expect(w.camera.lookAt[2] - w.byId.h.transform.pos[2]).toBeCloseTo(1.2, 1);
  });
  it('absent: the look follows each riser as the hero takes it', () => {
    const s = run(mk(), 150);
    expect(biggest(s, 'look')).toBeGreaterThan(0.2);
  });
});

describe('the ends: the frame holds in from the lane\'s ends', () => {
  it('at the start the hero stands left of centre; in the middle it is centred; near the end, right of it', () => {
    const w = mk({ ends: 5.5 });
    run(w, 60, {});
    expect(w.camera.lookAt[1]).toBeCloseTo(5.5, 3);
    expect(w.byId.h.transform.pos[1]).toBeLessThan(5.5);
    w.byId.h.transform.pos = [0, 20, 2.2];
    run(w, 60, {});
    expect(w.camera.lookAt[1]).toBeCloseTo(w.byId.h.transform.pos[1], 3);
    w.byId.h.transform.pos = [0, 38, 2.2];
    run(w, 60, {});
    expect(w.camera.lookAt[1]).toBeCloseTo(40 - 5.5, 3);
  });
  it('absent: the hero is centred at the lane\'s start', () => {
    const w = mk();
    run(w, 60, {});
    expect(w.camera.lookAt[1]).toBeCloseTo(w.byId.h.transform.pos[1], 3);
  });
});
