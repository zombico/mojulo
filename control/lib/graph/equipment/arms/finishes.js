// equipment/arms/finishes — an arm's LOOK as a card: PURE DATA, as the blade cards are (equipment/styles.js), so an
// agent can read one, copy it and pass its own inline as `build.style`. A finish is a sample: a new look is a new card.
//
// A card:
//   line     the shape language it is drawn in by default: 'modern' | 'future' (laws.js law 7); a build's `line` wins
//   roles    role → a shelf row ['<material>', '#hex'] or a metal surface { metal, finish?, film? } (materials/metal-surface.js):
//     metal      the slide, the barrel, the bolt, a revolver's frame and cylinder: the bare metal (law 3)
//     frame      the receiver, the polymer frame, the shell: the finish
//     grip       the hand's own: the grip panels, the stipple, the pump, a knife's handle
//     furniture  a stock and a fore-end (wood on a classic arm; the frame's when absent)
//     accent     sights, pins, levers, a base plate (the frame's when absent)
//     bore       the dark of a bore, a port, a slot (matte black when absent)
//     glass      an optic's lens (a blue glass when absent)
//     blade      a knife's flat (the metal's when absent);  edge  its sharpened bevel (bright steel when absent)
//     glow       the one emissive hue of a future arm (law 3): its conduit, its emitter, its cell, a future blade's edge;
//                on the near line (law 9) only a display's: a smart sight's screen, a counter, a charge indicator
//     coil       a coilgun's windings (polished copper when absent: the windings are copper whatever the shell)
//
// `service` and `future` are the firearm samples' names (equipment/firearm.js) carried over: a build that names them
// and opts into the arms kernel gets these looks.

export const ARM_ROLES = Object.freeze(['metal', 'frame', 'grip', 'furniture', 'accent', 'bore', 'glass', 'blade', 'edge', 'glow', 'coil']);
export const REQUIRED_ROLES = Object.freeze(['metal', 'frame']);

const BLACK_STEEL = ['gunmetal', '#3c4248'];
const EDGE = { metal: 'steel', finish: 'brushed' };
const COIL = { metal: 'copper', finish: 'polished' };

