# Adornment: armor, apparel and accessories as their own layer

We build up the figure: body → segment detail ([body detail](../body-detail/README.md)) → limbs
([wings](../wings/README.md)) → **adornment**. Adornment is made for the creature, not grown from it. It reads
everything beneath it and never writes it; removing it leaves the creature unchanged.

The layer is core since the hero became its third wearer: `control/lib/graph/polygonizer/station-loft-adorn.js`
(modes, stacking, the justification ledger and a SIGNATURE library: `boss`, `spike`, `buckle`, `ring`, `medallion`,
`plume`, `bell`, `studs`). The dragon and vulture kits here are DATA over it, byte for byte what their code
signatures built. The hero's `ranger` kit (`hero-dress.js`) is baked into its recipe through the plan's `adorn` block:
each adornment and its signature share one pin, so a rigid adornment rides one bone under the rig.

## Mugen on a layered creature

The figure garments' mugen is a standoff measured outward from the surface beneath (the looseness dial). On a layered
creature every surface point has an address and a normal, so it stops being radial:

    adornment point = address origin + normal × (hull height of everything beneath + mugen)

"Everything beneath" is the carrier, the parts it spans (`over`), their segment detail and every adornment already
worn: true stacking, inner to outer. The height field is smoothed (a max, then a mean) so an adornment follows the
gross line, not each scale. Detail that pokes (spurs, spines) is left out and passes through. The mugen ramps looser
away from the adornment's support.

## Modes

| Mode | Examples here |
| --- | --- |
| SHELL: a window of a segment, wrapped or partial, a thick wall | bracers, pauldrons (a torso shell `over` the upper arm), a falconry hood |
| BAND: a narrow wrapped shell | belt, collar, jesses |
| STRAP: a path of addresses across the body | a harness over the chest scutes |
| HANG: a chain under gravity that clears the SURFACE it hangs in front of | a medallion, bells |
| MOUNT: a rigid object on a bone frame | not built |

## Rules

1. A separate layer: it reads the creature and never writes it.
2. Mugen from beneath: standoff from the hull of everything beneath, never bare skin.
3. A named support: snug where it is held, looser away, gravity-aware when it hangs.
4. Rides a bone by rule: a rigid adornment belongs to ONE bone, its support's (a pauldron rides the torso and the arm
   moves beneath it), where that bone dominates; a soft one inherits skin weights by address; a hanging one rides its
   anchor.
5. **One recognizable visual element.** Every adornment declares its signature (a boss, a spike, a buckle, a ring, a
   medallion, a plume, a bell): the element that justifies its existence. A signature is its ELEMENT plus whatever
   carries it (chain links), named apart. The exposure ledger (`station-loft-exposure.js`) must find it reading
   (exposed ≥ 0.25) and a real share of its adornment's picture (≥ 0.08). Otherwise the adornment is flagged
   unjustified: advisory, never a refusal. The ledger says an adornment is SEEN; it does not say it is wanted: an
   accessory can read and still compete with the face (several similar gold accents did). One signature per body
   region, and asymmetry (one defended shoulder) tells more than a matched pair.

The rule earns its place: it caught a medallion buried in the chest (its chain had been cleared against scattered
vertices, so it slipped between them; clearance is now against the surface) and a pauldron spike too small to read
(made bolder).

## Checks

`test-adornment.mjs`: closure; wearing never changes the creature beneath; the medallion clears the chest surface;
every adornment on both creatures is justified.

Not certified: the harness path and the pauldron window are hand-placed addresses (supports are named by part, not
landmark); no MOUNT; the dragon's kit is not bound to its rig here (the hero's is, through the bake). (Binding a part pinned to a detail part, layer 3 on layer 2, works:
`bindLayered` resolves an L2 parent's local point ids.)

## Reproduce

```sh
node --test docs/examples/adornment/test-adornment.mjs
node docs/examples/adornment/adornment.mjs   # build-up.png + report.json in the spike tree
```
