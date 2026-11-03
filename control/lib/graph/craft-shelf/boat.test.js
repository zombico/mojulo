// The boat parts on the craft shelf (boat-odm.js, boat-parts.js, boat-archetypes.js): every boat kind a builder and a
// row, each part the same twice; a hull drawn from its lines (its envelope its dims, its halves mirrored, its transom
// raked); its displacement from its own sections, so a boat floats at the waterline its weight sets; an outboard rigged
// with its plate at the keel, tilting, steering and turning its propeller about its own axes; a boat role filled by
// boats; a boat by the words people say, its build asleep, never a transformer's craft. A hull's variations, each on the
// hull that carries it: a flat bottom, a square bow, a sole, a collar that floats too; an outboard's leg at its size. A
// helm on the sole: a console and seats on the hull's points, a gunwale cap, the nav lights and the bow rail, a remote
// outboard. A motor well (the notch, the splashwell, the motor tilting into it) and a T-top over the helm. The cases are
// chosen from the shelf in code.
import { describe, it, expect } from 'vitest';
import { assembleCraft, resolveCraftPart, CRAFT_ODM, CRAFT_ARCHETYPES, CRAFT_ROLES, craftRoleAnalogues } from './index.js';
import { BOAT_KINDS, BOAT_ODM } from './boat-odm.js';
import { BOAT_ROLES } from './boat-archetypes.js';
import { hullLines, hullSection, hullVolume, hullFloat, curveAt } from './boat-parts.js';
import { lowerObjectFaces } from '../worlds/workbench.js';
import { resolveVehicle, handlesOf } from '../vehicle-registry/roster.js';
import { buildOf } from '../vehicle-registry/builds.js';
import { quickVehicleWords } from '../vehicle-registry/doors.js';
import { quickWorld } from '../gameworld/quick.js';

const A = CRAFT_ARCHETYPES;
const of = (kind) => Object.keys(BOAT_ODM).find((s) => BOAT_ODM[s].kind === kind);
const HULL = BOAT_ODM[of('boat-hull')];
// (a boat on the shelf driven by an outboard on its hull's transom)
const BOAT = Object.keys(A).find((k) => A[k].realm === 'water' && A[k].layout.some((e) => CRAFT_ODM[e.sku]?.kind === 'boat-outboard'));
const motorEntry = A[BOAT].layout.find((e) => CRAFT_ODM[e.sku].kind === 'boat-outboard');
const bounds = (faces) => {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const f of faces) for (const c of f.corners) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], c[k]); hi[k] = Math.max(hi[k], c[k]); }
  return { lo, hi };
};
const lathe = (src, id) => src.lathes.find((l) => l.id === id);
// (inside a hull's transom: between its raked faces, under its top, notched by a motor well across its middle)
const inTransom = (row) => {
  const H = hullLines(row), tanR = Math.tan(row.build.transom.rake * Math.PI / 180), Tt = row.build.transom.thickness, Wl = row.build.well;
  return (p) => { const ya = -H.L / 2 + (H.zT - p[2]) * tanR; return p[1] > ya && p[1] < ya + Tt && p[2] < (Wl && Math.abs(p[0]) < Wl.width / 2 ? Wl.notch : H.zT) && Math.abs(p[0]) < H.at(0).sheerHalf; };
};
const P = (p) => [p.x, p.y, p.z];

describe('the boat parts', () => {
  it('every boat kind on the shelf with a row, each building the same part twice', () => {
    for (const kind of Object.keys(BOAT_KINDS)) {
      const skus = Object.keys(BOAT_ODM).filter((s) => BOAT_ODM[s].kind === kind);
      expect(skus.length, kind).toBeGreaterThan(0);
      for (const sku of skus) {
        expect(CRAFT_ODM[sku], sku).toBe(BOAT_ODM[sku]);
        expect(JSON.stringify(resolveCraftPart(sku)), sku).toBe(JSON.stringify(resolveCraftPart(sku)));
      }
    }
  });
});

