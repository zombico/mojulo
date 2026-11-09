### WebGPU for gen-7: the spike

A gen-7 page (the form render, the era the renderer lights) is to try three's WebGPU renderer first and fall back to
today's WebGL page; a gen-6 page is not touched. This entry is the spike that tests whether it holds, before any of it
reaches the World page.

- **The spike** (`scripts/spikes/webgpu/`): a geocube island read in gen-7, emitted as today's World page, and the same
  page with its renderer swapped for three's WebGPU renderer (r184's, the release the vendored build is), drawn side by
  side in headless Chromium on SwiftShader's WebGPU adapter. Nothing in the emitter or the vendored tree changes.
