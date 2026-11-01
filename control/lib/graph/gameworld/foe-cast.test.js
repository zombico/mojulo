// The cast sheet: a world's foes read into its cards (each fielded foe, its tier, its numbers in the flavor's words, its
// mind, its shelves), its parts on the gate, the page drawn from them, and the casting call a world that fights and
// keeps no bestiary is proposed. One case per procedure: a beast, a people, a model, a mode chain, a summoner; one flavor
// that counts and one that shows health; absence costs nothing.
import { describe, it, expect } from 'vitest';
import { foeCastOf, castable, foeParts, foeState, approveFoe, STAT_WORDS, REGISTER_WORDS, COUNSEL } from './foe-cast.js';
import { castingCall, ROLES, ERA_DRESS, ERA_OOZES, BOSS_OOZE } from './foe-casting.js';
import { ERA_OF_KIT } from './cast-setting.js';
import { colorKey } from './nature.js';
import { BOOK_SKINS, skinHead } from './book-skin.js';
import { GRUNT_STYLES } from '../cosmos/packs/comic-hero/grunts.js';
import { ITEMS } from '../cosmos/packs/comic-hero/items.js';
import { isGroundKit } from '../era/stage.js';
import { foeCastHtml } from './foe-cast-html.js';
import { readGameworld, MEADOWMARK_HERO, gameworldBibleHtml } from './index.js';
import { readReview, FOE_CAST_PART } from './review.js';
import { FOE_CLASSES } from '../foes/index.js';
import { MOVES } from '../foes/vocab.js';
import { RANKS } from '../mind/vocab.js';

const CLASSES = Object.values(FOE_CLASSES);
const SOLO = CLASSES.find((c) => !MOVES[c.move].group && c.attack.kind !== 'call');
const CALLER = CLASSES.find((c) => c.attack.kind === 'call');
const LEGGED = CLASSES.find((c) => c !== SOLO && !MOVES[c.move].needs.includes('wings') && c.attack.kind !== 'call');
const walk = { walk: { nodes: { a: { trail: {} } } } };
// a world of two walks, the first standing `from`; its words over it
const world = (foes, from, more = {}) => ({ id: 'w', seed: 3, levels: { one: { ...walk, ...(from ? { foes: { from } } : {}) }, two: { ...walk } }, ...(foes ? { foes } : {}), ...more });
const BESTIARY = {
  grunt: { class: SOLO.id },
  caller: { class: CALLER.id, rank: 'boss', summons: { foe: 'grunt' }, skin: { people: 'undead' } },
  armour: { class: LEGGED.id, rank: 'elite', becomes: 'bare', states: { flaming: { elemental: true } } },
  bare: { class: SOLO.id, skin: { people: 'skeleton' } },
  model: { class: SOLO.id, skin: { meshRef: 'sk-model', height: 2.2 } },
};
const W = world(BESTIARY, ['caller', 'armour', 'model']);

