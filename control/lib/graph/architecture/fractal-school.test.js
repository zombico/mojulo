import assert from 'node:assert';
import { test } from 'vitest';

import {
  SCHOOL_PATTERNS, PLANNED_PATTERNS, SCHOOL_PROGRAMS, PLANNED_PROGRAMS, SCHOOL_FACADES,
  schoolStream, structureEnvelopes, buildingTopZ,
  planFractalSchoolComplex, buildFractalSchoolFaces, assembleFractalSchoolScene,
  assessSchoolReachability, assessSchoolDaylight, assessSchoolEgress, assessSchoolSite,
  assessSchoolLivability, assessSchoolFengShui, assessSchoolPrinciples, schoolBim,
  assessSchoolWalkability, ROOM_DOOR_OFF, VEHICLE_SCALE,
} from './fractal-school.js';
import { vehicleFaces } from '@/lib/graph/vehicles/vehicles-css3d.js';

const hasFaces = (faces) => Array.isArray(faces) && faces.length > 0
  && faces.every((f) => Array.isArray(f.corners) && f.corners.length === 4
    && (typeof f.fill === 'string' || f.decal === 'shadow' || f.card));   // shadow decals carry `bg`; facade walls carry a `card`

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];

test('labelled sub-streams are independent and stable', () => {
  assert.equal(schoolStream(7, 'rooms')(), schoolStream(7, 'rooms')());
  assert.notEqual(schoolStream(7, 'rooms')(), schoolStream(7, 'site')());
  assert.notEqual(schoolStream(7, 'rooms')(), schoolStream(8, 'rooms')());
});

test('same seed is byte-stable for plan and faces', () => {
  const p1 = planFractalSchoolComplex({ seed: 7 });
  const p2 = planFractalSchoolComplex({ seed: 7 });
  assert.equal(JSON.stringify(p1), JSON.stringify(p2));
  const f1 = buildFractalSchoolFaces({ seed: 7 }).faces;
  const f2 = buildFractalSchoolFaces({ seed: 7 }).faces;
  assert.equal(JSON.stringify(f1), JSON.stringify(f2));
});

test('seed sweep varies pattern, program, facade, or campus size', () => {
  const patterns = new Set(), programs = new Set(), facades = new Set(), counts = new Set();
  for (const seed of SEEDS) {
    const plan = planFractalSchoolComplex({ seed });
    patterns.add(plan.pattern);
    programs.add(plan.program);
    facades.add(plan.facade);
    counts.add(`${plan.buildings.length}/${plan.rooms.length}`);
  }
  assert.ok(patterns.size >= 2, `patterns: ${[...patterns].join(', ')}`);
  assert.ok(programs.size >= 2, `programs: ${[...programs].join(', ')}`);
  assert.ok(facades.size >= 2 || counts.size >= 2, 'facade or size should vary');
});

test('explicit patterns and programs are recorded in the plan', () => {
  for (const pattern of SCHOOL_PATTERNS) {
    const plan = planFractalSchoolComplex({ seed: 3, pattern, program: 'middle', facade: 'brick-civic' });
    assert.equal(plan.pattern, pattern);
    assert.equal(plan.program, 'middle');
    assert.equal(plan.facade, 'brick-civic');
    assert.ok(plan.buildings.length >= 4);
  }
});

test('unimplemented and unknown names fail loudly', () => {
  for (const pattern of PLANNED_PATTERNS) assert.throws(() => planFractalSchoolComplex({ pattern }), /not implemented/);
  for (const program of PLANNED_PROGRAMS) assert.throws(() => planFractalSchoolComplex({ program }), /not implemented/);
  assert.throws(() => planFractalSchoolComplex({ pattern: 'orbital' }), /unknown/);
  assert.throws(() => planFractalSchoolComplex({ program: 'wizardry' }), /unknown/);
  assert.throws(() => planFractalSchoolComplex({ facade: 'stucco-mall' }), /unknown/);
});

test('stable ids exist for buildings, connectors, rooms, and outdoor zones', () => {
  const plan = planFractalSchoolComplex({ seed: 4 });
  const ids = [
    ...plan.buildings.map((b) => b.id),
    ...plan.connectors.map((c) => c.id),
    ...plan.rooms.map((r) => r.id),
    ...plan.outdoor.map((o) => o.id),
  ];
  assert.ok(ids.every((id) => typeof id === 'string' && id.includes(':')));
  assert.equal(new Set(ids).size, ids.length);
});

