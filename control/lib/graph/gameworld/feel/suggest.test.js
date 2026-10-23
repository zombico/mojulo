import { describe, it, expect } from 'vitest';
import { POLES, POLE_IDS } from './cards.js';
import { FEEL_WORDS, GENRE_FEEL, suggestFeels, shooterPoleFeel, feelSuggestion } from './suggest.js';
import { feelCard, lowerFeel } from './lower.js';
import { GENRES, QUICK_GENRE } from '../intent.js';
import { composeGameworld } from '../compose.js';

// WHICH FEEL: a default is suggested from the brief's words, a deathmatch's shooter pole or the genre, and written by
// the composer when a prompt names a template; never laid on a world that writes none.

describe('the tables', () => {
  it('every template has words a brief uses; every genre default names a genre and a template that exist', () => {
    expect(Object.keys(FEEL_WORDS).sort()).toEqual([...POLE_IDS].sort());
    for (const [g, d] of Object.entries(GENRE_FEEL)) { expect(GENRES[g]).toBeTruthy(); expect(POLES[d.pole]).toBeTruthy(); expect(d.why.length).toBeGreaterThan(10); }
  });
});

describe('suggesting', () => {
  it('reads the words a brief uses, a phrase whole, the most words first', () => {
    expect(suggestFeels('a mega man style run and gun through a mech factory').map((s) => s.pole)).toEqual(['galaxy-boy', 'mech-battle-kai']);
    expect(suggestFeels('the mechanic fixes the machine')).toEqual([]);   // 'mech' is a word, not a prefix
  });

  it('a world that writes its feel is suggested nothing; else its words, then a deathmatch\'s shooter pole, then its genre', () => {
    const quickGenre = Object.keys(QUICK_GENRE).find((q) => GENRE_FEEL[QUICK_GENRE[q]] && q !== 'deathmatch');
    expect(feelSuggestion({ feel: 'galaxy-boy', brief: { prompt: 'like mario' } })).toBeNull();
    expect(feelSuggestion({ brief: { prompt: 'like mario' }, quick: { goal: quickGenre } })).toMatchObject({ feel: 'jumping-giuseppe', from: 'words' });
    expect(feelSuggestion({ quick: { goal: 'deathmatch', pole: 0.5 } })).toMatchObject({ feel: { pole: 'conscription', toward: 'infinity-crisis', t: 0.5 }, from: 'shooter-pole' });
    expect(feelSuggestion({ quick: { goal: quickGenre } })).toMatchObject({ feel: GENRE_FEEL[QUICK_GENRE[quickGenre]].pole, from: 'genre' });
    const offFeet = Object.keys(GENRES).find((g) => !GENRE_FEEL[g]);
    expect(feelSuggestion({ intent: { from: offFeet } })).toBeNull();
  });

  it('the shooter pole is one dial with the feel: realistic is Conscription, stylized Infinity Crisis, the run between', () => {
    expect(shooterPoleFeel('realistic')).toEqual({ pole: 'conscription' });
    expect(shooterPoleFeel('stylized')).toEqual({ pole: 'infinity-crisis' });
    const run = (f) => lowerFeel(feelCard(f)).rule.speed, a = run('conscription'), b = run('infinity-crisis'), m = run(shooterPoleFeel(0.5));
    expect(m).toBeGreaterThan(Math.min(a, b)); expect(m).toBeLessThan(Math.max(a, b));
  });
});

describe('the composer writes it', () => {
  it('a prompt that names a template composes a world that plays it (its words read); one that names none writes none', () => {
    const W = composeGameworld({ prompt: 'a mega man style run and gun across stormy cliffs', seed: 1 });
    expect(W.feel).toBe('galaxy-boy');
    expect(W.brief.tunnels.feel).toEqual(['mega man', 'run and gun']);
    expect(W.brief.unread).not.toContain('mega');
    const P = composeGameworld({ prompt: 'stormy cliffs', seed: 1 });
    expect('feel' in P).toBe(false);
    expect('feel' in P.brief.tunnels).toBe(false);
  });
});
