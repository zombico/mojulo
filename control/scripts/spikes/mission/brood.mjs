#!/usr/bin/env node
/**
 * THE BROOD WALKER, FOUGHT — the drone yard's boss (brood.json) as one page: an apron with cover and shelters (a roof is
 * cover from a drone's grenade), three pallets with a package each, the operative with its kit and an RF gun, and the
 * brood walker (gameworld/combat/boss-fight.js broodWalkerBoss on the runtime's carrier, worlds/controllable/boss.js).
 * Its gunners (its roof, its two hangar doors) are put down first, to have room to work: the dart from outside a
 * gunner's arc. Its drones are endless; its couriers (the green mark) have a weak link: the RF gun held on one hacks it,
 * and it fetches a package and takes it home "for repair", into a hangar door whose gunner is down, where it goes off.
 * From the second delivery its hunters chase the hacked courier: shoot them off it. Three deliveries and it is down.
 * An on-ramp, not a wall. A spike: the stage takes no pilot, so the hero's camera, the mission and the boss are laid on
 * the payload here.
 *
 *   cd control
 *   node scripts/spikes/mission/brood.mjs --out /abs/dir [--dry] [--hero <ref>] [--guard <ref>] [--vault …] [--roll …]
 *     [--climb …] [--crouch a,b] [--prone a,b] [--capture] [--cdn]
 */
import fss from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { register } from 'node:module';
register('../../mcp-stdio-loader.mjs', import.meta.url);
import { options, database, starterRoom, writePage, apron } from './lib.mjs';
const here = path.dirname(fileURLToPath(import.meta.url)), o = options(process.argv.slice(2));
database(o.opt('--hero'), o.opt('--guard'));
const out = path.resolve(o.opt('--out', 'brood'));

const { broodWalkerBoss } = await import('../../../lib/graph/gameworld/combat/boss-fight.js');
const { resolveWorldScene } = await import('../../../lib/graph/worlds/world-scene.js');
const { sfxSound } = await import('../../../lib/graph/sfx-shelf/resolve.js');
const L = JSON.parse(fss.readFileSync(path.join(here, 'brood.json'), 'utf8'));
const t0 = Date.now();
const { room, hero, guard } = await starterRoom(o);

// THE YARD
const A = L.apron, { faces, colliders } = apron(A, { backdrop: false }), X0 = A.x[0];

// THE BOSS: its gunners drawn as the yard's guard is
const W = broodWalkerBoss({ id: 'brood', at: [L.walker.at[0], L.walker.at[1], 0], heading: L.walker.heading, packages: L.packages.map((k) => ({ id: k.id, at: [k.at[0], k.at[1], 0] })),
  crew: { figure: guard.body.figure }, down: { item: 'brood-down' } });
W.boss.phases.brood.hack = { ...W.boss.phases.brood.hack, secs: L.rf.secs };

// THE OPERATIVE: its kit, and the RF gun beside it (a slot of its own: held on a courier, it jams its link and hacks it)
const slots = hero.rule.loadout ?? [], dart = slots.find((s) => s.weapon?.stun) ?? slots[0];
const RF = { ...dart, name: 'RF gun', weapon: { fireClass: 'sight', auto: true, rof: 10, damage: 0, magazine: 999, reserve: null, reload: 0.5, range: L.rf.range, coreAngle: 2.5, assistAngle: 6, quiet: true, jam: true, spread: { base: 0, move: 0, bloom: 0, recover: 5, max: 0 }, recoil: { kick: 0, recover: 5, max: 0 } } };
const supply = (s, i) => (s.kind === 'ration' ? { id: `ration-${i}`, name: 'A ration', look: 'ration', gives: { hp: 40 }, at: [s.at[0], s.at[1], 0] } : { id: `ammo-${i}`, name: 'Rounds for the handgun', look: 'ammo', gives: { rounds: 15 }, at: [s.at[0], s.at[1], 0] });
const mission = {
  items: L.supplies.map(supply),
  objectives: [{ id: 'brood', says: 'bring down the brood walker with its own drones', done: 'brood-down' }],
  hints: L.hints.map((h) => ({ ...h, at: [h.at[0], h.at[1]] })),
  result: { at: [X0 + 2, 0, 0], radius: 4, when: ['brood-down'] }, leave: ['brood-down'],
  arrivals: { 'yard-gate': { at: [L.hero.at[0], L.hero.at[1], 0.05], heading: L.hero.heading } },
  unsure: 'its drones are the way in: put its gunners down, then hack a courier',
};
const heroE = { ...hero, rule: { ...hero.rule, step: 0.35, mission, loadout: [...slots, RF], carry: { items: [{ id: 'ration', name: 'ration', count: L.kit.rations, heal: 40 }] } },
  transform: { pos: [L.hero.at[0], L.hero.at[1], 0.05], heading: L.hero.heading } };

// ITS SOUNDS
const cue = (w) => { const s = sfxSound(w); if (!s?.gestures) throw new Error(`brood: '${w}' is not a one-shot on the SFX shelf`); return s.gestures; };
const audio = { mix: { space: 'open', voices: 14, distance: true, reach: 600 }, cues: {}, boss: { 'burst-fire': cue('machine gun'), drop: cue('whistle'), burst: cue('big explosion'), 'drone-down': cue('explosion'), jam: cue('zap'), alarm: cue('alarm') } };

const manifest = {
  ...room.manifest, title: `${L.name} · Steel Serpents`, bg: '#9aa3ab', faces, colliders, blocks: L.cover.map((b) => ({ thick: 0.6, ...b, at: [b.at[0], b.at[1], 0] })),
  figures: room.manifest.figures, entities: [heroE, ...W.entities], audio,
  camera: { ...room.manifest.camera, dist: Math.max(room.manifest.camera.dist ?? 4, 5.5), height: Math.max(room.manifest.camera.height ?? 2, 2.4) },
};
console.log(`brood: ${W.readout.frame} ${W.readout.height} m · doors ${JSON.stringify(W.readout.doors)} · gunners ${W.readout.gunners.join(', ')} · drones ${W.readout.drones.length} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
console.log(`brood: kit ${heroE.rule.loadout.map((s) => s.name).join(', ')} · packages ${L.packages.length} · shelters ${A.shelters.length} · cover ${L.cover.length}`);
if (o.has('--dry')) process.exit(0);
const { payload } = await resolveWorldScene({ ref: 'steel-serpents-brood', title: manifest.title, manifest }, {});
// (the walker's and its drones' figures as their shelves pack them: the controllable kind would read them as a person's)
const { file, mb } = await writePage({ ...payload, figures: { ...payload.figures, ...W.figures }, audio }, room, path.join(out, 'level-2-brood.html'), { capture: o.has('--capture'), cdn: o.has('--cdn') });
console.log(`brood: ${file} (${mb} MB) · entities ${payload.entities.length} · colliders ${payload.colliders.length} · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
process.exit(0);
