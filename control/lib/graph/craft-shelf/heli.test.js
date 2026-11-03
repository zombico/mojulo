// The helicopter parts on the craft shelf (heli-odm.js, heli-parts.js, heli-archetypes.js): a main rotor's head (its
// mast, the swashplate's two rings, a pitch link and a grip per blade, the hub and its cap) and its blades (drooping toward
// their tips, washing out, banded), spun by the pose with its hub still, folding aft; a tail rotor and a ducted fan; a
// tail rotor's thrust against its main rotor's torque; a helicopter standing on its skids, its rotor clear above its
// head, its rotors spinning in its figure, within its budget; a helicopter by the words people say; its cockpit, a part
// of its own (side by side or tandem, its seats, panel and controls), inside its cabin under its bubble; the airframes (a
// utility machine on its wheels, an armoured tandem attack helicopter with its kit on its stub wings and its gun under its
// nose, a tandem-rotor transport whose rotors turn against each other with their blades meshed); a faceted hull opened
// with its panels flat; the kit. The cases are chosen from the shelf in code.
import { describe, it, expect } from 'vitest';
import { assembleCraft, resolveCraftPart, CRAFT_ODM, CRAFT_ARCHETYPES } from './index.js';
import { CRAFT_PALETTES } from './craft-common.js';
import { validateBytes } from 'gltf-validator';
import { facesToGlb } from '../scene/scene-gltf.js';
import { craftForm, craftFormFigure } from './craft-form.js';
import { HELI_ODM, HELI_KINDS } from './heli-odm.js';
import { buildCockpit } from './cockpit-parts.js';
import { HELI_LOOKS, HELI_ARMS, HELI_STATIONS } from './heli-looks.js';
import { lookCard, DRONE_LOOK_IDS } from './drone-looks.js';
import { resolveVehicle, handlesOf } from '../vehicle-registry/roster.js';

const A = CRAFT_ARCHETYPES;
const HELIS = Object.keys(A).filter((k) => A[k].layout.some((e) => CRAFT_ODM[e.sku]?.kind === 'heli-rotor'));
const LIGHT = HELIS[0];
const skuOf = (kind, family) => Object.keys(HELI_ODM).find((s) => HELI_ODM[s].kind === kind && (!family || HELI_ODM[s].build.family === family));
const ids = (src) => ['lathes', 'sweeps', 'extrudes', 'lofts'].flatMap((k) => (src[k] ?? []).map((m) => m.id));
const loft = (src, id) => src.lofts.find((l) => l.id === id);
const P = (p) => [p.x, p.y, p.z];

describe('the main rotor', () => {
  const sku = skuOf('heli-rotor'), row = HELI_ODM[sku], src = resolveCraftPart(sku, { seat: 'mount' }), n = row.build.blades;
  it('its head: the mast, the swashplate\'s two rings, a pitch link, a grip and a bearing per blade, the hub and its cap', () => {
    const got = ids(src);
    for (const id of ['mast', 'swash_low', 'swash_up', 'hub', 'cap', 'scissors']) expect(got, id).toContain(id);
    for (const re of [/^pitch_link_/, /^grip_/, /^bearing_/, /^blade_\d+$/, /^blade_\d+_tip$/]) expect(got.filter((i) => re.test(i)).length, String(re)).toBe(n);
  });
  it('its blades droop toward their tips and reach its radius; spun, they turn about the hub, which stays', () => {
    const b = loft(src, 'blade_0'), tip = loft(src, 'blade_0_tip');
    expect(tip.axisTo.z).toBeLessThan(b.axisFrom.z);
    expect(Math.hypot(tip.axisTo.x, tip.axisTo.y)).toBeCloseTo(row.dims.diameter / 2, 1);
    const spun = resolveCraftPart(sku, { seat: 'mount', pose: { rotor: 40 } });
    expect(spun.lathes.find((l) => l.id === 'hub')).toEqual(src.lathes.find((l) => l.id === 'hub'));
    expect(P(loft(spun, 'blade_0_tip').axisTo)).not.toEqual(P(tip.axisTo));
  });
  it('folded, every blade lies aft along the boom', () => {
    const f = resolveCraftPart(sku, { seat: 'mount', fold: 1 });
    for (let k = 0; k < n; k++) {
      const t = loft(f, `blade_${k}_tip`).axisTo;
      expect(t.y).toBeLessThan(-row.dims.diameter * 0.35);
      expect(Math.abs(t.x)).toBeLessThan(row.dims.diameter * 0.12);
    }
  });
});

