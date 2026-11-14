// PROTAGONISTS BY GENRE (hero-rows.js): a hero designed at the eyes gate is a row; a game of that genre laid from a
// sentence opens on it, and a creator's own pages take it away. And the row's outfit as the hero door builds it: the
// clothing words it is made of, each on its concept (outfit-plan.js, body-garment.js, outfit/styles.js).
import { describe, it, expect } from 'vitest';
import { GENRE_HERO, genreHero } from './hero-rows.js';
import { heroDesign } from './hero-design.js';
import { composeGameworld } from './compose.js';
import { readGameworld } from './world.js';
import { GENRES } from './intent.js';
import { LOOKS_ELEMENTS } from './characters.js';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { validateOutfitCard, PANEL_HEMS } from '../outfit/styles.js';
import { OUTFIT_KIND_NAMES } from '../polygonizer/outfit-plan.js';

const [genre, row] = Object.entries(GENRE_HERO)[0];
const outfitOf = (pieces, language = row.looks.underlayer.style.language) => expandLayeredManifest({ kind: 'layered', title: 't', hero: heroRecord({ cast: 'female', head: 'anime',
  outfit: { ...structuredClone(row.looks.underlayer), style: { ...structuredClone(row.looks.underlayer.style), language: structuredClone(language) }, pieces: structuredClone(pieces) } }) });

describe('a genre\'s protagonist, a row', () => {
  it('names a real genre, its pages the looks\' own, its pieces the outfit\'s kinds', () => {
    for (const [g, r] of Object.entries(GENRE_HERO)) {
      expect(GENRES[g], g).toBeTruthy();
      for (const [page, v] of Object.entries(r.looks)) for (const f of Object.keys(v)) if (LOOKS_ELEMENTS[page]) expect(LOOKS_ELEMENTS[page].fields, `${g} ${page}.${f}`).toContain(f);
      for (const p of r.looks.underlayer.pieces) expect(OUTFIT_KIND_NAMES, `${g}: ${p.kind}`).toContain(p.kind);
      expect(r.says && r.reads.length).toBeTruthy();
    }
  });

  it('is the hero of a game of its genre laid from a sentence; pages a creator wrote are theirs', () => {
    const W = composeGameworld({ prompt: `a ${GENRES[genre].words[0]}`, seed: 3 });
    expect(W.brief.hero.genre).toBe(genre);
    expect(W.characters.hero.looks).toEqual(row.looks);
    expect(W.brief.hero.design.roll).toEqual({ row: row.id });
    expect(W.brief.hero.design.garment).toBe(row.garment);
    const G = readGameworld(W);
    expect(genreHero(G)).toBe(row);
    // (its pages are the game's now: nothing more to design; taken away, the row is offered again)
    expect(heroDesign(G)).toBeNull();
    const { looks: _l, ...bare } = W.characters.hero, again = heroDesign(readGameworld({ ...W, characters: { ...W.characters, hero: bare } }));
    expect(again.looks).toEqual(row.looks);
    expect(again.looks).not.toBe(row.looks);
    // (a genre with no row is rolled as before)
    const other = Object.keys(GENRES).find((g) => !GENRE_HERO[g] && (() => { try { const w = composeGameworld({ prompt: `a ${GENRES[g].words[0]}`, seed: 3 }); return w.brief.hero?.genre === g && !!w.brief.hero?.design; } catch { return false; } })());
    if (other) expect(composeGameworld({ prompt: `a ${GENRES[other].words[0]}`, seed: 3 }).brief.hero.design.roll.row).toBeUndefined();
  });
});

