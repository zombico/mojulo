import { FOE_LOOKS } from './battles.js';
import { beastLook, readBeastFoe } from './stage-figures.js';
import { readPeopleSkin } from '../foes/people.js';
import { describe, it, expect } from 'vitest';
import { runSteps, readGameworld, MEADOWMARK_HERO } from './index.js';
import { readBattles, battleParty, battlePlan, PACKS } from './battles.js';
import { lowerPlay } from '../playscape/ui/direction.js';
import { readRpg } from '../playscape/rpg/rpg.js';
import { createBusState, processEvents, watchEvents } from '../worlds/event-bus.js';
import { composeMechanics } from '../game/mechanics.js';

const levels = (w) => runSteps(w, { ref: 'gw' }).filter((s) => s.key.startsWith('level-'));
const W = (battles, more = {}) => ({ ...MEADOWMARK_HERO, battles, ...more });

describe('battles: the book\'s party battles, laid on its trails', () => {
  it('each foe kind its own figure, each trail stage stands its packs on its beats, and the packs walk the ladder across the game', () => {
    const S = runSteps(W({}), { ref: 'gw' });
    // (a figure for each foe the plan stands, in its look: a beast through the animal door, a person through the hero's)
    expect(S.find((s) => s.key === 'foe-wolf')).toMatchObject({ ref: 'gw-foe-wolf', ready: true, order: { animal: { species: 'wolf' } } });
    // (a people, the goblin's orcish kin: its sheet, then the character the character door makes from it, its moves on it)
    expect(S.find((s) => s.key === 'foe-goblin-sheet')).toMatchObject({ ref: 'gw-foe-goblin-sheet', order: { manifest: { kind: 'egocube', moves: true } } });
    expect(S.find((s) => s.key === 'foe-goblin')).toMatchObject({ ref: 'gw-foe-goblin', order: { egocube: 'gw-foe-goblin-sheet' } });
    expect(S.some((s) => s.key === 'foe')).toBe(false);
    const L = levels(W({}));
    expect(L.length).toBe(5);
    const encs = L.flatMap((s) => s.order.manifest.play.rpg.encounters ?? []);
    expect(encs.map((e) => e.id)).toEqual(encs.map((_, k) => `pack-${k + 1}`));
    expect(encs.map((e) => e.foes)).toEqual(encs.map((_, k) => PACKS[Math.min(k, PACKS.length - 1)]));
    const first = L[0].order.manifest;
    // each foe of a pack its own figure, the first where its fight starts, each made of its kind's
    for (const e of first.play.rpg.encounters) {
      const who = [].concat(e.who);
      expect(who.length).toBe(e.foes.length);
      expect(first.entities.find((x) => x.id === who[0]).transform.pos.slice(0, 2)).toEqual(e.at);
      who.forEach((id, j) => expect(first.figures[id].heroRef).toBe(`gw-foe-${e.foes[j]}`));
    }
    // (a world that writes its own foe look stands that one figure for every pack, as before)
    const own = levels(W({ foe: { cast: 'female' } }))[0].order.manifest;
    for (const e of own.play.rpg.encounters) for (const id of [].concat(e.who)) expect(own.figures[id].heroRef).toBe('gw-foe');
    expect(first.play.rpg.party.map((p) => [p.id, p.class])).toEqual([['hero', 'fighter']]);
    // a merchant and an inn at the start (the inn the stage's rest), the party carried, a wiped party fails the level
    expect(first.play.cues.some((c) => c.id === 'rpg-rest-spot')).toBe(false);
    expect(first.play.cues.find((c) => c.id === 'rpg-innkeeper').then).toEqual({ emit: 'rpg-shop:innkeeper' });
    expect(Object.keys(first.play.rpg.shops)).toEqual(['merchant', 'innkeeper']);
    expect(first.game.mechanics.map((m) => m.kind)).toEqual(expect.arrayContaining(['reach-exit', 'party', 'fail-on-death']));
    // the store carries the party, as the game starts
    const game = S.find((s) => s.key === 'game');
    // and the bag: its potions as the game starts, gold in it, carried by the bag mechanic
    expect(game.order.store.slices.find((x) => x.name === 'bag')).toEqual({ name: 'bag', kind: 'inventory', init: { items: { potion: 2 } } });
    expect(first.play.rpg.rules.gold).toBe('held:bag:gold');
    expect(first.game.mechanics).toContainEqual({ kind: 'bag', slice: 'bag' });
    expect(game.order.store.slices.find((x) => x.kind === 'party')).toMatchObject({ name: 'party', init: { roster: { hero: { name: 'Hero', level: 1, stats: { lv: 1, 'cls.fighter': 1, 'skill.power-strike': 1 } } } } });
  });

  it('per, packs and the boss: the last trail stage ends on the boss, with no escape', () => {
    const L = levels(W({ per: 1, packs: [['slime'], ['wolf']], boss: ['drake'], rules: { defeat: 'retry' } }));
    const encs = L.flatMap((s) => s.order.manifest.play.rpg.encounters ?? []);
    // one on each stage with room, the ladder walked (its last again past its end), the boss last
    expect(encs.length).toBe(L.filter((s) => s.order.manifest.play.rpg.encounters?.length).length);
    expect(encs.map((e) => e.foes)).toEqual([...encs.slice(0, -1).map((_, k) => (k ? ['wolf'] : ['slime'])), ['drake']]);
    expect(encs.at(-1).flee).toBe(false);
    expect(L[0].order.manifest.game.mechanics.some((m) => m.kind === 'fail-on-death')).toBe(false);
  });

  it('a world that fights turn by turn is laid with them, written or not; P is in the level\'s legend', () => {
    const jrpg = { ...MEADOWMARK_HERO, intent: { from: 'jrpg' } };
    const S = runSteps(jrpg, { ref: 'gw' });
    expect(S.some((s) => /^foe-/.test(s.key))).toBe(true);
    const L = levels(jrpg);
    expect(L.flatMap((s) => s.order.manifest.play.rpg.encounters ?? []).length).toBeGreaterThan(0);
    expect(JSON.stringify(L[0].order.manifest.events)).toContain('P  party');
    // an intent that fights in real time is not
    expect(runSteps({ ...MEADOWMARK_HERO, intent: { from: 'shooter' } }, { ref: 'gw' }).some((s) => s.key === 'foe')).toBe(false);
  });

  it('absent, nothing changes: no foe, no rpg, no party slice', () => {
    const S = runSteps(MEADOWMARK_HERO, { ref: 'gw' });
    expect(S.some((s) => s.key === 'foe')).toBe(false);
    expect(levels(MEADOWMARK_HERO).some((s) => s.order.manifest.play?.rpg)).toBe(false);
    expect(S.find((s) => s.key === 'game').order.store.slices.some((x) => x.kind === 'party')).toBe(false);
  });

  it('the party is the hero and the cast who join, each a class; a class named for one who does not join is refused', () => {
    const cast = { mira: { name: 'Mira', joins: 'met-mira' }, mayor: { name: 'Mayor' } };
    const G = readGameworld(W({ party: { hero: { class: 'knight', name: 'Ren' } } }, { characters: { ...MEADOWMARK_HERO.characters, cast } }));
    expect(battleParty(G)).toEqual([{ id: 'hero', name: 'Ren', class: 'knight' }, { id: 'mira', name: 'Mira', class: 'mage', joins: 'met-mira' }]);
    expect(() => readGameworld(W({ party: { mayor: { class: 'cleric' } } }, { characters: { ...MEADOWMARK_HERO.characters, cast } }))).toThrow(/give mayor a joins flag/);
    expect(() => readBattles({ packs: [['dragonlord']] })).toThrow(/'dragonlord' is no preset foe/);
    expect(() => readBattles({ party: { hero: { class: 'bard' } } })).toThrow(/'bard' is no preset class/);
    expect(() => readBattles({ boss: [] })).toThrow(/boss is a pack/);
    expect(() => readBattles({ waves: 3 })).toThrow(/waves is not part of the battles/);
    expect(battlePlan(readGameworld(W({ per: 0 })), [{ section: 'trail' }])).toEqual({ 0: [] });
  });

  it('a level lowered: the fights on the bus, a won pack falls, the contract carries the party', () => {
    const M = levels(W({}))[0].order.manifest;
    const ev = lowerPlay(M, { player: 'hero' });
    expect(Object.keys(ev.rpg.encounters)).toEqual(['pack-1', 'pack-2']);
    expect(ev.vars).toMatchObject({ 'rpg.hero.class': 'fighter', 'rpg-done-pack-1': 0 });
    const bus = createBusState(ev, []);
    const fire = (type) => { processEvents(bus, [{ type }]); for (let k = 0; k < 6; k++) { const w = watchEvents(bus); if (!w.length) break; processEvents(bus, w); } };
    fire('rpg-won:pack-1');
    expect(bus.vars['rpg-done-pack-1']).toBe(1);
    // a rest point: E at the start rests the party (rpg-rest, for the page's channel)
    expect(ev.sources.some((s) => s.use)).toBe(true);
    const store = runSteps(W({}), { ref: 'gw' }).find((s) => s.key === 'game').order.store;
    const c = composeMechanics(M.game.mechanics, { storeSchema: store, player: 'hero' });
    expect(c.party).toEqual({ slice: 'party' });
    expect(c.produces).toContainEqual({ type: 'setStat', slice: 'party' });
  });
});

