import { describe, expect, it } from 'vitest';

import { emitPlayShell, playShellRuntime } from './play-shell.js';
import { emitShellFor } from './shell-for.js';
import { emitGameShell } from './game-shell.js';
import { normalizeGameManifest, validateGameManifest } from './game-manifest.js';
import { normalizeLevelContract } from './level-contract.js';

const GAME = normalizeGameManifest({
  kind: 'game',
  title: 'Coin Run',
  shell: 'play',
  store: { slices: [{ name: 'bag', kind: 'inventory' }, { name: 'campaign', kind: 'progression' }] },
  levels: [{ ref: 'run-1', title: 'The Trail' }, { ref: 'run-2', gate: { completed: 'run-1' } }],
});
const CONTRACT = normalizeLevelContract({
  levelRef: 'run-1',
  consumes: [{ slice: 'bag' }],
  produces: { events: [{ type: 'grant', slice: 'bag' }, { type: 'promote', slice: 'campaign', max: 1 }] },
});
const LEVELS = [{ ref: 'run-1', contract: CONTRACT }, { ref: 'run-2', contract: { ...CONTRACT, levelRef: 'run-2' } }];
const script = (html) => html.match(/<script>([\s\S]*)<\/script>/)[1];

describe('emitPlayShell', () => {
  it('the fixture validates with shell: play', () => {
    expect(validateGameManifest(GAME)).toEqual({ ok: true, errors: [] });
  });

  it('a self-contained page: the kernel and the runtime inlined, the wire present, no imports, no network', () => {
    const html = emitPlayShell(GAME, LEVELS);
    const s = script(html);
    expect(s).toContain('buildGameStoreKernel');
    expect(s).toContain('playShellRuntime');
    for (const m of ['game-ready', 'game-init', 'game-outcome', 'game-pause']) expect(s).toContain(m);
    expect(s).toContain('levels/run-1.html');
    expect(s).not.toMatch(/\bimport\s*[({]/);
    expect(s).not.toMatch(/\bfrom\s*['"]/);
    expect(s).not.toMatch(/https?:\/\//);
    expect(() => new Function(s)).not.toThrow();   // parses standalone
  });

  it('deterministic: no dice, no clock, the same page for the same game', () => {
    const src = playShellRuntime.toString();
    expect(src).not.toMatch(/Math\.random|Date\.now|new Date/);
    expect(emitPlayShell(GAME, LEVELS)).toBe(emitPlayShell(GAME, LEVELS));
  });

  it('speaks none of the arena: no battle, pilot, suit or hangar words, no store dump on a screen', () => {
    // stats.pilot is the envelope's own field (the wire), read to highlight the player's row
    const html = emitPlayShell(GAME, LEVELS).replace(/stats\.pilot/g, '');
    expect(html).not.toMatch(/battle|pilot|suit|hangar|carried along/i);
  });

  it('a title cannot close the script or inject markup', () => {
    const html = emitPlayShell({ ...GAME, title: '</script><b>x' }, LEVELS);
    expect(html).not.toContain('</script><b>');
    expect(html).toContain('<title>&lt;/script&gt;&lt;b&gt;x</title>');
  });

  it('the theme is sanitized into the css and the level theme; a bad colour falls back', () => {
    const html = emitPlayShell({ ...GAME, theme: { accent: '#ff3366', bg: 'red;}</style>', font: 'mono' } }, LEVELS);
    const css = html.match(/<style>([\s\S]*?)<\/style>/)[1];
    expect(css).toContain('--accent:#ff3366');
    expect(css).not.toContain('red;}');
    expect(css).toContain('--bg:#0e1116');
    expect(html).toContain('"theme":{"accent":"#ff3366","font":"mono"}');
  });

  it('playtest: flagged in the page, a start level checked against the game', () => {
    expect(emitPlayShell(GAME, LEVELS)).toContain('"playtest":false');
    const html = emitPlayShell(GAME, LEVELS, { playtest: true, startLevel: 'run-2' });
    expect(html).toContain('"playtest":true');
    expect(html).toContain('"startLevel":"run-2"');
    expect(html).toContain('<title>Coin Run · playtest</title>');
    expect(() => emitPlayShell(GAME, LEVELS, { startLevel: 'nope' })).toThrow(/'nope' is not a level of this game/);
  });

  it('a map game: each level carries its exits, and the page travels by them (arrive) and reads has-gates', () => {
    const map = normalizeGameManifest({ ...GAME, levels: [
      { ref: 'run-1', title: 'Hall', exits: [{ id: 'door', to: 'run-2', gate: { has: 'key' } }] },
      { ref: 'run-2', title: 'Vault', exits: [{ id: 'back', to: 'run-1' }] },
    ] });
    expect(validateGameManifest(map)).toEqual({ ok: true, errors: [] });
    const html = emitPlayShell(map, LEVELS);
    expect(html).toContain('"exits":[{"id":"door","to":"run-2","gate":{"has":"key"}}]');
    const src = playShellRuntime.toString();
    for (const k of ['K.isMap', 'K.reachable', 'K.travel', 'params.arrive']) expect(src).toContain(k);
  });

  it('refuses a level without its contract', () => {
    expect(() => emitPlayShell(GAME, [{ ref: 'run-1', contract: CONTRACT }])).toThrow(/'run-2' has no matching entry/);
  });
});

describe('emitShellFor', () => {
  const resolved = (manifest) => ({ manifest, levels: LEVELS, menu: null, music: null, setup: null });

  it('shell: play gets the play shell; absent gets the arena shell, exactly as it was emitted before', () => {
    expect(emitShellFor(resolved(GAME))).toBe(emitPlayShell(GAME, LEVELS));
    const { shell, ...arena } = GAME;
    expect(emitShellFor(resolved(arena))).toBe(emitGameShell(arena, LEVELS, null, null, null));
  });
});

describe('the shell field', () => {
  it('is play or absent, and a play game carries no arena presentation', () => {
    const base = { kind: 'game', title: 't', store: { slices: [{ name: 'c', kind: 'progression' }] }, levels: [{ ref: 'a' }] };
    expect(validateGameManifest({ ...base, shell: 'play' }).ok).toBe(true);
    expect(validateGameManifest({ ...base, shell: 'arena' }).errors.join()).toMatch(/shell is 'play'/);
    const music = validateGameManifest({ ...base, shell: 'play', music: { menu: 'm' } });
    expect(music.errors.join()).toMatch(/shell 'play' has no music/);
  });
});
