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
//   2. @museumwnf/amulets-data — the published package. This is what `npm
//      install` brings in, and what CI and the deploy workflow build against.
//   3. ../../exporters/amulets/output/amulets — a local exporter run, for
//      working against data that has not been published yet:
//
//        docker compose --profile jobs run --rm exporter amulets --force \
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

  const published = asPackage('@museumwnf/amulets-data')
  if (published) return published

  const local = asDirectory('../../exporters/amulets/output/amulets')
  if (local) return local

  throw new Error(
    'No Amulets data package found.\n' +
    '\n' +
    'This viewer reads @museumwnf/amulets-data when it is installed, and falls\n' +
    'back to the exporter output at scripts/exporters/amulets/output/amulets.\n' +
    'Neither is present. Produce the local export with:\n' +
    '\n' +
    '  docker compose --profile jobs run --rm exporter amulets --force \\\n' +
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
