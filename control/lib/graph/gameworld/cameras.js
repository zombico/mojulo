/**
 * The camera a gameworld's levels are played through: the world's `camera`, a quick game's `quick.camera`, the cosmos
 * cube's space.camera. levels.js lowers each to a controllable pilot and camera.
 */
// absent: third person with a hero, first person without
export const CAMERAS = Object.freeze({
  'third-person': 'a chase camera behind the hero',
  'first-person': 'you look out of the hero\'s eyes (or are the walker, with no hero); the mouse looks',
  side: 'a side-scroller: the hero runs the trail\'s own line with A / D, the camera square to it and swinging round its bends (needs a hero, and a trail: a climb has no line to run)',
  'top-down': 'a ¾ overhead camera, north up the screen; W walks up the screen (needs a hero to watch)',
});
