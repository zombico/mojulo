// The made finish, part by part (air-made.js through craft-parts.js's builders): each part kind of a fighter carrying
// what makes it read as built (the radome's break, the vanes and blades, the heat's bands; the canopy's frame; the
// intake's lip and its deep duct; the petal nozzle; treaded tyres, a brake line, the taxi light; the hinge gaps, the
// actuators, the flap line, the nav light in its cover, the fin's cap and beacon; a missile's bands, seeker and canards);
// the gear's wells and doors on the airframe, open with the leg down and shut up, a leg standing in a chin intake's duct
// under the duct; a spacecraft and a part without the word built as they always were; a folding-wing fighter made too.
// The cases are chosen from the shelf in code.
import { describe, it, expect } from 'vitest';
import { assembleCraft, resolveCraftPart } from './index.js';
import { craftForm } from './craft-form.js';
import { CRAFT_ARCHETYPES } from './craft-archetypes.js';
import { CRAFT_ODM } from './craft-odm.js';

const A = CRAFT_ARCHETYPES;
const JET = Object.keys(A).find((k) => A[k].realm === 'earth' && A[k].role === 'superiority' && /F-/.test(A[k].classOf));
const MONO = ['lathes', 'extrudes', 'sweeps', 'lofts'];
const sourceOf = (manifest, id) => manifest.items.find((i) => i.id === id).source;
const idsOf = (src) => MONO.flatMap((k) => (src[k] ?? []).map((m) => m.id));
const monoOf = (src, id) => MONO.flatMap((k) => src[k] ?? []).find((m) => m.id === id);
const made = assembleCraft(JET, { made: true }).manifest;
const has = (item, ...want) => { const ids = idsOf(sourceOf(made, item)); for (const w of want) expect(ids.some((i) => (w instanceof RegExp ? w.test(i) : i === w)), `${item}: ${w}`).toBe(true); };

describe('a fighter, part by part, made', () => {
  it('its hull: the radome\'s break, the vanes and blades, the bands the engine\'s heat leaves', () => {
    has('hull', 'radome_break', 'aoa_r', 'aoa_l', 'iff_top', 'iff_belly', 'heat_band_0', 'heat_band_2');
  });
  it('its canopy\'s frame, its intake\'s lip and lined duct, its engine\'s petal nozzle', () => {
    has('canopy', 'sill_r', 'sill_l', 'frame_aft');
    has('intake', 'lip', 'liner', 'duct_end');
    expect(monoOf(sourceOf(made, 'intake'), 'duct').caps).toBe(false);
    const eng = idsOf(sourceOf(made, 'engine'));
    expect(eng.filter((i) => /^nozzle_petal_/.test(i)).length).toBeGreaterThan(10);
    expect(eng).not.toContain('burner');
  });
  it('its wing\'s hinge gaps on both faces, its actuators, its flap line, the nav light in a clear cover', () => {
    has('wing-r', /^hinge_.*_upper/, /^hinge_.*_lower/, /^actuator_/, 'le_flap_upper', 'le_flap_lower', 'nav_light_bulb', 'nav_light_cover');
    const src = sourceOf(made, 'wing-r');
    expect(idsOf(src)).not.toContain('nav_light');
    // (its bulb still read as the side's nav light in the form render)
    expect(craftForm(JET, { made: true }).items.flatMap((i) => i.faces).some((f) => /^nav(Red|Green)$/.test(f.material))).toBe(true);
    has('fin', /^hinge_rudder_/, 'cap', 'beacon_bulb');
  });
  it('its gear on treaded tyres, a brake line down each leg, the taxi light on the nose leg; a missile\'s bands, seeker and canards', () => {
    has('main-r', 'brake_line', /_tyre$/, /_hub$/, /_brake$/);
    has('nose', 'taxi_light_bulb');
    // (a tread ribbed: its section rises and falls round its crown)
    const r = monoOf(sourceOf(made, 'main-r'), 'w_tyre').profile.map((p) => p.radius);
    expect(r.filter((v, i) => i && v < r[i - 1]).length).toBeGreaterThan(3);
    has('missile-r', 'band_warhead', 'band_motor', 'seeker', 'canard_0', 'canard_3');
  });
});

