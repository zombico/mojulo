import { describe, it, expect } from 'vitest';
import { composeGameworld, runSteps, readGameworld, fingerprint, MEADOWMARK, MEADOWMARK_HERO } from './index.js';
import { LEVEL_GOAL } from './quick.js';
import { FLOW_IN_PLAY } from '../game/flow.js';
import { composeMechanics } from '../game/mechanics.js';
import { readBattle } from '../playscape/ui/battles.js';
import { withBuildingLevel } from '../structure/level.js';
import { assembleStageScene } from '../era/stage.js';
import { megaworldLinks, megaworldLaws } from './megaworld.js';

const levelSteps = (S) => S.filter((s) => s.key.startsWith('level-'));
// a made level's game channel as it plays (a building's is lowered from its `level` on every read)
const gameOf = (s) => (s.order.manifest.game ? s.order.manifest : withBuildingLevel(s.order.manifest, s.ref)).game;
const kinds = (s) => gameOf(s).mechanics.map((m) => m.kind);
// every level's mechanics compose against the game's own store (the slices they need are there, one success terminal)
const composes = (S) => {
  const store = S.find((s) => s.key === 'game').order.store;
  for (const s of levelSteps(S)) expect(() => composeMechanics(gameOf(s).mechanics, { storeSchema: store, player: s.order.manifest.entities?.[0]?.id ?? 'player' })).not.toThrow();
};

