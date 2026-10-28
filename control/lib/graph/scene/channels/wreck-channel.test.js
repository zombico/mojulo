// A destroyed body's laws (wreck-channel.js, the runtime's mark in worlds/controllable/vanish.js, the words in
// gameworld/vanish.js): a dismantle cuts the rig's joints, never a face, by its `sever` word, the small bones riding their
// hand or foot; each piece falls and settles on the floor; the runtime marks the body destroyed the frame it goes down
// and hands it to no transit; the undead are destroyed by their form; and a page without one carries none of it.
import { describe, it, expect } from 'vitest';
import { wreckGroups, wreckPiece, wreckStep, WRECK_LIMBS } from './wreck-channel.js';
import { statusScript } from './status-channel.js';
import { humanoidParents } from '../../figures/rig-tpose.js';
import { composeLive } from '../../worlds/controllable/compose.js';
import { vanishOf, readVanish, UNDEAD_DESTRUCTION, WRECK_LINGER, BLOW_DESTRUCTION } from '../../gameworld/vanish.js';
import { LINEAGES } from '../../egocube/ancestry.js';
import { heroRecord, expandLayeredManifest } from '../../../mcp/tools/layered.js';
import { WORLD_KINDS } from '../../worlds/world-kinds.js';
import { slashPlane, cleaveFigure } from '../rig-cleave.js';
import { shedParts } from '../rig-shed.js';

// a hero's packed bones (the page's), and their parents as the world-scene lays them
const pack = (await WORLD_KINDS.layered.resolve(expandLayeredManifest({ kind: 'layered', hero: heroRecord({ form: 'tiered', cast: 'male', undead: { form: 'skeleton', build: 'canonical', seed: 3 } }) }), { title: 't' })).figures.body;
const bones = pack.bones, parent = humanoidParents(bones);
const groupOf = (G, id) => G.groups.find((g) => g.includes(bones.findIndex((b) => b.id === id)));

describe('a dismantle cuts the joints', () => {
  it('every joint, the fingers riding their hand: the skull, the jaw, each long bone its own piece', () => {
    const G = wreckGroups(bones, parent, { sever: 'all' });
    for (const id of ['head', 'jaw', 'thighR', 'shankR', 'upperArmL']) expect(groupOf(G, id).length).toBeLessThanOrEqual(3);
    expect(groupOf(G, 'handR')).toEqual(expect.arrayContaining(bones.map((b, i) => [b.id, i]).filter(([id]) => /^index\dR$/.test(id)).map(([, i]) => i)));
    expect(G.groups.length).toBeGreaterThan(15);
  });
  it('the head and the limbs: the trunk one piece, each limb one with its hand or foot', () => {
    const G = wreckGroups(bones, parent, { sever: 'limbs' });
    expect(G.cut.sort()).toEqual([...WRECK_LIMBS].sort());
    expect(groupOf(G, 'thighR')).toContain(bones.findIndex((b) => b.id === 'footR'));
    expect(groupOf(G, 'torso')).toContain(bones.findIndex((b) => b.id === 'pelvis'));
    expect(groupOf(G, 'torso')).not.toContain(bones.findIndex((b) => b.id === 'head'));
  });
  it('a few, on the dice: two or three of the head and limbs, the same for the same seed', () => {
    const picks = [1, 2, 3, 4, 5, 6].map((seed) => wreckGroups(bones, parent, { sever: 'some', seed }).cut);
    for (const c of picks) { expect(c.length).toBeGreaterThanOrEqual(2); expect(c.length).toBeLessThanOrEqual(3); for (const id of c) expect(WRECK_LIMBS).toContain(id); }
    expect(new Set(picks.map((c) => c.join())).size).toBeGreaterThan(1);
    expect(wreckGroups(bones, parent, { sever: 'some', seed: 4 })).toEqual(wreckGroups(bones, parent, { sever: 'some', seed: 4 }));
  });
  it('each function the page runs is its own source alone (import-free), the limbs its default', () => {
    for (const fn of [wreckGroups, wreckPiece, wreckStep]) expect(() => new Function(`return (${fn.toString()})`)()).not.toThrow();
    const alone = new Function(`return (${wreckGroups.toString()})`)();
    expect(alone(bones, parent, { sever: 'limbs' })).toEqual(wreckGroups(bones, parent, { sever: 'limbs' }));
    expect(wreckGroups(bones, parent, { sever: 'limbs' }).cut.sort()).toEqual([...WRECK_LIMBS].sort());
  });
  it('a rig with no parents given joins each bone to the bone nearest its head', () => {
    expect(wreckGroups(bones, null, { sever: 'head' }).groups.length).toBe(2);
  });
});

