/**
 * WRITING A CARD (every set): the prompt names the SOUND, never the scene. The sound model reads a prompt aloud as
 * readily as it makes the sound ("an intruder spotted … over a radio" came back saying "No intruder spotted"), so a
 * card that is not `voice: true` names its sources and their character, with no message, no sayer (radio, announcer,
 * intercom, speaker), no outcome said as words (spotted, reached, complete) and no quoted words (generate.mjs refuses
 * them: SPEECH_WORDS). A stinger (being spotted, an objective done, a checkpoint) is `role: 'cue'` and is followed
 * closely. Then check-speech.mjs hears every take, and condition.mjs leaves a take that speaks out.
 *
 * The card sets by name: `loadCards('spike,batch2')` → every card of those sets in order, each card id once across
 * them all (a duplicate is an error: a card id names its takes' directory and its library entry).
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

export async function loadCards(names) {
  const sets = String(names || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!sets.length) throw new Error('cards: no card set named');
  const out = [], seen = new Map();
  for (const set of sets) {
    if (!/^[a-z0-9-]+$/.test(set)) throw new Error(`cards: bad card set '${set}'`);
    const { CARDS } = await import(path.join(HERE, `${set}.js`));
    for (const c of CARDS) {
      if (seen.has(c.id)) throw new Error(`cards: '${c.id}' is in both ${seen.get(c.id)} and ${set}`);
      seen.set(c.id, set);
      out.push({ ...c, set });
    }
  }
  return out;
}
