import { describe, it, expect } from 'vitest';
import { floraRead, floraBox, speciesFor, treeSizes, viewHeld, AUTUMN, FLORA_SPECIES, FLORA_DEFAULT, FLORA_STRIDE, FLORA_HIDES, VIEW_CLEAR, SKIRT_FLAG, APART, MASS_BLOB, REALISTIC, PUFF, REALISTIC_HABITS, habitOf } from './flora-read.js';
import { readFlock, flockLeaf, flockLeafOf, FLOCK } from './flora-read.js';
import { BUSH_HABITS } from './bush-form.js';
import { FLOCK_TABLE } from '../scene/channels/form-flock.js';
import { ARCHITECTURES } from '../vegetation/grow.js';
import { LEAF_FORM_IDS } from '../era/leaf-forms.js';
import { SPECIES } from '../vegetation/species.js';
import { needleHabit } from '../vegetation/sprays.js';
import { formLandScript } from '../scene/channels/form-land.js';

const colours = { foliage: '#4a983a', grass: '#7cbf48', stone: '#e2cba0', floor: '#c4875a', accent: '#3a80d0' };
const bases = { foliage: [0.11, 0.33, 0.07], floor: [0.4, 0.2, 0.1] };
// (a conifer kind: grown by rule, quick; the broadleaves' grower is the slow path, read through speciesFor alone)
const needled = Object.keys(FLORA_SPECIES).find((f) => FLORA_SPECIES[f] === 'pine');
const tree = (x, y, h, kind, cluster = 0) => ({ x, y, z: 0, h, kind, cluster });
const plants = (over = {}) => ({ form: 'blob', kinds: [needled, { form: needled, leaf: 2 }], bushKinds: null, trees: [tree(0, 0, 9, 0), tree(10, 2, 11, 0), tree(4, 9, 10, 1)], bushes: [], shrubs: [], ...over });
const unpack = (s) => { const b = Buffer.from(s, 'base64'); return new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4); };

