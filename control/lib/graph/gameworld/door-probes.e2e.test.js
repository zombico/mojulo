// The sentence door, probed: for one sentence a kernel family, the world design_game composes from it and the steps
// its run would make (runner.js runSteps: each level's compose_world order, nothing minted), held to the family's
// concept (door-probes.js). Each probe is held to its `now`: a door that starts making a family's game, or stops, fails
// here until the table says so (and the hillclimb page, `npm run tool-surface`, reads the table). On the E2E list: a
// composed world lays its levels in full (seconds a world).
process.env.SQLITE_PATH = ':memory:';

import { describe, expect, it } from 'vitest';

import { composedWorld } from '@/lib/mcp/tools/design-game.js';
import { NEW_GAME_SCREEN } from '../game/screen.js';
import { runSteps } from './runner.js';
import { DOOR_PROBES } from './door-probes.js';

/** What the door makes of a sentence: the world design_game stores (a new world is made for the phone unless it names
 * a screen: design-game.js), then the run's steps; or the refusal, when composing refuses the sentence. */
function doorOf(prompt) {
  let world;
  try { world = composedWorld({ prompt }); } catch (e) { return { refused: e.message, world: null, steps: [] }; }
  const stored = world.screen === undefined ? { ...world, screen: NEW_GAME_SCREEN } : world;
  return { refused: null, world: stored, steps: runSteps(stored, { ref: 'probe' }) };
}

describe('the sentence door makes each family\'s game, or says it does not', () => {
  it('one probe a family, each naming its concept and what the door makes now', () => {
    expect(new Set(DOOR_PROBES.map((p) => p.family)).size).toBe(DOOR_PROBES.length);
    for (const p of DOOR_PROBES) expect(['type', 'not'], p.family).toContain(p.now);
  });

  it.each(DOOR_PROBES.map((p) => [p.family, p]))('%s', (family, p) => {
    const made = doorOf(p.prompt), holds = !!p.holds(made);
    const levels = made.steps.filter((s) => s.key.startsWith('level-')).length;
    const said = `"${p.prompt}" → ${made.refused ? `refused (${made.refused.slice(0, 120)})` : `${levels} level(s), intent ${made.world.intent?.from ?? 'none'}`}`;
    expect(holds, holds
      ? `${said}: the door now makes ${family}'s game (${p.concept}). Set its now to 'type' in door-probes.js and run npm run tool-surface.`
      : `${said}: not ${family}'s game (${p.concept}). ${p.now === 'type' ? 'It made one before: the door regressed.' : ''}`).toBe(p.now === 'type');
  }, 120_000);
});
