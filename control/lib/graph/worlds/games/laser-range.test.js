import { describe, expect, it } from 'vitest';

import { createBusState, processEvents, stepTime, tickTimers, watchEvents, hashState } from '../event-bus.js';
import { resolveWorldScene } from '../world-scene.js';
import { emitThreeWorld } from '../../scene/scene-three.js';
import { buildLaserRange } from './laser-range.js';

// One frame of the physics-free game loop, exactly as the /world events channel runs it: input →
// watches → recurring timers (the spawn heartbeats) → saga timers (the ephemeral lifetimes) → watches.
const DT = 1 / 60;
const watchFix = (bus) => { let g = 0; while (g++ < 8) { const w = watchEvents(bus); if (!w.length) break; processEvents(bus, w); } };
function frame(bus, incoming) {
  if (incoming && incoming.length) processEvents(bus, incoming);
  watchFix(bus);
  const ticks = tickTimers(bus, DT); if (ticks.length) processEvents(bus, ticks);
  const timed = stepTime(bus, DT); if (timed.length) processEvents(bus, timed);
  watchFix(bus);
}

// scripted laser shots (the deeds): the renderer resolves the LOS hit id, so in node we inject the
// resolved `shot` directly — the same way whack-a-mole injects `whack`. State-independent ⇒ identical
// across runs ⇒ a sound replay oracle.
const SHOTS = { 40: 'sphere-0', 80: 'sphere-1', 130: 'sphere-2', 200: 'sphere-3', 260: 'sphere-4' };
const HORIZON = 360;   // 6s — past a 5s round

function playthrough(events) {
  const bus = createBusState(events, events.entities);
  let everSpawned = false;
  for (let i = 0; i <= HORIZON; i++) {
    frame(bus, SHOTS[i] ? [{ type: 'shot', target: SHOTS[i] }] : null);
    if (!everSpawned && bus.entities.some((e) => e.id.startsWith('sphere-') && e.on)) everSpawned = true;
  }
  return { bus, everSpawned };
}

describe('laser-range — the capstone game logic (pure bus, no physics, raycast simulated)', () => {
  it('is byte-reproducible across runs (seeded heartbeats + saga lifetimes)', () => {
    const run = () => hashState(playthrough(buildLaserRange({ seconds: 5 }).events).bus);
    expect(run()).toBe(run());
  });

  it('the proof is non-trivial: spheres appear, shots score through the tracker, the round ends + clears', () => {
    const { bus, everSpawned } = playthrough(buildLaserRange({ seconds: 5 }).events);
    expect(everSpawned).toBe(true);                              // spawnOnHeartbeat + ephemeralTarget actually fired
    expect(bus.vars.score).toBe(5);                             // five scripted hits landed in the tracker
    expect(bus.vars.time).toBeLessThanOrEqual(0);              // the round clock ran out
    expect(bus.vars.over).toBe(1);                             // game-over
    const { ids } = buildLaserRange({ seconds: 5 });
    expect(ids.every((id) => bus.byId[id].on === false)).toBe(true);   // board cleared at the buzzer
  });

  it('a sphere a shot drops stays consistent (hit target toggles off, score still counts)', () => {
    const { events } = buildLaserRange({ seconds: 30 });
    const bus = createBusState(events, events.entities);
    for (let i = 0; i < 90 && !bus.byId['sphere-0'].on; i++) frame(bus);   // wait for sphere-0 to pop
    expect(bus.byId['sphere-0'].on).toBe(true);
    frame(bus, [{ type: 'shot', target: 'sphere-0' }]);
    expect(bus.byId['sphere-0'].on).toBe(false);               // the hit sphere dropped
    expect(bus.vars.score).toBe(1);
  });
});

describe('laser-range emitted as a /world page', () => {
  it('assembles the room + WASD walk + LOS laser + spheres + HUD into one live page', async () => {
    const out = await resolveWorldScene({ manifest: buildLaserRange({ seconds: 30 }), title: 'laser range' });
    expect(out.payload.walk).toBe(true);                        // WASD first-person opted in
    expect(out.payload.events).toBeTruthy();
    expect(out.payload.physics).toBeUndefined();                // physics-free
    const html = emitThreeWorld({ ...out.payload });
    expect(html).toContain('enterFirstPerson');                 // walk-camera machinery
    expect(html).toContain('walkColliders');                    // walls collide for walking…
    expect(html).toContain('__shotRay');                        // …and the LOS laser (camera-forward here; `from` aims from an entity)
    expect(html).toContain('__laserFlash');                     // the beam flash
    expect(html).toContain("i.on === 'fire'");                 // the laser sight (reticle) is wired
    expect(html).toContain('intersectObjects(scene.children, true)');   // shot occlusion (nearest hit)
    expect(html).toContain('"on":"fire"');                     // the fire input binding
    expect(html).toContain('__syncHud');                        // score/time HUD
    expect(html).toContain('sphere-0');                         // a sphere entity made it into the page
    expect(html).not.toContain('const PHYSICS =');              // physics-free world
  });
});
