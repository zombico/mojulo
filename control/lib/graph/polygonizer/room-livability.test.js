/**
 * Room livability — the machine gate for the comfortable-defaults pass over the two
 * residential planners (the floorplan house and the condo complex). Each test measures one
 * invariant a walk camera or a viewer would feel: seats face what they serve, rooms and units
 * clear a real short side, circulation clears a person, the walker is person-sized.
 * The eyes gate (does it LOOK livable) is the operator's, not this file's.
 */
import { describe, expect, it } from 'vitest';

import { furnishElements, orientElementsToDoor, generatePlan, generateProgramPlan } from './floorplan-glyphs.js';
import { doorWallOf, structurizeFloorplan, assembleFloorWorldScene, STAIR_DEFAULTS, FLOORPLAN_DEFAULTS } from './floorplan-structure.js';
import { extractRoomSceneFaces } from '../scene/scene-css3d.js';
import { unitSlots, MIN_UNIT_PITCH } from '../architecture/condo-entrance.js';
import { assembleFractalCondoScene, planFractalCondoComplex, CONDO_WALK } from '../architecture/fractal-condo.js';

const SEATS = new Set(['ladder-chair', 'armchair', 'sofa']);
const HOSTS = new Set(['table', 'dining-table']);

// A seat's occupant faces AWAY from its backrest: the backrest is the seat's tallest geometry,
// so the facing is (footprint centre − centroid of the top 20% of its vertices).
function seatFacing(el, basis) {
  const { faces } = extractRoomSceneFaces({ elements: [el], roomBasis: basis, includeShell: false });
  let zMax = 0;
  for (const f of faces) for (const c of f.corners) zMax = Math.max(zMax, c[2]);
  let ax = 0, ay = 0, an = 0, tx = 0, ty = 0, tn = 0;
  for (const f of faces) {
    for (const c of f.corners) {
      ax += c[0]; ay += c[1]; an += 1;
      if (c[2] > zMax * 0.8) { tx += c[0]; ty += c[1]; tn += 1; }
    }
  }
  const cx = ax / an, cy = ay / an;
  return { c: [cx, cy], face: [cx - tx / tn, cy - ty / tn] };
}

function seatsFaceTheirTable(glyph, W, H, door, scale) {
  const quarter = door === 'E' || door === 'W';
  const [cw, ch] = quarter ? [H, W] : [W, H];
  let els = furnishElements(glyph, 3, { w: cw, h: ch, scale });
  if (door) els = orientElementsToDoor(els, door, W, H, { assetFacing: scale === 'share', canonical: [cw, ch] });
  const basis = { worldExtent: { width: W, depth: H, height: 9 }, xRange: [0, W], yRange: [0, H], zRange: [0, 9] };
  const host = els.find((e) => HOSTS.has(e.type));
  const hc = [host.anchor[0] * W, host.anchor[1] * H];
  return els.filter((e) => SEATS.has(e.type)).map((e) => {
    const { c, face } = seatFacing(e, basis);
    const to = [hc[0] - c[0], hc[1] - c[1]];
    return (face[0] * to[0] + face[1] * to[1]) / (Math.hypot(...face) * Math.hypot(...to));
  });
}

describe('seats face what they serve', () => {
  // the lounge's couch is a mesh asset in every mode; share mode swaps the armchairs to meshes too
  for (const scale of ['feet', 'share']) {
    for (const door of [null, 'N', 'E', 'W']) {
      it(`lounge (${scale}, door ${door || 'S'}) — sofa and armchairs face the coffee table`, () => {
        const dots = seatsFaceTheirTable('L', 14, 16, door, scale);
        expect(dots.length).toBeGreaterThanOrEqual(3);
        for (const d of dots) expect(d).toBeGreaterThan(0.7);
      });
    }
  }
  // dining chairs are real meshes in share mode (the box-net ladder chair is symmetric)
  for (const door of [null, 'N', 'E', 'W']) {
    it(`dining (share, door ${door || 'S'}) — every chair faces the table`, () => {
      const dots = seatsFaceTheirTable('D', 13, 15, door, 'share');
      expect(dots.length).toBeGreaterThanOrEqual(2);
      for (const d of dots) expect(d).toBeGreaterThan(0.7);
    });
  }
});

describe('dining pull-out clearance', () => {
  it('an end chair is only seated where 2.5 ft stays clear behind it', () => {
    for (const [w, h] of [[10, 12], [12, 12], [14, 14], [16, 14]]) {
      const els = furnishElements('D', 1, { w, h });
      const table = els.find((e) => e.type === 'dining-table');
      const tW = table.w * w;
      const ends = els.filter((e) => e.type === 'ladder-chair' && Math.abs(e.anchor[1] - 0.5) < 1e-9);
      if ((w - tW) / 2 < 1.1 + 0.8 + 2.5) expect(ends).toHaveLength(0);
      for (const c of ends) expect(Math.min(c.anchor[0], 1 - c.anchor[0]) * w - (c.w * w) / 2).toBeGreaterThanOrEqual(2.5 - 1e-9);
    }
  });
});

