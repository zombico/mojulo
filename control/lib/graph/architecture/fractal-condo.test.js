import assert from 'node:assert';
import { describe, expect, it, test } from 'vitest';
import {
  CONDO_PATTERNS, PLANNED_PATTERNS, FLOOR_TIERS, BALCONY_GUARDS, CONDO_FORMS, GLASS_TINTS, CLEAR_GLASS_ALPHA,
  condoStream, structureEnvelopes, buildingTopZ,
  planFractalCondoComplex, buildFractalCondoFaces, balconyFaces, assembleFractalCondoScene,
  assessComplexFlow, assessComplexLivability, assessComplexEgress, assessComplexReachability,
} from './fractal-condo.js';
import { CONDO_DEFAULTS } from './condo-entrance.js';
import { makeLight } from '../polygonizer/vexar.js';

const hasFaces = (faces) => Array.isArray(faces) && faces.length > 0
  && faces.every((f) => Array.isArray(f.corners) && f.corners.length === 4 && typeof f.fill === 'string');

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];

test('labelled sub-streams: independent per label, stable per (seed, label)', () => {
  const a1 = condoStream(7, 'lobby')(), a2 = condoStream(7, 'lobby')();
  assert.equal(a1, a2, 'same seed + label ⇒ same stream');
  assert.notEqual(condoStream(7, 'lobby')(), condoStream(7, 'hall')(), 'labels are independent streams');
  assert.notEqual(condoStream(7, 'lobby')(), condoStream(8, 'lobby')(), 'seeds are independent streams');
});

test('same seed is byte-stable: identical plan and identical faces', () => {
  const p1 = planFractalCondoComplex({ seed: 7 });
  const p2 = planFractalCondoComplex({ seed: 7 });
  assert.equal(JSON.stringify(p1), JSON.stringify(p2), 'plan is deterministic');
  const f1 = buildFractalCondoFaces({ seed: 7 }).faces;
  const f2 = buildFractalCondoFaces({ seed: 7 }).faces;
  assert.equal(JSON.stringify(f1), JSON.stringify(f2), 'faces are byte-stable');
});

test('seeds vary the complex: multiple patterns and building counts across a seed sweep', () => {
  const patterns = new Set(), counts = new Set();
  for (const seed of SEEDS) {
    const plan = planFractalCondoComplex({ seed });
    patterns.add(plan.pattern);
    counts.add(plan.buildings.length);
  }
  assert.ok(patterns.size >= 2, `expected ≥2 site patterns across seeds, got ${[...patterns].join(', ')}`);
  assert.ok(counts.size >= 2 || patterns.size >= 2, 'seeds differ in building count or pattern');
});

test('explicit patterns produce their building counts (paired 2, three-wing 4, courtyard 4)', () => {
  assert.equal(planFractalCondoComplex({ seed: 3, pattern: 'paired' }).buildings.length, 2);
  assert.equal(planFractalCondoComplex({ seed: 3, pattern: 'three-wing' }).buildings.length, 4);
  assert.equal(planFractalCondoComplex({ seed: 3, pattern: 'courtyard' }).buildings.length, 4);
});

test('the resolved pattern is recorded in the plan (auto is pinnable)', () => {
  const plan = planFractalCondoComplex({ seed: 5 });
  assert.ok(CONDO_PATTERNS.includes(plan.pattern), 'auto resolves to an implemented pattern');
  const pinned = planFractalCondoComplex({ seed: 5, pattern: plan.pattern });
  assert.equal(pinned.pattern, plan.pattern);
});

test('an unimplemented or unknown pattern/facade fails loudly (no silent fallback)', () => {
  for (const pattern of PLANNED_PATTERNS) {
    assert.throws(() => planFractalCondoComplex({ seed: 1, pattern }), /not implemented/, pattern);
  }
  assert.throws(() => planFractalCondoComplex({ seed: 1, pattern: 'megatower' }), /unknown/);
  assert.throws(() => planFractalCondoComplex({ seed: 1, facade: 'masonry-punched' }), /unknown/);
});

