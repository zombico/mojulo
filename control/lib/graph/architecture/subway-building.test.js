import { describe, expect, it } from 'vitest';

import { stackSubway, assembleSubwayBuildingScene, assessSubwayFlow, buildEscalator, buildFareBarrier, SUBWAY_HALL } from './subway-building.js';
import { makeLight } from '../polygonizer/vexar.js';
import { buildInfoKiosk, buildTicketMachine, buildWallMap, buildPoster, concourseAssetFaces } from './subway-concourse-assets.js';
import { buildTrainset } from './subway-trainset.js';
import { planSubwayStation } from './subway-station.js';

// The subway as a stacked building view: two levels (platform hall + mezzanine)
// over one circulation void. These assert the STACK reads — heights line up, the
// void exists, the circulation bridges both levels — not the per-face detailing.

const zRange = (faces) => {
  let zMin = Infinity, zMax = -Infinity;
  for (const f of faces) for (const c of f.corners) { if (c[2] < zMin) zMin = c[2]; if (c[2] > zMax) zMax = c[2]; }
  return { zMin, zMax };
};

describe('stackSubway', () => {
  it('stacks two levels with the mezzanine floor above the platform ceiling', () => {
    const s = stackSubway({ seed: 7, line: 'blue' });
    expect(s.levels).toHaveLength(2);
    expect(s.levels[0].kind).toBe('platform');
    expect(s.levels[1].kind).toBe('mezzanine');
    // mezzanine floor lands above the platform ceiling (zCeil), via meru's slab drop
    expect(s.levels[1].baseZ).toBeGreaterThan(SUBWAY_HALL.zCeil);
    expect(s.stats.mezzZ).toBe(s.levels[1].baseZ);
  });

  it('punches a void over the island and runs circulation through it', () => {
    const s = stackSubway({ seed: 1 });
    expect(s.voidRect).toMatchObject({ x0: 6, x1: 14 });
    expect(s.circulation.faces.length).toBeGreaterThan(0);
    // the real switchback stair spans platform → mezzanine
    expect(s.circulation.stair).toBeTruthy();
    const { zMin, zMax } = zRange(s.circulation.faces);
    expect(zMin).toBeLessThanOrEqual(SUBWAY_HALL.zPlat + 0.5);
    expect(zMax).toBeGreaterThan(SUBWAY_HALL.zCeil);
  });

  it('excludes platform columns inside the void (no pillar/stair collision)', () => {
    const full = planSubwayStation({ seed: 1 }).stats.columns;        // bare station: all columns
    const s = stackSubway({ seed: 1 });
    expect(s.stats.station.columns).toBeLessThan(full);               // void columns dropped
    expect(s.stats.station.columns).toBe(planSubwayStation({ seed: 1, columnExclude: s.voidRect }).stats.columns);
  });

  it('keeps the stair footprint clear of the escalators (no shared spot)', () => {
    const s = stackSubway({ seed: 1 });
    const slot = s.circulation.stair.slot;          // the stair's plan rect
    const escDown = s.flow.climb.escDown;           // the nearest (east) escalator
    // the stair must sit entirely EAST of the down-escalator, with a gap
    expect(slot.x0).toBeGreaterThanOrEqual(escDown.x1);
    // and within the void
    expect(slot.x1).toBeLessThanOrEqual(s.voidRect.x1);
  });

  it('is deterministic by seed', () => {
    const a = stackSubway({ seed: 42, line: 'red', density: 0.7 });
    const b = stackSubway({ seed: 42, line: 'red', density: 0.7 });
    expect(a.stats.faces).toBe(b.stats.faces);
    expect(JSON.stringify(a.faces)).toBe(JSON.stringify(b.faces));
  });

  it('honours the fare-gate count', () => {
    expect(stackSubway({ mezzanine: { gates: 3 } }).stats.gates).toBe(3);
    expect(stackSubway({ mezzanine: { gates: 99 } }).stats.gates).toBe(8); // clamped
  });
});

