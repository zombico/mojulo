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

  it('made for a screen: the page fills the device, its chrome clear of the notch, its buttons a thumb\'s size', () => {
    const phone = { ...GAME, screen: 'phone' };
    expect(validateGameManifest(phone)).toEqual({ ok: true, errors: [] });
    const html = emitPlayShell(phone, LEVELS);
    expect(html).toContain('<html lang="en" data-screen="phone" data-orientation="portrait">');
    expect(html).toContain('viewport-fit=cover');
    expect(html).toContain('#pauseBtn{top:calc(12px + var(--safe-t))');
    expect(html).toContain('button{min-height:44px}');
    // upright, the front's title and menu stand at the foot of the screen, the cover above them
    expect(html).toContain('html[data-orientation=portrait] #front .fx-zone{position:fixed;');
    expect(html).toContain('html[data-orientation=portrait] #front .fx-col:not(.fx-hide){left:50%;right:auto;top:auto;bottom:calc(8vh + var(--safe-b))');
    // absent: none of it
    const plain = emitPlayShell(GAME, LEVELS);
    expect(plain).not.toMatch(/data-screen|viewport-fit|--safe-t/);
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

describe('the play shell takes doors (game links), as the arena shell does', () => {
  it('a game with links carries them and the door wire; one without is unchanged', async () => {
    const { emitPlayShell } = await import('./play-shell.js');
    const store = { slices: [{ name: 'campaign', kind: 'progression' }] };
    const contract = { levelRef: 'a', consumes: [], produces: { events: [] } };
    const levels = [{ ref: 'a', contract }, { ref: 'b', contract: { ...contract, levelRef: 'b' } }];
    const M = { kind: 'game', title: 'T', store, levels: [{ ref: 'a' }, { ref: 'b' }] };
    const plain = emitPlayShell(M, levels);
    const doors = emitPlayShell({ ...M, links: [{ from: { ref: 'a', door: 'inn' }, to: { ref: 'b', door: 'out' } }] }, levels);
    expect(plain).not.toContain('game-door');
    expect(doors).toContain('"door":"game-door"');
    expect(doors).toContain('"links":{"a":{"inn":{"ref":"b","door":"out"}},"b":{"out":{"ref":"a","door":"inn"}}}');
  });
});

describe('runs: the levels a pool each run draws from', () => {
  const RUNG = normalizeGameManifest({ ...GAME, levels: [{ ref: 'run-1' }, { ref: 'run-2' }], run: { length: 2 } });
  it('validates in the light shell, a length the pool holds, no links', () => {
    expect(validateGameManifest(RUNG)).toEqual({ ok: true, errors: [] });
    expect(validateGameManifest({ ...RUNG, run: { length: 3 } }).errors.join(' ')).toMatch(/run must be \{ length: 1 to 2 \}/);
    expect(validateGameManifest({ ...RUNG, shell: undefined }).errors.join(' ')).toMatch(/run plays in the light shell/);
  });
  it('the page carries the run and rolls its order from the run\'s number; without one, not a byte of it', () => {
    const s = script(emitPlayShell(RUNG, LEVELS));
    expect(s).toContain('"run":{"length":2}');
    expect(() => new Function(s)).not.toThrow();
    expect(script(emitPlayShell(GAME, LEVELS))).not.toContain('"run":');
  });
});

describe('the end: a final level', () => {
  it('validates in the light shell, one of the game\'s levels, not a run; without one, not a byte of it', () => {
    const fin = normalizeGameManifest({ ...GAME, final: 'run-2' });
    expect(validateGameManifest(fin)).toEqual({ ok: true, errors: [] });
    expect(validateGameManifest({ ...fin, final: 'run-9' }).errors.join(' ')).toMatch(/final is the level whose first win completes the game: one of run-1, run-2/);
    expect(validateGameManifest({ ...fin, shell: undefined }).errors.join(' ')).toMatch(/final plays in the light shell/);
    expect(validateGameManifest({ ...fin, run: { length: 1 } }).errors.join(' ')).toMatch(/run and final/);
    expect(script(emitPlayShell(fin, LEVELS))).toContain('"final":"run-2"');
    expect(script(emitPlayShell(GAME, LEVELS))).not.toContain('"final":');
  });
});

describe('the result screen\'s gains', () => {
  // the shell's own function, out of its runtime source
  const src = playShellRuntime.toString(), at = src.indexOf('function gainsOf'), end = src.indexOf('function statsTable');
  const words = src.slice(src.indexOf('function eventWords'), end);
  // and its word lookup (T): with no language table, every word as written
  const lookup = src.slice(src.indexOf('let words = null;'), src.indexOf('let toastTimer'));
  const gainsOf = new Function(`${lookup}\n${words}\n${src.slice(at, src.indexOf('function eventWords'))}\nreturn gainsOf;`)();
  it('each item\'s net change a slice, the slice named when several are touched; a flag by its own name; the world\'s memory quiet', () => {
    expect(gainsOf([{ type: 'grant', slice: 'bag', item: 'coin', count: 3 }])).toEqual(['+3 coin']);
    expect(gainsOf([
      { type: 'grant', slice: 'bag', item: 'sword' }, { type: 'setFlag', slice: 'world', key: 'cellar|trunk:sword', value: 0 },
      { type: 'grant', slice: 'gear', item: 'sword' }, { type: 'consume', slice: 'bag', item: 'sword' },
      { type: 'grant', slice: 'bag', item: 'candle' }, { type: 'setFlag', slice: 'story', key: 'met-keeper', value: true },
    ])).toEqual(['+1 sword · gear', '+1 candle · bag', 'met keeper']);
  });
});
