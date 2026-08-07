import { describe, expect, it } from 'vitest';

import { createState, step } from '../physics-sim.js';
import { createBusState, processEvents, deriveEvents, stepTime, linkPhysics, syncFromBodies, syncToBodies, hashState } from '../event-bus.js';
import { buildCradles } from './newton-cradles.js';

// ── THE PROOF: a complex action world driven entirely by the rules ─────────────────────────────
// Two independent Newton's cradles. Because every layer is pure + deterministic, the WHOLE world —
// physics, tether, bus, the physics↔policy bridge — runs here in node, no browser. This is what
// "the renderer just shows an already-decided truth" means: the truth is computed and asserted here.

const DT = 1 / 120;
const vlen = (v) => Math.hypot(v[0], v[1], v[2]);

// One combined tick, exactly as the browser channel will run it (step → bridge in → facts →
// reactions → timers → bridge out). `initial` arms the rig sagas before the loop starts.
function runWorld({ physics, events }, steps, window) {
  const from = window ? window.from : 0;
  const to = window ? window.to : steps;
  const phys = createState(physics);
  const bus = createBusState(events);
  linkPhysics(bus, phys);
  if (events.initial) processEvents(bus, events.initial);   // arm the rig sagas (they wait on a timer)
  let prev;
  const peakSpeed = {};                                       // peak |velocity| per ball, within [from,to)
  for (let i = 0; i < steps; i++) {
    step(phys, DT);
    syncFromBodies(bus, phys);
    const d = deriveEvents(phys, prev, events.sources); prev = d.prev;
    if (d.events.length) processEvents(bus, d.events);
    const timed = stepTime(bus, DT);
    if (timed.length) processEvents(bus, timed);
    syncToBodies(bus, phys);
    if (i >= from && i < to) for (const b of phys.bodies) peakSpeed[b.id] = Math.max(peakSpeed[b.id] || 0, vlen(b.velocity));
  }
  return { phys, bus, peakSpeed };
}

const clacks = (bus, scope) => bus.log.filter((r) => r.type === 'clack' && r.scope === scope).length;

describe("two Newton's cradles, rigged independently", () => {
  it('the rig momentum travels the WHOLE row and ejects the far (opposite) ball', () => {
    // Window each measurement to just after that cradle's rig fires (before the return swing).
    const a = runWorld(buildCradles(), 138, { from: 48, to: 138 }).peakSpeed;  // A rigs at 0.4s (step 48)
    expect(a['A-4']).toBeGreaterThan(0.9 * 5);   // far end, OPPOSITE the A-0 rig, ejects at ~full input
    // A's pulse cascades left→right in one solver pass → the textbook "skip the middle": middles still.
    expect(a['A-1']).toBeLessThan(0.5);
    expect(a['A-2']).toBeLessThan(0.5);
    expect(a['A-3']).toBeLessThan(0.5);

    const b = runWorld(buildCradles(), 258, { from: 168, to: 258 }).peakSpeed; // B rigs at 1.4s (step 168)
    expect(b['B-0']).toBeGreaterThan(0.9 * 6);   // far end, OPPOSITE the B-4 rig, ejects at ~full input
  });

  it('SCOPE ISOLATION: rigging only A leaves B completely silent (and vice-versa)', () => {
    const onlyA = buildCradles();
    onlyA.events = { ...onlyA.events, initial: onlyA.events.initial.filter((e) => e.cradle === 'A') };
    const a = runWorld(onlyA, 360);
    expect(clacks(a.bus, 'A')).toBeGreaterThan(0);          // A clicked
    expect(clacks(a.bus, 'B')).toBe(0);                     // B never emitted a clack
    expect(a.peakSpeed['B-0']).toBeLessThan(1e-6);          // not one B ball ever moved
    expect(a.peakSpeed['B-4']).toBeLessThan(1e-6);

    const onlyB = buildCradles();
    onlyB.events = { ...onlyB.events, initial: onlyB.events.initial.filter((e) => e.cradle === 'B') };
    const b = runWorld(onlyB, 360);
    expect(clacks(b.bus, 'B')).toBeGreaterThan(0);
    expect(clacks(b.bus, 'A')).toBe(0);
    expect(b.peakSpeed['A-0']).toBeLessThan(1e-6);
  });

  it('the rig is a REACTION reaching into physics: no impulse fires before its delay', () => {
    // A is armed with delay 0.4s; sample at 0.25s — nothing in A has moved yet.
    const early = runWorld(buildCradles(), 30); // 0.25s
    expect(early.peakSpeed['A-0']).toBeLessThan(1e-6);
    expect(clacks(early.bus, 'A')).toBe(0);
    // ...but by 1s the delayed impulse has fired and the row is clacking.
    const later = runWorld(buildCradles(), 120);
    expect(later.peakSpeed['A-0']).toBeGreaterThan(0);
    expect(clacks(later.bus, 'A')).toBeGreaterThan(0);
  });

  it('autonomous playthrough is byte-reproducible (physics + bus both deterministic)', () => {
    const run = () => {
      const { phys, bus } = runWorld(buildCradles(), 300);
      return hashState(bus) + '|' + JSON.stringify(phys.bodies.map((b) => b.position.map((x) => Math.round(x * 1e6))));
    };
    expect(run()).toBe(run());
  });
});
