/**
 * level-words — the words a level puts in front of its player, found where the World page reads them: in the resolved
 * payload (worlds/world-scene.js resolveWorldScene), after the mechanics, the play block and the signage have lowered
 * into it. Collecting and localizing walk the SAME places (eachLevelWord), so every word a brief lists is a word the
 * page swaps, and nothing else is touched: ids, vars, refs, icons and code stay as they are.
 *
 * The places are named, not guessed: a key means words in one channel and an id in another (`who` is the speaker's
 * name in a talk menu and the actor's id in a scene beat), so each channel says which of its fields a player reads,
 * and what each one is (its ROLE): a localizer writes a HUD label, a line of dialogue and a menu choice differently.
 *
 *   eachLevelWord(payload, visit)        visit(holder, key, { role, at, speaker?, keep? }) for every word field present
 *                                          (keep: a word the shell localizes as it shows it; the payload keeps it)
 *   payloadWords(payload)                → [{ text, role, at, speaker? }] in page order (repeats kept: one per place)
 *   localizePayload(payload, strings)    → a payload whose words are swapped by `strings` ({ '<source>': '<target>' });
 *                                          a word with no entry stays; the input is not touched
 *   gatherLevelWords(manifest, getSketch) → { <level ref>: payloadWords } every level of a game, resolved as the World
 *                                          route resolves it (async; the world pipeline loads only when called)
 *
 * Words the page composes in code (the quest toast's "new quest", the skip hint) are not payload words: they are the
 * page's chrome, localized with the shell (later). Words that are derived while lowering ("Not enough gold", "[Hero:
 * line 3]") ARE payload words, whole sentences, so they localize as phrases.
 */

import { PAGE_WORDS, LEGEND_WORDS } from '../scene/channels/page-words.js';

const each = (a, f) => { if (Array.isArray(a)) a.forEach(f); };
const isStr = (v) => typeof v === 'string' && v.trim().length > 0;

// each channel's word fields, and what each one is
function walkEvents(ev, visit, at) {
  each(ev.hud, (w, i) => {
    visit(w, 'label', { role: 'hud-label', at: `${at}.hud[${i}]` });
    visit(w, 'text', { role: 'hud-text', at: `${at}.hud[${i}]` });
  });
  each(ev.scenes, (sc, i) => each(sc.beats, (b, k) => {
    const where = `${at}.scenes[${i}].beats[${k}]`;
    const line = (l, w) => { visit(l, 'name', { role: 'speaker', at: w }); visit(l, 'text', { role: 'line', at: w, speaker: l.name }); };
    if (b.kind === 'line') line(b, where);
    if (b.kind === 'choose') {
      if (b.ask) line(b.ask, `${where}.ask`);
      each(b.options, (o, n) => visit(o, 'text', { role: 'choice', at: `${where}.options[${n}]` }));
    }
  }));
  each(ev.quests, (q, i) => {
    visit(q, 'name', { role: 'quest', at: `${at}.quests[${i}]` });
    each(q.steps, (s, k) => visit(s, 'text', { role: 'quest-step', at: `${at}.quests[${i}].steps[${k}]` }));
  });
  each(ev.menus, (m, i) => {
    const where = `${at}.menus[${i}]`;
    visit(m, 'title', { role: 'menu-title', at: where });
    visit(m, 'who', { role: 'speaker', at: where });
    visit(m, 'ask', { role: 'line', at: where });
    each(m.lines, (l, k) => {
      if (typeof l === 'string') visit(m.lines, k, { role: 'line', at: `${where}.lines[${k}]`, speaker: m.who });
      else if (l) { visit(l, 'who', { role: 'speaker', at: `${where}.lines[${k}]` }); visit(l, 'say', { role: 'line', at: `${where}.lines[${k}]`, speaker: l.who }); }
    });
    each(m.picks, (_, k) => visit(m.picks, k, { role: 'choice', at: `${where}.picks[${k}]` }));
    each(m.pages, (_, k) => visit(m.pages, k, { role: 'page', at: `${where}.pages[${k}]` }));
    each(m.tabs, (t, k) => visit(t, 'label', { role: 'menu-tab', at: `${where}.tabs[${k}]` }));
    each(m.rows, (r, k) => {
      visit(r, 'verb', { role: 'verb', at: `${where}.rows[${k}]` });   // the page only shows it (the lowering acted on it)
      visit(r, 'name', { role: 'item-name', at: `${where}.rows[${k}]` });
      visit(r, 'about', { role: 'item-about', at: `${where}.rows[${k}]` });
      visit(r, 'label', { role: 'hud-label', at: `${where}.rows[${k}]` });
    });
  });
  // a use-zone's prompt: the word beside the interact key
  each(ev.sources, (s, i) => visit(s, 'prompt', { role: 'prompt', at: `${at}.sources[${i}]` }));
}

