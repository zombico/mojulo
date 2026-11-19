// A LEVEL'S OWN SAVE (level-contract.js MSG_SAVE): a level whose game block says `save` (the open city, one long level)
// sends what it keeps as it is earned; the shell's wire carries the message only for a game with such a level, and the
// level's game channel only for such a level. Played in the browser: the open city's new game, a job taken, a reload,
// continue (its job back, its mission picked up), the end card and the credits, a new game forgetting it.
import { describe, it, expect } from 'vitest';
import { emitPlayShell } from './play-shell.js';
import { normalizeGameManifest } from './game-manifest.js';
import { normalizeLevelContract, MSG_SAVE } from './level-contract.js';
import { gameChannelScript } from '../scene/channels/game.js';

const GAME = normalizeGameManifest({ kind: 'game', title: 'Open City', shell: 'play', store: { slices: [{ name: 'bag', kind: 'inventory' }] }, levels: [{ ref: 'city' }] });
const SAVE = { vars: ['flag-', 'held:bag:'], on: ['errand:done:', 'flag:took-'] };
const contract = (save) => normalizeLevelContract({ levelRef: 'city', consumes: [{ slice: 'bag' }], produces: { events: [{ type: 'grant', slice: 'bag' }] }, ...(save ? { save } : {}) });

describe('a level\'s own save', () => {
  it('the shell\'s wire carries it only for a game whose level saves', () => {
    expect(emitPlayShell(GAME, [{ ref: 'city', contract: contract(SAVE) }])).toContain(`"save":"${MSG_SAVE}"`);
    expect(emitPlayShell(GAME, [{ ref: 'city', contract: contract(null) }])).not.toContain(`"save":"${MSG_SAVE}"`);
  });
  it('the level\'s game channel sends and takes it back only with `save`; without, not a byte', () => {
    const on = gameChannelScript({ levelRef: 'city', save: SAVE }), off = gameChannelScript({ levelRef: 'city' });
    expect(on).toContain(MSG_SAVE); expect(on).toContain('__resume'); expect(on).toContain("type: 'resumed'");
    expect(off).not.toContain(MSG_SAVE); expect(off).not.toContain('__resume');
    expect(() => new Function('_capture', on)).not.toThrow();
  });
});
