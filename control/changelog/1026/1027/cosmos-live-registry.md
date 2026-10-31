### The cosmos registry reads its tables live

- **No snapshot** (`cosmos/read-sources.js`, `cosmos/registry.js`): a sourced facet setting's values are read from its
  table on the registry's first call, so a new kit, mechanic or gait is in the cube the moment its table holds it. The
  generated copy (`registry.generated.js`), its generator (`scripts/gen-cosmos-registry.mjs`) and the test that held
  the copy equal to the tables are gone. A facet's source module is imported in `read-sources.js`'s `MODULES`; a facet
  naming one that is not there throws, saying so.
- The scripts that read the cosmos (`tool-surface.mjs`, `cosmos-sweep.mjs`) register the repo's `@/` resolver before
  importing it, since the tables now load with it.
