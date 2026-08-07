import { describe, expect, it } from 'vitest';

import { createBusState, processEvents, stepTime, tickTimers, watchEvents, hashState } from '../event-bus.js';
import { resolveWorldScene } from '../world-scene.js';
import { emitThreeWorld } from '../../scene/scene-three.js';
import { buildWhackAMole } from './whack-a-mole.js';

const DT = 1 / 60;
const watchFix = (bus) => { let g = 0; while (g++ < 8) { const w = watchEvents(bus); if (!w.length) break; processEvents(bus, w); } };
// one frame, exactly as the /world events channel runs it: input → watches → recurring timers → awaits → watches.
function frame(bus, incoming) {
  if (incoming && incoming.length) processEvents(bus, incoming);
  watchFix(bus);
  const ticks = tickTimers(bus, DT); if (ticks.length) processEvents(bus, ticks);
  const timed = stepTime(bus, DT); if (timed.length) processEvents(bus, timed);
  watchFix(bus);
}
const upHole = (bus) => bus.entities.find((e) => e.id.startsWith('hole-') && e.on === true);

describe('whack-a-mole game logic (pure bus, no physics)', () => {
  it('moles pop up over time via recurring timers', () => {
    const { events } = buildWhackAMole();
    const bus = createBusState(events, events.entities);
    for (let i = 0; i < 120; i++) frame(bus);   // 2s
    expect(upHole(bus)).toBeTruthy();            // at least one mole is up
  });

  it('clicking an up mole scores through the tracker var and drops the mole', () => {
    const { events } = buildWhackAMole();
    const bus = createBusState(events, events.entities);
    let hit;
    for (let i = 0; i < 120 && !hit; i++) { frame(bus); hit = upHole(bus); }
    expect(hit).toBeTruthy();
    expect(bus.vars.score).toBe(0);
    frame(bus, [{ type: 'whack', target: hit.id }]);   // the pick deed
    expect(bus.vars.score).toBe(1);                     // score tied to the click, in the tracker
    expect(bus.byId[hit.id].on).toBe(false);            // the clicked mole dropped
  });

  it('the 10s countdown ends the game: over flag set, board cleared, banner shown', () => {
    const { events, ids } = buildWhackAMole();
    const bus = createBusState(events, events.entities);
    for (let i = 0; i < 11 * 60; i++) frame(bus);       // 11s — past the 10s buzzer
    expect(bus.vars.time).toBeLessThanOrEqual(0);
    expect(bus.vars.over).toBe(1);
    expect(bus.byId.banner.on).toBe(true);
    expect(ids.every((id) => bus.byId[id].on === false)).toBe(true);   // board cleared at the buzzer
  });

  it('after game-over the spawners are gated off — no mole pops again', () => {
    const { events } = buildWhackAMole();
    const bus = createBusState(events, events.entities);
    for (let i = 0; i < 11 * 60; i++) frame(bus);
    for (let i = 0; i < 180; i++) frame(bus);           // 3 more seconds
    expect(upHole(bus)).toBeFalsy();                    // nothing pops once `over` gates the timers
  });

  it('the no-input playthrough is byte-reproducible', () => {
    const run = () => { const { events } = buildWhackAMole(); const bus = createBusState(events, events.entities); for (let i = 0; i < 300; i++) frame(bus); return hashState(bus); };
    expect(run()).toBe(run());
  });
});

describe('whack-a-mole as a /world page', () => {
  it('resolves and emits a physics-free game page with pick + recurring timers + HUD', async () => {
    const { kind, events, faces } = buildWhackAMole();
    const out = await resolveWorldScene({ manifest: { kind, events, faces }, title: 'whack-a-mole' });
    expect(out.payload.events).toBeTruthy();
    expect(out.payload.physics).toBeUndefined();
    const html = emitThreeWorld({ ...out.payload });
    expect(html).toContain('__pickEntity');        // pointer-pick (raycast) wired
    expect(html).toContain('intersectObjects');
    expect(html).toContain('tickTimers');          // recurring timers driven each frame
    expect(html).toContain('__syncHud');           // score/time HUD
    expect(html).toContain('"on":"pick"');         // the pick input binding serialized
    expect(html).not.toContain('const PHYSICS =');
  });
});
