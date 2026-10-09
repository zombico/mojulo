import { describe, it, expect } from 'vitest';
import { tunnelLand, composeLook, LOOK_LAWS } from './tunnel-land.js';
import { decompileKit, composeKit, rampFrom, luma, FACET_IDS } from '../era/look-facets.js';
import { ISEKAI_STYLES } from '../era/isekai.js';
import { isekaiTexels, LEAF_DIE_IDS } from '../era/isekai-tiles.js';
import { registerLook, lookOf } from '../era/style/looks.js';
import { assembleStageScene, stageKit } from '../era/stage.js';
import { natureCard, colorKey } from './nature.js';
import { structurePaint } from '../era/out-structures-paint.js';
import { resolveWorld } from './world.js';
import { gameworldGraph } from './graph.js';
import { gameworldBibleHtml } from './bible-html.js';
import { composeGameworld } from './compose.js';
import { HALDEN_REACH, MEADOWMARK } from './examples.js';
import { poleOf, materialOf } from '../era/style/pole.js';
import { FINISH_MATERIALS } from '../era/blocks.js';
import { collectBlendLayers } from '../scene/channels/blend-layer.js';

const FRONTIER = 'realism but stylized and detailed: a grounded frontier of rust plains, basalt cliffs, sparse lichen scrub, a gas giant in a pale sky, dusty, vast';

describe('look facets', () => {
  it('every written isekai card comes apart into its facets and goes back together as it was', () => {
    for (const [id, card] of Object.entries(ISEKAI_STYLES)) {
      const D = decompileKit(card);
      expect(Object.keys(D.facets), id).toEqual([...FACET_IDS]);
      expect(JSON.stringify(composeKit(D)), id).toBe(JSON.stringify(card));
    }
  });

  it('a ramp round a colour climbs from a coloured shadow to a pale light', () => {
    const r = rampFrom([168, 84, 54], 7);
    expect(r).toHaveLength(7);
    expect(r.every((c, i) => !i || luma(c) >= luma(r[i - 1]))).toBe(true);
    expect(luma(r[0])).toBeGreaterThan(14);
  });
});

describe('the land tunnel', () => {
  it('a frontier from words: the traits it reads, every law holding, the same look under the same id', () => {
    const r = tunnelLand(FRONTIER);
    expect(r.read.traits.map((t) => t.id)).toEqual(expect.arrayContaining(['realistic', 'grounded', 'stylized', 'detailed', 'sparse', 'grass-rust', 'rock-basalt', 'stone-basalt', 'foliage-lichen', 'gas-giant', 'sky-pale', 'hazy', 'vast']));
    expect(r.complete).toBe(true);
    const L = composeLook(FRONTIER);
    expect(L.id).toMatch(/^realism-stylized-detailed-[0-9a-f]{6}$/);
    expect(composeLook(FRONTIER).id).toBe(L.id);
    expect(lookOf(L.id)).toBeTruthy();
    expect(Object.values(L.swatches.land).every((ramp) => ramp.length === 7)).toBe(true);
    expect(L.card.boulder.minHat).toBe(99);
    expect(L.card.companion).toMatchObject({ size: 8 });
    expect(L.card.landform.joint).toBe(1.8);
    for (const l of LOOK_LAWS) expect(l.test(L).ok, l.law).toBe(true);
  });

  it('the tunnel tweaks what its laws find: the far layers pulled toward the sky, the sky lifted', () => {
    const r = tunnelLand('rust plains, grey hills, a dark sky');
    expect(r.passes[0].laws.failed.map((l) => l.law)).toEqual(expect.arrayContaining(['sky-brightest']));
    expect(r.passes.flatMap((p) => p.changed ?? []).join(' ')).toMatch(/sky/);
  });

  it('a look is a kit everywhere one is named: a stage in it, its natural world, its key, its buildings\' paint', () => {
    const L = composeLook(FRONTIER);
    expect(stageKit(L.id)).toEqual({ shell: 'isekai', style: L.id });
    const p = assembleStageScene({ kind: 'stage', kit: L.id, seed: 3 });
    expect(p.faces.length).toBeGreaterThan(1000);
    expect(p.sky).toMatchObject({ day: 1, moon: { size: 8, phase: 0.62 } });
    expect(p.haze.density).toBe(0.0035);
    expect(natureCard(L.id).sky.read).toMatch(/a world hanging 30° up in the day/);
    expect(colorKey(L.id).ramps.find((x) => x.name === 'rock').stops).toHaveLength(7);
    expect(structurePaint(L.id).kitId).toBe(L.id);
    expect(() => registerLook({ id: L.id, base: 'isekai-meadow', card: {}, swatches: {} })).toThrow(/another look already/);
  }, 60000);
});

