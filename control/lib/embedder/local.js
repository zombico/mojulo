/**
 * Local embedding client for the control plane.
 *
 * Loads multilingual-e5-small from the
 * pre-fetched ONNX cache at lib/embedder/models/ via @huggingface/transformers
 * and runs inference in-process. No network calls.
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

import path from 'node:path';
import { moduleDir } from '../module-dir.js';

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

// `@huggingface/transformers` is loaded on FIRST USE, not at module load: its node build
// statically imports `sharp`, whose native half is an optional dependency, so importing it
// here would put a `Could not load the "sharp" module` crash on every path that merely
// reaches this module (the embeddings repository and the polygonizer card router import it
// statically, and both sit on tool registration — see lib/sharp-lazy.js). The env settings
// are applied the moment the module lands; the promise is shared so they apply once.
let transformersPromise = null;
function loadTransformers() {
  if (!transformersPromise) {
    transformersPromise = import('@huggingface/transformers')
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
            + 'Semantic search and embedding backfill are off until it loads; recipes, exports, and every other tool work without it.',
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
 * at server cold-start lets the 113MB fetch overlap with the user's first
 * exchanges instead of blocking their first RAG action. Callers that don't
 * await should still .catch() to avoid an unhandled rejection.
 */
export async function preloadModel() {
  await getExtractor();
}

function getExtractor() {
  if (!extractorPromise) {
    extractorPromise = loadTransformers()
      .then(({ pipeline }) => pipeline('feature-extraction', MODEL_ID, { dtype: DTYPE }))
      .catch((err) => {
        extractorPromise = null;
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