export const ARM_FINISHES = Object.freeze({
  black: {
    "id": "black", "line": "modern",
    "roles": { "metal": ["gunmetal", "#3c4248"], "frame": ["plastic", "#232528"], "grip": ["rubber", "#151618"], "accent": ["gunmetal", "#6a727b"],
      "bore": ["matte", "#060606"], "glass": ["glass", "#6fc3ff"], "blade": ["gunmetal", "#26292c"], "edge": { "metal": "steel", "finish": "brushed" } }
  },
  fde: {
    "id": "fde", "line": "modern",
    "roles": { "metal": ["gunmetal", "#3c4248"], "frame": ["plastic", "#9b7f5d"], "grip": ["rubber", "#7a6448"], "furniture": ["plastic", "#9b7f5d"], "accent": ["gunmetal", "#3d4146"],
      "bore": ["matte", "#060606"], "glass": ["glass", "#6fc3ff"], "blade": ["gunmetal", "#5a5144"], "edge": { "metal": "steel", "finish": "brushed" } }
  },
  od: {
    "id": "od", "line": "modern",
    "roles": { "metal": ["gunmetal", "#3c4248"], "frame": ["plastic", "#555a38"], "grip": ["rubber", "#3f4229"], "accent": ["gunmetal", "#3d4146"],
      "bore": ["matte", "#060606"], "glass": ["glass", "#6fc3ff"], "blade": ["gunmetal", "#3c3f2c"], "edge": { "metal": "steel", "finish": "brushed" } }
  },
  stainless: {
    "id": "stainless", "line": "modern",
    "roles": { "metal": { "metal": "stainless", "finish": "brushed" }, "frame": ["plastic", "#232528"], "grip": ["rubber", "#151618"], "accent": ["gunmetal", "#4a5057"],
      "bore": ["matte", "#060606"], "glass": ["glass", "#6fc3ff"], "blade": { "metal": "stainless", "finish": "brushed" }, "edge": { "metal": "stainless", "finish": "polished" } }
  },
  walnut: {
    "id": "walnut", "line": "modern",
    "roles": { "metal": ["gunmetal", "#232a33"], "frame": ["gunmetal", "#232a33"], "grip": ["wood", "#5e3519"],
      "furniture": ["wood", "#6b3d1f"], "accent": ["gunmetal", "#3d4146"], "bore": ["matte", "#060606"], "glass": ["glass", "#6fc3ff"],
      "blade": { "metal": "steel", "finish": "polished" }, "edge": { "metal": "steel", "finish": "brushed" } }
  },
  white: {
    "id": "white", "line": "future",
    "roles": { "metal": ["gunmetal", "#59616c"], "frame": ["satin", "#e3e6ea"], "grip": ["rubber", "#2a2d33"], "accent": ["satin", "#9aa3ad"],
      "bore": ["matte", "#0b0d10"], "glass": ["glass", "#7fe9ff"], "blade": ["satin", "#d7dce2"], "glow": ["neon", "#2fd8ff"] }
  },
  gunship: {
    "id": "gunship", "line": "future",
    "roles": { "metal": ["gunmetal", "#1f2328"], "frame": ["satin", "#3b4048"], "grip": ["rubber", "#15171a"], "accent": ["gunmetal", "#b08a3a"],
      "bore": ["matte", "#060606"], "glass": ["glass", "#ffb36b"], "blade": ["gunmetal", "#2e3238"], "glow": ["neon", "#ff7a1a"] }
  },
  titan: {
    "id": "titan", "line": "future",
    "roles": { "metal": { "metal": "titanium", "finish": "brushed", "film": { "anodize": 24 } }, "frame": ["satin", "#2a2e38"], "grip": ["rubber", "#17191e"], "accent": { "metal": "titanium", "finish": "brushed" },
      "bore": ["matte", "#060606"], "glass": ["glass", "#c49bff"], "blade": { "metal": "titanium", "finish": "brushed" }, "glow": ["neon", "#b44dff"] }
  },
  hazard: {
    "id": "hazard", "line": "future",
    "roles": { "metal": ["gunmetal", "#2b2f33"], "frame": ["plastic", "#e2b320"], "grip": ["rubber", "#18191b"], "accent": ["plastic", "#1d1f22"],
      "bore": ["matte", "#060606"], "glass": ["glass", "#6fc3ff"], "blade": ["gunmetal", "#2b2f33"], "glow": ["neon", "#ff3b30"] }
  },
  // the near line (law 9): moulded shells in the modern's palette, a dim display for the one light
  slate: {
    "id": "slate", "line": "near",
    "roles": { "metal": ["gunmetal", "#33383e"], "frame": ["plastic", "#464b52"], "grip": ["rubber", "#1b1d20"], "furniture": ["plastic", "#2c3035"], "accent": ["gunmetal", "#6d747c"],
      "bore": ["matte", "#060606"], "glass": ["glass", "#8ab4c8"], "blade": ["gunmetal", "#3a3f45"], "edge": { "metal": "stainless", "finish": "brushed" }, "glow": ["neon", "#ffb347"] }
  },
  sand: {
    "id": "sand", "line": "near",
    "roles": { "metal": ["gunmetal", "#33383e"], "frame": ["plastic", "#a8977a"], "grip": ["rubber", "#3b3a35"], "furniture": ["plastic", "#8e7f64"], "accent": ["gunmetal", "#4d5258"],
      "bore": ["matte", "#060606"], "glass": ["glass", "#8ab4c8"], "blade": ["gunmetal", "#4b4840"], "edge": { "metal": "stainless", "finish": "brushed" }, "glow": ["neon", "#9dffb0"] }
  },
  ranger: {
    "id": "ranger", "line": "near",
    "roles": { "metal": ["gunmetal", "#33383e"], "frame": ["plastic", "#5d634a"], "grip": ["rubber", "#25271f"], "furniture": ["plastic", "#4a4f3a"], "accent": ["gunmetal", "#4d5258"],
      "bore": ["matte", "#060606"], "glass": ["glass", "#8ab4c8"], "blade": ["gunmetal", "#3c3f33"], "edge": { "metal": "stainless", "finish": "brushed" }, "glow": ["neon", "#ffb347"] }
  },
  arctic: {
    "id": "arctic", "line": "near",
    "roles": { "metal": ["gunmetal", "#3a3f45"], "frame": ["plastic", "#d6d8d3"], "grip": ["rubber", "#2b2e33"], "furniture": ["plastic", "#bfc2bd"], "accent": ["gunmetal", "#5d646c"],
      "bore": ["matte", "#060606"], "glass": ["glass", "#8ab4c8"], "blade": ["satin", "#e8e8e2"], "edge": ["satin", "#f4f4ee"], "glow": ["neon", "#8fe3ff"] }
  },
});
/** the firearm samples' names (equipment/firearm.js) → the arms looks they open */
export const FINISH_ALIASES = Object.freeze({ service: 'black', future: 'white' });
export const DEFAULT_FINISH = 'black';
export const DEFAULT_FUTURE_FINISH = 'white';
export const DEFAULT_NEAR_FINISH = 'slate';

