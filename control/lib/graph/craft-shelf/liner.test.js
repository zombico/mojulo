// The airliner's made finish (liner-made.js): a civil hull's flight deck framed, its probes, beacons, APU exhaust, its
// doors' viewports and handles and its cargo holds' doors; the airline looks (liner-looks.js): a tail, engines, belly,
// cheatline, emblem and plugged windows by the card, a registration aft; a turbofan's intake open to a fan face behind its blades, its
// two nozzles and latches; a fighter's hull keeping its own; nothing of it without the word. Rows chosen in code.
import { describe, it, expect } from 'vitest';
import { CRAFT_ODM, CRAFT_ARCHETYPES, resolveCraftPart, assembleCraft, measureCraft } from './index.js';
import { craftForm } from './craft-form.js';
import { LINER_LOOKS, LINER_LOOK_IDS } from './liner-looks.js';
import { lookCard } from './drone-looks.js';
import { lookFamily } from './heli-looks.js';

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

describe('the airline looks: one airframe read as any operator\'s, every scheme generic', () => {
  const ARCH = Object.keys(CRAFT_ARCHETYPES).find((k) => CRAFT_ARCHETYPES[k].role === 'liner' && CRAFT_ARCHETYPES[k].layout.some((e) => CRAFT_ODM[e.sku]?.kind === 'craft-engine'));
  const by = (pred) => LINER_LOOK_IDS.find((k) => pred(LINER_LOOKS[k].scheme));
  const form = (look) => craftForm(ARCH, { look, made: true, pose: { gear: 0 }, attitude: 'ground' });
  const item = (C, kind) => C.items.filter((it) => CRAFT_ODM[skuOf(it.id)]?.kind === kind);
  const skuOf = (id) => assembleCraft(ARCH).manifest.items.find((i) => i.id === id)?.source.garage.sku;
  const colours = (fs) => new Set(fs.map((f) => f.albedo));
  it('a liner\'s family is the airliner\'s; a card of another family refused', () => {
    expect(lookFamily(CRAFT_ARCHETYPES[ARCH], CRAFT_ODM)).toBe('liner');
    expect(() => lookCard('medevac', 'liner')).toThrow(/airliner look/);
  });
  it('its tail and engines in the scheme\'s colours, the emblem on the fin, the registration aft', () => {
    const look = LINER_LOOK_IDS.find((k) => LINER_LOOKS[k].scheme.emblem && LINER_LOOKS[k].scheme.engines !== LINER_LOOKS[k].livery.colours[0]), S = LINER_LOOKS[look].scheme, C = form(look);
    const fin = item(C, 'craft-fin').flatMap((it) => it.faces), eng = item(C, 'craft-engine').flatMap((it) => it.faces);
    expect(colours(fin.filter((f) => f.material === 'airPaint' && !f.fitting))).toContain(S.tail);
    expect(colours(eng.filter((f) => f.material === 'airPaint' && !f.fitting))).toContain(S.engines);
    expect(fin.some((f) => f.fitting === 'mark' && f.albedo === S.emblem.colour)).toBe(true);
    const hull = item(C, 'craft-fuselage').flatMap((it) => it.faces), ys = hull.flatMap((f) => f.corners.map((c) => c[1])), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const marks = hull.filter((f) => f.fitting === 'mark').flatMap((f) => f.corners.map((c) => c[1]));
    expect(marks.length).toBeGreaterThan(0);
    expect(Math.max(...marks)).toBeLessThan(y0 + 0.4 * (y1 - y0));
  });
  it('a belly cut under the waist, a cheatline along it, a freighter\'s windows plugged; nothing of a scheme without a look', () => {
    const belly = by((s) => s.belly), cheat = by((s) => s.cheat), plug = by((s) => s.plugs);
    const hullOf = (C) => item(C, 'craft-fuselage').flatMap((it) => it.faces);
    const B = hullOf(form(belly)), zs = B.flatMap((f) => f.corners.map((c) => c[2])), waist = (Math.min(...zs) + Math.max(...zs)) / 2;
    const under = B.filter((f) => f.albedo === LINER_LOOKS[belly].scheme.belly.colour && f.material === 'airPaint');
    expect(under.length).toBeGreaterThan(0);
    expect(under.every((f) => Math.min(...f.corners.map((c) => c[2])) < waist + 0.05)).toBe(true);
    expect(hullOf(form(cheat)).some((f) => f.albedo === LINER_LOOKS[cheat].scheme.cheat[0].colour && f.material === 'airPaint')).toBe(true);
    const glass = (C) => hullOf(C).filter((f) => f.material === 'canopy').length;
    expect(glass(form(plug))).toBeLessThan(glass(form(cheat)));
    const plain = hullOf(craftForm(ARCH, { made: true, pose: { gear: 0 }, attitude: 'ground' }));
    expect(plain.some((f) => f.albedo === LINER_LOOKS[cheat].scheme.cheat[0].colour)).toBe(false);
  });
});

describe('the jumbo: four engines, an upper deck over its nose', () => {
  // (the liner with an upper deck: the one whose hull carries more than one row of windows; chosen in code)
  const JUMBO = Object.keys(CRAFT_ARCHETYPES).find((k) => CRAFT_ARCHETYPES[k].role === 'liner' && Array.isArray(CRAFT_ODM[CRAFT_ARCHETYPES[k].layout[0].sku].build.windows));
  const hullSku = () => CRAFT_ARCHETYPES[JUMBO].layout[0].sku;
  it('at its reference\'s figures, on four engines and five legs', () => {
    expect(JUMBO).toBeTruthy();
    const { manifest } = assembleCraft(JUMBO, { pose: { gear: 0 }, attitude: 'ground' }), m = measureCraft(JUMBO, manifest), R = CRAFT_ARCHETYPES[JUMBO].reference;
    for (const k of ['span', 'length', 'height']) expect(Math.abs(m.measures[k] / R[k] - 1), k).toBeLessThan(0.06);
    const kinds = manifest.items.map((it) => it.source.garage.kind);
    expect(kinds.filter((k) => k === 'craft-engine')).toHaveLength(4);
    expect(kinds.filter((k) => k === 'craft-gear')).toHaveLength(5);
  });
  it('its upper deck a hump over its forward third, its windows in a row a deck, the first row\'s ids a single row\'s', () => {
    const st = CRAFT_ODM[hullSku()].build.stations, at = (s) => st.reduce((b, q) => (q[0] <= s ? q : b));
    const top = (s) => at(s)[3] * 1 + at(s)[2] / 2;
    expect(top(0.2)).toBeGreaterThan(top(0.6) + 0.05);
    const ids = ['lathes', 'sweeps', 'extrudes', 'lofts'].flatMap((k) => (resolveCraftPart(hullSku())[k] ?? []).map((m) => m.id));
    expect(ids.some((i) => /^window_\d+_[rl]$/.test(i))).toBe(true);
    for (const k of [1, 2]) expect(ids.some((i) => new RegExp(`^window_${k}_\\d+_[rl]$`).test(i)), `row ${k}`).toBe(true);
  });
});
