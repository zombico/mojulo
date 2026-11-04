/**
 * mecha shelf characterization net: one hash per builder path (a part chosen from the inventory in code, the first of
 * each kind and family), a leg's part built for the left hand, a ram's rod, and one whole assembled frame at its rest stance. An
 * inventory row is a part number and an archetype a frame: a frame minted from them regenerates on every read, so its
 * recipe is a compatibility promise over minted rows. The pins hash the emitted RECIPE (the workbench lowerers under it
 * have their own pins). Re-pin ONLY alongside a change that says a part's emission changes, and log it here.
 *
 * Log:
 *   - The shelf's first frame, the all-terrain walker (unreleased): every builder path pinned.
 *   - Its knees bent backward (the leg's rams mirrored fore and aft, the ankle's re-solved), its nose one shape (the
 *     prow, the chin and the dash folded into it): the leg's parts, the saddle, the cabin and the frame re-pinned.
 *   - The utility walker (unreleased): its platform, its torso frame and its arm's parts pinned as builder paths (a
 *     path is a kind and its family); the walker's pins did not move.
 *   - The utility walker's operator seated (the platform's work seat, the torso frame lowered to it): the station and
 *     the torso re-pinned; the walker's pins did not move.
 *   - The heavy walker (unreleased): its closed cab pinned. Its scaled parts are their designs' builder paths, drawn
 *     larger; no other pin moved.
 *   - The heavy walker's cab angled (its windshield raked under a visor, its sides drawn in, framed glass, a low
 *     window, its plates on whole-millimetre axes): the cab re-pinned; no other pin moved.
 *   - The manipulators' ODM (unreleased): each tool's builder path pinned (the bucket, the breaker, the crusher, the
 *     forks, the auger, the vacuum lifter, the magnet, the hook); no other pin moved.
 *   - The giant arm pack (unreleased): the pack, the armoured shoulder, and the giant arms' tools (the hand, the
 *     spreader, the prop, the shear, the vibratory driver, the clamshell) pinned; no other pin moved.
 *   - The design houses' giant arm packs (unreleased): each house's construction pinned as builder paths (the plated,
 *     tube, truss and sealed arm beams, the faired, truss and sealed shoulders, the spine, gantry and sealed packs, the
 *     screw actuator, the gripper), a four-fingered hand, and one house's frame whole (its solved pins and strokes in
 *     it); the hand's fingers drawn by count left the three-fingered hand's pin where it was; no other pin moved.
 *   - The field walker (unreleased): its hardened parts pinned as builder paths (the armoured pelvis, the guarded thigh
 *     and shank, the lugged foot, the field cabin, the racked pack), and its dressed faces whole (the military styling
 *     library's livery, kit, stencils and wear on it: a change there moves this pin); no other pin moved.
 *   - The field walker's armoured cabin (unreleased): its builder path pinned, and its slits shut; no other pin moved.
 *   - The backpacks (unreleased): the weapons backpack's builder paths pinned (its pack, its mounts' ring and cradle, its
 *     payloads and their spares, its tail's base, segments and head), and a frame carrying it whole; no other pin moved.
 *   - The rover walker (unreleased): its wheeled shank and ankle, its wheel and the autocannon pinned as builder paths, and
 *     the frame whole walking and collapsed onto its wheels; no other pin moved.
 *   - The rover walker drawn larger, its own legs at 1.35, its armoured cabin as built, its shanks' skirts, its wheels an
 *     armoured car's, its legs plumb collapsed: its wheeled shank and ankle, its wheel and the frame re-pinned; a cabin
 *     stays homed on the frame that offers it, so the cabin's pin did not move; no other pin moved.
 *   - The siege walker (unreleased): its keeled pelvis, its howitzer, its missile launcher and its spare missile pod
 *     pinned as builder paths, and the frame whole walking and collapsed; twin tails and a cockpit's radar left every
 *     earlier pin where it was.
 *   - The siege walker reshaped: its hull between the backpack and the cockpit, its weapons lower and wider, its plated
 *     thighs, its shorter shanks with three wheels in line, its long toed feet laid level ahead when it rolls: its keeled
 *     pelvis and the frame re-pinned, its plated thigh and its toed foot pinned as builder paths; no other pin moved.
 *   - The brood walker reshaped: its bays stood on their noses, shells to the front; its hips low on the hull's sides,
 *     each leg lifted by a ram; its solar car folding origami-style (a deck, wings, leaves): its hull, hub, column,
 *     shank, ankle, cradle, bay and car re-pinned, the deck and the wing pinned as builder paths (the flat panel gone),
 *     and the frame whole re-pinned; no other pin moved.
 *   - The brood walker's bays armoured (a rounded shell fore and aft of each hinge, the fore bays' nose cone, the aft
 *     bays' taper: a side's two one torpedo driving): its bay and the frame whole re-pinned; the aft bay is the bay's
 *     builder path, carried in the frame's pin; no other pin moved.
 */
