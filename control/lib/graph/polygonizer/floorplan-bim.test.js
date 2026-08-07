import { describe, expect, it } from 'vitest';

import { structurizeHouse, structurizeFloorplan } from './floorplan-structure.js';
import {
  buildElementModel, deriveSchedules, scoreHouse, generateBestHouse,
  gradeFloorplanManifest, improveFloorplanManifest, repairFloorplan,
} from './floorplan-bim.js';

// Drive the REAL generator: a 2-storey program house, then promote its discarded
// intermediate structures into an element model and read schedules off it. This proves
// the BIM data was already being computed — we just retain + project it.
describe('floorplan-bim: element model + schedules over a real generated house', () => {
  const house = structurizeHouse(
    { seed: 7, tier: 'house', levels: [{ role: 'ground' }, { role: 'upper' }], stairs: true },
    { furnish: false, windows: true },
  );
  const model = buildElementModel(house);
  const sched = deriveSchedules(model);

  it('promotes storeys, spaces, walls and openings with stable ids', () => {
    expect(model.storeys.length).toBe(2);
    expect(model.spaces.length).toBeGreaterThan(3);
    expect(model.walls.length).toBeGreaterThan(4);
    expect(model.openings.length).toBeGreaterThan(2);
    // ids are content-addressed and unique
    const ids = model.spaces.concat(model.walls, model.openings).map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    // every opening is hosted by a real wall (the hosts edge resolves)
    const wallIds = new Set(model.walls.map((w) => w.id));
    for (const o of model.openings) expect(wallIds.has(o.host)).toBe(true);
  });

  it('classifies doors vs windows by sill and totals wall quantities', () => {
    const doors = model.openings.filter((o) => o.type === 'door');
    const windows = model.openings.filter((o) => o.type === 'window');
    expect(doors.length).toBeGreaterThan(0);
    expect(windows.length).toBeGreaterThan(0);
    // exterior walls are thicker than interior partitions (8in vs 5in)
    expect(sched.wallQuantities.exterior.faceArea).toBeGreaterThan(0);
    expect(sched.wallQuantities.interior.count).toBeGreaterThan(0);
  });

  it('builds precise bounded-by and connects edges', () => {
    // every space is enclosed by at least its perimeter/partition walls
    for (const s of model.spaces) expect(s.bounds.length).toBeGreaterThan(0);
    // every interior door connects exactly two spaces; exteriors connect one
    for (const o of model.openings.filter((x) => x.type === 'door')) {
      expect(o.connects.length === 1 || o.connects.length === 2).toBe(true);
      if (o.exterior) expect(o.connects.length).toBe(1);
    }
    // bounded-by is reciprocal: a wall in a space's bounds lists that space back
    const wallById = new Map(model.walls.map((w) => [w.id, w]));
    for (const s of model.spaces) {
      for (const wid of s.bounds) expect(wallById.get(wid).bounds).toContain(s.id);
    }
    // windows only ever sit on exterior walls (so egress counts can't double-attribute)
    for (const o of model.openings.filter((x) => x.type === 'window')) {
      expect(wallById.get(o.host).interior).toBe(false);
    }
  });

  it('prints the schedules a basic BIM would expose', () => {
    /* eslint-disable no-console */
    const byStorey = (i) => sched.spaceSchedule.filter((s) => s.storey === i);
    console.log('\n=== SPACE SCHEDULE ===');
    for (const i of [0, 1]) {
      console.log(` storey ${i}:`);
      for (const s of byStorey(i)) console.log(`   ${s.name.padEnd(10)} ${String(s.area).padStart(6)} sqft   ${s.id}`);
    }
    const totalArea = sched.spaceSchedule.reduce((a, s) => a + s.area, 0);
    console.log(` total conditioned area: ${Math.round(totalArea)} sqft`);

    console.log('\n=== OPENING SCHEDULE ===');
    for (const o of sched.openingSchedule) {
      const tag = `${o.type}${o.role ? `/${o.role}` : ''}`;
      console.log(`   ${tag.padEnd(14)} ${o.width}ft x ${o.height}ft   ${o.exterior ? 'EXT' : 'int'}   host=${o.host}`);
    }

    console.log('\n=== WALL QUANTITIES ===');
    const wq = sched.wallQuantities;
    console.log(`   interior partitions: ${wq.interior.count} runs, ${wq.interior.length} lin-ft, ${wq.interior.faceArea} sqft face`);
    console.log(`   exterior envelope:   ${wq.exterior.count} runs, ${wq.exterior.length} lin-ft, ${wq.exterior.faceArea} sqft face`);

    console.log('\n=== EGRESS CHECK (bedrooms need an egress window) ===');
    if (!sched.egress.length) console.log('   (no egress-rated spaces on this plan)');
    for (const e of sched.egress) {
      console.log(`   ${e.ok ? 'PASS' : 'FAIL'}  ${e.name} (${e.id}) — ${e.windows} window(s), requires ${e.requires}`);
    }

    console.log('\n=== ADJACENCY RULE CHECK ===');
    if (!sched.adjacency.length) console.log('   (no rule violations)');
    for (const a of sched.adjacency) console.log(`   ${a.name} (${a.id}): ${a.violations.join(', ')}`);

    console.log('\n=== REACHABILITY (door graph per storey) ===');
    for (const r of sched.reachability) {
      const tag = r.isolated.length ? `ISOLATED: ${r.isolated.map((s) => s.name).join(', ')}` : 'all reachable';
      console.log(`   storey ${r.storey}: ${r.components} component(s) — ${tag}`);
    }
    console.log('');
    /* eslint-enable no-console */
    expect(sched.spaceSchedule.length).toBe(model.spaces.length);
  });
});

