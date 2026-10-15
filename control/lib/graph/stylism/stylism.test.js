// stylism.test.js — the stylism tuner (index.js): its words, what it resolves to, that the hero's own words win, that the
// register heightens monotonely, and that every choice is written down; then the silhouette solver on a dressed hero
// (silhouette.js): each outline reached, read back without the arms, with a blockout.
import { describe, expect, it } from 'vitest';
import { validateStylism, styledHero, stylismLedger, resolveStylism, REGISTER_WORDS, warpOf } from './index.js';
import { GENRES, GENRE_NAMES } from './genres.js';
import { OUTLINES, TECHNIQUES, silhouetteMoves, readSilhouette, blockoutSvg, silhouetteAdvice, outlineOf, islandsOf, cohesionAdvice } from './silhouette.js';
import { NAMED, NAMED_SILHOUETTES } from './silhouettes.js';
import { MATERIAL_SWATCHES } from './value.js';
import { detailMoves, DETAIL_ZONES, shownRoles } from './detail.js';
import { outfitLaws, COLOUR_GROUPS } from '../polygonizer/outfit-plan.js';
import { hexLch } from '../polygonizer/station-loft-shade.js';
import { heroRecord, heroPlanOf, planLayered, expandLayeredManifest, heroReadout } from '../../mcp/tools/layered.js';

const hero = (stylism, more = {}) => ({ cast: 'female', head: 'anime', stylism, ...more });

