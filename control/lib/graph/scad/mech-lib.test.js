import { describe, it, expect } from 'vitest';
import { planScad, loadOpenscad, mechPrelude, persistedScadLedger } from './scad-render.js';
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