describe('the clothing words the row is made of', () => {
  const M = outfitOf(row.looks.underlayer.pieces), parts = M.recipe.parts, adorn = M.plan.adorn.map((a) => a.id);
  const zOf = (st, slot) => st.points[slot][2];

  it('a panel ends as a petal where asked: its corners drawn up, its middle the longest; unasked, a level hem', () => {
    expect(PANEL_HEMS).toContain(row.looks.underlayer.style.language.panels[0].hem);
    const hem = parts.panel0_panel.stations.at(-1), top = parts.panel0_panel.stations[0];
    expect(zOf(hem, 'p0')).toBeGreaterThan(zOf(hem, 'p4R') + 0.05);
    expect(zOf(hem, 'p8R')).toBeCloseTo(zOf(hem, 'p0'), 6);
    expect(zOf(top, 'p0')).toBeCloseTo(zOf(top, 'p4R'), 6);
    const L = row.looks.underlayer.style.language, level = outfitOf(row.looks.underlayer.pieces, { ...L, panels: L.panels.map(({ hem: _h, ...q }) => q) }).recipe.parts.panel0_panel.stations.at(-1);
    expect(zOf(level, 'p0')).toBeCloseTo(zOf(level, 'p4R'), 6);
    expect(validateOutfitCard({ id: 'designed', language: { ...L, panels: [{ at: 'front', length: 'mini', hem: 'scalloped' }] } }).join(' ')).toMatch(/panels\[0\]\.hem/);
    expect(validateOutfitCard({ id: 'designed', language: L }).join(' ')).not.toMatch(/hem: one of/);
  });

  it('a cloak\'s lining is its own inner face in another colour, off the arms where it says; its hem may be a place between the words', () => {
    // (one cloth: a second cape inside the first crossed it wherever the figure moved)
    expect(parts.cloakLining_cape).toBeUndefined();
    expect(parts.cloak_cape.mirrorGroup).toBeTruthy();
    expect(parts.cloak_cape.mirrorGroup).not.toBe(parts.cloak_cape.group);
    // (`arms: false`: no point of it is carried by an arm)
    expect(Object.values(parts.cloak_cape.bind.blend).some((b) => Object.keys(b).some((bone) => /Arm/.test(bone)))).toBe(false);
    expect(Object.values(outfitOf([{ kind: 'cloak', hem: 'hip' }]).recipe.parts.cloak_cape.bind.blend).some((b) => Object.keys(b).some((bone) => /Arm/.test(bone)))).toBe(true);
    const plain = outfitOf([{ kind: 'cloak', hem: 'hip' }]).recipe.parts;
    expect(plain.cloak_cape.mirrorGroup).toBeUndefined();
    const low = (P) => Math.min(...Object.values(P.stations.at(-1).points).map((p) => p[2]));
    expect(low(parts.cloak_cape)).toBeLessThan(low(plain.cloak_cape));
  });

  it('bands cross the front only, a half each side of the centre; a crest is a plaque and its gem on the centre line at the waist', () => {
    const bands = M.plan.adorn.filter((a) => /^band\d[RL]$/.test(a.id));
    expect(bands.map((a) => a.id)).toEqual(['band1R', 'band1L', 'band2R', 'band2L']);
    for (const b of bands) { expect(b.t[0]).toBe(0); expect(b.t[1]).toBeLessThan(2); expect(b.part).toBe('torso'); }
    expect(bands[2].s[0]).toBeGreaterThan(bands[0].s[1]);
    const crest = M.plan.adorn.find((a) => a.id === 'crest'), gem = M.plan.adorn.find((a) => a.id === 'crestGem');
    expect(crest.signature.c[0]).toBe(0);
    expect(gem.signature.c[0]).toBe(0);
    expect(gem.signature.r).toBeLessThan(crest.signature.r);
    expect(gem.signature.c[1]).toBeGreaterThan(crest.signature.c[1]);
    expect(gem.group).not.toBe(crest.group);
    // (on the breast, off the centre line, where no place is asked)
    const breast = outfitOf([{ kind: 'crest' }]).plan.adorn.find((a) => a.id === 'crest');
    expect(breast.signature.c[0]).not.toBe(0);
    expect(breast.signature.c[2]).toBeGreaterThan(crest.signature.c[2]);
  });

  it('a waist belt carries one pouch at its front, no buckle of its own; a midriff is the legs\' cloth on the belly', () => {
    expect(adorn).toContain('pouchesBelt');
    expect(adorn.filter((id) => /^pouches(?!Belt)/.test(id))).toEqual(['pouchesFront']);
    const pouch = M.plan.adorn.find((a) => a.id === 'pouchesFront'), belt = M.plan.adorn.find((a) => a.id === 'pouchesBelt');
    expect(pouch.part).toBe('torso');
    expect(pouch.t[1]).toBeLessThan(1.5);
    expect(belt.signature.kind).not.toBe('buckle');
    // (the same belt with its pouches round it stands them clear of the centre; one alone at the back is behind)
    const four = outfitOf([{ kind: 'pouches', at: 'waist', on: 'torso' }]).plan.adorn.filter((a) => /^pouches[RL]\d$/.test(a.id));
    expect(four).toHaveLength(4);
    expect(Math.min(...four.map((a) => a.t[0]))).toBeGreaterThan(0.3);
    const back = outfitOf([{ kind: 'pouches', at: 'waist', on: 'torso', count: 1 }]).plan.adorn.find((a) => a.id === 'pouchesBack');
    expect(back.t[0]).toBeGreaterThan(3);
    expect(M.plan.paint).toContainEqual({ part: 'torso', u: [0, 2.6], group: 'Bottom' });
  });

  it('a plain guard on each shoulder, a rim on each boot: the pieces\' own words', () => {
    expect(adorn.filter((id) => /^pauldron/.test(id))).toEqual(['pauldronR', 'pauldronL']);
    expect(M.plan.adorn.find((a) => a.id === 'pauldronR').rim).toBeUndefined();
    const rim = M.plan.adorn.find((a) => a.id === 'bootRimR'), ank = M.plan.adorn.find((a) => a.id === 'ankletR');
    expect(rim.part).toBe(ank.part);
    expect(rim.s[1]).toBeLessThan(ank.s[0]);
  });
});
