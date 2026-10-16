---
{
  "id": "shoot-plan",
  "name": "Plan the shots — cameras you can see in a world",
  "summary": "Keyed cameras as visible objects in a 3D world, in After Effects terms, with a cut list; a camera may follow a moving car or walker.",
  "when": "\"set up a camera\", \"plan the shots\", \"a shot list / shoot plan / storyboard the camera\", \"two-node camera\", \"point of interest\", \"35mm / 85mm lens\", \"easy ease the keyframe\", \"hold key\", \"show me the camera path\", \"a dolly / crane / push in I can see\", \"follow the car with the camera\", \"chase cam\", \"look through the camera\"",
  "entry": "forge_motion",
  "form": "motion"
}
---
→ `forge_motion({ subject: { world_ref }, shoot: { plan } })` puts cameras in the world as objects: two-node (position + point of interest) or one-node, a lens in mm, keys with Easy Ease / ease in / ease out / hold, a cut list of `shots`. A key's `pos` / `poi` may `{ follow: 'car:2' }` a moving car, walker or mover (`shoot: {}` lists them). The World page draws each camera, its path (a dot per frame) and LOOK THROUGH. Edit in place with `shoot: { ops }` (set_key by time, ease, retime, set_camera, shots); add `shot: { motion: 'plan' }` to render in the same call. The readout gives metres, speeds, jumps and where a move passes through geometry. Manual: `get_motion_vocab({ id: 'shoot' })`. Full family → `get_creative_toolset({ form: 'motion' })`.