import { createHash } from 'node:crypto';
import { dressFaces } from './mecha-military.js';
import { MECHA_PALETTES } from './mecha-common.js';
import { describe, expect, it } from 'vitest';

import { MECHA_ARCHETYPES, MECHA_MAKERS, MECHA_MAKER_IDS, MECHA_ODM, assembleFrame, resolveMechaPart } from './index.js';

const hash = (v) => createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 16);
// (a builder path is a kind and its family: a seat astride and a platform stood on are two)
const firstOfKind = [...new Map(Object.entries(MECHA_ODM).map(([sku, r]) => [`${r.kind}|${r.build.family}`, sku]).reverse()).values()].reverse();
const sided = Object.values(MECHA_ARCHETYPES)[0].layout.find((e) => e.side === 'l' && !e.ram).sku;
const ram = Object.entries(MECHA_ODM).find(([, r]) => r.kind === 'mecha-ram')[0];

const PINS = {
  'seat-atw': '21cccf930c2dc585',
  'cage-atw': 'fd2c4a6f9121233c',
  'torso-uw': '609e7d0794b91525',
  'pack-atw': 'aae25a1a90f1ab36',
  'shoulder-uw': '4274873688ac1ba8',
  'bucket-hw': 'd6a84deb6b46d43f',
  'breaker-hw': '2cff9f9007aa0031',
  'crusher-hw': '18bf87c48820c800',
  'forks-hw': '257aaf34ebe07ec7',
  'auger-hw': 'df34f317aaa81e23',
  'vacuum-hw': '9be30f06723a9876',
  'magnet-hw': 'bebb9f179bbcfe12',
  'cab-hw': '394d456754ef5919',
  'pelvis-atw': '2bf43bb8301d2d01',
  'hip-atw': '7dfe96529b8d835d',
  'yoke-atw': 'e980194856eb1827',
  'thigh-atw': 'a44ce218cfb438dc',
  'shank-atw': '9c982a643e837fda',
  'ankle-atw': '8133ce847f2c2453',
  'foot-atw': '3be20c16d08b2679',
  'platform-uw': 'fb8cab49220662f2',
  'gap-gw': '57b32e5372d14477',
  'shoulder-gw': '4bbf7c7d323a87fd',
  'upperarm-uw': 'bdec84b9678a660a',
  'forearm-uw': '34748c5c9f4faad8',
  'wrist-uw': 'cad5b13936f7c5f7',
  'ram-roll-atw': 'e73d554306c2f29f',
  'hand-gw': 'bef2f791c6b8cbe5',
  'claw-uw': 'c3ab1299a2f96d73',
  'spreader-gw': '3ba73f53d67afe1f',
  'prop-gw': '18fa8638c6b846e1',
  'shear-gw': '28235c6ff25f624c',
  'vibro-gw': '98bb4966e6f55be8',
  'clamshell-gw': 'e5101baed53f40a7',
  'hook-hw': 'a1778d396709fe24',
  'forearm-aero': 'e353e97bf6ce2dcf',
  'forearm-forge': 'c170c4cb50054138',
  'forearm-sealed': '5ef6a68bc614fcff',
  'forearm-truss': '5d4b14b9119ac799',
  'gap-aero': '82f9b93e47669de6',
  'gap-sealed': '79f37a17bd90b2fe',
  'gap-truss': '5f07f36dc4ac6927',
  'hand-truss': '3cf19c722bff3a27',
  'ram-shoulder-aero': '95fe768848d67100',
  'shoulder-aero': '85a300266f3aae0f',
  'shoulder-sealed': 'a3465f02fb3de0ac',
  'shoulder-truss': '4b5947e80234ad54',
  'upperarm-aero': '3f646d1fe874c385',
  'upperarm-forge': '1a94065a4912ad0d',
  'upperarm-sealed': '0410b69d31b3d1d2',
  'upperarm-truss': '8e2f64b16e66ceec',
  'cage-fw': '3a27d00ffd7b6977',
  'foot-fw': 'a57797886427d19f',
  'pack-fw': 'ce46dd182cf824d7',
  'pelvis-fw': '7a692cd20a1e5fbe',
  'shank-fw': '820c6a747c91d0b3',
  'thigh-fw': 'e472eeb2e0936709',
  'cabin-fw': 'ca168f1c2b7725ea',
  'ammobox-wpn': 'ed9589d258b5e0f1',
  'cradle-wpn': '875886ce6fe1b9e9',
  'minigun-wpn': '7e61ad3144a97fdc',
  'mount-wpn': '16118eb90116183e',
  'pack-wpn': 'd78fc8082176f8ea',
  'rocketpod-wpn': 'd8a1c37c30a6b17a',
  'rockets-wpn': 'd2d608c151e476f6',
  'tailbase-wpn': '65d91d9041a4821f',
  'tailhead-wpn': 'ffcc4b825324ca65',
  'tailseg1-wpn': 'bf0642359af46d10',
  'ankle-rw': '125a36f10a4253cc',
  'cannon-wpn': 'e14843f6b23224d6',
  'shank-rw': '1cd7c0dfc095c3c1',
  'wheel-rw': '4ae279b99a3cd708',
  'howitzer-sw': '468e79bf36bb78e5',
  'pelvis-sw': 'd8a8b3380366edaa',
  'foot-sw': 'bfd5c1239080edb5',
  'toe1-sw': 'ab54a14b87f3e936',
  'toe2-sw': '598875ee9f9712b8',
  'sensor-wpn': 'f940979bb9e546b7',
  'drones-wpn': 'c9422fb634d459dd',
  'smoke-wpn': 'ff65787676348db8',
  'aam-wpn': '3b8102c7e8b76dd5',
  'aampod-wpn': 'b97979e1e07b05d4',
  'cargo-wpn': '0decc2991b339e78',
  'winch-wpn': '8632112e37ab33d1',
  'cradle-bw': 'ada6455012bd2a7e',
  'car-bw': '9dfe27f77893b704',
  'bay-bw': '5ce9a1b69b5cde94',
  'ankle-bw': '72f7f2aa7295c94b',
  'column-bw': '311fed077a95e243',
  'coxa-bw': 'b2d3cc982cfa5b21',
  'hub-bw': '2b59638db2765981',
  'deck-bw': '37d3499ddd4a031c',
  'wing-bw': '9571f4a4df707c7e',
  'pelvis-bw': 'ed61f8202700f38c',
  'solar-bw': '0d57bba65cf5b1ca',
  'tibia-bw': '832112513a170dea',
  'thigh-sw': '08b637f4320f16d1',
};
const LEFT = 'c9882af91b6cf973';
const ROD = 'bcfdb3e1621e0b1a';
const FRAME = '5d7f243552d47f90';
// (a house's hand of four fingers, and a frame carrying a house's pack: the first house with screw actuators, solved)
const FOUR = 'eed71d6238d7aa3c';
const HOUSE = '22d1c303d8f1b5ad';
// (a dressed frame's faces at its rest stance, in its own dress)
const DRESSED = '11e116ab05219a97';
const SHUT = '82ad4d81d813b60e';
const BACKPACKED = '420fceac250411af';
const SIEGE = ['9a1b7f9ff8b5e291', '8f0a988a084d563e'];
const BROOD = ['e71705e88d9ae7ba', '6efd1c7229a56d7a', '2e9e806a5339b828'];
const ROVER = ['b9b45a6b998bab2e', 'b1a36b438ff216d1'];
const fourFingered = Object.entries(MECHA_ODM).find(([, r]) => r.kind === 'mecha-tool' && r.dims.fingers === 4)[0];
const screwHouse = MECHA_MAKER_IDS.find((id) => MECHA_MAKERS[id].actuator === 'screw');