describe('the form render\'s plants', () => {
  it('grows a species for every leaf form, and a level naming no kinds its clusters among the defaults', () => {
    for (const f of LEAF_FORM_IDS) expect(FLORA_SPECIES[f]).toBeTruthy();
    const seen = new Set(Array.from({ length: 24 }, (_, c) => speciesFor({ cluster: c }, null)));
    expect([...seen].sort()).toEqual([...FLORA_DEFAULT].sort());
    expect(speciesFor({ cluster: 3 }, { form: needled })).toBe('pine');
  });

  it('is a copy of one template a species, each plant where it stood, scaled to its height', () => {
    const F = floraRead(plants(), { kinds: plants().kinds, colours, bases }), P = unpack(F.trees);
    expect(F.templates.length).toBe(1);
    expect(F.n).toBe(3);
    expect(P.length).toBe(3 * FLORA_STRIDE);
    for (const [i, t] of plants().trees.entries()) {
      expect(P[i * FLORA_STRIDE]).toBeCloseTo(t.x, 4);
      expect(P[i * FLORA_STRIDE + 3] * F.templates[0].height).toBeCloseTo(t.h, 3);
    }
    expect(Object.keys(F.barks)).toEqual([F.templates[0].bark]);
    expect(JSON.stringify(floraRead(plants(), { kinds: plants().kinds, colours, bases }))).toBe(JSON.stringify(F));
  });

  it('grows the skirt\'s clumps as the level\'s own trees, as wide as their crowns, past the walk; none adds nothing', () => {
    const skirt = [{ x: 80, y: 5, z: 2, r: 2.4, kind: 0 }];
    const A = floraRead(plants(), { kinds: plants().kinds, colours, bases }), B = floraRead(plants({ skirt }), { kinds: plants().kinds, colours, bases }), P = unpack(B.trees);
    expect(B.templates.length).toBe(A.templates.length);
    expect(B.n).toBe(A.n + 1);
    const b = A.n * FLORA_STRIDE, T = B.templates[P[b + 11]];
    expect([P[b], P[b + 1], P[b + 2]]).toEqual([80, 5, 2]);
    expect(P[b + 3] * T.radius).toBeCloseTo(2.4, 3);
    expect(P[b + 12]).toBe(SKIRT_FLAG);
    // (the plants' box takes it in, so its painted clump is no land; the trail's own plants are as they were)
    expect(floraBox(plants({ skirt })).box[2]).toBeGreaterThan(80);
    expect(Array.from(P.slice(0, b))).toEqual(Array.from(unpack(A.trees)));
  });

  it('a raised view claims what it looks over: a crown over its eye ahead held, the rest as they were; a walker\'s eye holds none', () => {
    const P = plants({ trees: [tree(0, 0, 9, 0), tree(10, 2, 11, 0), tree(4, 40, 10, 1)], clear: [[0, 0, 0.7], [10, 2, 0.7], [4, 40, 0.7], [20, 20, 1]] });
    const cam = (eye, look) => ({ name: 'v', worldFraming: { cameraPosition: eye, lookAt: look } });
    // (an overlook 6 m up at (0, -3), looking along +y down to the land: the tree at (0, 0) rises over its eye ahead; one
    // off to its side and one past its reach stand)
    const H = viewHeld(P, [cam([0, -3, 6], [0, 30, 0])], { kinds: P.kinds });
    expect(H.trees.map((t) => !!t.held)).toEqual([true, false, false]);
    expect(H.clear).toEqual([[10, 2, 0.7], [4, 40, 0.7], [20, 20, 1]]);
    // (held, planned with the rest: the others' heights as they were, the held one not drawn)
    const F0 = floraRead(P, { kinds: P.kinds, colours, bases }), F1 = floraRead(H, { kinds: H.kinds, colours, bases });
    expect(F1.n).toBe(F0.n - 1);
    expect(Array.from(unpack(F1.trees))).toEqual(Array.from(unpack(F0.trees)).slice(FLORA_STRIDE));
    // (a walker's eye, under VIEW_CLEAR.raised over what it looks at, claims nothing: the same plants)
    expect(viewHeld(P, [cam([0, -3, 1.7], [0, 30, 0])], { kinds: P.kinds })).toBe(P);
    expect(VIEW_CLEAR.raised).toBeGreaterThan(1.7);
  });

  it('colours a kind\'s crown by its pick from the theorist\'s offer, the rest the cube\'s foliage', () => {
    const F = floraRead(plants(), { kinds: plants().kinds, colours, bases }), P = unpack(F.trees), leaf = (i) => [5, 6, 7].map((k) => P[i * FLORA_STRIDE + k]);
    expect(leaf(0).map((v) => +v.toFixed(3))).toEqual(bases.foliage.map((v) => +v.toFixed(3)));
    expect(leaf(2)).not.toEqual(leaf(0));
  });

  it('keeps a blossom card\'s own look, and reads nothing where nothing grows', () => {
    expect(floraRead(plants({ form: 'blossom' }), { colours, bases })).toBeNull();
    expect(floraRead(plants({ trees: [] }), { colours, bases })).toBeNull();
    expect(FLORA_HIDES).toContain('flora:bush');
  });

  it('in the fall a deciduous species turns, an evergreen keeps its green, and no fall adds nothing', () => {
    const F0 = floraRead(plants(), { kinds: plants().kinds, colours, bases }), F1 = floraRead(plants(), { kinds: plants().kinds, colours, bases, autumn: 0.8 });
    expect(AUTUMN.colours.pine).toBeUndefined();
    expect(F1.trees).toBe(F0.trees);
    expect(F1.autumn).toBe(0.8);
    expect(F0.autumn).toBeUndefined();
    expect(Object.keys(AUTUMN.colours).length).toBeGreaterThan(0);
  });

  it('adds nothing to the land\'s page without plants, and grows them inside it with', () => {
    const land = { light: { sun: [1, 1, 1], ambient: [0.2, 0.2, 0.2] } };
    expect(formLandScript(land)).toBe(formLandScript(land, null));
    const F = floraRead(plants(), { kinds: plants().kinds, colours, bases }), page = formLandScript(land, F);
    expect(page).toContain('the plants (gen-7');
    expect(formLandScript(land)).not.toContain('the plants (gen-7');
    // (a tree drops its own leaves round its foot: a needled crown its needles, laid as alpha on the ground)
    expect(F.templates[0].litter).toBe('needle');
    expect(page).toContain("m.customProgramCacheKey = () => 'form-litter';");
    // (a needled crown carries its sleeves, each vertex's offset from its axis and the axis's run, and its needles are
    // drawn in them; a broadleaf carries none)
    const S = F.templates[0].sleeve;
    expect(Buffer.from(S.out, 'base64').byteLength / 12).toBe(Buffer.from(S.pos, 'base64').byteLength / 12);
    expect(Buffer.from(S.ax, 'base64').byteLength / 3).toBe(Buffer.from(S.pos, 'base64').byteLength / 12);
    expect(S.radius).toBeGreaterThan(0);
    expect(F.templates.filter((t) => t.kind === 'tree' && t.litter !== 'needle').every((t) => !t.sleeve)).toBe(true);
    expect(page).toContain("'form-needles' + phi");
  });
});

