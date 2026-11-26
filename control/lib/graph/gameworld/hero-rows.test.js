// PROTAGONISTS BY GENRE (hero-rows.js): a hero designed at the eyes gate is a row; a game of that genre laid from a
// sentence opens on it, and a creator's own pages take it away. And the row's outfit as the hero door builds it: the
// clothing words it is made of, each on its concept (outfit-plan.js, body-garment.js, outfit/styles.js).
import { describe, it, expect } from 'vitest';
import { GENRE_HERO, genreHero, rowGaits, carriedBlade, rowFoe } from './hero-rows.js';
import { arsenalOfGame } from './arsenal.js';
import { sheetAudio, STEP_GAIN } from './sound-sheet.js';
import { heroDesign } from './hero-design.js';
import { composeGameworld } from './compose.js';
import { gameStages } from './levels.js';
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

  it('bands cross the front only, a half each side of the centre; a crest at the waist is a plaque and its gem on the centre line', () => {
    const bands = M.plan.adorn.filter((a) => /^band\d[RL]$/.test(a.id));
    expect(bands.map((a) => a.id)).toEqual(['band1R', 'band1L', 'band2R', 'band2L']);
    for (const b of bands) { expect(b.t[0]).toBe(0); expect(b.t[1]).toBeLessThan(2); expect(b.part).toBe('torso'); }
    expect(bands[2].s[0]).toBeGreaterThan(bands[0].s[1]);
    const W = outfitOf([{ kind: 'crest', at: 'waist' }]).plan.adorn, crest = W.find((a) => a.id === 'crest'), gem = W.find((a) => a.id === 'crestGem');
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
    const one = outfitOf([{ kind: 'pouches', at: 'waist', on: 'torso', count: 1, front: true, buckle: false, drop: 0.35 }]).plan.adorn, ids = one.map((a) => a.id);
    expect(ids).toContain('pouchesBelt');
    expect(ids.filter((id) => /^pouches(?!Belt)/.test(id))).toEqual(['pouchesFront']);
    const pouch = one.find((a) => a.id === 'pouchesFront'), belt = one.find((a) => a.id === 'pouchesBelt');
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
    const guards = outfitOf([{ kind: 'pauldron', colour: 'trim', plain: true, pair: true, hover: false }]).plan.adorn;
    expect(guards.map((a) => a.id).filter((id) => /^pauldron/.test(id))).toEqual(['pauldronR', 'pauldronL']);
    expect(guards.find((a) => a.id === 'pauldronR').rim).toBeUndefined();
    const rim = M.plan.adorn.find((a) => a.id === 'bootRimR'), ank = M.plan.adorn.find((a) => a.id === 'ankletR');
    expect(rim.part).toBe(ank.part);
    expect(rim.s[1]).toBeLessThan(ank.s[0]);
  });
});

