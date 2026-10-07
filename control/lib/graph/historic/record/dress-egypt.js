/**
 * Egyptian dress: the Old Kingdom (Giza's record) and the New Kingdom (Thebes': it draws Giza's for the years before
 * its own). Kind `dress` (../record.js, ../dress.js). Men and labourers went bare-chested; the miniatures cover every
 * torso, so a shirt of the kilt's linen stands in for the skin (the `shirt` of those looks).
 */
import { DS } from './dress-sources.js';

const dress = (id, name, wearer, cut, attested, looks, confidence, sources, notes, o = {}) => ({ id, name, kind: 'dress', wearer, cut, attested, looks, confidence, sources, notes, ...o });

const SHENDYT = [{ shirt: '#f0ece0', skirt: '#e6e0cc' }, { shirt: '#e8e2d2', skirt: '#ece6d4' }];
const SHEATH = [{ shirt: '#f2eee2' }, { shirt: '#e6dfca' }];
const LOINCLOTH = [{ shirt: '#d8d0b8', skirt: '#e0d8c2' }, { shirt: '#c8bc9e' }];

export const OLD_KINGDOM_DRESS = [
  dress('ok-shendyt', 'Shendyt', 'man', 'knee', { from: -2686, to: -2056, approx: true }, SHENDYT,
    'read', [DS.shendyt, DS.egyptClothing], 'The linen wrap kilt above the knee, belted, worn by every class from the king to the soldier; bare above (here a linen shirt). Old Kingdom by convention: the page\'s own "c. 2130 BC" for it is wrong.'),
  dress('ok-sheath', 'Sheath dress', 'woman', 'ankle', { from: -2686, to: -2056, approx: true }, SHEATH,
    'read', [DS.egyptClothing], 'Strapped, to the ankle; much the same in every period, its length showing rank. White linen, its natural colour.'),
  dress('ok-loincloth', 'Loincloth and short kilt', 'hand', 'knee', { from: -2686, to: -2056, approx: true }, LOINCLOTH,
    'read', [DS.egyptClothing], 'Labourers and servants: a loincloth or nothing (here a short kilt and a linen shirt). Barefoot.'),
];

export const NEW_KINGDOM_DRESS = [
  dress('nk-shendyt', 'Shendyt', 'man', 'knee', { from: -1550, to: -1070, approx: true }, SHENDYT,
    'read', [DS.shendyt, DS.egyptClothing], 'Still every class\'s kilt, pleated since the Middle Kingdom.'),
  dress('nk-pleated', 'Pleated sheer blouse and layered skirts', 'man', 'shin', { from: -1550, to: -1070, approx: true },
    [{ shirt: '#ece6d4', sleeve: true, shoe: '#8a6a40' }],
    'read', [DS.egyptClothing], 'The wealthy man\'s sheer blouse with finely pleated sleeves over layered pleated skirts and a sheer overskirt; in sandals, which most kept for occasions.'),
  dress('nk-sheath', 'Sheath dress', 'woman', 'ankle', { from: -1550, to: -1070, approx: true }, [{ shirt: '#f2eee2' }],
    'read', [DS.egyptClothing], 'The strapped sheath to the ankle, more ornamented than before.'),
  dress('nk-robe', 'Pleated sheer robe', 'woman', 'ankle', { from: -1550, to: -1070, approx: true }, [{ shirt: '#e6dfca', sleeve: true }],
    'unverified', [DS.egyptClothing], 'The wealthy woman\'s pleated, sleeved over-robe: the standard account; the page read states it only for men.'),
  dress('nk-loincloth', 'Loincloth and short kilt', 'hand', 'knee', { from: -1550, to: -1070, approx: true }, LOINCLOTH,
    'read', [DS.egyptClothing], 'Labourers and servants, as before.'),
];
