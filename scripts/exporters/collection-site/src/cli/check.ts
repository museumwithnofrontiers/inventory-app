#!/usr/bin/env node
/**
 * Checks an exported collection-site package for what an exhibition website
 * needs (src/core/readiness.ts), and writes the findings next to it.
 *
 *   npm run check -- output/<slug> [--languages eng,fra]
 *
 * --languages names the site's language builds (inventory language ids).
 * Without it, the site's languages are those its root collection has a title in.
 */
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadPackage } from '../core/package.js'
import { checkReadiness } from '../core/readiness.js'

const args = process.argv.slice(2)
const flag = args.indexOf('--languages')
const languages = flag >= 0 ? (args[flag + 1] ?? '').split(',').filter(Boolean) : undefined
const dir = resolve(args.find((a, i) => !a.startsWith('--') && i !== flag + 1) ?? '')
const readiness = checkReadiness(loadPackage(dir), languages)
writeFileSync(`${dir}.readiness.json`, JSON.stringify(readiness, null, 2) + '\n')

console.log(`${dir}: languages ${readiness.languages.join(', ') || '(none)'}; ${JSON.stringify(readiness.counts)}`)
console.log(`  member texts by context: ${JSON.stringify(readiness.textContexts)}`)
for (const f of readiness.findings) {
  console.log(`  ${f.severity.padEnd(7)} ${f.code.padEnd(19)} ${String(f.ids.length).padStart(4)}  ${f.message}`)
}
if (readiness.findings.length === 0) console.log('  no findings')
