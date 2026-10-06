import { describe, it, expect } from 'vitest';
import { planScad, loadOpenscad, mechPrelude, persistedScadLedger, renderScad2d, renderScadParts } from './scad-render.js';
import { MECH_LIB_SOURCE, MECH_LIB_VERSION, usesMechLib } from './mech-lib.js';

const hasWasm = await loadOpenscad() != null;
const wasm = hasWasm ? it : it.skip;

// An intersection that OpenSCAD reports as an empty top level is a FIT: the two parts share no volume.
const fits = async (source) => {
  try { await planScad({ source }); return false; } catch (e) { if (/makes no geometry/.test(e.message)) return true; throw e; }
};

describe('mech-lib — the trigger', () => {
  it('prepends only for a source (or a part statement) that calls an mj_ name', () => {
    expect(usesMechLib('mj_bolt("M3", 10);')).toBe(true);
    expect(usesMechLib('translate([0,0,1]) mj_nut("M3");')).toBe(true);
    expect(usesMechLib('my_mj_bolt(); cube(1);')).toBe(false);
    expect(mechPrelude('cube(1);')).toBe('');
    expect(mechPrelude('// mj_bolt in a comment\ncube(1);')).toBe('');
    expect(mechPrelude('module a() cube(1);', { a: 'a(); mj_nut("M3");' })).toBe(`${MECH_LIB_SOURCE}\n`);
  });
  it('the library defines only mj_-prefixed names, so it cannot shadow a recipe module', () => {
    const names = [...MECH_LIB_SOURCE.matchAll(/^\s*(?:module|function)\s+([A-Za-z_][A-Za-z0-9_]*)/gm)].map((m) => m[1]);
    expect(names.length).toBeGreaterThan(20);
    expect(names.filter((n) => !n.startsWith('mj_'))).toEqual([]);
  });
  it('the persisted ledger carries the library version only when it was used', () => {
    expect(persistedScadLedger({ recipe_bytes: 1, faces: 2, closed: true, openscad: 'v' })).toEqual({ recipe_bytes: 1, faces: 2, closed: true, openscad: 'v' });
    expect(persistedScadLedger({ recipe_bytes: 1, faces: 2, closed: true, openscad: 'v', mechlib: MECH_LIB_VERSION }).mechlib).toBe(MECH_LIB_VERSION);
  });
});

describe('mech-lib — parts that work (skipped when the WASM is not installed)', () => {
  wasm('a source without mj_ is untouched: no mechlib in the ledger', async () => {
    const { stats } = await planScad({ source: 'cube(10);' });
    expect(stats.ledger.mechlib).toBeUndefined();
  });
  wasm('an ISO M8 thread is a closed manifold at true size, and the ledger names the library', async () => {
    const { stats } = await planScad({ source: 'mj_thread("M8", 12);' });
    expect(stats.size).toEqual({ w: 8, d: 8, h: 12 });
    expect(stats.ledger.closed).toBe(true);
    expect(stats.ledger.mechlib).toBe(MECH_LIB_VERSION);
    expect(stats.warnings).toBeUndefined();
  });
  wasm('the nut threads onto the bolt in phase, and collides half a pitch out of it', async () => {
    expect(await fits('intersection(){ mj_thread("M8", 20, chamfer=false); translate([0,0,6]) mj_nut("M8"); }')).toBe(true);
    expect(await fits('intersection(){ mj_thread("M8", 20, chamfer=false); translate([0,0,6.625]) mj_nut("M8"); }')).toBe(false);
  });
  wasm('a spur pair meshes at the computed centre distance and collides 0.4 mm closer', async () => {
    const pair = (dx) => `intersection(){ mj_spur_gear(2, 17, 6); translate([mj_gear_center(2,17,30)${dx},0,0]) rotate(180/30) mj_spur_gear(2, 30, 6); }`;
    expect(await fits(pair(''))).toBe(true);
    expect(await fits(pair('-0.4'))).toBe(false);
  });
  wasm('a planetary set assembles clean, and an unassemblable one is refused by name', async () => {
    expect(await fits('intersection(){ mj_planetary(1,12,15,3,8,parts="planets"); union(){ mj_planetary(1,12,15,3,8,parts="sun"); mj_planetary(1,12,15,3,8,parts="ring"); } }')).toBe(true);
    await expect(planScad({ source: 'mj_planetary(1, 20, 20, 3, 8);' })).rejects.toThrow(/sun \+ ring\) % n == 0/);
  });
  wasm('bolt heads stand on the floor at the ISO sizes', async () => {
    const { stats } = await planScad({ source: 'mj_bolt("M4", 16, "socket");' });
    expect(stats.size).toEqual({ w: 7, d: 7, h: 20 });
    expect(stats.warnings).toBeUndefined();
  });
}, 120000);

