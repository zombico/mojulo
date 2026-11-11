// Skandart (era/skandart.js): a room's debris by its causes, asked for by a recipe's `skandart` on a kit that answers
// the question (the ashlar crypt). One small room: what is laid keeps its laws, rides to the page as instanced repeats
// lit where each stamp lies, and steps the old rubble aside; asked for nothing, it adds nothing.
import { describe, it, expect } from 'vitest';
import { assembleStageScene, planStage, buildStageGeometry, formLightFaces } from './stage.js';
import { readSkandart, skandartTemplates, skandartStamps, skandartLaws, SKANDART } from './skandart.js';
import { rhythmFaults } from './wall-rhythm.js';
import { formScript, FORM_PAGE } from '../scene/channels/form.js';
import { emitThreeWorld } from '../scene/scene-three.js';

const ROOM = (over = {}) => ({ kind: 'stage', kit: 'gothic-ashlar', rooms: [{ id: 'a', x: 0, y: 0, w: 10, d: 12, h: 8 }], ...over });
const debris = (P) => (P.repeats || []).filter((r) => r.group.startsWith('skandart:'));

describe('skandart: a room\'s debris by its causes', () => {
  const plain = assembleStageScene(ROOM(), {}), asked = assembleStageScene(ROOM({ skandart: true }), {});

  it('reads its key: true, a number or { amount }; nothing asked adds nothing; a kit that answers no debris question says so', () => {
    expect(readSkandart({})).toBe(null);
    expect(readSkandart({ skandart: false })).toBe(null);
    expect(readSkandart({ skandart: 0 })).toBe(null);
    expect(readSkandart({ skandart: true })).toEqual({ amount: 0.6 });
    expect(readSkandart({ skandart: { amount: 0.3 } })).toEqual({ amount: 0.3 });
    expect(() => readSkandart({ skandart: 2 })).toThrow(/0 \(none\) to 1/);
    expect(() => readSkandart({ skandart: { much: 1 } })).toThrow(/not a dial/);
    expect(JSON.stringify(assembleStageScene(ROOM({ skandart: false }), {}))).toBe(JSON.stringify(plain));
    expect(debris(plain)).toEqual([]);
    expect(() => planStage({ ...ROOM({ skandart: true }), kit: 'gothic-stone' })).toThrow(/answers no debris question/);
  }, 120_000);

  it('lays each clump where its cause puts it, keeping its laws: on its ground, out of the wall, on the border course, bigger than a hand, a wall\'s strips in its rhythm', () => {
    const plan = planStage(ROOM({ skandart: true })), geom = buildStageGeometry(plan);
    const T = skandartTemplates(plan, plan.skandart.amount), S = skandartStamps(plan, geom), laws = skandartLaws(plan, T, S);
    expect(laws.filter((r) => !r.ok)).toEqual([]);
    for (const law of ['no-floating', 'hand', 'not-in-the-wall', 'on-the-border', 'wall-rhythm', 'placed']) expect(laws.some((r) => r.law === law)).toBe(true);
    // (the foot, the corners and the apron each laid; the lesser strip is the full one with less on it)
    for (const role of ['foot', 'corner', 'apron']) expect(S.some((s) => T[s.tpl].role === role)).toBe(true);
    expect(T['foot-0b'].pieces.length).toBeLessThan(T['foot-0a'].pieces.length);
    expect(T['foot-0b'].pieces.filter((q) => q.kind === 'anchor')).toEqual(T['foot-0a'].pieces.filter((q) => q.kind === 'anchor'));
    expect(Object.values(T).flatMap((t) => t.pieces || []).every((q) => q.w >= SKANDART.hand)).toBe(true);
    const walls = new Map();
    for (const s of S) if (s.wall !== undefined) walls.set(s.wall, [...(walls.get(s.wall) || []), s.tpl.endsWith('a') ? 'A' : 'B']);
    for (const seq of walls.values()) expect(rhythmFaults(seq)).toEqual([]);
    // (in the kit's gutter what falls lies on the gutter's floor)
    expect(T['foot-0a'].pieces.some((q) => q.z === -plan.kit.gutter.depth)).toBe(true);
  });

  it('rides to the page as instanced repeats, one a clump, each stamp lit where it lies; the rubble and the fallen stone it replaces step aside, and the webs within reach are swept', () => {
    const D = debris(asked);
    expect(D.length).toBeGreaterThan(3);
    for (const r of D) {
      expect(r.transforms.length).toBeGreaterThan(0);
      expect(r.transforms.every((t) => Array.isArray(t.tint) && t.tint.every((v) => v > 0 && v <= 1))).toBe(true);
      expect(r.template.every((f) => f.fill && !f.tint)).toBe(true);
    }
    // (not one light for every stamp: each is read where it lies)
    const tints = new Set(D.flatMap((r) => r.transforms.map((t) => t.tint.join())));
    expect(tints.size).toBeGreaterThan(D.length);
    // (it was nowhere in the faces: the debris is instanced, never baked into the room)
    expect(asked.faces.some((f) => String(f.group).startsWith('skandart'))).toBe(false);
    expect(plain.faces.some((f) => f.group === 'stage:rubble')).toBe(true);
    expect(asked.faces.some((f) => f.group === 'stage:rubble')).toBe(false);
    // (the fallen stone among the corner things goes; every other thing stands where it stood, its dice as they fell)
    const things = (P, kinds) => P.anchors.filter((a) => kinds.includes(a.form)).map((a) => `${a.form}@${a.at.join()}`);
    expect(things(plain, ['stones', 'boulder', 'debris']).length).toBeGreaterThan(0);
    expect(things(asked, ['stones', 'boulder', 'debris'])).toEqual([]);
    expect(things(asked, ['planks', 'crate', 'barrel'])).toEqual(things(plain, ['planks', 'crate', 'barrel']));
    const webs = (P) => P.faces.filter((f) => f.texture === 'card:cobweb');
    const low = (P) => webs(P).filter((f) => Math.min(...f.corners.map((c) => c[2])) < 2);
    expect(low(plain).length).toBeGreaterThan(0);
    expect(low(asked)).toEqual([]);
    expect(webs(asked).length).toBeGreaterThan(0);
    // (deterministic: the same room twice is the same page)
    expect(JSON.stringify(debris(assembleStageScene(ROOM({ skandart: true }), {})))).toBe(JSON.stringify(D));
  }, 120_000);

  it('in the form render a clump\'s colour is its matter\'s base, its shade rides as its light and the stamp\'s light as its tint; a bake asked for no probes is as it was', () => {
    const P = assembleStageScene(ROOM({ skandart: true }), { formLit: true }), D = debris(P);
    expect(D.length).toBeGreaterThan(3);
    for (const r of D) expect(r.template.every((f) => f.cornerLight !== undefined)).toBe(true);
    const raw = [{ corners: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]], normal: [0, 0, 1], tint: [0.6, 0.6, 0.6] }];
    const lamps = [{ at: [0.5, 0.5, 2], color: '#ffaa66', intensity: 1.5, radius: 6 }], amb = [0.1, 0.1, 0.12];
    const base = formLightFaces(raw, lamps, amb), probed = formLightFaces(raw, lamps, amb, undefined, { probes: [{ at: [0.5, 0.5, 0.15], normal: [0, 0, 1] }], paints: [{ colour: [0.5, 0.5, 0.5], tint: [1, 1, 1] }] });
    expect(Object.keys(base)).toEqual(['faces', 'light']);
    expect(JSON.stringify(probed.faces)).toBe(JSON.stringify(base.faces));
    expect(probed.probes[0].every((v) => v > 0)).toBe(true);
    expect(probed.paints[0].every((v) => v > 0 && v <= 1)).toBe(true);
  }, 120_000);

  it('the form render lights instanced repeats in a room under no sun only when they carry their light: a page without them is as it was', () => {
    const cfg = { ...FORM_PAGE, lights: [], ambient: [0.1, 0.1, 0.1], fall: 2, maps: {} };
    expect(formScript(cfg)).not.toMatch(/const shared = new Map/);
    expect(formScript({ ...cfg, instanced: true })).toMatch(/const shared = new Map/);
    const quad = { corners: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]], normal: [0, 0, 1], fill: '#808080', cornerLight: [[1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1]] };
    const page = (repeats) => emitThreeWorld({ faces: [quad], repeats, form: { room: { lights: [{ at: [0, 0, 2], key: [1, 1, 1], radius: 5, live: true }], ambient: [0.1, 0.1, 0.1], fall: 2 } } });
    const { cornerLight, ...unlit } = quad;
    expect(page([{ template: [quad], transforms: [{ pos: [2, 0, 0], tint: [0.5, 0.5, 0.5] }], group: 'skandart:t' }])).toMatch(/"instanced":true/);
    expect(page([{ template: [unlit], transforms: [{ pos: [2, 0, 0] }], group: 'stands' }])).not.toMatch(/"instanced"/);
  });
});
