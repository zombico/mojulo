// stylism.test.js — the stylism tuner (index.js): its words, what it resolves to, that the hero's own words win, that the
// register heightens monotonely, and that every choice is written down; then the silhouette solver on a dressed hero
// (silhouette.js): each outline reached, read back without the arms, with a blockout.
import { describe, expect, it } from 'vitest';
import { validateStylism, styledHero, stylismLedger, resolveStylism, REGISTER_WORDS } from './index.js';
import { GENRES, GENRE_NAMES } from './genres.js';
import { OUTLINES, TECHNIQUES, silhouetteMoves, readSilhouette, blockoutSvg, silhouetteAdvice, outlineOf } from './silhouette.js';
import { NAMED, NAMED_SILHOUETTES } from './silhouettes.js';
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
  it('the register heightens together and monotonely: the outfit\'s stylize, the breakers\' size, an armour build\'s mass', () => {
    const at = (register) => styledHero(hero({ genre: 'fantasy', silhouette: 'wedge', register }, { adorn: { type: 'armor', style: 'knight' } }));
    const R = Object.keys(REGISTER_WORDS).map(at), up = (xs) => xs.every((x, i) => i === 0 || x >= xs[i - 1]);
    expect(up(R.map((h) => h.outfit.dials.stylize))).toBe(true);
    expect(up(R.map((h) => h.adorn.dials.mass))).toBe(true);
    expect(up(Object.keys(REGISTER_WORDS).slice(1).map((w) => silhouetteMoves('fantasy', 'wedge', REGISTER_WORDS[w])[0].pieces[0].shoulder))).toBe(true);
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

describe('the silhouette solver on a dressed hero', () => {
  const dressed = (spec) => { const h = heroRecord(spec), ex = expandLayeredManifest({ kind: 'layered', title: 't', hero: h }), plan = heroPlanOf(h);
    const mesh = planLayered({ kind: 'layered', title: 't', recipe: ex.recipe, plan, hero: h, dials: ex.dials, units: 'm' }).mesh; return { h, plan, mesh, recipe: ex.recipe }; };
  it('each outline is reached in one genre, read back without the arms', { timeout: 120000 }, () => {
    for (const o of OUTLINES) { const { mesh } = dressed(hero({ genre: 'fantasy', silhouette: o, register: 'heroic' })); expect(readSilhouette(mesh).outline, o).toBe(o); }
  });
  it('a named silhouette reads as its outline: one card per outline letter, chosen in code', { timeout: 180000 }, () => {
    for (const o of OUTLINES) { const n = NAMED_SILHOUETTES.find((x) => NAMED[x].outline === o); if (!n) continue;
      const { mesh } = dressed(hero({ silhouette: n, register: 'heroic' })); expect(readSilhouette(mesh).outline, `${n} (${o})`).toBe(outlineOf(n)); }
  });
  it('a named silhouette\'s stand-ins are said, its card\'s base worn, its type named in the notes; the detail sets how many bows', () => {
    const L = stylismLedger(hero({ silhouette: 'sailor' }));
    expect(L.silhouette.outline).toBe('bell'); expect(L.silhouette.approximated).toEqual(expect.arrayContaining(['sailor collar', 'pleats']));
    expect(L.notes.find((n) => n.technique === 'sailor').why).toMatch(/sailor uniform/);
    expect(styledHero(hero({ silhouette: 'sailor' })).outfit.style).toBe(NAMED.sailor.base);
    const bows = (detail) => styledHero(hero({ silhouette: 'idol', detail })).outfit.pieces.filter((p) => p.kind === 'bow').length;
    expect(bows('plain')).toBeLessThan(bows('ornate'));
  });
  it('the readout carries the notes and the read; a miss is advised, never forced; the blockout is a sheet', { timeout: 120000 }, () => {
    const { h, plan, mesh, recipe } = dressed(hero({ genre: 'fantasy', silhouette: 'wedge', register: 'heroic' }));
    const S = heroReadout(h, plan, null, [], { mesh, recipe }).dress.stylism;
    expect(S.silhouette.read.outline).toBe('wedge'); expect(S.notes.some((n) => n.technique === 'read')).toBe(false);
    expect(silhouetteAdvice('barrel', { outline: 'wedge', widths: { low: 0.2, mid: 0.3, high: 0.4 } })).toMatch(/the shoulders lead; for a barrel, more in the middle/);
    const svg = blockoutSvg(readSilhouette(mesh));
    expect(svg.startsWith('<svg')).toBe(true); expect((svg.match(/<path /g) || []).length).toBe(3);
  });
});
