// hero-attach: objects of the operator's own worn on a bone. The concepts: an attachment is checked (one object or ref, a
// joint, the placing words), an object that draws nothing is refused; a ref is copied in at the door, so the hero stays
// its own recipe; it lands where it was put (its anchor on the joint, its size as asked) and rides its bone; a mirror is a
// reflected twin on the other side; the rendered hero carries it, and a hero without one is as it was.
import { describe, it, expect } from 'vitest';
import { validateAttach, attachRecord, attachMounts, attachReadout } from './hero-attach.js';
import { gearFaces, gearPackParts, gearRestPoint } from './hero-gear.js';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { withDefaultForm } from './motion-stamp.js';
import { validateRig } from './station-loft-rig.js';
import { DEFAULT_LIGHT } from './vexar.js';

// a horn: a cone 20 cm tall, its base at the origin
const HORN = { units: 'cm', lathes: [{ axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 20 }, profile: [{ t: 0, radius: 3 }, { t: 1, radius: 0.2 }] }] };
const rigOf = (spec) => validateRig(expandLayeredManifest({ kind: 'layered', hero: heroRecord(withDefaultForm(spec)) }).recipe.rig);
const box = (faces) => { const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity]; for (const f of faces) for (const c of f.corners) for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], c[a]); hi[a] = Math.max(hi[a], c[a]); } return { lo, hi }; };

describe('worn objects of the operator\'s own', () => {
  it('checks each attachment, and refuses an object that draws nothing', () => {
    expect(validateAttach([{ object: HORN, at: 'headTop' }])).toEqual([]);
    expect(validateAttach([{ object: HORN, at: ['elbowR', 'wristR'], t: 0.4, size: 0.1, fit: 'max', align: 'bone', mirror: true }])).toEqual([]);
    expect(validateAttach({ object: HORN })[0]).toMatch(/a list of/);
    expect(validateAttach([{ at: 'headTop' }])[0]).toMatch(/one of `object`/);
    expect(validateAttach([{ object: { lathes: [] }, at: 'headTop' }])[0]).toMatch(/draws nothing/);
    expect(validateAttach([{ object: HORN, at: 'headTop', t: 0.5 }]).join()).toMatch(/along a pair/);
    expect(validateAttach([{ object: HORN, at: 'nose' }], { joints: ['headTop'] })[0]).toMatch(/no joint 'nose'/);
    expect(validateAttach([{ object: HORN, at: 'headTop', spin: 1 }])[0]).toMatch(/not an attachment's/);
  });
  it('copies a ref in at the door, keeps a stamp that stands for its ref, and refuses what is not a workbench solid', () => {
    const rows = { horn: { kind: 'workbench', title: 'a horn', ...HORN }, hero: { kind: 'layered' } };
    const lookup = (r) => rows[r] ?? null;
    const [a] = attachRecord([{ ref: 'horn', at: 'headTop' }], { lookup });
    expect(a.resolved).toEqual({ ref: 'horn', object: HORN });
    expect(attachRecord([a], { lookup: () => { throw new Error('read again'); } })[0]).toBe(a);
    expect(() => attachRecord([{ ref: 'hero', at: 'headTop' }], { lookup })).toThrow(/not a workbench solid/);
    expect(() => attachRecord([{ ref: 'gone', at: 'headTop' }], { lookup })).toThrow(/no sketch 'gone'/);
    expect(validateAttach([{ ref: 'horn', at: 'headTop' }])[0]).toMatch(/not resolved/);
    expect(validateAttach([a])).toEqual([]);
  });
  it('lands its anchor on the joint at the size asked, rides the bone there, and wears a mirrored twin opposite', () => {
    const R = rigOf({ cast: 'male' });
    const [G] = attachMounts({ attach: [{ object: HORN, at: 'headTop', anchor: 'base' }] }, R);
    expect(G.bone).toBe(R.bones.find((b) => b.head === 'headTop' || b.tail === 'headTop').id);
    // its own size (cm → m): 20 cm tall, its base on the crown
    const own = box(gearFaces([G], { light: DEFAULT_LIGHT }));
    expect(own.hi[2] - own.lo[2]).toBeCloseTo(0.2, 2);
    expect(own.lo[2]).toBeCloseTo(R.joints.headTop[2], 3);
    // a size in metres, along the fit
    const [S] = attachMounts({ attach: [{ object: HORN, at: 'headTop', size: 0.5 }] }, R);
    const sized = box(gearFaces([S], { light: DEFAULT_LIGHT }));
    expect(sized.hi[2] - sized.lo[2]).toBeCloseTo(0.5, 2);
    // a mirror: the twin on the other shoulder, reflected across the middle
    const two = attachMounts({ attach: [{ object: HORN, at: 'shoulderR', offset: [0.05, 0, 0.02], rotate: [0, 40, 0], mirror: true }] }, R);
    expect(two.map((m) => m.bone)).toEqual([two[0].bone, two[0].bone.replace(/R$/, 'L')]);
    const [r, l] = two.map((m) => box(gearFaces([m], { light: DEFAULT_LIGHT })));
    expect(l.lo[0]).toBeCloseTo(-r.hi[0], 3);
    expect(l.hi[2]).toBeCloseTo(r.hi[2], 3);
    // its rest point is where the pack puts it, on its bone
    const pack = gearPackParts([G], { light: DEFAULT_LIGHT });
    expect(pack[0].bone).toBe(G.boneIndex);
    expect(gearRestPoint(G, [0, 0, 0])[2]).toBeCloseTo(R.joints.headTop[2], 3);
    expect(attachReadout(two, R)[1]).toMatchObject({ mirrored: true });
  }, 60000);
  it('is worn by the hero the door mints, and a hero without one is as it was', () => {
    const plain = heroRecord(withDefaultForm({ cast: 'female' }));
    expect(plain.attach).toBeUndefined();
    const worn = heroRecord(withDefaultForm({ cast: 'female', attach: [{ object: HORN, at: ['elbowL', 'wristL'], align: 'bone', size: 0.12, id: 'spike' }] }));
    expect(worn.attach[0].id).toBe('spike');
    expect(() => heroRecord(withDefaultForm({ cast: 'female', attach: [{ object: HORN }] }))).toThrow(/attach\[0\]\.at/);
  });
});