describe('a hull drawn from its lines', () => {
  const hull = resolveCraftPart(of('boat-hull'), { seat: 'mount' });
  const skin = bounds(lowerObjectFaces({ ...hull, extrudes: [], sweeps: [], lathes: [], lofts: hull.lofts.filter((l) => l.id === 'skin') }));
  it('its skin\'s envelope is its length, its beam and its depth at the bow', () => {
    const { length: L, beam: B } = HULL.dims, H = hullLines(HULL);
    expect(skin.hi[1] - skin.lo[1]).toBeCloseTo(L, 1);
    expect(skin.hi[0] - skin.lo[0]).toBeGreaterThan(B * 0.97);
    expect(skin.hi[0] - skin.lo[0]).toBeLessThan(B * 1.03);
    expect(skin.lo[2]).toBeCloseTo(0, 2);
    expect(skin.hi[2]).toBeCloseTo(H.at(1).sheer, 2);
  });
  it('its halves mirror each other, every section a starboard side and its port twin', () => {
    for (const s of [0.3, 0.7]) {
      const sec = hullSection(HULL, s), n = sec.length;
      for (let i = 0; i < n; i++) { expect(sec[n - 1 - i][0]).toBeCloseTo(-sec[i][0], 6); expect(sec[n - 1 - i][1]).toBeCloseTo(sec[i][1], 6); }
    }
  });
  it('its transom raked: the keel meets it forward of its top by its height times the rake', () => {
    const H = hullLines(HULL), foot = H.zT * Math.tan(HULL.build.transom.rake * Math.PI / 180) / H.L;
    // (aft of the foot the bottom is the transom's face, lifted off the keel; forward of it the keel is on z = 0)
    expect(Math.min(...hullSection(HULL, foot * 0.5).map((p) => p[1]))).toBeGreaterThan(0.05);
    expect(Math.min(...hullSection(HULL, foot * 1.2).map((p) => p[1]))).toBeCloseTo(0, 3);
    expect(hull.garage.hardpoints.motor[1]).toBeCloseTo(-H.L / 2, 3);
  });
  it('its benches sit inside it, under its sheer, each a seat named among its points', () => {
    const H = hullLines(HULL);
    for (const bn of HULL.build.benches) {
      const loft = hull.lofts.find((l) => l.id === `bench_${bn.name}`), b = bounds(lowerObjectFaces({ ...hull, extrudes: [], sweeps: [], lathes: [], lofts: [loft] }));
      const st = H.at(bn.at);
      expect(b.hi[0], bn.name).toBeLessThan(st.sheerHalf);
      expect(b.hi[2], bn.name).toBeLessThan(st.sheer);
      expect(hull.garage.hardpoints[bn.name][2], bn.name).toBeCloseTo(bn.top + 0.022, 3);
    }
  });
});

describe('its displacement: a boat floats at the waterline its weight sets', () => {
  it('displaces more the deeper it sits; the waterline it is bisected to displaces its weight', () => {
    expect(hullVolume(HULL, 0.2)).toBeGreaterThan(hullVolume(HULL, 0.1));
    expect(hullVolume(HULL, 0)).toBeLessThan(0.001);
    const kg = 300, f = hullFloat(HULL, kg);
    expect(Math.abs(hullVolume(HULL, f.draft) * 1000 / kg - 1)).toBeLessThan(0.01);
    expect(hullFloat(HULL, kg + 150).draft).toBeGreaterThan(f.draft);
    expect(hullFloat(HULL, kg, { rho: 1025 }).draft).toBeLessThan(f.draft);
    expect(f.freeboard).toBeCloseTo(hullLines(HULL).zT - f.draft, 2);
  });
  it('says when the load would put its sheer under water', () => {
    expect(hullFloat(HULL, 1e5)).toMatchObject({ swamped: true, freeboard: 0 });
  });
  it('the boat assembled: its parts and its payload displaced, its waterline in the manifest\'s frame', () => {
    const { manifest, readout } = assembleCraft(BOAT);
    const hull = manifest.items.find((i) => i.source.garage.kind === 'boat-hull');
    expect(readout.afloat.displacement).toBe(readout.partsMass + A[BOAT].payload);
    expect(readout.afloat.waterline).toBeCloseTo(hull.at[2] + readout.afloat.draft, 3);
    expect(readout.afloat.freeboard).toBeGreaterThan(0.15);
    expect(Math.abs(readout.afloat.draft / readout.reference.draft - 1)).toBeLessThan(0.1);
    expect(assembleCraft(BOAT, { water: 'salt' }).readout.afloat.draft).toBeLessThan(readout.afloat.draft);
    expect(() => assembleCraft(BOAT, { water: 'mud' })).toThrow(/fresh or salt/);
  });
});

