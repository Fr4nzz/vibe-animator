import { defineConfig, normalizePath, type Plugin } from 'vite';
import { cpSync } from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');
const assetDirs = ['audio', 'data'];

// Git can check out directory symlinks as plain files on Windows. Serve the
// original assets through Vite and copy them into builds without using symlinks.
function repoAssets(): Plugin {
  return {
    name: 'repo-assets',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (assetDirs.some((dir) => req.url?.startsWith(`/${dir}/`))) {
          req.url = `/@fs/${encodeURI(normalizePath(repoRoot))}${req.url}`;
        }
        next();
      });
    },
    writeBundle(options) {
      if (!options.dir) return;
      for (const dir of assetDirs) {
        cpSync(path.join(repoRoot, dir), path.join(options.dir, dir), { recursive: true });
      }
    },
  };
}

// manim-web (scenes/_manim.ts) has an optional `import('pptxgenjs')` (its slide-deck exporter) inside a try/catch. Vite
// still tries to resolve it in the pre-bundled dep and answers 500. Resolve it to a module that throws on import, so
// the library's catch path runs.
const OPTIONAL_DEPS = ['pptxgenjs'];
function optionalDeps(): Plugin {
  return {
    name: 'optional-deps',
    enforce: 'pre',
    resolveId(id) { return OPTIONAL_DEPS.includes(id) ? `\0optional:${id}` : null; },
    load(id) { return id.startsWith('\0optional:') ? `throw new Error('optional dependency ${id.slice(10)} is not installed');` : null; },
  };
}

export default defineConfig({
  root: '.',
  publicDir: 'public',
  plugins: [repoAssets(), optionalDeps()],
  // PDOOM_NO_HMR=1: no live reload (export renders must not reload mid-run when a file changes)
  server: { port: 5173, strictPort: false, hmr: process.env.PDOOM_NO_HMR ? false : undefined, fs: { allow: [repoRoot] } },
  resolve: { alias: { '@root': repoRoot } },
  build: { target: 'esnext', assetsInlineLimit: 0 },
});
