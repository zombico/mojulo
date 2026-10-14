import { describe, it, expect } from 'vitest';
import { baseSilhouette, secondTone, bodyMonochrome, markingTint, drawnMarkings, drawnCrease, familyOf, MONO_DL, SPLIT_DL } from './creature-silhouette.js';
import { hexLch } from './station-loft-shade.js';
import { expandPlan } from './station-loft-plan.js';
import { compileLayered } from './station-loft.js';

// a tailed biped's lower half, one white coat with dark paws: the creature door's grammar
const P = (palette = {}) => ({
  schema: 'layered-plan-v1', frame: { up: '+z', front: '+y' },
  joints: { hip: [0.15, 0, 0.9], knee: [0.17, 0.12, 0.52], toe: [0.18, 0.1, 0.03], tail0: [0, -0.12, 0.85], tail1: [0, -0.4, 0.7], tail2: [0, -0.65, 0.45] },
  segments: [
    { name: 'pelvis', kind: 'trunk', stations: [{ z: 0.8, r: [0.22, 0.16] }, { z: 1.0, r: [0.24, 0.17] }, { z: 1.4, r: [0.26, 0.18] }], caps: { back: [0, 0, 0.72], tip: [0, 0, 1.5] }, group: 'Body', tint: '#dedad2', mirror: 'plane', bind: { bone: 'pelvis' } },
    { name: 'thighR', kind: 'segment', from: 'hip', to: 'knee', rA: 0.11, rB: 0.08, group: 'Legs', tint: '#d8d4cb', mirror: 'name', bind: { bone: 'thighR', prev: 'pelvis', next: 'shinR' } },
    { name: 'shinR', kind: 'segment', from: 'knee', to: 'toe', rA: 0.075, rB: 0.05, group: 'Paws', tint: '#3a3430', mirror: 'name', bind: { bone: 'shinR', prev: 'thighR' } },
    { name: 'tail', kind: 'chain', joints: ['tail0', 'tail1', 'tail2'], r: [0.08, 0.07, 0.03], group: 'Tail', tint: '#dedad2', mirror: 'plane', bind: { root: 'pelvis' } },
  ],
  dials: {}, palette,
});
const meshOf = (plan) => compileLayered(expandPlan(plan), {}, { details: false, creases: false });

describe('stage 1: the base silhouette and its value split', () => {
  it('a second tone a clear step from the first: darker and cooler for a light coat, lighter and warmer for a dark one', () => {
    for (const hex of ['#dedad2', '#eef0f2', '#c0703a']) expect(hexLch(hex)[0] - hexLch(secondTone(hex))[0]).toBeGreaterThan(SPLIT_DL - 3);
    for (const hex of ['#24221f', '#2a4a4a']) expect(hexLch(secondTone(hex))[0] - hexLch(hex)[0]).toBeGreaterThan(SPLIT_DL - 3);
    const [, , hCool] = hexLch(secondTone('#dedad2')); expect(hCool).toBeGreaterThan(200);
  });

  it('a white coat with dark paws is one colour; marked, its dorsal side darkens and the paws keep theirs', () => {
    const plan = P(), mesh = meshOf(plan);
    expect(bodyMonochrome(mesh, plan)).toBe(true);
    const tint = markingTint(mesh, plan, { pattern: 'countershade' }), partOf = (fi) => mesh.provenance[mesh.faces[fi][0]].part;
    const marked = (re) => mesh.faces.map((_, fi) => fi).filter((fi) => re.test(partOf(fi)) && tint[fi]);
    expect(marked(/^pelvis$/).length).toBeGreaterThan(0);
    expect(marked(/^shin[RL]$/).length).toBe(0);                       // the dark paws stand apart already
    for (const fi of marked(/^pelvis$/)) { const m = tint[fi][0]; expect(m[0]).toBe(tint[fi][1][0]); expect(m.every((x) => x < 1)).toBe(true); }   // per face, darker
    // a body half one tone and half another is not monochrome, so a drawn creature derives no markings
    const two = P(), split = { ...two, segments: two.segments.map((g) => (g.name === 'pelvis' ? { ...g, tint: '#3a3430' } : g)), style: { drawn: true } };
    expect(drawnMarkings(split, meshOf(split))).toBeNull();
    expect(drawnMarkings({ ...plan, style: { drawn: true } }, mesh)).not.toBeNull();
    // its own markings win (a reference's), and false turns them off
    expect(drawnMarkings({ ...plan, style: { drawn: { markings: false } } }, mesh)).toBeNull();
    expect(drawnMarkings({ ...plan, style: { drawn: { markings: { pattern: 'countershade', colour: '#5850b0' } } } }, mesh)).not.toBeNull();
    expect(drawnMarkings(plan, mesh)).toBeNull();                        // not drawn: nothing
  });

  it('the base silhouette record: what the outline is made of, what must stay seen, the landmarks and the outline\'s character', () => {
    const plan = P(), rec = baseSilhouette(meshOf(plan), plan);
    expect(rec.masses[0].share).toBeGreaterThan(0);
    expect(rec.mustSee).toContain('tail');
    expect(rec.mustSee).not.toContain('thigh');                          // the paired limbs every biped has
    expect(rec.landmarks.hips).toBeGreaterThan(0.3);
    expect(['barrel', 'bell', 'column', 'needle', 'wedge']).toContain(rec.outline);
    expect(familyOf('lock.ruff.torso.R.1.0')).toBe('lock.ruff');
    expect(familyOf('tail3')).toBe('tail');
    expect(drawnCrease(plan)).toMatchObject({ Body: 70, Legs: 70, Fur: 70, default: 35 });
    expect(MONO_DL).toBe(12);
  });
});
