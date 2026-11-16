import { describe, it, expect } from 'vitest';
import { platformerGame, platformerFlow, platformerSuggestion, platformerPole, dimensionOf, PLATFORMER_DIMENSIONS, PLATFORMER_TURN } from './platformer-game.js';
import { firstLevel, firstLevelSegments, FIRST_LEVEL_COURSES, FIRST_LEVEL_SEGMENTS } from './first-level.js';
import { readGameworld, MEADOWMARK_HERO } from './index.js';
import { gameStages, stageLevelOrder, isStrip } from './levels.js';
import { worldFlow } from './game-flow.js';
import { readFlow, walkFlow, defaultFlow } from '../game/flow.js';
import { TURN_PHASES } from '../game/turn.js';
import { readFront } from '../game/play-front.js';
import { runSteps } from './index.js';
import { applyManifestPatch } from '../../mcp/tools/manifest-patch.js';

// A PLATFORMER'S GAME in its two dimensions: the side-scroller as it was (one strip, one turn, the flow a game has always
// had), and the 3D platformer (courses up a hill, a turn each, its own flow round the courses screen).
const hero = () => { const W = { ...MEADOWMARK_HERO }; delete W.links; delete W.start; delete W.hub; delete W.levels; delete W.review; return W; };
const world = (dimension, more = {}) => ({ ...hero(), ...platformerGame({ dimension, ...more }).words });

describe('the rail, as words', () => {
  it('2d is the side-scroller as it was: the side camera, the first level as firstLevel lays it, no flow of its own', () => {
    const G = platformerGame();
    expect(G.dimension).toBe('2d');
    expect(G.words.camera).toBe('side');
    expect(G.words.levels).toEqual({ first: firstLevel() });
    expect(G.words.flow).toBeUndefined();
    expect(platformerFlow('2d')).toBeNull();
    expect(G.words.feel).toEqual({ pole: 'jumping-giuseppe', takes: true });
  });

  it('3d is courses up a hill under a chase the player turns, with a flow of its own; a boss is the summit', () => {
    const G = platformerGame({ dimension: '3d', boss: { win: 'rival' } }), L = G.words.levels.hill;
    expect(G.words.camera).toBe('orbit');
    expect(Object.keys(L.walk.nodes)).toEqual(FIRST_LEVEL_COURSES);
    expect(Object.values(L.course).map((c) => c.teach)).toEqual(Object.values(firstLevel({ boss: true }).course).map((c) => c.teach));
    expect(L.foes.density.grounds).toBe('none');
    expect(L.goal).toEqual({ boss: { win: 'rival' } });
    // (its start menu: the way into the courses screen and back to a save; the side-scroller's title is the plain one)
    expect(G.words.front).toEqual({ menu: ['continue', 'play', 'levels'] });
    expect(readFront(G.words.front, { levels: 5 })).toEqual([]);
    expect(platformerGame().words.front).toBeUndefined();
    // (made for a screen on its side; a stored world's upright phone is said, never changed)
    expect(G.words.screen).toBe('screen');
    expect(platformerGame().words.screen).toBeUndefined();
    expect(platformerGame({ dimension: '3d', camera: 'follow' }).words.camera).toBe('follow');
    expect(() => platformerGame({ dimension: '3d', camera: 'side' })).toThrow(/orbit \| follow/);
    expect(() => platformerGame({ dimension: '4d' })).toThrow(/2d .* or 3d/);
    // (the round is the mascot platformer's: another platformer's template stays on its lane)
    const other = Object.keys(PLATFORMER_DIMENSIONS).length && 'galaxy-boy';
    expect(() => platformerGame({ dimension: '3d', pole: other })).toThrow(/played in 2d/);
    expect(platformerGame({ pole: other }).words.feel.pole).toBe(other);
  });

  it('the default first level is untouched by the dimension word', () => {
    expect(firstLevel({ dimension: '2d', boss: true })).toEqual(firstLevel({ boss: true }));
    expect(firstLevelSegments('2d', true).map((s) => s.id)).toEqual(FIRST_LEVEL_SEGMENTS);
    expect(() => firstLevelSegments('iso')).toThrow(/2d \| 3d/);
  });

  it('each dimension says its turn, phase by phase', () => {
    for (const d of Object.keys(PLATFORMER_DIMENSIONS)) expect(Object.keys(PLATFORMER_TURN[d])).toEqual(expect.arrayContaining([...TURN_PHASES, 'interrupt']));
  });
});