describe('the tail', () => {
  it('a tail rotor and a ducted fan, each spinning about the craft\'s x; the fan\'s shroud open, a fin\'s root on top', () => {
    for (const fam of ['rotor', 'fan']) {
      const src = resolveCraftPart(skuOf('heli-tail', fam), { seat: 'mount' });
      expect(src.garage.joints[0].dir.slice(1)).toEqual([0, 0]);
      expect(ids(src).filter((i) => /^blade_\d+$/.test(i)).length).toBe(HELI_ODM[skuOf('heli-tail', fam)].build.blades);
    }
    const fan = resolveCraftPart(skuOf('heli-tail', 'fan'), { seat: 'mount' });
    expect(fan.lathes.filter((l) => /^shroud_/.test(l.id)).every((l) => l.caps === false)).toBe(true);
    expect(fan.garage.hardpoints.finRoot[2]).toBeGreaterThan(HELI_ODM[skuOf('heli-tail', 'fan')].dims.diameter / 2);
  });
  it('a tail rotor\'s thrust (its blades\' lift, toward its own +x unless mirrored) against its main rotor\'s torque', () => {
    for (const k of HELIS) {
      const { manifest } = assembleCraft(k), main = manifest.items.find((i) => i.source.garage.kind === 'heli-rotor'), tail = manifest.items.find((i) => i.source.garage.kind === 'heli-tail');
      if (!tail) continue;
      // (a rotor turning anticlockwise seen from above turns its fuselage clockwise, nose right: its tail rotor pushes
      // the tail right, +x, to hold it)
      const turn = main.source.garage.joints[0].dir[2] * ((main.flip || '').includes('x') ? -1 : 1), thrust = (tail.flip || '').includes('x') ? -1 : 1;
      expect(thrust, k).toBe(turn);
    }
  });
});

describe('a helicopter', () => {
  it('stands on its skids, level, its rotor clear above its head; at its class\'s figures', () => {
    const { readout } = assembleCraft(LIGHT);
    expect(readout.gear.length).toBe(2);
    for (const g of readout.gear) expect(Math.abs(g.contact[2])).toBeLessThan(0.002);
    expect(readout.clearance['heli-rotor']).toBeGreaterThan(2);
    expect(readout.audit.ok).toBe(true);
    expect(Math.abs(readout.measures.length / readout.reference.length - 1)).toBeLessThan(0.08);
  });
  it('its rotors spinning in its figure: a bone at each hub, the main about the vertical, the tail about the craft\'s x', () => {
    const C = craftForm(LIGHT), F = craftFormFigure(LIGHT, { spin: true });
    const main = C.spins.find((s) => s.axis[2] === 1), tail = C.spins.find((s) => s.axis[0] === 1);
    expect(main && tail).toBeTruthy();
    expect(F.bones.find((b) => b.id === main.id).head).toEqual(main.hub);
    expect(F.clips.idle).toEqual(F.clips.spin);
  });
  it('within its budget; the same twice; found by the words people say', () => {
    const C = craftForm(LIGHT, { pose: { gear: 0 }, attitude: 'ground' });
    expect(C.items.flatMap((i) => i.faces).reduce((s, f) => s + f.corners.length - 2, 0)).toBeLessThan(50000);
    expect(JSON.stringify(craftForm(LIGHT))).toBe(JSON.stringify(craftForm(LIGHT)));
    expect(handlesOf(resolveVehicle('news helicopter').id).craft).toEqual([LIGHT]);
    expect(Object.keys(HELI_KINDS).every((k) => Object.values(HELI_ODM).some((r) => r.kind === k))).toBe(true);
  });
});

describe('the cockpit, a part of its own', () => {
  const ck = (row) => buildCockpit(row, {});
  const idsOf = (g) => ['lathes', 'sweeps', 'extrudes'].flatMap((k) => (g[k] ?? []).map((m) => m.id));
  it('side by side: a seat and its controls each, one panel across, a console between, a bench behind', () => {
    const g = ck({ dims: { length: 2.6, width: 1.4, height: 1.1 }, build: { layout: 'side', seats: 2, panel: 'glass', controls: 'heli', bench: 3 } }), got = idsOf(g);
    for (const i of [0, 1]) for (const p of ['seat_%_pan', 'seat_%_back', 'seat_%_headrest', 'seat_%_strap_l', 'ctl_%_cyclic', 'ctl_%_collective', 'ctl_%_pedal_r']) expect(got, p.replace('%', i)).toContain(p.replace('%', i));
    for (const p of ['panel', 'panel_shield', 'console', 'bench', 'bench_back']) expect(got, p).toContain(p);
    expect(got.filter((i) => /^panel_display_/.test(i)).length).toBeGreaterThan(1);
  });
  it('tandem: the seats down the centreline, the rear one raised, a panel before each; a stick or a yoke when asked', () => {
    const g = ck({ dims: { length: 3.2, width: 0.9, height: 1.2 }, build: { layout: 'tandem', seats: 2, panel: 'dials', controls: 'stick' } }), got = idsOf(g);
    for (const p of ['panel_0', 'panel_1', 'seat_0_pan', 'seat_1_pan', 'ctl_0_stick', 'ctl_1_stick', 'deck_1']) expect(got, p).toContain(p);
    const pan = (i) => g.extrudes.find((e) => e.id === `seat_${i}_pan`).axisFrom;
    expect(pan(1).z).toBeGreaterThan(pan(0).z + 0.2);
    expect(pan(1).y).toBeLessThan(pan(0).y);
    expect(idsOf(ck({ dims: { length: 2, width: 1.3, height: 1.1 }, build: { layout: 'side', seats: 2, panel: 'dials', controls: 'yoke' } }))).toContain('ctl_0_yoke');
  });
  it.each(HELIS)('in %s: inside its cabin under its glass, its hull open over its seats', (k) => {
    const C = craftForm(k), fs = (id) => C.items.find((i) => i.id === id).faces;
    const ext = (faces, k) => { let lo = Infinity, hi = -Infinity; for (const f of faces) for (const c of f.corners) { lo = Math.min(lo, c[k]); hi = Math.max(hi, c[k]); } return [lo, hi]; };
    const ck2 = A[k].layout.find((e) => CRAFT_ODM[e.sku].kind === 'craft-cockpit').id, hull = fs('hull'), canopy = fs('canopy'), cp = fs(ck2);
    for (const k of [0, 1]) { const [a, b] = ext(cp, k), [c, d] = ext(hull, k); expect(a).toBeGreaterThan(c); expect(b).toBeLessThan(d); }
    expect(ext(cp, 2)[1]).toBeLessThan(ext(canopy, 2)[1]);
    // (its hull open over it: no skin across the cockpit between its seats' cushions and the bubble)
    // (over its seats: behind its panel, under the bubble's length, inside its walls, above its floor by a seat's height)
    const [cx0, cx1] = ext(cp, 0), [gy0] = ext(canopy, 1), [, cy1] = ext(cp, 1), [floor] = ext(cp, 2);
    const lid = hull.filter((f) => { const c = [0, 1, 2].map((k) => f.corners.reduce((t, q) => t + q[k], 0) / f.corners.length); return Math.abs(c[0] - (cx0 + cx1) / 2) < (cx1 - cx0) * 0.2 && c[1] > gy0 + 0.3 && c[1] < cy1 - 0.3 && c[2] > floor + 0.3; });
    expect(lid).toEqual([]);
  });
  it('a hull with no open span is lofted as it always was: one closed skin', () => {
    const plain = Object.keys(CRAFT_ODM).find((sku) => CRAFT_ODM[sku].kind === 'craft-fuselage' && !CRAFT_ODM[sku].build.open && CRAFT_ODM[sku].build.family === 'tube');
    expect(resolveCraftPart(plain).lofts.filter((l) => /^(tub|hull_nose)$/.test(l.id))).toEqual([]);
    const open = Object.keys(CRAFT_ODM).find((sku) => CRAFT_ODM[sku].build.open);
    expect(resolveCraftPart(open).lofts.map((l) => l.id).slice(0, 3)).toEqual(['hull_nose', 'tub', 'hull']);
  });
});

