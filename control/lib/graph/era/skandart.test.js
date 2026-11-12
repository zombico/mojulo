// Skandart (era/skandart.js): a room's debris by its causes, asked for by a recipe's `skandart` on a kit that answers
// the question (the ashlar crypt). One small room: what is laid keeps its laws, rides to the page as instanced repeats
// lit where each stamp lies, and steps the old rubble aside; asked for nothing, it adds nothing.
import { describe, it, expect } from 'vitest';
import { assembleStageScene, planStage, buildStageGeometry, formLightFaces } from './stage.js';
import { readSkandart, skandartTemplates, skandartStamps, skandartLaws, skandartRead } from './skandart.js';
import { rhythmFaults } from './wall-rhythm.js';
import { formScript, FORM_PAGE } from '../scene/channels/form.js';
import { emitThreeWorld } from '../scene/scene-three.js';

const ROOM = (over = {}) => ({ kind: 'stage', kit: 'gothic-ashlar', rooms: [{ id: 'a', x: 0, y: 0, w: 10, d: 12, h: 8 }], ...over });
const debris = (P) => (P.repeats || []).filter((r) => r.group.startsWith('skandart:'));

describe('skandart: a room\'s debris by its causes', () => {
  const plain = assembleStageScene(ROOM(), {}), asked = assembleStageScene(ROOM({ skandart: true }), {});

  it('reads its key: true, a number or { amount, … }; nothing asked adds nothing; a kit with no card answers by what it is made of', () => {
    expect(readSkandart({})).toBe(null);
    expect(readSkandart({ skandart: false })).toBe(null);
    expect(readSkandart({ skandart: 0 })).toEqual({ amount: 0 });
    expect(readSkandart({ skandart: true })).toEqual({ amount: 0.6 });
    expect(readSkandart({ skandart: { amount: 0.3 } })).toEqual({ amount: 0.3 });
    expect(() => readSkandart({ skandart: 2 })).toThrow(/0 \(none\) to 1/);
    expect(() => readSkandart({ skandart: { much: 1 } })).toThrow(/not a dial/);
    expect(JSON.stringify(assembleStageScene(ROOM({ skandart: false }), {}))).toBe(JSON.stringify(plain));
    expect(debris(plain)).toEqual([]);
    expect(planStage({ ...ROOM({ skandart: true }), kit: 'gothic-stone' }).skandart).toMatchObject({ from: 'derived', card: { derived: { wall: ['stone'] } } });
  }, 120_000);

  it('lays each clump where its cause puts it, keeping its laws: on its ground, out of the wall, on the border course, big enough to read, a wall\'s strips in its rhythm', () => {
    const plan = planStage(ROOM({ skandart: true })), geom = buildStageGeometry(plan), fine = skandartRead(1080);
    const T = skandartTemplates(plan, plan.skandart.amount, fine), S = skandartStamps(plan, geom);
    for (const read of [fine, skandartRead()]) {
      const laws = skandartLaws(plan, skandartTemplates(plan, plan.skandart.amount, read), S, read);
      expect(laws.filter((r) => !r.ok)).toEqual([]);
      for (const law of ['no-floating', 'repose', 'too-small-to-read', 'not-in-the-wall', 'off-the-walk', 'wall-rhythm', 'placed']) expect(laws.some((r) => r.law === law)).toBe(true);
    }
    // (the foot, the corners and the apron each laid; the lesser strip is the full one with less on it)
    for (const role of ['foot', 'corner', 'apron']) expect(S.some((s) => T[s.tpl].role === role)).toBe(true);
    // (the lesser heap is the full one lower, with fewer of the same pieces on it)
    const key = (q) => `${q.id}@${q.x},${q.y},${q.w}`;
    expect(T['foot-0b'].body.H).toBeLessThan(T['foot-0a'].body.H);
    expect(T['foot-0b'].pieces.length).toBeLessThan(T['foot-0a'].pieces.length);
    expect(T['foot-0b'].pieces.map(key).every((k) => T['foot-0a'].pieces.map(key).includes(k))).toBe(true);
    const walls = new Map();
    for (const s of S) if (s.wall !== undefined) walls.set(s.wall, [...(walls.get(s.wall) || []), s.tpl.endsWith('a') ? 'A' : 'B']);
    for (const seq of walls.values()) expect(rhythmFaults(seq)).toEqual([]);
    // (a heap fills the kit's gutter and spills over its lip onto the floor; its toe keeps off the walk)
    const zs = T['foot-0a'].faces.filter((f) => f.matter === 'grit').flatMap((f) => f.corners);
    expect(Math.min(...zs.map((c) => c[2]))).toBeLessThan(-plan.kit.gutter.depth + 0.01);
    expect(Math.max(...zs.map((c) => c[1]))).toBeGreaterThan(plan.kit.plinth.out + plan.kit.gutter.width);
    // (a heap is what its card names off the shelf: a block at its toe, spall up its face, the coat's flakes over it)
    expect(new Set(T['corner-0'].pieces.map((q) => q.id))).toEqual(new Set(Object.keys(plan.kit.skandart.corner.pieces)));
    const block = T['corner-0'].pieces.filter((q) => q.id === 'fallen-block'), spall = T['corner-0'].pieces.filter((q) => q.id === 'spall');
    const dist = (q) => Math.hypot(q.x, q.y), mean = (qs) => qs.reduce((a, q) => a + dist(q), 0) / qs.length;
    expect(mean(block)).toBeGreaterThan(mean(spall));
  });

  it('more is the same heap with more on it: the amount raises the body and deals the next of the same pieces', () => {
    const plan = planStage(ROOM({ skandart: true })), read = skandartRead(1080), key = (q) => `${q.id}@${q.x},${q.y},${q.w}`;
    const [lo, mid, hi] = [0.3, 0.6, 1].map((a) => skandartTemplates(plan, a, read)['foot-1a']);
    expect(lo.body.H).toBeLessThan(mid.body.H);
    expect(mid.body.H).toBeLessThan(hi.body.H);
    expect(lo.pieces.length).toBeLessThan(mid.pieces.length);
    expect(mid.pieces.length).toBeLessThan(hi.pieces.length);
    expect(lo.pieces.map(key).every((k) => mid.pieces.map(key).includes(k))).toBe(true);
    expect(mid.pieces.map(key).every((k) => hi.pieces.map(key).includes(k))).toBe(true);
  });

  it('leaves out what is too small to be read where it is seen: the eye spot at filler\'s distance, in the frame the render reads at; a coarser frame keeps the same heap with fewer of its small pieces', () => {
    const coarse = skandartRead(), fine = skandartRead(1080);
    // (the sixth generation's 640×448 at six metres, and a 1080-line target's)
    expect(coarse).toEqual({ distance: 6, screenPx: 448, least: expect.closeTo(0.186, 3) });
    expect(fine.least).toBeCloseTo(0.077, 3);
    const plan = planStage(ROOM({ skandart: true })), C = skandartTemplates(plan, 0.6, coarse), F = skandartTemplates(plan, 0.6, fine);
    const all = (T) => Object.values(T).flatMap((t) => t.pieces || []);
    expect(all(C).every((q) => q.w >= coarse.least)).toBe(true);
    expect(all(F).every((q) => q.w >= fine.least)).toBe(true);
    expect(all(C).length).toBeLessThan(all(F).length);
    // (the same dice: every piece the coarse frame keeps stands where the fine one has it)
    const at = (q) => `${q.id}@${q.x},${q.y},${q.w}`, fineAt = new Set(all(F).map(at));
    for (const q of all(C)) expect(fineAt.has(at(q))).toBe(true);
    // (a drop of wax too small to read goes as well: the pour's whole pool in the coarse frame)
    expect(C['apron-pour'].faces.length).toBeLessThan(F['apron-pour'].faces.length);
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
