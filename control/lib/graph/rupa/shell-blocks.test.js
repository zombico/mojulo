import { describe, it, expect } from 'vitest';
import { shellBlocks, COURSE, ROOF_FILL } from './shell-blocks.js';
import { loadAudit } from './index.js';
import { blockMatter } from './matter.js';
import { structureFaces, PRESETS, PRESET_IDS } from '../fractal-structure/index.js';
import { assembleGeocubeScene } from '../era/geocube.js';
import { assembleStageScene } from '../era/stage.js';

// one case per procedure, chosen from the catalogue in code: a solid tower (courses), a hollow one with a ring of columns
// under a ring beam (cells, seating, a hung beam), a hall whose columns carry its body (seating)
const SOLID = PRESET_IDS.find((id) => !PRESETS[id].hollow && !PRESETS[id].colonnade && PRESETS[id].plinth);
const RINGED = PRESET_IDS.find((id) => PRESETS[id].hollow && PRESETS[id].colonnade?.layout === 'ring');
const CARRIED = PRESET_IDS.find((id) => PRESETS[id].colonnade?.carry);
const built = new Map();
const tower = (preset, at = [0, 0, 0]) => {
  const k = preset + at.join(',');
  if (!built.has(k)) { const S = structureFaces([{ preset, at, size: 8, echo: false }]); built.set(k, { S, R: shellBlocks({ faces: S.faces, colliders: S.colliders }, { rings: S.rings }) }); }
  return built.get(k);
};
const ovl = (a, b, k) => Math.min(a.max[k], b.max[k]) - Math.max(a.min[k], b.min[k]);

describe('a structure as the blocks destructible physics breaks', () => {
  it('a solid tier is courses, none wider or taller than a course (a sixth of a wide one), each flat on what is under it', () => {
    const { S, R } = tower(SOLID);
    const tier = S.colliders.find((c) => /:body-\d+$/.test(c.of)), own = R.breakables.filter((b) => b.id.startsWith(tier.of + '#'));
    expect(own.length).toBeGreaterThan(1);
    const w = tier.max[0] - tier.min[0];
    for (const b of own) {
      expect(b.max[0] - b.min[0]).toBeLessThanOrEqual(Math.max(COURSE, w / 6) + 1e-6);
      expect(b.max[2] - b.min[2]).toBeLessThanOrEqual(COURSE + 1e-6);
    }
    // the courses fill the tier's box exactly
    const vol = (b) => (b.max[0] - b.min[0]) * (b.max[1] - b.min[1]) * (b.max[2] - b.min[2]);
    expect(own.reduce((s, b) => s + vol(b), 0)).toBeCloseTo(vol(tier), 6);
    expect(R.colliders.some((c) => c.of === tier.of)).toBe(false);   // the blocks are its collider now
    expect(loadAudit(R.breakables, { colliders: R.colliders }).holds).toBe(true);
  });

  it('a ring is wall-thick cells sharing faces; its ring beam is hung across its columns, seated on their capitals; it stands', () => {
    const { R } = tower(RINGED);
    const beam = R.breakables.filter((b) => /:entablature-/.test(b.id));
    expect(beam.length).toBeGreaterThan(4);
    expect(beam.every((b) => b.bond === 'lateral')).toBe(true);
    // every beam cell shares a side with another (never only a corner)
    const side = (a, s) => ovl(a, s, 2) > 1e-3 && [0, 1].some((k) => ovl(a, s, 1 - k) > 1e-3 && (Math.abs(a.max[k] - s.min[k]) < 1e-6 || Math.abs(s.max[k] - a.min[k]) < 1e-6));
    expect(beam.every((a) => beam.some((s) => s !== a && side(a, s)))).toBe(true);
    expect(R.groups[0].seated).toBeGreaterThan(0);
    expect(loadAudit(R.breakables, { colliders: R.colliders })).toMatchObject({ holds: true, loose: [], crush: [], span: [] });
  });

  it('a body carried on columns is seated on them and stands', () => {
    const { R } = tower(CARRIED);
    expect(R.groups[0].seated).toBeGreaterThan(0);
    expect(loadAudit(R.breakables, { colliders: R.colliders }).holds).toBe(true);
  });

  it('every face goes with a block: named by it and drawn in its break group', () => {
    const { R } = tower(SOLID), ids = new Set(R.breakables.map((b) => b.id));
    const own = R.faces.filter((f) => /^break:structure:/.test(f.group || ''));
    expect(own.length).toBe(R.faces.length);
    expect(own.every((f) => ids.has(f.node) && f.group === `break:${f.node}`)).toBe(true);
  });

  it('on raised land it stands on a footing; without one the audit says it falls', () => {
    const { R } = tower(SOLID, [0, 0, 5]);
    expect(R.footings.length).toBeGreaterThan(0);
    expect(R.footings.every((f) => f.max[2] === 5)).toBe(true);
    expect(loadAudit(R.breakables, { colliders: R.colliders }).holds).toBe(true);
    const bare = loadAudit(R.breakables, { colliders: [] });
    expect(bare.loose.length).toBe(R.breakables.length);
  });

  it('the same structure gives the same blocks', () => {
    const S = structureFaces([{ preset: SOLID, at: [0, 0, 0], size: 8, echo: false }]);
    expect(JSON.stringify(shellBlocks(S, { rings: S.rings }))).toBe(JSON.stringify(tower(SOLID).R));
  });

  it('a world with neither a structure nor a shell house has none', () => {
    expect(shellBlocks({ faces: [], colliders: [{ min: [0, 0, 0], max: [1, 1, 1] }] })).toBeNull();
  });
});