describe('the airframes', () => {
  const byKind = (k, kind) => A[k].layout.filter((e) => CRAFT_ODM[e.sku]?.kind === kind);
  const ext = (faces, i) => { let lo = Infinity, hi = -Infinity; for (const f of faces) for (const c of f.corners) { lo = Math.min(lo, c[i]); hi = Math.max(hi, c[i]); } return [lo, hi]; };
  it.each(HELIS)('%s stands level on its gear, its rotors clear above it, within its budget', (k) => {
    const { readout } = assembleCraft(k);
    expect(readout.gear.length).toBeGreaterThanOrEqual(2);
    for (const g of readout.gear) expect(Math.abs(g.contact[2])).toBeLessThan(0.002);
    expect(Math.abs(readout.pitch)).toBeLessThan(1);
    expect(readout.clearance['heli-rotor']).toBeGreaterThan(2);
    expect(readout.audit.ok).toBe(true);
    const C = craftForm(k, { pose: { gear: 0 }, attitude: 'ground' });
    expect(C.items.flatMap((i) => i.faces).reduce((t, f) => t + f.corners.length - 2, 0)).toBeLessThan(k === LIGHT ? 50000 : 80000);
  });
  it('found by the words people say', () => {
    for (const [w, kind] of [['medevac helicopter', 'craft-cockpit'], ['helicopter gunship', 'heli-kit'], ['heavy lift helicopter', 'heli-rotor']]) {
      const [k] = handlesOf(resolveVehicle(w).id).craft;
      expect(byKind(k, kind).length, w).toBeGreaterThan(0);
    }
  });
  const ATTACK = HELIS.find((k) => byKind(k, 'heli-kit').length && byKind(k, 'craft-wing').length);
  it('the attack helicopter: tandem seats under flat panes, its kit hung under its stub wings, its gun under its nose', () => {
    const ck = CRAFT_ODM[byKind(ATTACK, 'craft-cockpit')[0].sku], cn = CRAFT_ODM[byKind(ATTACK, 'craft-canopy')[0].sku];
    expect(ck.build.layout).toBe('tandem');
    expect(cn.build.facets).toBe(true);
    expect(CRAFT_ODM[A[ATTACK].layout[0].sku].build.facets).toBeTruthy();
    const C = craftForm(ATTACK), item = (id) => C.items.find((i) => i.id === id);
    const stub = byKind(ATTACK, 'craft-wing')[0].id, [wz] = ext(item(`${stub}-r`).faces, 2);
    for (const e of byKind(ATTACK, 'heli-kit')) {
      const it = item(e.pair ? `${e.id}-r` : e.id), [, top] = ext(it.faces, 2);
      if (e.pair) expect(top, e.id).toBeLessThan(wz);
      else { const [, nose] = ext(item('hull').faces, 1), [lo] = ext(item('hull').faces, 2); expect(ext(it.faces, 1)[1], e.id).toBeGreaterThan(nose - 2); expect(ext(it.faces, 2)[0], e.id).toBeLessThan(lo + 0.3); }
    }
  });
  const TANDEM = HELIS.find((k) => byKind(k, 'heli-rotor').length === 2);
  it('the tandem: two rotors turning against each other, the aft disc above the forward one', () => {
    const { manifest } = assembleCraft(TANDEM), rotors = manifest.items.filter((i) => i.source.garage.kind === 'heli-rotor');
    const turn = (i) => i.source.garage.joints[0].dir[2] * ((i.flip || '').includes('x') ? -1 : 1) * ((i.flip || '').includes('y') ? -1 : 1);
    expect(turn(rotors[0]) + turn(rotors[1])).toBe(0);
    const [fore, aft] = rotors.slice().sort((a, b) => b.at[1] - a.at[1]);
    expect(aft.at[2] + aft.source.garage.hardpoints.hub[2]).toBeGreaterThan(fore.at[2] + fore.source.garage.hardpoints.hub[2] + 0.4);
  });
  it('the tandem: its blades meshed, never meeting as they turn (seen from above, a chord and more apart)', () => {
    const lines = (it) => {
      const fl = it.flip || '', P = (p) => [it.at[0] + (fl.includes('x') ? -p.x : p.x), it.at[1] + p.y, it.at[2] + p.z], L = it.source.lofts;
      return L.filter((l) => /^blade_\d+$/.test(l.id)).flatMap((l) => { const a = P(l.axisFrom), b = P(L.find((t) => t.id === `${l.id}_tip`).axisTo); return Array.from({ length: 21 }, (_, i) => a.map((v, j) => v + ((b[j] - v) * i) / 20)); });
    };
    const chord = Math.max(...byKind(TANDEM, 'heli-rotor').map((e) => CRAFT_ODM[e.sku].build.chord));
    const n = CRAFT_ODM[byKind(TANDEM, 'heli-rotor')[0].sku].build.blades;
    let plan = Infinity;
    // (over one blade's spacing: the rotors' meeting repeats every 360/n degrees)
    for (let a = 0; a < 360 / n; a += 6) {
      const [f, r] = assembleCraft(TANDEM, { pose: { rotor: a } }).manifest.items.filter((i) => i.source.garage.kind === 'heli-rotor').map(lines);
      for (const p of f) for (const q of r) plan = Math.min(plan, Math.hypot(p[0] - q[0], p[1] - q[1]));
    }
    expect(plan).toBeGreaterThan(chord);
  });
  it('the tandem: its ramp\'s hinge, sides and lip on the hull\'s aft underside; absent, none', () => {
    const sku = A[TANDEM].layout[0].sku, src = resolveCraftPart(sku), got = ids(src);
    for (const p of ['ramp_hinge', 'ramp_lip', 'ramp_side_r', 'ramp_side_l']) expect(got, p).toContain(p);
    const hinge = src.sweeps.find((m) => m.id === 'ramp_hinge').path, lip = src.sweeps.find((m) => m.id === 'ramp_lip').path;
    expect(lip[4][2]).toBeGreaterThan(hinge[4][2] + 0.5);
    expect(ids(resolveCraftPart(A[LIGHT].layout[0].sku)).some((i) => /^ramp_/.test(i))).toBe(false);
  });
  it('a faceted hull opened over its cockpit: its tub\'s corners line up down its length, so its panels stay flat', () => {
    const sku = A[ATTACK].layout[0].sku, tub = resolveCraftPart(sku).lofts.find((l) => l.id === 'tub'), M = tub.stations[0].profile.length / 2;
    const norm = (pts) => { const o = pts.slice(0, M), xs = o.map((p) => p[0]), ys = o.map((p) => p[1]), mx = Math.max(...xs.map(Math.abs)), y0 = Math.min(...ys), y1 = Math.max(...ys); return o.map(([x, y]) => [x / mx, (y - y0) / (y1 - y0)]); };
    const ref = norm(tub.stations[0].profile);
    for (const st of tub.stations) norm(st.profile).forEach((p, i) => { expect(Math.abs(p[0] - ref[i][0])).toBeLessThan(0.03); expect(Math.abs(p[1] - ref[i][1])).toBeLessThan(0.03); });
    expect(resolveCraftPart(sku).lofts.map((l) => l.id).slice(0, 3)).toEqual(['hull_nose', 'tub', 'hull']);
  });
});