describe('the realistic pole', () => {
  const RED = 'realistic red plains, granite cliffs, a clear sky';
  it('a realistic look draws its ground as material under light: three tiles round their ramps\' middles, pocketing holding', () => {
    const L = composeLook(RED);
    expect(L.card.ground).toMatchObject({ split: 2, cavity: 0.45 });
    for (const t of ['dirt', 'scree', 'packed']) expect(L.card.tiles[t], t).toBeTruthy();
    const n = L.swatches.land.grass.length, m = Math.floor((n - 1) / 2);
    expect(L.card.tiles.dirt.lit).toContain(m);
    expect(Math.min(...L.card.tiles.packed.lit)).toBeGreaterThan(Math.min(...L.card.tiles.dirt.lit));   // the trail a stop paler
    const law = LOOK_LAWS.find((l) => l.law === 'pocketing');
    expect(law.test(L).ok).toBe(true);
    expect(law.test(composeLook('green meadows, a blue sky')).value).toMatch(/banded/);
    for (const card of Object.values(ISEKAI_STYLES)) expect(card.ground).toBeUndefined();
  });

  it('the dirt tile: only its window\'s stops, the ramp\'s middle the most of it, a dark outline and lit grit present', () => {
    const L = composeLook(RED), T = L.card.tiles.dirt, ramp = L.swatches.land[T.ramp], t = isekaiTexels(`isekai:${L.id}:dirt-lit`);
    const share = new Map(); for (let i = 0; i < t.W * t.H; i++) { const k = `${t.rgb[i * 3]},${t.rgb[i * 3 + 1]},${t.rgb[i * 3 + 2]}`; share.set(k, (share.get(k) ?? 0) + 1 / (t.W * t.H)); }
    const at = (i) => share.get(ramp[i].join(',')) ?? 0, m = Math.floor((ramp.length - 1) / 2);
    expect([...share.keys()].every((k) => T.lit.some((i) => ramp[i].join(',') === k))).toBe(true);
    expect(at(m)).toBeGreaterThan(0.4);
    expect(at(Math.min(...T.lit))).toBeGreaterThan(0.03);
    expect(at(Math.max(...T.lit))).toBeGreaterThan(0.01);
  });

  it('the ground tile\'s variants join: a tile\'s band along an edge is that edge\'s type\'s alone, its interior its own', () => {
    const L = composeLook(RED), T = (v) => isekaiTexels(`isekai:${L.id}:dirt-lit~${v}`), W = 256, PX = 4;
    const col = (t, x) => Array.from({ length: W }, (_, y) => t.rgb[(y * W + x) * 3]).join(), row = (t, y) => Array.from(t.rgb.slice(y * W * 3, (y + 1) * W * 3)).join();
    // variants 2 and 3 share their right edge (type 1), differ on the left: the right band is the same, the left not
    expect(col(T(2), W - 1)).toBe(col(T(3), W - 1));
    expect(col(T(2), W - PX * 2)).toBe(col(T(3), W - PX * 2));
    expect(col(T(2), 0)).not.toBe(col(T(3), 0));
    // 4 and 0 share the top (bit 3 unset), differ on the bottom
    expect(row(T(4), 0)).toBe(row(T(0), 0));
    expect(row(T(4), W - 1)).not.toBe(row(T(0), W - 1));
    // each variant's interior is its own
    expect(row(T(5), W / 2)).not.toBe(row(T(9), W / 2));
    expect(isekaiTexels(`isekai:${L.id}:cliff-lit~3`)).toBeNull();
  });

  it('pocketing tweaks what fails: a dim key against a bright sky deepens the shade', () => {
    const r = tunnelLand('realistic red plains, a dim red sun');
    const fails = r.passes.flatMap((p) => p.laws?.failed ?? []).filter((l) => l.law === 'pocketing');
    if (fails.length) expect(r.passes.flatMap((p) => p.changed ?? []).join(' ')).toMatch(/fill taken down|window a stop wider/);
    expect(r.complete).toBe(true);
  });

  it('its stage: every bare ground cell is a lit material face, the shadow split on its edge; the same page per seed', () => {
    const L = composeLook(RED);
    const a = assembleStageScene({ kind: 'stage', kit: L.id, seed: 5 });
    const ground = a.faces.filter((f) => /:(dirt|scree|packed)-lit(~\d+)?$/.test(f.texture || ''));
    expect(new Set(ground.map((f) => f.texture).filter((k) => /dirt-lit~/.test(k))).size).toBeGreaterThan(8);   // the joining variants, laid by their edges
    expect(ground.length).toBeGreaterThan(5000);
    expect(ground.every((f) => f.textureLit && f.cornerFills?.length === 4)).toBe(true);
    expect(a.faces.some((f) => f.group === 'isekai:ground' && !f.texture && f.cornerFills)).toBe(false);
    // split cells: pieces smaller than the grid's
    const span = (f) => Math.hypot(f.corners[1][0] - f.corners[0][0], f.corners[1][1] - f.corners[0][1]);
    expect(Math.min(...ground.map(span))).toBeLessThan(Math.max(...ground.map(span)) / 3);
    expect(JSON.stringify(assembleStageScene({ kind: 'stage', kit: L.id, seed: 5 }).faces.slice(-200))).toBe(JSON.stringify(a.faces.slice(-200)));
  }, 60000);
});

