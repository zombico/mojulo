/**
 * Mesopotamian dress, the Uruk period into the Akkadian (Sumer's record). Kind `dress` (../record.js, ../dress.js).
 * Men went bare above the skirt; the miniatures cover every torso, so a wool shawl or a sheepskin stands in (the
 * `shirt`). Colours and footwear are the standard assumption (natural wool, bare feet): no page gave them.
 */
import { DS } from './dress-sources.js';

const dress = (id, name, wearer, cut, attested, looks, confidence, sources, notes, o = {}) => ({ id, name, kind: 'dress', wearer, cut, attested, looks, confidence, sources, notes, ...o });

export const SUMER_DRESS = [
  dress('su-net-skirt', 'Kilt and net skirt', 'man', 'knee', { from: -4000, to: -2701, approx: true },
    [{ shirt: '#a89470', skirt: '#c4b088' }, { shirt: '#b8a47e', skirt: '#cbb994' }],
    'read', [DS.kaunakes, DS.warka, DS.earlyDynastic], 'Before the kaunakes: kilts and net skirts fitted to the lower body, the upper bare (the Warka Vase\'s ruler in a belted kilt).'),
  dress('su-kaunakes', 'Kaunakes', 'man', 'shin', { from: -2700, to: -2154, approx: true },
    [{ shirt: '#b8a47e', skirt: '#d6c8a4' }, { shirt: '#a89470', skirt: '#c4b088' }],
    'read', [DS.kaunakes, DS.earlyDynastic], 'The tufted wrap skirt tied at the waist, to the knee (the ankle for rank), bare above or under a sheepskin; sheepskin, then tufted woven wool from c. 2500.',
    { disputes: 'The Kaunakes page starts the Early Dynastic at 2700 BCE; the Early Dynastic page at 2900 (middle) or 2800 (short chronology).' }),
  dress('su-fringed-shawl', 'Fringed draped shawl', 'man', 'ankle', { from: -2370, to: -2000, approx: true },
    [{ shirt: '#b49a70', skirt: '#c8b08a' }],
    'secondary', [DS.britannicaDress, DS.zay], 'Wool, later linen, edged with tassels or fringe, draped over a skirt, sometimes across the left shoulder: Akkadian.'),
  dress('su-wrap', 'Wrapped wool shawl', 'woman', 'ankle', { from: -4000, to: -2154, approx: true },
    [{ shirt: '#cbb994', sleeve: true }, { shirt: '#a88a62' }],
    'secondary', [DS.zay, DS.earlyDynastic], 'Women in shawls c. 3000 BCE (Zay); the temple statues\' women in tufted dresses and wrapped headdresses.'),
  dress('su-kaunakes-shawl', 'Tufted shawl, the right shoulder bare', 'woman', 'ankle', { from: -2700, to: -2154, approx: true },
    [{ shirt: '#d6c8a4' }],
    'read', [DS.kaunakes], 'The left arm and shoulder covered, the right bare (here covered by the shirt).'),
  dress('su-loincloth', 'Loincloth', 'hand', 'knee', { from: -4000, to: -2154, approx: true },
    [{ shirt: '#a08c68', skirt: '#b4a07a' }, { shirt: '#8c7a5a' }],
    'secondary', [DS.zay, DS.kaunakes], 'Men in loincloths c. 3000 BCE; the servant\'s and the soldier\'s kaunakes the shortest.'),
  dress('su-sheepskin', 'Kaunakes under a sheepskin', 'man', 'shin', { from: -2700, to: -2154, approx: true },
    [{ shirt: '#b8a47e', skirt: '#d6c8a4', cloak: '#e0d4b8', cloakTo: 'hip' }],
    'read', [DS.kaunakes], 'Bare above the kaunakes or under a sheepskin cloak.'),
];