describe('the kit (modelled, never fired)', () => {
  const kit = (fam) => { const sku = skuOf('heli-kit', fam); return { row: HELI_ODM[sku], src: resolveCraftPart(sku, { seat: 'mount' }) }; };
  it('a rocket pod: its body and bands, a mouth per tube at its face, its lugs on top', () => {
    const { row, src } = kit('rockets'), got = ids(src);
    expect(got.filter((i) => /^tube_/.test(i)).length).toBe(row.build.tubes);
    for (const p of ['body', 'band_front', 'band_aft', 'lug_f', 'lug_a']) expect(got, p).toContain(p);
  });
  it('a missile rack: its beam and spine, its rounds each side row under row, each with its seeker and fins', () => {
    const { row, src } = kit('rack'), got = ids(src);
    expect(got.filter((i) => /^round_\d+[rl]$/.test(i)).length).toBe(row.build.rows * 2);
    expect(got.filter((i) => /_seeker$/.test(i)).length).toBe(row.build.rows * 2);
    for (const p of ['beam', 'spine']) expect(got, p).toContain(p);
  });
  it('a chin gun: its ring, drum and cheeks, its barrel ahead to its muzzle; every kit hangs below its mount', () => {
    const { row, src } = kit('chin'), got = ids(src);
    for (const p of ['ring', 'drum', 'receiver', 'barrel', 'brake', 'cheek_r', 'cheek_l']) expect(got, p).toContain(p);
    expect(src.garage.hardpoints.muzzle[1]).toBeCloseTo(row.dims.length, 2);
    for (const fam of ['rockets', 'rack', 'chin']) {
      const s2 = kit(fam).src, zs = ['lathes', 'extrudes'].flatMap((k) => (s2[k] ?? []).flatMap((m) => [m.axisFrom.z, m.axisTo.z]));
      expect(Math.max(...zs), fam).toBeLessThan(0.02);
    }
  });
});

