// The interior drawn (scroll-stage/interior-scene.js). The concepts: every part is laid in its block (the cut, its bare
// bevel, the decks, the ribs and conduits, the back, the bulkheads, the hull, the lamps, the struts); the plated parts
// carry the fleet's kibble and the bare ones none; the faces are lit as the ship is (one key from the stage's star: a
// face turned to it brighter than one turned away, an enclosed face darker, a face turning from the eye rimmed cool;
// the lamps drawn as their own colour); a ramp's deck faces along its slope; the station looks out through windows and
// the facility stripes what crosses the way; the faces stand in the slab's depth, the back behind the play and the
// struts before it; each hatch's opening and each mover's slot set in the wall; on the stage, a gun on each mount, each
// hatch's drones, each mover a body on its rule; the top view gets it turned, never mirrored; the same plan the same
// faces; a stage carries it, its
// faces and kibble on the payload and its corridor and bulkheads on the camera's rule; a stage without one carries none.
import { describe, it, expect } from 'vitest';
import { layInterior, castBake, INTERIOR_LOOK, WALL_DEPTH } from './interior-scene.js';
import { planInterior } from './interior.js';
import { scrollCamera, toScreen, SCROLL_VIEWS } from './frame.js';
import { assembleScrollStage, scrollStagePlay, readScrollStage } from './stage-scene.js';
import { stageManifest, STAGE_IDS } from './stages.js';
import { SPACE_MOOD } from '../../car-designer/form-light.js';

