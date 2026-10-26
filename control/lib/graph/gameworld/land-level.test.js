// The land in the level (nature.js landToLevel, world.js resolveLevel): a world's or a level's `style.land` lowered onto
// the settings a walk's stages already draw by, each form's gaps named, and nothing written where the land says nothing.
import { describe, expect, it } from 'vitest';
import { resolveLevel, landAdvice } from './world.js';
import { gameStages } from './levels.js';
import { landToLevel, CLOUD_SKY, FACE_PATTERN } from './nature.js';
import { LAND_FORMS, LAND_FORM_IDS } from '../era/out-land.js';
import { outTrailSite, OUT_TRAIL, landmarkStands } from '../era/out-trail.js';
import { rockItems } from '../era/nature.js';
import { ISEKAI_STYLES } from '../era/isekai.js';
import { readLevel, layLevel } from '../level/index.js';
import { withGeocube } from '../era/geocube.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
// every leaf path at which two recipes differ (a group one side lacks read as empty)
const diff = (a, b, at = '', out = []) => {
  if (JSON.stringify(a) === JSON.stringify(b)) return out;
  if ((isObj(a) || a === undefined) && (isObj(b) || b === undefined)) { a ??= {}; b ??= {}; for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) diff(a[k], b[k], `${at}.${k}`, out); return out; }
  out.push(at);
  return out;
};
// a small world: two levels, each two trails and a climb, painted by a cube
const walk = { nodes: { t: { trail: true }, u: { trail: true }, top: { meru: true } } };
const W = ({ style = {}, a = undefined, cube = true } = {}) => ({ id: 'w', seed: 3, style: { kit: 'isekai-meadow', ...(cube ? { geocube: 'island-noon' } : {}), ...style },
  levels: { a: { ...(a ? { style: a } : {}), walk }, b: { walk } } });
// the settings the land lowers onto, anywhere in a recipe
const LOWERED = /\.(rocks|clouds|relief|cliff|bump)\./;
const meadow = ISEKAI_STYLES['isekai-meadow'];