describe('the party on the map', () => {
  it('followers: false: the party fights beside the hero, but the hero walks the map alone', () => {
    const cast = { ...MEADOWMARK_HERO.characters, casting: { scale: 'party', n: 2 } };
    const at = (battles) => {
      const M = levels(W(battles, { characters: cast }))[0].order.manifest;
      return { escorts: M.entities.filter((e) => e.rule?.mind?.motivation === 'escort').map((e) => e.id), party: lowerPlay(M, { player: 'hero' }).rpg.party.map((p) => p.id) };
    };
    const walked = at({}), alone = at({ followers: false });
    expect(walked.escorts.length).toBeGreaterThan(0);
    expect(alone.escorts).toEqual([]);
    // the same party in the fights either way
    expect(alone.party).toEqual(walked.party);
    expect(alone.party.length).toBeGreaterThan(1);
    expect(() => readBattles({ followers: 'no' })).toThrow(/followers is true .* or false/);
  });
});

describe('the shops on the way', () => {
  it('each fighting stage opens with a merchant and an inn, the wares and the night dearer further on; none where the book says', () => {
    const L = levels(W({}));
    const shops = L.map((s) => s.order.manifest.play.rpg.shops);
    expect(shops[0].merchant.wares).toContain('bronze-sword');
    // (priced as the page reads it: the preset's price)
    expect(readRpg(L[0].order.manifest.play).shops.merchant.wares.find((w) => w.item === 'potion')).toEqual({ item: 'potion', kind: 'item', price: 8 });
    const later = shops.filter(Boolean).at(-1);
    expect(later.innkeeper.inn).toBeGreaterThan(shops[0].innkeeper.inn);
    expect(later.merchant.wares).not.toEqual(shops[0].merchant.wares);
    // (the keepers stand on the map, made of the keeper's figure, beside the start)
    const M = L[0].order.manifest, at = M.entities.find((e) => e.id === 'merchant').transform.pos;
    expect(M.figures.merchant.heroRef).toBe('gw-keeper');
    expect(runSteps(W({}), { ref: 'gw' }).find((s) => s.key === 'keeper')).toBeTruthy();
    expect(Math.hypot(at[0] - M.play.cues.find((c) => c.id === 'rpg-merchant').when.use.at[0], at[1] - M.play.cues.find((c) => c.id === 'rpg-merchant').when.use.at[1])).toBe(0);
    // a book's own wares and price; no inn keeps the free rest; no shops, as before
    const own = levels(W({ shops: { wares: ['potion'], inn: false } }))[0].order.manifest;
    expect(own.play.rpg.shops).toEqual({ merchant: { name: 'Merchant', wares: ['potion'] } });
    expect(own.play.cues.some((c) => c.id === 'rpg-rest-spot')).toBe(true);
    const none = levels(W({ shops: false }))[0].order.manifest;
    expect(none.play.rpg.shops).toBeUndefined();
    expect(none.entities.some((e) => e.id === 'merchant')).toBe(false);
    expect(runSteps(W({ shops: false }), { ref: 'gw' }).some((s) => s.key === 'keeper')).toBe(false);
    expect(() => readBattles({ shops: { inn: -1 } })).toThrow(/inn/);
  });
});

