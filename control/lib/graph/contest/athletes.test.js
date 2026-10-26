// The athletes on the sports' pages: an arena carrying bodies inlines the figure that poses them into its one block (it
// parses, no name declared twice); one without adds nothing. The athletes' list read, and the team's kit the page's own.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { readAthletes, athleteBodies } from './athletes.js';
import { graphSource } from './match-arena.js';
import { contestSource } from './meet-arena.js';
import { SIDE_KITS } from './team-arena.js';
import { meetChannelScript, courtChannelScript, turnsChannelScript, pitchChannelScript, ATHLETE_PAGE_MODULES, MEET_PAGE_MODULES } from '../scene/channels/contest.js';
import { COURT_PAGE_MODULES } from './match-arena.js';
import { TURNS_PAGE_MODULES } from './turn-arena.js';
import { PITCH_PAGE_MODULES } from './team-arena.js';

const fail = (m) => { throw new Error(`court: ${m}`); };
const BODY = { bones: [], parts: [] };
// a sport's block with its cfg as the data constant: the modules and the client, as the channel writes it
const CHANNELS = [
  ['MEET_ARENA', meetChannelScript, MEET_PAGE_MODULES, contestSource],
  ['COURT_ARENA', courtChannelScript, COURT_PAGE_MODULES, graphSource],
  ['TURNS_ARENA', turnsChannelScript, TURNS_PAGE_MODULES, graphSource],
  ['PITCH_ARENA', pitchChannelScript, PITCH_PAGE_MODULES, graphSource],
];

describe('the athletes on a sport\'s page', () => {
  it('reads one character ref a slot, null a stick figure, no more than the slots', () => {
    expect(readAthletes(undefined, 2, fail)).toBeUndefined();
    expect(readAthletes(['a', null], 2, fail)).toEqual(['a', null]);
    expect(() => readAthletes([], 2, fail)).toThrow(/athletes is a list of 1 to 2/);
    expect(() => readAthletes(['a', 'b', 'c'], 2, fail)).toThrow(/1 to 2 characters' refs/);
    expect(() => readAthletes(['a b'], 2, fail)).toThrow(/athletes\[0\]/);
  });

  it('packs no body when no athlete names a character', async () => {
    expect(await athleteBodies(undefined)).toBeNull();
    expect(await athleteBodies([null, null])).toBeNull();
  });

  it('a block with bodies inlines the figure before the client: one script that parses, no name declared twice; without, the modules alone', () => {
    for (const [name, script, mods, source] of CHANNELS) {
      const bare = script({ a: 1 }), dressed = script({ a: 1, bodies: { x: BODY } });
      // without bodies: exactly the sport's own modules, as before the athletes
      expect(bare).toContain(mods.map(source).join('\n'));
      expect(bare).not.toContain('function placeAthlete(');
      expect(dressed).toContain('function placeAthlete(');
      expect(dressed.indexOf('function athleteNodes(')).toBeLessThan(dressed.indexOf(source(mods[mods.length - 1]).slice(0, 200)));
      const block = [...mods.slice(0, -1), ...ATHLETE_PAGE_MODULES.map((m) => `@${m}`), mods[mods.length - 1]].map((m) => (m.startsWith('@') ? graphSource(m.slice(1)) : source(m))).join('\n');
      const names = [...block.matchAll(/^(?:const|let|function|class)\s+([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]);
      expect(names.filter((n, i) => names.indexOf(n) !== i), name).toEqual([]);
      expect(() => new Function('THREE', 'scene', 'camera', 'controls', 'wrap', 'window', 'document', 'navigator', 'performance', 'decodeF32', 'decodeU8', name, `"use strict"; let __ctrlOwnsCamera = false; let stepContest, stepCourt, stepTurnSport, stepPitch; ${block}`), name).not.toThrow();
    }
  });

  it('a team\'s rolled kit is the page\'s side colour', () => {
    const client = readFileSync(new URL('./team-arena.client.js', import.meta.url), 'utf8');
    expect(client).toContain(`const SIDE_COLORS = { a: '${SIDE_KITS.a}', b: '${SIDE_KITS.b}' };`);
  });
});