describe('room and corridor sizes', () => {
  it('a generated house never cuts a room under 10 ft (3.05 m) on its short side', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      for (const r of generatePlan(seed).rooms) expect(Math.min(r.w, r.h)).toBeGreaterThanOrEqual(10 - 1e-9);
    }
  });
  it('the lounge takes the public room that clears 12 ft (3.66 m) when one does', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const rooms = generatePlan(seed).rooms;
      const wideD = rooms.some((r) => r.glyph === 'D' && Math.min(r.w, r.h) >= 12);
      for (const l of rooms.filter((r) => r.glyph === 'L')) if (wideD) expect(Math.min(l.w, l.h)).toBeGreaterThanOrEqual(12);
    }
  });
  it('program-plan circulation halls are at least 4.5 ft (1.37 m) clear', () => {
    for (let seed = 1; seed <= 12; seed += 1) {
      for (const role of ['ground', 'upper']) {
        const p = generateProgramPlan(seed, { width: 48, height: 36, role, hasUpper: role === 'upper' });
        for (const h of p.halls) expect(Math.min(h.w, h.h)).toBeGreaterThanOrEqual(4.5 - 1e-9);
      }
    }
  });
  it('the house stair is 3.5 ft (1.07 m) wide and doors keep a 3 ft (0.91 m) approach', () => {
    expect(STAIR_DEFAULTS.width).toBeGreaterThanOrEqual(3.5);
    expect(FLOORPLAN_DEFAULTS.doorWidth).toBeGreaterThanOrEqual(3);
    expect(FLOORPLAN_DEFAULTS.doorClearance).toBeGreaterThanOrEqual(3);
  });
});

describe('command position reads the door off the geometry', () => {
  it('doorWallOf names the wall a door point sits on', () => {
    const room = { x: 10, y: 20, w: 12, h: 14 };
    expect(doorWallOf(room, { x: 16, y: 20 })).toBe('N');
    expect(doorWallOf(room, { x: 16, y: 34 })).toBe('S');
    expect(doorWallOf(room, { x: 10, y: 27 })).toBe('W');
    expect(doorWallOf(room, { x: 22, y: 27 })).toBe('E');
    expect(doorWallOf(room, { x: 40, y: 27 })).toBeNull();
  });
});

describe('door leaves swing into rooms', () => {
  it('no interior leaf stands open in a hall', () => {
    let checked = 0;
    for (let seed = 1; seed <= 6; seed += 1) {
      const p = generateProgramPlan(seed, { width: 48, height: 36, role: 'upper', hasUpper: true });
      const s = structurizeFloorplan({ rooms: p.rooms, halls: p.halls, doors: p.doors, width: 48, height: 36 }, {});
      for (const run of s.wallGraph.runs) {
        for (const op of run.openings) {
          if (op.exterior || op.kind !== 'hinged' || op.sill > 0) continue;
          const sgn = op.doorSwing === '-' ? -1 : 1, mid = (op.a + op.b) / 2;
          const px = run.orientation === 'v' ? run.at + sgn * 1.5 : mid, py = run.orientation === 'v' ? mid : run.at + sgn * 1.5;
          const cell = s.cells.find((c) => px > c.x && px < c.x + c.w && py > c.y && py < c.y + c.h);
          expect(cell && cell.kind).toBe('room');
          checked += 1;
        }
      }
    }
    expect(checked).toBeGreaterThan(6);
  });
});

describe('the walker is person-sized', () => {
  it('the house walk carries a fixed human half-width', () => {
    const w = assembleFloorWorldScene({ seed: 1 }, { walk: true }).walk;
    expect(w.radius).toBeGreaterThan(0.5);
    expect(w.radius).toBeLessThan(1.2);
  });
  it('the condo walk does not derive its body from the complex bound', () => {
    const w = assembleFractalCondoScene({ seed: 1, floors: 1, structure: false }).walk;
    expect(w.radius).toBe(CONDO_WALK.radius);
    expect(w.speed).toBe(CONDO_WALK.speed);
  });
});

describe('condo units', () => {
  it('units keep >= MIN_UNIT_PITCH of frontage, so shells never overlap and stay >= ~16 ft wide', () => {
    for (let len = 30; len <= 70; len += 4) {
      for (const perSide of [1, 2, 3]) {
        const { slots, sfW } = unitSlots({ axis: 'x', along0: 0, along1: len, crossMid: 0, hallHalf: 5, unitDepth: 12, backDepth: 12, unitsPerSide: perSide });
        const centers = [...new Set(slots.map((s) => s.alongCenter))].sort((a, b) => a - b);
        const uw = sfW + 4;
        for (let i = 1; i < centers.length; i += 1) expect(centers[i] - centers[i - 1]).toBeGreaterThanOrEqual(uw - 1e-9);
        if (len - 6 >= MIN_UNIT_PITCH) expect(uw).toBeGreaterThanOrEqual(0.66 * MIN_UNIT_PITCH + 4 - 1e-9);
      }
    }
  });
  it('every default unit storefront carries an entry doorway (a walker can get in)', () => {
    const plan = planFractalCondoComplex({ seed: 1 });
    const c = plan.concourses[0];
    const { slots } = unitSlots({ ...c.hall, unitDepth: plan.units.depth, backDepth: plan.units.backDepth, unitsPerSide: plan.units.perSide, sides: c.sides });
    const { faces } = assembleFractalCondoScene({ seed: 1, floors: 1, structure: false });
    for (const s of slots) {
      // the doorway: a 3 ft span of the storefront line, floor to door head, with no glass in it
      const a1 = s.alongCenter + s.sfW / 2 - 0.2, a0 = a1 - 3;
      const blocking = faces.filter((f) => f.corners.every((p) => {
        const al = c.hall.axis === 'x' ? p[0] : p[1], cr = c.hall.axis === 'x' ? p[1] : p[0];
        return al > a0 + 0.3 && al < a1 - 0.3 && Math.abs(cr - s.cInner) < 0.2 && p[2] > 0.5 && p[2] < 6;
      }));
      expect(blocking).toHaveLength(0);
    }
  });
});

describe('the default house still furnishes every lounge with its sofa', () => {
  it('seed 1: the lounge keeps its couch clear of the door approach', () => {
    const s = structurizeFloorplan({ seed: 1 }, { furnish: true });
    expect(s.faces.some((f) => typeof f.group === 'string' && f.group.startsWith('asset:modern-couch'))).toBe(true);
  });
});
