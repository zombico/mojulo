import { describe, expect, it } from 'vitest';

import { createBusState, processEvents, stepTime, watchEvents } from './worlds/event-bus.js';
import { resolveWorldScene } from './worlds/world-scene.js';
import { emitThreeWorld } from './scene/scene-three.js';
import { buildVault } from './conceptual-vault.js';

// conceptual tick: incoming → watches→reactions to a fixed point → timer sequences.
function tick(bus, incoming, dt) {
  if (incoming && incoming.length) processEvents(bus, incoming);
  let g = 0; while (g++ < 8) { const w = watchEvents(bus); if (!w.length) break; processEvents(bus, w); }
  if (dt) { const t = stepTime(bus, dt); if (t.length) processEvents(bus, t); }
}

describe('conceptual-vault logic (no physics)', () => {
  it('grabbing all three keys unlocks the gate, then reveals the treasure after a beat', () => {
    const { events } = buildVault();
    const bus = createBusState(events, events.entities);

    tick(bus, [{ type: 'grab-key', key: 'key-1' }]);
    tick(bus, [{ type: 'grab-key', key: 'key-2' }]);
    expect(bus.byId.gate.on).toBe(true);                   // still closed — not all keys grabbed
    expect(bus.byId['key-1'].on).toBe(false);              // grabbed keys vanish

    tick(bus, [{ type: 'grab-key', key: 'key-3' }]);       // all grabbed → aggregate watch fires
    expect(bus.byId.gate.on).toBe(false);                  // gate opens (vanishes)
    expect(bus.log.filter((r) => r.type === 'unlocked')).toHaveLength(1);

    expect(bus.byId.treasure.on).toBe(false);              // not revealed yet
    for (let i = 0; i < 9; i++) tick(bus, [], 0.1);        // 0.9s crosses the 0.8s await
    expect(bus.byId.treasure.on).toBe(true);              // treasure revealed
  });
});

describe('conceptual-vault as a /world page', () => {
  it('resolves and emits a physics-FREE action world: events + input channels, no physics channel', async () => {
    const { kind, events, faces } = buildVault();
    const out = await resolveWorldScene({ manifest: { kind, events, faces }, title: 'vault' });
    expect(out.payload.events).toBeTruthy();
    expect(out.payload.physics).toBeUndefined();           // genuinely no physics
    expect(out.payload.nonBakeable).toBe(true);

    const html = emitThreeWorld({ ...out.payload });
    expect(html).toContain('window.__mojBus');             // the bus channel
    expect(html).not.toContain('const PHYSICS =');         // but NO physics channel emitted
    expect(html).toContain('__inputQueue');                // input → bus events wired
    expect(html).toContain('"type":"grab-key"');           // the key bindings serialized
  });
});