describe('every helicopter, finished and turning', () => {
  const kindOf = (k, id) => CRAFT_ODM[A[k].layout.find((e) => e.id === id.replace(/-[rl]$/, ''))?.sku]?.kind;
  const pieces = (src) => ['extrudes', 'sweeps', 'lathes', 'lofts'].flatMap((x) => (src[x] ?? []).map((m) => m.id));
  it('made, one cockpit, never two: the hull fits no fighter\'s cockpit where the layout seats its own; a fighter keeps its', () => {
    for (const k of HELIS) expect(pieces(assembleCraft(k, { made: true }).manifest.items[0].source).filter((i) => /^cockpit/.test(i)), k).toEqual([]);
    const jet = Object.keys(A).find((k) => A[k].realm === 'earth' && A[k].layout.some((e) => CRAFT_ODM[e.sku]?.kind === 'craft-canopy') && !A[k].layout.some((e) => CRAFT_ODM[e.sku]?.kind === 'craft-cockpit'));
    expect(pieces(assembleCraft(jet, { made: true }).manifest.items[0].source).some((i) => /^cockpit/.test(i))).toBe(true);
  });
  it.each(HELIS)('%s: every rotor a bone at its hub in its figure, a tandem\'s two main rotors turning against each other', (k) => {
    const C = craftForm(k), F = craftFormFigure(k, { spin: true });
    expect(C.spins.length).toBe(A[k].layout.filter((e) => ['heli-rotor', 'heli-tail'].includes(CRAFT_ODM[e.sku]?.kind)).length);
    for (const sp of C.spins) expect(F.bones.find((b) => b.id === sp.id).head).toEqual(sp.hub);
    const mains = C.spins.filter((sp) => kindOf(k, sp.id) === 'heli-rotor');
    if (mains.length === 2) expect(mains[0].turn + mains[1].turn).toBe(0);
  });
  it.each(HELIS)('%s: made, in camo and battered, within its budget (×1.6)', (k) => {
    const C = craftForm(k, { made: true, livery: 'wraparound', wear: 'battered' });
    expect(C.items.flatMap((i) => i.faces).reduce((t, f) => t + f.corners.length - 2, 0)).toBeLessThan((k === LIGHT ? 50000 : 80000) * 1.6);
  });
  it.each(HELIS)('%s: its main rotor\'s blades pass well clear over its tail as they turn', (k) => {
    const C = craftForm(k), box = {};
    for (const it of C.items) { const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity]; for (const f of it.faces) for (const c of f.corners) for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], c[i]); hi[i] = Math.max(hi[i], c[i]); } box[it.id] = [lo, hi]; }
    // (the form stands the craft centred: its offset from craft space, read off the hull's nose and keel)
    const hull0 = assembleCraft(k).manifest.items.find((i) => i.id === 'hull'), off = [0, box.hull[1][1] - hull0.at[1], box.hull[0][2] - hull0.at[2]];
    const rotors = A[k].layout.filter((e) => CRAFT_ODM[e.sku].kind === 'heli-rotor'), n = CRAFT_ODM[rotors[0].sku].build.blades;
    let gap = Infinity;
    for (let a = 0; a < 360 / n; a += 10) {
      const { manifest } = assembleCraft(k, { pose: { rotor: a } });
      for (const r of rotors) {
        const it = manifest.items.find((i) => i.id === r.id), fl = it.flip || '', parent = r.at.split('.')[0];
        const below = Object.keys(box).filter((id) => id !== parent && ['craft-fin', 'heli-tail', 'craft-stabilizer', 'heli-cowl'].includes(kindOf(k, id)));
        for (const l of it.source.lofts.filter((q) => /^blade_\d+(_tip)?$/.test(q.id))) for (const p of [l.axisFrom, l.axisTo]) {
          const q = [it.at[0] + (fl.includes('x') ? -p.x : p.x) + off[0], it.at[1] + p.y + off[1], it.at[2] + p.z + off[2]];
          for (const id of below) { const [lo, hi] = box[id]; if (q[0] > lo[0] - 0.3 && q[0] < hi[0] + 0.3 && q[1] > lo[1] - 0.3 && q[1] < hi[1] + 0.3) gap = Math.min(gap, q[2] - hi[2]); }
        }
      }
    }
    expect(gap).toBeGreaterThan(0.6);
  });
});