describe('her belt and her cape, on the game body', () => {
  const M = outfitOf(GENRE_HERO['action-rpg'].looks.underlayer.pieces), P = M.recipe.parts;
  const ctr = (p) => { const q = p.stations.flatMap((st) => Object.values(st.points)); return [0, 1, 2].map((k) => q.reduce((t, v) => t + v[k], 0) / q.length); };
  const span = (p) => { const z = p.stations.flatMap((st) => Object.values(st.points)).map((v) => v[2]); return Math.max(...z) - Math.min(...z); };

  it('a tall belt is a cincher, wider than a belt is held to; without the word, a belt\'s', () => {
    const belt = Object.keys(P).find((k) => /^belt_/.test(k)), plain = outfitOf([{ kind: 'belt', at: 'waist', width: 2.2, buckle: false }]).recipe.parts;
    expect(span(P[belt])).toBeGreaterThan(0.07);
    expect(span(plain[Object.keys(plain).find((k) => /^belt_/.test(k))])).toBeLessThanOrEqual(0.0551 + 0.002);
  });

  it('its motif is worked on its face: borders and a row of diamonds either side of its clasp alike; its clasp a round plate centred on its front', () => {
    const pat = Object.keys(P).filter((k) => /^beltPattern/.test(k)), dia = pat.filter((k) => /Diamond/.test(k)), clasp = P[Object.keys(P).find((k) => /^beltClasp_/.test(k))];
    expect(pat.some((k) => /Low/.test(k)) && pat.some((k) => /High/.test(k))).toBe(true);
    expect(dia.length).toBeGreaterThan(8);
    expect(ctr(clasp)[0]).toBeCloseTo(0, 3);
    expect(clasp.slots.length).toBeGreaterThanOrEqual(16);
    // (the row mirrored about the centre line, none under the clasp)
    const xs = dia.map((k) => ctr(P[k])[0]).sort((a, b) => a - b);
    xs.forEach((x, i) => expect(x).toBeCloseTo(-xs[xs.length - 1 - i], 3));
    const front = dia.map((k) => ctr(P[k])).filter((c) => c[1] > 0);
    expect(Math.min(...front.map((c) => Math.abs(c[0])))).toBeGreaterThan(0.04);
    // (each bound as the belt's face: a skin's weights, summing to one)
    for (const k of [...pat, Object.keys(P).find((n) => /^beltClasp_/.test(n))]) for (const W of Object.values(P[k].bind.blend)) expect(Object.values(W).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5);
  });

  it('her cape hangs behind her from a cowl; a cowl\'s soft rolls drape round a neck, each lower at the front and wider than the one above', () => {
    const cape = (M.plan.garments ?? []).find((g) => g.fit === 'cape');
    expect(cape.around[1] - cape.around[0]).toBeLessThan(180);
    // (hers two rolls; a cowl of three to read its rolls by)
    expect(M.plan.adorn.filter((a) => /^cowl\d$/.test(a.id))).toHaveLength(2);
    const rolls = outfitOf([{ kind: 'cowl', rolls: 3 }]).plan.adorn.filter((a) => /^cowl\d$/.test(a.id)).map((a) => a.signature);
    expect(rolls.length).toBe(3);
    // (its ends at the nape, its lowest point at the throat: a U)
    const front = (S) => S.pts.reduce((b, q) => (q[1] > b[1] ? q : b)), wide = (S) => Math.max(...S.pts.map((q) => Math.abs(q[0])));
    for (let i = 1; i < rolls.length; i++) { expect(front(rolls[i])[2]).toBeLessThan(front(rolls[i - 1])[2]); expect(wide(rolls[i])).toBeGreaterThan(wide(rolls[i - 1])); }
    expect(rolls[0].pts[0][1]).toBeLessThan(0);
    expect(rolls[0].squash[1]).toBeGreaterThan(rolls[0].squash[0]);
    // (a hood worn down may close round the throat wider than its cape: its own `wrap`; past a turn it is not a hood's word)
    const H = outfitOf([{ kind: 'cloak', wrap: 0.4, hood: { worn: 'down', wrap: 0.95 } }]).plan.garments, hood = H.find((g) => g.fit === 'hood'), cp = H.find((g) => g.fit === 'cape');
    expect(hood.around[1] - hood.around[0]).toBeGreaterThan(cp.around[1] - cp.around[0] + 180);
    expect((outfitOf([{ kind: 'cloak', hood: { worn: 'down', wrap: 2 } }]).plan.garments ?? []).some((g) => g.fit === 'hood')).toBe(false);
  });

  it('a tall belt is cinched to the waist row by row: its face rows narrow in where the waist does', () => {
    const belt = P[Object.keys(P).find((k) => /^belt_/.test(k))], plain = outfitOf([{ kind: 'belt', at: 'waist', width: 2.2, buckle: false }]).recipe.parts;
    expect(belt.stations.length).toBeGreaterThan(plain[Object.keys(plain).find((k) => /^belt_/.test(k))].stations.length);
    const R = (st) => { const q = Object.values(st.points), c = [0, 1].map((d) => q.reduce((t, v) => t + v[d], 0) / q.length); return q.reduce((t, v) => t + Math.hypot(v[0] - c[0], v[1] - c[1]), 0) / q.length; };
    const face = belt.stations.slice(2, -2).map(R);
    expect(Math.min(...face)).toBeLessThan(Math.max(face[0], face.at(-1)) - 0.002);
  });
});

