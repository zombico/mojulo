// In-memory SQLite + no semantic index — must run before importing db/index.js.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

// XENO MAKE-UP (lib/graph/xeno): the word's form, the appliance builders' solids (closed, the ridge's base under the
// skin), nothing at all without the word, and on a hero of each game head the appliances pinned to that head's carrier,
// coated, placed on its skin; a bald cap under the head-tails. (The realistic head runs the same frame on `headSkin`;
// it is drawn by the field run in the plan's log, minted there in minutes, not here.)
import { describe, expect, it } from 'vitest';

import { getDb } from '@/lib/db/index.js';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { createCharacterHandler } from '@/lib/mcp/tools/create-character';
import { APPENDAGE_FAMILIES, XENO_CARD_IDS, appendage, validateXenoHeaddress, withXeno, xenoWorn } from './index.js';
import { bladeMesh, ridgeMesh, tubeMesh } from './appliances.js';
import { xenoFrame } from './frame.js';

getDb();

/** every edge of a closed mesh is used by exactly two faces */
const closed = (M) => { const n = new Map(); for (const f of M.faces) for (let e = 0; e < 3; e++) { const a = f[e], b = f[(e + 1) % 3], k = a < b ? `${a}|${b}` : `${b}|${a}`; n.set(k, (n.get(k) || 0) + 1); } return [...n.values()].every((c) => c === 2); };

