import { describe, it, expect } from 'vitest';
import { assembleStageScene, planStage, buildStageGeometry, STAGE_KITS } from './stage.js';
import { labDress, placeFaces, buildThings } from './lab-dress.js';
import { makeDirt } from './dirt.js';
import { hexRgb } from './geom.js';
import { RESEARCH_LAB } from './style/research-lab.js';
import { labTexture, LAB_KEYS } from './lab-tiles.js';

// the research lab (kit `research-lab`, reference `doom3`): machine checks for the style card's principles
const LAB = { kind: 'stage', reference: 'doom3', kit: 'research-lab', rooms: [{ id: 'lab', x: 0, y: 0, w: 16, d: 24, h: 9 }] };
const lab = assembleStageScene(LAB), plan = planStage(LAB), geom = buildStageGeometry(plan), dress = labDress(plan, geom);
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const values = (g) => lab.faces.filter((f) => f.group === g && f.cornerFills).flatMap((f) => f.cornerFills.map((h) => lum(hexRgb(h))));
const centroid = (f) => f.corners.reduce((s, p) => [s[0] + p[0] / f.corners.length, s[1] + p[1] / f.corners.length, s[2] + p[2] / f.corners.length], [0, 0, 0]);
const r = plan.rooms[0], C = [(r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2];
const P = RESEARCH_LAB.principles;

describe('the research lab', () => {
  it('its tiles paint, and a lab is a closed room with no night', () => {
    for (const k of LAB_KEYS) expect(labTexture(k)).toMatch(/^data:image\/png;base64,/);
    expect(STAGE_KITS['research-lab'].shell).toBe('lab');
    expect(() => assembleStageScene({ ...LAB, time: 'night' })).toThrow(/no night/);
  });

  it(P[0], () => {
    const floor = mean(values('stage:floor')), wall = mean(values('stage:wall')), roof = mean(values('stage:ceiling'));
    expect(floor).toBeGreaterThan(wall * 1.1);
    expect(wall).toBeGreaterThan(roof);
    // the roof's structure shows: trusses, ducts and a cable tray between the walls' top and the deck
    const high = lab.faces.filter((f) => ['stage:trim', 'stage:duct', 'stage:cable'].includes(f.group) && centroid(f)[2] > r.h - 2.5);
    expect(high.length).toBeGreaterThan(200);
    // and stuff between the floor and the walls: a skirting, a kick band
    expect(lab.faces.some((f) => f.group === 'stage:skirt')).toBe(true);
    expect(lab.faces.some((f) => f.group === 'stage:kick')).toBe(true);
  });

  it(P[1], () => {
    const liquid = lab.faces.filter((f) => f.group === 'stage:liquid');
    expect(liquid.length).toBeGreaterThan(0);
    const c = mean(liquid.map((f) => centroid(f)[0])), d = mean(liquid.map((f) => centroid(f)[1]));
    expect(c).toBeCloseTo(C[0], 3); expect(d).toBeCloseTo(C[1], 3);
    expect(liquid.every((f) => f.emissive)).toBe(true);
    // the trenches run out toward three walls, never across the way in (the portal's side, -y)
    const grates = lab.faces.filter((f) => f.group === 'stage:grate' && f.texture === 'lab:grate').map(centroid);
    expect(grates.some((p) => p[0] > r.x1 - 1.5)).toBe(true);
    expect(grates.some((p) => p[0] < r.x0 + 1.5)).toBe(true);
    expect(grates.some((p) => p[1] > r.y1 - 1.5)).toBe(true);
    expect(grates.some((p) => p[1] < C[1] - 3)).toBe(false);
    // the cables lie on the dais and the grating, never floating: every cable box sits on the dais' steps or the floor
    const cables = dress.faces.filter((f) => f.group === 'stage:cable');
    expect(Math.min(...cables.flatMap((f) => f.corners.map((p) => p[2])))).toBeGreaterThanOrEqual(0);
  });

  it(P[2], () => {
    const troffers = geom.seats.filter((s) => s.fixture === 'troffer');
    expect(troffers.length).toBe(STAGE_KITS['research-lab'].lab.troffer.rows.length * Math.round((r.y1 - r.y0) / STAGE_KITS['research-lab'].bay));
    // the troffers' light is near-neutral (a cool white); the colour comes from the tank and the screens
    for (const t of troffers) { const c = hexRgb(t.color); expect(Math.max(...c) - Math.min(...c)).toBeLessThan(0.15); }
    const tank = dress.pools.find((l) => l.fixture === 'tank'), tc = hexRgb(tank.color);
    expect(tc[1] - tc[0]).toBeGreaterThan(0.3);
    expect(dress.pools.filter((l) => l.fixture === 'screen').length).toBeGreaterThan(3);
    // a pool under a troffer: the floor right under one is brighter than the floor at the walls
    const floor = lab.faces.filter((f) => f.group === 'stage:floor' && f.cornerFills).flatMap((f) => f.corners.map((p, i) => [p, lum(hexRgb(f.cornerFills[i]))]));
    const under = floor.filter(([p]) => troffers.some((t) => Math.hypot(p[0] - t.at[0], p[1] - t.at[1]) < 0.8)).map(([, v]) => v);
    const edge = floor.filter(([p]) => Math.min(p[0] - r.x0, r.x1 - p[0], p[1] - r.y0, r.y1 - p[1]) < 0.3).map(([, v]) => v);
    expect(mean(under)).toBeGreaterThan(mean(edge) * 1.2);
  });

  it(P[3], () => {
    const benches = dress.things.filter((t) => t.kind === 'bench');
    expect(benches.length).toBe(8);
    // neighbours along a lane (each lane is one long wall) never carry the same things
    const lanes = new Map(); for (const b of benches) { const k = Math.round(b.at[0]); (lanes.get(k) || lanes.set(k, []).get(k)).push(b); }
    for (const lane of lanes.values()) {
      lane.sort((a, b) => a.at[1] - b.at[1]);
      for (let i = 0; i + 1 < lane.length; i++) expect(lane[i].dress).not.toBe(lane[i + 1].dress);
    }
    // every thing is a record first: built from it, and a record moved moves its faces (what decay will do)
    const one = benches[0], moved = { ...one, at: [one.at[0] + 1, one.at[1], 0] };
    const a = buildThings([one], RESEARCH_LAB), b = buildThings([moved], RESEARCH_LAB);
    expect(b.length).toBe(a.length);
    expect(b[0].corners[0][0]).toBeCloseTo(a[0].corners[0][0] + 1, 5);
    expect(placeFaces([{ corners: [[0, 1, 0]], normal: [0, 1, 0] }], [0, 0, 0], Math.PI / 2)[0].normal).toEqual([-1, 0, 0]);
  });

  it(P[4], () => {
    // the dirt by cause: the walk line from the door to the tank is worn lighter, the floor's edge darker
    const dirt = makeDirt(plan, geom.seats);
    const at = (x, y) => dirt({ group: 'stage:floor', normal: [0, 0, 1] }, [x, y, 0])[0];
    expect(at(C[0], r.y0 + 4)).toBeGreaterThan(at(r.x0 + 0.1, r.y0 + 4));
    // and the skirting is a dark rubber: the darkest thing at the wall's foot
    expect(mean(values('stage:skirt'))).toBeLessThan(mean(values('stage:kick')));
  });

  it('a door end can stand in the blast door', () => {
    const withDoor = assembleStageScene({ ...LAB, doors: [{ id: 'airlock', at: { portal: true }, to: { map: 'nave', door: 'west' } }] });
    expect(withDoor.doors[0].id).toBe('airlock');
    expect(withDoor.doors[0].sill[1]).toBeCloseTo(r.y0, 1);
  });
});
