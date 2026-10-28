// The stand: the bowl's section swept along a straight. One class per procedure (two tiers under a canopy behind glass,
// one covered tier, an open bank), chosen from the classes by their words, and the concepts: the words read and refused,
// the section's depth and its eye, every face four corners at most and wound to its side, the ends closed, the crowd's
// share, determinism; in a local area, the stand on its zone and the debris fence seen through, the voxel pole's block
// kept, and no word the block as before.
import { describe, it, expect } from 'vitest';
import { STAND_CLASSES, readStands, standFaces, paintStand } from './stand.js';
import { STADIUM_CROWD } from './stadium-words.js';
import { planTrack } from '../roads/track.js';
import { COURSE_PRESETS } from '../roads/course.js';
import { planTrackscape } from '../roads/trackscape.js';
import { planArena } from '../roads/arena-plan.js';
import { buildLocalAreas } from '../roads/local-area.js';
import { trackKit } from '../roads/track-kit.js';
import { SWATCH_KITS } from '../era/style/swatches.js';
import { poleOf } from '../era/style/pole.js';

const cls = (want) => Object.keys(STAND_CLASSES).find((c) => want(STAND_CLASSES[c]));
const TWO = cls((S) => S.rows.length === 2), COVERED = cls((S) => S.rows.length === 1 && S.roof === 'canopy'), OPEN = cls((S) => S.roof === 'none');
const run = (S, seed = 3) => standFaces(S, { from: [0, 0], to: [40, 0], out: [0, 1], z: 2, seed });