describe('an outboard on the transom', () => {
  const { manifest, readout } = assembleCraft(BOAT);
  const item = manifest.items.find((i) => i.id === motorEntry.id), hull = manifest.items.find((i) => i.source.garage.kind === 'boat-hull');
  it('rigged with its anti-ventilation plate at the keel\'s height, its propeller under the water', () => {
    const plate = item.at[2] + item.source.garage.hardpoints.plate[2];
    expect(Math.abs(plate - hull.at[2])).toBeLessThan(0.06);
    expect(item.at[2] + item.source.garage.hardpoints.prop[2]).toBeLessThan(readout.afloat.waterline - 0.1);
  });
  it('tilts up about its tilt tube, steers about its swivel, its clamp staying on the transom', () => {
    const sku = motorEntry.sku, down = resolveCraftPart(sku, { seat: 'mount' });
    const up = resolveCraftPart(sku, { seat: 'mount', pose: { tilt: 1 } }), turned = resolveCraftPart(sku, { seat: 'mount', pose: { yaw: 1 } });
    expect(up.garage.hardpoints.prop[2]).toBeGreaterThan(down.garage.hardpoints.prop[2] + 0.3);
    expect(up.garage.hardpoints.prop[1]).toBeLessThan(down.garage.hardpoints.prop[1]);
    expect(P(lathe(up, 'tilt_tube').axisFrom)).toEqual(P(lathe(down, 'tilt_tube').axisFrom));
    // (yaw + the tiller to port and the propeller to starboard: the boat turns to starboard)
    expect(turned.garage.hardpoints.prop[0]).toBeGreaterThan(0.05);
    expect(P(lathe(turned, 'grip').axisTo)[0]).toBeLessThan(-0.05);
    expect(turned.garage.joints.find((j) => j.name === 'steer').angle).toBe(CRAFT_ODM[sku].build.steer);
  });
  it('tilted up, its tiller folded, it stays out of the boat: nothing that moves inside its transom or its aft bench', () => {
    const hull = resolveCraftPart(of('boat-hull'), { seat: 'mount' }), m = hull.garage.hardpoints.motor;
    const up = resolveCraftPart(motorEntry.sku, { seat: 'mount', pose: { tilt: 1 }, fold: 1 });
    // (the clamp bracket and its tilt tube wrap the transom by design: what tilts and steers is the rest)
    const still = /^(clamp|stern_bracket|tilt_tube)/, moving = Object.fromEntries(['lathes', 'extrudes', 'sweeps', 'lofts'].map((k) => [k, (up[k] || []).filter((x) => !still.test(x.id))]));
    const pts = lowerObjectFaces({ ...up, ...moving }).flatMap((f) => f.corners).map((p) => [p[0] + m[0], p[1] + m[1], p[2] + m[2]]);
    const { length: L } = HULL.dims, Tt = HULL.build.transom.thickness, aft = HULL.build.benches.reduce((a, b) => (b.at < a.at ? b : a));
    expect(pts.filter((p) => p[1] > -L / 2 && p[1] < -L / 2 + Tt && p[2] < m[2])).toEqual([]);
    const y0 = -L / 2 + aft.at * L;
    expect(pts.filter((p) => p[1] > y0 && p[1] < y0 + aft.depth && p[2] < aft.top + 0.022)).toEqual([]);
    expect(up.garage.joints.find((j) => j.name === 'tiller').angle).toBe(CRAFT_ODM[motorEntry.sku].build.fold.angle);
  });
  it('its propeller turns about its shaft, its hub staying put', () => {
    const sku = motorEntry.sku, a = resolveCraftPart(sku, { seat: 'mount' }), b = resolveCraftPart(sku, { seat: 'mount', pose: { prop: 40 } });
    expect(lathe(b, 'prop_hub')).toEqual(lathe(a, 'prop_hub'));
    expect(P(b.lofts.find((l) => l.id === 'blade_0').axisTo)).not.toEqual(P(a.lofts.find((l) => l.id === 'blade_0').axisTo));
    expect(b.garage.joints.find((j) => j.name === 'prop')).toMatchObject({ kind: 'spin', angle: 40 });
  });
});

