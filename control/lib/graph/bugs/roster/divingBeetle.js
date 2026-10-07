// GREAT DIVING BEETLE (Dytiscus marginalis). Thesis: a SMOOTH, FLAT, STREAMLINED OVAL — head, pronotum and elytra one
// continuous outline with no waist, broadest behind the middle, a low lens in profile (about 30 × 17 × 9 mm) · dark
// olive-black, a YELLOW RIM round the pronotum and down the sides of the elytra · a broad short head flush in the
// pronotum's front · the HIND LEGS long flattened fringed OARS held out sideways and back; the fore and mid legs short ·
// thread antennae about a third of the body · 27–35 mm (Wikipedia "Dytiscus marginalis"; Nilsson & Holmen, The Aquatic
// Adephaga of Fennoscandia and Denmark II: Dytiscidae, Fauna Ent. Scand. 32, 1995).
export const bug = {
  order: 'Coleoptera', name: 'a great diving beetle', length: 0.032, clearance: 0.04,
  head: { form: 'prognathous', len: 0.13, w: 0.13, h: 0.05, pitch: -6, r0: 0.95, peak: 0.3, r1: 0.6, p: 0.6, q: 0.7, overlap: 0.3 },
  trunk: { form: 'shield', len: 0.24, w: 0.2, h: 0.06, split: [0.5, 0.25, 0.25], r0: 0.95, peak: 0.3, r1: 0.75, p: 0.7, q: 0.7, belly: 0.7 },
  pronotum: { from: 0, to: 0.5, w: 1.12, h: 1.35 },
  tail: { form: 'flat', len: 0.5, w: 0.22, h: 0.08, segments: 5, r0: 0.95, peak: 0.3, r1: 0.3, p: 0.7, q: 1.0, belly: 0.6 },
  legs: { form: 'walker', reach: 0.45, thick: 1.3, angles: { coxa: -45, femur: 5, tibia: -50, tarsus: -4 },
    hind: { form: 'swimmer', reach: 1.25, thick: 2.3, yawOver: -40, angles: { coxa: -25, femur: 0, tibia: -10, tarsus: -2 } } },
  antennae: { form: 'filiform', len: 0.32, r: 0.005, rise: 20, yaw: 35, curve: 20 },
  mouth: { form: 'mandibles', len: 0.05, r: 0.012 },
  eyes: { form: 'small', size: 0.28, at: 0.55, elev: 12 },
  wings: { pairs: [{ form: 'elytra', len: 0.58, w: 1.05, h: 1.18, r0: 0.85, peak: 0.4, r1: 0.25, p: 0.6, q: 1.0, seam: 0.4, lift: 0, stations: 16, slots: 'ring20' }] },
  colors: { body: '#6e5228', head: '#2c3020', pronotum: '#2c3020', trunk: '#6e5228', tail: '#6e5228', elytra: '#2c3020', legs: '#7a5a2a', antennae: '#6e5228', mouth: '#4a3a20', eyes: '#141410' },
  markings: [
    { on: 'elytron', kind: 'band', run: [0, 0.85], t: [0.35, 0.55], group: 'Rim', color: '#c9a83a' },
    { on: 'pronotum', kind: 'band', t: [0.3, 0.6], group: 'Rim', color: '#c9a83a' },
  ],
};