describe('how the genre\'s hero plays', () => {
  const world = composeGameworld({ prompt: 'an anime action rpg like zelda', name: 'Artesia' }), G = readGameworld(world);
  it('runs the library\'s run, carries its row\'s blade; a world with no row keeps its gaits and its gear', () => {
    expect(rowGaits(G, ['walk', 'jog', 'sprint'])).toEqual(['walk', 'sprint']);
    expect(rowGaits({ intent: { from: 'no-such-genre' } }, ['walk', 'jog'])).toEqual(['walk', 'jog']);
    expect(rowGaits(G, null)).toBe(null);
    expect(carriedBlade(G, { right: { item: 'sword', laws: 2 } }).right.parts).toEqual(GENRE_HERO['action-rpg'].carry.blade.parts);
    const own = { right: { item: 'sword', parts: { endLength: 90 } } };
    expect(carriedBlade(G, own)).toBe(own);
  });
  it('fights with its feel\'s kit (its strings and its bow), and steps quieter than it strikes', () => {
    expect(world.arsenal).toBe('auto');
    const A = arsenalOfGame(G).arsenal;
    expect(A.weapons[0].combos.length).toBeGreaterThan(1);
    expect(A.ranged[0].id).toBe('bow');
    expect(sheetAudio(G).sheet.steps.gain).toBe(STEP_GAIN);
    expect(STEP_GAIN).toBeLessThan(1);
  });
  it('her game fills its window: no frame is written as null, so design_game lays no phone frame over it', () => {
    expect(world.screen).toBeNull();
    expect(G.screen).toBeUndefined();
  });
  it('her land is drawn as its kit\'s card draws it: bare rocks on every zone, the card\'s sky and air over the cube\'s; another genre\'s is as it was', () => {
    const map = world.levels[world.brief.worldMap.level];
    expect(map.glyphs.hats).toBe(false);
    expect(world.style.geocube.light.sky).toEqual({ zenith: expect.stringMatching(/^#[0-9a-f]{6}$/), horizon: expect.stringMatching(/^#[0-9a-f]{6}$/), fog: expect.stringMatching(/^#[0-9a-f]{6}$/) });
    expect(world.style.geocube.light.outsideFog).toBeLessThan(1);
    for (const s of gameStages(G)) expect(s.manifest.level.hats).toBe(false);
    const other = Object.keys(GENRES).find((g) => !GENRE_HERO[g]?.land);
    const O = composeGameworld({ prompt: `a ${GENRES[other].words[0]}`, seed: 3 });
    expect(O.style?.geocube?.light?.sky).toBeUndefined();
    for (const L of Object.values(O.levels)) expect(L.glyphs?.hats).toBeUndefined();
  });
  it('its foes are harder: never floored, a temper and a skill up, more health, faster; a boss keeps its own mind', () => {
    const e = { id: 'foe-1', team: 'foes', rule: { speed: 3.6, mind: { rank: 'minion', aggressiveness: 'bold', skill: 'regular' } }, body: { hp: 8 } };
    const F = GENRE_HERO['action-rpg'].foes, made = rowFoe(G, e);
    expect(made.rule.topple).toBe(false);
    expect(made.rule.clash).toBe(false);
    expect(made.rule.mind).toMatchObject({ aggressiveness: F.aggressiveness, skill: F.skill, rank: 'minion' });
    expect(made.rule.speed).toBeGreaterThan(e.rule.speed);
    expect(made.body.hp).toBeGreaterThan(e.body.hp);
    const boss = rowFoe(G, { ...e, rule: { ...e.rule, mind: { rank: 'boss', aggressiveness: 'bold' } } });
    expect(boss.rule.mind.aggressiveness).toBe('bold');
    expect(rowFoe({ intent: { from: 'no-such-genre' } }, e)).toBe(e);
  });
});
