/**
 * Statues in a historic city (historic/statues.js): the city's statue slots, a manifest's `statues` stood on them (the
 * stand-ins down, a record per figure), and the World resolver fitting a stored statue there. Absent ⇒ the city as it
 * was. Machine gate only.
 */
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, expect, it } from 'vitest';

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { resolveWorldScene } from '@/lib/graph/worlds/world-scene.js';
import { heroRecord, expandLayeredManifest } from '@/lib/mcp/tools/layered.js';
import { planHistoricCity, METRES_PER_UNIT } from './historic-city.js';
import { historicOptions, assembleHistoricKindScene } from './historic-kind.js';
import { validateStatues, statueSlots, standStatues, fitStatueFaces, statueTurn, lightInto } from './statues.js';

const forum = planHistoricCity({ culture: 'forum', seed: 1 });

describe('the slots', () => {
  it('the Forum\'s monuments stand their figures, facing as the layout set them', () => {
    const S = statueSlots(forum);
    expect(S.ficus.figures).toHaveLength(1);                                 // Marsyas
    expect(S.ficus.figures[0].dir).toBeCloseTo(Math.PI / 2, 6);
    expect(S['sibyls-hercules'].figures).toHaveLength(3);
    expect(S.vortumnus.figures[0].dir).toBeCloseTo(-Math.PI / 2, 6);
    expect(S['octavian-equestrian'].figures[0].equestrian).toBe(true);
    expect(S['octavian-equestrian'].figures[0].dir).toBeCloseTo(Math.PI / 2, 6);   // the horse's heading (horseman's dir)
    expect(S.ficus.figures[0].h).toBeGreaterThan(1.5);
  });
  it('a statue asset\'s slots are addressed by asset and number', () => {
    const pp = statueSlots(planHistoricCity({ culture: 'pompeii', seed: 1 }));
    expect(Object.keys(pp).filter((k) => k.startsWith('pp-statue:'))).toEqual(['pp-statue:0', 'pp-statue:1']);
    // Pompeii's standing equestrian bronzes (an empty base has none): the horse heads along the row, its rider facing in
    const eq = Object.keys(pp).filter((k) => k.startsWith('pp-equestrian:'));
    expect(eq.length).toBeGreaterThan(0);
    for (const k of eq) { expect(pp[k].figures[0].equestrian).toBe(true); expect(Math.abs(Math.cos(pp[k].figures[0].dir))).toBeCloseTo(1, 6); }
    expect(statueSlots(planHistoricCity({ culture: 'lindos', seed: 1 }))['ln-statue:0'].figures[0].dir).toBe(0);
  });
  it("a Theban colossus is a slot: the seated king and his throne come down, his height the king's to the nemes", () => {
    const plan = planHistoricCity({ culture: 'thebes', seed: 1 }), S = statueSlots(plan);
    expect(Object.keys(S).filter((k) => k.startsWith('eg-colossus:'))).toEqual(['eg-colossus:0', 'eg-colossus:1']);
    const F = S['eg-colossus:0'].figures[0];
    expect(F.dir).toBeCloseTo(-Math.PI / 2, 9); expect(F.h).toBeGreaterThan(8);
    const kinds = new Set(F.idx.map((i) => plan.boxes[i].kind));
    expect([...kinds].sort()).toEqual(['collar', 'crown', 'nemes', 'statue', 'throne']);
    const { boxes } = standStatues(plan, [{ ref: 'a', at: 'eg-colossus:0' }]);
    expect(boxes.some((m) => m.asset === 'eg-colossus' && m.kind === 'pedestal')).toBe(true);
  });
  it('a votive row stands one figure per plinth, numbered along the row, the eyes with their figure', () => {
    const plan = planHistoricCity({ culture: 'sumer', seed: 1 }), S = statueSlots(plan)['votive-row:0'];
    const n = plan.boxes.filter((m) => m.asset === 'votive-row' && m.kind === 'statue-plinth').length;
    expect(S.figures).toHaveLength(n); expect(n).toBeGreaterThanOrEqual(3);
    for (const [k, F] of S.figures.entries()) {
      expect(F.dir).toBe(0); expect(F.h).toBeGreaterThan(1.4); expect(F.h).toBeLessThan(2.2);
      expect(F.idx.filter((i) => plan.boxes[i].kind === 'statue-eye')).toHaveLength(4);
      if (k) expect(F.c[0]).toBeGreaterThan(S.figures[k - 1].c[0] + 1.2);
    }
    // standing one takes down its masses alone; its plinth and the bench stay
    const { boxes } = standStatues(plan, [{ ref: 'a', at: 'votive-row:0', figure: 1 }]);
    expect(plan.boxes.length - boxes.length).toBe(S.figures[1].idx.length);
    expect(boxes.filter((m) => m.asset === 'votive-row' && m.kind === 'statue-plinth')).toHaveLength(n);
  });
});