test('default seeds pass reachability, daylight, egress, and site assessments', () => {
  for (const seed of SEEDS) {
    const plan = planFractalSchoolComplex({ seed });
    const label = `seed ${seed} (${plan.pattern}, ${plan.program}, ${plan.facade})`;
    for (const [name, assess] of [
      ['reachability', assessSchoolReachability],
      ['daylight', assessSchoolDaylight],
      ['egress', assessSchoolEgress],
      ['site', assessSchoolSite],
    ]) {
      const a = assess(plan);
      assert.equal(a.ok, true, `${label} ${name}: ${a.necessary.map((n) => n.detail).join('; ')}`);
    }
  }
});

test('reachability has teeth: severing a connector flags unreachable rooms', () => {
  const plan = planFractalSchoolComplex({ seed: 2, pattern: 'cluster' });
  const severed = { ...plan, connectors: plan.connectors.slice(0, 1) };
  const reach = assessSchoolReachability(severed);
  assert.equal(reach.ok, false);
  assert.ok(reach.necessary.some((n) => n.rule === 'unreachable-building'));
  assert.ok(reach.necessary.some((n) => n.rule === 'unreachable-room'));
});

test('structure envelopes cover every building and connector top', () => {
  const plan = planFractalSchoolComplex({ seed: 5, floors: 3 });
  const envs = structureEnvelopes(plan);
  assert.equal(envs.length, plan.buildings.length + plan.connectors.length);
  for (const bd of plan.buildings) {
    const e = envs.find((x) => x.id === bd.id);
    assert.ok(e);
    assert.equal(e.top, buildingTopZ(plan, bd));
  }
});

test('facade styles and structure flag change the baked geometry', () => {
  const base = { seed: 3, pattern: 'spine', program: 'middle', floors: 2 };
  const counts = SCHOOL_FACADES.map((facade) => buildFractalSchoolFaces({ ...base, facade }).faces.length);
  assert.ok(new Set(counts).size >= 2, `facades should differ, got ${counts.join(', ')}`);
  const skinned = buildFractalSchoolFaces({ ...base, facade: 'brick-civic' }).faces.length;
  const open = buildFractalSchoolFaces({ ...base, facade: 'brick-civic', structure: false }).faces.length;
  assert.ok(skinned > open, `structure skin should add faces (${skinned} > ${open})`);
});

test('instancing moves classroom desks into repeats', () => {
  const plain = assembleFractalSchoolScene({ seed: 6, pattern: 'courtyard' });
  const inst = assembleFractalSchoolScene({ seed: 6, pattern: 'courtyard', instancing: true });
  assert.equal(plain.repeats, undefined);
  assert.ok(inst.repeats.length > 0);
  const depicted = inst.repeats.reduce((a, r) => a + r.template.length * r.transforms.length, 0);
  assert.ok(inst.faces.length + depicted > plain.faces.length * 0.9, 'repeat channel carries real depicted geometry');
  assert.ok(inst.repeatsInfo.instanced.every((r) => r.copies >= 2));
});

test('academic rooms stay inside their building shell (no overhang)', () => {
  for (const seed of SEEDS) {
    const plan = planFractalSchoolComplex({ seed });
    const byId = Object.fromEntries(plan.buildings.map((b) => [b.id, b.rect]));
    for (const room of plan.rooms) {
      const b = byId[room.building];
      assert.ok(room.rect.x0 >= b.x0 - 0.01 && room.rect.x1 <= b.x1 + 0.01
        && room.rect.y0 >= b.y0 - 0.01 && room.rect.y1 <= b.y1 + 0.01,
      `${room.id} escapes ${room.building} at seed ${seed}`);
    }
  }
});

test('doorways are open at eye height — entrance and classrooms are walkable', () => {
  const spec = { seed: 3, pattern: 'cluster', program: 'middle' };
  const plan = planFractalSchoolComplex(spec);
  const { faces } = buildFractalSchoolFaces(spec);
  const blocked = (x, y, z, tol = 0.4) => faces.some((f) => {
    const xs = f.corners.map((c) => c[0]), ys = f.corners.map((c) => c[1]), zs = f.corners.map((c) => c[2]);
    return Math.min(...xs) <= x && Math.max(...xs) >= x
      && Math.min(...ys) <= y + tol && Math.max(...ys) >= y - tol
      && Math.min(...zs) <= z && Math.max(...zs) >= z;
  });
  const ent = plan.buildings.find((b) => b.id === plan.entranceId);
  const op = ent.openings.find((o) => o.wall === 'S');
  assert.equal(blocked(op.center - 2.5, ent.rect.y0, 3), false, 'main entrance is a walkable void, not glazed shut');
  const cls = plan.rooms.find((r) => r.kind === 'classroom' && r.windowWall === 'S');
  assert.ok(cls, 'a north-corridor classroom exists');
  assert.equal(blocked(cls.rect.x0 + ROOM_DOOR_OFF, cls.rect.y1, 3), false, 'the classroom door is an opening, not a solid partition');
});

