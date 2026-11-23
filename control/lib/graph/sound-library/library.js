/**
 * sound-library — the installed RECORDED sound library, read where the operator installed it: `$MOJULO_SOUNDS_DIR`,
 * else `<$MOJULO_HOME or ~/.mojulo>/sounds`. The library is an index (`library.json`: cards, each a list of variants
 * named by their bytes' hash) and its masters (`masters/<id>.wav`). Nothing here ships audio and nothing here fetches:
 * a machine without the library reads `null`, and every sound that would have played a recording plays the
 * synthesized voice it stands in for.
 *
 *   `libraryDir()`              where the library is looked for
 *   `readLibrary()`             the index, or null when none is installed (read once per directory)
 *   `sampleSlice(cards)`        what an engine's `loadSamples` takes for those card names: { cards: { <card>: [id…] },
 *                               bytes: { <id>: Buffer } }, only the cards the library holds; null when it holds none
 *                               (a name no card has but an INSTRUMENT's, a card's `instrument`: every pitched take that
 *                               plays it, with `roots` { <id>: MIDI }, `loops` { <id>: [start, end] s } and a velocity
 *                               layer's `vels` { <id>: 0…1 } beside; its key-offs under `<name>~release`, with
 *                               `keyAt` { <id>: MIDI } the register each is for and `keyRoot` the pitch one carries)
 *   `hasInstrument(name)`       whether the library holds an instrument's pitched takes
 *   `sampleSliceBase64(cards)`  the same with the bytes as base64, for a page to inline: each variant's MP3 where the
 *                               library carries one (`masters/<id>.mp3`, a tenth of the WAV), else its WAV
 *   `recordedEngine(engine)`    an engine's steady loops (cards whose `engine` is it, each with the `rpm` it was asked
 *                               at), sorted by rpm: [{ card, rpm }], only cards whose masters are here; [] for none
 *   `recordedLoop(card)`        a loop card held here (its masters present), or null
 *   `hasFlavor(flavor)`         whether the library holds a card of that FLAVOR (a game's own sounds: a rail's, `flavor`
 *                               on the card), whose recordings voice its rows for a game of that flavor only
 *   `recordedUi(cue, { set })`  the card that records a menu cue (its `ui`) in one of mana-ui's sound sets (its
 *                               `uiSets`: the set a page's theme plays, beats/ui-sounds.js), as recordedFor answers;
 *                               null for none
 *   `hasUi(set)`                whether the library records any menu cue of that set
 *   `recordingsTagged(tag)`     the cards whose `tags` name it ('success', 'chime', 'menu'…), sorted: what to reuse
 *
 * A card's REUSE (its metadata): `shelf` the row it was made for, `also` more rows it voices (the same takes, the same
 * flavor), `ui` the menu cues it voices and `uiSets` the mana-ui sound sets it voices them in, `tags` what it is, for
 * finding it again.
 *   `recordedFor(shelfId, { flavor })`      the card that records a shelf row (its `shelf`), as { card, dur: the longest variant's
 *                               seconds, variants }, or null: no library, no card for the row, or none of its masters here
 *
 * Reads files; timeless (no clock: a variant is named by its content).
 */
import { existsSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ID = /^[0-9a-f]{16}$/;

export function libraryDir() {
  if (process.env.MOJULO_SOUNDS_DIR) return process.env.MOJULO_SOUNDS_DIR;
  return path.join(process.env.MOJULO_HOME || path.join(os.homedir(), '.mojulo'), 'sounds');
}

const read = new Map();
export function readLibrary() {
  const dir = libraryDir();
  if (read.has(dir)) return read.get(dir);
  const file = path.join(dir, 'library.json');
  let lib = null;
  if (existsSync(file)) {
    try { lib = JSON.parse(readFileSync(file, 'utf8')); } catch { lib = null; }
    if (!lib || typeof lib.cards !== 'object') lib = null;
  }
  read.set(dir, lib);
  return lib;
}

/** for tests: forget what was read */
export function forgetLibrary() { read.clear(); recorded.clear(); }

export function hasFlavor(flavor) {
  const lib = flavor ? readLibrary() : null;
  return !!lib && Object.values(lib.cards).some((c) => c && c.flavor === flavor);
}

// (a flavored ask, `only`: that flavor's card or none; an ask with no flavor never hears a flavored card)
const recorded = new Map();
export function recordedFor(shelfId, { flavor = null } = {}) {
  const dir = libraryDir(), key = `${dir}\n${shelfId}\n${flavor || ''}`;
  if (!recorded.has(key)) recorded.set(key, findRecorded(dir, shelfId, flavor));
  return recorded.get(key);
}
function findRecorded(dir, shelfId, flavor) {
  const lib = readLibrary();
  if (!lib) return null;
  for (const name of Object.keys(lib.cards).sort()) {
    const c = lib.cards[name];
    if (!c || (c.shelf !== shelfId && !(c.also || []).includes(shelfId)) || c.role === 'bed' || c.role === 'loop' || (c.flavor || null) !== (flavor || null)) continue;
    const held = (c.variants || []).filter((v) => ID.test(v.id) && existsSync(path.join(dir, 'masters', `${v.id}.wav`)));
    if (!held.length) continue;
    return { card: name, dur: Math.max(...held.map((v) => Number(v.seconds) || 0)), variants: held.length };
  }
  return null;
}

export function recordedUi(cue, { set = null } = {}) {
  const lib = set ? readLibrary() : null;
  if (!lib) return null;
  const dir = libraryDir();
  for (const name of Object.keys(lib.cards).sort()) {
    const c = lib.cards[name];
    if (!c || !(c.ui || []).includes(cue) || !(c.uiSets || []).includes(set)) continue;
    const vs = (c.variants || []).filter((v) => ID.test(v.id) && existsSync(path.join(dir, 'masters', `${v.id}.wav`)));
    if (vs.length) return { card: name, dur: Math.max(...vs.map((v) => Number(v.seconds) || 0)), variants: vs.length };
  }
  return null;
}
export function hasUi(set) {
  const lib = set ? readLibrary() : null;
  return !!lib && Object.values(lib.cards).some((c) => c && (c.ui || []).length && (c.uiSets || []).includes(set));
}
export function recordingsTagged(tag) {
  const lib = readLibrary();
  return lib ? Object.keys(lib.cards).filter((k) => (lib.cards[k].tags || []).includes(tag)).sort() : [];
}

const held = (dir, c) => (c.variants || []).filter((v) => ID.test(v.id) && existsSync(path.join(dir, 'masters', `${v.id}.wav`)));

export function recordedEngine(engine) {
  const lib = readLibrary();
  if (!lib) return [];
  const dir = libraryDir();
  return Object.entries(lib.cards).filter(([, c]) => c && c.engine === engine && Number(c.rpm) > 0 && held(dir, c).length)
    .map(([card, c]) => ({ card, rpm: Number(c.rpm) })).sort((a, b) => a.rpm - b.rpm || (a.card < b.card ? -1 : 1));
}

export function recordedLoop(card) {
  const lib = readLibrary(), c = lib && lib.cards[card];
  return c && c.loop && held(libraryDir(), c).length ? card : null;
}

export function sampleSlice(cards, { compact = false } = {}) {
  const lib = readLibrary();
  if (!lib) return null;
  const dir = libraryDir(), out = { cards: {}, bytes: {} };
  const take = (v) => {
    if (!ID.test(v.id)) return false;
    const file = path.join(dir, 'masters', `${v.id}.wav`), mp3 = path.join(dir, 'masters', `${v.id}.mp3`);
    if (!existsSync(file)) return false;
    out.bytes[v.id] = readFileSync(compact && existsSync(mp3) ? mp3 : file);
    // (a pitched take's measured root and its held loop: an instrument is played from them)
    if (Number.isFinite(v.root)) (out.roots ??= {})[v.id] = v.root;
    if (Array.isArray(v.loopAt)) (out.loops ??= {})[v.id] = v.loopAt.slice();
    if (Number.isFinite(v.vel)) (out.vels ??= {})[v.id] = v.vel;
    return true;
  };
  for (const name of [...new Set(cards || [])].sort()) {
    const card = lib.cards[name];
    const ids = [];
    if (card) {
      for (const v of card.variants || []) {
        if (!take(v)) continue;
        ids.push(v.id);
        // (a loop is held on its first take, recorded-held.js: its others are never heard, so never carried)
        if (card.loop) break;
      }
    } else {
      // (an INSTRUMENT by its name: every take of every card that plays it, its notes, each with its root; and its
      // key-offs, the release sounds, under `<name>~release`, each with the register it is for, `keyAt`)
      const offs = [];
      for (const k of Object.keys(lib.cards).sort()) if (lib.cards[k]?.instrument === name) for (const v of lib.cards[k].variants || []) {
        if (lib.cards[k].keyOff) { if (Number.isFinite(v.keyAt) && take(v)) { offs.push(v.id); (out.keyAt ??= {})[v.id] = v.keyAt; if (Number.isFinite(v.keyRoot)) (out.keyRoot ??= {})[v.id] = v.keyRoot; } }
        else if (Number.isFinite(v.root) && take(v)) ids.push(v.id);
      }
      if (ids.length && offs.length) out.cards[`${name}~release`] = offs;
    }
    if (ids.length) out.cards[name] = ids;
  }
  return Object.keys(out.cards).length ? out : null;
}

export function sampleSliceBase64(cards) {
  const s = sampleSlice(cards, { compact: true });
  if (!s) return null;
  return { cards: s.cards, bytes: Object.fromEntries(Object.entries(s.bytes).map(([id, b]) => [id, b.toString('base64')])), ...(s.roots ? { roots: s.roots } : {}), ...(s.loops ? { loops: s.loops } : {}), ...(s.vels ? { vels: s.vels } : {}), ...(s.keyAt ? { keyAt: s.keyAt } : {}), ...(s.keyRoot ? { keyRoot: s.keyRoot } : {}) };
}

export function hasInstrument(name) {
  const lib = name ? readLibrary() : null;
  return !!lib && Object.values(lib.cards).some((c) => c && c.instrument === name && (c.variants || []).some((v) => Number.isFinite(v.root)));
}