describe('mech-lib — silent failures are said (skipped when the WASM is not installed)', () => {
  wasm('text() with no fonts in the build is a warning, not a quiet blank', async () => {
    const { stats } = await planScad({ source: 'cube([40,10,2]); translate([2,2,2]) linear_extrude(1) text("A", size=5);' });
    expect(stats.warnings.join(' ')).toMatch(/text\(\) rendered NOTHING/);
  });
  wasm('a non-manifold polyhedron that OpenSCAD takes apart is a warning', async () => {
    // the industrial study's first bottle cap: a hand-wound thread ridge whose ends do not close
    const src = `$fn=48; module ridge(r, p, turns, w, dp){ n=turns*36;
      pts=[for(i=[0:n]) let(a=i*10, z=i*p/36) each [[r*cos(a), r*sin(a), z], [(r-dp)*cos(a),(r-dp)*sin(a), z+w*0.25], [(r-dp)*cos(a),(r-dp)*sin(a), z+w*0.75], [r*cos(a), r*sin(a), z+w]]];
      faces=concat([[0,1,2,3]], [[4*n+3,4*n+2,4*n+1,4*n]], [for(i=[0:n-1], k=[0:3]) [4*i+k, 4*i+(k+1)%4, 4*(i+1)+(k+1)%4, 4*(i+1)+k]]);
      polyhedron(pts, faces); }
      difference(){ cylinder(d=32, h=14); translate([0,0,1.6]) cylinder(d=28, h=14); } translate([0,0,2.6]) ridge(14.01, 3, 3, 1.2, 1.2);`;
    const { stats: { warnings = [] } } = await planScad({ source: src });
    expect(warnings.join(' ')).toMatch(/not a closed 2-manifold/);
  });
}, 60000);

// v2 — the controls matter as much as the fits: each assembly nudged out of place must collide, so a
// CLEAN is a fit and not two parts that never met.
const collides = async (source) => !(await fits(source));

