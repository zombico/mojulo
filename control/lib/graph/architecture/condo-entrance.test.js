import assert from 'node:assert';
import { test } from 'vitest';
import { planCondoEntrance, buildCondoEntranceFaces, assembleCondoEntranceScene, assessCondoFlow, assessCondoLivability, assessCondoEgress } from './condo-entrance.js';
import { assessFengShui } from '../worlds/movement-flow.js';

const hasFaces = (faces) => Array.isArray(faces) && faces.length > 0
  && faces.every((f) => Array.isArray(f.corners) && f.corners.length === 4 && typeof f.fill === 'string');

test('plan places a central node and one satellite per wing', () => {
  const plan = planCondoEntrance({ wings: ['W', 'E'] });
  assert.equal(plan.wings.length, 2);
  // satellites sit beyond the hallway, left and right of the central chamber
  const [w, e] = plan.wings;
  assert.ok(w.sat.x1 <= plan.central.rect.x0, 'west tower is west of the node');
  assert.ok(e.sat.x0 >= plan.central.rect.x1, 'east tower is east of the node');
  assert.ok(plan.bounds.x1 - plan.bounds.x0 > plan.central.w, 'bounds span the whole complex');
});

test('builds a connected concourse: chambers + halls + units bake to faces', () => {
  const { faces, plan } = buildCondoEntranceFaces({ seed: 7 });
  assert.ok(hasFaces(faces));
  // a node + 2 halls (each with units) + 2 towers is a lot of geometry
  assert.ok(faces.length > 400, `expected a rich concourse, got ${faces.length} faces`);
  assert.equal(plan.wings.length, 2);
});

test('more wings ⇒ more geometry (a third tower + hall + units)', () => {
  const two = buildCondoEntranceFaces({ wings: ['W', 'E'] }).faces.length;
  const three = buildCondoEntranceFaces({ wings: ['W', 'E', 'N'] }).faces.length;
  assert.ok(three > two, 'a third wing adds a hall, units, and a tower');
});

test('bigger central lift count ⇒ two hallways (more core geometry)', () => {
  const small = buildCondoEntranceFaces({ central: { w: 52, d: 40, elevators: 4 } }).faces.length;
  const big = buildCondoEntranceFaces({ central: { w: 52, d: 40, elevators: 8 } }).faces.length;
  assert.ok(big > small, 'an 8-lift node (2 hallways) carries more core faces than a 4-lift one');
});

test('articulated floor plate: opt-in caps the concourse with a stacked block + ceilings', () => {
  const open = buildCondoEntranceFaces({ seed: 7 }).faces.length;
  const capped = buildCondoEntranceFaces({ seed: 7 }, { plate: true }).faces.length;
  assert.ok(capped > open + 100, `the plate adds a stacked block + articulated ceilings (open ${open}, capped ${capped})`);
});

test('the plate flows through the scene assembler', () => {
  const open = assembleCondoEntranceScene({ seed: 3 }).faces.length;
  const capped = assembleCondoEntranceScene({ seed: 3 }, { plate: true }).faces.length;
  assert.ok(capped > open, 'plate:true yields a richer scene (block + ceilings)');
});

test('the plate builds a 2nd storey with vertical lift cores rising above the ground floor', () => {
  const { faces } = buildCondoEntranceFaces({ seed: 7, height: 12 }, { plate: true });
  let maxZ = -Infinity;
  for (const f of faces) for (const c of f.corners) if (c[2] > maxZ) maxZ = c[2];
  assert.ok(maxZ > 17, `a 2nd storey should rise well above the 12ft ground floor, got ${maxZ}`);
  // floor-1 plate + inset glazing + the lift cabs that serve upstairs all sit above the ceiling plane
  const aboveCeiling = faces.filter((f) => f.corners.every((c) => c[2] >= 11.99)).length;
  assert.ok(aboveCeiling > 50, `expected floor-1 + vertical-core geometry above the ceiling, got ${aboveCeiling}`);
});

