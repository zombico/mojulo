import path from 'node:path';
import { fileURLToPath } from 'node:url';
import createNextIntlPlugin from 'next-intl/plugin';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const withNextIntl = createNextIntlPlugin('./i18n/request.js');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Emits .next/standalone/server.js + a pruned node_modules tree the
  // mojulo-ui bin boots from. Built with --webpack (see prepack script):
  // turbopack's standalone output hashes serverExternalPackages names
  // (e.g. "@huggingface/transformers-31f28a0eb9b916d1"), which Node's
  // resolver can't find when standalone runs from an npm-installed path.
  // See lite-template/integration/UI_PACKAGE_PLAN.md.
  output: 'standalone',
  outputFileTracingRoot: __dirname,
  // Motion folded into the Mojulo Maker concern. Sketches stays its own concern
  // at /sketches. See app/maker/ and control/app/maker/maker.plan.md.
  async redirects() {
    return [{ source: '/motion', destination: '/maker/motion', permanent: false }];
  },
  serverExternalPackages: [
    'better-sqlite3',
    'archiver',
    'pdf2json',
    'officeparser',
    '@huggingface/transformers',
    'onnxruntime-node',
    'node-web-audio-api',
    'sharp',
    'opentype.js',
    'puppeteer-core',
    '@puppeteer/browsers',
  ],
  turbopack: { root: __dirname },
  webpack: (config, { isServer }) => {
    // Keep the dev watcher OUT of the substrate's data store. control/data/ is
    // written on nearly every MCP tool call (SQLite WAL, outcome PNGs/WAVs, bot
    // artifact trees — 5k+ files and growing) and lives inside the project
    // root, so without this the dev compiler treats artifact writes as source
    // changes. 2026-08-13: the Turbopack dev server repeatedly pinned the event
    // loop at ~100% CPU in an fs.realpath storm (sampled: 3010/3011 samples in
    // uv_fs_realpath under a tokio TSFN microtask loop) around compile events,
    // hanging the control plane; Next 16.2.4's Turbopack path exposes no ignore
    // knob (config-schema watchOptions = { pollIntervalMs } only), so the
    // exclusion is wired here on the webpack path — run `next dev --webpack`
    // until Turbopack grows watch excludes. Anchored to control/data —
    // app/data and app/api/data are real source routes and must stay watched.
    config.watchOptions = {
      ...config.watchOptions,
      ignored: [
        ...(Array.isArray(config.watchOptions?.ignored) ? config.watchOptions.ignored : ['**/node_modules/**']),
        '**/control/data/**',
      ],
    };
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        dns: false,
        net: false,
        tls: false,
        fs: false,
        path: false,
        crypto: false,
      };
    }
    return config;
  },
};

export default withNextIntl(nextConfig);