describe('the cast read', () => {
  it('reads each foe the world fields first, then what it only keeps, tiered least rank first', () => {
    const C = foeCastOf(W);
    // (the summons and the mode come in with what calls and becomes them)
    expect(C.foes.filter((x) => x.fielded).map((x) => x.id).sort()).toEqual(['armour', 'bare', 'caller', 'grunt', 'model']);
    expect(C.tiers.map((t) => t.rank)).toEqual(Object.keys(RANKS).filter((r) => C.foes.some((x) => x.rank === r)));
    const by = Object.fromEntries(C.foes.map((x) => [x.id, x]));
    expect(by.grunt.skin.kind).toBe('beast');
    expect(by.caller.skin.kind).toBe('people');
    expect(by.model.skin.kind).toBe('model');
    expect(by.model.figure).toBe('sk-model');
    expect(by.armour.modes).toEqual(['armour', 'bare']);
    expect(by.armour.element).toBe('fire');
    expect(by.bare.relations.map((r) => r.kind)).toContain('mode-of');
    expect(by.caller.relations).toEqual([expect.objectContaining({ kind: 'summons', foe: 'grunt' })]);
    expect(by.grunt.relations).toEqual([expect.objectContaining({ kind: 'summoned', foe: 'caller' })]);
    expect(by.caller.levels).toEqual(['one']);
    // (the Mind gem on its body: every situation answered, a duelist's switches)
    expect(by.caller.mind.situations.every((s) => s.does.length)).toBe(true);
    expect(by.caller.mind.switches.length).toBeGreaterThan(0);
    expect(by.grunt.mind.switches).toEqual([]);
  });

  it('says the numbers as the flavor does: a counting game counts the hero\'s blows, a realistic one shows health', () => {
    const count = Object.keys(STAT_WORDS).find((f) => !STAT_WORDS[f].health), health = Object.keys(STAT_WORDS).find((f) => STAT_WORDS[f].health);
    const at = (flavor) => foeCastOf({ ...W, juice: { flavor } }).foes.find((x) => x.id === 'armour');
    const A = at(count), B = at(health);
    expect(A.stats.downs).toBeLessThan(A.stats.hp);
    expect(B.stats.downs).toBe(B.stats.hp);
    expect(foeCastOf({ ...W, juice: { flavor: count } }).words.downs).toBe(STAT_WORDS[count].downs);
    // (and the register names the tiers)
    const reg = Object.keys(REGISTER_WORDS)[1];
    expect(foeCastOf({ ...W, juice: { register: reg } }).tiers[0].name).toBe(REGISTER_WORDS[reg].tiers[foeCastOf(W).tiers[0].rank]);
  });

  it('a beast grown by oozes says each at its strength, and is a variant of the same class on the same species grown by none', () => {
    const G = world({ base: { class: SOLO.id }, grown: { class: SOLO.id, skin: { species: SOLO.standIn, ooze: [{ id: BOSS_OOZE, strength: 0.5 }] } } }, ['base', 'grown']);
    const by = Object.fromEntries(foeCastOf(G).foes.map((x) => [x.id, x]));
    expect(by.grown.skin.oozes).toEqual([{ id: BOSS_OOZE, strength: 0.5 }]);
    expect(by.grown.variantOf).toBe('base');
    expect(by.base.relations).toEqual([expect.objectContaining({ kind: 'variant', foe: 'grown' })]);
    // (an ooze grows its shape, never its stature)
    expect(by.grown.stats.stature).toBe(by.base.stats.stature);
  });

  it('absent, there is nothing to cast and nothing on the gate', () => {
    expect(castable(world())).toBe(false);
    expect(foeCastOf(world())).toBe(null);
    expect(foeParts(world())).toEqual([]);
    expect(castable(world(null, null, { levels: { one: { ...walk, foes: true } } }))).toBe(true);
  });
});

describe('the gate', () => {
  it('the cast and each foe are parts; an approval holds on its print and goes stale when the foe changes', () => {
    expect(foeParts(W).map((p) => p.id)).toEqual([FOE_CAST_PART, ...foeCastOf(W).foes.map((x) => `foes:${x.id}`)]);
    const review = approveFoe(W, 'foes:armour');
    const stamp = (w) => foeState(w).find((s) => s.id === 'foes:armour').status;
    expect(stamp(W)).toBe('proposed');
    expect(stamp({ ...W, review })).toBe('approved');
    expect(stamp({ ...W, review, foes: { ...BESTIARY, armour: { ...BESTIARY.armour, rank: 'miniboss' } } })).toBe('changed');
    expect(foeState({ ...W, mode: 'autonomous' }).every((s) => s.status === 'auto' || s.status === 'revise')).toBe(true);
    // (the world's review field holds them; a foe the bestiary does not keep is refused)
    expect(() => readReview({ ...W, review })).not.toThrow();
    expect(() => readReview({ ...W, review: { 'foes:nobody': { status: 'revise', note: 'x' } } })).toThrow(/not a part/);
  });
});

