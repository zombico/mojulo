/**
 * figure-animal-build — the single front door: name → a complete, grounded,
 * balanced animal as render parts.
 *
 * Wires the whole stack together so callers don't reassemble it by hand:
 *   armature (proportions; 4-foot stance + hind-leg angulation auto-correct) →
 *   balance (quadruped no-op; biped feet under the COM) → chains (tail/neck) →
 *   skull (skin: WELDED skull, jaw wrapped into the head · overlap: separate-part protoSkull) →
 *   feet → body (overlap flesh, OR the welded skin + neck→head BRIDGE + HAUNCH ham) →
 *   coat paint + markings → PLANT on the floor.
 *
 * Returns STAND-space parts `{polylines, stroke}` (the renderer lifts to world) plus
 * the resolved nodes / COM / support feet for inspection. `skin:true` is the HERO path
 * (welded body + welded skull); overlap flesh is the cheap lineup path.
 *
 * A species is DATA, not code — see `ZOO_BUILDS` (and BEAR_VARIANTS/RACCOON_BUILD) for the
 * recipe shape, and the "single-animal builder (playbook)" + lever inventory in
 * zoo-mammals.plan.md for how to author one (research → face study → classify → tune by tier).
 * opts: { skin, fleshCfg, skullCfg, footCfg, armatureCfg, tailCfg, neckCfg, coat, underHex,
 *   facePaint, face, tailTip, tailRings, mane, fluffs, forepaws, antlers }.
 */
import { quadrupedArmature, tailChain, neckChain, QUADRUPED_ARCHETYPES } from './figure-animal.js';
import { animalBodyFlesh } from './figure-animal-flesh.js';
import { animalSkin, weldedSkull } from './figure-animal-skin.js';
import { protoSkull, SKULL_PRESETS } from './figure-animal-skull.js';
import { protoFoot, FOOT_PRESETS, groundedFeet } from './figure-animal-foot.js';
import { animalCOM, balanceFeet, plantParts, headFrameFrom } from './figure-animal-ground.js';
import { lionMane } from './figure-animal-mane.js';
import { coatBlades, darkenHex } from './figure-animal-pelage.js';
import { faceDecor, FACE_PRESETS } from './figure-animal-face.js';
import { buildFluffs } from './figure-fluff.js';
import { antlers as buildAntlers } from './figure-animal-antler.js';

const chainPart = (ch) => ({ polylines: ch.rings, stroke: ch.stroke });

// Render a chain TUBE as alternating colour bands along its length. Each band is a
// contiguous run of rings; bands overlap by one ring at the seam so there is no gap.
function bandTube(rings, { colors = ['#2a2622', '#8a8175'], band = 2 } = {}) {
  const out = [];
  for (let start = 0; start < rings.length - 1; start += band) {
    const end = Math.min(start + band, rings.length - 1);
    out.push({ polylines: rings.slice(start, end + 1), stroke: colors[Math.floor(start / band) % colors.length] });
  }
  return out;
}

// The RINGTAIL: a furry plume (harmonious with the body coat) whose FUR is banded in
// alternating colours along the tail — the rings live in the fur, not a bare tube. Each
// band = a run of rings: a banded under-tube (dark) + a fur pass tinted to the band's
// colour. With no body coat, falls back to a bare banded tube.
function ringTail(rings, cfg, coatCfg) {
  const { colors = ['#2c261d', '#9a8a6b'], band = 2, fur = {} } = cfg;
  if (!coatCfg) return bandTube(rings, cfg);
  const furBase = { ...coatCfg, ...(coatCfg.tailFur || {}), ...fur };
  const out = [];
  for (let start = 0, bi = 0; start < rings.length - 1; start += band, bi++) {
    const end = Math.min(start + band, rings.length - 1);
    const seg = rings.slice(start, end + 1), color = colors[bi % colors.length];
    out.push({ polylines: seg, stroke: darkenHex(color, 0.7) });                 // banded under-tube
    out.push(...coatBlades([{ polylines: seg }], { ...furBase, color }));         // banded fur plume
  }
  return out;
}

/**
 * @param {string} name  a QUADRUPED_ARCHETYPES key
 * @param {{skin?:boolean, fleshCfg?:object, skullCfg?:object, footCfg?:object}} [opts]
 * @returns {{parts, nodes, com, feetKeys, chains, head}}
 */
