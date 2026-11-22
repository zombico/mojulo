// game-bodies: the body rails. The concepts: a game reads its rail from its feel, else its genre, else none; the style is
// the world's (the tradition, the look, the medium), never the rail's; a role's words resolve their pole and mint through
// the hero door; a body word is a rail, 'game' or { rail, style }.
import { describe, it, expect } from 'vitest';
import { GAME_BODIES, GAME_BODY_NAMES, GAME_BODY_ROLES, railOfGame, styleOf, gameBody, readBodyWord, BODY_LIGHTS, bodyLightOf } from './game-bodies.js';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { withDefaultForm } from '../polygonizer/motion-stamp.js';
import { GENRES } from './intent.js';
import { QUICK_GOALS } from './quick.js';
import { POLES } from './feel/cards.js';
import { TRADITIONS } from './characters.js';

describe('the body rails', () => {
  it('names only genres and feels that exist, each on one rail', () => {
    const genres = GAME_BODY_NAMES.flatMap((r) => GAME_BODIES[r].genres), feels = GAME_BODY_NAMES.flatMap((r) => GAME_BODIES[r].feels);
    for (const g of genres) expect(GENRES[g], g).toBeTruthy();
    for (const f of feels) expect(POLES[f], f).toBeTruthy();
    for (const g of GAME_BODY_NAMES.flatMap((r) => GAME_BODIES[r].goals)) expect(QUICK_GOALS[g], g).toBeTruthy();
    expect(new Set(genres).size).toBe(genres.length);
    expect(new Set(feels).size).toBe(feels.length);
  });
  it('reads the rail from the feel over the genre, and none from a game that names neither', () => {
    expect(railOfGame({ genre: 'versus-fighter' }).rail).toBe('muscular');
    expect(railOfGame({ genre: 'versus-fighter', feel: 'vigilante-justice' })).toMatchObject({ rail: 'comic', from: 'feel' });
    expect(railOfGame({ goal: 'fight' })).toMatchObject({ rail: 'muscular', from: 'goal' });
    expect(railOfGame({ genre: 'farming' })).toBeNull();
    expect(railOfGame({})).toBeNull();
  });
  it('draws a rail in the world\'s style: the tradition, the look, the medium', () => {
    expect(styleOf('comic', { tradition: 'anime' }).style).toBe('anime');
    expect(styleOf('comic', { tradition: 'western' }).style).toBe('ink');
    expect(styleOf('comic', { tradition: 'western', look: 'material' }).style).toBe('material');
    expect(styleOf('realistic', { tradition: 'western' }).style).toBe('western');
    expect(styleOf('mascot', { tradition: 'anime' }).style).toBe('mascot');
    expect(styleOf('mascot', { pixel: true }).style).toBe('lowpoly');
    expect(() => styleOf('mascot', { style: 'anime' })).toThrow(/mascot \| lowpoly/);
  });
  it('resolves a role\'s pole and mints it through the hero door, in each style, under the tradition\'s head', () => {
    // (one pole per style, alternating, so each codename and build is read on both poles across the table)
    let i = 0;
    for (const rail of GAME_BODY_NAMES) for (const style of Object.keys(GAME_BODIES[rail].styles)) for (const role of GAME_BODY_ROLES) {
      const pole = i++ % 2 ? 'female' : 'male', B = gameBody(rail, role, { style, pole });
      const T = TRADITIONS[style === 'anime' ? 'anime' : 'western'];
      const head = B.spec.cast?.build === 'chibi' ? {} : { head: T.head, ...(B.spec.form === 'realistic' ? {} : { proportions: T.proportions }) };
      const spec = { ...(B.spec.cast ? {} : { cast: pole }), ...head, ...B.spec };
      const hero = heroRecord(withDefaultForm(spec));
      expect(Object.keys(expandLayeredManifest({ kind: 'layered', hero }).recipe.parts).length, `${rail} ${style} ${role}`).toBeGreaterThan(10);
      if (B.spec.animeBody) expect(hero.animeBodyResolved.pole).toBe(pole);
    }
  }, 240000);
  it('the toy hero robot is a rail of its own: the run and gun reads it, and its head stays bare so its proportions stand', () => {
    expect(railOfGame({ feel: 'galaxy-boy' })).toMatchObject({ rail: 'herobot', from: 'feel' });
    expect(railOfGame({ genre: 'metroidvania' }).rail).toBe('herobot');
    expect(railOfGame({ feel: 'jumping-giuseppe' }).rail).toBe('mascot');
    expect(styleOf('herobot', { tradition: 'anime' }).style).toBe('herobot');
    expect(styleOf('herobot', { pixel: true }).style).toBe('lowpoly');
    const B = gameBody('herobot', 'hero');
    expect(B.spec).toMatchObject({ proportions: 'herobot', head: 'anime', animeStyle: null });
    // (the door stamps a head cast only where none is said: a bare head said is kept, so no cast's body tune lands on it)
    expect(withDefaultForm({ cast: 'male', ...B.spec }).animeStyle).toBeNull();
  });
  it('puts the muscle shirt on only when asked: the role\'s definition, or the world\'s; a western body has none to put on', () => {
    expect(gameBody('muscular', 'hero', { tradition: 'anime' }).spec.muscleShirt).toBeUndefined();
    expect(gameBody('muscular', 'hero', { tradition: 'anime', muscle: true }).spec.muscleShirt).toEqual({ definition: 1 });
    expect(gameBody('comic', 'hero', { tradition: 'anime', muscle: 0.2 }).spec.muscleShirt).toEqual({ definition: 0.2 });
    expect(gameBody('muscular', 'hero', { tradition: 'western', muscle: true }).spec.muscleShirt).toBeUndefined();
    expect(gameBody('realistic', 'hero', { tradition: 'anime', pole: 'female' }).spec.animeBody).toBe('shonen-high');
  });
  it('reads a body word: a rail, the game\'s, or a rail in a style', () => {
    expect(readBodyWord('comic')).toBe('comic');
    expect(readBodyWord('game')).toBe('game');
    expect(readBodyWord({ rail: 'mascot', style: 'lowpoly' })).toEqual({ rail: 'mascot', style: 'lowpoly' });
    expect(() => readBodyWord('hulk')).toThrow(/body rail/);
    expect(() => readBodyWord({ rail: 'game', style: 'ink' })).toThrow(/name the rail/);
    expect(readBodyWord({ rail: 'game', muscle: true })).toEqual({ rail: 'game', muscle: true });
    expect(() => readBodyWord({ rail: 'comic', muscle: 2 })).toThrow(/definition 0 to 1/);
  });
  it('a rail\'s body light: the side scroller\'s and the mascot\'s cel, a body\'s light and never its face\'s; the others none', () => {
    expect(bodyLightOf({ feel: 'galaxy-boy' })).toBe('cel');
    expect(Object.keys(BODY_LIGHTS).every((r) => GAME_BODY_NAMES.includes(r))).toBe(true);
    const other = GAME_BODY_NAMES.find((r) => !BODY_LIGHTS[r] && GAME_BODIES[r].feels.length);
    if (other) expect(bodyLightOf({ feel: GAME_BODIES[other].feels[0] })).toBeNull();
    expect(bodyLightOf({})).toBeNull();
  });
});
