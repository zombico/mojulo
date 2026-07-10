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
