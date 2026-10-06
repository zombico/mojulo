/**
 * Greek dress, the Archaic into the Hellenistic (Lindos' record; the polis shares it, Pompeii draws it for the years
 * before its Roman record). Kind `dress` (../record.js, ../dress.js). The chlamys (a short cloak) and the petasos (a
 * hat) wait for those garments.
 */
import { DS } from './dress-sources.js';

const dress = (id, name, wearer, cut, attested, looks, confidence, sources, notes, o = {}) => ({ id, name, kind: 'dress', wearer, cut, attested, looks, confidence, sources, notes, ...o });

export const GREEK_DRESS = [
  dress('gr-chiton-long', 'Long chiton (Archaic)', 'man', 'ankle', { from: -800, to: -481, approx: true },
    [{ shirt: '#e2d8c0', shoe: '#5a3e26' }, { shirt: '#c8a878', shoe: '#5a3e26' }],
    'read', [DS.chiton, DS.greeceClothing], 'In the Archaic period a man\'s chiton was long; it shortened later, but for priests, charioteers and old men. The page gives no date for the change: the Classical start is the conventional one.'),
  dress('gr-chiton', 'Chiton to the knee', 'man', 'knee', { from: -480, to: -31, approx: true },
    [{ shirt: '#e2d8c0', shoe: '#5a3e26' }, { shirt: '#b0804a', shoe: '#5a3e26' }],
    'read', [DS.chiton, DS.greeceClothing], 'The later man\'s chiton, belted at the knee.'),
  dress('gr-himation', 'Long chiton under the himation', 'man', 'ankle', { from: -750, to: -31, approx: true },
    [{ shirt: '#e8e2d0', skirt: '#8a6a4a', shoe: '#4a3220' }],
    'read', [DS.himation, DS.chiton], 'The himation draped over the left shoulder, unpinned, usually white, sometimes dyed; well arranged, the mark of a citizen of standing; worn long by older men. The cloth below is its colour.'),
  dress('gr-peplos', 'Peplos', 'woman', 'ankle', { from: -800, to: -323, approx: true },
    [{ shirt: '#d8ccb0', shoe: '#5a3e26' }, { shirt: '#8a5048', shoe: '#5a3e26' }],
    'read', [DS.peplos], 'Wool, pinned at both shoulders, overfolded and belted, full length and sleeveless: the women\'s dress of the Archaic and Classical periods, typical by c. 500 BCE.'),
  dress('gr-ionic-chiton', 'Ionic chiton', 'woman', 'ankle', { from: -600, to: -31, approx: true },
    [{ shirt: '#6a7a6a', sleeve: true, shoe: '#4a3220' }, { shirt: '#e0d6c0', sleeve: true, shoe: '#5a3e26' }],
    'secondary', [DS.chiton, DS.peplos], 'Linen or wool held by many small pins neck to wrist, so it reads sleeved. It came after the Doric dress; the page gives no date (Herodotus\' Athenian story of the change is dated only in search snippets).',
    { disputes: 'Herodotus\' story puts the Athenian change early; the Peplos page still calls the peplos typical c. 500 BCE. Read as legend.' }),
  dress('gr-chiton-himation-woman', 'Chiton and himation', 'woman', 'ankle', { from: -750, to: -31, approx: true },
    [{ shirt: '#e8dcc4', skirt: '#8a5048', sleeve: true, shoe: '#5a3e26' }],
    'read', [DS.himation], 'Women wore the himation too, over the chiton.'),
  dress('gr-work-chiton', 'Short work chiton', 'hand', 'knee', { from: -800, to: -501, approx: true },
    [{ shirt: '#9a8a6a' }, { shirt: '#857254' }],
    'unverified', [DS.greeceClothing], 'Before the exomis is attested: the short chiton, undyed (the standard account).'),
  dress('gr-exomis', 'Exomis', 'hand', 'knee', { from: -500, to: -31, approx: true },
    [{ shirt: '#9a8a6a' }, { shirt: '#857254' }],
    'secondary', [DS.exomis], 'The worker\'s short belted tunic, its right shoulder left open. The page states the workers\' use but dates only the soldiers\' (late 5th c. BCE).'),
];