describe('a cleave cuts by part', () => {
  const f32 = (b) => { const x = Buffer.from(b, 'base64'); return new Float32Array(x.buffer, x.byteOffset, x.byteLength / 4); };
  const plane = slashPlane(pack.figH, { seed: 5 }), C = cleaveFigure(pack, { plane, inside: '#802020' });
  const dist = (p) => plane.n[0] * p[0] + plane.n[1] * p[1] + plane.n[2] * p[2] - plane.d;
  it('a slash through the trunk: the head above it, the feet below, the trunk cut', () => {
    const at = (id) => C.side[bones.findIndex((b) => b.id === id)];
    expect(at('head')).toBe(1);
    expect(at('footL')).toBe(-1);
    expect(Object.keys(C.cut).map((i) => bones[i].id)).toEqual(expect.arrayContaining(['torso']));
    expect(plane.n[2]).toBeGreaterThan(Math.cos((50 * Math.PI) / 180) - 1e-6);
  });
  it('each half lies on its own side of the cut, capped on it in the inside', () => {
    for (const [bi, H] of Object.entries(C.cut)) {
      for (const [k, sgn] of [['up', 1], ['down', -1]]) {
        const P = f32(H[k].pos);
        for (let i = 0; i < P.length; i += 3) expect(sgn * dist([P[i], P[i + 1], P[i + 2]])).toBeGreaterThan(-1e-4);
        // the cap's corners lie on the cut, in the inside's colour (linear, as the pack's colours are)
        const col = Buffer.from(H[k].col, 'base64'), on = [];
        for (let i = 0; i < P.length / 3; i++) if (Math.abs(dist([P[i * 3], P[i * 3 + 1], P[i * 3 + 2]])) < 1e-4) on.push(i);
        expect(on.some((i) => Math.abs(col[i * 3] - Math.round(((0x80 / 255) ** 2.2) * 255)) <= 1 && col[i * 3 + 1] === col[i * 3 + 2])).toBe(true);
      }
      expect(Number(bi)).toBeGreaterThanOrEqual(0);
    }
  });
  it('the same figure and seed cut the same, another seed elsewhere', () => {
    expect(JSON.stringify(cleaveFigure(pack, { plane: slashPlane(pack.figH, { seed: 5 }) }))).toBe(JSON.stringify(cleaveFigure(pack, { plane: slashPlane(pack.figH, { seed: 5 }) })));
    expect(slashPlane(pack.figH, { seed: 6 })).not.toEqual(plane);
  });
});

describe('a piece falls and settles', () => {
  it('a bone dropped spinning lands, tips onto its side and comes to rest on the floor', () => {
    const bar = [-0.2, 0.2].flatMap((x) => [-0.02, 0.02].flatMap((y) => [-0.02, 0.02].map((z) => [x, y, 1 + z])));
    const B = wreckPiece(bar, [0, 0, 1], [1, 0, 1.5], [3, 5, 1]);
    for (let i = 0; i < 120 * 4 && !B.rest; i++) wreckStep(B, 1 / 120, 0);
    expect(B.rest).toBe(true);
    // lying flat: its lowest corner on the floor, its centre no higher than its half thickness and a little more
    expect(B.x[2]).toBeLessThan(0.06);
    expect(B.x[2]).toBeGreaterThan(0);
    expect(B.x[0]).toBeGreaterThan(0.05);
  });
});