/** Visit every word field the page reads, where it is. `visit` may assign holder[key]. */
export function eachLevelWord(payload, visit) {
  if (!payload || typeof payload !== 'object') return;
  const v = (holder, key, info) => { if (holder && isStr(holder[key])) visit(holder, key, info); };
  v(payload, 'title', { role: 'level-title', at: 'title' });
  if (payload.events && typeof payload.events === 'object') walkEvents(payload.events, v, 'events');
  each(payload.signs, (s, i) => {
    v(s, 'text', { role: 'sign', at: `signs[${i}]` });
    each(s.body, (_, k) => v(s.body, k, { role: 'sign', at: `signs[${i}].body[${k}]` }));
  });
  each(payload.tutorial?.steps, (s, i) => v(s, 'prompt', { role: 'prompt', at: `tutorial.steps[${i}]` }));
  // a number the level keeps (game.keep: a score, a time), shown by the shell beside its best: the shell localizes it
  // as it shows it, the label itself stays (the best is remembered by it), so it is never swapped here (`keep`)
  each(payload.game?.keep, (k, i) => v(k, 'label', { role: 'kept', at: `game.keep[${i}]`, keep: true }));
}

// the channels a page carries, by what its payload holds: their own words are the level's words too
// (scene/channels/page-words.js), and only theirs: a level with no shop is never asked for "Sold out."
const CHANNELS = {
  quest: (ev) => Array.isArray(ev.quests) && ev.quests.length > 0,
  scene: (ev) => Array.isArray(ev.scenes) && ev.scenes.length > 0,
  reach: (ev) => Array.isArray(ev.sources) && ev.sources.some((s) => s && s.type === 'zone' && s.use),
  menu: (ev) => Array.isArray(ev.menus) && ev.menus.length > 0,
  minigame: (ev) => !!(ev.minigames && typeof ev.minigames === 'object'),
};

/** The level's words, one entry a place, in page order; then the words its page's own code writes, by channel. */
export function payloadWords(payload) {
  const out = [];
  eachLevelWord(payload, (h, k, { role, at, speaker }) => out.push({ text: h[k], role, at, ...(isStr(speaker) ? { speaker } : {}) }));
  const ev = payload && payload.events && typeof payload.events === 'object' ? payload.events : null;
  if (ev) for (const [ch, has] of Object.entries(CHANNELS)) if (has(ev)) for (const text of PAGE_WORDS[ch]) out.push({ text, role: 'page', at: `page: ${ch}` });
  // every page answers the shell's pause with a controls legend
  if (payload) for (const text of LEGEND_WORDS) out.push({ text, role: 'controls', at: 'page: controls' });
  return out;
}

/** The payload with its words swapped for `strings`' (exact source text → target). Only the subtrees that carry words
 * are copied; the faces and the rest are shared, untouched. No entry, or an empty one: the source word stays. */
export function localizePayload(payload, strings) {
  if (!payload || !strings || !Object.keys(strings).length) return payload;
  const out = { ...payload };
  for (const k of ['events', 'signs', 'tutorial']) if (out[k] != null) out[k] = structuredClone(out[k]);
  eachLevelWord(out, (h, k, { keep }) => { const t = strings[h[k]]; if (!keep && typeof t === 'string' && t.length) h[k] = t; });
  return out;
}

/** Every level of a game, resolved as the World route resolves it, and its words: what game-languages.js tables. A level
 * that does not resolve is named, never fatal (its words are simply not in the table yet). */
export async function gatherLevelWords(manifest, getSketch) {
  const { resolveWorldScene } = await import('../worlds/world-scene.js');
  const words = {}, failed = {};
  for (const lv of manifest.levels ?? []) {
    const sketch = getSketch(lv.ref);
    if (!sketch || !sketch.manifest) { failed[lv.ref] = 'no sketch with that ref'; continue; }
    try { words[lv.ref] = payloadWords((await resolveWorldScene(sketch, { live: true })).payload); }
    catch (err) { failed[lv.ref] = err.message; }
  }
  return { words, failed };
}