describe('the pole cascades: decided at the look, drawn by everything', () => {
  it('a realistic look is on the material pole; every written kit is banded; materials come from ramps and finishes', () => {
    expect(poleOf(composeLook('realistic red plains, granite cliffs, a clear sky').id)).toBe('material');
    for (const id of Object.keys(ISEKAI_STYLES)) expect(poleOf(id), id).toBe('banded');
    expect([materialOf('stone'), materialOf('rock'), materialOf('timber'), materialOf('foliage'), materialOf('soil'), materialOf('paint'), materialOf('lens')]).toEqual(['stone', 'rockface', 'grain', 'leaf', 'dirt', null, null]);
    expect(FINISH_MATERIALS.alloy['tech:body']).toBe('metal');
  });

  it('the Halden bible: houses, machines, the castle, the land and the towns all drawn in their materials; a banded world in none', () => {
    const a = gameworldBibleHtml(HALDEN_REACH), plate = (id) => { const i = a.indexOf(`<!--plate:${id}-->`); return a.slice(i, a.indexOf('</svg>', i)); };
    const ids = [...a.matchAll(/<!--plate:((?:house|civ-castle|civ-thing|land|town)-[a-z0-9-]+)-->/g)].map((m) => m[1]);
    expect(ids.length).toBeGreaterThan(15);
    // (the sky is the air's: the cloud plate stays flat on either pole)
    for (const id of ids.filter((x) => !/-cloud$/.test(x))) expect(plate(id), id).toMatch(/<pattern id="m-[a-z]+-/);
    expect(plate(ids.find((x) => /-cloud$/.test(x)))).not.toMatch(/<pattern/);
    expect(plate('civ-thing-survey-corps-hauler')).toMatch(/m-metal-/);
    expect(a).toMatch(/<pattern id="m-canopy-cleft\d/);   // its foliage the scrub's cleft leaves
    expect(gameworldBibleHtml(MEADOWMARK)).not.toMatch(/<pattern id="m-/);
  }, 120000);

  it('its stage: cliffs, rocks, grass and trees are texel × light — no banded tile, no locked colour on them', () => {
    const L = composeLook('realistic red plains, granite cliffs, a clear sky'), p = assembleStageScene({ kind: 'stage', kit: L.id, seed: 5 });
    const tiled = p.faces.filter((f) => /^isekai:/.test(f.texture || '') && !/:(cumulus|rim|creep)-/.test(f.texture));
    expect(tiled.length).toBeGreaterThan(5000);
    expect(tiled.every((f) => f.textureLit && /-(lit(~\d+)?|b\d)$/.test(f.texture))).toBe(true);   // (a canopy's skin by its band of light)
    for (const g of ['isekai:cliff', 'isekai:rock', 'isekai:wood']) expect(p.faces.filter((f) => f.group === g).every((f) => f.textureLit), g).toBe(true);
    // the trees' crowns are leaf; the far ridges' clumps (past the far ring, the air's) stay flat, all of them beyond
    const G = p.faces.filter((f) => /:dirt-/.test(f.texture || '')).flatMap((f) => f.corners), [x0, x1, y0, y1] = [Math.min(...G.map((c) => c[0])), Math.max(...G.map((c) => c[0])), Math.min(...G.map((c) => c[1])), Math.max(...G.map((c) => c[1]))];
    const mid = (f) => [0, 1].map((k) => f.corners.reduce((a, c) => a + c[k], 0) / f.corners.length), crowns = p.faces.filter((f) => f.group === 'isekai:crown');
    expect(crowns.filter((f) => f.textureLit).length).toBeGreaterThan(1000);
    expect(crowns.filter((f) => !f.textureLit).every((f) => { const [x, y] = mid(f); return x < x0 || x > x1 || y < y0 || y > y1; })).toBe(true);
  }, 60000);
});

describe('the realism palette and its patches', () => {
  const RED = 'realistic red plains, granite cliffs, a clear sky';
  it('its rock is drawn real: the cliff as strata, the rock a rock face, no grass hats, lit smooth corner by corner, the sky\'s fill near grey', () => {
    const L = composeLook(RED);
    expect([L.card.tiles.cliff.paint, L.card.tiles.rock.paint, L.card.boulder.minHat]).toEqual(['strata', 'rockface', 99]);
    expect(LOOK_LAWS.find((l) => l.law === 'sky-fill').test(L).ok).toBe(true);
    const p = assembleStageScene({ kind: 'stage', kit: L.id, seed: 5 }), rock = p.faces.filter((f) => f.group === 'isekai:rock' || f.group === 'isekai:cliff');
    expect(rock.every((f) => f.cornerFills?.length === f.corners.length)).toBe(true);
    expect(rock.filter((f) => new Set(f.cornerFills).size > 1).length).toBeGreaterThan(rock.length / 3);   // smooth: corners differ
    expect(p.faces.some((f) => /:hat-/.test(f.texture || ''))).toBe(false);
  }, 60000);

  it('leaves: a die by what grows; its skin swaps figure and ground as the light falls; crowns banded, their edges leaf cards', () => {
    expect(LEAF_DIE_IDS).toEqual(expect.arrayContaining(['oval', 'lance', 'cleft', 'lobed', 'needle']));
    const O = composeLook('realistic green hills, oak trees, granite cliffs, a clear sky');
    expect([O.card.trees.die, composeLook('realism but stylized and detailed: a grounded frontier of rust plains, basalt cliffs, sparse lichen scrub, a gas giant in a pale sky, dusty, vast').card.trees.die]).toEqual(['lobed', 'cleft']);
    // the lit band a light ground with dark leaves, the deep shade a dark ground with light ones
    const stops = O.card.tiles.canopy.lit.map((i) => O.swatches.land.foliage[i]), mid = Math.floor((stops.length - 1) / 2);
    const share = (b, k) => { const t = isekaiTexels(`isekai:${O.id}:canopy-b${b}`), c = stops[k].join(','); let n = 0; for (let i = 0; i < t.W * t.H; i++) if (`${t.rgb[i * 3]},${t.rgb[i * 3 + 1]},${t.rgb[i * 3 + 2]}` === c) n++; return n / (t.W * t.H); };
    expect(share(0, mid + 1)).toBeGreaterThan(0.6);
    expect(share(3, mid - 1)).toBeGreaterThan(0.6);
    expect(share(1, mid + 1)).toBeLessThan(share(0, mid + 1));
    const p = assembleStageScene({ kind: 'stage', kit: O.id, seed: 5 });
    const crowns = p.faces.filter((f) => f.group === 'isekai:crown' && f.textureLit);
    expect(new Set(crowns.map((f) => f.texture.slice(-2))).size).toBeGreaterThanOrEqual(3);
    const cards = p.faces.filter((f) => f.group === 'isekai:leaves');
    expect(cards.length).toBeGreaterThan(200);
    expect(cards.every((f) => /:leafcard-b\d$/.test(f.texture) && p.cutouts.includes(f.texture))).toBe(true);
  }, 60000);

  it('a realistic look\'s ramps read real: one hue, muted, low-middle, one family — made so by the tunnel; banded looks stand aside', () => {
    const r = tunnelLand(RED), laws = ['hue-steady', 'chroma-ceiling', 'albedo-band', 'one-family'];
    expect(r.passes.flatMap((p) => p.changed ?? []).join(' ')).toMatch(/made real/);
    const L = composeLook(RED);
    for (const law of laws) expect(LOOK_LAWS.find((l) => l.law === law).test(L).ok, law).toBe(true);
    const M = composeLook('green meadows, a blue sky');
    for (const law of laws) expect(LOOK_LAWS.find((l) => l.law === law).test(M).value, law).toMatch(/banded/);
  });

  it('patches lie by cause, alpha-tested, compact on the page: trodden by the trail, fines in hollows', () => {
    const L = composeLook(RED), p = assembleStageScene({ kind: 'stage', kit: L.id, seed: 5 });
    const pt = p.faces.filter((f) => f.group === 'isekai:patch');
    expect(new Set(pt.map((f) => f.texture.split(':').pop()))).toEqual(new Set(['fines-lit', 'gravel-lit', 'dust-lit', 'crust-lit', 'trodden-lit']));
    expect(pt.every((f) => f.blend === 'cut' && f.cornerAlpha.some((a) => a >= 0.5) && f.uvScale > 0)).toBe(true);
    const t = isekaiTexels(`isekai:${L.id}:fines-lit`);
    expect(Math.min(...t.a)).toBeGreaterThan(127);   // every texel passes at full weight
    const layers = collectBlendLayers(pt);
    expect(layers.every((l) => l.cut && l.c8 && !l.uv)).toBe(true);
  }, 60000);
});

describe('a frontier world, through every tunnel', () => {
  it('Halden Reach: its look, its civilizations\' languages and machines, all tunnelled from words', () => {
    const { world: G, levels } = resolveWorld(HALDEN_REACH);
    expect(G.style.kit).toMatch(/^halden-reach-[0-9a-f]{6}$/);
    expect(levels.every((R) => R.style.kit === G.style.kit)).toBe(true);
    const S = G.civilizations['survey-corps'], D = G.civilizations['dome-growers'];
    expect(S.anchor.id).toBe('modular-sci-fi-habitat');
    expect(S.tunnel.complete).toBe(true);
    expect(S.fittings.map((m) => m.block)).toEqual(['status-light', 'roof-mast', 'solar-wing']);
    expect(Object.fromEntries(Object.entries(S.technology.things).map(([k, t]) => [k, t.block.tier]))).toEqual({ hauler: 'machine', relay: 'machine', array: 'installation', scanner: 'tool', fabricator: 'automation' });
    expect(D.from).toBe('shell');
    expect(Object.values({ ...S.technology.things, ...D.technology.things }).every((t) => t.tunnel.complete)).toBe(true);
    const g = gameworldGraph(HALDEN_REACH);
    expect(g.edges.filter((e) => e.kind === 'makes')).toHaveLength(8);
  }, 60000);

  it('its bible is the same page every time and shows each tunnel\'s work', () => {
    const a = gameworldBibleHtml(HALDEN_REACH);
    expect(a).toBe(gameworldBibleHtml(HALDEN_REACH));
    for (const id of ['civ-tunnel-survey-corps', 'civ-tunnel-dome-growers', 'civ-thing-survey-corps-fabricator', 'civ-thing-dome-growers-loader']) expect(a).toContain(`<!--plate:${id}-->`);
    expect(a).toContain('Tunnelled from its words');
  }, 120000);

  it('autonomous: a prompt runs all three tunnels', () => {
    const W = composeGameworld({ prompt: 'a stylized but grounded sci-fi frontier: rust plains, basalt cliffs, a gas giant in a pale sky, modular habitats with comms masts, tracked haulers and solar arrays', seed: 4 });
    expect(W.style.look).toMatch(/^a stylized/);
    expect(Object.keys(W.civilizations)).toEqual(['habitat-folk']);
    expect(W.civilizations['habitat-folk'].technology.things).toEqual({ hauler: 'tracked haulers', solar: 'solar arrays' });
    expect(W.brief.unread).toEqual([]);
    const { world: G } = resolveWorld(W);
    expect(G.civilizations['habitat-folk'].tunnel.complete).toBe(true);
  }, 60000);
});
