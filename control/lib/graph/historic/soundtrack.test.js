import { describe, expect, it } from 'vitest';

import { historicSoundtrack, historicAudio, soundtrackMood, MOODS } from './soundtrack.js';
import { HISTORIC_CULTURES } from './historic-city.js';
import { entryCard, ENTRY_BODY_CEILING } from './entries.js';
import { validateBeatsManifest } from '../beats/beats-manifest.js';
import { resolveWorldAudio } from '../beats/beats-world.js';
import { WORLD_KINDS } from '../worlds/world-kinds.js';

const CULTURES = Object.keys(HISTORIC_CULTURES);

describe('historic period soundtracks', () => {
  it('every culture has a mood, and every mood is a valid beats recipe', () => {
    for (const c of CULTURES) {
      expect(soundtrackMood(c), c).toBeTruthy();
      const r = historicSoundtrack(c);
      const v = validateBeatsManifest(r);
      expect(v.errors || [], c).toEqual([]);
      expect(['beats-ambient', 'beats-composition']).toContain(r.kind);
    }
  });

  it('is deterministic per seed, and the seed moves it', () => {
    for (const c of ['sumer', 'qin', 'forum']) {
      expect(JSON.stringify(historicSoundtrack(c, 7))).toBe(JSON.stringify(historicSoundtrack(c, 7)));
      expect(JSON.stringify(historicSoundtrack(c, 7))).not.toBe(JSON.stringify(historicSoundtrack(c, 8)));
    }
  });

  it('seed 1 is the auditioned take', () => {
    expect(historicSoundtrack('sumer', 1).seed).toBe(2900);
    expect(historicSoundtrack('pompeii', 1).seed).toBe(79);
    expect(historicSoundtrack('qin', 1).title).toBe('Silk Zheng, Wei Valley');
  });

  it('a culture names its mood on its card; one spread from another plays its parent\'s', () => {
    for (const [c, K] of Object.entries(HISTORIC_CULTURES)) expect(MOODS[K.soundtrack], `${c}: soundtrack '${K.soundtrack}' is a mood`).toBeTruthy();
    HISTORIC_CULTURES.depth0 = { ...HISTORIC_CULTURES.thebes, label: 'Depth zero' };
    try { expect(historicSoundtrack('depth0', 2)).toEqual(historicSoundtrack('thebes', 2)); } finally { delete HISTORIC_CULTURES.depth0; }
    expect(soundtrackMood('atlantis')).toBeNull();
  });

  it('cultures of one family share a mood', () => {
    expect(historicSoundtrack('thebes', 3)).toEqual(historicSoundtrack('giza', 3));
    expect(historicSoundtrack('lindos', 3)).toEqual(historicSoundtrack('polis', 3));
  });

  it('every pitch the qin zheng plays is pentatonic once bent home', () => {
    const zheng = historicSoundtrack('qin', 5).parts.find((p) => p.name === 'zheng');
    const pcs = new Set(zheng.events.map(([, n, , , art]) => {
      const m = /^([A-G]#?)/.exec(n)[1];
      const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
      return names[(names.indexOf(m) + (art && art.type === 'bend' ? art.to : 0)) % 12];
    }));
    for (const pc of pcs) expect(['C', 'D', 'E', 'G', 'A']).toContain(pc);
  });
});

describe('historicAudio (the opt-in)', () => {
  it('leaves a manifest without audio, or with its own soundtrack, untouched', () => {
    expect(historicAudio({ kind: 'historic', culture: 'qin' })).toBeUndefined();
    const own = { soundtrack: { beatsRef: 'abc' }, wind: true };
    expect(historicAudio({ culture: 'qin', audio: own })).toBe(own);
    const windOnly = { wind: true };
    expect(historicAudio({ culture: 'qin', audio: windOnly })).toBe(windOnly);
  });

  it("replaces soundtrack: 'default' with the culture's recipe at the manifest's seed and keeps the rest", () => {
    const a = historicAudio({ culture: 'lindos', seed: 4, audio: { soundtrack: 'default', wind: true } });
    expect(a.wind).toBe(true);
    expect(a.soundtrack).toEqual(historicSoundtrack('lindos', 4));
  });

  it('refuses any other soundtrack string', () => {
    expect(() => historicAudio({ culture: 'qin', audio: { soundtrack: 'epic' } })).toThrow(/'default'/);
  });

  it('resolves through the world audio channel for every culture', () => {
    for (const c of CULTURES) {
      const out = resolveWorldAudio(historicAudio({ culture: c, audio: { soundtrack: 'default' } }));
      expect(out.soundtrack.title, c).toBe(historicSoundtrack(c).title);
    }
  });

  it('is the historic kind’s audio hook; other kinds carry none', () => {
    expect(typeof WORLD_KINDS.historic.audio).toBe('function');
    expect(WORLD_KINDS.historic.audio({ culture: 'qin', audio: { soundtrack: 'default' } }).soundtrack.kind).toBe('beats-composition');
    expect(Object.keys(WORLD_KINDS).filter((k) => WORLD_KINDS[k].audio)).toEqual(['historic']);
  });

  it('the entry card names the opt-in and stays under its ceiling', () => {
    for (const c of CULTURES) {
      const card = entryCard(c);
      expect(card.body).toContain('"soundtrack": "default"');
      expect(card.body.length, c).toBeLessThanOrEqual(ENTRY_BODY_CEILING);
    }
  });
});
