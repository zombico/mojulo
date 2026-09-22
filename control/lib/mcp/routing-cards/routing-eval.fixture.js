// Shared routing-eval fixture — user phrasings → the entry tool the route
// must land on. Consumed by BOTH routing gates:
//   - routing-eval.integration.test.js (gate 2a): the RETRIEVAL hop — phrasing
//     → embedding search over routing cards → entry tool in top-K.
//   - ../tools/body-routing-eval.integration.test.js (gate 2b): the IN-CONTEXT
//     hop — phrasing + the forward_context studio body → the model names the
//     entry tool. (forward-context-grammar.plan.md, re-scoped audit #2.)
//
// Keep phrasings colloquial and OFF-card (verbatim card quotes prove nothing).
// When adding a creative capability, add 1–2 rows here — both gates pick them
// up automatically.

export const FIXTURE = [
  ['can you sketch our deployment pipeline as boxes and arrows', 'create_sketch'],
  ['bar chart of last month signups by week', 'create_sketch'],
  ['paint a moody mountain valley at dusk', 'sketch_what_possible'],
  ['I want a picture of a woman mid-stride', 'mint_solid'],
  ['recreate the camera angle from this photo I am showing you', 'reference_protocol'],
  ['our company logo in shiny 3D chrome', 'mint_solid'],
  ['model a wine glass true to size', 'mint_solid'],
  ['write me a bracket with four bolt holes in openscad', 'mint_solid'],
  ['I have some .scad code for an enclosure, can you bring it in and show it', 'mint_solid'],
  ['put the wheels and the chassis together into one model', 'mint_solid'],
  ['turn this concept art of an espresso machine into a 3d model piece by piece', 'mint_solid'],
  ['rebuild my drawing of a bicycle as a real 3d model one segment at a time', 'mint_solid'],
  ['build me a little town I can wander around in', 'compose_world'],
  ['help my kid understand black holes with something animated', 'create_view'],
  ['background music for the forest level', 'create_beats'],
  ['give me a spinning view of that molecule', 'forge_motion'],
  ['present these three charts one after another with build-in steps', 'forge_motion'],
  ['record the hero clearing the chasm and show me the clip', 'forge_motion'],
  ['check the player can actually get from the door to the goal', 'forge_motion'],
  ['merge those short clips into a single movie file', 'stitch_motion'],
  ['a roguelike where my gear persists across floors', 'create_game'],
  ['turn my notes into a picture book for kids', 'mint_stash'],
  ['lay out a comic page of my hero fighting the dragon', 'create_sketch'],
  ['an AI-painted portrait I will render with an image model', 'create_sketch'],
  ['make my anime character actually talk and blink', 'create_sketch'],
  ['stage the two drawn characters in one scene and cut between their rooms', 'create_sketch'],
  ['make a pixel-art cutscene of my hero character', 'get_catalyst'],
  ['design me a two-storey house with a porch', 'create_sketch'],
  ['a furnished apartment I can walk through', 'create_sketch'],
  ['pixelize this portrait into a 32-bit sprite', 'get_catalyst'],
  // Orientation-containment C1: the FORM recognizer rows moved into the studio
  // body (forward_context mode:'studio'); these rows pin that an agent that
  // skips the studio read and goes straight to semantic_search still lands on
  // the right card. Voice previously had no fixture coverage.
  ['I want my comic to reveal one speech bubble per tap on my phone', 'create_sketch'],
  ['present the graphic novel like a slideshow I click through', 'create_sketch'],
  ['I want the narrator to sound deeper and more sure of herself', 'create_voice'],
  ['give my app a japanese female announcer voice', 'create_voice'],
  // The animal realm of the figure system (figure-inception-quality.plan.md
  // phase 4). The PICTURE row already routes a non-humanoid creature here, so
  // these pin that a NAMED real animal lands on the solid family rather than
  // drifting to the painted-picture or part-graph neighbours.
  ['a wolf I can 3D print', 'mint_solid'],
  ['a deer with antlers standing in profile', 'mint_solid'],
];

// Adjacency collisions: pairs of cards that share heavy surface vocabulary
// ("walk", "dungeon", "world", "animated") where a loose membership gate lets
// the WRONG neighbour sit at rank 0. Gate 2a pins rank-0 + margin on these;
// gate 2b includes them as plain routing rows (they are the hard cases).
export const COLLISION_FIXTURE = [
  // a playable artifact vs the walkability audit — both are "walk in a world"
  ['a playable dungeon crawler I can actually walk around in', 'create_game'],
  // ...while the audit itself must still win its own turf (the control)
  ['walk to the exit and check the level is beatable', 'forge_motion'],
  // an animated explainer vs a camera flythrough — margin was ~0.004
  ['show my kid how a black hole bends light, animated', 'create_view'],
];
