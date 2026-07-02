import { describe, expect, it } from 'vitest';

import { structurizeFloorplan } from './floorplan-structure.js';
import { evaluateBuilding, REGISTERS } from './floorplan-principles.js';

const show = (label, r) => {
  /* eslint-disable no-console */
  console.log(`\n=== ${label} — score ${r.score}, ok=${r.ok} ===`);
  console.log('   by register:', Object.fromEntries(REGISTERS.map((k) => [k, `${r.byRegister[k].invariant}!/${r.byRegister[k].preferential}~`])));
  for (const f of r.findings) console.log(`   [${f.register}/${f.severity[0]}] ${f.id} — ${f.detail}`);
  console.log('');
  /* eslint-enable no-console */
};

describe('floorplan-principles: one register-tagged surface over livability + flow + feng shui', () => {
  it('evaluates a real house across all four registers', () => {
    const plan = structurizeFloorplan({ seed: 7, width: 44, height: 30 }, {}).plan;
    const r = evaluateBuilding({ rooms: plan.rooms, halls: plan.halls, doors: plan.doors, width: 44, height: 30 });

    expect(typeof r.ok).toBe('boolean');
    expect(r.score).toBeGreaterThan(0);
    for (const reg of REGISTERS) expect(r.byRegister[reg]).toBeTruthy();   // all four registers reported
    // every finding is tagged with a known register + severity
    for (const f of r.findings) {
      expect(REGISTERS).toContain(f.register);
      expect(['invariant', 'preferential']).toContain(f.severity);
    }
    show('HOUSE (residential)', r);
  });

  // role-carrying restaurant cells (what floorplan-restaurant.js now stamps): glyph = costume,
  // role = true space-type the program rules read.
  const W = 40, H = 30, backY = H - 12, restX = W - 10;
  const restaurant = (doors) => ({
    rooms: [
      { x: 0, y: 0, w: W, h: backY, glyph: 'L', role: 'dining' },
      { x: 0, y: backY, w: restX, h: H - backY, glyph: 'K', role: 'kitchenBOH' },
      { x: restX, y: backY, w: W - restX, h: H - backY, glyph: 'W', role: 'restroom' },
    ],
    halls: [], doors, width: W, height: H,
  });
  const streetEntry = { x: W / 2, y: 0, edge: 'S', leadsTo: 'entrance', width: 4 };
  const kitchenPass = { x: W / 2, y: backY, edge: 'N', kind: 'cased', width: 4 };          // dining ↔ kitchen
  const serviceExit = { x: 0, y: backY + (H - backY) / 2, edge: 'W', leadsTo: 'entrance', width: 3.5 };
  const diningToRestroom = { x: restX + (W - restX) / 2, y: backY, edge: 'N', width: 3 };   // dining ↔ restroom
  const kitchenToRestroom = { x: restX, y: backY + (H - backY) / 2, edge: 'E', width: 3 };  // kitchen ↔ restroom

  it('promotes role and runs the restaurant program — a sound restaurant passes', () => {
    const r = evaluateBuilding(restaurant([streetEntry, kitchenPass, diningToRestroom, serviceExit]), { program: 'restaurant' });
    // role flowed through (the rules could read it)
    expect(r.findings.every((f) => ['code', 'livability', 'flow', 'fengshui'].includes(f.register))).toBe(true);
    // FOH/BOH separation holds (restroom reachable from dining directly) → no such invariant
    expect(r.findings.some((f) => f.id === 'foh-boh-separation')).toBe(false);
    show('RESTAURANT — sound (restroom off the dining room)', r);
  });

  it('the restaurant program catches a restroom reachable only through the kitchen', () => {
    // drop the dining→restroom door; the ONLY way to the restroom is now via the kitchen
    const r = evaluateBuilding(restaurant([streetEntry, kitchenPass, kitchenToRestroom, serviceExit]), { program: 'restaurant' });
    const foh = r.findings.find((f) => f.id === 'foh-boh-separation');
    expect(foh).toBeTruthy();                 // the program rule fired
    expect(foh.universality).toBe('program'); // tagged as type-specific
    expect(foh.severity).toBe('invariant');
    expect(r.ok).toBe(false);
    show('RESTAURANT — broken (restroom only via the kitchen)', r);
  });
});