describe('the looks and their kit: one airframe, civilian or military by its card', () => {
  const LOOKS = Object.keys(HELI_LOOKS);
  const odmOf = (it) => CRAFT_ODM[it.source.garage.sku];
  // (the helicopter whose hull names the most stations: every card has kit to hang on it)
  const stationsOf = (k) => Object.keys(CRAFT_ODM[A[k].layout[0].sku].build.kitAt || {});
  const FULL = HELIS.slice().sort((a, b) => stationsOf(b).length - stationsOf(a).length)[0];
  const ARMED = HELIS.find((k) => A[k].layout.some((e) => HELI_ARMS.includes(CRAFT_ODM[e.sku]?.build.family)));
  it.each(LOOKS)('%s: the same airframe (its hull, rotors, tail and gear the stock parts), its kit hung at its stations, its audit clean', (look) => {
    const stock = assembleCraft(FULL).manifest.items, { manifest, readout } = assembleCraft(FULL, { look });
    expect(readout.audit.ok).toBe(true);
    const frame = (items) => items.filter((i) => !/^kit_/.test(i.id)).map((i) => `${i.id}:${i.source.garage.sku}`);
    expect(frame(manifest.items)).toEqual(frame(stock));
    const hung = manifest.items.filter((i) => /^kit_/.test(i.id)).map((i) => i.id.replace(/^kit_/, '').replace(/-[rl]$/, ''));
    const want = HELI_LOOKS[look].kit.map((k) => k.station).filter((st) => stationsOf(FULL).includes(st));
    expect([...new Set(hung)].sort()).toEqual([...new Set(want)].sort());
    for (const st of want) if (HELI_STATIONS[st].pair) expect(manifest.items.filter((i) => i.id.startsWith(`kit_${st}-`)).length, st).toBe(2);
  });
  it('a kit is hung only where the hull names its station; absent a look, none', () => {
    for (const k of HELIS) for (const look of LOOKS) {
      const { manifest } = assembleCraft(k, { look });
      for (const it of manifest.items.filter((i) => /^kit_/.test(i.id))) expect(stationsOf(k), `${k} ${look} ${it.id}`).toContain(it.id.replace(/^kit_/, '').replace(/-[rl]$/, ''));
    }
    for (const k of HELIS) expect(assembleCraft(k).manifest.items.some((i) => /^kit_/.test(i.id))).toBe(false);
  });
  it('a civilian card strips the weapons and keeps their pylons; a military card keeps them', () => {
    const arms = (look) => assembleCraft(ARMED, look ? { look } : {}).manifest.items.filter((i) => odmOf(i).kind === 'heli-kit' && HELI_ARMS.includes(odmOf(i).build.family));
    const civil = LOOKS.find((l) => HELI_LOOKS[l].arms === false), mil = LOOKS.find((l) => HELI_LOOKS[l].arms === true);
    expect(arms(civil)).toEqual([]);
    expect(arms(mil).length).toBeGreaterThanOrEqual(arms().length);
    const pylons = (look) => assembleCraft(ARMED, look ? { look } : {}).manifest.items.filter((i) => odmOf(i).kind === 'craft-pylon').length;
    expect(pylons(civil)).toBe(pylons());
    expect(assembleCraft(ARMED, { look: civil }).readout.audit.ok).toBe(true);
  });
  it('a kit is its family\'s row nearest the size its card asks for', () => {
    const sized = LOOKS.flatMap((l) => HELI_LOOKS[l].kit.filter((k) => k.size !== undefined).map((k) => ({ l, k })));
    expect(sized.length).toBeGreaterThan(0);
    for (const { l, k } of sized) {
      const it = assembleCraft(FULL, { look: l }).manifest.items.find((i) => i.id === `kit_${k.station}`), d = odmOf(it).dims;
      const of = (r) => r.dims.height ?? r.dims.diameter ?? r.dims.length;
      const best = Math.min(...Object.values(CRAFT_ODM).filter((r) => r.build.family === k.family && r.realm === 'earth').map((r) => Math.abs(of(r) - k.size)));
      expect(Math.abs((d.height ?? d.diameter ?? d.length) - k.size)).toBeCloseTo(best, 6);
    }
  });
  it('a card\'s palette and slots: civilian gloss paint, military matte; its livery unless one is named', () => {
    const mat = (look) => new Set(craftForm(FULL, { look }).items.find((i) => i.id === 'hull').faces.map((f) => f.material));
    const civil = LOOKS.find((l) => HELI_LOOKS[l].slots.airPaint), mil = LOOKS.find((l) => !HELI_LOOKS[l].slots.airPaint);
    expect(mat(civil).has(HELI_LOOKS[civil].slots.airPaint)).toBe(true);
    expect(mat(civil).has('airPaint')).toBe(false);
    expect(mat(mil).has('airPaint')).toBe(true);
    const albedo = (look) => craftForm(FULL, { look }).items.find((i) => i.id === 'hull').faces[0].albedo;
    expect(albedo(civil)).not.toBe(albedo(mil));
  });
  it('a look is read in its craft\'s family: a helicopter\'s cards, a drone\'s; another family\'s word throws naming its own', () => {
    expect(lookCard(LOOKS[0], 'heli')).toBe(HELI_LOOKS[LOOKS[0]]);
    expect(() => lookCard(DRONE_LOOK_IDS.find((d) => !LOOKS.includes(d)), 'heli')).toThrow(/helicopter look/);
    expect(() => assembleCraft(FULL, { look: DRONE_LOOK_IDS.find((d) => !LOOKS.includes(d)) })).toThrow(/helicopter look/);
  });
  it.each(LOOKS)('%s: within the budget, made, in camo and battered (×1.6)', (look) => {
    const C = craftForm(FULL, { look, made: true, livery: 'wraparound', wear: 'battered' });
    expect(C.items.flatMap((i) => i.faces).reduce((t, f) => t + f.corners.length - 2, 0)).toBeLessThan(80000 * 1.6);
  });
});