export function buildAnimal(name, { skin = false, fleshCfg = {}, skullCfg = {}, footCfg = {}, mane = null, coat = null, face = null, tailRings = null, facePaint = null, tailCfg: tailOverride = null, neckCfg: neckOverride = null, armatureCfg = null, tailTip = null, tailBands = null, fluffs = null, forepaws = null, antlers = null } = {}) {
  // a recipe may SCALE/bias the named archetype's proportions (shorter legs, lower body,
  // lighter girth) without minting a new archetype — the plan's "pick the nearest, then
  // scale it" rule. Merge armatureCfg over the preset so the species stays DATA.
  const armatureArg = armatureCfg ? { ...(QUADRUPED_ARCHETYPES[name] || {}), ...armatureCfg } : name;
  const { cfg, nodes: n0, radii, tailCfg: tailBase, neckCfg: neckBase } = quadrupedArmature(armatureArg);
  // a recipe may RESHAPE its tail/neck chain (e.g. a bushy wolf/fox brush) without a new
  // archetype — merge the override over the archetype's chain cfg (species stays data).
  const tailCfg = tailOverride ? { ...tailBase, ...tailOverride } : tailBase;
  const neckCfg = neckOverride ? { ...(neckBase || {}), ...neckOverride } : neckBase;
  const feetKeys = groundedFeet(cfg.foreMode);

  // BALANCE: place the support feet under the COM (bipeds stand stably; quadrupeds no-op).
  const neck0 = neckCfg ? neckChain(n0, neckCfg) : null;
  const tail0 = tailChain(n0, tailCfg);
  const com = animalCOM(n0, [tail0, neck0].filter(Boolean));
  const nodes = balanceFeet(n0, feetKeys, com);

  // chains on the (balanced) armature — roots unchanged, so identical, but kept honest.
  const neck = neckCfg ? neckChain(nodes, neckCfg) : null;
  const tail = tailChain(nodes, tailCfg);
  const chains = neck ? [tail, neck] : [tail];

  // head / skull
  const head = headFrameFrom(nodes, neck);
  const skullFull = { ...SKULL_PRESETS[name], ...skullCfg };
  // hero path: a WELDED head (jaw wrapped into the lower face). Overlap-flesh path keeps the
  // cheaper separate-part protoSkull (boxy snout, loose jaw) for fast lineups.
  const skull = skin
    ? weldedSkull({ anchor: head.anchor, dir: head.dir, cfg: skullFull })
    : protoSkull(head.anchor, head.dir, skullFull);

  // feet on the grounded limbs
  const feet = feetKeys.flatMap((k) => (nodes[k] ? protoFoot(nodes[k], { ...FOOT_PRESETS[name], ...footCfg }) : []));

  // BODY: the welded single skin (one coherent marched surface — smooth, no segmented
  // tubes), or the cheap overlap flesh. EITHER WAY the head is the separate `protoSkull`
  // (it carries the boxy snout + the facePaint mask), so we pass NO head to animalSkin
  // (skull = null) — the welded skin covers spine + limbs + neck only, protoSkull is the
  // head. This is the "overall skin pass" the painted animals run before decorations.
  // the head bridge lets the welded skin sweep the neck INTO the cranium (closing the throat gap)
  // without drawing the head — protoSkull stays the visible head. Only for built-in-head archetypes
  // (a neckChain already roots its own tube in the field, so no bridge needed there).
  const headBridge = (skin && !neckCfg) ? { anchor: head.anchor, dir: head.dir, length: skullFull.length ?? 0.18, width: skullFull.width ?? 0.05 } : null;
  const body = skin
    ? animalSkin(nodes, radii, chains, null, fleshCfg, headBridge)
    : animalBodyFlesh(nodes, radii, { ...fleshCfg, skull: true });

  // mane (a few bold locks around the neck) — included before planting
  const maneParts = mane ? lionMane(nodes, head, mane === true ? {} : mane) : [];

  // FLUFFS — the zdog volume vocabulary (figure-fluff.js) pointed at the ANIMAL
  // armature: named chunky volumes (a bead hump, a football haunch, a bell ruff)
  // bound to the balanced nodes as pure DATA. scale:1 keeps STAND units so the
  // stacks convert straight into parts (the renderer lifts once, like everything
  // else). Fluffs are BODY mass: painted the coat colour unless a spec carries
  // its own `hex`, so countershading and normal-rule zones read across them.
  const fluffParts = fluffs ? buildFluffs(nodes, fluffs, { scale: 1 }).map((st) => ({
    polylines: st.rings.map((r) => r.polyline),
    stroke: st.hex || (coat && coat !== true && coat.color) || '#8a8175',
  })) : [];

  // COAT = a coloured coat (PAINT, not fur). Colorize the body + head in the coat colour
  // — no per-strand fur (far fewer polygons). Markings come from colour zones, and the
  // special treatments (mane, ringtail) keep their own geometry.
  const coatCfg = coat === true ? {} : (coat || {});
  const bodyHex = coatCfg.color;
  const painted = !!(coat && bodyHex);
  const bodyOut = painted ? body.map((p) => ({ ...p, stroke: bodyHex })) : body;
  const baseHex = bodyHex;

  // head axis (s = projection ÷ length): used by the face paint.
  const ha = head.anchor, hdl = Math.hypot(head.dir.x, head.dir.y, head.dir.z) || 1;
  const hd = { x: head.dir.x / hdl, y: head.dir.y / hdl, z: head.dir.z / hdl };
  const hL = skullFull.length ?? 0.18, cranEnd = 1 - (skullFull.muzzle ?? 0.5);
  const sAt = (p) => ((p.x - ha.x) * hd.x + (p.y - ha.y) * hd.y + (p.z - ha.z) * hd.z) / hL;
  const ringS = (ring) => { let x = 0, y = 0, z = 0; for (const q of ring) { x += q.x; y += q.y; z += q.z; } const n = ring.length || 1; return sAt({ x: x / n, y: y / n, z: z / n }); };

  // HEAD skin: paint the skull to the coat colour. With `facePaint` (the raccoon mask),
  // LIGHTEN the snout — the muzzle run of the main skull sweep (s ≥ cranEnd) gets
  // `snoutHex`, the lower jaw gets `mouthHex` — so the base around the dark eyes reads as
  // a mask by contrast. Feet keep skin (bare pads).
  let skullOut = skull;
  if (painted && facePaint) {
    const snoutHex = facePaint.snoutHex ?? baseHex, mouthHex = facePaint.mouthHex ?? snoutHex;
    skullOut = skull.flatMap((p, idx) => {
      if (idx > 0) return [{ ...p, stroke: mouthHex }];        // jaw / lower → mouth, lightened
      const rings = p.polylines, cut = rings.findIndex((r) => ringS(r) >= cranEnd);
      if (cut < 0) return [{ ...p, stroke: baseHex }];
      if (cut === 0) return [{ ...p, stroke: snoutHex }];
      return [{ polylines: rings.slice(0, cut + 1), stroke: baseHex }, { polylines: rings.slice(cut), stroke: snoutHex }];
    });
  } else if (painted) {
    skullOut = skull.map((p) => ({ ...p, stroke: baseHex }));
  }

  // face decorators (eyes / ears / nose). Ears default to the coat colour.
  const faceCfg = face === true ? {} : (face || {});
  if (painted && faceCfg.earHex === undefined) faceCfg.earHex = bodyHex;
  const faceParts = face ? faceDecor(head.anchor, head.dir, { ...skullFull, ...(FACE_PRESETS[name] || {}), ...faceCfg }) : [];

  // Chains (tail / neck). chains[0] is the tail: with `tailRings` it becomes the furry
  // banded RINGTAIL — a KEPT special treatment (the raccoon tail). Other chains are
  // smooth coloured tubes (no fur).
  const isRingTail = (i) => tailRings && i === 0;
  const chainsOut = chains.flatMap((ch, i) => {
    if (isRingTail(i)) return [];
    // BANDED tail (no fur): the smooth-tube analog of `tailRings` — split the volumized tail
    // chain into runs of `band` rings, painted in ALTERNATING `colors`, so the SAME teardrop/
    // bushy SHAPE (the fox's volumized chain) reads as a RINGTAIL by colour (the raccoon/lemur).
    // Bands overlap one ring so there's no gap between them. Colours cycle so the LAST band lands
    // on `colors[(nBands-1) % colors.length]` — order the array to put the dark shade on the tip.
    if (i === 0 && painted && tailBands) {
      const rings = ch.rings, { colors, band = 2 } = tailBands, out = [];
      for (let start = 0, bi = 0; start < rings.length - 1; start += band, bi++) {
        out.push({ polylines: rings.slice(start, Math.min(rings.length, start + band + 1)), stroke: colors[bi % colors.length] });
      }
      return out;
    }
    // 2-TONE tail (no fur): paint the tail tube body-colour, then the last `frac` of its
    // rings the tip colour — the fox's white tail-tip, the snow-leopard tip, etc. A bare
    // colour-zone over the EXISTING tail rings (cheap, like facePaint but along the tail).
    if (i === 0 && painted && tailTip) {
      const rings = ch.rings, cut = Math.max(1, Math.floor(rings.length * (1 - (tailTip.frac ?? 0.25))));
      return [
        { polylines: rings.slice(0, cut + 1), stroke: bodyHex },
        { polylines: rings.slice(cut), stroke: tailTip.color },
      ];
    }
    return [painted ? { polylines: ch.rings, stroke: bodyHex } : chainPart(ch)];
  });
  const ringTailParts = (tailRings && chains[0]) ? ringTail(chains[0].rings, tailRings, painted ? coatCfg : null) : [];

  // FOREPAWS (hands) — a tuck-mode biped (kangaroo/theropod) stands on its hind feet, so the
  // forelimbs get no `groundedFeet`. `forepaws` seats a small paw at each wrist: protoFoot
  // reaches DOWN to `sole`, so anchoring sole just below the wrist makes a compact hanging hand
  // rather than a floor-reaching foot. Painted the coat (or footCfg.stroke). Defaults-off — the
  // accepted bare-armed theropod/raptor stay byte-unchanged.
  const handParts = (forepaws && cfg.foreMode === 'tuck')
    ? ['wristL', 'wristR'].flatMap((k) => (nodes[k]
        ? protoFoot(nodes[k], {
            kind: 'paw', sole: nodes[k].z - 0.06, topR: 0.014, width: 0.016, fwd: 0.03,
            padH: 0.008, toeR: 0.006, toeSpread: 0.011,
            stroke: footCfg.stroke || (painted ? bodyHex : undefined),
            ...(forepaws === true ? {} : forepaws),
          })
        : []))
    : [];

  // ANTLERS / HORNS — the branched cranial appendage (figure-animal-antler.js), seated on the
  // crown from the head frame + skull size. `antlers: true` = the default rack; a cfg tunes the
  // beam sweep / tines (a single spike or a curled horn is the same primitive). Defaults-off.
  const antlerParts = antlers
    ? buildAntlers(head.anchor, head.dir, { headLen: skullFull.length ?? 0.16, headW: skullFull.width ?? 0.045, ...(antlers === true ? {} : antlers) })
    : [];

  // PLANT the whole assembly on the floor (lowest contact → z = 0).
  const parts = plantParts([...bodyOut, ...fluffParts, ...skullOut, ...feet, ...handParts, ...chainsOut, ...maneParts, ...ringTailParts, ...faceParts, ...antlerParts]);
  return { parts, nodes, com, feetKeys, chains, head };
}

