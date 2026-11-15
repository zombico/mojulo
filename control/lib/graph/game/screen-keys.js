/**
 * SCREEN KEYS — a level made for a screen (game/screen.js) never asks for a key a thumb cannot press. The virtual pad
 * (scene/channels/controllable/touch.js) already stands for the keys that move, look, jump, fire and use; this finds the
 * keys the level listens for that the pad has no control for, and gives each a button in the level's HUD, drawn only on
 * a touch screen. Pressed, a button is that key pressed: the same keydown the channel that listens for it hears, so no
 * channel learns about touch.
 *
 *   SCREEN_KEYS            the keys a play channel listens for: [{ of, code, key, label }] (of: the events key that
 *                          turns the channel on: quests, library, rpg)
 *   screenKeyRows(events)  → the HUD rows for a level's keys: [{ key, code, label, touch: true }], in the order found;
 *                          a key the level's HUD already has a button for is left to it
 *   withScreenKeys(events) → the events with those rows after its own HUD rows (the same object when there are none)
 *
 * Pure. A level that listens for no such key gains nothing.
 */
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const isStr = (v) => typeof v === 'string' && v.length > 0;

/** The keys a play channel listens for, each with the channel it belongs to and the word its button says. */
export const SCREEN_KEYS = Object.freeze([
  Object.freeze({ of: 'quests', code: 'KeyJ', key: 'j', label: 'journal' }),    // scene/channels/quest-channel.js
  Object.freeze({ of: 'library', code: 'KeyL', key: 'l', label: 'library' }),   // scene/channels/library-channel.js
  Object.freeze({ of: 'rpg', code: 'KeyP', key: 'p', label: 'party' }),         // scene/channels/rpg-channel.js
]);
const on = (v) => (Array.isArray(v) ? v.length > 0 : isObj(v));
// a key as a keyboard says it (KeyboardEvent.key) → its code where one letter or digit names it
const codeOf = (key) => (/^[a-z]$/i.test(key) ? `Key${key.toUpperCase()}` : /^[0-9]$/.test(key) ? `Digit${key}` : key === ' ' ? 'Space' : key);

/** The HUD rows for the keys a level listens for that the virtual pad has no control for. */
export function screenKeyRows(events) {
  if (!isObj(events)) return [];
  const rows = [], seen = new Set((Array.isArray(events.hud) ? events.hud : []).filter((r) => isObj(r) && isStr(r.key)).map((r) => r.key.toLowerCase()));
  const add = (key, code, label) => { const k = key.toLowerCase(); if (seen.has(k)) return; seen.add(k); rows.push({ key, code, label, touch: true }); };
  // the level's own keys (events.inputs: a key that raises an event), each said by its label, else the event it raises
  for (const inp of Array.isArray(events.inputs) ? events.inputs : []) {
    if (!isObj(inp) || inp.on !== 'key' || !isStr(inp.key) || !isObj(inp.emit)) continue;
    add(inp.key, codeOf(inp.key), isStr(inp.label) ? inp.label : isStr(inp.emit.type) ? inp.emit.type : inp.key);
  }
  // the play channels' keys: the journal, the library, the party menu
  for (const k of SCREEN_KEYS) if (on(events[k.of])) add(k.key, k.code, k.label);
  return rows;
}

/** The events with a button for each such key after its own HUD rows; the same object when it asks for none. */
export function withScreenKeys(events) {
  const rows = screenKeyRows(events);
  return rows.length ? { ...events, hud: [...(Array.isArray(events.hud) ? events.hud : []), ...rows] } : events;
}