test('every entity carries a stable id: buildings, concourses, units', () => {
  const plan = planFractalCondoComplex({ seed: 4 });
  assert.ok(plan.buildings.every((b) => typeof b.id === 'string' && b.id));
  assert.ok(plan.concourses.every((c) => typeof c.id === 'string' && Array.isArray(c.units) && c.units.length > 0));
  const ids = plan.concourses.flatMap((c) => c.units.map((u) => u.id));
  assert.equal(new Set(ids).size, ids.length, 'unit ids are unique');
});

test('default seeds pass flow, livability, egress, and reachability', () => {
  for (const seed of SEEDS) {
    const plan = planFractalCondoComplex({ seed });
    const label = `seed ${seed} (${plan.pattern}, ${plan.facade})`;
    const flow = assessComplexFlow(plan);
    assert.equal(flow.ok, true, `${label} flow: ${flow.necessary.map((n) => n.detail).join('; ')}`);
    const live = assessComplexLivability(plan);
    assert.equal(live.ok, true, `${label} livability: ${live.necessary.map((n) => n.detail).join('; ')}`);
    assert.ok(live.units > 0, `${label} has units`);
    const egr = assessComplexEgress(plan);
    assert.equal(egr.ok, true, `${label} egress: ${egr.necessary.map((n) => n.detail).join('; ')}`);
    const reach = assessComplexReachability(plan);
    assert.equal(reach.ok, true, `${label} reachability: ${reach.necessary.map((n) => n.detail).join('; ')}`);
    assert.equal(reach.reached, plan.buildings.length, `${label}: every building reachable from the entrance`);
  }
});

test('reachability has teeth: a severed concourse flags the orphaned building', () => {
  const plan = planFractalCondoComplex({ seed: 3, pattern: 'three-wing' });
  const severed = { ...plan, concourses: plan.concourses.slice(0, -1) };
  const reach = assessComplexReachability(severed);
  assert.equal(reach.ok, false, 'an unconnected tower must fail reachability');
  assert.ok(reach.necessary.some((n) => n.rule === 'unreachable-building'));
});

test('courtyard halls are single-loaded: units only on the street side', () => {
  const plan = planFractalCondoComplex({ seed: 2, pattern: 'courtyard' });
  for (const c of plan.concourses) {
    const sides = new Set(c.units.map((u) => u.side));
    assert.equal(sides.size, 1, `${c.id} carries units on exactly one side`);
  }
});

test('no stragglers: every baked face stands on a structure envelope, never in open air', () => {
  // the regression the site-bounds column march allowed: free-standing piers in the void
  // between buildings. Everything structural must sit on a building or hall+unit strip.
  const MARGINS = { 'concrete-frame': 2.5, 'balcony-grid': 5 };   // column projection vs balcony cantilever (4.6ft)
  const CANOPY = 5;     // the glass entrance's cantilevered canopy projects past the street wall
  for (const seed of [2, 3, 4]) {
    for (const [facade, MARGIN] of Object.entries(MARGINS)) {
      const pattern = CONDO_PATTERNS[seed % CONDO_PATTERNS.length];
      const plan = planFractalCondoComplex({ seed, pattern, facade });
      const entranceIds = new Set(plan.buildings.filter((b) => b.entrance).map((b) => b.id));
      const envs = structureEnvelopes(plan).map((e) => ({
        x0: e.rect.x0 - MARGIN, x1: e.rect.x1 + MARGIN,
        y0: e.rect.y0 - Math.max(MARGIN, entranceIds.has(e.id) ? CANOPY : 0), y1: e.rect.y1 + MARGIN,
      }));
      const { faces } = buildFractalCondoFaces(plan);
      const strays = faces.filter((f) => !f.corners.every(([x, y]) =>
        envs.some((r) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1)));
      assert.equal(strays.length, 0,
        `seed ${seed} ${pattern}: ${strays.length} face(s) stand off every envelope, e.g. ${JSON.stringify(strays[0]?.corners)}`);
    }
  }
});

