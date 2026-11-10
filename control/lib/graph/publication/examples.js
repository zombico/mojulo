/**
 * Example publications (publication.js), read by the tests and `scripts/publication.mjs`: a notebook written by
 * hand as a recipe. The lore's own (a bestiary, a grimoire) are made from lorecube parts by from-lore.js.
 */
import { stillLife } from './props.js';

/** A draughtsman's notebook: studies with their construction left in, and notes in the margin. */
export const notebook = {
  kind: 'notebook', title: 'Notebook the Third', subtitle: 'Of solids, of light, and of the eye that sees them', by: 'kept at the bench',
  chapters: [
    { id: 'of-the-eye', title: 'Of the eye', blocks: [
      { p: 'Every edge that runs away from the eye runs toward a point on the line of the horizon, and all edges that run the same way share the one point. Stand a box before you a little turned and it has two such points, one to either hand.', drop: true },
      { plate: { ...stillLife(['tome']), forms: [{ id: 'block', tint: '#c9b48a', terms: [{ op: 'add', shape: { kind: 'box', center: [0, 0, 0.16], size: [0.5, 0.34, 0.32] } }] }], station: { turn: 34, eye: 0.62, distance: 1.9, lens: 44, look: [0, 0, 0.14] }, construction: true, frame: 'full', width: 520, height: 300 }, caption: 'A block, and where its edges go.' },
      { margin: 'The nearer the eye is brought, the nearer the two points draw together, and the more the block seems to lean away.' },
      { p: 'The eye is kept level, and so what stands upright in the world stands upright on the page.' },
    ] },
    { id: 'of-light', title: 'Of light', blocks: [
      { p: 'A round thing under one light shows five things to whoever looks: the light itself, the half tone where it turns, the dark just past the turning, the lesser light the table throws back, and the shadow it lays on the ground.', drop: true },
      { plate: { ...stillLife(['orb', 'chalice']), finish: 'wash' }, caption: 'A sphere and a cup under one lamp.' },
      { margin: 'The darkest place is not the far edge but beside the turning: the table lights the far edge from below.' },
      { table: { title: 'What is seen, from light to dark', head: 'no.', rows: [['1', 'the light'], ['2', 'the half tone'], ['3', 'the dark beside the turning'], ['4', 'the light thrown back'], ['5', 'the shadow cast']] } },
    ] },
    { id: 'of-the-line', title: 'Of the line', blocks: [
      { p: 'Where a hatch is laid it should go round the thing as a thread would be wound upon it, and never across it as rain falls. Lines so laid tell the shape even where no outline is drawn.', drop: true },
      { plate: { ...stillLife(['skull', 'candle']), finish: 'engraving' }, caption: 'Hatching wound upon the form.' },
      { note: 'Press the line on the side away from the lamp, and let it thin to nothing on the side toward it.', label: 'To remember' },
      { lines: 4 },
    ] },
  ],
};

/** A field manual: how a thing is done, in steps. */
export const fieldManual = {
  kind: 'manual', title: 'The Still-Room Handbook', subtitle: 'the care of the vessels, in order',
  chapters: [{ id: 'the-vessels', title: 'The vessels', blocks: [
    { p: 'Three vessels are kept on the bench and no more. Each is named here, with what it is for.', drop: true },
    { plate: { ...stillLife(['alembic', 'vial', 'chalice']) }, caption: 'The still, the vial and the cup.', span: true },
    { entry: { n: 1, title: 'The still', blocks: [{ p: 'Warm it slowly. A still brought up quickly cracks at the neck.' }, { facts: [['Holds', 'two measures'], ['Flame', 'one taper']] }] } },
    { entry: { n: 2, title: 'The vial', blocks: [{ p: 'Stopper it while it is warm, never after it has cooled.' }] } },
    { entry: { n: 3, title: 'The cup', blocks: [{ p: 'For what is drunk the same day. Nothing keeps in it.' }] } },
  ] }],
};

/** A comic: a legend told in panels, a page a block. */
export const comic = {
  kind: 'comic', title: 'The Sword in the Still-Room', subtitle: 'No. 1', by: 'a legend of the Marches', cover: { props: ['blade', 'shield'] },
  chapters: [{ id: 'the-finding', blocks: [
    { layout: 'split', panels: [
      { plate: stillLife(['alembic', 'candle', 'tome']), caption: 'The still-room had been shut for a hundred winters.' },
      { plate: stillLife(['candle']), says: [{ who: 'Ilse', text: 'Someone lit this.' }] },
      { plate: stillLife(['skull']), caption: 'She was not alone.' },
    ] },
    { layout: 'halves', panels: [
      { plate: stillLife(['blade', 'shield']), caption: 'Behind the bench stood what the wardens had hidden.', says: [{ who: 'Ilse', text: 'So it is true.' }] },
      { caption: 'To be continued.' },
    ] },
  ] }],
};

export const PUBLICATION_EXAMPLES = Object.freeze({ notebook, fieldManual, comic });
