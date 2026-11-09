// THE METRO'S INDUSTRY: a share of its outskirts' neighbourhoods built as industry (its edge's and its shore's first),
// their blocks its industrial segments with a substation in each, each block's plan, the industrial kit's pieces, and
// the scene: its halls clad, its pieces stamped, its line on pylons in from the country.
import { describe, it, expect } from 'vitest';
import { designGeocity, industryOf } from './design.js';
import { readGeocity } from './metro.js';
import { industrialPlan, industryTemplates, INDUSTRY_FAR, PYLON, INDUSTRY_FINISHES, finishOf } from './industry.js';
import { MATERIAL_WORDS, materialContext, wordTile } from '../era/arch-style.js';
import { matterOfWord } from '../rupa/look-matter.js';
import { readGeocube } from '../era/geocube.js';
import { normalizeTileSpec } from '../era/tile-specs.js';
import { INDUSTRY_SEGMENTS, CARDS } from './segments.js';
import { assembleGeocityScene } from './scene.js';
import { mulberry32 } from '../city/plan/dice.js';
import { DEFAULT_LIGHT } from '../polygonizer/vexar.js';

const d = designGeocity({}, { seed: 3 });
const ind = d.regions.filter((r) => r.industrial);

describe('the metro\'s industrial neighbourhoods', () => {
  it('builds its share of its outskirts as industry, its land\'s edge first, none a park', () => {
    const out = d.regions.filter((r) => r.builds === 'outskirts' && !r.park && !r.geotown);
    expect(ind.length).toBe(Math.round(d.metro.industry.share * out.length));
    for (const r of ind) { expect(r.builds).toBe('outskirts'); expect(r.park).toBe(false); }
    const edge = out.filter((r) => r.beyond.length);
    expect(ind.filter((r) => r.beyond.length).length).toBe(Math.min(ind.length, edge.length));
    expect(industryOf(d.regions, { industry: { share: 0 } }, 3)).toEqual([]);
  });

  it('gives its blocks the industrial segments, a substation in each, every law kept', () => {
    for (const r of ind) {
      const kinds = r.blocks.filter((b) => b.kind !== 'park').map((b) => b.kind);
      expect(kinds.filter((k) => k === 'substation')).toHaveLength(1);
      for (const k of kinds) expect([...INDUSTRY_SEGMENTS, 'construction', 'parking', 'vacant']).toContain(k);
    }
    for (const id of ['segments', 'pitch', 'blocks']) expect(d.laws.find((l) => l.law === id).ok).toBe(true);
    for (const k of INDUSTRY_SEGMENTS) expect(Object.values(CARDS[k].surfaces).reduce((a, v) => a + v, 0)).toBeCloseTo(1, 6);
  });

  it('builds none where its recipe says `industry: false`, and refuses a share past its range', () => {
    expect(designGeocity({ industry: false }, { seed: 3 }).regions.some((r) => r.industrial)).toBe(false);
    expect(() => readGeocity({ industry: { share: 2 } })).toThrow(/industry is false or/);
    expect(readGeocity({ industry: { share: 0.3 } }).metro?.industry?.share ?? readGeocity({ industry: { share: 0.3 } }).industry?.share).toBe(0.3);
  });
});

describe('an industrial block\'s plan', () => {
  const block = (kind) => ({ id: `T.${kind}`, kind, rect: [0, 0, 150, 220], sides: { w: { kind: 'arterial' }, e: { kind: 'street' }, s: { kind: 'street' }, n: { kind: 'street' } } });
  const plan = (kind, opts) => industrialPlan(block(kind), mulberry32(7), opts);
  const has = (ops, f) => ops.some(f);

  it('stands each kind with its own: a works\' hall under a gable, a warehouse\'s docks, storage\'s containers, a tank farm\'s tanks in their bunds, a substation\'s transformers and gantries', () => {
    const works = plan('works'), ware = plan('warehouse'), store = plan('storage'), tanks = plan('tanks'), sub = plan('substation');
    expect(has(works, (o) => o.op === 'gable' && o.group.startsWith('geocity:works-'))).toBe(true);
    expect(ware.filter((o) => o.op === 'door').length).toBeGreaterThan(10);
    expect(has(ware, (o) => o.op === 'box' && o.group.startsWith('geocity:warehouse-'))).toBe(true);
    expect(store.filter((o) => o.key?.startsWith('container:')).length).toBeGreaterThan(20);
    expect(tanks.filter((o) => o.key === 'tank').length).toBeGreaterThan(2);
    expect(has(tanks, (o) => o.op === 'bund')).toBe(true);
    for (const k of ['transformer:', 'gantry:', 'breaker']) expect(has(sub, (o) => o.key?.startsWith(k))).toBe(true);
    for (const ops of [works, ware, store, tanks, sub]) expect(has(ops, (o) => o.op === 'fence')).toBe(true);
  });

  it('keeps everything inside its block, and is the same plan from the same dice', () => {
    for (const k of INDUSTRY_SEGMENTS) {
      const ops = plan(k);
      for (const o of ops) {
        const pts = o.q ? [[o.q[0], o.q[1]], [o.q[2], o.q[3]]] : Array.isArray(o.at) ? [o.at] : [];
        for (const [x, y] of pts) { expect(x).toBeGreaterThanOrEqual(-1e-6); expect(x).toBeLessThanOrEqual(150 + 1e-6); expect(y).toBeGreaterThanOrEqual(-1e-6); expect(y).toBeLessThanOrEqual(220 + 1e-6); }
      }
      expect(JSON.stringify(plan(k))).toBe(JSON.stringify(ops));
    }
  });

  it('draws only its halls and tall pieces far off', () => {
    const far = plan('works', { far: true });
    expect(far.every((o) => o.op === 'box' || o.op === 'gable' || (o.op === 'stamp' && INDUSTRY_FAR.includes(o.key.split(':')[0])))).toBe(true);
  });
});

