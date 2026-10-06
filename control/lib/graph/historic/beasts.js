/**
 * historic/beasts — the beasts of burden the historic miniatures stand about a town and its fields (./miniatures.js),
 * for scale and flavour: the draught ox in the fields, the donkey and the mule on the streets with their packs, the
 * horse. Static, like the people.
 *
 * Each recipe was designed with the creature creator (`mint_solid` kind `animal`, iterated with `update_sketch`; the
 * ref is noted beside it) and is carried here as the resolved pair that sketch stores, `{ archetype, opts }`, so the
 * world kernel regenerates it without a database. To retune a beast: mint or update its sketch, look at it, copy the
 * stored recipe back. `height` is metres to its top (the poll, the horns, the hump); ../figures/beast-asset.js bakes
 * it low-poly.
 */

export const BEASTS = {
  // the draught ox: the bull recipe gelded to a heavier, lower body, short horns, the pale grey-white of the Italian plough oxen, the head carried low as under a yoke (hm-ox)
  ox: { height: 1.45, recipe: {"archetype":"equine","opts":{"skin":true,"fleshCfg":{"thorax":2.06,"belly":2.16,"bellyDrop":0.46,"taper":0.56},"armatureCfg":{"backHeight":0.5,"trunkLength":0.6,"backArch":0.02,"neckLength":0.14,"neckAngle":18,"headPitch":-34,"girthBody":1.22,"girthFore":1.12,"girthHind":1.08,"girthHead":1.06},"skullCfg":{"length":0.2,"width":0.078,"muzzle":0.55,"snout":0.52,"boxy":0.58,"muzzleDrop":0.16},"coat":{"color":"#c9c2b2"},"underHex":"#b8b0a0","underCut":-0.4,"footCfg":{"stroke":"#1a1410"},"face":{"eyeHex":"#1a120c","noseHex":"#2a2420","earHex":"#a89e8c","eyeR":0.12,"earLen":0.55,"earW":0.62,"earTip":0.62,"earUp":0.55,"earSide":0.98},"antlers":{"tines":[],"beamLen":0.15,"segs":6,"rise":0.45,"back":0.04,"out":0.75,"curl":0.55,"rootR":0.022,"tipR":0.007,"spread":0.04,"pedRise":0.65,"pedFwd":0.15,"stroke":"#d8d0c0"},"tailCfg":{"rootR":0.018,"bulgeR":0.02,"bulgeAt":0.9,"tipR":0.008,"droop":50,"length":0.52},"facePaint":{"snoutHex":"#7a7068"}}} },
  // the pack donkey: the horse recipe made small and short-necked, long ears, a grey-dun coat with a pale muzzle and belly, an upright mane, a tufted tail (hm-donkey)
  donkey: { height: 1.2, recipe: {"archetype":"equine","opts":{"skin":true,"fleshCfg":{"thorax":1.9,"belly":2,"bellyDrop":0.4,"taper":0.5},"armatureCfg":{"backHeight":0.5,"trunkLength":0.46,"backArch":0,"neckLength":0.22,"neckAngle":36,"headPitch":-30,"girthBody":1.04,"girthFore":0.92,"girthHind":0.96,"girthHead":1},"skullCfg":{"length":0.25,"width":0.06,"muzzle":0.62,"snout":0.4,"boxy":0.45,"muzzleDrop":0.2},"coat":{"color":"#8c8278"},"underHex":"#d6cec2","underCut":-0.3,"footCfg":{"stroke":"#241a12"},"face":{"eyeHex":"#1a120c","noseHex":"#2a2420","earHex":"#5a524a","eyeR":0.13,"earLen":2.2,"earW":0.62,"earTip":0.4,"earUp":1,"earSide":0.8},"mane":{"anchorT":0.72,"radius":0.03,"out":0.2,"back":0.2,"rise":0.6,"hang":0.1,"len":0.06,"width":0.03,"thick":0.022,"tip":0.5,"flick":0.02,"crest":0.9,"color":"#3a332c","rings":[{"count":12,"radScale":1,"lenScale":1}]},"tailCfg":{"rootR":0.016,"bulgeR":0.026,"bulgeAt":0.88,"tipR":0.008,"droop":55,"length":0.42,"waveAmp":0.01},"facePaint":{"snoutHex":"#d6cec2","mouthHex":"#d6cec2"}}} },
  // the mule: a horse body with the donkey sire's long ears and tufted tail, bay-brown (hm-mule)
  mule: { height: 1.5, recipe: {"archetype":"equine","opts":{"skin":true,"fleshCfg":{"thorax":1.9,"belly":1.95,"bellyDrop":0.36,"taper":0.46},"armatureCfg":{"backHeight":0.56,"trunkLength":0.48,"backArch":0,"neckLength":0.26,"neckAngle":40,"headPitch":-30,"girthBody":1.02,"girthFore":0.96,"girthHind":1.02,"girthHead":0.98},"skullCfg":{"length":0.25,"width":0.055,"muzzle":0.64,"snout":0.36,"boxy":0.42,"muzzleDrop":0.2},"coat":{"color":"#5e4433"},"underHex":"#8a7058","underCut":-0.35,"footCfg":{"stroke":"#241a12"},"face":{"eyeHex":"#1a120c","noseHex":"#2a1c14","earHex":"#3a2a20","eyeR":0.13,"earLen":1.7,"earW":0.52,"earTip":0.42,"earUp":1,"earSide":0.82},"mane":{"anchorT":0.72,"radius":0.03,"out":0.2,"back":0.2,"rise":0.6,"hang":0.1,"len":0.06,"width":0.03,"thick":0.022,"tip":0.5,"flick":0.02,"crest":0.9,"color":"#241a12","rings":[{"count":12,"radScale":1,"lenScale":1}]},"tailCfg":{"rootR":0.022,"bulgeR":0.032,"bulgeAt":0.6,"tipR":0.012,"droop":48,"length":0.46,"waveAmp":0.02},"facePaint":{"snoutHex":"#a08a74"}}} },
  // the working horse: the horse species in a duller bay (hm-horse)
  horse: { height: 1.65, recipe: {"archetype":"equine","opts":{"skin":true,"fleshCfg":{"thorax":1.9,"belly":1.95,"bellyDrop":0.36,"taper":0.46},"armatureCfg":{"backHeight":0.62,"trunkLength":0.5,"backArch":0,"neckLength":0.3,"neckAngle":46,"headPitch":-32,"girthBody":1.02,"girthFore":0.96,"girthHind":1.02,"girthHead":0.9},"skullCfg":{"length":0.24,"width":0.05,"muzzle":0.66,"snout":0.32,"boxy":0.4,"muzzleDrop":0.2},"coat":{"color":"#6e5038"},"underHex":"#624630","underCut":-0.4,"footCfg":{"stroke":"#241a12"},"face":{"eyeHex":"#1a120c","noseHex":"#2a1c14","earHex":"#4a3020","eyeR":0.13,"earLen":0.72,"earW":0.5,"earTip":0.42,"earUp":1,"earSide":0.82},"mane":{"anchorT":0.72,"radius":0.035,"out":0.12,"back":0.55,"rise":0.15,"hang":0.9,"len":0.11,"width":0.035,"thick":0.026,"tip":0.5,"flick":0.05,"crest":0.7,"color":"#241a12","rings":[{"count":14,"radScale":1,"lenScale":1}]},"tailCfg":{"rootR":0.028,"bulgeR":0.038,"bulgeAt":0.28,"tipR":0.018,"droop":42,"length":0.5,"waveAmp":0.03}}} },
  // the camel: the camel species as it stands (hm-camel)
  camel: { height: 2.2, recipe: {"archetype":"equine","opts":{"skin":true,"armatureCfg":{"backHeight":0.6,"trunkLength":0.5,"backArch":0.02,"neckLength":0.34,"neckAngle":50,"headPitch":-30,"girthBody":1.12,"girthFore":0.92,"girthHind":0.92,"girthHead":0.8},"skullCfg":{"length":0.16,"width":0.05,"muzzle":0.5,"snout":0.4,"boxy":0.4,"muzzleDrop":0.22},"coat":{"color":"#d4b483"},"underHex":"#e4d1a8","underCut":-0.4,"fluffs":[{"node":"navel","shape":"bead","r":0.22,"peak":0.55,"squash":0.93,"bias":{"z":0.14}}],"footCfg":{"stroke":"#a98f68"},"face":{"eyeHex":"#241a12","noseHex":"#20160e","earHex":"#b39770","eyeR":0.13,"earLen":0.4,"earW":0.6,"earTip":0.6,"earUp":0.85,"earSide":0.9}}} },
};

// which beasts each culture works: `field` pull the plough in pairs under a yoke, `town` carry packs led by a driver.
// The donkey was the pack animal from Sumer to Rome; the camel came late to Egypt and Mesopotamia, after these
// periods, so no culture here draws it yet; Qin moved its loads with horses and oxen.
export const HERDS = {
  sumer: { field: ['ox'], town: ['donkey'] },
  thebes: { field: ['ox'], town: ['donkey'] },
  giza: { field: ['ox'], town: ['donkey'] },
  lindos: { field: ['ox'], town: ['donkey', 'mule'] },
  polis: { field: ['ox'], town: ['donkey', 'mule'] },
  qin: { field: ['ox'], town: ['horse', 'ox'] },
  pompeii: { field: ['ox'], town: ['donkey', 'mule', 'mule', 'horse'] },
  forum: { field: ['ox'], town: ['donkey', 'mule', 'horse'] },
};
