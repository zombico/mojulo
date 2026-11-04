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
import { XENO_CARD_IDS, validateXenoHeaddress, withXeno } from './index.js';
import { ridgeMesh, tubeMesh } from './appliances.js';
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
    expect(XENO_CARD_IDS).toEqual(expect.arrayContaining(['forehead-ridges', 'nose-ridges', 'head-tails']));
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

  it('build a tail as a closed tube along its line, tapering', () => {
    const line = Array.from({ length: 6 }, (_, i) => [0, 0, -i * 0.05]);
    const M = tubeMesh(line, { radius: (t) => 0.03 * (1 - t) + 0.005 });
    expect(closed(M)).toBe(true);
    const near = M.vertices.filter((v) => Math.abs(v[2]) < 1e-9 && Math.hypot(v[0], v[1]) > 1e-6), far = M.vertices.filter((v) => Math.abs(v[2] + 0.2) < 1e-9);
    expect(Math.hypot(near[0][0], near[0][1])).toBeGreaterThan(Math.hypot(far[0][0], far[0][1]));
  });
});

describe('on a hero', () => {
  it('adds nothing without the word: the recipe itself', () => {
    const R = { parts: { a: {} } };
    expect(withXeno(R, {})).toBe(R);
    expect(withXeno(R, { xenoHeaddress: [] })).toBe(R);
  });

  it.each([['landmark', { cast: 'female' }], ['anime', { cast: 'female', head: 'anime' }]])('pins each appliance to the %s head\'s carrier, coated, on its skin', async (head, spec) => {
    const out = await createCharacterHandler({ as: 'hero', title: head, spec: { ...spec, xenoHeaddress: ['forehead-ridges', 'nose-ridges', 'head-tails'] } });
    const R = SketchRepository.getByRef(out.ref).manifest.recipe, F = xenoFrame(R);
    expect(F.head).toBe(head);
    const xeno = Object.entries(R.parts).filter(([n]) => n.startsWith('xeno'));
    expect(xeno.map(([n]) => n)).toEqual(expect.arrayContaining(['xenoForeheadRidges0Mid', 'xenoHeadTails2R', 'xenoHeadTails2L']));
    for (const [n, P] of xeno) {
      expect(P.pin.parent, n).toBe(F.carrier);
      expect(Object.keys(P.coat.uv), n).toEqual(Object.keys(P.offsets));
      expect(P.coat.spec.color).toBe('Skin');
    }
    // (the head-tails' bald cap: no hair part left, the brows kept)
    expect(Object.keys(R.parts).filter((n) => /^hair/.test(n) && !/^hair(Brows|Lashes)/.test(n))).toEqual([]);
    expect(out.hero.xeno.map((x) => [x.card, x.pieces > 0])).toEqual([['forehead-ridges', true], ['nose-ridges', true], ['head-tails', true]]);
  }, 120_000);
});