describe('a hull\'s variations, each on the hull that carries it', () => {
  const hullWith = (test) => BOAT_ODM[Object.keys(BOAT_ODM).find((s) => BOAT_ODM[s].kind === 'boat-hull' && test(BOAT_ODM[s].build))];
  const built = (row) => resolveCraftPart(Object.keys(BOAT_ODM).find((s) => BOAT_ODM[s] === row), { seat: 'mount' });
  const facesOf = (src, kind, id) => lowerObjectFaces({ ...src, lathes: [], extrudes: [], sweeps: [], lofts: [], [kind]: src[kind].filter((m) => m.id === id) });
  it('a flat bottom: its chine at its keel\'s height, its section level across the bottom', () => {
    const row = hullWith((b) => Math.abs(curveAt(b.lines.chine, 0.4) - curveAt(b.lines.keel, 0.4)) < 0.02);
    const sec = hullSection(row, 0.4), mid = (sec.length - 1) / 2;
    for (const p of sec.slice(2, sec.length - 2)) expect(Math.abs(p[1] - sec[mid][1])).toBeLessThan(0.01);
  });
  it('a square bow: wide at the bow, its rail across it, its keel strip ending at its foot', () => {
    const row = hullWith((b) => b.bow === 'square'), src = built(row), H = hullLines(row);
    expect(H.at(1).sheerHalf).toBeGreaterThan(0.2);
    const cap = src.sweeps.find((w) => w.id === 'bow_cap');
    expect(cap.path[0][0]).toBeCloseTo(-cap.path[1][0], 6);
    expect(Math.max(...src.sweeps.find((w) => w.id === 'keel_strip').path.map((p) => p[2]))).toBeLessThan(H.at(1).keel);
  });
  it('a sole: its floor laid flat at its height the length of the boat, a tank standing on it', () => {
    const row = hullWith((b) => Number.isFinite(b.sole)), src = built(row), liner = src.lofts.find((l) => l.id === 'liner');
    // (a station's profile is [u, v], v the height: amidships, the floor's points on the sole)
    const mid = liner.stations.reduce((a, s) => (Math.abs(s.t - 0.5) < Math.abs(a.t - 0.5) ? s : a));
    expect(mid.profile.filter(([, v]) => Math.abs(v - row.build.sole) < 1e-3).length).toBeGreaterThan(3);
    expect(src.garage.hardpoints.tank[2]).toBeGreaterThanOrEqual(row.build.sole);
  });
  it('a collar: its tube outboard of the sheer, its cones aft of the transom, and it floats the boat too', () => {
    const row = hullWith((b) => b.collar), src = built(row), K = row.build.collar, H = hullLines(row);
    const tube = bounds(facesOf(src, 'sweeps', 'collar')), cones = bounds(facesOf(src, 'lathes', 'cone_r'));
    expect(tube.hi[0]).toBeGreaterThan(Math.max(...Array.from({ length: 21 }, (_, k) => H.at(k / 20).sheerHalf)) + K.radius);
    expect(cones.lo[1]).toBeLessThan(-H.L / 2 - K.radius);
    expect(src.sweeps.some((w) => w.id === 'gunwale_r')).toBe(false);
    // (under the tube's bottom only the hull floats; with the tube in the water it carries its share)
    const bare = { ...row, build: { ...row.build, collar: undefined } }, zTube = Math.min(...Array.from({ length: 21 }, (_, k) => H.at(k / 20).sheer)) + K.radius * (K.up ?? 0.15) - K.radius;
    expect(hullVolume(row, zTube - 0.02)).toBeCloseTo(hullVolume(bare, zTube - 0.02), 6);
    expect(hullVolume(row, zTube + 0.1)).toBeGreaterThan(hullVolume(bare, zTube + 0.1) * 1.1);
  });
  it('an outboard\'s leg at its size: a smaller motor\'s gearcase slimmer, its plate the same shaft below its clamp', () => {
    const skus = Object.keys(BOAT_ODM).filter((s) => BOAT_ODM[s].kind === 'boat-outboard'), lg = (s) => BOAT_ODM[s].build.leg ?? 1;
    const [big, small] = [skus.reduce((a, s) => (lg(s) > lg(a) ? s : a)), skus.reduce((a, s) => (lg(s) < lg(a) ? s : a))];
    expect(lg(small)).toBeLessThan(lg(big));
    const r = (s) => Math.max(...lathe(resolveCraftPart(s, { seat: 'mount' }), 'torpedo').profile.map((p) => p.radius));
    expect(r(small) / r(big)).toBeCloseTo(lg(small) / lg(big), 1);
    const plate = (s) => resolveCraftPart(s, { seat: 'mount' }).garage.hardpoints.plate[2];
    expect(plate(small)).toBeCloseTo(-BOAT_ODM[small].build.shaft, 3);
    expect(plate(big)).toBeCloseTo(-BOAT_ODM[big].build.shaft, 3);
  });
});