describe('the stand', () => {
  it('reads its words over the class\'s and refuses teaching', () => {
    expect(readStands(undefined)).toBe(null);
    expect(readStands('block')).toBe(null);
    expect(readStands('bowl', TWO)).toEqual({ ...STAND_CLASSES[TWO] });
    expect(readStands({ roof: 'none', crowd: 0.2 }, TWO)).toMatchObject({ roof: 'none', crowd: 0.2, rows: STAND_CLASSES[TWO].rows });
    expect(() => readStands({ rows: [40] })).toThrow(/rows is/);
    expect(() => readStands({ roof: 'dome' })).toThrow(/roof is none or canopy/);
    expect(() => readStands({ tiers: 2 })).toThrow(/has no 'tiers'/);
    expect(() => readStands('stadium')).toThrow(/'block'.*'bowl'/);
  });
  it('rises away from the track: on its pad, its depth along `out`, its eye up the last tier, quads wound to their side', () => {
    for (const c of [TWO, COVERED, OPEN]) {
      const S = readStands('bowl', c), st = run(S);
      expect(st.box.lo[2], c).toBeCloseTo(2, 3);
      expect(st.box.lo[1], c).toBeGreaterThanOrEqual(-0.01);
      expect(st.box.hi[1], c).toBeCloseTo(st.depth, 1);
      expect(st.eye, c).toBeGreaterThan(2 + 1.1);
      expect(st.eye, c).toBeLessThan(2 + st.top + 1.3);
      for (const f of st.faces) {
        expect(f.corners.length).toBeLessThanOrEqual(4);
        // the front's faces turn to the track (−y) or up, never away and down
        if (f.tint && f.corners.every((p) => p[1] < 0.01)) expect(f.normal[1]).toBeLessThan(0);
      }
      // a tread is level and faces up
      const treads = st.faces.filter((f) => f.tint && f.corners.every((p) => Math.abs(p[2] - f.corners[0][2]) < 1e-6));
      expect(treads.length, c).toBeGreaterThan(0);
      for (const f of treads) expect(f.normal[2]).toBeGreaterThan(0.99);
    }
  });
  it('stands a canopy and a facade where its words say, an upper tier over glass boxes, closed at both ends', () => {
    const two = run(readStands('bowl', TWO)), open = run(readStands('bowl', OPEN));
    expect(two.roofZ).not.toBe(null);
    expect(open.roofZ).toBe(null);
    expect(two.faces.some((f) => f.card)).toBe(STAND_CLASSES[TWO].facade !== 'none');
    expect(open.faces.some((f) => f.card)).toBe(false);
    // the ends: faces in the planes x = 0 and x = 40, facing out along the stand
    for (const x of [0, 40]) {
      const cap = two.faces.filter((f) => f.corners.every((p) => Math.abs(p[0] - x) < 1e-6));
      expect(cap.length).toBeGreaterThan(STAND_CLASSES[TWO].rows.reduce((a, b) => a + b, 0) / 2);
      for (const f of cap) expect(Math.sign(f.normal[0])).toBe(x ? 1 : -1);
    }
    // the screen is alight; none without one
    expect(two.faces.some((f) => f.glow)).toBe(!!STAND_CLASSES[TWO].screens);
    expect(open.faces.some((f) => f.glow)).toBe(false);
  });
  it('takes its crowd\'s share of the seats, none for an empty house; the same words are the same stand', () => {
    const shirts = new Set(STADIUM_CROWD.map((c) => c.toLowerCase()));
    const share = (crowd) => { const t = run({ ...readStands('bowl', COVERED), crowd }).faces.filter((f) => f.tint && f.normal[2] > 0.99); return t.filter((f) => shirts.has(f.tint.toLowerCase())).length / t.length; };
    expect(share(0)).toBe(0);
    expect(share(0.8)).toBeGreaterThan(0.5);
    expect(JSON.stringify(run(readStands('bowl', TWO)))).toBe(JSON.stringify(run(readStands('bowl', TWO))));
    expect(JSON.stringify(run(readStands('bowl', TWO), 4).faces)).not.toBe(JSON.stringify(run(readStands('bowl', TWO), 3).faces));
  });
  it('paints in the kit: the tints lit, the screen alight, the back wall its card', () => {
    const K = trackKit(SWATCH_KITS.find((k) => poleOf(k) === 'banded')), st = run(readStands('bowl', TWO)), P = paintStand(st.faces, K);
    for (const f of P) { expect(f.fill).toMatch(/^#[0-9a-f]{6}$/); expect(f.corners.length).toBeLessThanOrEqual(4); }
    expect(P.filter((f) => f.glow).length).toBe(st.faces.filter((f) => f.glow).length);
    expect(P.filter((f) => f.card).length).toBe(st.faces.filter((f) => f.card).length);
  });
});

describe('a stand in its local area', () => {
  // one lap (the first closed preset), its class's stand
  const LAP = Object.keys(COURSE_PRESETS).find((k) => { const c = COURSE_PRESETS[k](); return c.alignment?.closed ?? c.closed; });
  const plan = planTrack({ form: 'circuit', course: LAP }), scape = planTrackscape(plan), arena = planArena(plan, { scape });
  const banded = trackKit(SWATCH_KITS.find((k) => poleOf(k) === 'banded')), stands = readStands('bowl', plan.course.class);
  const stand = (L) => L.areas.filter((a) => a.use === 'grandstand');
  it('builds every stand zone in the stadium\'s section, on its footprint, off the road, the fence before it seen through', () => {
    const L = buildLocalAreas(plan, arena, { K: banded, seed: 4, stands });
    expect(stand(L).length).toBeGreaterThan(0);
    for (const a of stand(L)) { expect(a.laws, a.zone).toEqual([]); expect(a.passes.elements).toBeGreaterThan(0); }
    const mesh = stand(L).flatMap((a) => L.byZone[a.zone]).filter((f) => f.group === 'stand:mesh');
    expect(mesh.length).toBeGreaterThan(0);
    for (const f of mesh) expect(f.alpha).toBeLessThan(1);
    expect(L.things.filter((t) => t.kind === 'grandstand' && t.interest === 'focus').length).toBe(stand(L).length);
    expect(L.colliders.some((c) => c.of.startsWith('local:stand'))).toBe(true);
  }, 60000);
  it('keeps the block on the voxel pole and without the word, every other zone unmoved', () => {
    const voxel = trackKit({ id: SWATCH_KITS.find((k) => poleOf(k) === 'banded'), pole: 'voxel' });
    expect(JSON.stringify(buildLocalAreas(plan, arena, { K: voxel, seed: 4, stands }).faces)).toBe(JSON.stringify(buildLocalAreas(plan, arena, { K: voxel, seed: 4 }).faces));
    const asked = buildLocalAreas(plan, arena, { K: banded, seed: 4, stands }), plain = buildLocalAreas(plan, arena, { K: banded, seed: 4, stands: null });
    for (const z of arena.zones) if (z.use !== 'grandstand') expect(JSON.stringify(asked.byZone[z.id]), z.id).toBe(JSON.stringify(plain.byZone[z.id]));
    for (const a of stand(plain)) expect(JSON.stringify(asked.byZone[a.zone])).not.toBe(JSON.stringify(plain.byZone[a.zone]));
  }, 120000);
});
