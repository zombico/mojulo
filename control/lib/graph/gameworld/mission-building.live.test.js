// A MISSION IN A BUILDING, ON ITS PAGE (the e2e tier: it resolves a whole building page). One world a procedure (a feel
// template whose loadout is guns alone), its building the one its kit's band picks (MISSION_BUILDINGS). The concepts:
// the page is drawn by the seventh generation's form render (`form.room`: its lamps placed, its tiles read as material),
// and the era reading says what is still paint; the platform pilot climbs the building's stairs on its own treads; the
// gunner plays it headless on the page (its floors a floor at a time, its stairs by their own ways) and a still player
// does not win it. Machine gate only: whether it is a good first level is the creator's to say in play.
import { describe, expect, it } from 'vitest';
import { readGameworld } from './world.js';
import { gameStages, stageLevelOrder } from './levels.js';
import { playMission, proveMissions } from './mission-proof.js';
import { missionBuildingFor } from './mission-building.js';
import { TEMPLATE_LOADOUTS } from './loadout.js';
import { POLES } from './feel/cards.js';
import { resolveWorldScene } from '../worlds/world-scene.js';
import { eraReading } from '../era/era-marks.js';
import { simLevel } from '../game/level-sim.js';
import { SIM_DT, faceGround, pageGroundFaces } from '../game/level-equivalence.js';

const SHOOTER = Object.keys(TEMPLATE_LOADOUTS).find((id) => TEMPLATE_LOADOUTS[id].weapons.every((w) => typeof w === 'string') && !POLES[id].demo.includes('attack'));
const USE = missionBuildingFor({ id: 'k', feel: SHOOTER }).use;
const W = { id: 'mb', name: 'MB', seed: 1, feel: SHOOTER, start: 'one', levels: { one: { name: 'Inside', building: { use: USE }, mission: true } } };

describe('a mission in a building, on its page', () => {
  const G = readGameworld(W), st = gameStages(W)[0], M = st.mission.mission, O = stageLevelOrder(G, st, { ref: 'mb-level-one-0', heroRef: null });
  let page = null;
  const resolved = async () => (page ??= (await resolveWorldScene({ ref: 'mb-level-one-0', title: 'Inside', manifest: O.args.manifest })).payload);

  it('is drawn by the form render: its room lit by placed lamps, its tiles read as material', async () => {
    const p = await resolved();
    expect(p.form?.room?.lights?.length).toBeGreaterThan(0);
    expect(p.form.room.maps).toBeTruthy();
    expect(p.mission?.plan?.on).toBe('building');
    const R = eraReading(p, 'gen-7');
    expect(R.surface).toBe('form');
    // (its faces and textures are the form render's; its figures are still paint: no cast rig indoors yet)
    expect(R.approximated.map((x) => x.input)).not.toContain('faces');
    expect(R.approximated.map((x) => x.input)).toContain('figures');
  }, 400000);

  it('is climbed by the platform pilot up and down each stair on its own treads', async () => {
    const p = await resolved(), ground = faceGround(pageGroundFaces(p.faces));
    for (const s of M.frame.stairs) for (const up of [true, false]) {
      const way = up ? s.way : [...s.way].reverse(), me = structuredClone(p.entities.find((e) => e.pilotable));
      me.transform.pos = [way[0][0], way[0][1], (up ? s.z0 : s.z1) + me.rule.eye];
      const sim = simLevel({ entities: [me], events: {}, colliders: p.colliders, camera: p.camera, world: p }, { ground }), H = sim.world.byId[sim.world.pilotId];
      let k = 1;
      for (let i = 0; i < 20 / SIM_DT && k < way.length; i++) {
        const q = way[k], pos = H.transform.pos;
        if (Math.hypot(q[0] - pos[0], q[1] - pos[1]) < 0.35) { k++; continue; }
        const dy = ((Math.atan2(q[1] - pos[1], q[0] - pos[0]) - H.transform.heading + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
        sim.input.lookDX = Math.max(-160, Math.min(160, dy / (H.rule.lookSens ?? 0.0025))); sim.input.forward = Math.abs(dy) < 0.5 ? 1 : 0;
        sim.frame(SIM_DT);
      }
      expect(k).toBe(way.length);
      expect(H.transform.pos[2] - H.rule.eye).toBeCloseTo(up ? s.z1 : s.z0, 1);
    }
  }, 400000);

  it('is played headless on its page: the gunner\'s result said, and a still player does not win', async () => {
    const p = await resolved();
    const R = playMission(p, M, { seconds: 240 });
    expect(R.reason, `${R.reason} at ${R.t} s`).toBe('won');
    expect(R.tasks).toEqual(M.sections.map((S) => S.id));
    expect(playMission(p, M, { player: 'still', seconds: 30 }).won).toBe(false);
    // (and through the run's gate: proved on the bus, played on the page handed to it)
    const [X] = proveMissions(W, { one: O.args.manifest }, { payloads: { one: p } });
    expect(X).toMatchObject({ level: 'one', proved: true, won: true });
    expect(proveMissions(W, { one: O.args.manifest })[0].play).toMatch(/^not played/);
  }, 400000);
});