describe('mecha shelf: characterization', () => {
  it('pins every builder path', () => {
    const got = Object.fromEntries(firstOfKind.map((sku) => [sku, hash(resolveMechaPart(sku))]));
    expect(got).toEqual(PINS);
  });
  it('pins a leg\'s part built for the left hand, and a ram\'s rod', () => {
    expect(hash(resolveMechaPart(sided, { side: 'l' }))).toBe(LEFT);
    expect(hash(resolveMechaPart(ram, { part: 'rod' }))).toBe(ROD);
  });
  it('pins a whole frame at its rest stance', () => {
    expect(hash(assembleFrame(Object.keys(MECHA_ARCHETYPES)[0], { laws: false }).manifest)).toBe(FRAME);
  });
  it('pins a four-fingered hand, and a frame carrying a design house\'s pack', () => {
    expect(hash(resolveMechaPart(fourFingered))).toBe(FOUR);
    const carrier = Object.keys(MECHA_ARCHETYPES).find((id) => MECHA_ARCHETYPES[id].packMount);
    expect(hash(assembleFrame(carrier, { packMaker: screwHouse, laws: false }).manifest)).toBe(HOUSE);
  });
  it('pins a closed cabin with its slits shut', () => {
    const sku = Object.entries(MECHA_ODM).find(([, r]) => r.kind === 'mecha-cage' && r.dims.slits)[0];
    expect(hash(resolveMechaPart(sku, { part: 'shut' }))).toBe(SHUT);
  });
  it('pins a frame carrying a backpack, its tail stowed', () => {
    const id = Object.keys(MECHA_ARCHETYPES).find((k) => MECHA_ARCHETYPES[k].backpacks?.length);
    expect(hash(assembleFrame(id, { backpack: MECHA_ARCHETYPES[id].backpacks[0], laws: false }).manifest)).toBe(BACKPACKED);
  });
  it('pins a frame on wheels walking and collapsed', () => {
    const id = Object.keys(MECHA_ARCHETYPES).find((k) => MECHA_ARCHETYPES[k].wheels);
    const roll = Object.keys(MECHA_ARCHETYPES[id].stances).find((k) => MECHA_ARCHETYPES[id].stances[k].roll);
    expect([hash(assembleFrame(id, { laws: false }).manifest), hash(assembleFrame(id, { pose: roll, laws: false }).manifest)]).toEqual(ROVER);
  });
  it('pins a frame with twin tails walking and collapsed', () => {
    const id = Object.keys(MECHA_ARCHETYPES).find((k) => MECHA_ARCHETYPES[k].tails);
    expect([hash(assembleFrame(id, { laws: false }).manifest), hash(assembleFrame(id, { pose: 'roll', laws: false }).manifest)]).toEqual(SIEGE);
  });
  it('pins a four-legged frame standing, launching its drones and driving', () => {
    const id = Object.keys(MECHA_ARCHETYPES).find((k) => MECHA_ARCHETYPES[k].docks), A = MECHA_ARCHETYPES[id];
    const launch = Object.keys(A.stances).find((k) => A.stances[k].launch), drive = Object.keys(A.stances).find((k) => A.stances[k].place === 'tuck');
    expect([A.rest, launch, drive].map((pose) => hash(assembleFrame(id, { pose, laws: false }).manifest))).toEqual(BROOD);
  });
  it('pins a dressed frame\'s faces in its dress', () => {
    const id = Object.keys(MECHA_ARCHETYPES).find((k) => MECHA_ARCHETYPES[k].dress), { manifest, readout } = assembleFrame(id, { finish: false, laws: false });
    expect(hash(dressFaces({ manifest, anchors: readout.anchors, colors: MECHA_PALETTES[MECHA_ARCHETYPES[id].palette], archetype: id }))).toBe(DRESSED);
  });
});