test('every occupiable room is walkable from the entrance across seeds and patterns', () => {
  for (const pattern of SCHOOL_PATTERNS) {
    for (const seed of SEEDS) {
      const w = assessSchoolWalkability({ seed, pattern, program: 'high-school' });
      assert.equal(w.ok, true, `${pattern} seed ${seed}: ${w.necessary.map((n) => n.detail).join('; ')}`);
      assert.ok(w.rooms >= 3 && w.reached === w.rooms);
    }
  }
});

test('walkability has teeth: bricking up the entrance strands rooms', () => {
  const plan = planFractalSchoolComplex({ seed: 3, pattern: 'spine', program: 'high-school' });
  for (const b of plan.buildings) b.openings = [];   // seal every door → nothing is reachable
  const w = assessSchoolWalkability(plan);
  assert.equal(w.ok, false);
  assert.ok(w.necessary.some((n) => n.rule === 'unwalkable-room'));
});

test('classrooms carry a teaching board and a desk+chair fit-out', () => {
  const { faces } = buildFractalSchoolFaces({ seed: 3, pattern: 'courtyard', program: 'high-school' });
  const board = faces.some((f) => f.fill === '#2f4b3a' || f.fill === '#eef1ee');   // chalk/whiteboard panel
  const chair = faces.some((f) => f.fill === '#7f8a93');                            // chair seat pan
  assert.ok(board, 'a teaching board is baked');
  assert.ok(chair, 'desks come with chairs');
});

test('building walls carry facade cards (brick punched windows vs glass grid)', () => {
  const brick = buildFractalSchoolFaces({ seed: 3, pattern: 'courtyard', program: 'high-school', facade: 'brick-civic' }).faces.filter((f) => f.card);
  assert.ok(brick.length >= 8, `brick campus has carded walls (${brick.length})`);
  assert.ok(brick.every((f) => f.card.material === 'brick'), 'brick body + punched windows');
  assert.ok(brick.every((f) => typeof f.lit === 'number'), 'each carded wall carries its Lambert lit');
  const glass = buildFractalSchoolFaces({ seed: 3, pattern: 'spine', program: 'middle', facade: 'glass-modern' }).faces.filter((f) => f.card);
  assert.ok(glass.some((f) => f.card.material === 'glass'), 'glass panes in a frame grid');
  // cards split around openings — the entrance wall is not one unbroken card
  const plan = planFractalSchoolComplex({ seed: 3, pattern: 'courtyard', program: 'high-school', facade: 'brick-civic' });
  const ent = plan.buildings.find((b) => b.id === plan.entranceId);
  const sCards = brick.filter((f) => f.corners.every((c) => Math.abs(c[1] - (ent.rect.y0 - 0.295)) < 0.1));
  assert.ok(sCards.length >= 2, 'the entrance (S) wall card is split around the doorway');
});

test('parking lots carry stalls and registry vehicles at car scale', () => {
  const plan = planFractalSchoolComplex({ seed: 3, pattern: 'courtyard', program: 'high-school' });
  const lots = plan.outdoor.filter((o) => o.kind === 'parking-lot');
  assert.equal(lots.length, 2, 'two parking lots');
  const { faces } = buildFractalSchoolFaces({ seed: 3, pattern: 'courtyard', program: 'high-school' });
  assert.ok(faces.some((f) => f.fill === '#42474e'), 'parking / driveway asphalt');
  // vehicles from the registry populate the lots (each swept car is hundreds of faces)
  assert.ok(faces.length > 20000, `registry vehicles fill the scene (${faces.length})`);
  // scale sanity: a sedan at VEHICLE_SCALE is a believable ~13–18ft long, ~6–9ft wide
  const car = vehicleFaces({ type: 'sedan', axis: 'x', scale: VEHICLE_SCALE });
  const xs = car.flatMap((f) => f.corners.map((c) => c[0])), ys = car.flatMap((f) => f.corners.map((c) => c[1]));
  const L = Math.max(...xs) - Math.min(...xs), W = Math.max(...ys) - Math.min(...ys);
  assert.ok(L > 13 && L < 18, `sedan length ${L.toFixed(1)}ft`);
  assert.ok(W > 6 && W < 9, `sedan width ${W.toFixed(1)}ft`);
});