describe('refusals', () => {
  it('the entries\' form, by name', () => {
    expect(validateStatues('x').join()).toMatch(/a list of \{ ref, at/);
    expect(validateStatues([{ at: 'ficus' }]).join()).toMatch(/ref: a stored sketch/);
    expect(validateStatues([{ ref: 'a', at: 'ficus', figure: -1 }]).join()).toMatch(/figure: which figure/);
    expect(validateStatues([{ ref: 'a', at: 'ficus', height: 99 }]).join()).toMatch(/height: the figure's height/);
    expect(validateStatues([{ ref: 'a', at: 'ficus', scale: 2 }]).join()).toMatch(/scale: not a field/);
    expect(() => historicOptions({ culture: 'sumer', scene: 'region', statues: [{ ref: 'a', at: 'x' }] })).toThrow(/the 'region' scene has none/);
  });
  it('a slot the city lacks names those it has; a missing figure refuses; an equestrian slot records it', () => {
    expect(() => standStatues(forum, [{ ref: 'a', at: 'rostra' }], { culture: 'forum' })).toThrow(/no statue slot 'rostra' — its slots: .*'ficus'/);
    expect(standStatues(forum, [{ ref: 'a', at: 'octavian-equestrian' }]).statueRefs[0].equestrian).toBe(true);
    expect(() => standStatues(forum, [{ ref: 'a', at: 'ficus', figure: 2 }])).toThrow(/stands 1 figure \(figure 0\)/);
  });
});

describe('standing', () => {
  it('takes down only the named stand-ins and records each figure', () => {
    const S = statueSlots(forum), { boxes, statueRefs } = standStatues(forum, [{ ref: 'a', at: 'sibyls-hercules', figure: 1 }, { ref: 'b', at: 'ficus', height: 3 }]);
    expect(forum.boxes.length - boxes.length).toBe(S['sibyls-hercules'].figures[1].idx.length + S.ficus.figures[0].idx.length);
    expect(statueRefs).toEqual([
      { ref: 'a', at: 'sibyls-hercules', figure: 1, pos: [...S['sibyls-hercules'].figures[1].c, S['sibyls-hercules'].figures[1].z0], height: S['sibyls-hercules'].figures[1].h, dir: S['sibyls-hercules'].figures[1].dir },
      { ref: 'b', at: 'ficus', figure: 0, pos: [...S.ficus.figures[0].c, S.ficus.figures[0].z0], height: 3, dir: S.ficus.figures[0].dir },
    ]);
  });
  it('absent or empty statues: the city byte for byte', () => {
    const a = JSON.stringify(assembleHistoricKindScene({ culture: 'pompeii' })), b = JSON.stringify(assembleHistoricKindScene({ culture: 'pompeii', statues: [] }));
    expect(b).toBe(a);
  });
  it('a fitted statue stands on the slot, its height, turned to face the slot\'s way', () => {
    // a unit post with its front marked at +y: after the fit its front points the stand-in's way (sin dir, −cos dir)
    const faces = [{ corners: [[0, 0, 0], [0.1, 0, 0], [0, 0, 2]], fill: '#fff', group: 'body', outNormal: [0, 1, 0] }, { corners: [[0, 0, 0], [0, 0, -0.2], [1, 0, -0.2]], group: 'base' }];
    const rec = { pos: [10, 20, 1.5], height: 4, dir: Math.PI / 2 };
    const [f] = fitStatueFaces(faces, rec, { s: 0.5, group: 'statue:x:0' });
    expect(f.group).toBe('statue:x:0');
    expect(f.corners[0][2]).toBeCloseTo(1.5 * 0.5, 9); expect(f.corners[2][2]).toBeCloseTo((1.5 + 4) * 0.5, 9);
    expect(f.outNormal[0]).toBeCloseTo(Math.sin(rec.dir), 9); expect(f.outNormal[1]).toBeCloseTo(-Math.cos(rec.dir), 9);
    expect(fitStatueFaces(faces, rec)).toHaveLength(1);   // the statue's own base is dropped
    // the sun as the statue sees it, turned back into the scene, is the scene's sun
    const L = lightInto({ dir: [0.3, 0.4, -0.8] }, statueTurn(rec.dir)), t = statueTurn(rec.dir);
    expect(Math.cos(t) * L.dir[0] - Math.sin(t) * L.dir[1]).toBeCloseTo(0.3, 9);
  });
});

describe('the World resolves a stored statue onto its slot', () => {
  const statue = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'male', statue: 'roman' }) });
  SketchRepository.create({ ref: 'sk_statue_augustus', title: 'augustus', manifest: statue });
  it('Marsyas\'s base takes the statue, the stand-in gone', async () => {
    const world = async (statues) => (await resolveWorldScene({ ref: 'w', title: 'forum', manifest: { kind: 'historic', culture: 'forum', ...(statues ? { statues } : {}) } })).payload;
    const S = statueSlots(forum).ficus.figures[0], s = 1 / METRES_PER_UNIT;
    const p = await world([{ ref: 'sk_statue_augustus', at: 'ficus' }]);
    expect(p.statueRefs).toBeUndefined();
    const fig = p.faces.filter((f) => f.group === 'statue:ficus:0');
    expect(fig.length).toBeGreaterThan(1000);
    let lo = Infinity, hi = -Infinity; for (const f of fig) for (const c of f.corners) { lo = Math.min(lo, c[2]); hi = Math.max(hi, c[2]); }
    expect(lo).toBeCloseTo(S.z0 * s, 6); expect(hi - lo).toBeCloseTo(S.h * s, 6);
    expect(fig.every((f) => f.pbr)).toBe(true);   // the marble's surface rides into the city
  });
  it('an equestrian slot takes a mounted statue, the stand-in horseman gone; it refuses a standing one, and a mounted one refuses a standing slot', async () => {
    SketchRepository.create({ ref: 'sk_statue_rider', title: 'rider', manifest: expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'male', statue: { type: 'statue', style: 'roman', material: 'bronze', stand: 'mounted' } }) }) });
    const world = async (statues) => (await resolveWorldScene({ ref: 'w', title: 'forum', manifest: { kind: 'historic', culture: 'forum', statues } })).payload;
    const S = statueSlots(forum)['octavian-equestrian'].figures[0], s = 1 / METRES_PER_UNIT;
    const p = await world([{ ref: 'sk_statue_rider', at: 'octavian-equestrian' }]);
    const fig = p.faces.filter((f) => f.group === 'statue:octavian-equestrian:0');
    let lo = Infinity, hi = -Infinity; for (const f of fig) for (const c of f.corners) { lo = Math.min(lo, c[2]); hi = Math.max(hi, c[2]); }
    expect(lo).toBeCloseTo(S.z0 * s, 6); expect(hi - lo).toBeCloseTo(S.h * s, 6);
    await expect(world([{ ref: 'sk_statue_augustus', at: 'octavian-equestrian' }])).rejects.toThrow(/an equestrian slot \(a rider on a horse\) takes a mounted statue/);
    await expect(world([{ ref: 'sk_statue_rider', at: 'ficus' }])).rejects.toThrow(/is mounted \(horse and rider\); stand it on an equestrian slot/);
  });
  it('an unknown ref refuses by name', async () => {
    await expect(resolveWorldScene({ ref: 'w', title: 'f', manifest: { kind: 'historic', culture: 'forum', statues: [{ ref: 'sk_nope', at: 'ficus' }] } })).rejects.toThrow(/statue on 'ficus': ref 'sk_nope' is not a stored sketch/);
  });
});