// The payoff: generation is open-loop and dumb; quality comes from MEASURING each house and
// SELECTING the best — only possible because the element model retains what each house is.
describe('floorplan-bim: best-of-N grader makes better houses', () => {
  const input = { tier: 'house', levels: [{ role: 'ground' }, { role: 'upper' }], stairs: true };
  const houseOpts = { furnish: false, windows: true };

  it('scoreHouse returns a 0..1 score with a per-dimension breakdown', () => {
    const model = buildElementModel(structurizeHouse({ ...input, seed: 7 }, houseOpts), houseOpts);
    const graded = scoreHouse(model);
    expect(graded.score).toBeGreaterThanOrEqual(0);
    expect(graded.score).toBeLessThanOrEqual(1);
    for (const k of ['reachability', 'egress', 'proportion', 'adjacency', 'daylight']) {
      expect(graded.breakdown[k]).toBeGreaterThanOrEqual(0);
      expect(graded.breakdown[k]).toBeLessThanOrEqual(1);
    }
  });

  it('the grader has teeth: a broken house scores strictly lower', () => {
    const model = buildElementModel(structurizeHouse({ ...input, seed: 7 }, houseOpts), houseOpts);
    const good = scoreHouse(model);
    // strip every window → bedrooms lose egress, habitable rooms go dark. Same plan, worse house.
    const blinded = { ...model, openings: model.openings.filter((o) => o.type !== 'window') };
    const bad = scoreHouse(blinded);
    expect(bad.score).toBeLessThan(good.score);
    expect(bad.breakdown.egress).toBeLessThan(good.breakdown.egress);
    expect(bad.breakdown.daylight).toBeLessThan(good.breakdown.daylight);
    // and an isolated room (a bedroom with no door) tanks reachability
    const target = model.spaces.find((s) => s.glyph === 'B');
    const stranded = { ...model, spaces: model.spaces.map((s) => (s.id === target.id ? { ...s, connects: [] } : { ...s, connects: s.connects.filter((c) => c !== target.id) })) };
    expect(scoreHouse(stranded).breakdown.reachability).toBeLessThan(good.breakdown.reachability);
  });

  it('best-of-N never returns worse than the average seed (and picks the top)', () => {
    const N = 10;
    const picked = generateBestHouse({ ...input, seed: 1 }, houseOpts, { samples: N });
    const avg = picked.ranked.reduce((a, r) => a + r.score, 0) / picked.ranked.length;
    const worst = picked.ranked[picked.ranked.length - 1].score;

    expect(picked.ranked.length).toBe(N);
    expect(picked.score).toBe(picked.ranked[0].score);   // returned house is the top-ranked
    expect(picked.score + 1e-9).toBeGreaterThanOrEqual(avg);     // selection never hurts (float-safe)
    expect(picked.score).toBeGreaterThanOrEqual(worst);

    /* eslint-disable no-console */
    console.log('\n=== BEST-OF-N SELECTION ===');
    console.log(`   sampled ${N} seeds  |  best=${picked.score}  avg=${avg.toFixed(3)}  worst=${worst}`);
    console.log(`   chosen seed ${picked.seed}, breakdown:`,
      Object.fromEntries(Object.entries(picked.breakdown).map(([k, v]) => [k, +v.toFixed(2)])));
    console.log('   per-seed scores:', picked.ranked.map((r) => `${r.seed}:${r.score}`).join('  '));
    if (picked.violations.length) console.log('   remaining notes on the winner:', picked.violations.slice(0, 4));
    console.log('');
    /* eslint-enable no-console */
  });
});