describe('a helm on the sole', () => {
  // (a boat whose layout stands a console on its hull's points)
  const CC = Object.keys(A).find((k) => A[k].realm === 'water' && A[k].layout.some((e) => CRAFT_ODM[e.sku]?.kind === 'boat-console'));
  const { manifest } = assembleCraft(CC), hullItem = manifest.items[0], HROW = CRAFT_ODM[hullItem.source.garage.sku], H = hullLines(HROW);
  it('its console and seats each on the sole, inside the cockpit, the wheel at a standing helmsman\'s hands', () => {
    for (const e of A[CC].layout.filter((x) => ['boat-console', 'boat-seat'].includes(CRAFT_ODM[x.sku].kind))) {
      const it = manifest.items.find((i) => i.id === e.id), s = (it.at[1] - hullItem.at[1] + H.L / 2) / H.L;
      expect(it.at[2] - hullItem.at[2], e.id).toBeCloseTo(HROW.build.sole, 3);
      const b = bounds(lowerObjectFaces(it.source));
      expect(b.hi[0], e.id).toBeLessThan(H.at(s).sheerHalf);
    }
    const con = manifest.items.find((i) => CRAFT_ODM[i.source.garage.sku].kind === 'boat-console'), w = con.source.garage.hardpoints.wheel;
    expect(w[2]).toBeGreaterThan(0.85);
    expect(w[2]).toBeLessThan(1.15);
    expect(w[1]).toBeLessThan(0);
  });
  it('its gunwale a cap: the liner\'s top pulled inboard by the cap, level with the sheer', () => {
    const liner = resolveCraftPart(hullItem.source.garage.sku, { seat: 'mount' }).lofts.find((l) => l.id === 'liner');
    const st = liner.stations.reduce((a, x) => (Math.abs(x.t - 0.5) < Math.abs(a.t - 0.5) ? x : a)), at = H.at(st.t);
    // (a station's profile is [u, v]: u across, v the height)
    const top = st.profile.filter(([, v]) => Math.abs(v - at.sheer) < 0.01).map(([u]) => Math.abs(u));
    expect(Math.min(...top)).toBeCloseTo(at.sheerHalf - HROW.build.skin - HROW.build.liner - HROW.build.cap, 1);
  });
  it('its sidelights green to starboard and red to port, its bow rail round ahead of the stem', () => {
    const src = resolveCraftPart(hullItem.source.garage.sku, { seat: 'mount' }), l = (id) => src.lathes.find((x) => x.id === id);
    const hue = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const [r, l2] = [hue(l('sidelight_r').tint), hue(l('sidelight_l').tint)];
    expect(r[1]).toBeGreaterThan(r[0]);
    expect(l2[0]).toBeGreaterThan(l2[1]);
    expect(P(l('sidelight_r').axisFrom)[0]).toBeGreaterThan(0);
    const rail = src.sweeps.find((x) => x.id === 'bow_rail').path, nose = rail[(rail.length - 1) / 2];
    expect(nose[0]).toBeCloseTo(0, 6);
    expect(nose[1]).toBeGreaterThan(H.at(0.96).y);
  });
  it('its outboard remote: no tiller, its rigging into the boat and its steering ram, clear of the transom tilted up', () => {
    const sku = Object.keys(BOAT_ODM).find((x) => BOAT_ODM[x].build.family === 'remote'), m = resolveCraftPart(sku, { seat: 'mount' });
    const ids = [...m.lathes, ...m.sweeps, ...m.extrudes].map((x) => x.id);
    expect(ids).not.toContain('tiller');
    expect(ids).not.toContain('shift');
    expect(ids).toEqual(expect.arrayContaining(['rigging', 'steering_ram']));
    expect(m.garage.joints.map((j) => j.name)).toEqual(['tilt', 'steer', 'prop']);
    const motor = manifest.items.find((i) => i.source.garage.kind === 'boat-outboard'), hm = resolveCraftPart(hullItem.source.garage.sku, { seat: 'mount' }).garage.hardpoints.motor;
    const up = resolveCraftPart(motor.source.garage.sku, { seat: 'mount', pose: { tilt: 1 } });
    const still = /^(clamp|stern_bracket|tilt_tube|transom_bolt|steering_ram|ram_rod|rigging)/;
    const moving = Object.fromEntries(['lathes', 'extrudes', 'sweeps', 'lofts'].map((k) => [k, (up[k] || []).filter((x) => !still.test(x.id))]));
    const pts = lowerObjectFaces({ ...up, ...moving }).flatMap((f) => f.corners).map((p) => [p[0] + hm[0], p[1] + hm[1], p[2] + hm[2]]);
    const Tt = HROW.build.transom.thickness;
    expect(pts.filter(inTransom(HROW))).toEqual([]);
    // (what hangs in over the transom stays over the floor under it)
    const inside = pts.filter((p) => p[1] > -H.L / 2 + Tt + 0.05);
    // (over a motor well's floor, or the sole where there is none)
    expect(Math.min(...inside.map((p) => p[2]))).toBeGreaterThan(HROW.build.well ? HROW.build.well.floor + 0.03 : HROW.build.sole + 0.3);
  });
});