describe('the industrial finishes', () => {
  it('dresses each family from its variants by the dice, each variant a wall\'s word and a roof\'s in the library', () => {
    for (const [fam, vs] of Object.entries(INDUSTRY_FINISHES)) {
      for (const [w, r] of Object.values(vs)) { expect(MATERIAL_WORDS[w]?.on, `${fam} ${w}`).toBe('wall'); expect(MATERIAL_WORDS[r]?.on, `${fam} ${r}`).toBe('roof'); expect(matterOfWord(w)).not.toBe(null); }
      const seen = new Set(Array.from({ length: 60 }, (_, k) => finishOf(fam, mulberry32(k + 1)).group));
      expect(seen.size).toBe(Object.keys(vs).length);
      for (const g of seen) expect(g.startsWith(`geocity:${fam}-`)).toBe(true);
    }
    // (each a tile the library paints: its cut, its colours on their rails)
    const X = materialContext(readGeocube('valley-morning'));
    for (const w of new Set(Object.values(INDUSTRY_FINISHES).flatMap((vs) => Object.values(vs).flat()))) expect(normalizeTileSpec(wordTile(w, X, 7).spec).gen, w).toBe('dressed');
  });
});

describe('the industrial kit', () => {
  const T = industryTemplates(DEFAULT_LIGHT);
  it('builds every piece, each way it lies, lit', () => {
    for (const [k, v] of Object.entries(T)) {
      const sets = Array.isArray(v) ? [v] : [v.x, v.y];
      for (const fs of sets) { expect(fs.length, k).toBeGreaterThan(4); for (const f of fs) expect(f.fill).toMatch(/^#[0-9a-f]{6}$/); }
    }
    // (a pylon's arms across its line, at its heights; its peak over them)
    const ys = T.pylon.x.flatMap((f) => f.corners.map((c) => c[1])), zs = T.pylon.x.flatMap((f) => f.corners.map((c) => c[2]));
    expect(Math.max(...ys)).toBeGreaterThan(PYLON.arms[1][0] - 0.5);
    expect(Math.max(...zs)).toBeGreaterThan(PYLON.peak - 0.5);
    const xs = T.pylon.y.flatMap((f) => f.corners.map((c) => c[0]));
    expect(Math.max(...xs)).toBeGreaterThan(PYLON.arms[1][0] - 0.5);
  });
});

describe('the metro\'s industry, built', () => {
  it('clads its halls, stamps its pieces, feeds each substation by a line on pylons from beyond its edge', () => {
    const at = ind.find((r) => r.beyond.length)?.id;
    const p = assembleGeocityScene({ kind: 'geocube', cube: 'valley-morning', show: 'geocity', seed: 3, geocity: { evoke: 'neighbourhood', at } });
    const C = p.geocity.counts.industry;
    expect(C.blocks).toBeGreaterThan(0);
    expect(C.pylons).toBeGreaterThan(0);
    expect(C.lines).toBeGreaterThan(0);
    expect(p.footless).toEqual(['geocity:wire']);
    const groups = new Set(p.repeats.map((r) => r.group));
    for (const g of ['geocity:industry-pylon', 'geocity:industry-transformer', 'geocity:industry-gantry', 'geocity:industry-chainlink']) expect(groups.has(g)).toBe(true);
    // (its halls dressed in their cladding: a textured face among them)
    expect(p.faces.some((f) => /^geocity:(works|warehouse)-/.test(f.group) && f.texture)).toBe(true);
    expect(p.geocity.neighbourhoods.find((r) => r.id === at).industrial).toBe(true);
    for (const l of p.geocity.laws.filter((x) => ['segments', 'pitch'].includes(x.law))) expect(l.ok, l.value).toBe(true);
  });
});