describe('a tree that names its species (a town\'s), and the sizes the form grows them at', () => {
  it('grows a named species, and says each tree\'s height and crown reach in the plants\' order', () => {
    expect(speciesFor({ species: 'maple', cluster: 1 }, null)).toBe('maple');
    expect(speciesFor({ cluster: 1 }, null)).toBe(FLORA_DEFAULT[Math.floor(0) + FLORA_DEFAULT.indexOf(speciesFor({ cluster: 1 }, null))]);
    const plants = { form: 'blob', kinds: null, bushKinds: null, trees: [{ x: 0, y: 0, z: 0, h: 6, kind: -1, cluster: 0, species: 'beech' }, { x: 9, y: 0, z: 0, h: 9, kind: -1, cluster: 1, species: 'beech' }], bushes: [], shrubs: [] };
    const S = treeSizes(plants);
    expect(S.length).toBe(2);
    expect(S[1].h).toBeGreaterThan(S[0].h);
    for (const s of S) expect(s.r).toBeGreaterThan(0);
  });
});


describe('the hybrid crown (`crowns: hybrid`)', () => {
  it('draws a broadleaf\'s bundles each round its blob, or round big blobs (masses), within the budget it had; a needled crown as it was', () => {
    const beech = { form: 'blob', kinds: [{ form: 'spray' }], bushKinds: null, trees: [tree(0, 0, 9, 0)], bushes: [], shrubs: [] };
    const A = floraRead(beech, { kinds: beech.kinds, colours, bases }), B = floraRead({ ...beech, crowns: 'hybrid' }, { kinds: beech.kinds, colours, bases });
    const a = A.templates.find((t) => t.cross), b = B.templates.find((t) => t.cross);
    expect(a.core).toBeUndefined();
    expect(b.core).toBe(true);
    expect(b.budget.tris).toBeLessThanOrEqual(a.budget.tris);
    // (the mass crown: its big blobs round its branches, its bundles on them, for no more triangles than the plain crown)
    const C = floraRead({ ...beech, crowns: 'masses' }, { kinds: beech.kinds, colours, bases }), c = C.templates.find((t) => t.cross);
    expect(c.masses).toBe(true);
    expect(c.nBlobs).toBeGreaterThan(0);
    expect(c.budget.tris).toBeLessThanOrEqual(a.budget.tris);
    // (a needled crown takes no core)
    expect(JSON.stringify(floraRead({ ...plants(), crowns: 'hybrid' }, { kinds: plants().kinds, colours, bases }))).toBe(JSON.stringify(floraRead(plants(), { kinds: plants().kinds, colours, bases })));
  }, 120000);
});

