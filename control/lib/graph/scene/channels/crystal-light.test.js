import { describe, expect, it } from 'vitest';
import { emitThreeWorld } from '../scene-three.js';
import { EMIT_FIXTURES } from '../emit-fixtures.js';

const fx = (name) => EMIT_FIXTURES.find(([n]) => n === name)[1];

describe('the crystal light channel on the World page', () => {
  it('emits its block and its step slot only with a resolved rig', () => {
    const html = emitThreeWorld(fx('crystal-light'));
    expect(html).toContain('let stepCrystalLight'); expect(html).toMatch(/function __mojStep\(t\) \{[^}]* stepCrystalLight\(t\);/);
    expect(html).toContain('function rigKernel()');
    const plain = emitThreeWorld(fx('crystal')); expect(plain).not.toContain('stepCrystalLight'); expect(plain).not.toContain('rigKernel');
  });
  it('a spec that does not resolve emits nothing (the mint gate names the error)', () => {
    expect(emitThreeWorld({ ...fx('crystal-light'), crystalLight: { lamps: [] } })).toBe(emitThreeWorld(fx('crystal')));
  });
  it('groups a mover drives are raycast live, not baked into the occluder', () => {
    const html = emitThreeWorld({ ...fx('crystal-light'), movers: [{ group: 'floor', turn: { axis: [0, 0, 1], center: [0, 0, 0], absolute: true }, states: [0, 1] }] });
    expect(html).toMatch(/"dynamic":\["floor"\]/);
  });
  it('a crystal a mover turns throws its print live: the print kernel rides the page, the static prints leave it out', () => {
    const html = emitThreeWorld(fx('crystal-moving')); expect(html).toContain('function printKernel()'); expect(html).toMatch(/const LIVE = \{"stones":\[\{"group":"gem","gem":"calcite"/);
    expect(html).toMatch(/const CRY = \{[^\n]*"prints":\[\]/);
    const still = emitThreeWorld({ ...fx('crystal-moving'), movers: [] }); expect(still).not.toContain('printKernel'); expect(still).not.toMatch(/"prints":\[\]/);
  });
});
