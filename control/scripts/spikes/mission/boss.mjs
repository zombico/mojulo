#!/usr/bin/env node
/**
 * THE SIEGE WALKER, FOUGHT — level 1's boss (siege.json) as one page: the test apron behind the hangar, its cover (jersey
 * barriers a crouch hides behind, containers a body stands behind, crates), the operative and its kit, and the siege walker
 * from under the hangar as the boss (gameworld/combat/boss-fight.js siegeWalkerBoss on the runtime's boss,
 * worlds/controllable/boss.js). Standing, it lays barrages (rings where they land: get a wall between you and them),
 * reloads with its tails and walks on to where its shells fell: mines laid there (H: they are the item menu's first)
 * break its legs, and its reloaders shot from behind slow its reload. Its legs gone it folds into its tank form, fought
 * as a tank is: its gun traverses slowly (keep moving round it), a mine under its wheels stops it, its engine is open from
 * behind, its folded hips from its sides, its sights from anywhere. A spike: the stage takes no pilot, so the hero's
 * camera, the mission and the boss are laid on the payload here.
 *
 *   cd control
 *   node scripts/spikes/mission/boss.mjs --out /abs/dir [--dry] [--hero <ref>] [--guard <ref>] [--vault …] [--roll …]
 *     [--climb …] [--crouch a,b] [--prone a,b] [--tank] [--capture] [--cdn]
 *
 *   --tank   start the walker in its tank form (the second phase, to try it alone)
 */
import fss from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { register } from 'node:module';
register('../../mcp-stdio-loader.mjs', import.meta.url);
import { options, database, starterRoom, writePage, apron } from './lib.mjs';
const here = path.dirname(fileURLToPath(import.meta.url)), o = options(process.argv.slice(2));
database(o.opt('--hero'), o.opt('--guard'));
const out = path.resolve(o.opt('--out', 'siege'));

const { siegeWalkerBoss } = await import('../../../lib/graph/gameworld/combat/boss-fight.js');
const { resolveWorldScene } = await import('../../../lib/graph/worlds/world-scene.js');
const { sfxSound } = await import('../../../lib/graph/sfx-shelf/resolve.js');
const L = JSON.parse(fss.readFileSync(path.join(here, 'siege.json'), 'utf8'));
const t0 = Date.now();
const { room, hero } = await starterRoom(o);

// THE APRON: concrete in tiles a shade apart (so a run reads on it), a fence round it, the hangar's back wall behind it
const A = L.apron, { faces, colliders } = apron(A), X0 = A.x[0];

// THE BOSS: the siege walker from under the hangar, on the apron
const W = siegeWalkerBoss({ id: 'siege', at: [L.walker.at[0], L.walker.at[1], 0], heading: L.walker.heading, bounds: L.walker.bounds, down: { item: 'siege-down' } });
if (o.has('--tank')) W.boss.start = 'tank';
W.boss.mine.crates = L.crates.map((c) => ({ ...c, at: [c.at[0], c.at[1], 0] }));

// THE OPERATIVE: its kit, and mines first in its item menu (a tap of H lays one); the mission's objective and supplies
const supply = (s, i) => (s.kind === 'ration' ? { id: `ration-${i}`, name: 'A ration', look: 'ration', gives: { hp: 40 }, at: [s.at[0], s.at[1], 0] } : { id: `ammo-${i}`, name: 'Rounds for the handgun', look: 'ammo', gives: { rounds: 15 }, at: [s.at[0], s.at[1], 0] });
const mission = {
  items: L.supplies.map(supply),
  objectives: [{ id: 'walker', says: 'bring down the siege walker', done: 'siege-down' }],
  hints: L.hints.map((h) => ({ ...h, at: [h.at[0], h.at[1]] })),
  result: { at: [X0 + 2, 0, 0], radius: 4, when: ['siege-down'] },
  // (in from the hangar's hall, its back doors: hangar.mjs `apron-door`)
  arrivals: { 'hangar-back': { at: [L.hero.at[0], L.hero.at[1], 0.05], heading: L.hero.heading } },
  leave: ['siege-down'],
  unsure: 'the walker blocks the way out: bring it down',
};
const heroE = { ...hero, rule: { ...hero.rule, step: 0.35, mission, carry: { items: [{ id: 'mine', name: 'mine', count: L.kit.mines }, { id: 'ration', name: 'ration', count: L.kit.rations, heal: 40 }] } },
  transform: { pos: [L.hero.at[0], L.hero.at[1], 0.05], heading: L.hero.heading } };

// ITS SOUNDS: the shelf's, by the words people say
const cue = (w) => { const s = sfxSound(w); if (!s?.gestures) throw new Error(`boss: '${w}' is not a one-shot on the SFX shelf`); return s.gestures; };
const audio = { mix: { space: 'open', voices: 14, distance: true, reach: 600 }, cues: {}, boss: { launch: cue('cannon'), round: cue('cannon'), missile: cue('missile launch'), burst: cue('big explosion'), mine: cue('grenade'), alarm: cue('alarm'), lock: cue('whistle'), step: cue('giant step') } };

const manifest = {
  ...room.manifest, title: `${L.name} · Steel Serpents`, bg: '#9aa3ab', faces, colliders, blocks: L.cover.map((b) => ({ thick: 0.6, ...b, at: [b.at[0], b.at[1], 0] })),
  figures: room.manifest.figures, entities: [heroE, ...W.entities], audio,
  // (the camera further out than the yard's: the walker is eight metres tall)
  camera: { ...room.manifest.camera, dist: Math.max(room.manifest.camera.dist ?? 4, 5.5), height: Math.max(room.manifest.camera.height ?? 2, 2.4) },
};
console.log(`boss: ${W.readout.frame} ${W.readout.height} m, ${W.readout.mass} kg · walks ${W.readout.gait.speed.toFixed(2)} m/s · folds in ${W.readout.transformDur} s · spots ${W.readout.spots.join(', ')} · clips ${W.readout.clips.join(', ')} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
console.log(`boss: cover ${L.cover.length}, mine crates ${L.crates.length}, supplies ${L.supplies.length} · starts ${W.boss.start}`);
if (o.has('--dry')) process.exit(0);
const { payload } = await resolveWorldScene({ ref: 'steel-serpents-level-1-siege', title: manifest.title, manifest }, {});
// (the walker's figure as the frame packs it, its rig and its clips: the controllable kind would read it as a person's)
const { file, mb } = await writePage({ ...payload, figures: { ...payload.figures, ...W.figures }, audio }, room, path.join(out, 'level-1-siege.html'), { capture: o.has('--capture'), cdn: o.has('--cdn') });
console.log(`boss: ${file} (${mb} MB) · entities ${payload.entities.length} · colliders ${payload.colliders.length} · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
process.exit(0);