// ─── The base bear, locked in — `buildAnimal('ursine', BEAR_VARIANTS[v])` ───────
// A tuned full-body coat (dense, blunt, down-combed) + the mammalian face + boxy
// muzzle. The species variants are pure COLOUR SWAPS on the same geometry/seed: brown
// (base), polar (cream coat, dark nose/eyes), panda (white coat, BLACK ears + big black
// eye patches + black nose). Not anatomically exact — evocative.
export const BEAR_BASE_COAT = {
  ringStep: 1, pointStep: 1,
  lenFrac: 0.5, widthFrac: 0.17, thickFrac: 0.8, tip: 0.3,
  loft: 0.18, flow: 0.5, down: 0.85, curl: 0.25,
  jitter: 0.5, seed: 9, color: '#5e4127', N: 5, M: 6,
};

export const BEAR_VARIANTS = {
  brown: { skin: true, coat: { ...BEAR_BASE_COAT }, face: true },
  polar: { skin: true, coat: { ...BEAR_BASE_COAT, color: '#e9e6df' }, face: true },
  panda: {
    skin: true,
    coat: { ...BEAR_BASE_COAT, color: '#efece6' },
    face: { earHex: '#15110d', noseHex: '#15110d', eyeHex: '#15110d', eyeR: 0.3 },
  },
};

