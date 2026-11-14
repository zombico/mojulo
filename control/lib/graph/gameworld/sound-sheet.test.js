import { describe, it, expect } from 'vitest';
import { soundSheet, sheetAudio, readSound } from './sound-sheet.js';
import { resolveWorldAudio } from '../beats/beats-world.js';
import { audioChannelScript } from '../scene/channels/audio.js';
import { sfxSound } from '../sfx-shelf/resolve.js';
import { SOUNDS } from '../sfx-shelf/roster.js';
import { STAGE_KITS } from '../era/stage.js';
import { BASIC_ARSENAL } from './combos.js';

// The sound sheet (sound-sheet.js): a game's sounds solved from what it is, the newest voices first, and voiced on a
// level by beats-world's `sfx: { sheet }`. One case per procedure.

// the basic kit's blade, renamed a staff: a weapon read by its words
const STAFF = { arsenal: { ...structuredClone(BASIC_ARSENAL), weapons: [{ ...structuredClone(BASIC_ARSENAL.weapons[0]), id: 'bo', name: 'Bo staff' }] } };
const nature = Object.keys(STAGE_KITS).find((k) => STAGE_KITS[k].shell === 'nature' || STAGE_KITS[k].shell === 'jungle');

describe('the sheet', () => {
  it('is solved from the game: its weapon, its ground, its foes; mouth first', () => {
    const S = soundSheet({ ...STAFF, foes: { alpha: { class: 'brute', skin: { species: 'wolf' } } } }, { manifest: { kit: nature } });
    expect(S.style).toBe('mouth');
    expect(S.slots).toMatchObject({ swing: 'staff-swing', step: 'step-grass' });
    expect(S.foes.alpha).toBe('snarl');
    expect(S.on).toMatchObject({ door: 'latch', alarm: 'snarl' });
    for (const w of [S.slots.swing, S.slots.step, S.on.door]) expect(SOUNDS[w].voices.mouth).toBe('mouth');
    // (a beast's voice by its species: the specific animal before the general beast)
    expect(soundSheet({}, { manifest: { kit: 'snowy-pass' } }).slots.step).toBe('step-snow');
    expect(soundSheet({ foes: { rex: { class: 'brute', skin: { species: 'dog' } }, kaw: { class: 'brute', skin: { species: 'crow' } } } }).foes).toEqual({ rex: 'dog-bark', kaw: 'crow' });
  });

  it('a game with nothing said swings the basic blade on stone; what the game writes wins, and a bad word is refused with the shelf\'s', () => {
    expect(soundSheet({}).slots).toMatchObject({ swing: 'blade-swing', strike: 'blade-hit', step: 'step-concrete' });
    expect(soundSheet({ ...STAFF, sound: { style: 'realistic', slots: { swing: 'blunt-swing' } } })).toMatchObject({ style: 'realistic', slots: { swing: 'blunt-swing' } });
    expect(() => readSound({ slots: { swing: 'staff spinny' } })).toThrow(/'staff-/);
    expect(() => readSound({ style: 'loud' })).toThrow(/style/);
  });
});

describe('a level hears it (beats-world sfx: { sheet })', () => {
  it('voices the mechanics\' cues by the sheet\'s words and the slots by its own, in its style', () => {
    const audio = resolveWorldAudio({ sfx: sheetAudio(STAFF) }, { ref: 'lv', mechanics: ['door', 'reach-exit'] });
    expect(audio.sheet).toBe('mouth');
    expect(audio.on).toMatchObject({ 'door:*': 'door', 'goal:reached*': 'goal' });
    expect(audio.cues.door).toEqual(sfxSound('latch', { style: 'mouth' }).gestures);
    expect(audio.cues.goal).toEqual(sfxSound('goal', { style: 'mouth' }).gestures);
    // (a game with an arsenal: the staff's swing is its moveset's, in the strike's place)
    expect(audio.cues[audio.moves.swing.bo.light]).toEqual(sfxSound('staff-swing', { style: 'mouth' }).gestures);
  });
});

describe('one breath across the hits (a performer\'s)', () => {
  it('a sheet level carries it, every hit a variant; a level without a sheet carries not a byte of it', () => {
    const sheet = resolveWorldAudio({ sfx: sheetAudio(STAFF) }, { ref: 'lv', mechanics: ['door'] });
    expect(sheet.breath).toMatchObject({ spend: expect.any(Number), recover: expect.any(Number), floor: expect.any(Number) });
    expect(sheet.vary).toBe(true);
    const js = audioChannelScript(sheet);
    expect(js).toContain('__breath');
    expect(() => new Function(js)).not.toThrow();
    const plain = resolveWorldAudio({ sfx: 'auto' }, { ref: 'lv', mechanics: ['door'] });
    expect(plain.breath).toBeUndefined();
    expect(audioChannelScript(plain)).not.toContain('__breath');
    expect(resolveWorldAudio({ sfx: { sheet: { ...sheetAudio(STAFF).sheet, breath: false } } }, { ref: 'lv' }).breath).toBeUndefined();
  });
});

describe('a game\'s hits vary (combos, bursts of fire, a beam\'s shots)', () => {
  it('on for a game on the sheet or with a sound of its own, off for a game made before; its own word wins', async () => {
    const { variesHits } = await import('./sound-sheet.js');
    const { roomAudio } = await import('./practice-room.js');
    expect(variesHits({ quick: { sfx: 'sheet' } })).toBe(true);
    expect(variesHits({ sound: {} })).toBe(true);
    expect(variesHits({})).toBe(false);
    expect(variesHits({ quick: { sfx: 'sheet' }, sound: { vary: false } })).toBe(false);
    const arsenal = structuredClone(BASIC_ARSENAL);
    expect(roomAudio(arsenal, 'realistic', { vary: true }).sfx.vary).toBe(true);
    expect(roomAudio(arsenal, 'realistic').sfx.vary).toBeUndefined();
  });
});

describe('a level\'s bed (its environment, under the score)', () => {
  it('the stage says it (its kit, its weather, its hour); the game\'s own word wins, false lays none; a built stage none', async () => {
    const { sheetBed } = await import('./sound-sheet.js');
    expect(sheetBed({}, { manifest: { kit: nature } })).toBe('forest');
    expect(sheetBed({}, { manifest: { kit: nature, weather: 'rain' } })).toBe('rain');
    expect(sheetBed({}, { manifest: { kit: 'gothic-stone' } })).toBeNull();
    expect(sheetBed({ sound: { bed: 'cave' } }, { manifest: { kit: nature } })).toBe('cave');
    expect(sheetBed({ sound: { bed: false } }, { manifest: { kit: nature } })).toBeNull();
  });

  it('a level with a bed plays it on its own engine; one without carries not a byte of it', () => {
    const withBed = resolveWorldAudio({ bed: 'night' }, { ref: 'lv' });
    expect(withBed.bed.kind).toBe('beats-pattern');
    const js = audioChannelScript(withBed);
    expect(js).toContain('__bedEng');
    expect(() => new Function(js)).not.toThrow();
    expect(audioChannelScript(resolveWorldAudio({ sfx: 'auto' }, { ref: 'lv' }))).not.toContain('__bedEng');
    expect(() => resolveWorldAudio({ bed: 'nowhere' }, { ref: 'lv' })).toThrow(/is a bed/);
  });
});

describe('a game on the sheet hears it on every level it builds', () => {
  it('a `sound` of its own or a quick `sfx: \'sheet\'` puts it on; another quick sfx keeps its own; the stage\'s own audio is kept', async () => {
    const { onSheet, levelSheet } = await import('./sound-sheet.js');
    expect(onSheet({})).toBe(false);
    expect(onSheet({ sound: {} })).toBe(true);
    expect(onSheet({ quick: { sfx: 'sheet' } })).toBe(true);
    expect(onSheet({ sound: {}, quick: { sfx: 'arcade' } })).toBe(false);
    expect(levelSheet({}, { manifest: { kit: nature } })).toBeNull();
    const A = levelSheet({ ...STAFF, sound: {} }, { manifest: { kit: nature } });
    expect(A).toEqual({ sfx: sheetAudio({ ...STAFF, sound: {} }, { manifest: { kit: nature } }), bed: 'forest' });
    // a stage that wrote its own soundtrack, sfx or bed keeps each
    const own = { soundtrack: 'field:forest', sfx: 'auto', bed: 'cave' };
    expect(levelSheet({ sound: {} }, { manifest: { kit: nature, audio: own } })).toEqual(own);
    expect(levelSheet({ sound: {} }, { manifest: { kit: nature, audio: { soundtrack: 'field:forest' } } })).toMatchObject({ soundtrack: 'field:forest', sfx: { sheet: expect.any(Object) }, bed: 'forest' });
  });

  it('a designed game\'s levels carry it and resolve; the same game with no `sound` builds the levels it built', async () => {
    const { composeGameworld, runSteps, fingerprint } = await import('./index.js');
    const w = composeGameworld({ prompt: 'a haunted forest with relics to collect', seed: 1 });
    const levels = (W) => runSteps(W, { ref: 'gw' }).filter((s) => s.key.startsWith('level-') && s.order?.manifest);
    const plain = levels(w), heard = levels({ ...w, sound: { style: 'realistic' } });
    expect(plain.length).toBeGreaterThan(0);
    for (const s of plain) expect(s.order.manifest.audio).toBeUndefined();
    expect(heard.length).toBe(plain.length);
    for (const s of heard) expect(s.order.manifest.audio.sfx.sheet.style).toBe('realistic');
    // (the read world carries the game's `sound`: its style reaches a quick game's levels too)
    const { readGameworld } = await import('./index.js');
    expect(readGameworld({ ...w, sound: { style: 'realistic' } }).sound).toEqual({ style: 'realistic' });
    expect(readGameworld(w).sound).toBeUndefined();
    // apart from its audio, a heard level is the level it was
    const bare = ({ audio: _a, ...m }) => m;
    expect(fingerprint(heard.map((s) => bare(s.order.manifest)))).toBe(fingerprint(plain.map((s) => s.order.manifest)));
    // and the level's own mechanics voice it
    const L = heard[0], kinds = (L.order.manifest.game?.mechanics ?? []).map((m) => m.kind);
    const audio = resolveWorldAudio(L.order.manifest.audio, { ref: L.ref, mechanics: kinds });
    expect(audio.sheet).toBe('realistic');
    expect(Object.keys(audio.cues).length).toBeGreaterThan(0);
  });
});

describe('the whole arsenal on the sheet (a moveset\'s events by shelf word)', () => {
  // an arsenal of a weapon read by its words, a plain blade and a fist: one case per way a weapon is read
  const base = structuredClone(BASIC_ARSENAL), sword = base.weapons[0], fist = base.weapons.find((W) => (W.figure ?? 'drawn') !== 'drawn');
  const KIT = { arsenal: { ...base, weapons: [{ ...structuredClone(sword), id: 'kat', name: 'Katana' }, sword, fist] } };

  it('a game with an arsenal: each weapon\'s swing and blow by weight, the guard, the bow, the foes; without one, the two slots', () => {
    expect(soundSheet({}).moves).toBeUndefined();
    const S = soundSheet(KIT);
    expect(S.moves.swing).toMatchObject({ kat: { light: 'katana-swing', heavy: 'katana-heavy-swing' }, [sword.id]: { light: 'blade-swing', heavy: 'blunt-swing' }, [fist.id]: { light: 'swing' } });
    expect(S.moves.hit).toMatchObject({ kat: { light: 'blade-hit' }, [fist.id]: { light: 'punch', heavy: 'uppercut', finisher: 'knockout-blow' } });
    expect(S.moves).toMatchObject({ block: 'block', parry: 'blade-clash', foeSwing: 'blade-swing', hurt: 'flesh-impact' });
    expect(S.why[`weapon:kat`]).toMatch(/katana/);
    // every word it names is a row of the shelf
    const words = [...Object.values(S.moves.swing), ...Object.values(S.moves.hit)].flatMap((W) => Object.values(W)).concat(Object.values(S.moves).filter((v) => typeof v === 'string'));
    for (const w of words) expect(SOUNDS[w] ?? null, w).not.toBeNull();
  });

  it('the game\'s own words win: a weapon\'s, an event\'s; a word off the shelf or an unknown event is refused', () => {
    const S = soundSheet({ ...KIT, sound: { weapons: { kat: { swing: 'staff-swing', finisher: 'uppercut' } }, moves: { parry: 'metal-impact' } } });
    expect(S.moves.swing.kat).toEqual({ light: 'staff-swing', heavy: 'staff-swing', finisher: 'staff-swing' });
    expect(S.moves.hit.kat.finisher).toBe('uppercut');
    expect(S.moves.parry).toBe('metal-impact');
    expect(S.why['weapon:kat']).toBe('the game says so');
    expect(() => readSound({ moves: { shout: 'punch' } })).toThrow(/moveset's event/);
    expect(() => readSound({ weapons: { kat: { swing: 'nope nope' } } })).toThrow(/not a sound on the shelf/);
    expect(() => readSound({ weapons: { kat: { twirl: 'punch' } } })).toThrow(/a weapon's sounds/);
  });

  it('a level voices them: each word one cue, the moveset wired in the strike\'s place; a level with no arsenal as it was', () => {
    const audio = resolveWorldAudio({ sfx: sheetAudio(KIT) }, { ref: 'lv', mechanics: ['door'] });
    expect(audio.strike).toBeUndefined();
    expect(audio.moves.swing.kat.light).toBe('mv-katana-swing');
    expect(audio.cues['mv-katana-swing']).toEqual(sfxSound('katana-swing', { style: 'mouth' }).gestures);
    expect(audio.moves.hit[fist.id]).toEqual({ light: 'mv-punch', heavy: 'mv-uppercut', finisher: 'mv-knockout-blow' });
    for (const id of [audio.moves.block, audio.moves.foeSwing, audio.moves.hurt]) expect(audio.cues[id]).toBeDefined();
    const js = audioChannelScript(audio);
    expect(js).toContain('__beatsMoves');
    expect(() => new Function(js)).not.toThrow();
    const plain = resolveWorldAudio({ sfx: sheetAudio({}) }, { ref: 'lv', mechanics: ['door'] });
    expect(plain.moves).toBeUndefined();
    expect(plain.strike.swing).toBeDefined();
    expect(audioChannelScript(plain)).not.toContain('__beatsMoves');
  });

  it('the practice room reads the same table', async () => {
    const { MOVE_SOUND_WORDS } = await import('./sound-sheet.js');
    const { roomAudio } = await import('./practice-room.js');
    const room = roomAudio(structuredClone(BASIC_ARSENAL), 'foley');
    expect(room.sfx.cues.block).toEqual(sfxSound(MOVE_SOUND_WORDS.block, { style: 'foley' }).gestures);
  });
});

describe('a sheet game\'s guns (each by what it is, the firing range\'s procedure)', () => {
  it('a gun\'s shot by its numbers, its reload over its own time; the game\'s word wins; a game on no sheet has none', async () => {
    const { gunSounds } = await import('./sound-sheet.js');
    const slots = [{ name: 'boomstick', weapon: { pellets: 8, reload: 2 } }, { name: 'tube', weapon: { fireClass: 'lob', reload: 3 } }];
    expect(gunSounds({}, slots)).toBeNull();
    const H = gunSounds({ sound: {} }, slots);
    expect(H.sfx.boomstick.shot).toEqual(sfxSound('shotgun shot').gestures);
    expect(H.sfx.tube.shot).toEqual(sfxSound('missile launch').gestures);
    expect(Object.keys(H.cues)).toEqual(expect.arrayContaining(['boomstick:shot', 'boomstick:reload', 'tube:hit', 'tube:draw']));
    // (the last gesture of a reload lands inside the gun's reload time)
    expect(Math.max(...H.sfx.boomstick.reload.map((g) => g.at ?? 0))).toBeLessThan(2);
    expect(gunSounds({ sound: { guns: { boomstick: { shot: 'magnum shot' } } } }, slots).sfx.boomstick.shot).toEqual(sfxSound('magnum shot').gestures);
    expect(() => readSound({ guns: { boomstick: { bang: 'punch' } } })).toThrow(/a gun's sounds/);
    expect(() => readSound({ guns: { boomstick: { shot: 'nope nope' } } })).toThrow(/not a sound on the shelf/);
  });

  it('a quick shooter on the sheet: the kit\'s guns carry their sounds and the level\'s audio their cues; off the sheet, the level it was', async () => {
    const { quickGuns, goalAudio } = await import('./quick.js');
    const Q = { goal: 'shoot' };
    expect(quickGuns({ quick: Q }, Q)).toBeNull();
    const guns = quickGuns({ quick: Q, sound: {} }, Q);
    expect(Object.keys(guns.sfx)).toEqual(['rifle']);
    // the level's audio carries the gun's cues in its book, and they resolve on the page
    const G = { quick: Q, sound: {} };
    const audio = goalAudio(Q, { sheet: sheetAudio(G), cues: guns.cues });
    const R = resolveWorldAudio(audio, { ref: 'lv', mechanics: ['hp-pool'] });
    expect(R.cues['rifle:shot']).toEqual(guns.sfx.rifle.shot);
    expect(() => new Function(audioChannelScript(R))).not.toThrow();
    // without the cues the sheet is the sheet it was
    expect(goalAudio(Q, { sheet: sheetAudio(G) })).toEqual({ sfx: sheetAudio(G) });
  });

  it('a made shooter level: each gun of the carried kit sounds as itself, its cues in the level\'s audio; with no `sound`, no gun carries one', async () => {
    const { runSteps } = await import('./index.js');
    const { quickWorld } = await import('./quick.js');
    const level = (W) => runSteps(W, { ref: 'gw' }).find((s) => s.key.startsWith('level-')).order.manifest;
    const quick = { goal: 'shoot', arms: ['shotgun', 'handgun'] };
    const pilotOf = (M) => (M.entities ?? []).find((e) => e.rule?.loadout);
    const plain = level(quickWorld({ id: 'qg', quick }));
    expect(pilotOf(plain).rule.loadout.every((s) => s.weapon.sfx === undefined)).toBe(true);
    const heard = level({ ...quickWorld({ id: 'qg', quick }), sound: {} });
    const kit = pilotOf(heard).rule.loadout;
    expect(kit.map((s) => s.name)).toEqual(['shotgun', 'handgun']);
    expect(kit[0].weapon.sfx.shot).toEqual(sfxSound('shotgun shot').gestures);
    expect(kit[1].weapon.sfx.shot).toEqual(sfxSound('pistol shot').gestures);
    expect(pilotOf(heard).weapon.sfx).toEqual(kit[0].weapon.sfx);
    expect(heard.audio.sfx.sheet.cues['shotgun:shot']).toEqual(kit[0].weapon.sfx.shot);
  });
});