describe('mech-lib v2 — standards fit what they mount (skipped when the WASM is not installed)', () => {
  wasm('a NEMA 17 motor seats in its mount plate, and collides 1 mm off centre', async () => {
    const plate = 'difference(){ translate([-25,-25,0]) cube([50,50,5]); translate([0,0,5]) mj_nema_mount(17, 6); }';
    expect(await fits(`intersection(){ ${plate} mj_nema_motor(17, 40); }`)).toBe(true);
    expect(await collides(`intersection(){ ${plate} translate([1,0,0]) mj_nema_motor(17, 40); }`)).toBe(true);
  });
  wasm('a 608 sits in its seat; an oversize ring does not', async () => {
    const seat = 'difference(){ translate([-15,-15,0]) cube([30,30,10]); translate([0,0,10]) mj_bearing_seat("608", through=4); }';
    expect(await fits(`intersection(){ ${seat} translate([0,0,3]) mj_bearing("608"); }`)).toBe(true);
    expect(await collides(`intersection(){ ${seat} translate([0,0,3]) cylinder(d=22.3,h=7,$fn=64); }`)).toBe(true);
  });
  wasm('a keyed hub slides onto its keyed shaft (DIN 6885)', async () => {
    expect(await fits('intersection(){ difference(){ cylinder(d=30,h=12,$fn=64); translate([0,0,12]) mj_keyway_hub(12.5, 12); } difference(){ translate([0,0,-5]) cylinder(d=12.5,h=22,$fn=64); mj_keyway_shaft(12.5, 20); } }')).toBe(true);
  });
  wasm('the standards render closed at their nominal sizes', async () => {
    const size = async (src) => (await planScad({ source: src })).stats.size;
    expect(await size('mj_tslot(20, 50);')).toEqual({ w: 20, d: 20, h: 50 });
    expect(await size('mj_gridfinity_bin(2, 1, 3, magnets=true);')).toEqual({ w: 83.5, d: 41.5, h: 21 });
    expect(await size('cube([85,56,1.6]); mj_board_standoffs("rpi4", 5);')).toEqual({ w: 85, d: 56, h: 5 });
    await expect(planScad({ source: 'mj_nema_mount(18, 5);' })).rejects.toThrow(/one of 11 14 17 23/);
    await expect(planScad({ source: 'mj_keyway_shaft(70, 5);' })).rejects.toThrow(/DIN 6885/);
  });
}, 120000);

describe('mech-lib v2 — composition (skipped when the WASM is not installed)', () => {
  wasm('mj_gear_meshed meshes at any angle and tooth count, and collides when turned half a tooth', async () => {
    for (const [z1, z2, a] of [[20, 13, 0], [20, 13, 70], [15, 22, 33], [15, 22, 200]]) {
      expect(await fits(`intersection(){ mj_spur_gear(1, ${z1}, 5); mj_gear_meshed(1, ${z1}, ${z2}, ${a}) mj_spur_gear(1, ${z2}, 5); }`)).toBe(true);
    }
    expect(await collides('intersection(){ mj_spur_gear(1, 20, 5); mj_gear_meshed(1, 20, 13, 0) rotate(180/13) mj_spur_gear(1, 13, 5); }')).toBe(true);
  });
  wasm('a train chains: phase carries the middle gear\'s own turn to the next mesh', async () => {
    const g2 = 'mj_gear_meshed(1.5, 12, 36, 0) mj_spur_gear(1.5, 36, 5);';
    const g3 = (phase) => `translate([mj_gear_center(1.5, 12, 36), 0, 0]) mj_gear_meshed(1.5, 36, 20, 90${phase}) mj_spur_gear(1.5, 20, 5);`;
    expect(await fits(`intersection(){ ${g2} ${g3(', phase = mj_gear_mesh_turn(12, 36, 0)')} }`)).toBe(true);
    expect(await collides(`intersection(){ ${g2} ${g3('')} }`)).toBe(true);   // the control: chained as if the middle gear sat at 0
  });
  wasm('mj_bolt_and_nut puts the nut in phase', async () => {
    expect(await fits('intersection(){ mj_bolt("M6", 30); translate([0,0,mj__nut_phase_z("M6","hex",12)]) mj_nut("M6"); }')).toBe(true);
    expect(await collides('intersection(){ mj_bolt("M6", 30); translate([0,0,mj__nut_phase_z("M6","hex",12)+0.5]) mj_nut("M6"); }')).toBe(true);
  });
  wasm('the enclosure lid closes on its base, and collides 1 mm off', async () => {
    const pair = (dx, dz) => `intersection(){ mj_enclosure([60,40,25], board="rpi-zero", part="base"); translate([${dx},0,${29 + dz}]) mirror([0,0,1]) mj_enclosure([60,40,25], board="rpi-zero", part="lid"); }`;
    expect(await fits(pair(0, 0))).toBe(true);
    expect(await collides(pair(1, 0))).toBe(true);
    expect(await collides(pair(0, -0.5))).toBe(true);
  });
  wasm('$mj_fit_add widens every fit by its amount', async () => {
    const w = async (add) => (await planScad({ source: `$mj_fit_add = ${add}; translate([0,0,6]) mj_hole(10, 6, "slip");` })).stats.size.w;
    expect(await w(0)).toBe(10.2);
    expect(await w(0.4)).toBe(10.6);
  });
}, 120000);