describe('composed goals: what a level is played for, read from the prompt', () => {
  it('relics to collect, a boss at the end and health: the brief says what each word decided, and the levels carry them', () => {
    const prompt = 'a haunted forest with relics to collect, a boss at the end, and health';
    const w = composeGameworld({ prompt, seed: 1 });
    expect(composeGameworld({ prompt, seed: 1 })).toEqual(w);
    const read = Object.fromEntries(w.brief.read.map((r) => [r.word, r.decides]));
    expect(read).toMatchObject({ relics: ['goal.collect'], collect: ['goal.collect'], boss: ['goal.boss'], health: ['goal.health'] });
    for (const word of ['relics', 'collect', 'boss', 'health']) expect(w.brief.unread).not.toContain(word);
    const ids = Object.keys(w.levels), last = ids.at(-1);
    expect(w.brief.goal).toEqual({ collect: 'relic', boss: last, health: true });
    // the relics and the health on every level, the boss on the last
    for (const id of ids) expect(w.levels[id].goal).toEqual({ collect: 'relic', health: true, ...(id === last ? { boss: true } : {}) });

    const S = runSteps(w, { ref: 'gw' });
    expect(fingerprint(S)).toBe(fingerprint(runSteps(w, { ref: 'gw' })));
    // the boss's figure is made first, through the hero door (a foe rolled in the game's setting)
    expect(S[0]).toMatchObject({ key: 'foe', ref: 'gw-foe', ready: true, order: { motion: null, mint: { via: 'hero' } } });
    const L = levelSteps(S);
    for (const s of L) {
      const M = gameOf(s).mechanics;
      // health: hp on the HUD (a hit's cost named), the level lost at none
      expect(M).toContainEqual({ kind: 'fail-on-death', startHp: LEVEL_GOAL.hp, hits: LEVEL_GOAL.hit });
      expect(M).toContainEqual({ kind: 'bag', slice: 'bag' });
      // the relics lie on the trail's beats (a climb has none)
      const C = M.find((m) => m.kind === 'collect');
      if (s.order.manifest.trail) expect(C.pickups.length).toBeGreaterThan(0);
      if (C) expect(C.pickups.every((p) => p.item === 'relic')).toBe(true);
      // the bag on I
      expect(s.order.manifest.play.menus).toContainEqual({ id: 'bag', kind: 'inventory', title: 'Bag' });
    }
    // the boss stands at the end of the last level's last stage: its fall ends the level, in place of the exit
    const end = L.filter((s) => s.key.startsWith(`level-${last}-`)).at(-1);
    for (const s of L) expect(kinds(s).includes('win-when')).toBe(s === end);
    expect(kinds(end)).not.toContain('reach-exit');
    expect(gameOf(end).mechanics.find((m) => m.kind === 'win-when')).toEqual({ kind: 'win-when', when: { var: 'won', gte: 1 }, event: 'battles:won' });
    const boss = end.order.manifest.entities.find((e) => e.id === 'boss');
    expect(end.order.manifest.figures.boss.heroRef).toBe('gw-foe');
    expect(readBattle(end.order.manifest.play).foes).toEqual([{ who: 'boss', at: boss.transform.pos.slice(0, 2), name: 'The boss', hp: LEVEL_GOAL.boss.hp, atk: LEVEL_GOAL.boss.atk }]);
    for (const s of L.filter((x) => x !== end)) expect(kinds(s)).toContain('reach-exit');
    // the game carries the bag the relics go into
    expect(S.at(-1).order.store.slices).toContainEqual({ name: 'bag', kind: 'inventory' });
    composes(S);
    // a fight fought by attacks alone is won with hp to spare
    const turns = Math.ceil(LEVEL_GOAL.boss.hp / 2);
    expect(LEVEL_GOAL.hp - (turns - 1) * LEVEL_GOAL.boss.atk).toBeGreaterThan(0);
  }, 300000);

  it('a prompt with no goal words lays the world as before: the same world, the same orders, byte for byte', () => {
    // (prints taken before levels could carry a goal)
    const w = composeGameworld({ prompt: 'a haunted forest of misty hills', seed: 2 });
    expect(w.brief.goal).toBeUndefined();
    expect(Object.values(w.levels).every((l) => l.goal === undefined)).toBe(true);
    // (a composed world writes its juice, 'auto', since juice styling: the print is the world's without it)
    expect(w.juice).toBe('auto');
    // (and how it starts, since a game laid from a sentence starts in play, 2026-11-13: its flow, 'play', and the line
    // its brief says it in (gameworld/compose.js). The print is the world's without them too, so the pin below holds as
    // it was: nothing else in the world moved)
    expect(w.flow).toBe(FLOW_IN_PLAY);
    expect(w.brief.start).toMatch(/straight into play/);
    const { start: _s, ...brief } = w.brief;
    const unjuiced = Object.fromEntries(Object.keys(w).filter((k) => k !== 'juice' && k !== 'flow').map((k) => [k, k === 'brief' ? brief : w[k]]));
    // (re-pinned 2026-11-02, 1102-book-powers: a composed world's builders are its cube's where the prompt names no
    // language (gameworld/compose.js: the cube's builders become the anchor, so its town is drawn in the art direction it
    // stands in): this haunted forest's gothic-night cube builds tiered, so its civilization is the tiered folk, not a
    // rolled shell folk; nothing else in the world moved, 31e98788 -> ed00debc)
    expect(fingerprint(unjuiced)).toBe('ed00debc');
    // (its levels being reach-exit, the game is checked after it is made: one audit step a level, at the level's ref
    // (runner.js auditSteps). The orders the levels and the game are made from, without the audits, are the print taken
    // before levels could carry a goal: the game order asked create_game for the audit once, and the pins below were
    // taken without that flag, so they hold as they were)
    const steps = runSteps(unjuiced, { ref: 'gw' });
    expect(steps.filter((s) => s.audit).map((s) => s.ref)).toEqual(steps.filter((s) => s.key.startsWith('level-')).map((s) => s.ref));
    expect(steps.find((s) => s.key === 'game').order.auto_audit).toBeUndefined();
    const unaudited = (ss) => ss.filter((s) => !s.audit).map((s) => s.order);
    const orders = steps;
    // (re-pinned 2026-10-25 merging 1024-geocube-composition-update: geocube styles rewrote the gothic-night preset, so the
    // kit its variant is named by hashes anew, geocube-gothic-night-variant-9bedf4 -> -f88cc1; nothing else in the orders moved)
    // (re-pinned 2026-10-25, 1025-land-into-cube: the levels now carry their land. A composed world has always written
    // style.land, and MEADOWMARK's examples too; the level orders now carry it lowered (the trails' mounds, rocks and
    // cliff, the climb's relief, the cube's clouds), f8c60bfb -> 2471fa9c, c42f5e2b -> 9ad2a5b7, 35dcc6ea -> 0b5f8e90;
    // the world itself is unchanged, its print above as it was)
    // (re-pinned 2026-10-26: a climb after a trail under a level's clouds names the look its own stage draws, the cube's
    // look under those clouds; the two climbs' meru.after.kit moved, geocube-gothic-night-variant-f88cc1 -> -011c7d, and
    // nothing else, 2471fa9c -> b771729c)
    // (re-pinned 2026-10-27, 1026-gen7-island: the meru island is every cube's outside at a game's scale and geo only
    // (era/geocube.js MERU_ISLE: its tiers ×3, `walk: 'none'`, a sea and a high side), so the cube's outside each level's
    // order carries moved; the levels build as before, their trails, climbs and walk the same, b771729c -> 0e1c91bc)
    // (re-pinned 2026-11-03, 1103-game-design-studio-abstraction: a climb's level lays the ladder its climb names as the
    // surface the hero climbs (levels.js climbLadders: playscape's ladder, lowered), where the meru drew a stand-in no
    // body could take hold of, so a climb's top was out of reach. Each order without its ladders is the print it was:
    // nothing else moved, 0e1c91bc, 9ad2a5b7, and the hero world's 2c76a7f0 below; with them, the pins after)
    // (re-pinned 2026-11-02, 1102-book-powers: the hero's powers act. Its attack power's key fires its beam at the
    // nearest foe in front (0b5f8e90 -> f11ad354), and a later stage's power fires only once its node is gained, its
    // refusal said (f11ad354 -> bef8c054); its attack's hurt follows the power stat as it rises, the stats binding the
    // power stat to the hero's body (bef8c054 -> 88aa4298); every level that plays takes the book's one UI direction,
    // its seed the world's, in place of a fresh one each (88aa4298 -> 8db45f48); the levels' cues, stats and ui moved)
    // (re-pinned 2026-11-02, 1102-book-gates: a hero's chase is laid long by the follow camera's stand-off
    // (playscape/hero-chase.js), so the hero world's level orders carry its camera at 8.45 / 2.948, and nothing else
    // moved, 0b5f8e90 -> 4246de56; the hero-less worlds above are unchanged)
    // (re-pinned 2026-11-03 at the merge of 1026-consolidated into 1102-book-powers: both of the above at once, the
    // powers' orders with the chase's camera, 8db45f48 | 4246de56 -> 2c76a7f0)
    // (re-pinned 2026-11-04, 1104-hero-walk-run: a hero runs on the library's jog and walks on its walk, Z held or a pad's
    // stick tilted, so the hero world's pilots carry the platform rule's walkSpeed and walkStride, the library's walk and
    // jog in place of the hero's own door gaits (stride 1.72 -> 3.3) and the legend's "Z  walk". A diff of the orders is
    // those lines and nothing else; the hero-less worlds are unchanged. 2c76a7f0 -> 3498540d, c954dd75 -> 4e44b89a)
    const unladdered = (os) => os.map((o) => (Array.isArray(o?.manifest?.entities) ? { ...o, manifest: { ...o.manifest, entities: o.manifest.entities.filter((e) => !String(e.id).startsWith('ladder-')) } } : o));
    const ground = runSteps({ ...MEADOWMARK, mode: 'autonomous', review: undefined }, { ref: 'gw' }), hero = runSteps(MEADOWMARK_HERO, { ref: 'gw' });
    // (re-pinned 2026-11-07 at 1105-platformer-lv0-spike's merge of 1105-rpg-slice, its play grade: every level order
    // carries `figureGrade: 'play'` (the tighter gameplay figures), one line an order, 0e1c91bc -> c9c3c6b8 and
    // 9ad2a5b7 -> 33b4c186; the hero world's as well, and its pilots run on the play grade's `jog` state (its stride the
    // grade's) where they named the library's Jog_Fwd_Loop. Nothing else in the orders moved)
    // (re-pinned 2026-11-19, 1118-jrpg-starter: a new level's trail stage on an isekai land is written with the form
    // render's grass and no grass hat on its rocks, gameworld/levels.js withFormGrass (`grass: { form: true }`,
    // `hats: 'lips'`): those two words on each trail stage's manifest and nothing else; without them every order below
    // prints as it did. c9c3c6b8 -> a0e638e8, 33b4c186 -> 64b2bc96, 71917dd0 -> cd58ee08, aa47dab1 -> c97f28f9,
    // b14f4c0f -> 610ba5bf, 323e54e5 -> fd0f2b8d)
    // (re-pinned 2026-11-25, 1123-meteroidvania-rail merging 1124-side-scroll-backgrounds: a geocube carries the box its
    // metroidvania is built in (gameworld/metroidvania/cube.js: the cube's library and its tint), so each level's
    // geocube style gains `box: { library: 'castle', tint: 0 }` for this gothic cube and nothing else moved, a0e638e8 -> b09bbe72)
    expect(fingerprint(unladdered(unaudited(orders)))).toBe('b09bbe72');
    expect(fingerprint(unladdered(unaudited(ground)))).toBe('64b2bc96');
    // (re-pinned 2026-11-07, 1107-action-rpg merging 1105-rc: the hero's figure maps the library's Sprint_Loop as its
    // `sprint` clip (playscape/player.js, the stamina sprint's legs), one more clip in each order's hero figure and nothing
    // else: without it the orders print 3229f9a0 as before, 3229f9a0 -> 71917dd0)
    expect(fingerprint(unladdered(unaudited(hero)))).toBe('cd58ee08');   // (3498540d -> 3229f9a0: the play grade, above)
    expect(fingerprint(unaudited(orders))).toBe('b57152eb');   // (642958c3 -> aa47dab1: the play grade, above; c97f28f9 -> b57152eb: the cube's box, above)
    expect(fingerprint(unaudited(ground))).toBe('610ba5bf');   // (eadb7584 -> b14f4c0f: the play grade, above)
    expect(fingerprint(unaudited(hero))).toBe('fd0f2b8d');   // (4e44b89a -> 2448f711: the play grade; -> 323e54e5: the sprint clip, above)
  }, 300000);

  it('a dungeon is indoors: building levels in a room kit, the goals laid in their rooms, made by the run', () => {
    const w = composeGameworld({ prompt: 'a dungeon crawler through haunted crypts with relics and a boss', seed: 1 });
    const read = Object.fromEntries(w.brief.read.map((r) => [r.word, r.decides]));
    // "dungeon crawler" also names the game: its words decide the intent (intent.js)
    expect(read).toMatchObject({ dungeon: ['building', 'intent.from=dungeon-crawler'], crawler: ['intent.from=dungeon-crawler'], crypts: ['building', 'geocube'], relics: ['goal.collect'], boss: ['goal.boss'] });
    expect(w.intent).toEqual({ from: 'dungeon-crawler' });
    const ids = Object.keys(w.levels);
    expect(w.brief.indoors).toEqual({ use: 'crypt', kit: 'gothic-stone', levels: ids });
    for (const id of ids) {
      expect(w.levels[id].building).toEqual({ use: 'crypt', kit: 'gothic-stone' });
      expect(w.levels[id].walk).toBeUndefined();
      expect(w.levels[id].goal).toEqual({ collect: 'relic', ...(id === ids.at(-1) ? { boss: true } : {}) });
    }
    const S = runSteps(w, { ref: 'gw' }), L = levelSteps(S);
    // (a crawler's sentence comes with its hero, genre-forms.js heroFrameOf: made first, the levels' pilot; armed by its
    // genre, a sword in melee: the hero equipped and the sword it carries made before the levels)
    expect(S.map((s) => s.key)).toEqual(['hero', 'hero-equipped', 'foe', 'gear-sword', ...ids.map((id) => `level-${id}-0`), 'game']);
    for (const s of L) {
      expect(s.order.manifest).toMatchObject({ kind: 'stage', kit: 'gothic-stone', program: { use: 'crypt' } });
      const C = gameOf(s).mechanics.find((m) => m.kind === 'collect');
      // the relics lie in the rooms between the way in and the tomb
      expect(C.pickups.length).toBeGreaterThan(0);
      expect(C.pickups.every((p) => p.item === 'relic')).toBe(true);
    }
    // the boss in the last crypt's tomb, beside the hero: its fall ends it, the tomb no longer the exit
    const end = L.at(-1);
    expect(kinds(end)).toEqual(['collect', 'bag', 'fail-on-death', 'win-when']);
    expect(end.order.manifest.level.exit).toBe(false);
    expect(end.order.manifest.entities.map((e) => [e.id, !!e.pilotable])).toEqual([['hero', true], ['boss', false]]);
    expect(withBuildingLevel(end.order.manifest, end.ref).entities.map((e) => e.id)).toEqual(['hero', 'boss']);
    expect(readBattle(end.order.manifest.play).foes[0].who).toBe('boss');
    for (const s of L.slice(0, -1)) expect(kinds(s)).toEqual(['collect', 'bag', 'reach-exit']);
    composes(S);
    // named ground outside: the first level is that ground, the way in; a temple is a temple in a nave
    const T = composeGameworld({ prompt: 'a dark forest above a temple tomb', seed: 1 }), tids = Object.keys(T.levels);
    expect(T.levels[tids[0]].walk).toBeDefined();
    expect(tids.slice(1).map((id) => T.levels[id].building)).toEqual(tids.slice(1).map(() => ({ use: 'temple', kit: 'catacomb' })));
    expect(T.brief.read.find((r) => r.word === 'temple').decides).toContain('building.use');
  }, 300000);

  it('a level goal is a level setting: read, refused where it cannot be laid; a booked world plays it too', () => {
    const lv = (goal, extra = {}) => ({ ...MEADOWMARK, levels: { ...MEADOWMARK.levels, 'meadow-ascent': { ...MEADOWMARK.levels['meadow-ascent'], goal } }, ...extra });
    expect(readGameworld(lv({ collect: 'coin', boss: true, health: true })).levels['meadow-ascent'].goal).toEqual({ collect: 'coin', boss: true, health: true });
    expect(() => readGameworld(lv({}))).toThrow(/at least one/);
    expect(() => readGameworld(lv({ treasure: true }))).toThrow(/not a level goal \(collect, boss, health, guards, escape, gauntlet, tasks\)/);
    expect(() => readGameworld(lv({ collect: 'Big Gems' }))).toThrow(/one lower-case word/);
    expect(() => readGameworld(lv({ boss: 2 }))).toThrow(/boss is true/);
    // a book's world: its hero fights the boss, the goal's play beside the systems' own
    const W = { ...MEADOWMARK_HERO, levels: { ...MEADOWMARK_HERO.levels, 'meadow-ascent': { ...MEADOWMARK_HERO.levels['meadow-ascent'], goal: { collect: 'coin', boss: true } } } };
    const S = runSteps(W, { ref: 'gw' });
    expect(S.map((s) => s.key)).toContain('foe');
    const A = levelSteps(S).filter((s) => s.key.startsWith('level-meadow-ascent-'));
    expect(A.every((s) => kinds(s).includes('collect') || !s.order.manifest.trail)).toBe(true);
    expect(kinds(A.at(-1))).toContain('win-when');
    const sys = S.find((s) => s.key === 'systems'), own = sys.order.manifest?.play?.menus ?? [];
    for (const m of own) expect(A[0].order.manifest.play.menus).toContainEqual(m);
    // the other level is as it was
    const before = levelSteps(runSteps(MEADOWMARK_HERO, { ref: 'gw' })).filter((s) => s.key.startsWith('level-shell-shore-'));
    expect(levelSteps(S).filter((s) => s.key.startsWith('level-shell-shore-')).map((s) => s.print)).toEqual(before.map((s) => s.print));
  }, 300000);
});