describe('a town\'s shell houses as walls and a roof', () => {
  const P = assembleGeocubeScene({ kind: 'geocube', cube: 'gothic-night', show: 'town', seed: 3 }, {}, assembleStageScene);
  const R = shellBlocks(P, { matterOf: { wall: { matter: 'stone' }, roof: { matter: 'pine', fill: 0.2 } } });
  const houses = P.colliders.filter((c) => /:house$/.test(c.of));

  it('each house is wall panels to its eave and a roof on them; its box collider is gone', () => {
    expect(houses.length).toBeGreaterThan(0);
    for (const c of houses) {
      const id = c.of.replace(/:house$/, ''), walls = R.breakables.filter((b) => b.id.startsWith(`${id}:wall-`)), roof = R.breakables.find((b) => b.id === `${id}:roof`);
      expect(walls.length).toBeGreaterThanOrEqual(4);
      expect(walls.every((b) => b.matter === 'stone' && b.max[0] - b.min[0] <= COURSE + 1e-6 && b.max[1] - b.min[1] <= COURSE + 1e-6)).toBe(true);
      const eave = Math.max(...walls.map((b) => b.max[2]));
      expect(roof.min[2]).toBe(eave);
      expect(roof.max[2]).toBeCloseTo(c.max[2], 3);
      expect(roof).toMatchObject({ matter: 'pine', fill: 0.2 });
      expect(R.colliders.includes(c)).toBe(false);
    }
  });

  it('a roof named without a fill is a roof\'s (mostly air); the houses stand at minute zero', () => {
    const plain = shellBlocks(P, {});
    const roof = plain.breakables.find((b) => /:roof$/.test(b.id));
    expect(roof.fill).toBe(ROOF_FILL);
    expect(roof.mass).toBeCloseTo(blockMatter(roof, { matter: roof.matter, fill: ROOF_FILL }).mass, 6);
    const A = loadAudit(R.breakables, { colliders: R.colliders });
    expect(A).toMatchObject({ loose: [], crush: [], span: [] });
  });

  it('the houses\' faces go with their walls and roofs', () => {
    const ids = new Set(R.breakables.map((b) => b.id));
    const town = R.faces.filter((f) => typeof f.node === 'string' && ids.has(f.node));
    expect(town.length).toBeGreaterThan(0);
    expect(P.faces.filter((f) => /^town:/.test(f.group || '')).length).toBeGreaterThanOrEqual(town.length);
  });
});