// RACCOON — the ursine recipe on the scaled-down `raccoon` archetype: a grizzled
// grey-brown coat, a BUSHY tail (long radial tailFur), and a dark bandit-mask face
// (big dark eyes + dark nose). A color/shape swap of the same fur+face machinery.
// Raccoon palette — the SAME dark/light pair carries the tail rings and the face mask,
// so the markings read as one harmonised animal.
const RACCOON_DARK = '#2c261d';
const RACCOON_LIGHT = '#9a8a6b';

export const RACCOON_BUILD = {
  skin: true,
  // SLIMMER than the bear: the raccoon inherited SKIN_DEFAULT's heavy thorax/belly (1.9/2.1)
  // on top of its own girths → it read bear-bulky. A leaner flesh + thinner extremities gives
  // the compact, hunched procyonid, and a slightly bigger head reads less blobby.
  fleshCfg: { thorax: 1.86, belly: 1.98, bellyDrop: 0.48, taper: 0.38 },
  armatureCfg: { girthHead: 1.18, girthBody: 1.1, girthFore: 0.95 },
  coat: { ...BEAR_BASE_COAT, color: '#9b9078' },                  // grizzled salt-and-pepper grey (renders dark; lift the base)
  // the ringtail — the FOX's volumized SMOOTH tail shape (a bushy teardrop via bulgeR/bulgeAt),
  // carried out behind (low droop), with a blunter tip than the fox. The raccoon read comes
  // from `tailBands`, not fur: alternating dark/tan rings down the same smooth tube → a clean
  // ringtail. Colours ordered light→dark so the TIP lands dark (the raccoon's black-tipped tail).
  tailCfg: { rootR: 0.045, bulgeR: 0.072, bulgeAt: 0.42, tipR: 0.022, droop: 14, length: 0.55, waveAmp: 0.02, waveN: 0.5 },
  tailBands: { colors: [RACCOON_LIGHT, RACCOON_DARK], band: 2 },
  // the domino mask: black DIAMOND patches around the (sunk-in) eyes on the pale face.
  face: {
    eyeHex: '#15110d', noseHex: '#15110d', earHex: '#36302a', eyeR: 0.24, eyeSide: 0.62,
    eyePatchHex: '#15110d', eyePatchR: 0.72, eyePatchAspect: 1.5, eyePatchBridge: 1.05,
  },
  // the bandit mask, made by LIGHTENING: the snout + mouth-under use the tail's LIGHT
  // ring shade so face and tail harmonise; the dark base around the dark eyes reads as
  // the mask band. The diamond patches sit on top of this pale snout.
  facePaint: { snoutHex: RACCOON_LIGHT, mouthHex: RACCOON_LIGHT },
};

