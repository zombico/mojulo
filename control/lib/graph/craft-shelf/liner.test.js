// The airliner's made finish (liner-made.js): a civil hull's flight deck framed, its probes, beacons, APU exhaust, its
// doors' viewports and handles and its cargo holds' doors; a turbofan's intake open to a fan face behind its blades, its
// two nozzles and latches; a fighter's hull keeping its own; nothing of it without the word. Rows chosen in code.
import { describe, it, expect } from 'vitest';
import { CRAFT_ODM, resolveCraftPart } from './index.js';

const ids = (recipe) => ['lathes', 'sweeps', 'extrudes', 'lofts'].flatMap((k) => (recipe[k] ?? []).map((m) => m.id));
const LINER = Object.keys(CRAFT_ODM).find((k) => CRAFT_ODM[k].kind === 'craft-fuselage' && CRAFT_ODM[k].build.windscreen && CRAFT_ODM[k].build.windows && CRAFT_ODM[k].build.holds);
const FIGHTER = Object.keys(CRAFT_ODM).find((k) => CRAFT_ODM[k].kind === 'craft-fuselage' && CRAFT_ODM[k].realm === 'earth' && CRAFT_ODM[k].build.nose && !CRAFT_ODM[k].build.windows);
const FAN = Object.keys(CRAFT_ODM).find((k) => CRAFT_ODM[k].kind === 'craft-engine' && CRAFT_ODM[k].build.family === 'turbofan' && CRAFT_ODM[k].mount === 'pod-mount');

describe('the airliner\'s made finish', () => {
  it('a civil hull: its flight deck framed, its probes and beacons, the APU, its doors\' viewports, its holds; not without the word', () => {
    expect(LINER).toBeTruthy();
    const made = ids(resolveCraftPart(LINER, { made: true })), plain = ids(resolveCraftPart(LINER));
    for (const re of [/^deck_sill_/, /^deck_post_/, /^deck_centre$/, /^pitot_/, /^beacon_top/, /^beacon_belly/, /^apu_exhaust$/, /^door_\d+_viewport_/, /^door_\d+_handle_/]) expect(made.some((i) => re.test(i)), String(re)).toBe(true);
    const n = CRAFT_ODM[LINER].build.holds.length;
    for (let i = 0; i < n; i++) for (const e of ['fore', 'aft', 'sill', 'hinge', 'handle']) expect(made, `hold ${i} ${e}`).toContain(`hold_${i}_${e}`);
    expect(plain.some((i) => /^(deck_|pitot_|beacon_|apu_|hold_|door_\d+_viewport)/.test(i))).toBe(false);
    // (an airliner carries no fighter's IFF blades or heat bands)
    expect(made.some((i) => /^(iff_|heat_band)/.test(i))).toBe(false);
  });
  it('a fighter\'s hull keeps the fighter\'s finish', () => {
    const made = ids(resolveCraftPart(FIGHTER, { made: true }));
    expect(made.some((i) => /^iff_/.test(i))).toBe(true);
    expect(made.some((i) => /^(deck_|apu_|hold_)/.test(i))).toBe(false);
  });
  it('a turbofan: its intake open to a fan face behind its blades, its two nozzles, its latches; its disc without the word', () => {
    const made = resolveCraftPart(FAN, { made: true }), plain = resolveCraftPart(FAN), m = ids(made);
    expect(ids(plain)).toContain('fan');
    expect(m).not.toContain('fan');
    for (const id of ['intake_duct', 'fan_face', 'spinner_swirl', 'fan_nozzle', 'core_cowl', 'cowl_seam', 'latch_0']) expect(m, id).toContain(id);
    for (const id of ['nacelle', 'lip']) expect(made.lathes.find((q) => q.id === id).caps, id).toBe(false);
    // (the fan face stands behind the blades: further aft along the axis than the blades' roots)
    const face = made.lathes.find((q) => q.id === 'fan_face'), blade = made.sweeps.find((q) => q.id === 'blade_0');
    expect(face.axisFrom.y).toBeLessThan(Math.min(...blade.path.map((p) => p[1])));
  });
});
