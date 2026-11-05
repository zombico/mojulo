/**
 * MANA-UI's IDIOMS — the screens games share, as compositions of the components (defs: data, never code). A game uses
 * one by name in its spec (`{ use: 'party-screen', props: { party: { bind: 'rpg.party' } } }`) and passes what it
 * reads; the idiom says what it emits through the effects its rows and inputs carry. A new idiom is a def here first,
 * a component only when no composition can draw it.
 *
 *   IDIOMS        name → { about, reads, emits, params, node }  (a def: readNode expands it)
 *   IDIOM_IDS
 *   withIdioms(spec)   → the spec with the idioms among its defs (its own defs win on a shared name)
 *
 * THE PARTY's shape (what `party` reads, one row a member; the bridge shapes the RPG kernel's partyOf / statsOf /
 * gearOf / treeOf into it): { id, name, cls, level, hp, hpMax, mp, mpMax, stats: { atk, def, mag, spd },
 *   gear: [{ slot, name }], skills: [{ name, mp, state }] }
 */
const stat = (label, field) => ({ use: 'stat', props: { label, value: { pick: `members.${field}` } } });

export const IDIOMS = Object.freeze({
  'pause-menu': {
    about: 'the pause: a column of choices over the held game; each row does its own `then` (resume closes, the rest open or emit)',
    reads: 'items: [{ label, then: effect(s), disabled? }]',
    emits: 'each row\'s then (back resumes: the stack closes)',
    params: ['title', 'items'],
    node: {
      use: 'screen', props: { title: { param: 'title' }, layer: 'modal', place: 'center' },
      children: [{ use: 'window', children: [{ use: 'list', id: 'pause', props: { rows: { param: 'items' } }, on: { accept: { item: 'then' } } }] }],
    },
  },
  'options-menu': {
    about: 'options: settings on the host, each a toggle or a cycler bound to the var it sets (the store keeps them)',
    reads: 'the settings vars its rows bind',
    emits: '{ set: <var>, to } on each change',
    params: ['title', 'sound', 'music', 'difficulty', 'difficulties'],
    node: {
      use: 'screen', props: { title: { param: 'title' }, layer: 'modal', place: 'center' },
      children: [{ use: 'window', children: [{ use: 'stack', props: { gap: 'tight' }, children: [
        { use: 'toggle', props: { label: 'Sound', value: { param: 'sound' } } },
        { use: 'toggle', props: { label: 'Music', value: { param: 'music' } } },
        { use: 'cycler', props: { label: 'Difficulty', options: { param: 'difficulties' }, value: { param: 'difficulty' } } },
        { use: 'button', props: { label: 'Back' }, on: { accept: { back: true } } },
      ] }] }],
    },
  },
  'party-screen': {
    about: 'the RPG party: the members beside the one in focus, its status, gear and skills in tabs ([ and ] turn them)',
    reads: 'party: the members (the party shape above)',
    emits: 'accept on a member: its `then`, when the bridge gives it one (open an equip screen, a class switch)',
    params: ['title', 'party'],
    node: {
      use: 'screen', props: { title: { param: 'title' }, layer: 'modal', place: 'full' },
      children: [{ use: 'split', children: [
        { use: 'window', props: { title: 'Party' }, children: [{
          use: 'list', id: 'members', props: { rows: { param: 'party' }, row: { use: 'stack', props: { gap: 'tight' }, children: [
            { use: 'stack', props: { dir: 'row', align: 'apart' }, children: [{ use: 'text', props: { value: { item: 'name' }, role: 'heading' } }, { use: 'text', props: { value: { format: 'Lv {level}' }, role: 'numeral' } }] },
            { use: 'bar', props: { label: 'HP', value: { item: 'hp' }, max: { item: 'hpMax' }, variant: 'hp' } },
            { use: 'bar', props: { label: 'MP', value: { item: 'mp' }, max: { item: 'mpMax' }, variant: 'mp' } },
          ] } },
          on: { accept: { item: 'then' } },
        }] },
        { use: 'window', children: [{ use: 'tabs', children: [
          { use: 'tab', props: { label: 'Status' }, children: [{ use: 'stack', props: { gap: 'tight' }, children: [
            { use: 'text', props: { value: { pick: 'members.name' }, role: 'title' } },
            { use: 'text', props: { value: { pick: 'members.cls' }, role: 'label' } },
            stat('Attack', 'stats.atk'), stat('Defence', 'stats.def'), stat('Magic', 'stats.mag'), stat('Speed', 'stats.spd'),
          ] }] },
          { use: 'tab', props: { label: 'Equip' }, children: [{ use: 'list', id: 'gear', props: { rows: { pick: 'members.gear' }, empty: 'Nothing worn', row: {
            use: 'stack', props: { dir: 'row', align: 'apart' }, children: [{ use: 'text', props: { value: { item: 'slot' }, role: 'label' } }, { use: 'text', props: { value: { item: 'name' } } }],
          } } }] },
          { use: 'tab', props: { label: 'Skills' }, children: [{ use: 'list', id: 'skills', props: { rows: { pick: 'members.skills' }, empty: 'No skills yet', row: {
            use: 'stack', props: { dir: 'row', align: 'apart' }, children: [{ use: 'text', props: { value: { item: 'name' } } }, { use: 'text', props: { value: { format: '{mp} MP' }, role: 'numeral' } }],
          } } }] },
        ] }] },
      ] }],
    },
  },
});
export const IDIOM_IDS = Object.keys(IDIOMS);

/** The spec with the idioms among its defs; the spec's own defs win on a shared name. */
export function withIdioms(spec) {
  const defs = {};
  for (const [k, v] of Object.entries(IDIOMS)) defs[k] = { params: v.params, node: v.node };
  return { ...spec, defs: { ...defs, ...(spec && spec.defs) } };
}