describe('the looks\' kit', () => {
  const kit = (fam) => { const sku = skuOf('heli-kit', fam); return { row: HELI_ODM[sku], src: resolveCraftPart(sku, { seat: 'mount' }) }; };
  it('a door gun on its pintle: arm, post, receiver, barrel ahead, its box; its muzzle forward, out from its mount', () => {
    const { src } = kit('doorGun'), got = ids(src);
    for (const p of ['arm', 'post', 'receiver', 'ammo', 'barrel', 'muzzle', 'grips']) expect(got, p).toContain(p);
    expect(src.garage.hardpoints.muzzle[0]).toBeGreaterThan(0);
    expect(src.garage.hardpoints.muzzle[1]).toBeGreaterThan(0);
  });
  it('a wire cutter\'s toothed blade raked forward; a flare dispenser\'s cartridges in rows', () => {
    const c = kit('cutter');
    expect(ids(c.src)).toEqual(expect.arrayContaining(['blade', 'root']));
    expect(c.src.extrudes.find((e) => e.id === 'blade').profile.points.length).toBeGreaterThan(6);
    const f = kit('flares');
    expect(ids(f.src).filter((i) => /^cartridge_/.test(i)).length).toBe(f.row.build.rows * f.row.build.cols);
  });
  it('a searchlight looking ahead through its lens; a hoist\'s cable down to its hook; floats along a skid', () => {
    const s = kit('searchlight');
    expect(ids(s.src)).toEqual(expect.arrayContaining(['lamp', 'lens', 'bezel', 'bracket', 'cheek_r', 'cheek_l']));
    expect(s.src.lathes.find((l) => l.material === 'glass').id).toBe('lens');
    const h = kit('hoist'), cable = h.src.sweeps.find((m) => m.id === 'cable').path;
    expect(cable[1][2]).toBeCloseTo(-h.row.dims.drop, 2);
    const fl = kit('floats'), pack = fl.src.lathes.find((l) => l.id === 'pack');
    expect(pack.axisFrom.x).toBeCloseTo(fl.row.build.out, 3);
    expect(pack.axisFrom.z).toBeCloseTo(-fl.row.build.drop, 3);
  });
});