describe('the gear\'s wells and doors, the airframe\'s', () => {
  const door = (m) => { const s = sourceOf(m, 'hull'), d = s.extrudes.find((e) => e.id === 'well_mainGear_r_door_r'); return [d.axisTo.x - d.axisFrom.x, d.axisTo.y - d.axisFrom.y, d.axisTo.z - d.axisFrom.z]; };
  it('a well for each retracting leg, both sides of a pair, on the hull, not on the leg that swings', () => {
    has('hull', 'well_mainGear_r_roof', 'well_mainGear_l_roof', 'well_noseGear_roof', /^well_mainGear_r_rib_/, /^well_noseGear_door_/);
    expect(idsOf(sourceOf(made, 'main-r')).some((i) => /^well/.test(i))).toBe(false);
  });
  it('its doors hang open with the leg down and lie shut under the well with it up', () => {
    const down = door(assembleCraft(JET, { made: true, pose: { gear: 0 } }).manifest), up = door(assembleCraft(JET, { made: true, pose: { gear: 1 } }).manifest);
    // (a door's thickness runs along its normal: across with it hanging, up and down with it shut)
    expect(Math.abs(down[2])).toBeLessThan(1e-3);
    expect(Math.abs(up[0])).toBeLessThan(1e-3);
    expect(Math.abs(up[2])).toBeGreaterThan(0.005);
  });
  it('a leg standing in a chin intake\'s duct has its well under the duct, not on the hull\'s skin inside it', () => {
    const intake = A[JET].layout.find((e) => CRAFT_ODM[e.sku].kind === 'craft-intake');
    if (CRAFT_ODM[intake.sku].build.family !== 'chin') return;
    const hull = sourceOf(made, 'hull'), ip = hull.garage.hardpoints[intake.at.split('.')[1]], h = CRAFT_ODM[intake.sku].dims.height;
    const z = hull.extrudes.find((e) => e.id === 'well_noseGear_roof').axisFrom.z;
    expect(z).toBeLessThan(ip[2] - h * 0.85);
    expect(z).toBeGreaterThan(ip[2] - h * 1.1);
  });
});

describe('without it, and where it is not an aircraft\'s', () => {
  it('a spacecraft\'s parts made are built as they always were', () => {
    const SPACE = Object.keys(A).find((k) => A[k].realm === 'space');
    for (const { sku } of A[SPACE].layout) expect(JSON.stringify(resolveCraftPart(sku, { made: { canopy: null, mounts: [] } })), sku).toBe(JSON.stringify(resolveCraftPart(sku)));
  });
  it('the fighter\'s parts without the word carry none of it', () => {
    const plain = assembleCraft(JET).manifest;
    for (const it of plain.items) expect(idsOf(it.source).filter((i) => /^(radome_break|heat_band|well_|hinge_|actuator_|nozzle_petal|lip$|sill_|band_|canard_|brake_line)/.test(i)), it.id).toEqual([]);
  });
});

describe('the other military rows on the same parts', () => {
  // (a folding-wing fighter, chosen by its wing's fold: its hinges and actuators on both panels, folded)
  const FOLD = Object.keys(A).find((k) => A[k].realm === 'earth' && A[k].layout.some((e) => CRAFT_ODM[e.sku]?.build?.fold && CRAFT_ODM[e.sku].kind === 'craft-wing'));
  it('made with its wings folded: within a fighter\'s budget, every face wound to its normal, the same twice', () => {
    const C = craftForm(FOLD, { made: true, pose: { gear: 0 } });
    const fs = C.items.flatMap((i) => i.faces);
    expect(fs.reduce((s, f) => s + f.corners.length - 2, 0)).toBeLessThan(80000);
    expect(JSON.stringify(craftForm(FOLD, { made: true, pose: { gear: 0 } }))).toBe(JSON.stringify(C));
    const m = assembleCraft(FOLD, { made: true, fold: 1 }).manifest;
    expect(idsOf(sourceOf(m, 'wing-r')).some((i) => /^hinge_/.test(i))).toBe(true);
  });
});
