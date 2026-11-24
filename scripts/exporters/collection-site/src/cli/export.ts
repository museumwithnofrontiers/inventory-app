#!/usr/bin/env node
/**
 * Exports one collection site's package (inventory-app#2727).
 *
 *   npm run export -- --instance examples/the-hijaz-railway.json --base-url https://inventory.metanull.eu
 *
 * Reads the inventory database named by DB_* (read-only) and writes the
 * package into --output (default: output/<slug>). It doesn't publish:
 * publishing a collection site's package is a later step of the story.
 */
import 'dotenv/config'
import { resolve } from 'node:path'
import { Command } from 'commander'
import mysql from 'mysql2/promise'
import { exportCollectionSite } from '../core/export.js'
import type { Query } from '../core/export.js'
import { loadInstance } from '../core/instance.js'

const program = new Command()
  .name('collection-site-export')
  .requiredOption('--instance <path>', 'the instance file (kind "collection")')
  .option('--output <dir>', 'where the package is written (default: output/<slug>)')
  .option('--base-url <url>', 'the inventory address image URLs start with', process.env['BASE_URL'])
  .option('--package-version <version>', 'the version written into the manifest', '0.0.0-local')
  .parse()

const options = program.opts<{ instance: string; output?: string; baseUrl?: string; packageVersion: string }>()

async function main(): Promise<void> {
  const instance = loadInstance(resolve(options.instance))
  if (!options.baseUrl || !/^https?:\/\/[^/]+$/.test(options.baseUrl)) {
    throw new Error('--base-url (or BASE_URL) must be an http(s) origin with no trailing slash')
  }
  const connection = await mysql.createConnection({
    host: process.env['DB_HOST'] ?? 'localhost',
    port: parseInt(process.env['DB_PORT'] ?? '3306', 10),
    user: process.env['DB_USERNAME'] ?? 'root',
    password: process.env['DB_PASSWORD'] ?? '',
    database: process.env['DB_DATABASE'] ?? 'inventory',
    supportBigNumbers: true,
    dateStrings: true,
  })
  const query: Query = async <T>(sql: string, params: unknown[] = []) => {
    const [rows] = await connection.query(sql, params)
    return rows as T[]
  }
  try {
    const outputDir = resolve(options.output ?? `output/${instance.slug}`)
    const summary = await exportCollectionSite(query, instance, {
      outputDir,
      baseUrl: options.baseUrl,
      version: options.packageVersion,
      log: line => console.log(`  ${line}`),
    })
    console.log(
      `${instance.slug}: ${summary.files} files in ${outputDir} — ${summary.collections} collections, ` +
        `${summary.placements} placements, ${summary.members} members, ${summary.items} items, ` +
        `${summary.partners} partners; languages ${summary.languages.join(', ')}`
    )
  } finally {
    await connection.end()
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