test('BIM completion skin: roofs/parapets/bulkheads/vents cap the shell by default', () => {
  // floors:1 isolates the skin from tower stacking (which also rises above the ground shell)
  const plan = planFractalCondoComplex({ seed: 5, pattern: 'courtyard', floors: 1 });
  assert.equal(plan.structure, true, 'the skin is on by default');
  const skinned = buildFractalCondoFaces(plan).faces;
  const open = buildFractalCondoFaces(planFractalCondoComplex({ seed: 5, pattern: 'courtyard', floors: 1, structure: false })).faces;
  assert.ok(skinned.length > open.length + 50, `the skin adds roof geometry (skinned ${skinned.length}, open ${open.length})`);
  // lift-overrun bulkheads and vents rise ABOVE the roof plane — the shaft has to end somewhere
  const roofZ = plan.baseZ + plan.height + 0.35;
  const above = skinned.filter((f) => f.corners.every((c) => c[2] >= roofZ - 0.01) && f.corners.some((c) => c[2] > roofZ + 0.5));
  assert.ok(above.length > 10, `expected bulkhead/HVAC/vent geometry above the roof plane, got ${above.length}`);
  // and the bare shell tops out at the walls (+ the entrance canopy's small upstand)
  const shellTop = plan.baseZ + plan.height + 0.7;
  assert.ok(open.every((f) => f.corners.every((c) => c[2] <= shellTop)), 'structure:false leaves the open-top shell');
});

test('facade styles differ in geometry (concrete-frame adds envelope columns)', () => {
  const glass = buildFractalCondoFaces({ seed: 3, pattern: 'paired', facade: 'curtain-wall' }).faces.length;
  const frame = buildFractalCondoFaces({ seed: 3, pattern: 'paired', facade: 'concrete-frame' }).faces.length;
  assert.notEqual(glass, frame, `facade styles should bake differently (glass ${glass}, frame ${frame})`);
});

test("tower stacking: floors:'auto' samples the 12/20/30 tiers per building", () => {
  const tiers = new Set();
  for (const seed of SEEDS) {
    const plan = planFractalCondoComplex({ seed });
    for (const bd of plan.buildings) {
      assert.ok(FLOOR_TIERS.includes(bd.floors), `${bd.id} floors ${bd.floors} is a tier`);
      tiers.add(bd.floors);
    }
  }
  assert.ok(tiers.size >= 2, `a seed sweep reaches multiple tiers, got ${[...tiers].join(', ')}`);
});

test('tower stacking: a numeric floors pins every building; bad values throw', () => {
  const plan = planFractalCondoComplex({ seed: 3, pattern: 'paired', floors: 20 });
  assert.ok(plan.buildings.every((bd) => bd.floors === 20));
  for (const bad of [0, 3.5, 'tall', 99]) {
    assert.throws(() => planFractalCondoComplex({ seed: 3, floors: bad }), /floors/, String(bad));
  }
});

test('tower stacking: the shell rises to buildingTopZ and the roof skin caps THAT plane', () => {
  const plan = planFractalCondoComplex({ seed: 3, pattern: 'paired', floors: 12 });
  const top = buildingTopZ(plan, plan.buildings[0]);
  assert.ok(top > 100, `12 floors should top out above 100ft, got ${top}`);
  const { faces } = buildFractalCondoFaces(plan);
  let maxZ = -Infinity;
  for (const f of faces) for (const c of f.corners) if (c[2] > maxZ) maxZ = c[2];
  // the lobby's crown (or a tower's bulkhead) over the roof plate is the highest point
  assert.ok(maxZ > top + 3 && maxZ < top + 10, `expected the core expression just above the tower roof at ${top}, got ${maxZ}`);
  // repeated floor grammar actually repeats: a 12-floor tower carries far more facade than a 1-floor shell
  const low = buildFractalCondoFaces(planFractalCondoComplex({ seed: 3, pattern: 'paired', floors: 1 })).faces.length;
  assert.ok(faces.length > low + 200, `stacking adds repeated-floor geometry (12F ${faces.length}, 1F ${low})`);
});

