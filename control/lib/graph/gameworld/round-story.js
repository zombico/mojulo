/**
 * THE ROUND'S STORY — the starter story a party RPG's round is composed with, from its brief's motivation (gmn.js): the
 * OPENING in the town (the game's opening slot: what the hero sets out to do), a line as the CORE is entered (its level
 * begun), and the ENDING in the core (the game's ending slot, after the round's first full clear). Each a story moment
 * (story.js), written out in the world's `story` for the person to change: its lines, where and when it plays.
 *
 *   ROUND_LINES    motivation → { opening: [lines], core: [lines], ending: [lines] }   ({core} the core's name, {Core}
 *                  capitalised); a motivation without a row speaks as saving the world does
 *   roundStory({ motivation, hub, core, coreName }) → [moment]
 *
 * A new motivation's lines are a row. Pure.
 */
export const ROUND_LINES = Object.freeze({
  'save-the-princess': { opening: ['They took the princess to {core}.', 'Nobody who went after her came back. I will.'], core: ['{Core}. She is somewhere past these walls.'], ending: ['It is over. She is free.', 'And it was never only her in that tower.'] },
  'save-the-world': { opening: ['Something stirs in {core}, and the land sickens with it.', 'If no one stops it, nothing will be left to save.'], core: ['{Core}. Whatever is doing this is here.'], ending: ['It is done. The land still stands.', 'Changed by what it cost, but standing.'] },
  'reunite-with-family': { opening: ['My family was taken beyond {core}.', 'I am bringing them home.'], core: ['{Core}. They are close now. I can feel it.'], ending: ['We are together again.', 'Every seat at the table filled.'] },
  'solve-the-mystery': { opening: ['Every trail leads to {core}.', 'Whatever happened, the answer is there.'], core: ['{Core}. The truth is behind these doors.'], ending: ['So that is the truth of it.', 'Now everyone will know, and nothing will be the same.'] },
  'find-the-treasure': { opening: ['The map ends at {core}.', 'Whatever is buried there, we find it first.'], core: ['{Core}. The treasure has to be here.'], ending: ['The chest, at last.', 'Not quite what any of us expected.'] },
  'stop-the-virus': { opening: ['It started near {core}, and it is spreading.', 'We find the source and we end it.'], core: ['{Core}. The source is here.'], ending: ['It is contained.', 'Someone paid for the cure. We will not forget it.'] },
});

const line = (say) => ({ line: { who: 'hero', say } });

/** The round's starter story: its opening in the town, a line as the core begins, its ending in the core. */
export function roundStory({ motivation, hub, core, coreName }) {
  const L = ROUND_LINES[motivation] ?? ROUND_LINES['save-the-world'];
  const name = coreName ?? 'the core', Name = name.charAt(0).toUpperCase() + name.slice(1);
  const say = (lines) => lines.map((t) => line(t.split('{core}').join(name).split('{Core}').join(Name)));
  return [
    { id: 'round-opening', where: { level: hub }, when: { slot: 'opening' }, beats: say(L.opening) },
    { id: 'round-core', where: { level: core }, when: { start: true }, once: true, beats: say(L.core) },
    { id: 'round-ending', where: { level: core }, when: { slot: 'ending' }, beats: say(L.ending) },
  ];
}