const ROW = (v) => Array.isArray(v) && v.length === 2 && typeof v[0] === 'string' && /^#[0-9a-f]{6}$/i.test(v[1]);
const SURFACE = (v) => !!v && typeof v === 'object' && !Array.isArray(v) && typeof v.metal === 'string';

/** A finish name (or alias) → its card; an inline card passes through. The old firearm card ({ roles: { metal, body,
 * furniture, lit? }, round? }) reads as an arms card: body → frame, lit → glow (and the future line). */
export function finishCardOf(style, line = null) {
  if (style === undefined || style === null) return ARM_FINISHES[line === 'future' ? DEFAULT_FUTURE_FINISH : line === 'near' ? DEFAULT_NEAR_FINISH : DEFAULT_FINISH];
  if (typeof style === 'string') return ARM_FINISHES[FINISH_ALIASES[style] ?? style] ?? null;
  const r = style.roles || {};
  if (r.body && !r.frame) {
    const { body, lit, ...rest } = r;
    return { id: style.id || 'inline', line: lit ? 'future' : 'modern', roles: { ...rest, frame: body, ...(lit ? { glow: lit } : {}) } };
  }
  return style;
}

/** Why an inline finish card is invalid (sentences); empty when valid. */
export function validateFinishCard(card, path = 'style') {
  if (!card || typeof card !== 'object' || Array.isArray(card)) return [`${path}: a finish is a sample name (${Object.keys(ARM_FINISHES).join(', ')}) or a card { line?, roles: { ${ARM_ROLES.join(', ')} } }`];
  const errs = [], c = finishCardOf(card);
  if (c.line !== undefined && !['modern', 'future', 'near'].includes(c.line)) errs.push(`${path}.line: 'modern', 'future' or 'near'`);
  for (const role of REQUIRED_ROLES) if (!c.roles?.[role]) errs.push(`${path}.roles.${role}: required, ['<material>', '#rrggbb'] or { metal, finish?, film? }`);
  for (const [k, v] of Object.entries(c.roles || {})) {
    if (!ARM_ROLES.includes(k)) errs.push(`${path}.roles.${k}: not a role — use ${ARM_ROLES.join(', ')}`);
    else if (!ROW(v) && !SURFACE(v)) errs.push(`${path}.roles.${k}: ['<material>', '#rrggbb'] or a metal surface { metal, finish?, film? }`);
  }
  return errs;
}

/** The card's roles with every absent one filled from the roles it falls back to. */
export function rolesOf(card) {
  const r = card.roles;
  return {
    ...r,
    grip: r.grip ?? r.frame, furniture: r.furniture ?? r.frame, accent: r.accent ?? r.frame,
    bore: r.bore ?? ['matte', '#060606'], glass: r.glass ?? ['glass', '#6fc3ff'], blade: r.blade ?? r.metal,
    edge: r.edge ?? EDGE, glow: r.glow ?? null, coil: r.coil ?? COIL, steel: BLACK_STEEL,
  };
}
