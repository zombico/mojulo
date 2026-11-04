// The craft in the form render: the shelf's own craft, the same faces and the same size, each face its item and a slot
// the aircraft's materials name, its corner normals worked out (a lofted hull round, its normals unit), its nav lights
// port and starboard, its canopy glass; one bone per item, lit by its world; the same twice; the baked figure as it
// was without the word; its GLB valid. One archetype per concept, chosen from the shelf in code.
import { describe, it, expect } from 'vitest';
import { validateBytes } from 'gltf-validator';
import { craftForm, craftFormFigure, AIR_MATERIALS } from './craft-form.js';
import { craftPieces, craftFigure } from './craft-rig.js';
import { CRAFT_ARCHETYPES } from './craft-archetypes.js';
import { facesToGlb } from '../scene/scene-gltf.js';

const JET = Object.keys(CRAFT_ARCHETYPES).find((k) => CRAFT_ARCHETYPES[k].realm === 'earth' && CRAFT_ARCHETYPES[k].role === 'superiority' && /jet|F-/i.test(`${k} ${CRAFT_ARCHETYPES[k].classOf}`));
const C = craftForm(JET), all = C.items.flatMap((i) => i.faces);

describe('the craft in the form render', () => {
  it('the shelf\'s own craft at its own size, an item a part', () => {
    const P = craftPieces(JET);
    for (const k of ['length', 'span', 'height']) expect(C[k], k).toBeCloseTo(P[k], 3);
    expect(C.items.map((i) => i.id)).toEqual(P.pieces.map((p) => p.id));
    for (const it of C.items) expect(it.faces.every((f) => f.part === it.id)).toBe(true);
  });
  it('every face a slot the aircraft\'s materials name, its albedo a colour and its normals unit', () => {
    for (const f of all) {
      expect(AIR_MATERIALS[f.material], f.material).toBeDefined();
      expect(f.albedo).toMatch(/^#[0-9a-f]{6}$/);
      for (const n of f.cornerNormals) expect(Math.hypot(...n)).toBeCloseTo(1, 4);
    }
    const slots = new Set(all.map((f) => f.material));
    for (const s of ['airPaint', 'airMetal', 'canopy', 'rubber', 'navRed', 'navGreen']) expect(slots.has(s), s).toBe(true);
  });
  it('a lofted hull reads round: its corner normals turn across its faces, not flat to each', () => {
    const hull = C.items.find((i) => i.id === 'hull').faces.filter((f) => f.material === 'airPaint');
    const turned = hull.filter((f) => f.cornerNormals.some((n) => n[0] * f.outNormal[0] + n[1] * f.outNormal[1] + n[2] * f.outNormal[2] < 0.9999));
    expect(turned.length / hull.length).toBeGreaterThan(0.5);
  });
  it('one bone per item in the form render, lit by its world: dimmer at night than at noon', () => {
    const noon = craftFormFigure(JET), night = craftFormFigure(JET, { setting: { sky: { zenith: [22, 16, 54], horizon: [96, 52, 128], day: 0.04 } } });
    expect(noon.bones.map((b) => b.id)).toEqual(C.items.map((i) => i.id));
    expect(noon.parts.every((p) => p?.form)).toBe(true);
    expect(noon.form.materials.airPaint).toEqual(AIR_MATERIALS.airPaint);
    expect(night.form.keyIntensity).toBeLessThan(noon.form.keyIntensity);
    expect(craftFigure(JET, { light: 'form' })).toEqual(noon);
  });
  it('the same twice; without the word, the baked figure as it was', () => {
    expect(JSON.stringify(craftForm(JET))).toBe(JSON.stringify(C));
    const baked = craftFigure(JET);
    expect(baked.parts.every((p) => !p?.form)).toBe(true);
    expect(baked.form).toBeUndefined();
  });
  it('exports to a GLB the Khronos validator passes, its slots its materials', async () => {
    const out = facesToGlb({ faces: [], figures: { craft: craftFormFigure(JET) } }, { clips: '_all' });
    const report = await validateBytes(new Uint8Array(out.bytes), { maxIssues: 50 });
    expect(report.issues.numErrors, JSON.stringify(report.issues.messages.filter((m) => m.severity === 0))).toBe(0);
    const len = out.bytes.readUInt32LE(12), json = JSON.parse(out.bytes.slice(20, 20 + len).toString('utf8'));
    for (const s of ['airPaint', 'canopy']) expect(json.materials.some((m) => m.name === `form:${s}`), s).toBe(true);
  }, 60000);
});