// The shared cervid body — the doe (`deer`) uses it as-is; the `buck` spreads it and adds
// antlers. Alert but not craning: a moderate neck angle so the head carries forward-and-up
// (a steeper angle over-cranes the neck and tips the antler rack forward off the crown).
const DEER_OPTS = {
  skin: true,
  fleshCfg: { thorax: 1.74, belly: 1.86, bellyDrop: 0.34, taper: 0.42 },   // lean cervid, but a deeper barrel than the whippet-thin gazelle
  armatureCfg: { backHeight: 0.58, trunkLength: 0.46, backArch: 0.02, neckLength: 0.28, neckAngle: 42, headPitch: -26,
    girthBody: 0.98, girthFore: 0.82, girthHind: 0.86, girthHead: 0.8 },   // a touch bulkier + longer-necked than the gazelle
  skullCfg: { length: 0.16, width: 0.04, muzzle: 0.62, snout: 0.26, boxy: 0.32, muzzleDrop: 0.18 },   // slender tapered head, defined muzzle
  coat: { color: '#9c7a50' },                                     // tan-fawn
  underHex: '#e6ddcc', underCut: -0.4,                            // white throat → belly (countershading)
  facePaint: { snoutHex: '#efe8da', mouthHex: '#efe8da' },        // white muzzle / throat
  footCfg: { stroke: '#2a2018' },                                 // dark cloven hooves
  face: { eyeHex: '#15110d', noseHex: '#15110d', earHex: '#8a6c48',
    eyeR: 0.14, earLen: 1.15, earW: 0.72, earTip: 0.5, earUp: 0.95, earSide: 0.78 },   // BIG upright rounded ears (the mule/white-tail tell)
  tailCfg: { rootR: 0.016, tipR: 0.006, droop: 26, length: 0.2, waveAmp: 0.01 },   // small tail
};