describe('the casting call', () => {
  const fighting = { ...MEADOWMARK_HERO, intent: { from: 'shooter' } };
  const adopt = (w, P) => ({ ...w, foes: P.foes, levels: Object.fromEntries(Object.entries(w.levels).map(([k, v]) => [k, { ...v, ...(P.levels[k] ? { foes: P.levels[k] } : {}) }])) });

  it('proposes a role-shaped cast the world reads as written, the same every time, never for a world that keeps one', () => {
    const P = castingCall(fighting);
    expect(P.roles.map((r) => r.id)).toEqual(Object.keys(ROLES));
    expect(new Set(P.roles.map((r) => r.class)).size).toBe(P.roles.length);
    expect(() => readGameworld(adopt(fighting, P))).not.toThrow();
    expect(castingCall(fighting)).toEqual(P);
    expect(castingCall(adopt(fighting, P))).toBe(null);
    // (the boss alone on the last walk, won by clearing it)
    const walks = Object.keys(fighting.levels).filter((k) => fighting.levels[k].walk);
    expect(P.levels[walks[walks.length - 1]]).toEqual({ from: ['boss'], count: 1, win: 'clear' });
  });

  it('a person cast is dressed as one crew, a soldier\'s for a game whose minds are soldiers\'; a building takes foes too', () => {
    const era = Object.keys(ERA_DRESS)[0], kit = Object.keys(ERA_OF_KIT).find((k) => ERA_OF_KIT[k] === era && !/lab/.test(k) && k !== 'jungle-trail');
    const W = world(null, null, { intent: { from: 'stealth' }, style: { kit }, levels: { one: { ...walk }, hq: { building: { use: 'office' } } } });
    const P = castingCall(W), dressed = P.roles.filter((r) => r.skin?.dress);
    expect(dressed.length).toBeGreaterThan(0);
    expect(new Set(dressed.map((r) => `${r.skin.dress.faction}/${r.skin.dress.colourway}`)).size).toBe(1);
    expect(dressed[0].skin.dress.faction).toBe(ERA_DRESS[era][0]);
    // (a class on watch wears a kind whose arms are stowed: nothing held at the ready in its hands)
    const F = GRUNT_STYLES[ERA_DRESS[era][0]], watch = dressed.find((r) => FOE_CLASSES[r.class].mind.motivation === 'guard');
    if (watch) expect(F.kinds[watch.skin.dress.kind].items[0].some((i) => ITEMS[i]?.slot === 'right')).toBe(false);
    expect(P.levels.hq).toEqual({ from: ['boss'], count: 1, win: 'clear' });
    expect(() => readGameworld({ ...W, foes: P.foes, levels: { one: { ...walk, foes: P.levels.one }, hq: { building: { use: 'office' }, foes: P.levels.hq } } })).not.toThrow();
    expect(foeCastOf({ ...W, foes: P.foes, levels: { one: { ...walk, foes: P.levels.one }, hq: { building: { use: 'office' } } } }).foes.find((x) => x.skin.dress).skin.says).toMatch(/dressed as/);
  });

  it('grows each beast role by the world\'s oozes into variants met deeper in, the boss grown itself; an unfit growth said', () => {
    // (an era with oozes whose kit is open ground, its cast beasts: a platformer's)
    const kit = Object.keys(ERA_OF_KIT).find((k) => ERA_OOZES[ERA_OF_KIT[k]] && isGroundKit(k)), era = ERA_OF_KIT[kit];
    const w3 = { ...walk };
    const Wv = { id: 'w', seed: 3, intent: { from: 'metroidvania' }, style: { kit }, levels: { one: w3, two: w3, three: w3 }, links: [{ from: 'one', to: 'two', kind: 'road' }, { from: 'two', to: 'three', kind: 'road' }], start: 'one' };
    const P = castingCall(Wv);
    expect(P.from.oozes).toEqual(ERA_OOZES[era].slice(0, P.from.oozes.length));
    expect(P.variants.length).toBeGreaterThan(0);
    for (const v of P.variants) expect(P.foes[v.id]).toEqual({ ...P.foes[v.of], skin: { species: FOE_CLASSES[v.class].standIn, ooze: [v.ooze] } });
    // (the first level meets the roles alone, the second their variants too)
    expect(P.levels.one.from.some((id) => P.variants.some((v) => v.id === id))).toBe(false);
    expect(P.levels.two.from).toEqual(expect.arrayContaining(P.variants.filter((v) => P.levels.two.from.includes(v.of)).map((v) => v.id)));
    expect(P.foes.boss.skin.ooze[0]).toBe(BOSS_OOZE);
    expect(() => readGameworld({ ...Wv, foes: P.foes, levels: Object.fromEntries(Object.entries(Wv.levels).map(([k, v]) => [k, { ...v, foes: P.levels[k] }])) })).not.toThrow();
  });

  it('casts nothing for a game that fights nothing', () => {
    expect(castingCall(world())).toBe(null);
    expect(castingCall(world(null, null, { intent: { from: 'racing' } }))).toBe(null);
  });

  it('the intent\'s own mind.foes casts first', () => {
    const named = CLASSES.find((c) => c.threat <= 2 && c.attack.kind !== 'call');
    const P = castingCall(world(null, null, { intent: { from: 'shooter', cube: { mind: { foes: [named.id] } } } }));
    expect(P.foes.grunt.class).toBe(named.id);
  });

  it('a people\'s era draws the cast as its people where a class stands on two legs; a platformer keeps the beasts', () => {
    const P = castingCall(fighting);
    expect(P.from.people).toBeTruthy();
    expect(P.roles.some((r) => r.skin?.people === P.from.people)).toBe(true);
    const plat = castingCall({ ...MEADOWMARK_HERO, intent: { from: 'metroidvania' } });
    expect(plat.from.flavor).toBe('platformer');
    expect(plat.roles.every((r) => !r.skin?.people)).toBe(true);
  });
});

