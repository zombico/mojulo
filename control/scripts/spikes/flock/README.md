# The flock spike

Where the realistic crown's flock was found (it now lives in `lib/graph/scene/channels/form-flock.js`; see
`docs/vegetation.md`). `flock.mjs` emits a gen-7 path page with `crowns: 'realistic'` and shoots it from fixed cameras
into `<out>/index.html`; `--look ''` shoots the page as lib draws it.

    node scripts/spikes/flock/flock.mjs --out <dir> --look '' [--reuse] [--shots shots.json]

Its `sponge` and `leaves` twins patched the page as it was before the flock landed. They now refuse, by design, since
the leaf material they patch has changed shape. The look is the operator's.