test('vehicles keep doorway + entry clearance (aprons stay open at eye height)', () => {
  for (const pattern of SCHOOL_PATTERNS) {
    for (const seed of [1, 3, 6]) {
      const plan = planFractalSchoolComplex({ seed, pattern, program: 'high-school' });
      const { faces } = buildFractalSchoolFaces({ seed, pattern, program: 'high-school' });
      const b = plan.bounds, cell = 0.5, EYE = plan.baseZ + 3;
      const cols = Math.ceil((b.x1 - b.x0) / cell), rows = Math.ceil((b.y1 - b.y0) / cell);
      const ci = (x) => Math.min(cols - 1, Math.max(0, Math.floor((x - b.x0) / cell)));
      const ri = (y) => Math.min(rows - 1, Math.max(0, Math.floor((y - b.y0) / cell)));
      const blocked = new Uint8Array(cols * rows);
      for (const f of faces) {
        const zs = f.corners.map((c) => c[2]);
        if (Math.min(...zs) > EYE || Math.max(...zs) < EYE || Math.max(...zs) - Math.min(...zs) < 0.3) continue;
        const xs = f.corners.map((c) => c[0]), ys = f.corners.map((c) => c[1]);
        for (let cx = ci(Math.min(...xs)); cx <= ci(Math.max(...xs)); cx += 1) {
          for (let cy = ri(Math.min(...ys)); cy <= ri(Math.max(...ys)); cy += 1) blocked[cy * cols + cx] = 1;
        }
      }
      const cell0 = (x, y) => blocked[ri(y) * cols + ci(x)];
      const ent = plan.buildings.find((bd) => bd.id === plan.entranceId);
      const op = ent.openings.find((o) => o.wall === 'S');
      assert.equal(cell0(op.center, ent.rect.y0 - 5), 0, `${pattern} s${seed}: a vehicle blocks the entrance apron`);
      assert.equal(cell0(plan.spawn[0], plan.spawn[1] - 4), 0, `${pattern} s${seed}: a vehicle blocks the entry corridor`);
    }
  }
});

test('campus carries reusable tree assets and paved paths', () => {
  const { faces } = buildFractalSchoolFaces({ seed: 3, pattern: 'courtyard', program: 'high-school' });
  assert.ok(faces.some((f) => f.fill === '#b3ada0'), 'paved walkways / perimeter path');
  // the shared plant primitive (plantBoxToFaces) meshes each tree into many small foliage/trunk
  // faces — a bare campus is a few thousand faces; the tree ring pushes it well past that
  assert.ok(faces.length > 15000, `real tree assets bulk up the face list (${faces.length})`);
});

test('buildings and objects carry baked contact/cast shadow decals', () => {
  const { faces } = buildFractalSchoolFaces({ seed: 3, pattern: 'courtyard', program: 'high-school' });
  const shadows = faces.filter((f) => f.decal === 'shadow');
  const plan = planFractalSchoolComplex({ seed: 3, pattern: 'courtyard', program: 'high-school' });
  // at least one cast shadow per building, plus outdoor object blobs on top
  assert.ok(shadows.length >= plan.buildings.length, `expected ≥${plan.buildings.length} shadow decals, got ${shadows.length}`);
  assert.ok(shadows.every((f) => typeof f.shadowAlpha === 'number' && f.shadowAlpha > 0));
  // shadows are ground-flat, so they never block walkability (eye-height flood ignores them)
  assert.ok(shadows.every((f) => f.corners.every((c) => Math.abs(c[2]) < 0.1)));
  // opt-out drops them
  const bare = buildFractalSchoolFaces({ seed: 3, pattern: 'courtyard', program: 'high-school', shadows: false }).faces;
  assert.ok(!bare.some((f) => f.decal === 'shadow'));
});