describe('the words', () => {
  it('refuses by name, takes words or numbers', () => {
    expect(validateStylism({ genre: 'fantasy', register: 'heroic', detail: 0.4, silhouette: 'wedge' })).toEqual([]);
    expect(validateStylism({ genre: 'western' })[0]).toMatch(/stylism.genre/);
    expect(validateStylism({ register: 'epic' })[0]).toMatch(/stylism.register: grounded \| storybook \| heroic \| mythic/);
    expect(validateStylism({ register: 1.5 })[0]).toMatch(/stylism.register/);
    expect(validateStylism({ silhouette: 'pear' })[0]).toMatch(/stylism.silhouette/);
    expect(validateStylism({ density: 1 })[0]).toMatch(/not a stylism word/);
    expect(validateStylism('heroic')[0]).toMatch(/stylism: \{/);
    expect(() => heroRecord(hero({ genre: 'western' }))).toThrow(/stylism.genre/);
  });
  it('every genre names a move for every outline, every named silhouette an outline and a signature; every move is a technique', () => {
    for (const g of GENRE_NAMES) for (const o of OUTLINES) {
      expect(GENRES[g].moves[o]?.length, `${g} ${o}`).toBeGreaterThan(0);
      for (const m of GENRES[g].moves[o]) expect(TECHNIQUES[m.technique], `${g} ${o} ${m.technique}`).toBeTypeOf('function');
    }
    for (const n of NAMED_SILHOUETTES) { expect(OUTLINES).toContain(NAMED[n].outline); expect(NAMED[n].moves.length).toBeGreaterThan(0);
      for (const m of NAMED[n].moves) expect(TECHNIQUES[m.technique], `${n} ${m.technique}`).toBeTypeOf('function'); }
    expect(validateStylism({ silhouette: 'sailor' })).toEqual([]);
    expect(validateStylism({ silhouette: 'pirate' })[0]).toMatch(/a named silhouette \(operative/);
  });
});

describe('what it resolves to', () => {
  it('absent: the hero itself, and no key in the record', () => {
    const h = { cast: 'female', head: 'anime', outfit: { type: 'outfit', style: 'casual' } };
    expect(styledHero(h)).toBe(h); expect(stylismLedger(h)).toBeNull();
    expect(heroRecord(h).stylism).toBeUndefined();
    expect(heroRecord(hero({ genre: 'modern' })).stylism).toEqual({ genre: 'modern', laws: 1 });
  });
  it('the genre\'s base card when the hero names no outfit; the moves as outfit language and catalogue pieces', () => {
    const o = styledHero(hero({ genre: 'fantasy', silhouette: 'wedge', register: 'heroic' })).outfit;
    expect(o.style).toBe(GENRES.fantasy.base.style);
    expect(o.pieces.map((p) => p.kind)).toEqual(['pauldron']);
    expect(o.language.bottom.cut).toBe('skinny');
    expect(styledHero(hero({ genre: 'scifi' })).outfit.language.top.fit).toBe('skin');   // the genre's base language
  });
  it('the hero\'s own words win: its language, its dials, a piece kind it wears; a word outfit is left alone', () => {
    const own = { type: 'outfit', style: 'office', dials: { stylize: 0.05 }, language: { bottom: { cut: 'wide' } }, pieces: [{ kind: 'pauldron', shoulder: 1 }] };
    const o = styledHero(hero({ genre: 'fantasy', silhouette: 'wedge', register: 'mythic' }, { outfit: own })).outfit;
    expect(o.style).toBe('office'); expect(o.dials.stylize).toBe(0.05); expect(o.language.bottom.cut).toBe('wide');
    expect(o.pieces).toEqual([{ kind: 'pauldron', shoulder: 1 }]);
    const word = hero({ genre: 'fantasy', silhouette: 'bell' }, { outfit: 'casual' });
    expect(styledHero(word)).toBe(word);
    expect(stylismLedger(word).notes.some((n) => /word or a garment list/.test(n.why))).toBe(true);
  });
  it('the register heightens together and monotonely: the outfit\'s stylize, an armour build\'s mass, the warp after the design', () => {
    const at = (register) => styledHero(hero({ genre: 'fantasy', silhouette: 'wedge', register }, { adorn: { type: 'armor', style: 'knight' } }));
    const R = Object.keys(REGISTER_WORDS).map(at), up = (xs) => xs.every((x, i) => i === 0 || x >= xs[i - 1]);
    expect(up(R.map((h) => h.outfit.dials.stylize))).toBe(true);
    expect(up(R.map((h) => h.adorn.dials.mass))).toBe(true);
    // the silhouette's sizes are the BASELINE at every register: the warp heightens after the design, from storybook up
    expect(new Set(Object.keys(REGISTER_WORDS).slice(1).map((w) => silhouetteMoves('fantasy', 'wedge', REGISTER_WORDS[w])[0].pieces[0].shoulder)).size).toBe(1);
    const warp = Object.keys(REGISTER_WORDS).map((w) => warpOf(REGISTER_WORDS[w], GENRES.fantasy).amount);
    expect(warp.slice(0, 2)).toEqual([0, 0]); expect(up(warp)).toBe(true); expect(warp[3]).toBe(1);
    const flare = (register) => styledHero(hero({ genre: 'fantasy', silhouette: 'bell', register })).outfit.pieces.find((p) => p.kind === 'cloak').flare;
    expect(flare('mythic')).toBeGreaterThan(flare('storybook')); expect(flare('mythic')).toBeLessThanOrEqual(flare('storybook') * GENRES.fantasy.warp.flare + 1e-9);
    expect(at('mythic').outfit.intent.distort).toMatchObject({ amount: 1, lean: false });
    // grounded draws the shoulders with cloth, heightened with armour
    expect(silhouetteMoves('fantasy', 'wedge', 0)[0].technique).toBe('mantle');
    expect(silhouetteMoves('fantasy', 'wedge', 1)[0].technique).toBe('pauldrons');
  });
  it('every move is written down with its principle; the same words, the same outfit and notes', () => {
    const h = hero({ genre: 'scifi', silhouette: 'barrel', register: 'mythic', detail: 'rich' }), L = stylismLedger(h);
    expect(L.silhouette.moves.length).toBeGreaterThan(0);
    for (const m of L.silhouette.moves) expect(L.notes.find((n) => n.technique === m && n.principle && n.why)).toBeTruthy();
    expect(L.notes[0].stage).toBe('register');
    expect(resolveStylism(h.stylism)).toEqual({ genre: 'scifi', r: 1, d: 0.7, silhouette: 'barrel' });
    expect(JSON.stringify(styledHero(h))).toBe(JSON.stringify(styledHero(JSON.parse(JSON.stringify(h)))));
  });
});

describe('the value stage\'s stand-in', () => {
  const hueGap = (a, b) => { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d); };
  it('local contrast and the complement: every role a clear step; the accent the dominant hue turned half the wheel', () => {
    // one genre with a chromatic card, one whose base card leads with its own hue
    for (const st of [{ genre: GENRE_NAMES[0], silhouette: OUTLINES[0] }, { genre: GENRE_NAMES[GENRE_NAMES.length - 1], silhouette: 'hourglass', register: 'mythic' }]) {
      const o = styledHero(hero(st)).outfit, P = o.intent.palette;
      expect(outfitLaws({ ...o, cut: undefined }).find((l) => l.law === 'clear value steps').ok, JSON.stringify(st)).toBe(true);
      const L = stylismLedger(hero(st)), base = hexLch(P.base), acc = hexLch(P.accent);
      expect(hueGap(base[2], acc[2]), 'the complement').toBeGreaterThan(150);
      expect(L.notes.find((n) => n.stage === 'value' && n.technique === 'stand-in palette').why).toMatch(/style guide/);
    }
  });
  it('the materials keep their own colour: the plate, the fittings and the straps are the genre\'s materials', () => {
    const g = GENRE_NAMES.find((x) => GENRES[x].moves.wedge.some((m) => m.technique === 'pauldrons' && m.from === undefined)) ?? GENRE_NAMES[0], o = styledHero(hero({ genre: g, silhouette: 'wedge', register: 'mythic' })).outfit, M = GENRES[g].materials;
    expect(o.intent.palette.metal).toBe(MATERIAL_SWATCHES[M.plate]); expect(o.intent.palette.leather).toBe(MATERIAL_SWATCHES[M.strap]);
    expect(M.fitting.map((m) => MATERIAL_SWATCHES[m])).toContain(o.intent.palette.trim);
    expect(o.pieces.find((p) => p.kind === 'pauldron').colour).toBe('metal');
  });
  it('what the hero says wins: its own roles and palette groups stand; no pieces, no palette', () => {
    const o = styledHero(hero({ silhouette: 'wedge', register: 'heroic' }, { palette: { [COLOUR_GROUPS.metal]: '#112233' }, outfit: { type: 'outfit', style: 'traveler', intent: { palette: { accent: '#ff0000' } } } })).outfit;
    expect(o.intent.palette.accent).toBe('#ff0000'); expect(o.intent.palette.metal).toBeUndefined();
    expect(styledHero(hero({ genre: 'fantasy' })).outfit.intent).toBeUndefined();
  });
});

describe('the detail solver', () => {
  const at = (st, detail) => styledHero(hero({ ...st, detail }));
  const L = (st, detail) => stylismLedger(hero({ ...st, detail }));
  // one case per procedure: the cloth's own roles (a wedge over trousers), a covered focal (the robe the bell wears)
  const cloth = { genre: GENRE_NAMES[0], silhouette: 'wedge', register: 'heroic' }, robed = { genre: GENRE_NAMES[0], silhouette: 'bell', register: 'heroic' };
  it('plain spends nothing beyond the construction; more detail never spends less', () => {
    const o = at(cloth, 'plain').outfit; expect(o.detail).toEqual([]); expect(o.dials.ornament).toBe(1);
    expect(o.pieces.filter((p) => !silhouetteMoves(GENRE_NAMES[0], 'wedge', REGISTER_WORDS.heroic).some((m) => (m.pieces || []).some((q) => q.kind === p.kind)))).toEqual([]);
    const spent = (w) => { const n = L(cloth, w).notes.find((x) => x.stage === 'detail' && /^budget/.test(x.technique)); return Number(/(\d+) spent/.exec(n.why)[1]); };
    const S = ['plain', 'considered', 'rich', 'ornate'].map(spent); expect(S.every((x, i) => i === 0 || x >= S[i - 1])).toBe(true); expect(S[3]).toBeGreaterThan(S[0]);
  });
  it('the hierarchy: the focal outweighs every other zone, within the budget, in one motif family', () => {
    for (const st of [cloth, robed]) for (const d of [0.35, 1]) {
      const o = at(st, d).outfit, D = detailMoves({ G: GENRES[GENRE_NAMES[0]], r: 0.7, d, outline: st.silhouette, language: { ...o.language }, pieces: [] });
      expect(D.spent.reduce((t, x) => t + x.cost, 0)).toBeLessThanOrEqual(D.budget);
      for (const z of DETAIL_ZONES) if (z !== D.focal) expect(D.weight[z], `${st.silhouette} ${d} ${z}`).toBeLessThan(D.weight[D.focal] || 1);
      const motifs = new Set([...o.detail.filter((x) => x.motif).map((x) => x.motif), ...o.pieces.filter((p) => p.trim?.motif).map((p) => p.trim.motif)]);
      expect(motifs.size, `${st.silhouette} ${d}`).toBeLessThanOrEqual(1);
    }
  });
  it('what shows: a robe buries the cloth\'s chest and hem, so the work goes on the robe\'s own trim; a second skin has no hem', () => {
    expect(shownRoles({ top: { family: 'woven', sleeve: 'long', hem: 'hip' }, bottom: { family: 'woven', leg: 'long' } }, [{ kind: 'robe' }]).has('chest')).toBe(false);
    expect(shownRoles({ top: { family: 'knit', sleeve: 'long', hem: 'hip' } }, [], 'anime').has('hem')).toBe(false);
    const robe = at(robed, 'rich').outfit.pieces.find((p) => ['robe', 'wizardRobe'].includes(p.kind));
    expect(Object.keys(robe.trim || {}).length, 'the robe carries the work').toBeGreaterThan(0);
  });
  it('the hero\'s own words win: its detail list, its ornament; focal and motif name the solver\'s picks', () => {
    const own = at({ ...cloth, focal: 'hem', motif: 'key' }, 'rich').outfit;
    expect(own.detail.every((x) => !x.motif || x.motif === 'key')).toBe(true);
    expect(L({ ...cloth, focal: 'hem' }, 'rich').notes.find((n) => /^budget/.test(n.technique)).where).toBe('the hem');
    const mine = styledHero(hero({ ...cloth, detail: 'ornate' }, { outfit: { type: 'outfit', style: 'traveler', detail: [], dials: { ornament: 0 } } })).outfit;
    expect(mine.detail).toEqual([]); expect(mine.dials.ornament).toBe(0);
    expect(validateStylism({ focal: 'knees' })[0]).toMatch(/stylism.focal/); expect(validateStylism({ motif: 'paisley' })[0]).toMatch(/stylism.motif/);
  });
});

describe('the silhouette solver on a dressed hero', () => {
  const dressed = (spec) => { const h = heroRecord(spec), ex = expandLayeredManifest({ kind: 'layered', title: 't', hero: h }), plan = heroPlanOf(h);
    const mesh = planLayered({ kind: 'layered', title: 't', recipe: ex.recipe, plan, hero: h, dials: ex.dials, units: 'm' }).mesh; return { h, plan, mesh, recipe: ex.recipe }; };
  // armour stays within the figure's width (armor/principles.js law 13): the shoulder-led letters (the wedge, the X) are
  // reached where the figure's own shoulders lead (the male cast); on the female they are misses the readout advises
  // (below), never forced by plate carried past her shoulders
  const castFor = (o) => (['wedge', 'hourglass'].includes(o) ? { cast: 'male' } : {});
  it('each outline is reached in one genre, read back without the arms', { timeout: 120000 }, () => {
    for (const o of OUTLINES) { const { mesh } = dressed(hero({ genre: 'fantasy', silhouette: o, register: 'heroic' }, castFor(o))); expect(readSilhouette(mesh).outline, o).toBe(o); }
  });
  it('a named silhouette reads as its outline: one card per outline letter, chosen in code', { timeout: 180000 }, () => {
    for (const o of OUTLINES) { const n = NAMED_SILHOUETTES.find((x) => NAMED[x].outline === o); if (!n) continue;
      const { mesh } = dressed(hero({ silhouette: n, register: 'heroic' }, castFor(o))); expect(readSilhouette(mesh).outline, `${n} (${o})`).toBe(outlineOf(n)); }
  });
  it('a named silhouette\'s stand-ins are said, its card\'s base worn, its type named in the notes; the detail sets how many bows', () => {
    const L = stylismLedger(hero({ silhouette: 'sailor' }));
    expect(L.silhouette.outline).toBe('bell'); expect(L.silhouette.approximated).toEqual(expect.arrayContaining(['sailor collar', 'pleats']));
    expect(L.notes.find((n) => n.technique === 'sailor').why).toMatch(/sailor uniform/);
    expect(styledHero(hero({ silhouette: 'sailor' })).outfit.style).toBe(NAMED.sailor.base);
    const bows = (detail) => styledHero(hero({ silhouette: 'idol', detail })).outfit.pieces.filter((p) => p.kind === 'bow').length;
    expect(bows('plain')).toBeLessThan(bows('ornate'));
  });
  it('the figure is ONE shape: a broad plate is seated on the shoulder; a detached genre\'s hovers, and says so', { timeout: 120000 }, () => {
    // the male's shoulder plates out past a broad arm line: the widest stand-off there is
    const seated = dressed({ cast: 'male', head: 'anime', stylism: { genre: 'fantasy', silhouette: 'wedge', register: 'mythic' } });
    const R = readSilhouette(seated.mesh);
    expect(R.floating).toEqual([]); expect(R.islands.front).toEqual([]); expect(R.cohesive).toBe(true);
    const S = heroReadout(seated.h, seated.plan, null, [], { mesh: seated.mesh, recipe: seated.recipe }).dress.stylism;
    expect(S.silhouette.read.cohesive).toBe(true); expect(S.notes.some((n) => n.technique === 'gaps')).toBe(false);
    const alien = dressed({ cast: 'male', head: 'anime', stylism: { genre: 'alien', silhouette: 'wedge', register: 'mythic' } });
    const A = readSilhouette(alien.mesh);
    expect(A.cohesive).toBe(false); expect(A.floating.map((f) => f.piece).sort()).toEqual(['pauldronL', 'pauldronR']);
    for (const f of A.floating) expect(f.gap).toBeGreaterThan(0.03);
    const L = heroReadout(alien.h, alien.plan, null, [], { mesh: alien.mesh, recipe: alien.recipe }).dress.stylism;
    expect(L.silhouette.detached).toBe(true); expect(L.notes.some((n) => n.technique === 'detached')).toBe(true);
    expect(L.notes.some((n) => n.technique === 'gaps')).toBe(false);   // the genre's own gap is not a fault
  });
  it('a gap in the outline: a mass apart counts, a seam and a speck do not; the advice names it', () => {
    // a figure the mask's size (96 rows, about a thousand pixels), a plate beside its shoulder
    const grid = (draw) => Array.from({ length: 96 }, (_, j) => Array.from({ length: 96 }, (_, i) => (draw(i, j) ? '1' : '0')).join(''));
    const body = (i, j) => i >= 40 && i <= 55 && j >= 4 && j <= 80, plate = (gap) => (i, j) => i >= 55 + gap + 1 && i <= 55 + gap + 8 && j >= 66 && j <= 74;
    expect(islandsOf(grid(body))).toEqual([]);
    expect(islandsOf(grid((i, j) => body(i, j) || plate(3)(i, j))).length).toBe(1);   // three pixels off
    expect(islandsOf(grid((i, j) => body(i, j) || plate(2)(i, j)))).toEqual([]);      // two: a seam
    expect(islandsOf(grid((i, j) => body(i, j) || (i === 70 && j === 20)))).toEqual([]);   // a speck
    expect(cohesionAdvice({ islands: { front: [0.09], side: [] }, floating: [{ piece: 'pauldronR', gap: 0.09 }] }).why).toMatch(/pauldronR hovers 9 cm .*front outline has 1 mass apart .*seat what floats/);
  });
  it('the readout carries the notes and the read; a miss is advised, never forced; the blockout is a sheet', { timeout: 120000 }, () => {
    const { h, plan, mesh, recipe } = dressed(hero({ genre: 'fantasy', silhouette: 'wedge', register: 'heroic' }, { cast: 'male' }));
    const S = heroReadout(h, plan, null, [], { mesh, recipe }).dress.stylism;
    expect(S.silhouette.read.outline).toBe('wedge'); expect(S.notes.some((n) => n.technique === 'read')).toBe(false);
    // the female's narrower shoulders, the plate held to them: the wedge is missed, and the readout says so
    const f = dressed(hero({ genre: 'fantasy', silhouette: 'wedge', register: 'heroic' })), F = heroReadout(f.h, f.plan, null, [], { mesh: f.mesh, recipe: f.recipe }).dress.stylism;
    expect(F.silhouette.read.outline).not.toBe('wedge'); expect(F.notes.some((n) => n.technique === 'read')).toBe(true);
    expect(silhouetteAdvice('barrel', { outline: 'wedge', widths: { low: 0.2, mid: 0.3, high: 0.4 } })).toMatch(/the shoulders lead; for a barrel, more in the middle/);
    // the detail lands on what is worn: no role it named is missing
    expect((heroReadout(h, plan, null, [], { mesh, recipe }).dress.outfit?.warnings || []).filter((w) => /^detail: no/.test(w))).toEqual([]);
    const svg = blockoutSvg(readSilhouette(mesh));
    expect(svg.startsWith('<svg')).toBe(true); expect((svg.match(/<path /g) || []).length).toBe(3);
  });
});