test('the lobby crowns its lift core; towers keep the plain bulkhead', () => {
  // same footprint heights, so the roofline difference is purely the core expression
  const plan = planFractalCondoComplex({ seed: 3, pattern: 'paired', floors: 1 });
  const lobby = plan.buildings.find((b) => b.role === 'lobby');
  const tower = plan.buildings.find((b) => b.role === 'tower');
  assert.ok(lobby.elevators > 0, 'the lobby carries the shared lift core');
  const { faces } = buildFractalCondoFaces(plan);
  const roofZ = plan.baseZ + plan.height;
  const peakOver = (rect) => {
    let max = -Infinity;
    for (const f of faces) {
      for (const [x, y, z] of f.corners) {
        if (x >= rect.x0 && x <= rect.x1 && y >= rect.y0 && y <= rect.y1 && z > max) max = z;
      }
    }
    return max - roofZ;
  };
  const lobbyPeak = peakOver(lobby.rect), towerPeak = peakOver(tower.rect);
  assert.ok(lobbyPeak > 7, `the lobby's stepped lantern crown rises well above its roof (got +${lobbyPeak.toFixed(1)}ft)`);
  assert.ok(towerPeak > 2.5 && towerPeak < 5, `the tower keeps the plain lift bulkhead (got +${towerPeak.toFixed(1)}ft)`);
  assert.ok(lobbyPeak > towerPeak + 3, 'the middle section reads distinct on the roofline');
});

test('balcony primitive: life-sized slab + 42-inch guard, both styles, within its footprint', () => {
  const o = { ...CONDO_DEFAULTS, light: makeLight({ direction: [0.34, 0.42, -0.84], ambient: 0.56, diffuse: 0.5 }) };
  for (const guard of BALCONY_GUARDS) {
    const faces = balconyFaces({ axis: 'x', alongCenter: 0, width: 8, cAt: 10, outSign: 1, z0: 20, guard }, o);
    assert.ok(faces.length > 10, `${guard}: a balcony is real geometry`);
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const f of faces) {
      for (const [x, y, z] of f.corners) {
        minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
      }
    }
    assert.ok(minX >= -4.01 && maxX <= 4.01, `${guard}: spans its width`);
    assert.ok(minY >= 10 && maxY <= 14.7, `${guard}: cantilevers ~4.6ft off the wall plane, got ${minY}..${maxY}`);
    assert.ok(Math.abs(maxZ - 20 - 3.5) < 0.01, `${guard}: guard tops out at the 42in code height, got ${maxZ}`);
    assert.ok(minZ < 20, `${guard}: the slab hangs below the floor line`);
  }
  const glass = balconyFaces({ axis: 'x', alongCenter: 0, width: 8, cAt: 10, outSign: 1, z0: 20, guard: 'glass' }, o).length;
  const rail = balconyFaces({ axis: 'x', alongCenter: 0, width: 8, cAt: 10, outSign: 1, z0: 20, guard: 'rail' }, o).length;
  assert.notEqual(glass, rail, 'guard styles bake differently');
});

test('balcony-grid facade: balconies march the tower broad faces and record their guard', () => {
  // form pinned rect: round towers deliberately skip balcony rows (curved balconies are queued)
  const plan = planFractalCondoComplex({ seed: 4, pattern: 'paired', facade: 'balcony-grid', floors: 12, form: 'rect' });
  assert.ok(plan.balcony && BALCONY_GUARDS.includes(plan.balcony.guard), 'the resolved guard style is recorded in the plan');
  const withB = buildFractalCondoFaces(plan).faces;
  const glassOnly = buildFractalCondoFaces(planFractalCondoComplex({ seed: 4, pattern: 'paired', facade: 'curtain-wall', floors: 12, form: 'rect' })).faces;
  assert.ok(withB.length > glassOnly.length + 200, `balcony rows add real geometry (balcony ${withB.length}, curtain ${glassOnly.length})`);
  // balconies cantilever past the tower wall plane — but never further than the 4.6ft slab + rail
  const tower = plan.buildings[0].rect;
  const broadX = (tower.x1 - tower.x0) >= (tower.y1 - tower.y0);
  let overhang = 0;
  for (const f of withB) {
    for (const [x, y, z] of f.corners) {
      if (z > plan.height + 1 && x > tower.x0 && x < tower.x1) {
        const d = broadX ? Math.max(tower.y0 - y, y - tower.y1) : Math.max(tower.x0 - x, x - tower.x1);
        if (d > overhang && d < 100) overhang = d;
      }
    }
  }
  assert.ok(overhang > 4 && overhang < 5, `balconies project ~4.6ft off the broad faces, got ${overhang.toFixed(2)}`);
});

