// The crypt in ashlar (era/stage.js STAGE_KITS['gothic-ashlar'], style/crypt.js CRYPT_SOBER): the gothic-stone vault in
// a graver register. One tall room, beside the same room in gothic-stone: what the card changes, and that it changes
// nothing of the kit it is cut from.
import { describe, it, expect } from 'vitest';
import { assembleStageScene, torchFaces, STAGE_KITS } from './stage.js';
import { CRYPT, CRYPT_SOBER } from './style/crypt.js';

const ROOM = (kit) => ({ kind: 'stage', kit, rooms: [{ id: 'a', x: 0, y: 0, w: 12, d: 16, h: 9 }] });

describe('the crypt in ashlar', () => {
  const stone = assembleStageScene(ROOM('gothic-stone'), {}), ash = assembleStageScene(ROOM('gothic-ashlar'), {});

  it('is the same vault with the same dressing, in dressed stone the form render reads as relief', () => {
    const K = STAGE_KITS['gothic-ashlar'];
    expect(K.dress.id).toBe(CRYPT.id);
    expect(K.dress.principles).toBe(CRYPT.principles);
    // (its wall, its floor and its trim are dressed cuts, painted at the metres they are laid at)
    for (const part of ['wall', 'floor', 'trim']) expect(K.tiles[part].family).toMatch(/^gen:dressed-/);
    // (the same parts, by group: walls, a vault, niches, a tomb)
    const groups = (P) => new Set(P.faces.map((f) => f.group));
    for (const g of ['stage:wall', 'stage:floor', 'stage:ceiling', 'stage:accent']) expect(groups(ash).has(g)).toBe(true);
    expect(ash.faces.some((f) => typeof f.texture === 'string' && f.texture.startsWith('gen:dressed-'))).toBe(true);
    expect(JSON.stringify(assembleStageScene(ROOM('gothic-ashlar'), {}).faces.length)).toBe(JSON.stringify(ash.faces.length));
  }, 120_000);

  it('a curve is cut finer: its niches\' heads and its vault in more pieces than gothic-stone\'s; the card it is cut from is as it was', () => {
    expect(CRYPT_SOBER.niches.seg).toBeGreaterThan(6);
    expect(CRYPT.niches.seg).toBeUndefined();
    expect(STAGE_KITS['gothic-ashlar'].arch.vault.seg).toBeGreaterThan(STAGE_KITS['gothic-stone'].arch.vault.seg);
    const motif = (P) => P.faces.filter((f) => f.group === 'stage:motif').length;
    expect(motif(ash)).toBeGreaterThan(motif(stone));
    // (the accent wall names its own generator; gothic-stone's stays the bonded stone it was)
    expect(CRYPT_SOBER.accent.stone.gen).toBe('dressed');
    expect(CRYPT.accent.stone.gen).toBeUndefined();
    expect(stone.faces.find((f) => f.group === 'stage:accent').texture).toMatch(/^gen:stone-brick-/);
  });

  it('its torch is turned and its pilasters worked, in both eras; gothic-stone\'s are as they were', () => {
    const torch = { at: [1, 1, 3], n: [0, 1], color: '#ff9c48', fixture: 'torch' };
    const boxes = torchFaces(torch), cone = torchFaces(torch, false, false, 'cone'), coneLive = torchFaces(torch, false, true, 'cone');
    // (boxes are axis-aligned; a turned thing has faces that look every way round)
    const ways = (F) => new Set(F.filter((f) => !f.emissive).map((f) => f.normal.map((v) => Math.round(v * 10)).join())).size;
    expect(ways(cone)).toBeGreaterThan(ways(boxes) * 3);
    // (the sixth generation keeps its flame's two cards in the cone; the form render's live flame, a bed of coals)
    expect(cone.filter((f) => f.emissive)).toHaveLength(4);
    expect(coneLive.filter((f) => f.emissive)).toHaveLength(1);
    expect(torchFaces(torch, false, false, null)).toEqual(boxes);
    // (a pilaster cut in parts: more of its surface than gothic-stone's flat strip, in the fluted shaft's own tile)
    const pil = (P) => P.faces.filter((f) => f.group === 'stage:pillar' || f.group === 'stage:trim').length;
    expect(ash.faces.some((f) => f.group === 'stage:pillar')).toBe(true);
    expect(stone.faces.some((f) => f.group === 'stage:pillar')).toBe(false);
    expect(pil(ash)).toBeGreaterThan(0);
    // (its wall wears a coat: the render cut over the ashlar)
    expect(STAGE_KITS['gothic-ashlar'].torch.form).toBe('cone');
    expect(STAGE_KITS['gothic-stone'].torch.form).toBeUndefined();
  });

  it('its walls keep a rhythm: the second kind of bay the first with less on it; a recipe may mean a wall all alike, drawn clean', () => {
    const HALL = { kind: 'stage', kit: 'gothic-ashlar', rooms: [{ id: 'a', x: 0, y: 0, w: 12, d: 22, h: 9 }] };
    const rhythm = assembleStageScene(HALL, {}), same = assembleStageScene({ ...HALL, rhythm: 'same' }, {});
    const niches = (P) => P.faces.filter((f) => f.group === 'stage:niche').length, urns = (P) => P.faces.filter((f) => f.group === 'stage:motif-urn').length;
    // (a lesser bay has a tier of niches less: the rhythm's walls hold fewer niches than the same walls all alike)
    expect(niches(rhythm)).toBeGreaterThan(0);
    expect(niches(rhythm)).toBeLessThan(niches(same));
    // (a wall all alike, meant, is clean and repeatable: nothing in a niche that marks one bay from the next)
    expect(urns(same)).toBe(0);
    expect(() => assembleStageScene({ ...HALL, rhythm: 'ABAB' }, {})).toThrow(/rhythm is 'same'/);
    // (its coat is not the same stamp in every bay: one wall wears more than one variant of its tile)
    const sideWall = rhythm.faces.filter((f) => f.group === 'stage:wall' && Math.abs(f.normal[0]) > 0.9 && f.normal[0] > 0);
    expect(new Set(sideWall.map((f) => f.texture)).size).toBeGreaterThan(1);
    // (gothic-stone has no rhythm of its own, and every bay its niches, as it was)
    expect(STAGE_KITS['gothic-stone'].dress.niches.rhythm).toBeUndefined();
    expect(JSON.stringify(assembleStageScene(HALL, {}).faces.length)).toBe(JSON.stringify(rhythm.faces.length));
  }, 120_000);

  it('its floor is laid by a plan: a border course, a walk down the room, fields by the bay in a rhythm; gothic-stone\'s is one field', () => {
    const HALL = { kind: 'stage', kit: 'gothic-ashlar', rooms: [{ id: 'a', x: 0, y: 0, w: 12, d: 22, h: 9 }] };
    const P = assembleStageScene(HALL, {}), floor = P.faces.filter((f) => f.group === 'stage:floor' && f.uv);
    const at = (x, y) => floor.find((f) => { const xs = f.corners.map((c) => c[0]), ys = f.corners.map((c) => c[1]); return x >= Math.min(...xs) && x <= Math.max(...xs) && y >= Math.min(...ys) && y <= Math.max(...ys); });
    // (how far a face's tile runs along x for a metre of floor: its slabs' size and which way they lie)
    const uPerX = (f) => { const [a, b] = [f.corners[0], f.corners.find((c) => Math.abs(c[0] - f.corners[0][0]) > 1e-6)], i = f.corners.indexOf(b); return Math.abs((f.uv[i][0] - f.uv[0][0]) / (b[0] - a[0])); };
    const border = at(1.0, 11), walk = at(6, 11), field = at(3, 11);
    expect(border && walk && field).toBeTruthy();
    // (the walk's slabs are larger than the field's; the border's lie along its wall, a quarter turn from a field laid across)
    expect(new Set([border.texture, walk.texture].map((t) => t.slice(0, -2))).size).toBe(1);
    expect(uPerX(border)).toBeLessThan(1e-6);
    // (along the room the fields keep the rhythm: not every bay laid the same way)
    const lays = [3, 7, 11, 15, 19].map((y) => (uPerX(at(3, y)) > 1e-6 ? 'A' : 'B')).join('');
    expect(new Set(lays).size).toBe(2);
    expect(/AAA|BBB|ABAB|BABA/.test(lays)).toBe(false);
    // (meant all alike: every bay laid one way)
    const same = assembleStageScene({ ...HALL, rhythm: 'same' }, {}).faces.filter((f) => f.group === 'stage:floor' && f.uv);
    const atS = (x, y) => same.find((f) => { const xs = f.corners.map((c) => c[0]), ys = f.corners.map((c) => c[1]); return x >= Math.min(...xs) && x <= Math.max(...xs) && y >= Math.min(...ys) && y <= Math.max(...ys); });
    expect(new Set([3, 7, 11, 15, 19].map((y) => uPerX(atS(3, y)) > 1e-6)).size).toBe(1);
    expect(STAGE_KITS['gothic-stone'].floorPlan).toBeUndefined();
  }, 120_000);
});
