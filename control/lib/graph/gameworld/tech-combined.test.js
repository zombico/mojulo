import { describe, it, expect } from 'vitest';
import { BODY_PLANS, variantOf } from './tech-bodyplan.js';
import { chassisManifest, lowerChassis, LEAD_GROW } from './tech-chassis.js';
import { buildAdorned, suggestAdornment } from './tech-adornment.js';
import { techReadout } from './tech-readout.js';
import { pickDress } from './mech-kit.js';
import { craftTech } from './tech-crafter.js';
import { rankOf, useOf } from './tech-direction.js';

const thing = (intent) => ({ ...craftTech('vehicle', intent).plan, intent });
const S = (made, driven) => ({ made, driven });
const zMin = (faces) => Math.min(...faces.flatMap((f) => f.corners.map((p) => p[2])));

describe('combined machines: wheeled, railed, drawn and two-wheeled transport as rows', () => {
  it('a row\'s variant is picked by the brief\'s words: its variant\'s name, or a dial its words set', () => {
    const v = (intent) => { const t = thing(intent); return variantOf(BODY_PLANS[`vehicle/${t.form}`], t).variant; };
    expect(['a car', 'a cargo truck', 'a city bus', 'an armoured car', 'a cargo van'].map(v)).toEqual(['car', 'truck', 'bus', 'apc', 'truck']);
    expect(['a steam locomotive', 'a tram', 'a steam train'].map(v)).toEqual(['locomotive', 'train', 'locomotive']);
    expect(['a farm cart', 'a covered wagon', 'a war chariot', 'a stagecoach', 'a bicycle', 'a motorcycle'].map(v)).toEqual(['cart', 'wagon', 'chariot', 'coach', 'bicycle', 'motorcycle']);
  });

  it('wheels steer, run inline, run on rails; what a row prefers is taken when the setting makes it', () => {
    const car = chassisManifest(thing('a car'), { kind: 'vehicle' });
    const steer = car.joints.filter((j) => j.id.startsWith('steer-'));
    expect(steer).toHaveLength(2);
    for (const s of steer) { expect(s).toMatchObject({ axis: [0, 0, 1], parent: 'core' }); expect(car.joints.find((j) => j.parent === s.id)).toBeTruthy(); }
    const bike = chassisManifest(thing('a bicycle'), { kind: 'vehicle' });
    expect(bike.mechanisms.map((m) => [m.id, m.dress])).toEqual([['wheel-1', 'wire'], ['wheel-2', 'wire']]);
    expect(bike.joints.find((j) => j.id === 'steer-wheel-2').pieces).toEqual(expect.arrayContaining(['fork', 'fork-2', 'bars', 'stem']));
    // a bicycle is pedalled whatever the world drives with; a motorcycle prefers wire wheels where it is made of steel
    expect(pickDress('wheel', { setting: S('steel-and-rubber', 'combustion') }).dress).toBe('road');
    expect(pickDress('wheel', { setting: S('steel-and-rubber', 'combustion'), prefer: ['wire'] }).dress).toBe('wire');
    expect(pickDress('wheel', { setting: S('timber-and-rope', 'muscle'), prefer: ['wire'] }).dress).toBe('spoked');
    // on rails: flanged, or a maglev shoe that lifts over its rail
    const train = (setting) => chassisManifest(thing('a passenger train'), { kind: 'vehicle', setting });
    expect(new Set(train(S('iron-and-rivet', 'steam')).mechanisms.map((m) => m.dress))).toEqual(new Set(['flanged']));
    const mag = train(S('alloy-and-glass', 'field'));
    expect(mag.mechanisms[0]).toMatchObject({ dress: 'maglev', lift: { cue: 'emitter' } });
    expect(pickDress('wheel', { on: 'rail', setting: S('steel-and-rubber', 'combustion') }).refused.map((r) => r.dress)).toEqual(['maglev']);
  });

  it('a bed is open to the sky; the rails are ground, drawn but never its silhouette', () => {
    const cart = chassisManifest(thing('a farm cart'), { kind: 'vehicle' }), bed = cart.manifest.extrudes.filter((e) => e.id.startsWith('bed'));
    expect(bed).toHaveLength(4);
    for (const w of bed) expect(w.wallThickness).toBeUndefined();
    const t = thing('a passenger train'), c = chassisManifest(t, { kind: 'vehicle' }), faces = lowerChassis(c.manifest, c.pieces);
    expect(faces.some((f) => f.ground)).toBe(true);
    expect(Math.abs(zMin(faces))).toBeLessThan(0.01);
    const seg = (fs) => techReadout(fs, { tier: t.block.tier, rank: 'interactable', camera: 'first-person' }).segments;
    expect(seg(faces)).toBe(seg(faces.filter((f) => !f.ground)));
  });

  it('a row of wheels reads as one band in the silhouette; legs still count', () => {
    const t = thing('a cargo truck'), c = chassisManifest(t, { kind: 'vehicle' }), faces = lowerChassis(c.manifest, c.pieces);
    const R = (fs) => techReadout(fs, { tier: t.block.tier, rank: 'interactable' }).segments;
    expect(R(faces)).toBeLessThan(R(faces.map(({ gear, ...f }) => f)));
    expect(faces.filter((f) => f.gear).every((f) => /^wheel/.test(f.monomer))).toBe(true);
  });

  it('the solver pushes a proportion, never breaks it; a lead may be a body of pieces', () => {
    const loco = thing('a steam locomotive'), a = buildAdorned(loco, { kind: 'vehicle', direction: { motif: 'riveted', setting: S('iron-and-rivet', 'steam') }, rank: rankOf('vehicles', loco).rank, use: 'driven' });
    expect(a.lead).toEqual(['boiler', 'cab']);
    expect(a.laws.find((l) => l.law === 'one-leads')).toMatchObject({ ok: true, value: expect.stringMatching(/^boiler\+cab/) });
    for (const v of Object.values(a.thick)) expect(v).toBeLessThanOrEqual(LEAD_GROW);
  });

  it('adornment reads what the thing is: no machine face on what is pulled or has windows, no turret without a deck', () => {
    const picks = (intent, setting) => { const t = thing(intent), c = chassisManifest(t, { kind: 'vehicle', setting }); return suggestAdornment(c, t, { rank: rankOf('vehicles', t).rank }).map((p) => p.piece); };
    for (const i of ['a farm cart', 'a covered wagon', 'a bicycle']) expect(picks(i), i).not.toContain('visor');
    for (const i of ['a car', 'a city bus']) expect(picks(i), i).not.toContain('visor');
    expect(picks('a war chariot', S('timber-and-rope', 'muscle'))).toEqual(expect.arrayContaining(['rack']));
    expect(picks('a war chariot', S('timber-and-rope', 'muscle'))).not.toContain('turret');
    expect(picks('an armoured walker')).toContain('visor');
  });

  it('drawn vehicles are watched; a cart is a prop, a wagon or coach is boarded or escorted', () => {
    const r = (i) => { const t = thing(i); return [rankOf('vehicles', t).rank, useOf('vehicles', t).use]; };
    expect(r('a farm cart')).toEqual(['prop', 'watched']);
    expect(r('a covered wagon')).toEqual(['interactable', 'watched']);
    expect(r('a bicycle')).toEqual(['interactable', 'driven']);
  });
});