describe('the land in the level', () => {
  it('absent adds nothing: a world that names no land writes none of the settings, and says nothing of it', () => {
    expect(landToLevel('isekai-meadow', {})).toBeNull();
    expect(landToLevel('isekai-meadow', { rock: {} })).toBeNull();
    const R = resolveLevel(W(), 'a');
    expect(R.land).toBeUndefined();
    expect(R.level.clouds).toBeUndefined();
    expect(R.level.nodes).toEqual({ t: { trail: {} }, u: { trail: {} }, top: { meru: {} } });
    // a land that names nothing lays the same stages, byte for byte, and none carries a lowered setting
    const S = gameStages(W());
    expect(JSON.stringify(gameStages(W({ style: { land: {} } })))).toBe(JSON.stringify(S));
    expect(S.flatMap((s) => diff({}, s.manifest)).filter((p) => LOWERED.test(p))).toEqual([]);
    expect(landAdvice(W())).toEqual([]);
  });

  it('each form lowers onto the setting its stage draws by, from its variant\'s rails at its step', () => {
    const at = (land, o) => landToLevel('isekai-meadow', land, { seed: 7, painted: true, ...o });
    // landscape: the trails' mounds and the climb's plain, half the relief high; the variant names the relief card
    const L = at({ landscape: { variant: 'rugged', many: 1 } }), rugged = LAND_FORMS.landscape.variants.rugged.relief;
    expect(L.trail.ground.bump.height).toBe(Math.min(8, rugged[1] / 2));
    expect(L.meru.relief).toMatchObject({ from: 'craggy', height: rugged[1] / 2 });
    expect(at({ landscape: { variant: 'terraced', many: 0.5 } }).meru.relief.terrace.step).toBeGreaterThan(0);
    // rock: as many boulders as the step says (landOfKit's inverse: bare one, a field fourteen)
    expect([0, 1].map((m) => at({ rock: { many: m } }).trail.rocks.boulders)).toEqual([1, 14]);
    // strata: the cliff bedded 14 m over its beds; tilted, its beds dipped inside the variant's rail
    const St = at({ strata: { variant: 'tilted', many: 1 } }).trail.ground.cliff;
    expect(St.bed).toBe(Math.round((14 / LAND_FORMS.strata.rails.beds[1]) * 100) / 100);
    expect(St.dip).toBeGreaterThanOrEqual(LAND_FORMS.strata.variants.tilted.dip[0]);
    expect(St.dip).toBeLessThanOrEqual(LAND_FORMS.strata.variants.tilted.dip[1]);
    // face: the cliff jointed 24 m over its joints, cut in the variant's pattern
    const Fv = Object.keys(FACE_PATTERN).find((v) => v !== 'blocky');
    expect(at({ face: { variant: Fv, many: 0 } }).trail.ground.cliff).toEqual({ joint: 24 / LAND_FORMS.face.rails.joints[0], pattern: FACE_PATTERN[Fv] });
    // cloud: the sky its variant is painted as, at its step's cover, on a level a cube paints
    const Cv = Object.keys(CLOUD_SKY)[0];
    expect(at({ cloud: { variant: Cv, many: 0.75 } }).clouds).toEqual({ kind: CLOUD_SKY[Cv], cover: 0.75 });
    // landmark: a monolith is the trail's landmark stone, at its place on its rail among the trail's own sizes
    const M = at({ landmark: { variant: 'monolith' } }).trail.rocks.landmark, S = OUT_TRAIL.landmark.sizes;
    expect(M).toBeGreaterThanOrEqual(Math.floor(landmarkStands(meadow, S[0]) * 100) / 100);
    expect(M).toBeLessThanOrEqual(Math.ceil(landmarkStands(meadow, S[S.length - 1]) * 100) / 100);
    // what is said is what was lowered: every drawn form says what it became, and on which sections
    expect(L.forms.landscape).toMatchObject({ variant: 'rugged', many: 1, on: ['trail', 'meru'], gaps: [] });
    // the same land, the same seed: the same settings
    expect(at({ strata: { variant: 'tilted' } })).toEqual(at({ strata: { variant: 'tilted' } }));
  });

  it('a form the stage cannot draw is a named gap, and lowers nothing; falls among them', () => {
    const at = (land, o) => landToLevel('isekai-meadow', land, { seed: 7, painted: true, ...o });
    // one variant a form names that no stage draws, picked from the catalog: the first with no lever
    const LEVER = { landscape: () => true, rock: (v) => v === 'boulders', strata: (v) => ['layered', 'tilted'].includes(v), face: (v) => !!FACE_PATTERN[v], cloud: (v) => !!CLOUD_SKY[v], landmark: (v) => v === 'monolith' };
    for (const f of LAND_FORM_IDS.filter((x) => x !== 'landscape')) {
      const v = Object.keys(LAND_FORMS[f].variants).find((x) => !LEVER[f](x)), R = at({ [f]: { variant: v } });
      expect(R.forms[f].gaps.join(' ')).toMatch(new RegExp(`^${v}: not drawn`));
    }
    const falls = at({ landmark: { variant: 'falls' } });
    expect(falls.trail).toBeUndefined();
    expect(falls.forms.landmark.gaps[0]).toMatch(/no water falls from a cliff.*stream/);
    // a sky no cube paints is the kit's own; a trail's ground is not stepped
    expect(at({ cloud: { variant: 'stratus' } }, { painted: false }).forms.cloud.gaps).toEqual(['no geocube paints this level: its sky is the kit\'s own']);
    expect(at({ landscape: { variant: 'terraced' } }).forms.landscape.gaps[0]).toMatch(/not stepped into terraces/);
    // a walk with no trail draws only its plain and its sky
    expect(at({ rock: { many: 1 } }, { sections: ['meru'] }).forms.rock.gaps).toContain('the walk has no trail to draw it on');
    // the readout's advice: one line a gap, naming its levels
    expect(landAdvice(W({ style: { land: { landmark: { variant: 'falls' } } } }))).toEqual([expect.stringMatching(/^land\.landmark on a, b: falls: not drawn/)]);
  });

  it('a level\'s land wins over the world\'s; a section\'s own settings over the land', () => {
    const R = resolveLevel(W({ style: { land: { rock: { many: 0 } } }, a: { land: { rock: { many: 1 } } } }), 'a');
    expect(R.level.nodes.t.trail.rocks).toEqual({ boulders: 14 });
    expect(resolveLevel(W({ style: { land: { rock: { many: 0 } } } }), 'b').level.nodes.t.trail.rocks).toEqual({ boulders: 1 });
    // a trail that names its bumpiness keeps its mounds' height (the land still sizes them); its own rocks win
    const T = resolveLevel(W({ style: { trail: { bumpiness: 0.2 }, land: { landscape: { variant: 'rugged' } } } }), 'a').level.nodes.t.trail;
    expect(T.bumpiness).toBe(0.2);
    expect(Object.keys(T.ground.bump)).toEqual(['scale']);
    const own = { id: 'w', style: { land: { rock: { many: 1 } } }, levels: { a: { walk: { nodes: { t: { trail: { rocks: { boulders: 3 } } } } } } } };
    expect(resolveLevel(own, 'a').level.nodes.t.trail.rocks).toEqual({ boulders: 3 });
    // the sky on a level its cube paints, not on one it does not
    expect(resolveLevel(W({ style: { land: { cloud: { variant: 'stratus', many: 1 } } } }), 'a').level.clouds).toEqual({ kind: 'overcast', cover: 1 });
    expect(resolveLevel(W({ cube: false, style: { land: { cloud: { variant: 'stratus', many: 1 } } } }), 'a').level.clouds).toBeUndefined();
  });

  it('each form is local: it re-makes only its level\'s stages, and changes only the setting it lowers onto', () => {
    const base = gameStages(W());
    // one case per form: each lowered setting's own key in the stage recipes
    // (the clouds also light the look a climb names for the trail before it: its `after.kit`)
    const CASE = { landscape: [{ variant: 'rugged', many: 1 }, /\.(ground\.bump|meru\.relief)\./], rock: [{ many: 1 }, /\.rocks\.boulders$/], strata: [{ many: 1 }, /\.ground\.cliff\.bed$/], face: [{ variant: 'columnar' }, /\.ground\.cliff\.pattern$/], cloud: [{ variant: 'cirrus', many: 0.5 }, /^\.clouds\.(kind|cover)$|^\.meru\.after\.kit$/], landmark: [{ variant: 'monolith' }, /\.rocks\.landmark$/] };
    for (const [f, [patch, key]] of Object.entries(CASE)) {
      const S = gameStages(W({ a: { land: { [f]: patch } } })), changed = S.map((s, i) => ({ s, d: diff(base[i].manifest, s.manifest) })).filter((x) => x.d.length);
      expect(changed.every(({ s }) => s.level === 'a'), f).toBe(true);
      expect(changed.map(({ s }) => s.node), f).toEqual(['t', 'u', 'top']);
      for (const { d } of changed) expect(d.every((p) => key.test(p)), `${f}: ${d}`).toBe(true);
    }
    // a gap re-makes nothing
    expect(JSON.stringify(gameStages(W({ a: { land: { landmark: { variant: 'falls' } } } })))).toBe(JSON.stringify(base));
  });

  it('the stages draw what they are handed: a trail\'s rocks and its cliff\'s beds and joints, a level\'s clouds', () => {
    const site = (t) => outTrailSite(meadow, { id: 'a', ...t }, 5);
    const S0 = site({}), S1 = site({ rocks: { boulders: 2, landmark: 12 }, ground: { cliff: { bed: 0.8, dip: 12, joint: 1.5, pattern: 'columnar' } } });
    const boulders = (s) => rockItems(meadow, s, 5).filter((r) => r.role === 'boulder').length;
    expect([boulders(S0), boulders(S1)]).toEqual([meadow.rubble.boulders, 2]);
    // the landmark stone stands the metres asked
    const stone = S1.rocks.find((r) => r.role === 'landmark');
    expect(landmarkStands(meadow, stone.size)).toBeCloseTo(12, 3);
    expect(S0.rocks.find((r) => r.role === 'landmark').size).toBeLessThanOrEqual(OUT_TRAIL.landmark.sizes.at(-1));
    // the cliff's geology as asked; the card's where nothing is
    expect(S1.grid.strata.dipped).toBe(true);
    expect(S1.grid.joints).toMatchObject({ pattern: 'columnar', spacing: 1.5 });
    expect(S0.grid.joints).toMatchObject({ pattern: 'blocky', spacing: meadow.landform.joint });
    expect(S0.grid.strata.dipped).toBe(false);
    // what is wrong with them is said
    expect(() => site({ rocks: { boulders: 99 } })).toThrow(/rocks\.boulders is how many/);
    expect(() => site({ rocks: { size: 2 } })).toThrow(/not a rocks setting/);
    expect(() => site({ ground: { cliff: { pattern: 'fluted' } } })).toThrow(/cliff\.pattern is one of blocky, columnar, slabby/);
    // a level's clouds: on every section its cube paints (a node in its own kit takes none), and only with a cube
    const lay = (n) => layLevel({ geocube: 'island-noon', clouds: { kind: 'high', cover: 0.4 }, nodes: { t: n } }).stages[0].manifest.clouds;
    expect([lay({ trail: true }), lay({ trail: true, kit: 'isekai-meadow' })]).toEqual([{ kind: 'high', cover: 0.4 }, undefined]);
    expect(() => readLevel({ clouds: 'high', nodes: { t: { trail: true } } })).toThrow(/clouds are a geocube's outside's sky/);
  });

  it('a climb after a trail under a level\'s clouds names the look its own stage draws (it opens in a fresh process)', () => {
    // the trail before is drawn in the cube's look under the clouds, and the climb's own stage registers that look; the
    // climb's `after.kit` named the look without them, which only an earlier lowering in the same process had registered
    const climb = layLevel({ geocube: 'island-noon', clouds: { kind: 'high', cover: 0.4 }, nodes: { t: { trail: true }, c: { meru: true } } })
      .stages.find((x) => x.manifest.meru).manifest;
    expect(climb.meru.after.kit).toBe(withGeocube(climb).kit);
  });
});