test('the athletics precinct rings the campus with real fields and equipment', () => {
  for (const pattern of SCHOOL_PATTERNS) {
    const plan = planFractalSchoolComplex({ seed: 3, pattern, program: 'high-school' });
    const kinds = new Set(plan.outdoor.map((o) => o.kind));
    for (const need of ['soccer-field', 'baseball-diamond', 'basketball-court', 'playground']) {
      assert.ok(kinds.has(need), `${pattern} is missing a ${need}`);
    }
    // fields must not sit on top of a building
    const over = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
    for (const z of plan.outdoor) for (const bd of plan.buildings) {
      assert.ok(!over(z.rect, bd.rect), `${z.id} overlaps ${bd.id} in ${pattern}`);
    }
  }
  const { faces } = buildFractalSchoolFaces({ seed: 3, pattern: 'courtyard', program: 'high-school' });
  assert.ok(faces.some((f) => f.fill === '#d1662f'), 'outdoor basketball rims');
  assert.ok(faces.some((f) => f.fill === '#b98a5e'), 'baseball infield dirt');
  assert.ok(faces.some((f) => f.fill === '#5aa0c0'), 'a playground slide');
});

test('gymnasiums bake a court, hoops, and bleachers', () => {
  const { faces } = buildFractalSchoolFaces({ seed: 6, pattern: 'spine', program: 'high-school' });
  assert.ok(faces.some((f) => f.fill === '#c8a86a'), 'sprung court floor');
  assert.ok(faces.some((f) => f.fill === '#d1662f'), 'basketball rim');
});

test('feng-shui, livability, and principles come back clean for default seeds', () => {
  for (const seed of SEEDS) {
    const plan = planFractalSchoolComplex({ seed });
    const label = `seed ${seed} (${plan.pattern}, ${plan.program})`;
    const feng = assessSchoolFengShui(plan);
    assert.equal(feng.ok, true, `${label} feng-shui: ${feng.necessary.map((n) => n.detail).join('; ')}`);
    assert.equal(assessSchoolLivability(plan).ok, true, `${label} livability invariants`);
    const pr = assessSchoolPrinciples(plan);
    assert.equal(pr.ok, true, `${label} principles: ${pr.findings.filter((f) => f.severity === 'invariant').map((f) => f.detail).join('; ')}`);
    assert.deepEqual(pr.registers, ['code', 'livability', 'flow', 'fengshui']);
    assert.ok(pr.score > 0.6, `${label} score ${pr.score}`);
  }
});

test('feng-shui has teeth: a stair core dropped onto the entry axis flags a poison arrow', () => {
  const plan = planFractalSchoolComplex({ seed: 4, pattern: 'courtyard', program: 'middle' });
  const entry = plan.buildings.find((b) => b.id === plan.entranceId);
  const op = entry.openings.find((o) => o.wall === 'S');
  entry.core.rect = { x0: op.center - 3, x1: op.center + 3, y0: entry.rect.y1 - 6, y1: entry.rect.y1 - 1 };
  const feng = assessSchoolFengShui(plan);
  assert.equal(feng.ok, false);
  assert.ok(feng.necessary.some((n) => n.rule === 'axial-through-shot'));
});

test('BIM schedule projects element counts, seats, and gross floor area', () => {
  const plan = planFractalSchoolComplex({ seed: 5, pattern: 'spine', program: 'high-school' });
  const bim = schoolBim(plan);
  assert.equal(bim.elements.buildings, plan.buildings.length);
  assert.equal(bim.elements.rooms, plan.rooms.length);
  assert.ok(bim.elements.cores >= plan.buildings.length);
  assert.ok(bim.grossFloorArea > 0 && bim.seats > 0);
  assert.equal(Object.values(bim.rooms).reduce((a, b) => a + b, 0), plan.rooms.length);
});

test('scene assembles with faces, grounds, cameras, walk spawn, and assessment payloads', () => {
  for (const pattern of SCHOOL_PATTERNS) {
    const scene = assembleFractalSchoolScene({ seed: 6, pattern });
    assert.ok(hasFaces(scene.faces), `${pattern} bakes faces`);
    assert.ok(scene.grounds.length >= 2, `${pattern} has site grounds`);
    assert.ok(scene.cameras.length >= 3, `${pattern} has cameras`);
    assert.ok(scene.walk && Array.isArray(scene.walk.spawn), `${pattern} has walk spawn`);
    for (const key of ['reachability', 'daylight', 'egress', 'site', 'livability', 'fengshui', 'walkability', 'principles']) {
      assert.ok(scene[key] && scene[key].ok === true, `${pattern} carries passing ${key}`);
    }
    assert.ok(scene.bim && scene.bim.grossFloorArea > 0, `${pattern} carries a BIM schedule`);
    assert.equal(scene.school.pattern, pattern);
  }
});
