import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { createRequire } from 'module'
import { existsSync } from 'fs'
import { dirname, isAbsolute, resolve } from 'path'
import { fileURLToPath } from 'url'

const here = dirname(fileURLToPath(import.meta.url))

// The data package is resolved at build time, in this order:
//
//   1. DATA_PACKAGE — an npm package name *or* a directory path. Explicit wins.
//   2. @museumwnf/water-in-islam-data — the published package. This
//      is what `npm install` brings in, and what CI and the deploy workflow
//      build against.
//   3. ../../exporters/dxa-exhibition/output/water-in-islam
//      — a local exporter run, for working against data that has not been
//      published yet:
//
//        docker compose --profile jobs run --rm \
//            exporter dxa-exhibition --instance water-in-islam --force \
//            --base-url https://inventory.metanull.eu
//
//      from the repository root.
//
// See README.md § "Where the data comes from".
function resolveDataPackage() {
  const explicit = process.env.DATA_PACKAGE
  const require = createRequire(import.meta.url)

  const asPackage = (name) => {
    try {
      return dirname(require.resolve(`${name}/package.json`))
    } catch {
      return null
    }
  }

  const asDirectory = (p) => {
    const abs = isAbsolute(p) ? p : resolve(here, p)
    return existsSync(resolve(abs, 'manifest.json')) ? abs : null
  }

  if (explicit) {
    const found = asPackage(explicit) ?? asDirectory(explicit)
    if (found) return found
    throw new Error(
      `DATA_PACKAGE="${explicit}" is neither an installed package nor a ` +
      `directory containing manifest.json.`
    )
  }

  const published = asPackage('@museumwnf/water-in-islam-data')
  if (published) return published

  const local = asDirectory(
    '../../exporters/dxa-exhibition/output/water-in-islam'
  )
  if (local) return local

  throw new Error(
    'No Water in Islam data package found.\n' +
    '\n' +
    'This viewer reads @museumwnf/water-in-islam-data when it is\n' +
    'installed, and falls back to the exporter output at\n' +
    'scripts/exporters/dxa-exhibition/output/water-in-islam.\n' +
    'Neither is present. Produce the local export with:\n' +
    '\n' +
    '  docker compose --profile jobs run --rm \\\n' +
    '      exporter dxa-exhibition --instance water-in-islam --force \\\n' +
    '      --base-url https://inventory.metanull.eu\n' +
    '\n' +
    'or point DATA_PACKAGE at a package name or directory.'
  )
}

export default defineConfig(() => ({
  plugins: [vue()],
  resolve: {
    alias: { '@inventory-data': resolveDataPackage() },
  },
}))
