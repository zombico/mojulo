// Scree drawn on a formation's talus (isekai.js formationGround): its stones by the rock (gritty-flora.js TALUS_CUTS,
// dressed.js SCREE_FORMS), coarse patches among them, and its edge its stones thinning out over the turf, a cutout of the
// scree's own tile (scree-tiles.js) band by band, the same border a trail's verge takes (trail-dress.js screeBands).
import { describe, expect, it } from 'vitest';
import { SCREE_FORMS, SCREE_FORM_IDS, dressedTile, screeDice } from '../matte-paint/dressed.js';
import { screeKey, screeTexels } from './scree-tiles.js';
import { TALUS_CUTS, groundKey } from './gritty-flora.js';
import { TALUS_EDGE } from './isekai.js';
import { screeBands, TURF_BANDS } from './trail-dress.js';
import { outTrailSite } from './out-trail.js';
import { ISEKAI_MEADOW } from './style/isekai-meadow.js';
import { assembleStageScene } from './stage.js';

const tile = (form) => ({ cut: 'scree', form, face: 'floor', stone: [150, 150, 150], mortar: [90, 90, 90], grit: 0.7, metres: 0.6, vary: 10 });

describe('scree\'s stones', () => {
  it('lies in a form of its own for each, its stones each a dice a cutout keeps them by', () => {
    const tiles = SCREE_FORM_IDS.map((f) => dressedTile(tile(f), { size: 64, seed: 9 }).rgb.toString('base64'));
    expect(new Set(tiles).size).toBe(SCREE_FORM_IDS.length);
    expect(Object.keys(SCREE_FORMS)).toEqual(SCREE_FORM_IDS);
    const d = screeDice(tile('rubble'), { size: 64, seed: 9 });
    expect(d.every((v) => v === -1 || (v >= 0 && v < 1))).toBe(true);
    expect(d.some((v) => v === -1) && d.some((v) => v >= 0)).toBe(true);
    // (each rock its own stones)
    expect(new Set(Object.values(TALUS_CUTS).map((C) => C['isekai:talus'].form)).size).toBe(Object.keys(TALUS_CUTS).length);
  });

  it('thins by keeping fewer of its own stones, a lower level\'s a subset of a higher\'s', () => {
    const key = groundKey(TALUS_CUTS.limestone['isekai:talus'], 0.7), lo = screeTexels(screeKey(key, 0.2)), hi = screeTexels(screeKey(key, 0.7));
    const kept = (T) => T.a.reduce((n, v) => n + (v ? 1 : 0), 0);
    expect(kept(lo)).toBeGreaterThan(0);
    expect(kept(hi)).toBeGreaterThan(kept(lo));
    expect(lo.a.every((v, k) => !v || hi.a[k])).toBe(true);
  });
});

describe('the scree\'s edge', () => {
  it('lays the scree\'s cutout across a trail\'s verge where the land beyond is a talus, in the talus\'s tone', () => {
    // (a fringe lane's colour along its outer edge, both sides, a corner every half metre)
    const site = outTrailSite(ISEKAI_MEADOW, {}, 1), edge = [];
    for (let y = 0; y <= site.D; y += 0.5) for (const sd of [-1, 1]) edge.push([site.trailX(y) + sd * (site.halfWAt(y) + site.fringeAt(y)), y, 0]);
    const lanes = [{ cls: 'fringe', fill: '#808080', corners: edge }];
    const args = { site, lanes, keyOf: (l) => `scree:k~${Math.round(l * 100)}`, metres: 1.5, seed: 1, tone: () => '#a0a0a0' };
    const B = screeBands({ ...args, where: () => true });
    expect(B.length).toBeGreaterThan(0);
    expect(B.every((f) => f.group === 'isekai:talus' && /^scree:/.test(f.texture) && f.fill === '#a0a0a0')).toBe(true);
    expect(new Set(B.map((f) => f.texture))).toEqual(new Set(TURF_BANDS.map((b) => args.keyOf(b.level))));
    expect(screeBands({ ...args, where: () => false })).toEqual([]);
  });

  it('thins a gritty talus out over the turf in bands, its coarse patches among it; quiet, its line as it was', () => {
    const M = { kind: 'stage', kit: 'isekai-meadow', trail: {} }, P = assembleStageScene({ ...M, shading: { grit: 0.7, skin: 'limestone' } }, {});
    const over = P.faces.filter((f) => /^scree:/.test(f.texture || '')), levels = new Set(over.map((f) => +/~(\d+)$/.exec(f.texture)[1] / 100));
    expect(over.length).toBeGreaterThan(0);
    expect([...levels].every((l) => TALUS_EDGE.levels.includes(l))).toBe(true);
    expect(levels.size).toBe(TALUS_EDGE.levels.length);
    expect(P.faces.some((f) => f.group === 'isekai:rubble')).toBe(true);
    expect(P.faces.some((f) => f.screeLevel !== undefined)).toBe(false);
    expect(P.cutouts.some((k) => k.startsWith('scree:'))).toBe(true);
    const Q = assembleStageScene({ ...M, shading: { grit: 0.2, skin: 'limestone' } }, {});
    expect(Q.faces.some((f) => /^scree:/.test(f.texture || '') || f.group === 'isekai:rubble')).toBe(false);
    expect(Q.faces.some((f) => f.group === 'isekai:talus')).toBe(true);
  }, 60000);
});