test("building forms: 'auto' samples rect + round; a pinned form applies; bad names throw", () => {
  const forms = new Set();
  for (const seed of SEEDS) {
    for (const bd of planFractalCondoComplex({ seed }).buildings) {
      assert.ok(CONDO_FORMS.includes(bd.form), `${bd.id} has a known form`);
      forms.add(bd.form);
    }
  }
  assert.ok(forms.has('rect') && forms.has('round'), `a seed sweep reaches both forms, got ${[...forms].join(', ')}`);
  const round = planFractalCondoComplex({ seed: 3, pattern: 'paired', form: 'round' });
  assert.ok(round.buildings.every((bd) => bd.form === 'round'));
  assert.throws(() => planFractalCondoComplex({ seed: 3, form: 'hexagonal' }), /unknown/);
});

test('round towers: a glazed cylinder rises from the rect podium to a disc roof', () => {
  const plan = planFractalCondoComplex({ seed: 3, pattern: 'paired', form: 'round', floors: 12, facade: 'curtain-wall' });
  const { faces } = buildFractalCondoFaces(plan);
  const bd = plan.buildings[0], top = buildingTopZ(plan, bd);
  const cx = (bd.rect.x0 + bd.rect.x1) / 2, cy = (bd.rect.y0 + bd.rect.y1) / 2;
  const R = Math.min(bd.rect.x1 - bd.rect.x0, bd.rect.y1 - bd.rect.y0) / 2;
  // mid-tower shell geometry hugs the cylinder: faces at half height stay within R of the axis
  const mid = plan.height + (top - plan.height) / 2;
  for (const f of faces) {
    for (const [x, y, z] of f.corners) {
      if (z > mid - 2 && z < mid + 2 && x > bd.rect.x0 - 1 && x < bd.rect.x1 + 1 && y > bd.rect.y0 - 1 && y < bd.rect.y1 + 1) {
        assert.ok(Math.hypot(x - cx, y - cy) <= R + 0.2, `mid-tower face escapes the cylinder at [${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)}]`);
      }
    }
  }
  // and the rect form bakes a different shell from the round one
  const rect = buildFractalCondoFaces(planFractalCondoComplex({ seed: 3, pattern: 'paired', form: 'rect', floors: 12, facade: 'curtain-wall' })).faces;
  assert.notEqual(faces.length, rect.length, 'round and rect towers bake differently');
});

test("window glass: 'auto' samples the palette; a pinned tint is recorded and changes the bake", () => {
  const auto = planFractalCondoComplex({ seed: 5 });
  assert.ok(GLASS_TINTS[auto.glass.name], `auto resolves to a palette entry, got '${auto.glass.name}'`);
  const bronze = planFractalCondoComplex({ seed: 5, pattern: 'paired', glass: 'bronze', form: 'rect', floors: 12 });
  assert.equal(bronze.glass.name, 'bronze');
  const ice = planFractalCondoComplex({ seed: 5, pattern: 'paired', glass: 'ice', form: 'rect', floors: 12 });
  const fills = (p) => new Set(buildFractalCondoFaces(p).faces.map((f) => f.fill));
  const bronzeFills = fills(bronze), iceFills = fills(ice);
  assert.ok([...bronzeFills].some((c) => !iceFills.has(c)), 'different tints produce different face colours');
  assert.throws(() => planFractalCondoComplex({ seed: 5, glass: 'plaid' }), /unknown/);
});

test('clear glazing: panes join the translucent glass group so interiors read through', () => {
  const clear = planFractalCondoComplex({ seed: 6, pattern: 'three-wing', clearGlass: true, floors: 1 });
  assert.equal(clear.clearGlass, true);
  const clearFaces = buildFractalCondoFaces(clear).faces;
  const panes = clearFaces.filter((f) => f.group === 'glass' && f.alpha === CLEAR_GLASS_ALPHA);
  assert.ok(panes.length > 20, `curtain walls + storefronts opt into the translucent pass, got ${panes.length}`);
  const solid = buildFractalCondoFaces(planFractalCondoComplex({ seed: 6, pattern: 'three-wing', clearGlass: false, floors: 1 })).faces;
  assert.ok(solid.every((f) => f.alpha == null), 'clearGlass:false keeps every face opaque');
  assert.throws(() => planFractalCondoComplex({ seed: 6, clearGlass: 'sheer' }), /clearGlass/);
});