// ─── ZOO_BUILDS — the recurring zoo-mammal recipes (see zoo-mammals.plan.md) ─────
// Each entry is `{ archetype, opts }`: a QUADRUPED_ARCHETYPES key + the buildAnimal opts.
// The DATA layer the zoo-mammals loop appends to — no new primitives, just recipes over
// the proven kit (cf. BEAR_VARIANTS / RACCOON_BUILD). FORM = archetype + skull/foot
// presets; DECORATION = coat paint + facePaint + face cfg. A new species is data here.
export const ZOO_BUILDS = {
  // WOLF — the type caniform: `canine` archetype (balanced walker, deep chest, even
  // fore/hind), canine skull (elongated boxy muzzle) + paw feet already preset. Pure
  // solid grizzled-grey coat — no markings; the silhouette + the long muzzle carry it.
  // WOLF (Canis lupus) — RETRIED with the levers learned from the fox (reference-grounded:
  // Eurasian + Kolmården side/head views). The `canine` baseline scaled UP: tall, long-legged,
  // deep chest, a big BROAD blocky head. Grizzled grey-tan coat with the classic countershaded
  // PALE underside, a pale muzzle, rounded (not pointy) ears, muted feet, and a bushy LOW tail
  // with a DARK tip (the tailTip lever reused with a dark colour, not the fox's white).
  wolf: { archetype: 'canine', opts: {
    skin: true,
    armatureCfg: { backHeight: 0.46, trunkLength: 0.52, neckLength: 0.18, neckAngle: 34,
      girthBody: 1.02, girthFore: 1.06, girthHind: 1.0, girthHead: 1.12 },          // tall, deep-chested, big head
    skullCfg: { length: 0.17, width: 0.056, muzzle: 0.5, snout: 0.36, boxy: 0.7, muzzleDrop: 0.18 },  // broad blocky head, shorter muzzle
    coat: { color: '#a89d8b' },                                       // grizzled grey-tan (lighter, not charcoal)
    underHex: '#ddd5c5', underCut: -0.4,                              // pale cream underside (countershading)
    facePaint: { snoutHex: '#c2b9a7', mouthHex: '#ddd5c5' },         // pale muzzle / throat
    footCfg: { stroke: '#6f6757' },                                  // muted grey-tan feet (not pink pads)
    face: { eyeHex: '#3a2c14', noseHex: '#15110d', earHex: '#5f5648', // amber eyes, dark nose
      eyeR: 0.15, earLen: 0.62, earW: 0.7, earTip: 0.5, earUp: 0.9, earSide: 0.82 },   // ROUNDED erect ears
    tailCfg: { rootR: 0.045, bulgeR: 0.06, bulgeAt: 0.4, tipR: 0.022, droop: 48, length: 0.46, waveAmp: 0.02, waveN: 0.5 },   // bushy, carried LOW
    tailTip: { color: '#2a2118', frac: 0.25 },                       // DARK tail tip
  } },

  // FOX (Vulpes vulpes) — `canine` SCALED to vulpine proportions (lower body, short
  // legs, lighter girth) + the iconic kit: rusty coat, a pointier muzzle, big erect
  // dark-backed ears, a white muzzle (facePaint), and THE tell — a bushy low-carried
  // tail with a WHITE TIP (volumized tailCfg + 2-tone tailTip, NO fur). Grounded in a
  // side-view + head reference. CAVEATS (patch-colour wall, not faked): the black "socks"
  // (lower-leg-only dark) and the white ventral belly are localized patches we can't zone.
  fox: { archetype: 'canine', opts: {
    skin: true,
    armatureCfg: { backHeight: 0.34, trunkLength: 0.5, backArch: 0.028, neckLength: 0.16, neckAngle: 34,
      girthBody: 0.92, girthFore: 0.82, girthHind: 0.9, girthHead: 1.05,   // bigger head
      hindFootBack: 0.075 },   // smaller animal → less absolute hock-back (≈7 o'clock for the fox's H)
    skullCfg: { length: 0.15, width: 0.054, muzzle: 0.52, snout: 0.3, boxy: 0.35, muzzleDrop: 0.16 },   // larger SHORT pointed head (the face scales off it)
    coat: { color: '#b8632a' },
    underHex: '#f6f2ea', underCut: -0.42,                            // white throat → chest → belly (countershading; brighter + tighter so it reads white, not muddy grey, and doesn't spill onto the tail)
    footCfg: { stroke: '#241a12' },                                  // dark feet (black socks tell)
    facePaint: { snoutHex: '#e8e1d4', mouthHex: '#e8e1d4' },          // white muzzle / throat
    face: { eyeHex: '#15110d', noseHex: '#15110d', earHex: '#241a12', // dark ear-backs
      eyeR: 0.16, earLen: 1.1, earW: 0.58, earTip: 0.15, earUp: 1.0, earSide: 0.8 },   // POINTY ears (low earTip)
    // THE tail: a TEARDROP brush — pulled OUT and tapering into the REAR (fuller root that
    // flows off the rump) AND to a POINT at the tip; the fat belly sits mid-tail. To the sketch.
    tailCfg: { rootR: 0.05, bulgeR: 0.082, bulgeAt: 0.44, tipR: 0.008, droop: 36, length: 0.6, waveAmp: 0.02, waveN: 0.5 },
    tailTip: { color: '#efe9dd', frac: 0.3 },                         // the white pointed tip
  } },

  // CAMEL (Camelus dromedarius) — the FLUFF debut on the animal armature: an `equine`
  // body (tall pillar legs, long neck) whose one irreducible tell — the single dorsal
  // HUMP — is carried as a `bead` FLUFF at the mid-spine (`navel`), biased UP so it
  // mounds above the topline. This is the fluff principle doing exactly what paint and
  // chains can't: adding a NAMED body volume that isn't an appendage. Sandy coat, pale
  // countershaded underside, a short blunt (not horse-long) head on the long low-slung
  // neck. Reference: Silverton NSW profile (Wikimedia). Caveat: the real two-toe padded
  // foot + the knock-kneed stance are past the kit; hoof feet read close enough.
  camel: { archetype: 'equine', opts: {
    skin: true,
    armatureCfg: { backHeight: 0.6, trunkLength: 0.5, backArch: 0.02, neckLength: 0.34, neckAngle: 50, headPitch: -30,
      girthBody: 1.12, girthFore: 0.92, girthHind: 0.92, girthHead: 0.8 },   // tall, barrel body, small head on a long neck
    skullCfg: { length: 0.16, width: 0.05, muzzle: 0.5, snout: 0.4, boxy: 0.4, muzzleDrop: 0.22 },   // short soft blunt head (not the horse's long wedge)
    coat: { color: '#d4b483' },                                     // sandy tan (lifted — the lit mesh renders it down toward camel-brown)
    underHex: '#e4d1a8', underCut: -0.4,                            // paler belly (mild countershading)
    // THE HUMP — a bead fluff seated on the mid-spine. `peak` pulls the sphere toward a CONE so
    // it reads as a TRIANGULAR dromedary hump (not a dome); lifted (bias.z) so the broad cone base
    // stays buried in the barrel and only the triangle shows. Painted the coat (no `hex`) so the
    // countershade + lit shading read across it as body.
    fluffs: [{ node: 'navel', shape: 'bead', r: 0.22, peak: 0.55, squash: 0.93, bias: { z: 0.14 } }],
    footCfg: { stroke: '#a98f68' },                                 // tan feet (not pink/black)
    face: { eyeHex: '#241a12', noseHex: '#20160e', earHex: '#b39770',
      eyeR: 0.13, earLen: 0.4, earW: 0.6, earTip: 0.6, earUp: 0.85, earSide: 0.9 },   // small rounded ears
  } },

  // KANGAROO (Macropus rufus) — a BIPED marsupial off the `theropod` balance (huge hind
  // legs, heavy counterweight tail, tucked forelimbs, small head), with the second FLUFF
  // showcase: the massive muscular HAUNCH carried as a `football` fluff on each hip→knee
  // segment (a volumized thigh the round leg-vajra can't bulge to). Upright short neck
  // carrying a small head with big erect ears; rusty-red coat with a pale chest/underside.
  // Reference: red kangaroo (Wikimedia). Caveats: the true digitigrade long hind-foot and
  // the grasping forepaws are past the kit; the balance tail stands in for the tripod prop.
  kangaroo: { archetype: 'theropod', opts: {
    skin: true,
    // fleshCfg only turns ON the joint bridges — the nape (neck→back) and the hind knees close
    // through the smooth field the same way the spine seam does; body weight stays at default.
    fleshCfg: { neckBridge: 0.4, kneeBridge: 0.5 },
    forepaws: true,                                                          // small grasping hands at the wrists
    armatureCfg: { backHeight: 0.5, trunkLength: 0.36, spineTilt: 30,       // rock the trunk upright (the sitting-hopper posture)
      girthBody: 1.05, girthHind: 1.35, girthFore: 0.5, girthHead: 0.7 },
    skullCfg: { length: 0.13, width: 0.05, muzzle: 0.5, snout: 0.3, boxy: 0.4 },   // small blunt head
    neckCfg: { length: 0.16, droop: 22, rootR: 0.03, tipR: 0.02, segments: 12, waveAmp: 0.02 },   // SHORT neck; low droop aims the muzzle FORWARD-and-up (higher droop compounds with spineTilt and curls the face up-and-BACK over the shoulder)
    coat: { color: '#a86b4a' },                                     // rusty red-brown
    underHex: '#cbb7a4', underCut: -0.38,                           // pale grey chest/belly
    // THE HAUNCH — a football fluff on each thigh (hip→knee): girth-heavy, belly slid toward
    // the hip (peak < 0.5). Painted the coat colour, so it reads as continuous muscle.
    fluffs: [
      { segment: ['hipL', 'kneeL'], shape: 'football', girth: 0.115, peak: 0.34 },
      { segment: ['hipR', 'kneeR'], shape: 'football', girth: 0.115, peak: 0.34 },
    ],
    footCfg: { stroke: '#4a382a' },                                 // dark long hind feet
    tailCfg: { rootR: 0.05, tipR: 0.02, droop: 8, length: 0.78, waveAmp: 0.02, waveN: 0.5 },   // thick low heavy balance tail
    face: { eyeHex: '#1a120c', noseHex: '#15100a', earHex: '#8a5a3e',
      eyeR: 0.15, earLen: 1.05, earW: 0.5, earTip: 0.55, earUp: 1.0, earSide: 0.75 },   // BIG erect rounded ears
  } },

  // RED PANDA (Ailurus fulgens) — the DECORATION-only path (no new form): the `raccoon`
  // armature (low, hunched, long ringed tail) recoloured into the ailurid palette. Three
  // levers do all the work — a rich RUST coat, an INVERTED countershade (`underHex` DARK,
  // not pale — the tell is a BLACK belly + black legs), a white muzzle/face (`facePaint`),
  // and a ringed bushy tail (`tailBands` over the volumized fox-brush chain). Reference:
  // Munich Zoo lateral (Wikimedia). Wall caveats: the white eyebrow/ear spots + the dark
  // eye-to-jaw "tear tracks" are localized PATCHES with no geometric signature — not faked.
  redPanda: { archetype: 'raccoon', opts: {
    skin: true,
    fleshCfg: { thorax: 1.7, belly: 1.8, bellyDrop: 0.44, taper: 0.4 },   // lean procyonid (declare it — no bear-weight default)
    armatureCfg: { backHeight: 0.28, trunkLength: 0.42, backArch: 0.05, girthHead: 1.15, girthBody: 1.02, girthFore: 0.9 },
    skullCfg: { length: 0.11, width: 0.052, muzzle: 0.4, snout: 0.42, boxy: 0.35, muzzleDrop: 0.12 },   // short round face
    coat: { color: '#c8631f' },                                     // rich rust (starts bright — it renders down)
    underHex: '#241611', underCut: -0.32,                           // INVERTED countershade: BLACK belly (tight cut so it doesn't speckle the flanks)
    facePaint: { snoutHex: '#f2ece0', mouthHex: '#f2ece0' },         // white muzzle / cheeks
    footCfg: { stroke: '#20140c' },                                 // black feet
    // the ringed bushy tail — the fox brush SHAPE, banded rust/dark like the raccoon (ordered
    // so the tip lands dark), the ailurid ringtail by paint over a volumized chain.
    tailCfg: { rootR: 0.048, bulgeR: 0.066, bulgeAt: 0.4, tipR: 0.026, droop: 20, length: 0.52, waveAmp: 0.03, waveN: 0.6 },
    tailBands: { colors: ['#d08a52', '#7a4526'], band: 2 },
    face: { eyeHex: '#120c08', noseHex: '#120c08', earHex: '#efe6d6', eyeR: 0.2, eyeSide: 0.6,
      earLen: 0.7, earW: 0.78, earTip: 0.5, earUp: 0.95, earSide: 0.82 },   // big rounded white-backed ears
  } },

  // DEER — the cervid body off the `gazelle` archetype (a deer is a large gazelle: slender,
  // long thin legs, cloven hooves, alert neck, small tapered head, big ears). Tan-fawn coat
  // with a white throat/belly (countershade + `facePaint`) and a dark nose. `deer` is the
  // hornless DOE (Phase-1 checkpoint — proves the body reads as a deer with no rack); `buck`
  // is the SAME body + the antler primitive (figure-animal-antler.js), the Phase-2 unlock.
  // Reference: white-tailed deer (Wikimedia). Caveat: the white eye-ring + white tail-flag are
  // localized patches.
  deer: { archetype: 'gazelle', opts: DEER_OPTS },
  buck: { archetype: 'gazelle', opts: {
    ...DEER_OPTS,
    coat: { color: '#8f6c46' },     // buck a touch darker/greyer than the doe
    antlers: true,                  // the branched rack, seated on the crown
  } },

  // GAZELLE (Thomson's-ish) — rounds out the cervid/bovid family off the SAME `gazelle` archetype
  // as the deer, but smaller/lighter and warm-tan, and it proves the antler primitive generalizes
  // to HORNS: a horn is an antler with NO tines (`tines: []`) — here thin, dark, swept UP and BACK
  // with a slight forward hook (the gazelle tell), where the buck's rack branched. White belly +
  // muzzle. Reference: the deer refs + the antelope silhouette. Caveats: the black flank stripe +
  // white face bands are localized PATCHES (the wall); the dark tail-tip is the one colour zone.
  gazelle: { archetype: 'gazelle', opts: {
    skin: true,
    fleshCfg: { thorax: 1.5, belly: 1.62, bellyDrop: 0.32, taper: 0.42 },   // lean, a little lighter than the deer
    armatureCfg: { backHeight: 0.54, trunkLength: 0.42, backArch: 0.03, neckLength: 0.24, neckAngle: 48, headPitch: -22,
      girthBody: 0.86, girthFore: 0.78, girthHind: 0.82, girthHead: 0.78 },   // small + slender
    skullCfg: { length: 0.14, width: 0.038, muzzle: 0.6, snout: 0.26, boxy: 0.3, muzzleDrop: 0.16 },   // small delicate tapered head
    coat: { color: '#c2884a' },                                     // warm tan
    underHex: '#efe7d6', underCut: -0.4,                            // white belly / throat
    facePaint: { snoutHex: '#efe8da', mouthHex: '#efe8da' },        // white muzzle
    footCfg: { stroke: '#241a12' },                                 // dark cloven hooves
    face: { eyeHex: '#15110d', noseHex: '#15110d', earHex: '#a0743e',
      eyeR: 0.14, earLen: 0.95, earW: 0.6, earTip: 0.4, earUp: 0.9, earSide: 0.8 },   // medium pointed ears
    // HORNS — the antler primitive with NO tines: thin dark horns swept UP + BACK with a slight
    // forward hook at the tips (high `back`, small `out`, low forward `curl`), close-set (`spread`).
    antlers: { tines: [], beamLen: 0.26, segs: 7, rise: 0.9, back: 0.52, out: 0.1, curl: 0.22,
      rootR: 0.013, tipR: 0.004, spread: 0.02, pedFwd: 0.12, stroke: '#3a2c1c' },
    tailCfg: { rootR: 0.012, tipR: 0.004, droop: 22, length: 0.2, waveAmp: 0.01 },
    tailTip: { color: '#241a12', frac: 0.4 },                       // dark tail tip
  } },
};