describe('subway flow ("feng shui" paths)', () => {
  it('a coherent default layout passes every flow check', () => {
    const s = stackSubway({ seed: 7 });
    expect(s.assessment.impairment).toBe(false);
    expect(s.assessment.necessary).toHaveLength(0);
    expect(s.stats.flow.faults).toHaveLength(0);
  });

  it('flags the axial-through-shot when the street mouth sits on the descent axis', () => {
    const s = stackSubway({ seed: 7 });
    const poisonArrow = { ...s.flow, street: { ...s.flow.street, x: s.flow.cx } };
    const a = assessSubwayFlow(poisonArrow);
    expect(a.impairment).toBe(true);
    expect(a.necessary.join(' ')).toMatch(/axial-through-shot/);
  });

  it('places the street mouth off the descent axis by default', () => {
    const s = stackSubway({ seed: 7 });
    expect(Math.abs(s.flow.street.x - s.flow.cx)).toBeGreaterThan(2);
  });
});

describe('buildTrainset', () => {
  const light = makeLight({ direction: [0.2, 0.3, -0.9], ambient: 0.6, diffuse: 0.4 });
  it('builds a multi-car consist with a hero car', () => {
    const t = buildTrainset({ yStart: 2, yEnd: 45, light });
    expect(t.cars).toBeGreaterThan(2);
    expect(t.faces.length).toBeGreaterThan(0);
    expect(t.hero).toBeGreaterThanOrEqual(0);
    expect(t.hero).toBeLessThan(t.cars);
  });
  it('honours the requested hero car index', () => {
    expect(buildTrainset({ heroIndex: 1, light }).hero).toBe(1);
  });
});

describe('fare barrier (path to the stairs fully gated)', () => {
  const light = makeLight({ direction: [0.2, 0.3, -0.9], ambient: 0.6, diffuse: 0.4 });
  const fp = { x0: SUBWAY_HALL.x0, x1: SUBWAY_HALL.x1, y0: SUBWAY_HALL.y0, y1: SUBWAY_HALL.y1 };

  it('spans the full concourse width — no walk-around gap to the stairs', () => {
    const { faces } = buildFareBarrier({ fp, y: 30, z: 6, band: '#2f6fb0', light, turnstiles: 5 });
    // project every barrier face onto x and assert the union covers wall→wall with no
    // gap wider than a single turnstile lane (~0.6 m). Gaps that DO exist are the gates.
    const spans = faces.map((f) => { const xs = f.corners.map((c) => c[0]); return [Math.min(...xs), Math.max(...xs)]; })
      .sort((a, b) => a[0] - b[0]);
    let covered = fp.x0, maxGap = 0;
    for (const [a, b] of spans) {
      if (a > covered) maxGap = Math.max(maxGap, a - covered);
      covered = Math.max(covered, b);
    }
    maxGap = Math.max(maxGap, fp.x1 - covered);
    expect(covered).toBeGreaterThanOrEqual(fp.x1 - 0.05);   // reaches the far wall
    expect(maxGap).toBeLessThan(0.7);                       // widest gap is one gated lane
  });

  it('returns a booth spot on the line', () => {
    const { boothCenterX } = buildFareBarrier({ fp, y: 30, z: 6, band: '#2f6fb0', light, turnstiles: 5 });
    expect(boothCenterX).toBeGreaterThan(fp.x0);
    expect(boothCenterX).toBeLessThan(fp.x1);
  });
});

describe('buildEscalator (the new kernel)', () => {
  it('emits an inclined truss that spans the given rise', () => {
    const faces = buildEscalator({ x0: 8, x1: 9.6, yBot: 9, yTop: 20, zBot: 0, zTop: 6, dir: 'up', light: makeLight({ direction: [0.2, 0.3, -0.9], ambient: 0.6, diffuse: 0.4 }) });
    expect(faces.length).toBeGreaterThan(0);
    const { zMin, zMax } = zRange(faces);
    expect(zMin).toBeLessThanOrEqual(0);
    expect(zMax).toBeGreaterThanOrEqual(6);
  });
});

