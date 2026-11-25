// The HUD's sounds (mana-hud-sounds.js): a level's HUD heard in its look's set. The concepts: a look that names a set
// and hears its cues is carried with the set's gestures and the kernel; a silent look is not; the page plays the cues the
// runtime emits and only then.
import { describe, it, expect } from 'vitest';
import { hudSounds } from './mana-hud-sounds.js';
import { manaHudScript } from './mana-hud.js';

const HUD = (sounds) => ({ spec: { hud: { use: 'hud', children: [] } }, theme: 'grim', feed: {}, ...(sounds ? { sounds } : {}) });

describe('the HUD\'s sounds', () => {
  it('carries a look\'s set and its kernel; a silent look, none', () => {
    const S = hudSounds('nocturne');
    expect(S).toMatchObject({ set: 'crypt', cues: 'full' });
    expect(Object.keys(S.sounds)).toEqual(expect.arrayContaining(['toast', 'rare', 'open', 'move', 'accept', 'back']));
    expect(typeof S.K).toBe('string');
    expect(hudSounds('greybox')).toBeNull();
  });

  it('plays the cues the runtime emits on a page that carries them, and adds no byte to one that does not', () => {
    const heard = manaHudScript(HUD(hudSounds('nocturne'))), quiet = manaHudScript(HUD(null));
    expect(heard).toContain('hsHear');
    expect(heard).toContain("cues: \"full\"");
    expect(quiet).not.toContain('hsHear');
    expect(quiet).not.toContain('__mojHudSounds');
  });
});