describe('the realistic tree (`crowns: realistic`)', () => {
  it('grows its tree older, its crown clouds on its limbs\' sections for the triangles it had, its wood only what carries them, and asks its card full', () => {
    const beech = { form: 'blob', kinds: [{ form: 'spray' }], bushKinds: null, trees: [tree(0, 0, 9, 0)], bushes: [], shrubs: [] };
    const a = floraRead(beech, { kinds: beech.kinds, colours, bases }).templates.find((t) => t.cross);
    const r = floraRead({ ...beech, crowns: 'realistic' }, { kinds: beech.kinds, colours, bases }).templates.find((t) => t.cross);
    expect(REALISTIC.older).toBeGreaterThan(1);
    // (its mass: the major balls and their joining lobes, under its leaves, which are kept)
    expect(r.nBlobs).toBeGreaterThan(3);
    expect(r.leaves).toBeUndefined();
    expect(r.nClumps).toBeGreaterThan(0);
    expect(r.nClumps).toBeLessThanOrEqual(r.nBlobs);
    expect(r.budget.tris).toBeLessThanOrEqual(a.budget.tris);
    // (an oak too: older and branchier, still within its plain tree's triangles)
    const oak = { ...beech, kinds: [{ form: 'tuft' }] }, ao = floraRead(oak, { kinds: oak.kinds, colours, bases }).templates.find((t) => t.cross), ro = floraRead({ ...oak, crowns: 'realistic' }, { kinds: oak.kinds, colours, bases }).templates.find((t) => t.cross);
    expect(ro.budget.tris).toBeLessThanOrEqual(ao.budget.tris);
    // (a sparse plain tree, a cherry's: its puffs thinned to fit it, the clouds' tails given up first)
    const ch = { ...beech, kinds: [{ form: 'spray', species: 'cherry' }] }, ac = floraRead(ch, { kinds: ch.kinds, colours, bases }).templates.find((t) => t.kind === 'tree'), rc = floraRead({ ...ch, crowns: 'realistic' }, { kinds: ch.kinds, colours, bases }).templates.find((t) => t.kind === 'tree');
    expect(rc.budget.tris).toBeLessThanOrEqual(ac.budget.tris);
    // (its crown the clouds on its limbs: puffs, more of them than masses, each a coarse lobe)
    expect(r.blobGeo.length).toBe(PUFF.variants);
    expect(r.nBlobs).toBeGreaterThan(REALISTIC.cloud.k[0]);
    const woodTris = (t) => Buffer.from(t.wood.idx, 'base64').length / (t.wood.big ? 4 : 2) / 3;
    expect(woodTris(r)).toBeLessThan(woodTris(a));
    // (tall: its lowest limb or leaf out of a grown figure's reach on every tree placed, the small ones raised to it)
    expect(r.clear).toBeGreaterThan(0);
    const grove = { ...beech, crowns: 'realistic', trees: [tree(0, 0, 9, 0), tree(30, 0, 2, 0), tree(0, 30, 3, 0), tree(30, 30, 14, 0)] };
    const G = floraRead(grove, { kinds: grove.kinds, colours, bases }), GP = unpack(G.trees);
    expect(G.n).toBeGreaterThan(0);
    for (let i = 0; i < G.n; i++) { const T = G.templates[GP[i * FLORA_STRIDE + 11]]; if (T.clear) expect(T.clear * GP[i * FLORA_STRIDE + 3]).toBeGreaterThanOrEqual(REALISTIC.headroom - 1e-3); }
    // (far off its card full: the page bakes the mass under the leaves)
    expect(r.far).toEqual(REALISTIC.far);
    expect(a.far).toBeUndefined();
  }, 180000);
});

describe('the realistic habits', () => {
  it('gives each broadleaf in the library its habit; a kind names its species; a species with no masses keeps its plain tree', () => {
    // (every broadleaf the form render grows crossed has a row of its own, each read through habitOf)
    const broad = Object.keys(SPECIES).filter((k) => SPECIES[k].kind === 'tree' && !SPECIES[k].fig && !needleHabit(k));
    for (const k of broad) expect(REALISTIC_HABITS[k], k).toBeDefined();
    expect(habitOf('no-such-tree')).toBe(REALISTIC_HABITS.default);
    // (a kind's own species word reaches its habit: the same placed tree grows the named species)
    const at = (kind) => floraRead({ form: 'blob', kinds: [kind], bushKinds: null, trees: [tree(0, 0, 9, 0)], bushes: [], shrubs: [], crowns: 'realistic' }, { kinds: [kind], colours, bases }).templates.find((t) => t.kind === 'tree');
    expect(at({ form: 'spray', species: 'birch' }).name).toBe('birch');
    expect(at({ form: 'spray' }).name).toBe('beech');
  }, 240000);
});

