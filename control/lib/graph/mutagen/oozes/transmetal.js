// TRANSMETAL: the animal still an animal in its outline (its fur, its colours, its own shape), its details machined: a
// chrome faceplate over the skull and the muzzle with the cheeks left fur, chrome lower legs and teeth, a chrome plate
// down the back over furred flanks, dark rings at the leg joints, a hydraulic piston along each upper limb, a segmented
// chrome tail and red visor eyes. Beast mode: the silhouette reads animal, the adornment reads machine.
export const ooze = {
  id: 'transmetal',
  about: 'beast mode: the animal\'s outline and fur, its details machined: a chrome faceplate, chrome legs and back plate, pistons, red visor eyes',
  push: {
    motif: 'chrome',
    groups: {
      Skull: { color: '#c3cad3', material: 'chrome' }, Snout: { color: '#c3cad3', material: 'chrome' },
      Sock: { color: '#9aa3ad', material: 'chrome' }, Hoof: { color: '#9aa3ad', material: 'chrome' },
      Teeth: { color: '#e8eef5', material: 'chrome' }, Tip: { color: '#c3cad3', material: 'chrome' },
    },
    marks: [
      { on: 'torso', kind: 'band', run: [0.15, 0.95], t: [0, 0.3], group: 'Chrome', color: '#c3cad3' },
      { on: 'legs', kind: 'band', run: [0, 0.14], group: 'Joint', color: '#4f565f' },
      { on: 'tail', kind: 'stripes', count: 4, width: 0.35, group: 'Chrome', color: '#c3cad3' },
    ],
    surfaces: { Chrome: 'chrome', Joint: 'gunmetal' },
    pistons: { size: 1 },
    armor: { color: '#8c949e', material: 'chrome' },
    cover: { sheen: 'metal', length: 'short' },
    eyes: { color: '#ff2a2a', glow: true },
  },
};