describe('a motor well, and a top over the helm', () => {
  const WELL = Object.keys(BOAT_ODM).find((x) => BOAT_ODM[x].kind === 'boat-hull' && BOAT_ODM[x].build.well), HW = BOAT_ODM[WELL], Wl = HW.build.well;
  const hullW = resolveCraftPart(WELL, { seat: 'mount' }), H = hullLines(HW);
  const skinFaces = lowerObjectFaces({ ...hullW, lathes: [], extrudes: [], sweeps: [], lofts: hullW.lofts.filter((l) => l.id === 'skin') });
  // (a boat whose motor stands in the well)
  const WB = Object.keys(A).find((k) => A[k].realm === 'water' && A[k].layout[0].sku === WELL && A[k].layout.some((e) => CRAFT_ODM[e.sku]?.kind === 'boat-outboard'));
  it('its transom notched to the motor\'s height across its width, the quarters standing full height', () => {
    const aft = skinFaces.flatMap((f) => f.corners).filter((c) => c[1] < -H.L / 2 + 0.03);
    const inNotch = aft.filter((c) => Math.abs(c[0]) < Wl.width / 2 - 0.05), quarters = aft.filter((c) => Math.abs(c[0]) > Wl.width / 2 + 0.1);
    expect(Math.max(...inNotch.map((c) => c[2]))).toBeLessThan(Wl.notch + 0.005);
    expect(Math.max(...quarters.map((c) => c[2]))).toBeGreaterThan(H.zT - 0.01);
    expect(hullW.garage.hardpoints.motor[2]).toBeGreaterThan(Wl.notch);
    expect(hullW.garage.hardpoints.motor[2]).toBeLessThan(Wl.notch + 0.03);
  });
  it('its splashwell: the liner\'s floor at the well\'s height aft of its bulkhead, the cockpit\'s sole forward of it', () => {
    const liner = hullW.lofts.find((l) => l.id === 'liner'), at = (s) => liner.stations.reduce((a, x) => (Math.abs(x.t - s) < Math.abs(a.t - s) ? x : a));
    // (a liner station's ring is the skin's inside, then the liner's inside back: its second half)
    const lowest = (st) => Math.min(...st.profile.slice(st.profile.length / 2).map(([, v]) => v));
    expect(lowest(at(Wl.length / H.L * 0.6))).toBeCloseTo(Wl.floor, 2);
    expect(lowest(at(Wl.length / H.L + 0.05))).toBeCloseTo(HW.build.sole, 2);
    expect(hullW.lofts.some((l) => l.id === 'well_bulkhead')).toBe(true);
  });
  it('its freeboard measured at the notch; the motor on its shaft, its plate at the keel; tilted up, in the well and out of the transom', () => {
    expect(hullFloat(HW, 900).freeboard).toBeCloseTo(Wl.notch - hullFloat(HW, 900).draft, 3);
    const { manifest } = assembleCraft(WB), motor = manifest.items.find((i) => i.source.garage.kind === 'boat-outboard'), h = manifest.items[0];
    expect(Math.abs(motor.at[2] + motor.source.garage.hardpoints.plate[2] - h.at[2])).toBeLessThan(0.05);
    const m = hullW.garage.hardpoints.motor, up = resolveCraftPart(motor.source.garage.sku, { seat: 'mount', pose: { tilt: 1 } });
    const still = /^(clamp|stern_bracket|tilt_tube|transom_bolt|steering_ram|ram_rod|rigging)/;
    const moving = Object.fromEntries(['lathes', 'extrudes', 'sweeps', 'lofts'].map((k) => [k, (up[k] || []).filter((x) => !still.test(x.id))]));
    const pts = lowerObjectFaces({ ...up, ...moving }).flatMap((f) => f.corners).map((p) => [p[0] + m[0], p[1] + m[1], p[2] + m[2]]);
    // (the transom's block between its raked faces, notched; the bulkhead across the well's forward end)
    expect(pts.filter(inTransom(HW))).toEqual([]);
    const yb = -H.L / 2 + Wl.length;
    expect(pts.filter((p) => p[1] > yb - 0.01 && p[1] < yb + 0.06 && p[2] < Wl.top)).toEqual([]);
  });
  it('a T-top: its feet on the sole beside the console, its hardtop over the helm with a standing helmsman\'s headroom', () => {
    const TB = Object.keys(A).find((k) => A[k].realm === 'water' && A[k].layout.some((e) => CRAFT_ODM[e.sku]?.kind === 'boat-top'));
    const { manifest } = assembleCraft(TB), top = manifest.items.find((i) => i.source.garage.kind === 'boat-top'), con = manifest.items.find((i) => i.source.garage.kind === 'boat-console');
    const hRow = CRAFT_ODM[manifest.items[0].source.garage.sku], TR = CRAFT_ODM[top.source.garage.sku];
    expect(top.at[2] - manifest.items[0].at[2]).toBeCloseTo(hRow.build.sole, 3);
    expect(TR.build.legs.x - 0.024).toBeGreaterThan(CRAFT_ODM[con.source.garage.sku].dims.width / 2 + CRAFT_ODM[con.source.garage.sku].build.rail.out + 0.02);
    const hard = bounds(lowerObjectFaces({ ...top.source, lathes: [], sweeps: [], extrudes: [], lofts: top.source.lofts.filter((l) => l.id === 'hardtop') }));
    expect(hard.lo[2] - con.source.garage.hardpoints.wheel[2]).toBeGreaterThan(0.85);
    // (over the helm: its back edge aft of the wheel)
    expect(hard.lo[1]).toBeLessThan(con.source.garage.hardpoints.wheel[1] - 0.5);
  });
  it('its all-round light moved from the hull\'s pole to the top', () => {
    const TB = Object.keys(A).find((k) => A[k].realm === 'water' && A[k].layout.some((e) => CRAFT_ODM[e.sku]?.kind === 'boat-top'));
    const { manifest } = assembleCraft(TB), ids = (i) => i.source.lathes.map((l) => l.id);
    expect(ids(manifest.items[0])).not.toContain('all_round_light');
    expect(ids(manifest.items.find((i) => i.source.garage.kind === 'boat-top'))).toContain('all_round_light');
  });
});

describe('on the roster and among the roles', () => {
  it('every boat role is filled by boats', () => {
    for (const role of Object.keys(BOAT_ROLES)) {
      expect(CRAFT_ROLES[role].realms).toEqual(['water']);
      expect(craftRoleAnalogues(role).water.length, role).toBeGreaterThan(0);
    }
  });
  it('a boat by the words people say; its build on the shelf asleep until a door draws it', () => {
    const hit = resolveVehicle('skiff');
    expect(handlesOf(hit.id).craft).toEqual([BOAT]);
    expect(buildOf(hit.id, 'realistic')).toMatchObject({ tier: 'realistic', build: { via: 'craft', key: BOAT, status: 'asleep' } });
  });
  it('is never a transformer\'s craft: it does not fly', () => {
    const { quick } = quickVehicleWords({ goal: 'fly', transformer: { vehicle: { craft: 'skiff' } } });
    expect(quick.transformer.vehicle.craft).toBe(BOAT);
    for (const craft of ['skiff', BOAT]) expect(() => quickWorld({ quick: { goal: 'fly', transformer: { vehicle: { craft } } } }), craft).toThrow(/is a boat on the craft shelf/);
  });
});