describe('the word', () => {
  it('takes a card or a card with its words, and refuses the rest naming where', () => {
    expect(validateXenoHeaddress(['forehead-ridges', { card: 'head-tails', size: 1.2, coat: 'snake', replaces: false }])).toEqual([]);
    expect(validateXenoHeaddress(['tentacle-crown']).join(' ')).toMatch(/xenoHeaddress\[0\]: a card/);
    expect(validateXenoHeaddress([{ card: 'nose-ridges', size: 4 }]).join(' ')).toMatch(/\[0\]\.size/);
    expect(validateXenoHeaddress([{ card: 'nose-ridges', coat: { pattern: [{ kind: 'zigzag' }] } }]).join(' ')).toMatch(/\[0\]\.coat\.pattern\[0\]\.kind/);
    expect(validateXenoHeaddress([{ card: 'nose-ridges', glue: true }]).join(' ')).toMatch(/glue: not an appliance word/);
    expect(validateXenoHeaddress(Array(13).fill('nose-ridges')).join(' ')).toMatch(/at most 12/);
    expect(XENO_CARD_IDS).toEqual(expect.arrayContaining(['forehead-ridges', 'nose-ridges', 'head-tails', 'swept-horns', 'front-tails', 'horned-tails']));
  });

  it('takes an appendage written whole, and refuses its words naming where', () => {
    expect(validateXenoHeaddress([{ family: 'horn', at: { az: 0, el: 70 }, length: 0.12, lift: 1, sweep: -20 }, { family: 'tail', at: { az: 90, el: 0 }, pair: true, fall: 'front', replaces: 'hair' }])).toEqual([]);
    expect(validateXenoHeaddress([{ family: 'fin', at: { az: 0, el: 0 } }]).join(' ')).toMatch(/\[0\]\.family: horn \| tail/);
    expect(validateXenoHeaddress([{ family: 'horn', at: { az: 0, el: 120 } }]).join(' ')).toMatch(/\[0\]\.at:/);
    expect(validateXenoHeaddress([{ family: 'horn', at: { az: 0, el: 0 }, lift: 2, fall: 'up', curl: 1 }]).join(' ')).toMatch(/\.lift: -1 … 1.*\.fall: 'back' \| 'front'|\.curl: not an appendage word/);
    expect(validateXenoHeaddress([{ family: 'lobe', at: { az: 14, el: 62 }, over: { az: 100, el: -25 }, plates: 8, shell: 'banded', stand: 0.04 }])).toEqual([]);
    expect(validateXenoHeaddress([{ family: 'horn', at: { az: 0, el: 0 }, plates: 4 }]).join(' ')).toMatch(/a lobe's words/);
    expect(validateXenoHeaddress([{ family: 'lobe', at: { az: 0, el: 0 }, over: { az: 0 } }]).join(' ')).toMatch(/\[0\]\.over:/);
    expect(validateXenoHeaddress([{ card: 'chitin-crest', shell: { cover: 'fins' } }]).join(' ')).toMatch(/\[0\]\.shell\.cover/);
    expect(xenoWorn({ hair: 'bob', xenoHeaddress: [{ family: 'tail', at: { az: 180, el: 0 }, replaces: 'hair' }] }).hair).toBe('none');
  });
});

describe('the builders', () => {
  it('lay a ridge on the skin as a closed solid, its base under the skin and its crest at its peak', () => {
    const S = Array.from({ length: 8 }, (_, i) => ({ p: [0, 0, i * 0.01], n: [0, 1, 0] }));
    const M = ridgeMesh(S, { height: (t) => 0.01 * Math.sin(Math.PI * t), width: () => 0.02, sink: 0.002 });
    expect(closed(M)).toBe(true);
    const ys = M.vertices.map((v) => v[1]);
    expect(Math.min(...ys)).toBeLessThan(0);                // the base sunk under the skin (y 0)
    expect(Math.max(...ys)).toBeGreaterThan(0.009);          // the crest stands proud by its height
  });

  it('flatten a lobe into a closed blade, its broad front toward the face it is given', () => {
    const line = Array.from({ length: 6 }, (_, i) => [0, 0, -i * 0.05]);
    const M = bladeMesh(line, { radius: () => 0.04, flat: 0.25, face: () => [0, 1, 0] });
    expect(closed(M)).toBe(true);
    const xs = M.vertices.map((v) => Math.abs(v[0])), ys = M.vertices.map((v) => Math.abs(v[1]));
    expect(Math.max(...xs)).toBeCloseTo(0.04, 6); expect(Math.max(...ys)).toBeLessThanOrEqual(0.01 + 1e-12); expect(Math.max(...ys)).toBeGreaterThan(0.0095);
    expect(M.front[2][1]).toBeCloseTo(1, 9);
  });

  it('build a tail as a closed tube along its line, tapering', () => {
    const line = Array.from({ length: 6 }, (_, i) => [0, 0, -i * 0.05]);
    const M = tubeMesh(line, { radius: (t) => 0.03 * (1 - t) + 0.005 });
    expect(closed(M)).toBe(true);
    const near = M.vertices.filter((v) => Math.abs(v[2]) < 1e-9 && Math.hypot(v[0], v[1]) > 1e-6), far = M.vertices.filter((v) => Math.abs(v[2] + 0.2) < 1e-9);
    expect(Math.hypot(near[0][0], near[0][1])).toBeGreaterThan(Math.hypot(far[0][0], far[0][1]));
  });
});

describe('the appendage', () => {
  // a ball of a head (radius 0.1, its centre at the brow line) on a body whose front is y 0.08 and back y −0.08
  const F = { centre: [0, 0, 0], chinZ: -0.1, browZ: 0, height: 0.23,
    toward: (az, el) => { const a = (az * Math.PI) / 180, e = (el * Math.PI) / 180, n = [Math.sin(a) * Math.cos(e), Math.cos(a) * Math.cos(e), Math.sin(e)]; return { p: n.map((v) => v * 0.1), n }; },
    frontOfBodyAt: () => 0.08, backOfBodyAt: () => -0.08 };
  const grow = (A) => appendage(F, 1, { ...APPENDAGE_FAMILIES[A.family], ...A });

  it('grows a horn up and back from its address, a closed tube tapering to its point', () => {
    const [h] = grow({ family: 'horn', at: { az: 0, el: 60 } }), L = h.mesh.line;
    expect(closed(h.mesh)).toBe(true);
    expect(L.at(-1)[2]).toBeGreaterThan(L[1][2] + 0.1);       // risen
    expect(L.at(-1)[1]).toBeLessThan(L[1][1]);                // swept back
  });

  it('pairs a piece with its mirror, and hangs a tail off the body on its side', () => {
    const P = grow({ family: 'tail', at: { az: 90, el: 0 }, pair: true, fall: 'front' });
    expect(P.map((p) => p.name)).toEqual(['R', 'L']);
    expect(P[0].mesh.line.at(-1)[0]).toBeCloseTo(-P[1].mesh.line.at(-1)[0], 9);
    for (const { mesh } of P) {
      expect(mesh.line.at(-1)[2]).toBeLessThan(F.chinZ);
      for (const p of mesh.line) if (p[2] < F.chinZ) expect(p[1]).toBeGreaterThan(0.08);   // in front of the chest, never in it
    }
    const [back] = grow({ family: 'tail', at: { az: 180, el: 0 } });
    for (const p of back.mesh.line) if (p[2] < F.chinZ) expect(p[1]).toBeLessThan(-0.08);
  });

  it('hugs the head over the cap, standing off it, and lays a lobe\'s hard plates across its front', () => {
    const P = grow({ family: 'lobe', at: { az: 14, el: 62 }, plates: 5, pair: true }), lobe = P.find((p) => p.name === 'R'), plates = P.filter((p) => p.role === 'shell' && p.name.startsWith('R'));
    expect(closed(lobe.mesh)).toBe(true);
    expect(plates.map((p) => p.name)).toEqual(['RPlate0', 'RPlate1', 'RPlate2', 'RPlate3', 'RPlate4']);
    for (const { mesh } of plates) expect(closed(mesh)).toBe(true);
    const hug = lobe.mesh.line.slice(2, 12);
    for (const p of hug) expect(Math.hypot(...p)).toBeGreaterThan(0.1 + 0.005);                // off the skin, never in it
    expect(hug.at(-1)[0]).toBeGreaterThan(0.05);                                                // carried round to its side
  });
});

describe('on a hero', () => {
  it('adds nothing without the word: the recipe itself', () => {
    const R = { parts: { a: {} } };
    expect(withXeno(R, {})).toBe(R);
    expect(withXeno(R, { xenoHeaddress: [] })).toBe(R);
  });

  it.each([['landmark', { cast: 'female' }], ['anime', { cast: 'female', head: 'anime' }]])('pins each appliance to the %s head\'s carrier, coated, on its skin', async (head, spec) => {
    const out = await createCharacterHandler({ as: 'hero', title: head, spec: { ...spec, xenoHeaddress: ['forehead-ridges', 'nose-ridges', 'head-tails', 'swept-horns', { family: 'tail', at: { az: 180, el: 20 }, length: 0.3 }, 'chitin-crest', 'cheek-ridges'] } });
    const R = SketchRepository.getByRef(out.ref).manifest.recipe, F = xenoFrame(R);
    expect(F.head).toBe(head);
    const xeno = Object.entries(R.parts).filter(([n]) => n.startsWith('xeno'));
    expect(xeno.map(([n]) => n)).toEqual(expect.arrayContaining(['xenoForeheadRidges0Mid', 'xenoNoseRidges1Bar0', 'xenoHeadTails2R', 'xenoHeadTails2L', 'xenoSweptHorns3HornR', 'xenoSweptHorns3HornL', 'xenoTail4Tail', 'xenoChitinCrest5LobeR', 'xenoChitinCrest5LobeRPlate0', 'xenoCheekRidges6L']));
    for (const [n, P] of xeno) {
      expect(P.pin.parent, n).toBe(F.carrier);
      expect(Object.keys(P.coat.uv), n).toEqual(Object.keys(P.offsets));
      expect(P.coat.spec.color).toBe('Skin');
      expect(!!P.coat.spec.cover, n).toBe(/Plate\d+$/.test(n));                                  // the shell's chitin on its plates alone
    }
    // (the head-tails' bald cap: no hair part left, the brows kept)
    expect(Object.keys(R.parts).filter((n) => /^hair/.test(n) && !/^hair(Brows|Lashes)/.test(n))).toEqual([]);
    expect(out.hero.xeno.map((x) => [x.card, x.pieces > 0])).toEqual([['forehead-ridges', true], ['nose-ridges', true], ['head-tails', true], ['swept-horns', true], ['tail', true], ['chitin-crest', true], ['cheek-ridges', true]]);
    expect(out.hero.xeno[1].pieces).toBe(Object.keys(R.parts).filter((n) => n.startsWith('xenoNoseRidges1')).length);
    expect(out.hero.xeno[4].written).toBe(true);
  }, 120_000);
});