const cam = scrollCamera(13.28), A = cam.screen.along;
const track = [{ by: [30 * A, 0], pace: 0.1 * A }];
const spec = (look = 'station') => ({ at: 1, look, sections: ['mouth', 'hall', 'duct', 'shutters', 'core'].map((kind) => ({ kind })) });
const plan = (look = 'station') => planInterior(spec(look), { cam, track, seed: 2 });
const lay = (look, view = 'side') => layInterior(plan(look), cam, { view, seed: 2 });
const blocks = (F) => new Set(F.faces.map((f) => f.group.replace(/^break:interior\//, '').replace(/-\d+$/, '')));
const lum = (h) => [1, 3, 5].reduce((s, i) => s + parseInt(h.slice(i, i + 2), 16), 0);
const rig = { toLight: [0, 0, 1], key: [1, 1, 1], keyIntensity: SPACE_MOOD.level, hemi: SPACE_MOOD.hemi, rim: SPACE_MOOD.rim };

describe('the interior drawn', () => {
  it('lays every part in its block', () => {
    const F = lay('station');
    for (const b of ['cut', 'trim', 'deck', 'rib', 'back', 'bulkhead', 'hull', 'lamps', 'struts', 'slots']) expect(blocks(F), b).toContain(b);
    for (const f of F.faces) { expect(f.node).toBe(f.group.slice(6)); for (const p of f.corners) for (const x of p) expect(Number.isFinite(x)).toBe(true); }
    expect(F.report.ribs).toBeGreaterThan(4);
  });

  it('the plated parts carry the fleet\'s kibble, the bare ones none', () => {
    const F = lay('station'), K = INTERIOR_LOOK.station.kibble;
    expect(F.kibble['interior/cut-1']).toBe(K.cut);
    expect(F.kibble['interior/hull']).toBe(K.hull);
    for (const bare of ['trim', 'lamps', 'struts']) expect(F.kibble[`interior/${bare}`]).toBeUndefined();
    for (const id of Object.keys(F.kibble)) expect(F.faces.some((f) => f.node === id)).toBe(true);
  });

  it('is lit as the ship is: the key by facing, enclosed darker, a face turning from the eye rimmed cool; lamps their own', () => {
    const toward = castBake('#808080', [0, 0, 1], [0, 0, 1], rig), away = castBake('#808080', [0, 0, -1], [0, 0, 1], rig);
    expect(lum(toward)).toBeGreaterThan(lum(away) * 4);
    expect(lum(castBake('#808080', [0, 0, 1], [0, 0, 1], rig, { enclosed: 0.4 }))).toBeLessThan(lum(toward));
    const edge = castBake('#000000', [1, 0, 0], [0, 0, 1], rig);
    expect(parseInt(edge.slice(5, 7), 16)).toBeGreaterThan(parseInt(edge.slice(1, 3), 16));   // (the rim's cool)
    const F = lay('station'), side = SCROLL_VIEWS.side;
    const deck = (dir) => F.faces.filter((f) => f.node.startsWith('interior/deck') && f.normal[2] * side.across[2] * dir > 0.9);
    expect(Math.max(...deck(1).map((f) => lum(f.fill)))).toBeGreaterThan(Math.max(...deck(-1).map((f) => lum(f.fill))));
    expect(F.faces.filter((f) => f.node === 'interior/lamps').every((f) => [INTERIOR_LOOK.station.lamp, '#ff3b30', '#3bff6a', '#ffcc33'].includes(f.fill))).toBe(true);
  });

  it('a ramp\'s deck faces along its slope', () => {
    const P = plan(), F = layInterior(P, cam, { view: 'side', seed: 2 }), V = SCROLL_VIEWS.side;
    const sloped = F.faces.filter((f) => f.node.startsWith('interior/deck') && Math.abs(f.normal[0] * V.along[0] + f.normal[1] * V.along[1] + f.normal[2] * V.along[2]) > 0.02);
    expect(sloped.length).toBeGreaterThan(0);
  });

  it('the station looks out through windows, the facility stripes what crosses the way', () => {
    const S = lay('station'), K = lay('facility');
    expect(S.report.windows).toBeGreaterThan(0);
    expect(K.report.windows).toBe(0);
    const fills = (F) => new Set(F.faces.filter((f) => f.node.startsWith('interior/bulkhead')).map((f) => f.fill));
    expect(fills(K).size).toBeGreaterThan(fills(S).size);
    expect(K.faces.filter((f) => f.node === 'interior/lamps').every((f) => [INTERIOR_LOOK.facility.lamp, '#ff3b30', '#3bff6a', '#ffcc33'].includes(f.fill))).toBe(true);
  });

  it('stands in the slab\'s depth: the back behind the play, the struts before it', () => {
    const F = lay('station'), d = (f) => toScreen('side', f.corners[0])[2];
    expect(Math.max(...F.faces.filter((f) => f.node.startsWith('interior/back')).map(d))).toBeLessThan(0);
    expect(Math.min(...F.faces.filter((f) => f.node === 'interior/struts').map(d))).toBeGreaterThan(WALL_DEPTH.front * cam.dist);
  });

  it('the top view gets it turned, never mirrored', () => {
    const S = lay('station', 'side'), T = lay('station', 'top');
    expect(T.faces.length).toBe(S.faces.length);
    for (let k = 0; k < S.faces.length; k += 37) expect(toScreen('top', T.faces[k].corners[0]).map((x) => Math.round(x * 100))).toEqual(toScreen('side', S.faces[k].corners[0]).map((x) => Math.round(x * 100)));
  });

  it('the same plan the same faces', () => {
    expect(JSON.stringify(lay('facility'))).toBe(JSON.stringify(lay('facility')));
  });

  it('sets each hatch\'s opening and each mover\'s slot in the wall, warning lamps by the slots', () => {
    const P = planInterior({ at: 1, sections: ['hall', 'crushers', 'locks'].map((kind) => ({ kind })) }, { cam, track, seed: 2 }), F = layInterior(P, cam, { view: 'side', seed: 2 });
    const near = (u, w) => F.faces.filter((f) => Math.abs(toScreen('side', f.corners[0])[0] - u) < w);
    for (const h of P.hatches) expect(near(h.u, P.step * 0.2).some((f) => f.node === 'interior/slots')).toBe(true);
    for (const m of P.movers) expect(near((m.u0 + m.u1) / 2, (m.u1 - m.u0)).filter((f) => f.fill === '#07090c').length).toBeGreaterThan(1);
    expect(F.faces.some((f) => f.node === 'interior/lamps' && f.fill === '#ffcc33')).toBe(true);
  });

  it('its life on the stage: a gun on each mount, each hatch its drones, each mover a body on its rule', () => {
    const M0 = stageManifest(STAGE_IDS[0]), M = { ...M0, scroll: { ...M0.scroll, interior: { at: 2, sections: ['hall', 'crushers', 'locks'].map((kind) => ({ kind })) } } };
    const G = scrollStagePlay(M), I = planInterior(M.scroll.interior, { cam, track, seed: 2 }), E = G.entities;
    const guns = E.filter((e) => e.id.startsWith('gun-mount')), drones = E.filter((e) => Array.isArray(e.rule.from)), movers = E.filter((e) => e.rule.type === 'scroll-mover');
    expect(guns.length).toBeGreaterThan(0);
    for (const g of guns) { expect(g.rule.path.kind).toBe('fixed'); expect(g.rule.pattern).toBeTruthy(); expect(g.body.marker).toBe(false); }
    expect(drones.length).toBeGreaterThan(0);
    for (const d of drones) { expect(d.rule.path.kind).toBe('rise'); expect(d.body.figure).toBe('foe-hatchling'); }
    expect(G.figures['foe-hatchling']).toBeTruthy();
    expect(movers.length).toBeGreaterThan(0);
    for (const m of movers) { expect(m.rule.box).toHaveLength(4); expect(m.rule.cycle.period).toBeGreaterThan(0); expect(m.body.marker).toBe(false); }
    expect(I.movers.length).toBe(movers.length);
    expect(readScrollStage({ waves: [{ at: 1, foe: 'hatchling' }] }).join()).toMatch(/a hatchling with its hatch/);
  });

  it('a stage carries it: its faces and kibble on the payload, its corridor and bulkheads on the camera\'s rule; a stage without one none', () => {
    const M0 = stageManifest(STAGE_IDS[0]), M = { ...M0, scroll: { ...M0.scroll, interior: { at: 2, sections: [{ kind: 'hall' }, { kind: 'shutters' }] } } };
    const P = assembleScrollStage(M);
    expect(P.faces.some((f) => f.node === 'interior/back-0')).toBe(true);
    expect(P.kibble.blocks['interior/cut-0']).toBeGreaterThan(0);
    expect(P.meta.scroll.interior.sections.map((s) => s.kind)).toEqual(['hall', 'shutters']);
    const cam0 = scrollStagePlay(M).camera;
    expect(cam0.corridor.length).toBeGreaterThan(4);
    for (let k = 1; k < cam0.corridor.length; k++) expect(cam0.corridor[k][0]).toBeGreaterThanOrEqual(cam0.corridor[k - 1][0]);
    expect(cam0.walls.length).toBeGreaterThan(0);
    expect(scrollStagePlay(M0).camera.corridor).toBeUndefined();
    expect(assembleScrollStage(M0).faces.some((f) => String(f.group).startsWith('break:interior/'))).toBe(false);
  });
});