describe('trees apart (`crowns`)', () => {
  it('keeps each crown clear of its neighbours\': a tree that would touch one shrunk until it clears, or left out', () => {
    // (a grove of beeches standing close: three a few metres apart, one far)
    const grove = { form: 'blob', kinds: [{ form: 'spray' }], bushKinds: null, trees: [tree(0, 0, 10, 0), tree(3, 0, 9, 0), tree(0, 3.5, 9.5, 0), tree(40, 0, 10, 0)], bushes: [], shrubs: [] };
    const F = floraRead({ ...grove, crowns: 'blobs' }, { kinds: grove.kinds, colours, bases }), P = unpack(F.trees), T = F.templates;
    const kept = Array.from({ length: F.n }, (_, i) => ({ x: P[i * FLORA_STRIDE], y: P[i * FLORA_STRIDE + 1], R: T[P[i * FLORA_STRIDE + 11]].crownR * P[i * FLORA_STRIDE + 3] }));
    expect(kept.length).toBeLessThan(4);
    expect(kept.some((k) => k.x === 40)).toBe(true);
    for (let i = 0; i < kept.length; i++) for (let j = 0; j < i; j++) expect(Math.hypot(kept[i].x - kept[j].x, kept[i].y - kept[j].y)).toBeGreaterThanOrEqual((kept[i].R + kept[j].R) * APART.gap - 1e-3);
    // (each major ball drawn as a crown's lobe: its variants, each its own shape, toned up, side and under)
    const t0 = T.find((t) => t.leaves === false);
    expect(t0.blobGeo.length).toBe(MASS_BLOB.lobe.variants);
    expect(new Set(t0.blobGeo.map((g) => g.p)).size).toBe(MASS_BLOB.lobe.variants);
    // (a plain crown's trees stand as placed)
    expect(floraRead(grove, { kinds: grove.kinds, colours, bases }).n).toBe(4);
  }, 180000);
});