describe('the 3D flow: every course a turn, entered from the courses screen and left to it', () => {
  const F = platformerFlow('3d'), levels = ['a', 'b', 'c'];
  const ctx = (open) => ({ resolve: (sp, c) => (sp === '$first' ? 'a' : sp === '$picked' ? c.picked ?? null : sp === '$again' ? c.level : sp === '$continue' ? null : sp === '$next' ? (open && levels[levels.indexOf(c.level) + 1]) || null : null), guard: () => false });
  const names = (events, c) => walkFlow(F, events, c).map((s) => s.step);

  it('reads as a flow, and as the world\'s own', () => {
    expect(readFlow(F, { levels })).toEqual([]);
    const G = readGameworld(world('3d'));
    expect(worldFlow(G)).toMatchObject({ source: 'own', flow: { home: 'courses' } });
    // (the side-scroller says none: it plays the flow a game has always had)
    expect(readGameworld(world('2d')).flow).toBeUndefined();
  });

  it('a new game plays the first course; won, its result goes on to the next course', () => {
    expect(names(['play', 'won', 'next'], ctx(true))).toEqual(['title', 'course', 'result', 'course']);
  });

  it('the last course won goes back to the courses; a course quit goes there with no result', () => {
    expect(names(['play', 'won', 'next'], ctx(false))).toEqual(['title', 'course', 'result', 'courses']);
    expect(names(['play', 'left'], ctx(true))).toEqual(['title', 'course', 'courses']);
    expect(names(['play', 'lost', 'again'], ctx(true))).toEqual(['title', 'course', 'result', 'course']);
  });

  it('differs from the flow a game has always had only as said: a title first, the courses its home', () => {
    const D = defaultFlow({ levels });
    expect(D.home).toBe('levels');
    expect(D.steps.play.on.left).toBe('result');
    expect(F.steps.course.on.left).toBe('courses');
  });
});

describe('laid in a world', () => {
  it('2d: one strip, one page, one turn', () => {
    const W = world('2d'), stages = gameStages(W);
    expect(stages).toHaveLength(1);
    expect(isStrip(stages[0].manifest)).toBe(true);
  });

  describe('3d', () => {
    const W = world('3d', { boss: true }), G = readGameworld(W), stages = gameStages(W);
    const orders = Object.fromEntries(stages.map((s) => [s.node, stageLevelOrder(G, s, { ref: `lv-${s.node}`, heroRef: 'gw-hero' })]));

    it('every course is a stage of its own, in order, none a strip', () => {
      expect(stages.map((s) => s.node)).toEqual(FIRST_LEVEL_COURSES);
      expect(stages.some((s) => isStrip(s.manifest))).toBe(false);
    });

    it('every course holds its laws as built, under the chase the player turns', () => {
      for (const [node, O] of Object.entries(orders)) {
        expect(O.laws.filter((l) => l.id.startsWith('course:') && !l.holds), node).toEqual([]);
        expect(O.args.manifest.camera, node).toMatchObject({ rule: 'follow', steer: 'orbit' });
      }
    });

    it('coins lie along a course: over its floors, on the trail\'s own line; lives are the game\'s', () => {
      const O = orders.grounds, M = O.args.manifest.game.mechanics, coins = M.find((m) => m.kind === 'coins');
      expect(M.find((m) => m.kind === 'lives')).toMatchObject({ start: 3 });
      expect(coins.pickups.length).toBeGreaterThan(5);
      const floors = O.ends.beats.filter((b) => b.beat.startsWith('floor-')).map((b) => b.at[2]);
      for (const c of coins.pickups) expect(c.at[2]).toBeGreaterThan(Math.min(...floors));
    });

    it('the game it builds carries the flow and the front, with a book and without one', () => {
      const game = (w) => runSteps(w, { ref: 'gw', lookup: () => null }).find((s) => s.key === 'game').order;
      const bare = { ...W }; delete bare.characters; delete bare.equipment;
      for (const g of [game(W), game(bare)]) {
        expect(g.flow).toMatchObject({ start: 'title', home: 'courses', steps: { course: { kind: 'level', level: '$any' } } });
        expect(g.front).toEqual({ menu: ['continue', 'play', 'levels'] });
        expect(g.levels).toHaveLength(FIRST_LEVEL_COURSES.length);
      }
    });

    it('a world without the word lays none (the trail\'s course as it was)', () => {
      const P = { ...W, mechanics: { ...W.mechanics } }; delete P.mechanics.coins;
      const s = gameStages(P)[0], O = stageLevelOrder(readGameworld(P), s, { ref: 'lv-x', heroRef: 'gw-hero' });
      expect(O.args.manifest.game.mechanics.some((m) => m.kind === 'coins')).toBe(false);
    });
  });
});

