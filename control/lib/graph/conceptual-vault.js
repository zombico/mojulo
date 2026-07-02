/**
 * conceptual-vault — an action world with NO physics at all, to make conceptual triggers tangible
 * (event-bus.plan.md "Conceptual triggers"). Three keys float over a vault; grab all three (keys
 * 1/2/3) and an aggregate WATCH unlocks the gate, which kicks a timed sequence that reveals the
 * treasure. Every trigger here is conceptual — a predicate over entity state, not a collision.
 *
 *   input (key)      → grab-key event
 *   reaction         → toggle the grabbed key (it vanishes)
 *   watch (all off)  → 'unlocked' (the gate edge) → reaction opens the gate
 *   sequence (timer) → after a beat, reveal the treasure
 *
 * Pure builder; the node test and the /world generator share it. `kind:'controllable'` hosts the
 * bare stage (no physics channel is emitted — this world never needs one).
 */

export function buildVault() {
  // visible (on:true) vs hidden (on:false); __syncBus maps .on → mesh visibility.
  const entities = [
    { id: 'key-1', on: true, color: '#ffcc44', radius: 0.3, position: [-2, 0, 1] },
    { id: 'key-2', on: true, color: '#ffcc44', radius: 0.3, position: [0, 0, 1] },
    { id: 'key-3', on: true, color: '#ffcc44', radius: 0.3, position: [2, 0, 1] },
    { id: 'gate', on: true, color: '#8899aa', radius: 0.9, position: [0, 2.5, 1] },   // closed = visible
    { id: 'treasure', on: false, color: '#ffd700', radius: 0.6, position: [0, 2.5, 1] }, // hidden behind the gate
  ];

  const events = {
    entities,
    reactions: [
      { on: 'grab-key', do: 'toggle', target: 'event.key' },   // the grabbed key vanishes
      { on: 'unlocked', do: 'toggle', target: 'gate' },         // the conceptual edge opens the gate
    ],
    // the trigger: every key grabbed (all key-* hidden). Aggregate predicate, robust to re-grabs.
    watches: [
      { type: 'unlocked', when: { all: 'key-*', field: 'on', eq: false } },
    ],
    // a conceptual trigger starting a timed sequence — reveal the treasure a beat after unlocking.
    sequences: [
      { id: 'reveal', trigger: { on: 'unlocked' }, steps: [{ await: { timer: 0.8 } }, { do: 'toggle', target: 'treasure' }] },
    ],
    // INPUT as a source: number keys grab the matching key entity.
    inputs: [
      { on: 'key', key: '1', emit: { type: 'grab-key', key: 'key-1' } },
      { on: 'key', key: '2', emit: { type: 'grab-key', key: 'key-2' } },
      { on: 'key', key: '3', emit: { type: 'grab-key', key: 'key-3' } },
    ],
  };

  const faces = [{ corners: [[-4, -3, 0], [4, -3, 0], [4, 4, 0], [-4, 4, 0]], fill: '#23262e' }];
  return { kind: 'controllable', events, faces };
}