describe('concourse doodads (workbench-built)', () => {
  it('builders return workbench manifests in meters', () => {
    const m = buildInfoKiosk({ x: 0, y: 0, z: 0, facing: 'S' });
    expect(m.kind).toBe('workbench');
    expect(m.units).toBe('m');
    expect(m.extrudes.length).toBeGreaterThan(3);   // base + posts + glazing + counter + roof + sign
  });

  it('bakes placed doodads into world faces under a light', () => {
    const faces = concourseAssetFaces(
      [{ build: buildTicketMachine, x: 2, y: 3, z: 6, facing: 'W' }],
      makeLight({ direction: [0.2, 0.3, -0.9], ambient: 0.6, diffuse: 0.4 }),
    );
    expect(faces.length).toBeGreaterThan(0);
    expect(faces[0].corners).toBeTruthy();
  });

  it('wall furnishings (map + poster) are workbench manifests', () => {
    const map = buildWallMap({ x: 19, y: 24, z: 7, facing: 'W' });
    expect(map.kind).toBe('workbench');
    expect(map.extrudes.length).toBeGreaterThan(4);   // frame + backing + 2 routes + dots
    expect(buildPoster({ x: 19, y: 40, z: 7, facing: 'W' }).extrudes.length).toBe(2);
  });

  it('the mezzanine carries the doodads (more faces than the bare plate)', () => {
    const s = stackSubway({ seed: 5 });
    const mezz = s.levels[1].faces.length;
    expect(mezz).toBeGreaterThan(120);   // slab + walls + gates + pylon + the doodad set
  });
});

describe('assembleSubwayBuildingScene', () => {
  it('emits a navigable World payload with cameras and walk spawn', () => {
    const scene = assembleSubwayBuildingScene({ seed: 3 });
    expect(scene.faces.length).toBeGreaterThan(0);
    expect(scene.cameras.length).toBeGreaterThanOrEqual(1);
    expect(scene.walk).toBeTruthy();
    expect(scene.title).toBe('mojulo subway');
  });

  it('lays soft contact/AO shadow decals (tunnel + grounded objects)', () => {
    const s = assembleSubwayBuildingScene({ seed: 7 });
    const shadows = s.faces.filter((f) => f.decal === 'shadow');
    expect(shadows.length).toBeGreaterThanOrEqual(20);                // troughs + columns + benches + train + doodads
    // some sit down in the trough recess (below the platform datum)…
    expect(shadows.some((f) => f.corners.every((c) => c[2] < SUBWAY_HALL.zPlat))).toBe(true);
    // …and some ground objects up on the concourse (above the platform)
    expect(shadows.some((f) => f.corners.every((c) => c[2] > SUBWAY_HALL.zCeil))).toBe(true);
    expect(shadows.every((f) => f.shadowAlpha > 0 && f.shadowAlpha <= 0.6)).toBe(true);
  });

  it('attaches surface textures (tiled pillars + marble floor) to the payload', () => {
    const scene = assembleSubwayBuildingScene({ seed: 7 });
    expect(Object.keys(scene.textures)).toEqual(expect.arrayContaining(['tile-white', 'marble-carrara', 'tile-subway']));
    expect(scene.textures['marble-carrara']).toMatch(/^data:image\/png;base64,/);
    // the textured faces carry uv + the textureLit flag the World multiplies
    const textured = scene.faces.filter((f) => f.texture);
    expect(textured.length).toBeGreaterThan(20);
    expect(textured.every((f) => f.textureLit && Array.isArray(f.uv) && f.uv.length === 4)).toBe(true);
  });

  it('atmospheric mode is opt-in and off by default', () => {
    const plain = assembleSubwayBuildingScene({ seed: 7 });
    expect(plain.faces.some((f) => f.shadowDecal)).toBe(false);   // no traced cast shadows
    expect(plain.bg).toBe('#0c0e12');
  });

  it('atmosphere:true bakes traced cast shadows on BOTH levels + a dark bg', () => {
    const s = assembleSubwayBuildingScene({ seed: 7, atmosphere: true });
    const cast = s.faces.filter((f) => f.shadowDecal);
    expect(cast.length).toBeGreaterThan(20);                       // per-tile cast shadows (floor tessellated)
    expect(s.bg).toBe('#06060a');
    const zs = cast.flatMap((f) => f.corners.map((c) => c[2]));
    expect(Math.min(...zs)).toBeLessThan(SUBWAY_HALL.zPlat + 1);   // shadows on the platform
    expect(Math.max(...zs)).toBeGreaterThan(SUBWAY_HALL.zCeil);    // …and up on the concourse
  });

  it('explode lifts the mezzanine above its flush position', () => {
    const flush = assembleSubwayBuildingScene({ seed: 3 }, { explode: 0 });
    const blown = assembleSubwayBuildingScene({ seed: 3 }, { explode: 12 });
    expect(zRange(blown.faces).zMax).toBeGreaterThan(zRange(flush.faces).zMax + 10);
  });
});
