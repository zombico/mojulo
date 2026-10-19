/**
 * FIGURES ON THE BOARD — a battle's units stood on their spots as people, not tokens: each class and each humanoid foe
 * a hero in its own palette (the hero door: lib/mcp/tools/layered.js), played as a `figure-rig` body by the World
 * page's controllable runtime, its own idle and walk clips; the board page moves them spot to spot. One figure a look,
 * shared by every unit that wears it, since a rig is the page's heaviest thing.
 *
 * Beasts (a wolf, a bat, a slime…) stay tokens: a hero is a person, and animal heroes are not built yet (the cosmos
 * registry's soul.hero=animal). A battle that asks `figures: false` keeps every unit a token.
 *
 *   CLASS_LOOKS, FOE_LOOKS   the hero spec each class and humanoid foe wears
 *   boardFigures(payload, { heroFigure }) → payload, with `figures` (look → packed rig), `entities` (one static body a
 *     unit that has a look) and `board.figures` (unit → entity id); a payload with no battle, unchanged
 */
import { boardParse } from './board-kernel.js';

export const CLASS_LOOKS = Object.freeze({
  fighter: { cast: 'male', palette: { Top: '#9b3b2e' } },
  knight: { cast: 'male', palette: { Top: '#7d8794' } },
  mage: { cast: 'female', palette: { Top: '#3b4f9b' } },
  cleric: { cast: 'female', palette: { Top: '#e8e2d0' } },
  rogue: { cast: 'male', palette: { Top: '#3e5e3a' } },
  monk: { cast: 'male', palette: { Top: '#c47a2c' } },
});
export const FOE_LOOKS = Object.freeze({
  goblin: { cast: 'male', palette: { Top: '#4f7a2e' } },
  skeleton: { cast: 'male', palette: { Top: '#d8d4c4' } },
  bandit: { cast: 'male', palette: { Top: '#3a2f2f' } },
  shaman: { cast: 'female', palette: { Top: '#6b3d7a' } },
});
// the hero's own clips under the runtime's names: standing, and walking from spot to spot
const CLIPS = { idle: 'idle', forward: 'walk' };
const BODY = { type: 'static', eye: 0, stride: 1.6, collideRadius: 0.3, collideHeight: 1.7, step: 0.3 };

const lookOf = (u) => (u.class ? CLASS_LOOKS[u.class] && `class-${u.class}` : u.foe ? FOE_LOOKS[u.foe] && `foe-${u.foe}` : null) || null;
const specOf = (look) => (look.startsWith('class-') ? CLASS_LOOKS[look.slice(6)] : FOE_LOOKS[look.slice(4)]);

export async function boardFigures(payload, { heroFigure, figures = true } = {}) {
  const battle = payload?.board?.battle;
  if (!battle || figures === false) return payload;
  const looks = [...new Set(battle.units.map(lookOf).filter(Boolean))];
  if (!looks.length) return payload;
  const figs = {};
  for (const look of looks) figs[look] = await heroFigure(look, { hero: specOf(look), clips: CLIPS });
  const B = payload.board.B, O = payload.board.origin, of = {};
  const entities = [];
  for (const u of battle.units) {
    const look = lookOf(u);
    if (!look) continue;
    const i = boardParse(B, u.at), s = i >= 0 ? B.spots[i] : null;
    const id = `board-${u.id}`;
    of[u.id] = id;
    entities.push({ id, rule: { ...BODY }, body: { type: 'figure-rig', figure: look }, transform: { pos: [O[0] + ((i % B.cols) + 0.5) * B.cell, O[1] + (Math.floor(i / B.cols) + 0.5) * B.cell, O[2] + s.h * B.step], heading: 0 } });
  }
  return { ...payload, figures: { ...(payload.figures ?? {}), ...figs }, entities: [...(payload.entities ?? []), ...entities], board: { ...payload.board, figures: of } };
}
