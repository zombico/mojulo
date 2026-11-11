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
});