describe('the audit at minute zero', () => {
  const box = (id, min, max, matter, extra = {}) => ({ id, min, max, ...blockMatter({ min, max }, matter), ...extra });
  it('names what falls at once, what is crushed, and a hung run its bonds cannot carry', () => {
    expect(loadAudit([box('a', [0, 0, 1], [1, 1, 2], 'brick')]).loose).toEqual(['a']);
    // a 40 m steel bar on a post of packed snow: the snow is crushed by the weight it carries
    const crushed = loadAudit([box('base', [0, 0, 0], [0.02, 0.02, 0.5], 'snow'), box('top', [0, 0, 0.5], [0.02, 0.02, 40], 'steel')]);
    expect(crushed.crush).toEqual(['base']);
    // a long brick beam held at one end only
    const beam = [box('post', [0, 0, 0], [0.3, 0.3, 2], 'brick'), ...Array.from({ length: 8 }, (_, i) => box(`b${i}`, [0.3 + i * 0.5, 0, 1.7], [0.8 + i * 0.5, 0.3, 2], 'brick', { bond: 'lateral' }))];
    expect(loadAudit(beam).span.length).toBeGreaterThan(0);
    expect(loadAudit([box('a', [0, 0, 0], [1, 1, 1], 'brick')])).toMatchObject({ holds: true, blocks: 1 });
  });
});

describe('in a world', () => {
  it('a physical level breaks its structure by blocks and stamps the load; any other level keeps its colliders', async () => {
    const { resolveWorldScene } = await import('../worlds/world-scene.js');
    const { starter } = await import('../era/entries.js');
    const hero = { id: 'hero', pilotable: true, rule: { type: 'platform', speed: 5 }, transform: { pos: [0, -12, 0] }, body: { type: 'mesh', shape: 'box', size: [0.6, 0.6, 1.7] } };
    const level = (destruction) => ({ manifest: { ...starter('gothic-stone'), entities: [hero], structures: [{ preset: SOLID, at: [0, 8, 0], size: 6, echo: false }], ...(destruction ? { destruction } : {}) }, title: 'shrine' });
    const phys = (await resolveWorldScene(level('physical'))).payload, world = (await resolveWorldScene(level('world'))).payload;
    const blocks = phys.breakables.filter((b) => b.id.startsWith('structure:'));
    expect(blocks.length).toBeGreaterThan(1);
    expect(phys.breakPieces[blocks[0].id]).toBeDefined();
    expect(phys.colliders.some((c) => /^structure:.*:body-\d+$/.test(c.of))).toBe(false);
    expect(phys.rupaAudit).toMatchObject({ holds: true });
    expect(phys.rupaAudit.shells[0]).toMatchObject({ kind: 'structure' });
    expect(world.rupaAudit).toBeUndefined();
    expect(world.colliders.some((c) => /^structure:.*:body-\d+$/.test(c.of))).toBe(true);
    expect((world.breakables || []).some((b) => b.id.startsWith('structure:'))).toBe(false);
  }, 120000);
});

describe('pieces shared by like blocks', () => {
  it('a course the size and cut of one already cut takes its pieces in its own colour; the page resolves it only then', async () => {
    const { piecesOf } = await import('../playscape/destruct/breakability.js');
    const { controllableChannelScript } = await import('../scene/channels/controllable/index.js');
    const { R } = tower(SOLID), P = piecesOf(R.breakables, R.faces, { share: true }), own = piecesOf(R.breakables, R.faces);
    const liked = Object.entries(P).filter(([, v]) => v.like);
    expect(liked.length).toBeGreaterThan(0);
    for (const [id, v] of liked) { expect(P[v.like].pieces).toBeDefined(); expect(v.fill).toBe(own[id].fill); expect(v.pieces).toBeUndefined(); }
    expect(Object.values(own).some((v) => v.like)).toBe(false);
    const hero = [{ id: 'hero', kind: 'walker', transform: { pos: [0, 0, 1], heading: 0 }, rule: {}, body: {} }];
    const page = (pieces) => controllableChannelScript(hero, null, {}, { breakables: R.breakables.slice(0, 3), breakPieces: pieces });
    expect(page(P)).toContain('if (v.like) __breakPieces[k]');
    expect(page(own)).not.toContain('v.like');
  });
});
