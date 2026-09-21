#!/usr/bin/env node
/**
 * Builds the batch plan for `docker-entrypoint.sh all` from every
 * scripts/exporters/instances/*.json file — see instances/README.md for the
 * field shapes this reads.
 *
 * Deliberately independent of each exporter's own `src/core/instance.ts`
 * (TypeScript, and only loadable through that exporter's own installed
 * `node_modules`/`tsx`): the plan only needs to know which exporter
 * directory to invoke and with what arguments, not the full per-kind
 * instance shape, and it must run with nothing installed and no database —
 * that is what lets `all --dry-run` work in CI with a bare checkout (see
 * continuous-integration.yml).
 *
 * Usage: node plan.mjs <instances-dir> [only-csv]
 *
 * On success, writes one TSV line per planned instance to stdout, sorted by
 * file name:
 *
 *   slug\texporterDir\targs (comma-joined, empty string if none)\tpackageName\tkind
 *
 * `only-csv`, if non-empty, is a comma-separated list of slugs: the plan is
 * filtered to just those, in the order given, and a name that matches
 * nothing is a hard failure — a typo in `--only` must not silently shrink
 * the batch.
 *
 * On any failure, prints one or more `error: ...` lines to stderr, each
 * naming the offending instance file, writes nothing to stdout, and exits 1
 * — the caller must not run anything.
 */

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const dir = process.argv[2]
if (!dir) {
  console.error('usage: node plan.mjs <instances-dir> [only-csv]')
  process.exit(1)
}
const onlyArg = process.argv[3] ?? ''

const KIND_EXPORTERS = {
  gallery: 'dxa-gallery',
  exhibition: 'dxa-exhibition',
}

const files = readdirSync(dir)
  .filter(f => f.endsWith('.json'))
  .sort()

const errors = []
const rows = []

for (const file of files) {
  const path = join(dir, file)

  let data
  try {
    data = JSON.parse(readFileSync(path, 'utf-8'))
  } catch (err) {
    errors.push(`${path}: invalid JSON (${err instanceof Error ? err.message : String(err)})`)
    continue
  }

  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    errors.push(`${path}: must contain a JSON object`)
    continue
  }

  const kind = data.kind
  const slug = data.slug
  const packageName = data.package_name

  if (typeof slug !== 'string' || slug.trim() === '') {
    errors.push(`${path}: "slug" must be a non-empty string`)
    continue
  }
  if (typeof packageName !== 'string' || packageName.trim() === '') {
    errors.push(`${path}: "package_name" must be a non-empty string`)
    continue
  }

  let exporterDir
  let args

  if (kind === 'gallery' || kind === 'exhibition') {
    exporterDir = KIND_EXPORTERS[kind]
    args = ['--instance', slug]
  } else if (kind === 'standalone') {
    const exporterField = data.exporter
    if (typeof exporterField !== 'string' || exporterField.trim() === '') {
      errors.push(
        `${path}: kind "standalone" requires a non-empty "exporter" field naming the exporter directory`
      )
      continue
    }
    exporterDir = exporterField
    args = []
  } else {
    errors.push(
      `${path}: unknown "kind" ${JSON.stringify(kind)} (expected "gallery", "exhibition", or "standalone")`
    )
    continue
  }

  rows.push({ file, slug, exporterDir, args, packageName, kind })
}

if (errors.length > 0) {
  for (const message of errors) {
    console.error(`error: ${message}`)
  }
  process.exit(1)
}

let selected = rows

const wanted = onlyArg
  .split(',')
  .map(s => s.trim())
  .filter(s => s.length > 0)

if (wanted.length > 0) {
  const bySlug = new Map(rows.map(r => [r.slug, r]))
  const missing = wanted.filter(w => !bySlug.has(w))
  if (missing.length > 0) {
    for (const m of missing) {
      console.error(`error: --only names '${m}', which matches no instances/*.json slug`)
    }
    process.exit(1)
  }
  selected = wanted.map(w => bySlug.get(w))
}

for (const r of selected) {
  // "-" rather than "" for a no-args instance (standalone): POSIX `read`
  // collapses adjacent tab delimiters as if they were plain whitespace, so a
  // genuinely empty field between two tabs silently swallows the next
  // column instead of parsing as empty — every field must have content.
  const argsField = r.args.length > 0 ? r.args.join(',') : '-'
  console.log([r.slug, r.exporterDir, argsField, r.packageName, r.kind].join('\t'))
}
