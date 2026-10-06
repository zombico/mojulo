/**
 * Chinese dress, the Warring States into the Qin (Qin's record). Kind `dress` (../record.js, ../dress.js). Shoes are
 * the standard assumption: no page gave them.
 */
import { DS } from './dress-sources.js';

const dress = (id, name, wearer, cut, attested, looks, confidence, sources, notes, o = {}) => ({ id, name, kind: 'dress', wearer, cut, attested, looks, confidence, sources, notes, ...o });

export const QIN_DRESS = [
  dress('qn-shenyi-warring', 'Shenyi (Warring States)', 'man', 'ankle', { from: -475, to: -222, approx: true },
    [{ shirt: '#2e2a2a', sleeve: true, shoe: '#1c1a18' }, { shirt: '#4a3a32', sleeve: true, shoe: '#1c1a18' }],
    'read', [DS.shenyi, DS.hanfu], 'The deep robe, upper and lower joined in twelve panels, neither showing skin nor touching the ground; worn by the elite and commoners alike.'),
  dress('qn-shenyi-qin', 'Shenyi under the Qin colour rule', 'man', 'ankle', { from: -221, to: -206 },
    [{ shirt: '#e8e2d4', sleeve: true, shoe: '#1c1a18', weight: 2 }, { shirt: '#3e5a46', sleeve: true, shoe: '#1c1a18' }, { shirt: '#2e2a2a', sleeve: true, shoe: '#1c1a18' }],
    'read', [DS.shenyi, DS.baiduQin], 'From the unification: commoners in white, officials of the third rank and above in green; black the most esteemed colour (the Water virtue).',
    { disputes: 'The Hanfu page also speaks of standardized black robes, against its own white for commoners.' }),
  dress('qn-hufu', 'Hufu: jacket, belt and trousers', 'man', 'shin', { from: -307, to: -206 },
    [{ shirt: '#3a4048', sleeve: true, legs: '#2a2a2a', shoe: '#1c1a18' }],
    'read', [DS.wuling, DS.hanfu], 'King Wuling of Zhao put his soldiers, then his court, into the horsemen\'s dress in 307 BCE.'),
  dress('qn-ru-qun', 'Ru and qun', 'woman', 'ankle', { from: -475, to: -206, approx: true },
    [{ shirt: '#6a3a34', sleeve: true, shoe: '#1c1a18' }, { shirt: '#3e3a44', sleeve: true, shoe: '#1c1a18' }],
    'read', [DS.hanfu], 'The long narrow-sleeved robe with a silk sash.'),
  dress('qn-short-jacket', 'Short jacket and trousers', 'hand', 'knee', { from: -475, to: -206, approx: true },
    [{ shirt: '#a89a7a', sleeve: true, legs: '#8a7c60', shoe: '#2a2620' }, { shirt: '#968a6c', legs: '#7a6e56' }],
    'read', [DS.hanfu], 'Labourers and soldiers, with simple headgear.'),
];