describe('the battle foes\' looks', () => {
  it('each beast look names a species the fauna grows, and its ooze one the mutagen has', () => {
    const fail = (m) => new Error(m);
    for (const [id, look] of Object.entries(FOE_LOOKS)) if (beastLook(look)) expect(() => readBeastFoe(look, null, id, fail), id).not.toThrow();
  });
  it('each people look names a people the character doors make, and stands from its own sheet at its own stature', () => {
    for (const [id, look] of Object.entries(FOE_LOOKS)) if (look.people !== undefined) expect(() => readPeopleSkin(look, id), id).not.toThrow();
    // (the undead: a skeleton's pack, its foe drawn from its own sheet's character, standing at the sheet's stature)
    const w = W({ packs: [['skeleton', 'zombie']] }), S = runSteps(w, { ref: 'gw' });
    for (const kind of ['skeleton', 'zombie']) {
      const sheet = S.find((s) => s.key === `foe-${kind}-sheet`);
      expect(sheet.order.manifest.roll).toBeTruthy();
      expect(S.find((s) => s.key === `foe-${kind}`).order).toMatchObject({ egocube: `gw-foe-${kind}-sheet` });
    }
    // (two kinds, two sheets: each rolled on its own seed)
    expect(S.find((s) => s.key === 'foe-skeleton-sheet').print).not.toBe(S.find((s) => s.key === 'foe-zombie-sheet').print);
    const M = levels(w)[0].order.manifest, e = M.play.rpg.encounters[0], who = [].concat(e.who);
    who.forEach((id, j) => expect(M.figures[id].heroRef).toBe(`gw-foe-${e.foes[j]}`));
    expect(M.entities.find((x) => x.id === who[0]).rule.collideHeight).toBeGreaterThan(1);
    // a book's own look per foe, in the doors' words; a people the doors do not make is refused
    const own = runSteps(W({ packs: [['wolf']], looks: { wolf: { people: 'lupine' } } }), { ref: 'gw' });
    expect(own.find((s) => s.key === 'foe-wolf-sheet')).toBeTruthy();
    expect(() => readBattles({ looks: { wolf: { people: 'nope-kin' } } })).toThrow(/looks\.wolf/);
  });
});