describe('mech-lib v2 — outputs (skipped when the WASM is not installed)', () => {
  // connected components by shared vertices: a bend that misses its flanges leaves the part in pieces
  const bodies = async (source) => {
    const recs = (await renderScadParts({ source })).parts[0].records;
    const up = new Map(); const find = (k) => { while (up.get(k) !== k) { up.set(k, up.get(up.get(k))); k = up.get(k); } return k; };
    const key = (c) => c.map((v) => v.toFixed(4)).join(',');
    for (const r of recs) { const ks = r.corners.map(key); for (const k of ks) if (!up.has(k)) up.set(k, k); for (const k of ks.slice(1)) up.set(find(k), find(ks[0])); }
    return new Set([...up.keys()].map(find)).size;
  };
  wasm('every bend joins its flanges: a bent part is one body', async () => {
    expect(await bodies('cube(1); translate([3,0,0]) cube(1);')).toBe(2); // the counter's control
    expect(await bodies('mj_sheet(1.5, 1.5, 30, [[20, 90], [30, 90], [20, 0]]);')).toBe(1);
    expect(await bodies('mj_sheet(2, 3, 20, [[30, 45], [20, -120], [15, 0]]);')).toBe(1);
  });
  wasm('a Z bracket bends to its size and its flat pattern is the bend-allowance length', async () => {
    const f = '[[20, 90], [30, -90], [20, 0]]';
    expect((await planScad({ source: `mj_sheet(1.5, 1.5, 25, ${f});` })).stats.size).toEqual({ w: 44.5, d: 25, h: 36 });
    // 70 of flanges + 2 × π/2 × (r + k·t) = 70 + 2 × 3.393
    const flat = await renderScad2d({ source: `mj_sheet_flat(1.5, 1.5, 25, ${f});` }, { format: 'svg' });
    expect(flat.mode).toBe('as-written');
    expect(flat.size.w).toBeCloseTo(77, 0);
  });
  wasm('a plate draws as a DXF: a slice keeps every hole, a missed plane says so, a parts row needs a part', async () => {
    const plate = { source: 'difference(){ translate([-25,-25,0]) cube([50,50,5]); translate([0,0,5]) mj_nema_mount(17, 6); }' };
    const cut = await renderScad2d(plate, { format: 'dxf', slice_z: 2.5 });
    expect(cut.mode).toBe('slice');
    expect(cut.entities).toBe(6); // the edge, the pilot and four screw holes
    expect((await renderScad2d(plate, { format: 'dxf' })).mode).toBe('outline');
    await expect(renderScad2d(plate, { format: 'svg', slice_z: 50 })).rejects.toThrow(/plane misses the part/);
    await expect(renderScad2d({ source: 'module a() cube(5);', parts: { a: 'a();' } }, { format: 'svg' })).rejects.toThrow(/name one with `part`/);
  });
  wasm('the tensile coupon is the ISO 527-2 1A dogbone, lying or standing', async () => {
    const flat = await planScad({ source: 'mj_tensile_coupon();' });
    expect(flat.stats.ledger.closed).toBe(true);
    expect(flat.stats.size).toEqual(expect.objectContaining({ w: 170, d: 20, h: 4 }));
    const up = await planScad({ source: 'mj_tensile_coupon(upright = true);' });
    expect(up.stats.size.h).toBe(170);
  });
  wasm('the fit coupon renders a hole and a pin for every fit', async () => {
    const { stats } = await planScad({ source: 'mj_fit_coupon(8);' });
    expect(stats.ledger.closed).toBe(true);
    expect(stats.size.w).toBe(70);
  });
}, 120000);
