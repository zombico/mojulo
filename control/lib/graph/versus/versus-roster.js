/**
 * versus roster — the dummies a versus game starts with: one per archetype, each solved from a line of intent.
 * They are stick figures on purpose: the mechanics are theirs, the looks are other tools'. A game's own roster is
 * a list of intents (or recipes) in its manifest; these are the default.
 */

export const DEFAULT_ROSTER = Object.freeze([
  { id: 'kata', name: 'Kata', archetype: 'all-rounder', color: '#e0503a' },
  { id: 'brisk', name: 'Brisk', archetype: 'rushdown', signature: ['kicks'], color: '#3a9be0' },
  { id: 'arc', name: 'Arc', archetype: 'zoner', color: '#9a4ae0' },
  { id: 'vise', name: 'Vise', archetype: 'grappler', color: '#e0a23a' },
]);

export const DEFAULT_STAGES = Object.freeze([
  { id: 'dojo', name: 'Dojo', sky: ['#2a1d14', '#5a3a22'], floor: '#7a5a3a', crowd: '#3a2a1c' },
  { id: 'harbor', name: 'Harbor', sky: ['#13263a', '#3b6d8c'], floor: '#5a6470', crowd: '#22313d' },
  { id: 'market', name: 'Market', sky: ['#3a1f2a', '#c0704a'], floor: '#8a6a50', crowd: '#4a2a30' },
]);
