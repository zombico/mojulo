// Isolate to in-memory SQLite before any import that pulls db/index.js.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { designGameHandler } from './design-game.js';
import { mintGame } from './create-game.js';
import { runLevelTraversal } from '@/lib/graph/game/auto-audit-runner';
import { resolveWorldScene } from '@/lib/graph/worlds/world-scene';
import { emitThreeWorld } from '@/lib/graph/scene/scene-three';
import { engineReading } from '@/lib/graph/scene/engine-score';

// SEATS, END TO END (pilots.plan.md phase 5; an e2e suite: a hero is made and the level audit walks it in headless
// Chrome): a quick game whose cube says two seats lays a hero for seat 2 on its level, the page seats the players, and
// the level audit walks it with seat 1, its own pilot, the empty seat's hero following as the party does: the audit's run
// and verdict are the ones the same level without seats gets. The engine legs seat one, and the export says so.
beforeEach(() => { closeDb(); });
const stored = (ref) => SketchRepository.getByRef(ref)?.manifest;

describe('a two-seat co-op game, made and audited', () => {
  it('lays seat 2\'s hero, the page seats it, and the audit walks the level with seat 1 as it would alone', async () => {
    const hero = { cast: 'female', head: 'anime', look: ['heroine', 'determined'], hair: ['frieda-pony'] };
    const out = await designGameHandler({ quick: { goal: 'reach', camera: 'side', hero, world: { id: 'duo', style: { kit: 'trail-valley' }, intent: { cube: { soul: { seats: 'two', join: 'drop-in' } } } } }, ref: 'd' });
    expect(out.ran.map((r) => r.key)).toEqual(['hero', 'level-run-0', 'game']);
    const L = stored('d-level-run-0');
    expect(L.seats).toEqual({ bodies: ['hero-2'], max: 2, join: 'drop-in' });
    expect(L.entities.find((e) => e.id === 'hero-2')).toMatchObject({ pilotable: true, ambient: { mind: { motivation: 'escort' } } });

    // the page: the seats ride the payload into the controllable channel
    const { payload } = await resolveWorldScene(SketchRepository.getByRef('d-level-run-0'));
    expect(payload.seats).toEqual(L.seats);
    expect(emitThreeWorld({ ...payload, inline: true })).toMatch(/window\.__mojSeats/);

    // the audit: the real traversal, seat 1 walking to the exit (the audit's own pilot), on the level as laid and on the
    // same level with its seats taken out: the same run, the same verdict. (A quick side-on level is walkable and not
    // proved beatable either way: the audit's walker seeks the exit in a straight line, which a lane does not run.)
    const { seats: _s, ...bare } = L;
    SketchRepository.create({ title: 'Solo', ref: 'solo-level', manifest: { ...bare, entities: L.entities.filter((e) => e.id !== 'hero-2').map(({ team: _t, ...e }) => (e.id === 'hero' ? e : { ...e, ...(_t ? { team: _t } : {}) })) } });
    const audit = async (ref) => {
      let last = null;
      const g = await mintGame({ title: ref, store: stored('d-game').store, levels: [{ ref }], ref: `${ref}-game`, autoAudit: true, allowUnaudited: true, runTraversal: async (arg) => (last = await runLevelTraversal(arg)) });
      expect(last, `${ref}: ${JSON.stringify(g.audits)}`).toBeTruthy();
      return { ok: g.ok, completable: g.audits[0].completable, hero: last.entities.hero.pos, game: last.game.result };
    };
    const duo = await audit('d-level-run-0'), solo = await audit('solo-level');
    expect(duo.ok).toBe(true);
    expect({ ...duo, hero: duo.hero.map((v) => +v.toFixed(6)) }).toEqual({ ...solo, hero: solo.hero.map((v) => +v.toFixed(6)) });

    // the engine legs seat one: the export's reading names the seats among the page channels it does not carry
    for (const engine of ['godot', 'roblox']) expect(engineReading(payload, engine).channels).toContain('seats');
  }, 1_800_000);   // a hero made and two real traversals: about 17 minutes on a quiet machine
});