// a party RPG round its town: the dungeon and the castle named do not turn the world indoors; each is a level of the hub
describe('composed: a party RPG round its town, its castle and its dungeon', () => {
  const W = composeGameworld({ prompt: 'a medieval fantasy jrpg: a fortified town with a castle, a field with monsters, a dungeon with a boss' });
  const ids = Object.keys(W.levels);
  // (its levels' steps, laid once for the tests that read them: a whole world's stages)
  let S0 = null;
  const steps = () => (S0 ??= runSteps(W, { ref: 'gw' }));

  it('lays the town at the centre, the wilds, the castle\'s level, and the dungeon last with the boss at its end', () => {
    expect(W.hub).toBe(ids[0]);
    expect(W.start).toBe(ids[0]);
    expect(W.levels[ids[0]].places.street).toMatchObject({ enter: ['shop', 'inn', 'temple'], walls: true });
    const last = W.levels[ids[ids.length - 1]];
    expect(last.building).toMatchObject({ use: 'crypt' });
    expect(last.goal).toMatchObject({ boss: true });
    expect(W.levels[W.brief.round.castle].places.castle).toBeTruthy();
    expect(W.brief.round).toMatchObject({ dungeon: ids[ids.length - 1], trades: ['inn', 'temple'] });
  });

  it('is laid as a mandala: the town outermost, the wilds and the castle round it, the dungeon the core behind the castle\'s key', () => {
    const core = ids[ids.length - 1], castle = W.brief.round.castle;
    expect(W.megaworld).toMatchObject({ shape: 'mandala', rings: [[W.hub], expect.arrayContaining([castle]), [core]], gates: { [core]: { key: 'crypt-key', keyAt: castle } } });
    expect(W.megaworld.rings[1]).toHaveLength(ids.length - 2);
    // (its links the megaworld's: a road from the town to each of the second ring, the core's way gated by its key)
    expect(W.links).toEqual(megaworldLinks(W.megaworld));
    expect(W.links.filter((l) => l.from === W.hub).map((l) => l.to).sort()).toEqual([...W.megaworld.rings[1]].sort());
    expect(W.links.find((l) => l.to === core)).toMatchObject({ kind: 'gate', key: 'crypt-key', keyAt: castle });
    expect(megaworldLaws(W.megaworld).every((L) => L.ok)).toBe(true);
    expect(W).toMatchObject({ hub: ids[0], start: ids[0], topology: 'interconnected' });
    expect(W.brief.round.mandala).toMatchObject({ core, key: 'crypt-key', keyAt: castle });
    // (without a dungeon the castle is the core, its key in the farthest wilds; with neither, the farthest wilds')
    const C = composeGameworld({ prompt: 'a jrpg: a fortified town with a castle' }), cid = Object.keys(C.levels);
    expect(C.megaworld.rings[2]).toEqual([C.brief.round.castle]);
    expect(C.megaworld.gates[C.brief.round.castle]).toMatchObject({ key: 'castle-key', keyAt: C.megaworld.rings[1][0] });
    expect(cid.length).toBeGreaterThanOrEqual(3);
    expect(megaworldLaws(C.megaworld).every((L) => L.ok)).toBe(true);
  });

  it('stands on the green valley\'s cube, gritty, each place its own flora: the wilds in groves by a lake, the castle on the upland', () => {
    expect(W.brief.cube).toMatchObject({ id: 'valley-morning', from: 'a party RPG round its town' });
    expect(W.style.geocube).toMatchObject({ from: 'valley-morning', grit: 0.5 });
    const castle = W.brief.round.castle, wilds = ids.filter((id, i) => i > 0 && W.levels[id].walk && id !== castle);
    expect(wilds.length).toBeGreaterThan(0);
    expect(W.levels[wilds[0]].style.geocube).toMatchObject({ from: 'valley-morning', biocube: 'grove', outside: { water: { lake: true } } });
    expect(W.levels[castle].style.geocube).toMatchObject({ biocube: 'upland' });
    expect(W.levels[W.hub].style?.geocube).toBeUndefined();
    // (a word naming a cube or what grows is the world's: it is kept, and every place grows it)
    const N = composeGameworld({ prompt: 'a gothic jrpg: a fortified town with a castle, a dungeon with a boss' });
    expect(N.brief.cube).toMatchObject({ id: 'gothic-night', word: 'gothic' });
    const D = composeGameworld({ prompt: 'a desert jrpg: a fortified town with a castle, a dungeon with a boss' });
    expect(Object.values(D.levels).every((L) => L.style?.geocube?.biocube === undefined)).toBe(true);
  });

  it('a hub game that names neither keeps its old shape: the town, the wilds, the last raising its castle', () => {
    const V = composeGameworld({ prompt: 'a jrpg in a green valley' }), vid = Object.keys(V.levels);
    expect(V.hub).toBe(vid[0]);
    expect(V.levels[vid[vid.length - 1]].places).toMatchObject({ castle: true });
    expect(V.brief.round).toMatchObject({ trades: ['inn', 'temple'] });
    expect(V.brief.round.castle).toBeUndefined();
  });

  it('its levels make: the town\'s street stands its inn and temple at their doors', () => {
    const S = steps();
    const town = levelSteps(S).find((s) => s.order.manifest.town);
    expect(town.order.manifest.town.enter).toEqual(['shop', 'inn', 'temple']);
    expect(levelSteps(S).some((s) => s.key.startsWith(`level-${ids[ids.length - 1]}`))).toBe(true);
  }, 180000);

  it('its places are travelled by the mandala\'s ways: the second ring from the town and back, the core past its gate, each stretch its own packs', () => {
    const S = runSteps({ ...W, battles: { random: { every: 12, chance: 0.25 } } }, { ref: 'gw' });
    const game = S.find((s) => s.key === 'game').order, out = (lvl) => game.levels.find((l) => l.ref === `gw-level-${lvl}-0`).exits, exits = (lvl) => out(lvl).map((e) => e.to);
    for (const id of W.megaworld.rings[1]) {
      expect(exits(W.hub)).toContain(`gw-level-${id}-0`);
      expect(exits(id)).toContain(`gw-level-${W.hub}-0`);
    }
    // (the core reached from the farthest wilds, its way shut until the castle's key is held; the game's atlas the rings)
    const core = ids[ids.length - 1], far = W.megaworld.rings[1][0];
    const way = game.levels.filter((l) => l.ref.startsWith(`gw-level-${far}-`)).flatMap((l) => l.exits).find((e) => e.to === `gw-level-${core}-0`);
    expect(way?.gate).toMatchObject({ has: 'crypt-key' });
    expect(game.levels.filter((l) => l.ref.startsWith(`gw-level-${core}-`)).flatMap((l) => l.exits).some((e) => e.to.startsWith(`gw-level-${far}-`))).toBe(true);
    expect(game.atlas).toMatchObject({ shape: 'mandala', rings: [[`gw-level-${W.hub}-0`], expect.any(Array), [`gw-level-${core}-0`]] });
    // (the field's stretches each roll their own packs: a region's encounters are the stage's)
    const field = levelSteps(S).filter((s) => s.key.startsWith(`level-${ids[1]}-`)).map((s) => s.order.manifest.play?.rpg?.random?.sets);
    expect(field.every((sets) => Array.isArray(sets) && sets.length > 0)).toBe(true);
    expect(levelSteps(S).find((s) => s.key.startsWith(`level-${W.hub}-`)).order.manifest.play?.rpg?.random).toBeUndefined();
  }, 180000);

  it('the castle walked: its level stands the castle\'s ward on its trail, the keep inside its curtain entered at its door', () => {
    const S = steps();
    const m = levelSteps(S).find((s) => s.key.startsWith(`level-${W.brief.round.castle}`) && s.order.manifest.buildings).order.manifest;
    expect(m.buildings).toEqual([expect.objectContaining({ use: 'keep', enter: 'door' })]);
    expect(m.town).toMatchObject({ enter: 0, walls: expect.anything(), street: true });
    const P = assembleStageScene(m);
    const keep = P.anchors.find((a) => a.kind === 'building' && a.use === 'keep');
    expect(keep).toMatchObject({ enter: 'door', inside: { use: 'keep' } });
    const C = P.colliders.filter((c) => String(c.of).startsWith('town:walls')), xs = C.flatMap((c) => [c.min[0], c.max[0]]), ys = C.flatMap((c) => [c.min[1], c.max[1]]);
    expect(keep.at[0] > Math.min(...xs) && keep.at[0] < Math.max(...xs) && keep.at[1] > Math.min(...ys) && keep.at[1] < Math.max(...ys)).toBe(true);
  }, 180000);
});
