/**
 * Roman dress, the Republic into the Empire (Pompeii's record; the Forum draws it: ../cultures/forum.js). Kind
 * `dress` (../record.js, ../dress.js). What the miniature can draw: the tunic, the toga and the stola as cloth to a
 * hem, the paenula as a cloak, the palla over the head as a veil. The lacerna and the hooded cucullus are unrecorded.
 * A look's `weight` is a judgement on the sources (how common), not a count from them.
 */
import { DS } from './dress-sources.js';

const dress = (id, name, wearer, cut, attested, looks, confidence, sources, notes, o = {}) => ({ id, name, kind: 'dress', wearer, cut, attested, looks, confidence, sources, notes, ...o });

export const ROMAN_DRESS = [
  dress('rm-tunic', 'Tunic (tunica)', 'man', 'knee', { from: -509, to: null, approx: true },
    [{ shirt: '#d8cdb4', shoe: '#5a3e26' }, { shirt: '#a8703c', shoe: '#4a3220' }, { shirt: '#8a5a3c', shoe: '#4a3220' }],
    'read', [DS.romeClothing], 'Worn by every class; a man\'s to the knee, short-sleeved, belted. Wool, more linen from the mid-Republic; colourful, clean and bright for respectability.'),
  // the toga: everyday dress in the Republic, a formal garment the emperors could not make men wear by the 1st c. CE
  dress('rm-toga-republic', 'Toga, everyday (Republic)', 'man', 'ankle', { from: -509, to: -28, approx: true },
    [{ shirt: '#ece6d6', sleeve: true, shoe: '#3a2a1c', weight: 3 }],
    'read', [DS.toga, DS.romeClothing], 'The citizen\'s undyed white wool over the tunic, worn every day. Not by slaves, foreigners or (most) women. Weight 3 of the street\'s men: a judgement.'),
  dress('rm-toga', 'Toga, formal (Empire)', 'man', 'ankle', { from: -27, to: null, approx: true },
    [{ shirt: '#ece6d6', sleeve: true, shoe: '#3a2a1c' }],
    'read', [DS.toga, DS.romeClothing, DS.calceus], 'Augustus had the aediles keep men without the toga out of the Forum; by Juvenal hardly anyone in much of Italy wore it but at death. A few in the street, in the calceus.',
    { disputes: 'The page summary said freedmen could not wear it; the usual account is that they, as citizens, could.' }),
  dress('rm-stola', 'Stola and palla', 'woman', 'ankle', { from: -509, to: 99, approx: true },
    [{ shirt: '#9a4a3a', sleeve: true, shoe: '#5a3e26' }, { shirt: '#c9b27a', sleeve: true, shoe: '#5a3e26' }, { shirt: '#5e6a7a', sleeve: true, shoe: '#4a3220' }],
    'read', [DS.stola, DS.romeClothing], 'The married woman\'s long sleeveless stola over a long-sleeved tunic (the sleeve shown), the palla over it. Opened to plebeian matrons and freedwomen c. 220 BCE; wholly out of use by the start of the 2nd c. CE.'),
  dress('rm-long-tunic', 'Long tunic and palla', 'woman', 'ankle', { from: 100, to: null, approx: true },
    [{ shirt: '#9a4a3a', sleeve: true, shoe: '#5a3e26' }, { shirt: '#b8a888', sleeve: true, shoe: '#5a3e26' }, { shirt: '#5e6a7a', sleeve: true, shoe: '#4a3220' }],
    'read', [DS.romeClothing, DS.stola], 'After the stola: the ankle-length long-sleeved tunic, the palla over it.'),
  dress('rm-work-tunic', 'Short work tunic', 'hand', 'knee', { from: -509, to: 300, approx: true },
    [{ shirt: '#9a8a6a' }, { shirt: '#7a6648', shoe: '#4a3a2a' }, { shirt: '#b0a080' }],
    'read', [DS.romeClothing, DS.exomis], 'No set dress for slaves or labourers: a short undyed tunic (the exomis was taken up too), barefoot or rough-shod. Dark wool suited the work.'),
  dress('rm-bracae', 'Short tunic over trousers (bracae)', 'hand', 'knee', { from: 301, to: null, approx: true },
    [{ shirt: '#9a8a6a', legs: '#6a5a44', shoe: '#4a3a2a' }, { shirt: '#7a6648', legs: '#5a4a38', shoe: '#4a3a2a' }],
    'read', [DS.romeClothing], 'Trousers were the barbarian\'s until late: Diocletian\'s price edict of 301 pays trouser-makers (Honorius tried to ban them in 397).'),
  // the cloaks and the veil (the miniature's `cloak` and `headwear`)
  dress('rm-paenula', 'Paenula over the tunic', 'hand', 'knee', { from: -27, to: null, approx: true },
    [{ shirt: '#9a8a6a', cloak: '#6a5a48', cloakTo: 'knee' }],
    'read', [DS.paenula], 'The closed cloak with a hole for the head: slaves\', soldiers\' and the lower orders\' wear in the early Empire. The page names no hood.'),
  dress('rm-paenula-citizen', 'Paenula, the citizen\'s', 'man', 'knee', { from: 200, to: null, approx: true },
    [{ shirt: '#d8cdb4', cloak: '#7a5a3c', cloakTo: 'knee', shoe: '#4a3220' }],
    'read', [DS.paenula], 'Fashionable among the upper classes in the 3rd century; made the senators\' everyday dress by law in 382.'),
  dress('rm-palla-veiled', 'Palla drawn over the head', 'woman', 'ankle', { from: -509, to: null, approx: true },
    [{ shirt: '#9a4a3a', sleeve: true, shoe: '#5a3e26', headwear: 'veil', headHex: '#c9b27a' }],
    'unverified', [DS.romeClothing], 'The married woman\'s palla worn up over the head out of doors: the standard account; the page read dates the palla with the stola but does not say how it was worn.'),
];