// The wiring: houses are stored as manifests and regenerated on render, so quality is applied
// once at authoring time — improveFloorplanManifest is what mintSketch (create/update) calls.
describe('floorplan-bim: manifest-level grade, repair, and the mint-time improver', () => {
  const manifest = { kind: 'floorplan', title: 'house', viewBox: { width: 1120, height: 760 }, seed: 7, width: 44, height: 30, windows: true };

  it('gradeFloorplanManifest scores a manifest the way the renderer would build it', () => {
    const g = gradeFloorplanManifest(manifest);
    expect(g.score).toBeGreaterThan(0);
    expect(g.breakdown.reachability).toBeLessThanOrEqual(1);
  });

  it('improveFloorplanManifest stamps a quality grade and leaves a good house untouched', () => {
    const out = improveFloorplanManifest(manifest);
    expect(out.quality).toBeTruthy();
    expect(out.quality.score).toBeGreaterThan(0);
    expect(out.seed).toBe(manifest.seed);   // already good → seed not swapped
  });

  it('is a strict no-op for non-floorplan kinds', () => {
    const other = { kind: 'fractal-city', title: 'city', viewBox: { width: 100, height: 100 }, marks: [] };
    expect(improveFloorplanManifest(other)).toBe(other);   // same reference, untouched
  });

  it('repairFloorplan cuts a door into a stranded room', () => {
    // author a plan where one room is deliberately given NO door → isolated
    const s = structurizeFloorplan({ seed: 3, width: 40, height: 28 }, {});
    const plan = { rooms: s.plan.rooms, halls: s.plan.halls, doors: s.plan.doors };
    // strip every door touching the last room to strand it
    const before = scoreHouse(buildElementModel(structurizeFloorplan({ ...plan, doors: [] }, {}))).breakdown.reachability;
    const { plan: fixed, fixes } = repairFloorplan({ ...plan, doors: [] });
    const after = scoreHouse(buildElementModel(structurizeFloorplan(fixed, {}))).breakdown.reachability;
    expect(fixes.length).toBeGreaterThan(0);
    expect(after).toBeGreaterThan(before);   // repair improved reachability
    /* eslint-disable no-console */
    console.log('\n=== REPAIR PASS ===');
    console.log(`   reachability ${before.toFixed(2)} → ${after.toFixed(2)} after ${fixes.length} fix(es)`);
    for (const f of fixes.slice(0, 5)) console.log(`   - ${f}`);
    console.log('');
    /* eslint-enable no-console */
  });
});
