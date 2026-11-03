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
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { MECHA_ARCHETYPES, MECHA_ODM, assembleFrame, resolveMechaPart } from './index.js';

const hash = (v) => createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 16);
// (a builder path is a kind and its family: a seat astride and a platform stood on are two)
const firstOfKind = [...new Map(Object.entries(MECHA_ODM).map(([sku, r]) => [`${r.kind}|${r.build.family}`, sku]).reverse()).values()].reverse();
const sided = Object.values(MECHA_ARCHETYPES)[0].layout.find((e) => e.side === 'l' && !e.ram).sku;
const ram = Object.entries(MECHA_ODM).find(([, r]) => r.kind === 'mecha-ram')[0];

const PINS = {
  'seat-atw': '21cccf930c2dc585',
  'cage-atw': 'fd2c4a6f9121233c',
  'torso-uw': '609e7d0794b91525',
  'pelvis-atw': '2bf43bb8301d2d01',
  'hip-atw': '7dfe96529b8d835d',
  'yoke-atw': 'e980194856eb1827',
  'thigh-atw': 'a44ce218cfb438dc',
  'shank-atw': '9c982a643e837fda',
  'ankle-atw': '8133ce847f2c2453',
  'foot-atw': '3be20c16d08b2679',
  'pack-atw': 'aae25a1a90f1ab36',
  'shoulder-uw': '4274873688ac1ba8',
  'upperarm-uw': 'bdec84b9678a660a',
  'wrist-uw': 'cad5b13936f7c5f7',
  'claw-uw': 'c3ab1299a2f96d73',
  'forearm-uw': '34748c5c9f4faad8',
  'ram-roll-atw': 'e73d554306c2f29f',
  'bucket-hw': 'd6a84deb6b46d43f',
  'breaker-hw': '2cff9f9007aa0031',
  'crusher-hw': '18bf87c48820c800',
  'forks-hw': '257aaf34ebe07ec7',
  'auger-hw': 'df34f317aaa81e23',
  'vacuum-hw': '9be30f06723a9876',
  'magnet-hw': 'bebb9f179bbcfe12',
  'hook-hw': 'a1778d396709fe24',
  'platform-uw': 'fb8cab49220662f2',
  'cab-hw': '394d456754ef5919',
};
const LEFT = 'c9882af91b6cf973';
const ROD = 'bcfdb3e1621e0b1a';
const FRAME = '5d7f243552d47f90';

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
});
