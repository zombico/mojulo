/**
 * Local embedding client for the control plane.
 *
 * Loads multilingual-e5-small via @huggingface/transformers and runs inference
 * in-process. No network calls after the model is fetched.
 *
 * The runtime is the OPT-IN `recall` install group (lib/mcp/packs.js): it is not a
 * dependency of the package. `mojulo install recall` puts it under
 * $MOJULO_HOME/recall/ — its own package.json plus an `entry.mjs` shim that
 * re-exports the package — so it survives package upgrades the way the model
 * cache under $MOJULO_HOME/models does, and the shipped package.json is never
 * mutated. This module imports that shim by file URL when it exists, else the
 * bare specifier (repo-dev with the package installed by hand). Absent both,
 * `generateEmbeddings` throws the install line; `semantic_search` runs lexically
 * (FTS5) without it, and every other tool is unaffected.
 *
 * The same model + dtype combo runs in the lite-template artifact at
 * runtime, so corpus and query vectors live in the same geometric space.
 *
 * e5 models expect prefixed inputs:
 *   - 'passage: <text>' for corpus chunks
 *   - 'query: <text>' for retrieval queries
 * This module owns that convention so callers stay model-agnostic.
 *
 * The cache dir resolves to MOJULO_MODELS_DIR if set (npx flow lands this at
 * ~/.mojulo/models), else the bundled lib/embedder/models/ next to this file
 * (clone-and-run flow).
 */

import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { moduleDir } from '../module-dir.js';
import { installedGroups, markerFilePath } from '../mcp/packs.js';

const __dirname = moduleDir(import.meta.url, 'lib/embedder');

// Two modes:
//   - MOJULO_MODELS_DIR set (npx flow): cache lives under the user's home,
//     gets populated lazily on first call. Remote downloads enabled so the
//     fresh-dir case self-heals without a separate postinstall step.
//   - MOJULO_MODELS_DIR unset (clone-and-run flow): cache lives next to this
//     file, postinstall fills it. Remote downloads stay off — preserves the
//     current offline-after-install posture.
const USER_CACHE = !!process.env.MOJULO_MODELS_DIR;
const CACHE_DIR = process.env.MOJULO_MODELS_DIR || path.resolve(__dirname, 'models');

export const RECALL_INSTALL_LINE =
  'run `mojulo install recall` (or include \'recall\' in MOJULO_PACKS if you manage the install manually)';

/** The recall group's install dir under $MOJULO_HOME (kept in sync with scripts/mcp-install.mjs). */
export function recallDir() {
  return markerFilePath('recall');
}

/** True when the embedding runtime is installed on this host (the `recall` group). */
export function embedderAvailable(env = process.env) {
  return installedGroups(env).has('recall');
}

export class RecallUnavailableError extends Error {
  constructor(detail) {
    super(
      'The embedding runtime (the `recall` install group) is not installed on this host'
        + (detail ? ` — ${detail}` : '')
        + `. Semantic search runs lexically without it; to add vector recall ${RECALL_INSTALL_LINE}.`,
    );
    this.name = 'RecallUnavailableError';
    this.code = 'RECALL_UNAVAILABLE';
  }
}

// `@huggingface/transformers` is loaded on FIRST USE, not at module load: its node build
// statically imports `sharp`, whose native half is an optional dependency, so importing it
// here would put a `Could not load the "sharp" module` crash on every path that merely
// reaches this module (the embeddings repository and the polygonizer card router import it
// statically, and both sit on tool registration — see lib/sharp-lazy.js). The env settings
// are applied the moment the module lands; the promise is shared so they apply once.
//
// Resolution: the recall dir's shim first (a file URL, so Node walks up to
// $MOJULO_HOME/recall/node_modules), else the bare specifier. webpackIgnore keeps
// `next build` from trying to bundle a path it cannot know.
let transformersPromise = null;
export function loadEmbeddingRuntime() {
  if (!transformersPromise) {
    if (!embedderAvailable()) {
      return Promise.reject(new RecallUnavailableError());
    }
    const shim = path.join(recallDir(), 'entry.mjs');
    const load = existsSync(shim)
      ? import(/* webpackIgnore: true */ /* @vite-ignore */ pathToFileURL(shim).href)
      : import('@huggingface/transformers');
    transformersPromise = load
      .then((mod) => {
        mod.env.cacheDir = CACHE_DIR;
        mod.env.allowRemoteModels = USER_CACHE;
        mod.env.allowLocalModels = true;
        return mod;
      })
      .catch((err) => {
        transformersPromise = null;
        throw new Error(
          `The embedding runtime (@huggingface/transformers) failed to load: ${err.message}. `
            + `Semantic search runs lexically and embedding backfill is off until it loads (${RECALL_INSTALL_LINE} to reinstall); recipes, exports, and every other tool work without it.`,
        );
      });
  }
  return transformersPromise;
}

const MODEL_ID = 'Xenova/multilingual-e5-small';
const DTYPE = 'q8';

export const LOCAL_EMBEDDING_MODEL = 'multilingual-e5-small';
export const LOCAL_EMBEDDING_DIM = 384;

let extractorPromise = null;

/**
 * Begin loading the embedding model in the background. Idempotent — shares
 * promise state with the lazy path in generateEmbeddings(), so calling this
 * at server cold-start lets the 130MB fetch overlap with the user's first
 * exchanges instead of blocking their first RAG action. A no-op when the
 * recall group is not installed (nothing to preload, nothing to fetch).
 * Callers that don't await should still .catch() to avoid an unhandled
 * rejection.
 */
export async function preloadModel() {
  if (!embedderAvailable()) return;
  await getExtractor();
}

function getExtractor() {
  if (!extractorPromise) {
    extractorPromise = loadEmbeddingRuntime()
      .then(({ pipeline }) => pipeline('feature-extraction', MODEL_ID, { dtype: DTYPE }))
      .catch((err) => {
        extractorPromise = null;
        if (err instanceof RecallUnavailableError) throw err;
        const hint = USER_CACHE
          ? `Lazy download from ${CACHE_DIR} failed — check network / disk and retry.`
          : `Run "node scripts/fetch-embed-model.js" first.`;
        throw new Error(
          `Failed to load embedding model from ${CACHE_DIR}. ${hint} Cause: ${err.message}`
        );
      });
  }
  return extractorPromise;
}

/**
 * Generate embeddings for a list of texts. Returns L2-normalized
 * 384-dim float arrays parallel to the input.
 *
 * @param {string[]} texts
 * @param {Object} options
 * @param {'search_document' | 'search_query'} options.inputType
 * @returns {Promise<number[][]>}
 */
export async function generateEmbeddings(texts, { inputType } = {}) {
  if (!Array.isArray(texts) || texts.length === 0) {
    throw new Error('generateEmbeddings: texts must be a non-empty array');
  }
  if (inputType !== 'search_document' && inputType !== 'search_query') {
    throw new Error(
      "generateEmbeddings: inputType is required ('search_document' | 'search_query')"
    );
  }

  const prefix = inputType === 'search_query' ? 'query: ' : 'passage: ';
  const extractor = await getExtractor();
  const out = await extractor(
    texts.map((t) => prefix + t),
    { pooling: 'mean', normalize: true }
  );
  return out.tolist();
}
