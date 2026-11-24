// A LOCK across the way (mechanics.js `lock`): a seal in a doorway that walking into opens for good where the bag holds
// its key (kept), else says what opens it and puts the walker back. Not an end: the way on is only barred.
import { describe, it, expect } from 'vitest';
import { composeMechanics } from './mechanics.js';
import { buildBus } from '../worlds/event-bus.js';

const B = buildBus();
const ctx = { player: 'hero', spawn: [0, 0, 0], fall: 'none' };
const EXIT = { kind: 'reach-exit', at: [30, 0, 0] };
const LOCK = { kind: 'lock', id: 'vault', key: 'vault-key', name: 'Vault Key', at: [10, 0, 0], back: [7, 0, 0] };

function walk(spots, vars = {}) {
  const ev = composeMechanics([LOCK, EXIT], ctx).events, s = B.createBusState(ev, ev.entities);
  Object.assign(s.vars, vars);
  let prev, warps = [];
  const pump = (list) => { B.processEvents(s, list); let w = B.watchEvents(s); while (w.length) { B.processEvents(s, w); w = B.watchEvents(s); } };
  pump([]);
  for (const at of spots) for (let f = 0; f < 3; f++) {
    const z = B.deriveZoneEvents([{ id: 'hero', position: at }], prev, ev.sources);
    prev = z.prev; pump(z.events);
    if (s._ctrlWarps) { warps.push(s._ctrlWarps.hero); s._ctrlWarps = null; }
  }
  return { s, warps, log: s.log.map((r) => r.type) };
}

describe('a lock across the way', () => {
  it('without its key: says so and puts the walker back, its seal standing', () => {
    const { s, warps, log } = walk([[0, 0, 0], [10, 0, 0]]);
    expect(log).toContain('lock:shut:vault');
    expect(warps.length).toBeGreaterThan(0);
    expect(warps[0]).toEqual([7, 0, 0]);
    expect(s.byId['lock-vault'].on).toBe(true);
  });

  it('with its key: opens for good, its seal off, the key kept; walked again, it asks nothing', () => {
    const { s, warps, log } = walk([[0, 0, 0], [10, 0, 0], [0, 0, 0], [10, 0, 0]], { 'held:bag:vault-key': 1 });
    expect(log.filter((t) => t === 'lock:open:vault')).toHaveLength(1);
    expect(warps).toEqual([]);
    expect(s.byId['lock-vault'].on).toBe(false);
    expect(s.vars['held:bag:vault-key']).toBe(1);
  });

  it('is read and taught', () => {
    expect(() => composeMechanics([{ ...LOCK, back: undefined }, EXIT], ctx)).toThrow(/back where a walker/);
    expect(() => composeMechanics([{ ...LOCK, key: '' }, EXIT], ctx)).toThrow(/key is the bag item/);
  });
});
