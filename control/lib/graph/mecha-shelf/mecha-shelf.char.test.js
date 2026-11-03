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
};
const LEFT = 'c9882af91b6cf973';
const ROD = 'bcfdb3e1621e0b1a';
const FRAME = '5d7f243552d47f90';
// (a house's hand of four fingers, and a frame carrying a house's pack: the first house with screw actuators, solved)
const FOUR = 'eed71d6238d7aa3c';
const HOUSE = '22d1c303d8f1b5ad';
// (a dressed frame's faces at its rest stance, in its own dress)
const DRESSED = '11e116ab05219a97';
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
  it('pins a dressed frame\'s faces in its dress', () => {
    const id = Object.keys(MECHA_ARCHETYPES).find((k) => MECHA_ARCHETYPES[k].dress), { manifest, readout } = assembleFrame(id, { finish: false, laws: false });
    expect(hash(dressFaces({ manifest, anchors: readout.anchors, colors: MECHA_PALETTES[MECHA_ARCHETYPES[id].palette], archetype: id }))).toBe(DRESSED);
  });
});