test('feng-shui guard: a centered bank is a poison arrow, an offset one clears', () => {
  // an entry on the S wall (x=0) firing +y; a feature straddling x=0 is on the axis (poison arrow)
  const entry = { x: 0, y: 0, edge: 'S', label: 'door' };
  const onAxisFeature = { rect: { x: -5, y: 20, w: 10, h: 6 }, label: 'lifts' };
  const offAxisFeature = { rect: { x: 12, y: 20, w: 10, h: 6 }, label: 'lifts' };
  const bad = assessFengShui({ entries: [entry], features: [onAxisFeature] });
  assert.equal(bad.ok, false, 'a bank on the door axis is flagged');
  assert.ok(bad.necessary.some((n) => n.rule === 'axial-through-shot'));
  const good = assessFengShui({ entries: [entry], features: [offAxisFeature] });
  assert.equal(good.ok, true, 'an offset bank clears the check');
});

test('feng-shui guard: the condo default plan has no poison arrows', () => {
  for (const wings of [['W', 'E'], ['W', 'E', 'N']]) {
    const flow = assessCondoFlow({ wings });
    assert.equal(flow.ok, true, `${wings.join('+')}: ${flow.necessary.map((n) => n.detail).join('; ')}`);
  }
});

test('livability: every unit in the default concourse has an exterior window', () => {
  const live = assessCondoLivability({ wings: ['W', 'E'] });
  assert.equal(live.ok, true, live.necessary.map((n) => n.detail).join('; '));
  assert.equal(live.units, 8, 'perSide 2 × both sides × 2 wings');   // 2*2*2
  assert.equal(live.necessary.length, 0);
});

test('livability has teeth: a unit whose back wall lands inside a chamber is flagged windowless', () => {
  // a hand-built plan where a huge central chamber engulfs the units ⇒ their back walls are interior
  const engulfed = {
    bounds: { x0: -60, x1: 60, y0: -60, y1: 60 },
    central: { rect: { x0: -50, x1: 50, y0: -50, y1: 50 } },
    wings: [{ dir: 'E', hall: { axis: 'x', along0: 0, along1: 20, crossMid: 0, hallHalf: 5 }, sat: { x0: 20, x1: 40, y0: -10, y1: 10 }, satCoreWall: 'E' }],
    units: { perSide: 1, depth: 11, backDepth: 12 },
  };
  const live = assessCondoLivability(engulfed);
  assert.equal(live.ok, false, 'interior back walls must fail the window invariant');
  assert.ok(live.necessary.some((n) => n.rule === 'no-window'));
});

test('BIM egress: every building threads an accessible stair (default passes)', () => {
  const e = assessCondoEgress({ wings: ['W', 'E'] });
  assert.equal(e.ok, true, e.necessary.map((n) => n.detail).join('; '));
  assert.equal(e.buildings, 3, 'central + 2 satellites');
  assert.equal(e.stairs, 3, 'one accessible stair per building');
});

test('BIM egress has teeth: a building too small for a code stair is flagged', () => {
  const e = assessCondoEgress({ central: { w: 10, d: 10, elevators: 1 }, wings: ['W', 'E'] });
  assert.equal(e.ok, false, 'a 10×10 building cannot host an accessible switchback stair');
  assert.ok(e.necessary.some((n) => n.rule === 'no-egress-stair'));
});

test('concrete facade columns add envelope geometry and are toggle-able', () => {
  const withCols = buildCondoEntranceFaces({ seed: 7 }).faces.length;
  const without = buildCondoEntranceFaces({ seed: 7 }, { columns: false }).faces.length;
  assert.ok(withCols > without, `columns should add facade geometry (with ${withCols}, without ${without})`);
});

test('scene assembles with cameras and a walk spawn', () => {
  const scene = assembleCondoEntranceScene({ seed: 3 });
  assert.ok(hasFaces(scene.faces));
  assert.ok(scene.cameras.length >= 1);
  assert.ok(scene.walk && Array.isArray(scene.walk.spawn));
  assert.ok(scene.title);
  assert.ok(scene.flow && typeof scene.flow.ok === 'boolean', 'scene carries a feng-shui assessment');
  assert.ok(scene.livability && scene.livability.ok === true, 'scene carries a passing livability assessment');
  assert.ok(scene.egress && scene.egress.ok === true, 'scene carries a passing BIM egress assessment');
});
