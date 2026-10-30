// The cast sheet: a world's foes read into its cards (each fielded foe, its tier, its numbers in the flavor's words, its
// mind, its shelves), its parts on the gate, the page drawn from them, and the casting call a world that fights and
// keeps no bestiary is proposed. One case per procedure: a beast, a people, a model, a mode chain, a summoner; one flavor
// that counts and one that shows health; absence costs nothing.
import { describe, it, expect } from 'vitest';
import { foeCastOf, castable, foeParts, foeState, approveFoe, STAT_WORDS, REGISTER_WORDS } from './foe-cast.js';
import { castingCall, ROLES } from './foe-casting.js';
import { foeCastHtml } from './foe-cast-html.js';
import { readGameworld, MEADOWMARK_HERO } from './index.js';
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
    expect(P.levels[walks[walks.length - 1]]).toEqual({ from: ['boss'], win: 'clear' });
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
    expect(plat.roles.every((r) => !r.skin)).toBe(true);
  });
});

describe('the sheet', () => {
  it('draws the lineup, a tile and a card a foe; a made figure is its portrait, the rest their silhouette', () => {
    const html = foeCastHtml({ ...W, made: { 'foes-grunt': { ref: 'w-foes-grunt', order: '0000000a', stored: '0000000b' } } }, { portrait: (r) => `/png/${r}` });
    expect(html).toMatch(/<!--plate:lineup--><svg[\s\S]*<!--\/plate-->/);
    for (const x of foeCastOf(W).foes) expect(html).toContain(`id="foe-${x.id}"`);
    expect(html).toContain('src="/png/w-foes-grunt"');
    expect(html).toContain('src="/png/sk-model"');
    expect(html).not.toContain('casting-call');
    expect(foeCastHtml(W)).toBe(foeCastHtml(W));
  });

  it('a world that fights and keeps no bestiary shows the casting call, proposed and not written', () => {
    const html = foeCastHtml({ ...MEADOWMARK_HERO, intent: { from: 'shooter' } });
    expect(html).toContain('id="casting-call"');
    expect(html).toContain('proposed, not written');
    expect(() => foeCastHtml(world())).toThrow(/fields no foe/);
  });
});
