import { describe, it, expect } from 'vitest';
import { TECH_STYLES, DEFAULT_TECH_STYLE, TECH_CAMERAS, TECH_CAMERA_IDS, DEFAULT_TECH_CAMERA, HERO_REFERENCE, HERO_SHARE, meetDistance, heroDistance, triangleCeiling, pxPerMetre, texelsPerMetre, atlasPage } from './tech-eras.js';
import { techReadout, facets } from './tech-readout.js';
import { craftTech } from './tech-crafter.js';
import { buildBlock, TIER_IDS } from '../era/blocks.js';
import { INTEREST } from '../playscape/objects/laws.js';
import { objectMeasures } from '../playscape/objects/measures.js';
import { lowerObjectFaces } from '../worlds/workbench.js';
import { heroRecord, expandLayeredManifest, planLayered } from '../../mcp/tools/layered.js';

describe('tech eras: style apart from density, density by the camera', () => {
  it('Warcraft 3 is the style; third person is the camera; every camera meets every tier', () => {
    expect(DEFAULT_TECH_STYLE).toBe('wc3');
    expect(DEFAULT_TECH_CAMERA).toBe('third-person');
    expect(Object.keys(TECH_STYLES.wc3.exaggeration).sort()).toEqual([...TIER_IDS].sort());
    for (const c of TECH_CAMERA_IDS) expect(Object.keys(TECH_CAMERAS[c].meet).sort()).toEqual([...TIER_IDS].sort());
    expect(Object.keys(HERO_SHARE).sort()).toEqual(Object.keys(INTEREST).sort());
    expect(heroDistance('third-person')).toBe(6);
    expect(meetDistance('third-person', 'machine')).toBeLessThan(meetDistance('top-down', 'machine'));
    expect(() => meetDistance('isometric', 'machine')).toThrow(/not a camera/);
  });

  it('the hero leads in count: a focus comes closest, and the hero is what it says it is', () => {
    for (const k of Object.values(HERO_SHARE)) expect(k).toBeLessThan(1);
    expect(triangleCeiling('focus')).toBeGreaterThan(triangleCeiling('prop'));
    expect(pxPerMetre(6)).toBeCloseTo(2 * pxPerMetre(12), 6);
    const hero = planLayered(expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'female', head: 'anime', register: 'round' }) })).mesh;
    expect(hero.faces.length).toBe(HERO_REFERENCE.triangles);
  }, 60000);

  it('paint density falls with distance; a bigger thing near the camera needs a bigger page', () => {
    expect(texelsPerMetre(6)).toBeGreaterThan(texelsPerMetre(30));
    const walker = buildBlock(craftTech('vehicle', 'a walker mech').plan.block, { ring: 'near' }).faces;
    expect(atlasPage(walker, 6)).toBeGreaterThanOrEqual(atlasPage(walker, 20));
    expect([256, 512, 1024, 2048]).toContain(atlasPage(walker, 8));
  });
});

describe('the tech readout', () => {
  it('a crafted block of boxes has no curve to read; a lathe\'s facets narrow with its sides and widen as the camera nears', () => {
    const walker = buildBlock(craftTech('vehicle', 'an armoured walker').plan.block, { ring: 'near' });
    const r = techReadout(walker.faces, { tier: 'machine', rank: 'focus' });
    expect(r).toMatchObject({ camera: 'third-person', style: 'wc3', distance: 8, ceiling: triangleCeiling('focus'), renderGroups: 1 });
    expect(r.facetPx.n).toBe(0);
    // a stack of boxes is advised to round its masses, a style's note: chamfered stone is a choice, not a failure
    expect(r.advice.map((a) => a.law)).toContain('rounds');
    expect(r.segments).toBeGreaterThanOrEqual(3);
    const drum = (sides) => lowerObjectFaces({ kind: 'workbench', lathes: [{ id: 'd', axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 2 }, profile: [{ t: 0, radius: 1 }, { t: 1, radius: 1 }], crossSections: 2, samples: sides, tint: '#808080' }] });
    const at = (sides, camera) => techReadout(drum(sides), { tier: 'machine', rank: 'prop', camera }).facetPx.widest;
    expect(at(24, 'third-person')).toBeLessThan(at(12, 'third-person'));
    expect(at(12, 'top-down')).toBeLessThan(at(12, 'third-person'));
    // eight sides turn 45° an edge: a chamfer's angle, faceted by design, not a curve's facets
    expect(facets(drum(8))).toHaveLength(0);
    // a chord of a 1 m round at 12 points round (`samples`; `crossSections` are the rings along the axis) is 0.52 m
    expect(facets(drum(12))[0].width).toBeCloseTo(2 * Math.sin(Math.PI / 12), 2);
  }, 30000);

  it('reads workbench faces by their fill, and counts a texture as its own render group', () => {
    const lathe = { id: 'post', axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 4 }, profile: [{ t: 0, radius: 0.6 }, { t: 1, radius: 0.3 }], crossSections: 8, samples: 3, tint: '#808080' };
    const faces = lowerObjectFaces({ kind: 'workbench', lathes: [lathe] });
    const r = techReadout(faces, { tier: 'machine', rank: 'prop' });
    expect(r.triangles).toBeGreaterThan(0);
    expect(r.renderGroups).toBe(1);
    const painted = techReadout(faces.map((f, i) => (i % 2 ? { ...f, texture: 'atlas-a' } : { ...f, texture: 'atlas-b' })), { tier: 'machine', rank: 'prop' });
    expect(painted).toMatchObject({ renderGroups: 2, atlases: 2 });
  });

  it('the object measures take a meet distance, and without one read as before', () => {
    const box = (x) => [[[x, 0, 0], [x + 0.3, 0, 0], [x + 0.3, 0, 1], [x, 0, 1]]].map((corners) => ({ corners, part: 'body', value: 0.5 }));
    const faces = [...box(0), ...box(0.6), { corners: [[0, 0, 1], [0.9, 0, 1], [0.9, 0, 1.3], [0, 0, 1.3]], part: 'body', value: 0.4 }];
    expect(objectMeasures(faces, { U: [1, 0, 0] }, 'prop')).toEqual(objectMeasures(faces, { U: [1, 0, 0], distance: INTEREST.prop.distance }, 'prop'));
    expect(objectMeasures(faces, { U: [1, 0, 0], distance: 60 }, 'prop').segments).toBeLessThanOrEqual(objectMeasures(faces, { U: [1, 0, 0] }, 'prop').segments);
  });
});
