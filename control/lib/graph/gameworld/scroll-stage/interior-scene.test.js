// The interior drawn (scroll-stage/interior-scene.js). The concepts: every part is laid (walls, their lips and lamps,
// risers, bulkheads, the back in bays, the mouth's hull and its docking lights, the struts); the station looks out
// through windows and the facility stripes what crosses the way; the faces stand in the slab's depth, the back behind the
// play and the struts before it; the top view gets it turned, never mirrored; the same plan the same faces; a stage
// carries it, its faces on the payload and its walls on the camera's rule; a stage without one carries none.
import { describe, it, expect } from 'vitest';
import { layInterior, INTERIOR_LOOK, WALL_DEPTH } from './interior-scene.js';
import { planInterior } from './interior.js';
import { scrollCamera, toScreen } from './frame.js';
import { assembleScrollStage, scrollStagePlay } from './stage-scene.js';
import { stageManifest, STAGE_IDS } from './stages.js';

const cam = scrollCamera(13.28), A = cam.screen.along;
const track = [{ by: [30 * A, 0], pace: 0.1 * A }];
const spec = (look = 'station') => ({ at: 1, look, sections: ['mouth', 'hall', 'duct', 'shutters', 'core'].map((kind) => ({ kind })) });
const lay = (look, view = 'side') => layInterior(planInterior(spec(look), { cam, track, seed: 2 }), cam, { view, seed: 2 });
const groups = (F) => new Set(F.faces.map((f) => f.group));

describe('the interior drawn', () => {
  it('lays every part', () => {
    const F = lay('station');
    for (const g of ['interior:wall', 'interior:lip', 'interior:lamp', 'interior:bulkhead', 'interior:back', 'interior:hull', 'interior:strut']) expect(groups(F), g).toContain(g);
    expect(F.report.walls).toBeGreaterThan(4);
    expect(F.report.struts).toBeGreaterThan(0);
    for (const f of F.faces) for (const p of f.corners) for (const x of p) expect(Number.isFinite(x)).toBe(true);
  });

  it('the station looks out through windows, the facility stripes what crosses the way', () => {
    const S = lay('station'), K = lay('facility');
    expect(S.report.windows).toBeGreaterThan(0);
    expect(K.report.windows).toBe(0);
    const stripes = (F, hex) => F.faces.filter((f) => f.group === 'interior:bulkhead' && f.fill.startsWith('#') && f.fill !== hex).length;
    expect(K.faces.some((f) => f.group === 'interior:bulkhead' && f.fill === INTERIOR_LOOK.facility.trim)).toBe(true);
    expect(stripes(S, INTERIOR_LOOK.facility.trim)).toBeGreaterThan(0);
    expect(K.faces.filter((f) => f.group === 'interior:lamp').every((f) => [INTERIOR_LOOK.facility.lamp, '#ff3b30', '#3bff6a'].includes(f.fill))).toBe(true);
  });

  it('stands in the slab\'s depth: the back behind the play, the struts before it', () => {
    const F = lay('station'), d = (f) => toScreen('side', f.corners[0])[2];
    expect(Math.max(...F.faces.filter((f) => f.group === 'interior:back').map(d))).toBeLessThan(0);
    expect(Math.min(...F.faces.filter((f) => f.group === 'interior:strut').map(d))).toBeGreaterThan(WALL_DEPTH.front * cam.dist);
  });

  it('the top view gets it turned, never mirrored', () => {
    const S = lay('station', 'side'), T = lay('station', 'top');
    expect(T.faces.length).toBe(S.faces.length);
    for (let k = 0; k < S.faces.length; k += 37) expect(toScreen('top', T.faces[k].corners[0]).map((x) => Math.round(x * 100))).toEqual(toScreen('side', S.faces[k].corners[0]).map((x) => Math.round(x * 100)));
  });

  it('the same plan the same faces', () => {
    expect(JSON.stringify(lay('facility'))).toBe(JSON.stringify(lay('facility')));
  });

  it('a stage carries it: its faces on the payload, its walls on the camera\'s rule; a stage without one none', () => {
    const M0 = stageManifest(STAGE_IDS[0]), M = { ...M0, scroll: { ...M0.scroll, interior: { at: 2, sections: [{ kind: 'hall' }, { kind: 'duct' }] } } };
    const P = assembleScrollStage(M);
    expect(P.faces.some((f) => f.group === 'interior:back')).toBe(true);
    expect(P.meta.scroll.interior.sections.map((s) => s.kind)).toEqual(['hall', 'duct']);
    const W = scrollStagePlay(M).camera.walls;
    expect(W.length).toBeGreaterThan(2);
    for (const w of W) { expect(w).toHaveLength(4); expect(w[1]).toBeGreaterThan(w[0]); expect(w[3]).toBeGreaterThan(w[2]); }
    expect(scrollStagePlay(M0).camera.walls).toBeUndefined();
    expect(assembleScrollStage(M0).faces.some((f) => String(f.group).startsWith('interior:'))).toBe(false);
  });
});
