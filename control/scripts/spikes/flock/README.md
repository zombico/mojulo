# The flock spike

A realistic crown's puffs drawn as porous sponge (a miniature maker's clump foliage), the light through and the shadow
optional, with its species' own leaves at their true size along the skin. `flock.mjs` emits a gen-7 path page with
`crowns: 'realistic'`, writes a twin for each look (`sponge`, `leaves`: `sponge-glsl.mjs`), and shoots them with the
page as it is from the same cameras into `<out>/index.html`.

    node scripts/spikes/flock/flock.mjs --out <dir> [--look sponge,leaves] [--reuse] [--solid-shadow] [--shots shots.json]

The twins are text patches of the emitted page: they throw when form-flora.js's leaf material changes shape. The look is
the operator's.