describe('the field\'s language on a helicopter: plates, bolts, doors on their rails, the made finish, its marks and wear', () => {
  const hullSku = (k) => A[k].layout[0].sku, hullRow = (k) => CRAFT_ODM[hullSku(k)];
  const SLIDING = HELIS.find((k) => hullRow(k).build.slide), ARMOURED = HELIS.find((k) => hullRow(k).build.armour), PLAIN = HELIS.find((k) => !hullRow(k).build.slide && hullRow(k).build.doors);
  const pieces = (src) => ['extrudes', 'sweeps', 'lathes', 'lofts'].flatMap((x) => (src[x] ?? []).map((m) => m.id));
  const hullOf = (k, o = {}) => assembleCraft(k, o).manifest.items.find((i) => i.id === 'hull').source;
  it('a sliding door on its rails: shut by default; open, slid aft by its travel, the opening dark where it was', () => {
    const shut = hullOf(SLIDING), open = hullOf(SLIDING, { pose: { door: 1 } });
    const door = (src) => src.extrudes.find((e) => e.id === 'door_0_r');
    expect(pieces(shut).filter((i) => /^door_rail_/.test(i)).length).toBe(4);
    expect(pieces(shut)).not.toContain('door_opening_0_r');
    expect(pieces(open)).toContain('door_opening_0_r');
    const j = open.garage.joints.find((q) => q.name === 'door');
    expect(j.kind).toBe('slide');
    expect(door(shut).axisFrom.y - door(open).axisFrom.y).toBeCloseTo(j.travel, 1);
    expect(shut.garage.joints.find((q) => q.name === 'door').travel).toBe(0);
    expect(pieces(hullOf(PLAIN)).some((i) => /^door_rail_|^door_opening_/.test(i))).toBe(false);
  });
  it('made, an armoured hull\'s plates each side with their bolts, fittings; a civilian look\'s hull without them; absent unmade', () => {
    const made = hullOf(ARMOURED, { made: true }), n = hullRow(ARMOURED).build.armour.length;
    expect(made.lofts.filter((l) => /^armour_\d+_[rl]$/.test(l.id)).length).toBe(n * 2);
    expect(made.lofts.filter((l) => /^armour_/.test(l.id)).every((l) => l.group === 'fitting')).toBe(true);
    expect((made.lathes ?? []).filter((l) => /^armour_.*_bolt_/.test(l.id)).length).toBeGreaterThan(n * 8);
    const civil = Object.keys(HELI_LOOKS).find((l) => HELI_LOOKS[l].armour === false);
    expect(pieces(hullOf(ARMOURED, { made: true, look: civil })).some((i) => /^armour_/.test(i))).toBe(false);
    expect(pieces(hullOf(ARMOURED)).some((i) => /^armour_/.test(i))).toBe(false);
  });
  it('made, a step and a grab handle at each door, each side', () => {
    const k = HELIS.find((q) => hullRow(q).build.grabs), got = pieces(hullOf(k, { made: true })), n = hullRow(k).build.doors.length;
    expect(got.filter((i) => /^step_/.test(i)).length).toBe(n * 2);
    expect(got.filter((i) => /^grab_/.test(i)).length).toBe(n * 2);
    expect(pieces(hullOf(k)).some((i) => /^step_|^grab_/.test(i))).toBe(false);
  });
  it('made, the rotor head\'s bolt ring and blade cuffs, the tail hub\'s bolts, the cowling\'s hinge lines and latches; absent unmade', () => {
    const want = { 'heli-rotor': [/^hub_bolt_/, /^cuff_/], 'heli-tail': [/^tail_bolt_/], 'heli-cowl': [/^cowl_hinge_/, /^latch_/] };
    for (const [kind, res] of Object.entries(want)) {
      const sku = Object.keys(HELI_ODM).find((q) => HELI_ODM[q].kind === kind && ['articulated', 'rotor', 'single', 'twin'].includes(HELI_ODM[q].build.family));
      const made = resolveCraftPart(sku, { seat: 'mount', made: true }), bare = resolveCraftPart(sku, { seat: 'mount' });
      for (const re of res) { expect(pieces(made).some((i) => re.test(i)), `${sku} ${re}`).toBe(true); expect(pieces(bare).some((i) => re.test(i))).toBe(false); }
    }
  });
  it('a civilian look\'s registration where the cabin meets the boom, and a stripe of its trim; without `stripe`, no band', () => {
    const civil = Object.keys(HELI_LOOKS).find((l) => HELI_LOOKS[l].livery.marks?.style === 'civil' && HELI_LOOKS[l].livery.marks.stripe);
    const trim = CRAFT_PALETTES[HELI_LOOKS[civil].palette].trim.toLowerCase();
    const marks = (o) => craftForm(LIGHT, { look: civil, ...o }).items.find((i) => i.id === 'hull').faces.filter((f) => f.fitting === 'mark');
    const all = marks({}), band = all.filter((f) => f.albedo === trim), reg = all.filter((f) => f.albedo !== trim);
    expect(band.length).toBeGreaterThan(0);
    expect(reg.length).toBeGreaterThan(20);
    // (the registration aft of the band, where the boom begins)
    const meanY = (fs) => fs.reduce((t, f) => t + f.corners[0][1], 0) / fs.length;
    expect(meanY(reg)).toBeLessThan(meanY(band));
    expect(marks({ livery: { pattern: 'mono', marks: { style: 'civil' } } }).some((f) => f.albedo === trim)).toBe(false);
  });
  it('battered, the exhausts\' soot down the boom: its top aft of the cowling darker than the roof ahead; pristine, none', () => {
    const lum = (h) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    const C = craftForm(LIGHT, { wear: 'battered', livery: 'mono' }), hull = C.items.find((i) => i.id === 'hull'), cowl = C.items.find((i) => i.id === 'cowl');
    let y0 = Infinity; for (const f of cowl.faces) for (const c of f.corners) y0 = Math.min(y0, c[1]);
    const top = hull.faces.filter((f) => !f.fitting && f.outNormal[2] > 0.6 && Math.abs(f.corners[0][0]) < 0.4);
    const mean = (fs) => fs.reduce((t, f) => t + (f.cornerAlbedo ?? [f.albedo]).reduce((u, a) => u + lum(a), 0) / (f.cornerAlbedo ?? [f.albedo]).length, 0) / fs.length;
    const aft = top.filter((f) => f.corners[0][1] < y0 && f.corners[0][1] > y0 - 3), fore = top.filter((f) => f.corners[0][1] > y0 + 3);
    expect(mean(aft)).toBeLessThan(mean(fore) * 0.8);
    expect(craftForm(LIGHT, { wear: 'pristine', livery: 'mono' }).items.find((i) => i.id === 'hull').faces.some((f) => f.cornerAlbedo)).toBe(false);
  });
});

describe('a helicopter for the engines', () => {
  it('its GLB (military, made, in camo and battered, on its helipad, its rotors\' spin clip) valid by the Khronos validator, no warning', async () => {
    const k = HELIS.find((q) => CRAFT_ODM[A[q].layout[0].sku].build.armour && CRAFT_ODM[A[q].layout[0].sku].build.slide);
    const fig = craftFormFigure(k, { look: 'military', made: true, livery: 'wraparound', wear: 'battered', spin: true, pad: true });
    const out = facesToGlb({ faces: [], figures: { craft: fig } }, { clips: '_all' });
    const report = await validateBytes(new Uint8Array(out.bytes), { maxIssues: 50 });
    expect(report.issues.numErrors, JSON.stringify(report.issues.messages.filter((m) => m.severity === 0))).toBe(0);
    expect(report.issues.numWarnings, JSON.stringify(report.issues.messages.filter((m) => m.severity === 1))).toBe(0);
    const len = out.bytes.readUInt32LE(12), json = JSON.parse(out.bytes.slice(20, 20 + len).toString('utf8'));
    expect(json.animations.map((a) => a.name)).toEqual(expect.arrayContaining(['craft:spin']));
    expect(json.nodes.some((n) => n.name === 'pad' || /pad/.test(n.name ?? ''))).toBe(true);
  }, 120000);
});