describe('the rail offered to a world', () => {
  const brief = (prompt, more = {}) => ({ ...hero(), brief: { prompt }, levels: { meadow: { walk: { nodes: { trailhead: { trail: true } } } } }, ...more });

  it('reads the dimension from the camera', () => {
    expect(dimensionOf({ camera: 'side' })).toBe('2d');
    expect(dimensionOf({ camera: 'orbit' })).toBe('3d');
    expect(dimensionOf({ camera: 'follow' })).toBe('3d');
    expect(dimensionOf({ camera: 'top-down' })).toBeNull();
    expect(dimensionOf({})).toBeNull();
  });

  it('is offered to a platformer only: by its feel, else by what its brief points at', () => {
    expect(platformerPole({ feel: 'jumping-giuseppe' })).toEqual({ pole: 'jumping-giuseppe', from: 'feel' });
    expect(platformerPole({ brief: { prompt: 'like mario' } })).toEqual({ pole: 'jumping-giuseppe', from: 'suggested' });
    expect(platformerSuggestion(brief('a souls-like in a ruined keep'))).toBeNull();
    expect(platformerSuggestion({ ...brief('like mario'), feel: 'ebon-spirits' })).toBeNull();
  });

  it('2d by default, the round as its other reading; the brief or the camera can say the round', () => {
    const S = platformerSuggestion(brief('a game like mario'));
    expect(S).toMatchObject({ dimension: '2d', pole: 'jumping-giuseppe', or: { dimension: '3d' } });
    expect(platformerSuggestion(brief('a 3d game like mario'))).toMatchObject({ dimension: '3d', or: { dimension: '2d' } });
    const cam = platformerSuggestion(brief('a game like mario', { camera: 'follow' }));
    expect(cam.dimension).toBe('3d');
    expect(cam.or).toBeUndefined();
    expect(cam.advise).toBeUndefined();
    expect(platformerSuggestion(brief('a game like mario', { camera: 'follow', screen: 'phone' })).advise).toMatch(/upright/);
    expect(cam.patch.some((o) => o.path === '/camera')).toBe(false);
    // (another camera is another game: nothing to offer; so is a level that has its course)
    expect(platformerSuggestion(brief('a game like mario', { camera: 'top-down' }))).toBeNull();
    expect(platformerSuggestion({ ...brief('like mario'), levels: { first: firstLevel() } })).toBeNull();
  });

  it('its patch, applied, is a world that reads and starts on the level it lays; what the world said is kept', () => {
    for (const d of ['2d', '3d']) {
      const W = brief(d === '3d' ? 'mario 64' : 'like mario', { mechanics: { ...(MEADOWMARK_HERO.mechanics ?? {}), lives: 5 } });
      const S = platformerSuggestion(W), P = applyManifestPatch(W, S.patch).manifest ?? applyManifestPatch(W, S.patch);
      const G = readGameworld(P);
      expect(S.dimension).toBe(d);
      expect(G.start).toBe(S.level);
      expect(P.mechanics).toMatchObject({ lives: 5, coins: true, legend: 'menu' });
      expect(P.feel).toEqual({ pole: 'jumping-giuseppe', takes: true });
      expect(P.levels.meadow).toEqual(W.levels.meadow);
      expect(!!P.flow).toBe(d === '3d');
      expect(!!P.front).toBe(d === '3d');
      // (the hero is the creator's: said where the world has none, never laid)
      expect(S.needs).toBeUndefined();
      expect(platformerSuggestion({ ...W, characters: undefined }).needs).toMatch(/a hero/);
      expect(platformerSuggestion(P)).toBeNull();
    }
  });
});
