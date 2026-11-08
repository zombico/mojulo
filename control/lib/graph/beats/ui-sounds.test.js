import { describe, it, expect } from 'vitest';
import { uiSounds, uiSoundOf, uiSoundManifest, uiSoundAudio, UI_SOUND_SETS, UI_SOUND_SET_IDS, UI_SOUND_CUES } from './ui-sounds.js';
import { validateBeatsManifest } from './beats-manifest.js';
import { midiOf } from './beats-authoring.js';
import { THEME_WORDS, THEMES } from '../../mana-ui/theme.js';
import { manaUiPage } from '../../mana-ui/index.js';

// THE UI'S SOUND LIBRARY: one interval plan in six voices. Each set is its own voice (its own gestures), so each is
// held to the plan: it validates as a beats-sfx recipe, its confirm rises and its cancel falls, its stepper says up or
// down, what is pressed most is heard least. And the runtime's effects reach a page through it.
const pitches = (list) => list.map((g) => g.note ?? g.from).filter((n) => typeof n === 'string').map(midiOf);
const loud = (list) => list.reduce((a, g) => a + (g.vol || 0), 0);
// the notes struck first and last (a set's click, pitched or not, is struck with the first)
const ends = (list) => { const P = list.filter((g) => typeof (g.note ?? g.from) === 'string'), t0 = Math.min(...P.map((g) => g.at || 0)), t1 = Math.max(...P.map((g) => g.at || 0)); const at = (t) => P.filter((g) => (g.at || 0) === t).map((g) => midiOf(g.note ?? g.from)); return { first: at(t0), last: at(t1) }; };

describe('the UI sound library', () => {
  it('every set is a beats-sfx recipe the beats tool mints, with every cue of the plan', () => {
    for (const set of UI_SOUND_SET_IDS) {
      const r = validateBeatsManifest(uiSoundManifest(set));
      expect(r.errors, set).toEqual([]);
      expect(Object.keys(uiSounds(set)), set).toEqual(UI_SOUND_CUES);
    }
  });
  it('one plan in every voice: confirm rises, cancel falls, the stepper says which way, a cursor up goes higher', () => {
    for (const set of UI_SOUND_SET_IDS) {
      const C = uiSounds(set), acc = ends(C.accept), bak = ends(C.back);
      expect(Math.max(...acc.last), `${set} accept`).toBeGreaterThan(Math.min(...acc.first));
      expect(Math.max(...bak.last), `${set} back`).toBeLessThan(Math.max(...bak.first));
      // (the click both share says nothing: the notes that differ say the way)
      const apart = (a, b) => { const A = pitches(C[a]), B = pitches(C[b]); return [Math.max(...A.filter((x) => !B.includes(x))), Math.max(...B.filter((x) => !A.includes(x)))]; };
      const [su, sd] = apart('change-up', 'change-down'), [mu, md] = apart('move-up', 'move-down');
      expect(su, `${set} stepper`).toBeGreaterThan(sd);
      expect(mu, `${set} cursor`).toBeGreaterThan(md);
      // what is pressed most is heard least
      expect(loud(C.move), `${set} move under accept`).toBeLessThan(loud(C.accept));
      expect(loud(C.back), `${set} back under accept`).toBeLessThan(loud(C.accept));
    }
  });
  it('a game\'s key moves the pitched gestures and leaves the noise where it is', () => {
    const set = UI_SOUND_SET_IDS.find((s) => uiSounds(s).tab.some((g) => g.type === 'burst'));
    const C = uiSounds(set), D = uiSounds(set, { tonic: 2 });
    expect(pitches(D.accept).map((n, i) => n - pitches(C.accept)[i])).toEqual(pitches(C.accept).map(() => 2));
    expect(D.tab.filter((g) => g.type === 'burst')).toEqual(C.tab.filter((g) => g.type === 'burst'));
    expect(() => uiSounds('kazoo')).toThrow(/the sets: glass/);
  });
  it('a runtime effect picks its cue: the way a cursor went, the step a stepper took', () => {
    expect(uiSoundOf({ sound: 'move', way: 'up' })).toBe('move-up');
    expect(uiSoundOf({ sound: 'move', way: 'right' })).toBe('move-down');
    expect(uiSoundOf({ sound: 'change', step: -1 })).toBe('change-down');
    expect(uiSoundOf({ sound: 'accept' })).toBe('accept');
    expect(uiSoundOf({ emit: 'x' })).toBe(null);
  });
  it('a theme\'s sounds word names a set, every preset\'s among them', () => {
    expect([...THEME_WORDS.sounds].sort()).toEqual([...UI_SOUND_SET_IDS].sort());
    for (const id of Object.keys(THEMES)) expect(UI_SOUND_SETS[THEMES[id].sounds], id).toBeTruthy();
  });
  it('a page handed the library plays its theme\'s set; a page handed none carries no audio byte', () => {
    const spec = { start: 'a', screens: { a: { use: 'screen', children: [{ use: 'list', props: { rows: ['x', 'y'] } }] } } };
    const A = uiSoundAudio(['party']);
    expect(Object.keys(A.sets)).toEqual(['party']);
    const heard = manaUiPage(spec, { theme: 'rebel', audio: A });
    expect(heard).toContain('createEngine');
    expect(heard).toContain('set: "party"');
    expect(heard).not.toMatch(/\b(src|href)=["']?https?:/);
    const silent = manaUiPage(spec, { theme: 'rebel' });
    expect(silent).not.toContain('createEngine');
    expect(silent).toContain('const SOUNDS = window.__manaSounds = null');
  });
});