describe('the runtime and the words', () => {
  const E = composeLive();
  const body = (id, pos, vanish) => ({ id, team: 'foes', rule: { type: 'static' }, body: { type: 'mesh', hittable: true, hp: 20, vanish }, transform: { pos, heading: 0 } });
  it('a destroyed body is marked the frame it goes down, lies, then goes with no transit', () => {
    const st = E.createWorld({ entities: [body('a', [0, 0, 0], { is: 'sink', linger: 0.5, die: 'dismantle', sever: 'limbs' }), { id: 'hero', team: 'heroes', rule: { type: 'static' }, body: { type: 'mesh' }, transform: { pos: [-2, 0, 0], heading: 0 } }] });
    E.stepWorld(st, {}, 1 / 30, { ground: () => 0 });
    Object.assign(st.byId.a, { downed: true, lastHitBy: 'hero' });
    E.stepWorld(st, {}, 1 / 30, { ground: () => 0 });
    const W = st.byId.a.wreck;
    expect(W).toMatchObject({ die: 'dismantle', sever: 'limbs', is: 'sink' });
    expect(W.from[0]).toBeCloseTo(1, 5);   // thrown away from who struck it
    for (let i = 0; i < 20; i++) E.stepWorld(st, {}, 1 / 30, { ground: () => 0 });
    expect(st.byId.a.gone).toBe(true);
    expect(st.byId.a.transit).toBeUndefined();
    expect(W.gone).toBeGreaterThan(W.t0);
  });
  it('a destroy dies as the killing blow says: a strike cleaves, a shot knocks some off, a burst tears it apart, none its own way', () => {
    const by = { ...BLOW_DESTRUCTION, else: { die: 'cleave' } };
    const kill = (how) => {
      const st = E.createWorld({ entities: [body('a', [0, 0, 0], { is: 'fade', linger: 3, die: 'destroy', by }), { id: 'hero', team: 'heroes', rule: { type: 'static' }, body: { type: 'mesh' }, transform: { pos: [-2, 0, 0], heading: 0 } }] });
      E.stepWorld(st, {}, 1 / 30, { ground: () => 0 });
      const h = st.byId.hero, a = st.byId.a, t = st.time;
      if (how === 'swing') h.lastStrike = { targetId: 'a', t };
      if (how === 'round') h.lastShot = { targetId: 'a', t };
      if (how === 'burst') st.bursts = [{ seq: 0, pos: [0.5, 0.5, 0], t, radius: 2 }];
      Object.assign(a, { downed: true, lastHitBy: 'hero' });
      E.stepWorld(st, {}, 1 / 30, { ground: () => 0 });
      return a.wreck;
    };
    expect(kill('swing')).toMatchObject({ die: 'cleave', how: 'swing' });
    expect(kill('round')).toMatchObject({ die: 'dismantle', sever: 'some', how: 'round' });
    const B = kill('burst');
    expect(B).toMatchObject({ die: 'dismantle', sever: 'all', how: 'burst', kick: BLOW_DESTRUCTION.burst.kick });
    expect(B.from[0]).toBeLessThan(0);   // thrown away from where it went off
    expect(kill(null)).toMatchObject({ die: 'cleave' });
    expect(kill(null).how).toBeUndefined();
  });
  it('the undead are destroyed by their form, at least long enough to settle; a living people falls as before', () => {
    const [skel] = Object.entries(LINEAGES).find(([, l]) => l.form === 'skeleton'), [corpse] = Object.entries(LINEAGES).find(([, l]) => l.form === 'zombie');
    for (const [p, form] of [[skel, 'skeleton'], [corpse, 'zombie']]) {
      const V = vanishOf({}, { skin: { people: p } }), U = UNDEAD_DESTRUCTION[form];
      expect(V).toMatchObject({ die: 'destroy', inside: U.inside, by: { ...BLOW_DESTRUCTION, else: U.else } });
    }
    // the default table, a foe's own `by` over it blow by blow
    const own = vanishOf({}, { skin: { people: skel }, vanish: { die: 'destroy', by: { swing: { die: 'dismantle', sever: 'head' } } } });
    expect(own.by).toMatchObject({ swing: { die: 'dismantle', sever: 'head' }, round: BLOW_DESTRUCTION.round });
    expect(() => readVanish({ die: 'destroy', by: { kick: { die: 'cleave' } } }, 'v')).toThrow(/not a blow/);
    expect(() => readVanish({ die: 'destroy', by: { swing: { die: 'fall' } } }, 'v')).toThrow(/dismantle \| cleave/);
    expect(vanishOf({}, { skin: { people: skel } }).linger).toBeGreaterThanOrEqual(WRECK_LINGER);
    expect(vanishOf({}, { skin: { people: 'human' } }).die).toBe('fall');
    // an entry's own word, and a squash (the death beat itself), stand over it
    expect(vanishOf({}, { skin: { people: skel }, vanish: { die: 'fall' } }).die).toBe('fall');
    expect(vanishOf({}, { skin: { people: skel }, vanish: 'squash' }).die).toBe('fall');
    expect(() => readVanish({ die: 'dismantle', sever: 'tail' }, 'v')).toThrow(/sever is which joints/);
    expect(() => readVanish({ die: 'fall', sever: 'all' }, 'v')).toThrow(/goes with die: 'dismantle'/);
  });
  it('a mode is defeated, never destroyed: it resets into the next, and only the last dies', () => {
    const e = body('a', [0, 0, 0], { is: 'fade', linger: 0.5, die: 'destroy', by: { ...BLOW_DESTRUCTION, else: { die: 'dismantle', sever: 'all' } } });
    e.body = { ...e.body, type: 'figure-rig', figure: 'armoured', modes: [{ figure: 'armoured', hp: 20 }, { figure: 'bare', hp: 12 }] };
    const st = E.createWorld({ entities: [e, { id: 'hero', team: 'heroes', rule: { type: 'static' }, body: { type: 'mesh' }, transform: { pos: [-2, 0, 0], heading: 0 } }] });
    E.stepWorld(st, {}, 1 / 30, { ground: () => 0 });
    const a = st.byId.a;
    expect(a.noDestroy).toBe(true);   // a mode is left under it: a killing blow floors it and refills it
    Object.assign(a, { downed: true, lastHitBy: 'hero' }); a.body.hp = 0;
    E.stepWorld(st, {}, 1 / 30, { ground: () => 0 });
    expect(a.downed).toBe(false);
    expect(a.body).toMatchObject({ figure: 'bare', hp: 12 });
    expect(a.shed).toMatchObject({ seq: 0, figure: 'armoured', into: 'bare' });
    expect(a.wreck).toBeUndefined();
    expect(a.noDestroy).toBe(false);   // the last mode, layer 0: the next killing blow destroys it
    Object.assign(a, { downed: true }); a.body.hp = 0;
    for (let i = 0; i < 20; i++) E.stepWorld(st, {}, 1 / 30, { ground: () => 0 });
    expect(a.wreck).toBeDefined();
    expect(a.gone).toBe(true);
  });
  it('what a mode sheds is what its figure carries and the next lacks, bone by bone', async () => {
    const fig = async (layers) => (await WORLD_KINDS.layered.resolve(expandLayeredManifest({ kind: 'layered', hero: heroRecord({ form: 'tiered', cast: 'male', undead: { form: 'skeleton', build: 'heroic', seed: 3, ...(layers ? { layers } : {}) } }) }), { title: 't' })).figures.body;
    const A = await fig(['adorned']), B = await fig();
    expect(shedParts(B, B)).toEqual({});
    const D = shedParts(A, B), tri = (p) => Buffer.from(p.pos, 'base64').length / 36;
    expect(Object.keys(D).length).toBeGreaterThan(0);
    // each bone sheds its armour alone: what is left is the bare bone's own, triangle for triangle
    for (const [bi, part] of Object.entries(D)) {
      const j = B.bones.findIndex((b) => b.id === A.bones[bi].id);
      expect(tri(part) + (B.parts[j] ? tri(B.parts[j]) : 0)).toBe(tri(A.parts[bi]));
    }
  });
  it('a page with no destroyed body carries no wreck', () => {
    expect(statusScript({}, ['fade'])).not.toMatch(/__stepWrecks/);
    expect(statusScript({}, ['fade'], { wreck: true })).toMatch(/__stepWrecks\(\);/);
  });
});