test('tower stacking: floors ride their own labelled streams (site geometry is untouched)', () => {
  const auto = planFractalCondoComplex({ seed: 7 });
  const pinned = planFractalCondoComplex({ seed: 7, floors: 30 });
  assert.equal(JSON.stringify(auto.buildings.map((b) => b.rect)), JSON.stringify(pinned.buildings.map((b) => b.rect)),
    'pinning floors must not reshuffle building footprints');
  assert.equal(auto.pattern, pinned.pattern);
});

test('scene assembles with faces, cameras, walk spawn, and assessment payloads', () => {
  for (const pattern of CONDO_PATTERNS) {
    const scene = assembleFractalCondoScene({ seed: 6, pattern });
    assert.ok(hasFaces(scene.faces), `${pattern} bakes faces`);
    assert.ok(scene.faces.length > 400, `${pattern}: a complex is rich geometry, got ${scene.faces.length}`);
    assert.ok(scene.cameras.length >= 2, `${pattern} has plan + lobby cameras`);
    assert.ok(scene.walk && Array.isArray(scene.walk.spawn), `${pattern} has a walk spawn`);
    for (const key of ['flow', 'livability', 'egress', 'reachability']) {
      assert.ok(scene[key] && scene[key].ok === true, `${pattern} carries a passing ${key} assessment`);
    }
    assert.equal(scene.condo.pattern, pattern, 'the plan rides on the payload');
  }
});

describe('fractal-condo — instanced balconies (renderer-convergence 1b)', () => {
  // seed 2 samples the balcony-grid facade (pinned by the assertions below)
  const SPEC = { seed: 2 };

  it('is strictly opt-in: no `instancing` → no repeats channel', () => {
    const scene = assembleFractalCondoScene(SPEC);
    expect(scene.repeats).toBeUndefined();
  });

  it('moves balcony rows into `repeats` with EXACT face accounting (one entry per wall side)', () => {
    const plain = assembleFractalCondoScene(SPEC);
    const inst = assembleFractalCondoScene({ ...SPEC, instancing: true });
    expect(inst.repeats.length).toBeGreaterThan(0);
    const depicted = inst.repeats.reduce((a, r) => a + r.template.length * r.transforms.length, 0);
    expect(inst.faces.length + depicted).toBe(plain.faces.length);
    const bytes = (o) => JSON.stringify({ f: o.faces, r: o.repeats || [] }).length;
    expect(bytes(inst)).toBeLessThan(bytes(plain));
    for (const g of inst.repeatsInfo.instanced) expect(g.copies).toBeGreaterThanOrEqual(2);
  });

  it('translation parity is EXACT: template faces land byte-where the expanded balconies were', () => {
    const plain = assembleFractalCondoScene(SPEC);
    const inst = assembleFractalCondoScene({ ...SPEC, instancing: true });
    const r0 = inst.repeats[0];
    for (const t of [r0.transforms[0], r0.transforms[r0.transforms.length - 1]]) {
      const tf = r0.template[0];
      const moved = tf.corners.map((c) => [c[0] + t.pos[0], c[1] + t.pos[1], c[2] + t.pos[2]]);
      const match = plain.faces.some((f) => f.fill === tf.fill && Array.isArray(f.corners)
        && f.corners.every((c, i) => Math.hypot(c[0] - moved[i][0], c[1] - moved[i][1], c[2] - moved[i][2]) < 1e-9));
      expect(match).toBe(true);
    }
  });

  it('stands down when guard panels are translucent (clear glass — alpha groups cannot instance)', () => {
    // clearGlass forces glassAlpha, which must disable balcony instancing
    const inst = assembleFractalCondoScene({ ...SPEC, clearGlass: true, instancing: true });
    expect(inst.repeats).toBeUndefined();
  });
});