describe('a realistic crown as flock (`crowns: realistic`, its `flock`)', () => {
  it('reads its setting: on by default, off by false, its leaves and its shadow', () => {
    expect(readFlock()).toEqual({ leaves: FLOCK.leaves, shadow: FLOCK.shadow });
    expect(readFlock(true)).toEqual(readFlock());
    expect(readFlock(false)).toBeNull();
    expect(readFlock({ shadow: 'none' })).toEqual({ leaves: FLOCK.leaves, shadow: 'none' });
    expect(readFlock({ leaves: false })).toMatchObject({ leaves: false });
    expect(() => readFlock({ shadow: 'dappled' })).toThrow(/flock.shadow/);
    expect(() => readFlock({ holes: 3 })).toThrow(/not a setting/);
    expect(() => readFlock('yes')).toThrow(/flock is/);
  });

  it('carries its species\' own leaf at the grower\'s length, never its stylized scale, its outline a table; a needled tree none', () => {
    const broad = speciesFor({ cluster: 0 }, { form: 'spray' });
    const L = flockLeaf(broad), A = ARCHITECTURES[SPECIES[broad].arch];
    expect(L.length).toBe(A.leafSize);
    expect(L.w.length).toBe(FLOCK_TABLE);
    expect(Math.max(...L.w)).toBeGreaterThan(0.1);
    expect(L.w[0]).toBeLessThan(Math.max(...L.w));
    expect(flockLeaf(broad)).toEqual(L);
    expect(flockLeaf('pine')).toBeNull();
  });

  it('gives each realistic template its leaf and the page its setting; none without it, or on any other crown', () => {
    const beech = { form: 'blob', kinds: [{ form: 'spray' }], bushKinds: null, trees: [tree(0, 0, 9, 0)], bushes: [], shrubs: [] };
    const read = (p) => floraRead(p, { kinds: beech.kinds, colours, bases });
    const on = read({ ...beech, crowns: 'realistic', flock: readFlock() }), real = on.templates.find((t) => t.far);
    expect(on.flock).toEqual(readFlock());
    expect(real.flock.leaf).toEqual(flockLeaf(real.name));
    expect(read({ ...beech, crowns: 'realistic', flock: readFlock({ leaves: false }) }).templates.find((t) => t.far).flock.leaf).toBeNull();
    // (absent, nothing of it: the realistic page as it was, and a hybrid crown ignores it)
    const off = read({ ...beech, crowns: 'realistic' });
    expect(off.flock).toBeUndefined();
    expect(off.templates.some((t) => t.flock)).toBe(false);
    expect(JSON.stringify(read({ ...beech, crowns: 'hybrid', flock: readFlock() }))).toBe(JSON.stringify(read({ ...beech, crowns: 'hybrid' })));
  }, 300000);

  it('stands a leafy bush as flock too: its puffs, its own leaf, its sponge finer; its clumps none; as it was without', () => {
    const shrub = { form: 'blob', kinds: null, bushKinds: null, trees: [], bushes: [], shrubs: [{ x: 3, y: 3, z: 0, h: 1.2 }] };
    const read = (p) => floraRead(p, { colours, bases });
    const B = read({ ...shrub, crowns: 'realistic', flock: readFlock() }).templates[0], H = BUSH_HABITS.spray;
    expect(B.kind).toBe('bush');
    expect(B.nBlobs).toBeGreaterThan(3);
    expect(B.nClumps).toBe(0);
    expect(B.flock).toEqual({ leaf: flockLeafOf(H.leaf), grain: H.flock.grain });
    expect(B.flockLeaf).toBeUndefined();
    expect(flockLeafOf(H.leaf).length).toBe(H.leaf.leafSize);
    const off = read({ ...shrub, crowns: 'realistic' });
    expect(off.templates[0].nBlobs).toBeUndefined();
    expect(off.templates[0].nClumps).toBeGreaterThan(0);
  });

  it('sheds each flock tree in the fall by its own turn, never past FLOCK.shed; none outside the fall', () => {
    const grove = { form: 'blob', kinds: [{ form: 'spray' }], bushKinds: null, trees: [tree(0, 0, 9, 0), tree(20, 3, 9, 0), tree(7, 31, 9, 0), tree(33, 27, 9, 0)], bushes: [], shrubs: [], crowns: 'realistic', flock: readFlock() };
    const F = floraRead(grove, { kinds: grove.kinds, colours, bases, autumn: 0.9 }), B = unpack(F.bare);
    expect(B.length).toBe(F.n);
    for (const v of B) { expect(v).toBeGreaterThan(0); expect(v).toBeLessThanOrEqual(FLOCK.shed + 1e-6); }
    expect(new Set([...B].map((v) => v.toFixed(3))).size).toBeGreaterThan(1);
    expect(floraRead(grove, { kinds: grove.kinds, colours, bases }).bare).toBeUndefined();
    expect(floraRead({ ...grove, flock: undefined }, { kinds: grove.kinds, colours, bases, autumn: 0.9 }).bare).toBeUndefined();
  }, 300000);

  it('grows a tree its scene gives a way one way: its reach ahead past its reach behind, turned to face it, at its scene\'s height', () => {
    const sp = 'cherry', at = (x, y, h, toward) => ({ x, y, z: 0, h, kind: -1, cluster: 0, species: sp, ...(toward !== undefined ? { toward } : {}) });
    const street = { form: 'blob', kinds: null, bushKinds: null, trees: [at(0, 0, 9, 1.2), at(30, 0, 9)], bushes: [], shrubs: [], crowns: 'realistic', apart: false };
    const F = floraRead(street, { colours, bases }), P = unpack(F.trees), Ts = [0, 1].map((i) => F.templates[P[i * FLORA_STRIDE + 11]]);
    expect(Ts[0].lean).toBe(true);
    expect(Ts[0].reach.front).toBeGreaterThan(Ts[0].reach.back);
    expect(Ts[1].lean).toBeUndefined();
    // (turned to face its way: the template's +x along `toward`)
    expect(P[4]).toBeCloseTo(1.2, 4);
    // (the scene's own height, raised only to its headroom; its room behind it, less than its crown's reach)
    const Z = treeSizes(street);
    expect(Z[0].back).toBeLessThan(Z[0].r);
    expect(Z[1].back).toBeUndefined();
    for (const [i, t] of street.trees.entries()) expect(Z[i].h).toBeGreaterThanOrEqual(t.h - 1e-6);
    // (no realistic crowns: no way grown, the way ignored)
    expect(floraRead({ ...street, crowns: undefined, apart: undefined }, { colours, bases }).templates.some((t) => t.lean)).toBe(false);
  }, 300000);

  it('draws a young tree its scene plants in the plain crown, airy as a sapling\'s, never grown one way', () => {
    const at = (x, young) => ({ x, y: 0, z: 0, h: 6, kind: -1, cluster: 0, species: 'cherry', toward: 0.5, ...(young ? { young: true } : {}) });
    const street = { form: 'blob', kinds: null, bushKinds: null, trees: [at(0, true), at(30, false)], bushes: [], shrubs: [], crowns: 'realistic', flock: readFlock(), apart: false };
    const F = floraRead(street, { colours, bases }), P = unpack(F.trees), [Y, O] = [0, 1].map((i) => F.templates[P[i * FLORA_STRIDE + 11]]);
    expect(Y.far).toBeUndefined();
    expect(Y.flock).toBeUndefined();
    expect(Y.lean).toBeUndefined();
    expect(O.far).toBeTruthy();
    expect(O.lean).toBe(true);
  }, 300000);
});
