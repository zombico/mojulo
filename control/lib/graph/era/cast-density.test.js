import { describe, it, expect } from 'vitest';
import { ERA_IDS, eraError, eraCastConventions } from './eras.js';
import { readTarget, sidesFor, outlineError, targetError } from './target.js';
import { castDensity, castDensityReadout } from './cast-density.js';
import { REALITY } from '../cosmos/facets/reality.js';
import { readGeocube } from './geocube.js';
import { heroRecord, expandLayeredManifest, planLayered, validateHeroSpec } from '../../mcp/tools/layered.js';

const built = (spec) => { const m = expandLayeredManifest({ kind: 'layered', hero: heroRecord(spec) }); return { m, tris: planLayered(m).mesh.faces.length }; };
const tris = (spec) => built(spec).tris;

describe('eras are looks; the target is density', () => {
  it('two eras, each a look at any resolution; the cosmos reads them for the world and the cast', () => {
    expect(ERA_IDS).toEqual(['gen-6', 'gen-7']);
    expect(eraError('gen-6.5')).toMatch(/not an era \(gen-6, gen-7\); how dense it is drawn is the target's/);
    expect(eraCastConventions('gen-7').map((c) => c.id)).toEqual(['silhouette-and-value', 'light-in-the-vertex', 'rim-from-the-air', 'relief-in-normal', 'albedo-unlit', 'material-by-response', 'hair-cards']);
    expect(Object.keys(REALITY.settings.era.values)).toEqual(ERA_IDS);
    expect(REALITY.settings.cast.values['gen-6'].status).toBe('built');
    expect(REALITY.settings.cast.values['gen-7']).toMatchObject({ status: 'partial', note: expect.stringMatching(/relief-in-normal/) });
    expect(REALITY.settings.era.values['gen-7']).toMatchObject({ status: 'partial', godot: 'absent', note: expect.stringMatching(/the form render .* is not built: .* as paint under the live light.*planned: surfaces as material/) });
  });

  it('a target reads words or numbers and refuses with the lists', () => {
    expect(readTarget('4k')).toMatchObject({ resolution: '4k', framing: 'third-person', error: 1, screenPx: 2160, figurePx: 720 });
    expect(readTarget({ resolution: 900, framing: 0.5, error: 2 })).toMatchObject({ screenPx: 900, figurePx: 450 });
    expect(targetError('8k')).toMatch(/resolution is a word \(480p, 720p, 1080p, 1440p, 4k\)/);
    expect(targetError({ resolution: '1080p', framing: 'overhead' })).toMatch(/framing is a word \(close, third-person, wide, top-down\)/);
    expect(targetError({ fov: 60 })).toMatch(/fov is not a setting/);
  });

  it('the outline rule: sides grow with the square root of the pixel radius', () => {
    expect(sidesFor(8)).toBeCloseTo(2 * Math.PI, 6);
    expect(sidesFor(32) / sidesFor(8)).toBeCloseTo(2, 6);
    expect(outlineError(8, 6)).toBeCloseTo(8 * (1 - Math.cos(Math.PI / 6)), 9);
  });
});

describe('a hero drawn for its target', () => {
  it('today\'s hero holds 720p third-person within a pixel but its feet; 1080p splits the trunk and limbs; no target is today', () => {
    const { m } = built({ cast: 'female' });
    const at720 = castDensity(m.plan, '720p');
    expect(at720.parts.filter((p) => p.errorPx > 1).map((p) => p.part)).toEqual(['footR']);
    expect(at720.refine).toEqual([{ parts: ['footR', 'footL'], slots: 'halve' }]);
    expect(castDensity(m.plan, '1080p').refine[0].parts).toEqual(['torso', 'pelvis', 'upperArmR', 'upperArmL', 'foreArmR', 'foreArmL', 'thighR', 'thighL', 'shankR', 'shankL', 'footR', 'footL']);
    expect([null, '720p', '1080p', '4k'].map((t) => tris({ cast: 'female', ...(t ? { target: t } : {}) }))).toEqual([5196, 5364, 7724, 7724]);
  }, 120000);

  it('the readout names each part\'s outline, and the parts one split cannot hold', () => {
    const close = built({ cast: 'female', target: { resolution: '4k', framing: 'close' } });
    const r = castDensityReadout(close.m.plan, { resolution: '4k', framing: 'close' }, close.tris);
    expect(r.parts.torso).toMatchObject({ sides: 24, wants: 31 });
    expect(r.over).toContain('torso');
    expect(r.advice).toMatch(/after one split/);
    const top = built({ cast: 'female', target: { resolution: '1080p', framing: 'top-down' } });
    expect(top.tris).toBe(5196);
    expect(castDensityReadout(top.m.plan, { resolution: '1080p', framing: 'top-down' }, top.tris).advice).toMatch(/register 'lowpoly' spends less/);
  }, 120000);

  it('a clothed hero keeps its dress\'s split; the target splits what the dress only gave stations', () => {
    const { m } = built({ cast: 'female', detail: 'clothed' });
    const d = castDensity(m.plan, '1080p');
    expect(d.parts.find((p) => p.part === 'upperArmR').split).toBe(true);
    expect(d.refine).toContainEqual({ parts: ['torso'], stations: false, slots: 'halve' });
    expect(tris({ cast: 'female', detail: 'clothed', target: '1080p' })).toBeGreaterThan(tris({ cast: 'female', detail: 'clothed' }));
  }, 120000);

  it('a hero on a cube takes its target unless it names its own', () => {
    expect(readGeocube('gothic-night')).toMatchObject({ era: 'gen-6', target: { resolution: '1080p', framing: 'third-person', error: 1 } });
    expect(tris({ cast: 'female', geocube: 'gothic-night' })).toBe(7724);
    expect(tris({ cast: 'female', geocube: { from: 'gothic-night', target: '720p' } })).toBe(5364);
    expect(tris({ cast: 'female', geocube: 'gothic-night', target: { resolution: '1080p', framing: 'top-down' } })).toBe(5196);
  }, 120000);

  it('refuses a bad target, a bad era on a cube and a broken cube with the lists', () => {
    expect(validateHeroSpec({ target: '8k' })[0]).toMatch(/resolution is a word/);
    expect(validateHeroSpec({ geocube: 'gothic-noon' })[0]).toMatch(/not a preset .*gothic-night/);
    expect(() => readGeocube({ from: 'island-noon', era: 'gen-6.5' })).toThrow(/not an era/);
    expect(() => readGeocube({ from: 'island-noon', target: { resolution: '1080p', framing: 2 } })).toThrow(/framing/);
  });
});