describe('the sheet', () => {
  it('draws the lineup, a tile and a card a foe; a photographed foe its photograph, its silhouette standing in for it', () => {
    const shot = { figure: 'data:image/jpeg;base64,FIG', bust: 'data:image/jpeg;base64,BUST' };
    const html = foeCastHtml(W, { portraits: { grunt: shot } });
    expect(html).toMatch(/<!--plate:lineup--><svg[\s\S]*<!--\/plate-->/);
    for (const x of foeCastOf(W).foes) expect(html).toContain(`id="foe-${x.id}"`);
    // (the tile its figure, the card its bust; each with its silhouette hidden behind, for a photograph that fails)
    expect(html).toContain(`src="${shot.figure}"`);
    expect(html).toContain(`src="${shot.bust}"`);
    expect(html).toMatch(/onerror="this\.hidden=true;this\.nextElementSibling\.hidden=false"><span hidden><svg/);
    expect(foeCastHtml(W)).not.toContain('<img');
    expect(html).not.toContain('casting-call');
    expect(foeCastHtml(W)).toBe(foeCastHtml(W));
  });

  it('each card leads with what it does, how to beat it and what it costs, the designer\'s detail folded', () => {
    const C = foeCastOf(W), by = Object.fromEntries(C.foes.map((x) => [x.id, x]));
    // (the counsel is rows: a stomp's, the modes', a summoner's bond, each said where the foe carries it)
    expect(by.grunt.beat).toContain(COUNSEL.stomp[FOE_CLASSES[SOLO.id].stomp]);
    expect(by.armour.beat).toContain(COUNSEL.modes(2));
    expect(by.caller.beat).toContain(COUNSEL.summons.bound);
    expect(by.caller.costs).toMatch(/does not hurt you itself/);
    const count = Object.keys(STAT_WORDS).find((f) => !STAT_WORDS[f].health);
    expect(foeCastOf({ ...W, juice: { flavor: count } }).foes.find((x) => x.id === 'grunt').costs).toMatch(new RegExp(`^1 ${STAT_WORDS[count].blow[0]} to down`));
    const html = foeCastHtml(W);
    expect(html).toContain('<dt>Beat it</dt>');
    expect(html).toContain('<details class="designer">');
  });

  it('the world\'s bible carries its foes: a section of tiles linked to the cast sheet, and who stands on each level', () => {
    const html = gameworldBibleHtml(W);
    expect(html).toContain('id="foes"');
    expect(html).toContain('href="?book=foes#foe-caller"');
    expect(html).toMatch(/<h4>Foes<\/h4><div class="lineup">/);
    expect(html).toContain('<a href="#foes">Foes</a>');
    // (a world that fields none: not a byte of it)
    expect(gameworldBibleHtml(world())).not.toMatch(/id="foes"|<h4>Foes<\/h4>|class="tile"/);
  });
  it('is drawn in its world\'s colours: the page\'s accent one of its kit\'s own', () => {
    const kit = MEADOWMARK_HERO.style.kit, html = foeCastHtml({ ...MEADOWMARK_HERO, intent: { from: 'metroidvania' } });
    const accent = html.match(/:root\{--local:(#[0-9a-f]{6});/)?.[1];
    expect(colorKey(kit).ramps.flatMap((r) => r.stops)).toContain(accent);
    expect(html).toContain(kit);
  });

  it('wears the world\'s book skin as its bible does; a world without one, none', () => {
    const id = Object.keys(BOOK_SKINS)[0], { link, css } = skinHead(BOOK_SKINS[id]);
    const skinned = foeCastHtml({ ...W, book: { skin: id } });
    expect(skinned).toContain(css);
    expect(skinned).toContain(link);
    expect(skinned.replace(link, '').replace(`\n${css}`, '')).toBe(foeCastHtml(W));
  });

  it('a world that fights and keeps no bestiary shows the casting call, proposed and not written, a role an article', () => {
    const html = foeCastHtml({ ...MEADOWMARK_HERO, intent: { from: 'shooter' } });
    expect(html).toContain('id="casting-call"');
    expect(html).toContain('proposed, not written');
    for (const r of Object.keys(ROLES)) expect(html).toContain(`id="role-${r}"`);
    expect(() => foeCastHtml(world())).toThrow(/fields no foe/);
  });
});
