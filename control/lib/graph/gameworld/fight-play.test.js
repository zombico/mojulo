// A FIGHT PLAYED (the room's machine gate, an e2e suite: the room resolved whole and stepped headless): a fight composed
// in the game room (game-room.js `fight`) is won by the playthrough's floor player, who walks into the ring, fells each
// wave as it comes and leaves by the way on; the still player, who does nothing, wins nothing. One kind with rifts,
// chosen from the table in code. Nobody has looked: the eyes gate is the operator's.
import { describe, it, expect } from 'vitest';
import { gameRoom } from './game-room.js';
import { playLevel } from './playthrough.js';
import { TEMPLATE_ARSENALS } from './combos.js';
import { roomNeeds } from '../gameroom/needs.js';
import { FIGHT_KIND_IDS, composeFight } from '../gameroom/fight.js';
import { resolveWorldScene } from '../worlds/world-scene.js';

const KIT = Object.keys(TEMPLATE_ARSENALS).find((id) => TEMPLATE_ARSENALS[id].weapons.some((W) => Object.values(W.moves).some((m) => m.launch > 0)));
const RIFTED = FIGHT_KIND_IDS.find((k) => composeFight(roomNeeds({ feel: KIT }), { kind: k }).anchors.rifts.length > 1);

describe('a fight played in the room', () => {
  it('is won by the floor player, wave after wave, and not by one who does nothing', async () => {
    const r = gameRoom({ id: 'fight-play', feel: KIT }, { fight: RIFTED });
    const { payload } = await resolveWorldScene({ ref: 'fight-play', manifest: r.manifest }, {});
    const P = { ...payload, game: r.fight.contract };
    const basic = playLevel(P, { player: 'basic', seconds: 240 }), still = playLevel(P, { player: 'still', seconds: 20 });
    expect(basic.won, basic.reason).toBe(true);
    expect(basic.foes.every((f) => f.hp === 0)).toBe(true);
    expect(basic.foes.length).toBe(r.fight.placed.flat().length);
    expect(still.won).toBe(false);
    // the same run twice is the same run
    expect(playLevel(P, { player: 'basic', seconds: 240 }).t).toBe(basic.t);
  }, 900000);
});
