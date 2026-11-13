#!/usr/bin/env node
/**
 * Search payload exporter — @museumwnf/search-data (M15, ADR 005).
 *
 * Reads the inventory database read-only and writes the payload the global
 * search loads: one document per item a site shows (`mwnf.search/1`), the
 * slug whitelist `sites.json` and `manifest.json`. Items no site shows are
 * left out.
 *
 * Usage:
 *   npm run export -- --force
 *   npm run export -- --force --publish --base-url https://inventory.metanull.eu
 */

import dotenv from 'dotenv'
import { resolve } from 'path'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import { Command } from 'commander'
import chalk from 'chalk'

import { Database } from '../core/database.js'
import { Logger } from '../core/logger.js'
import { PublishManager, assertPublishableBaseUrl, prettyJson } from '../core/publish-manager.js'
import { buildDocuments, shardDocuments } from '../core/documents.js'
import { readInput } from '../core/reader.js'
import { PACKAGE_NAME, manifestFile, sitesFile } from '../core/package-files.js'
import { loadSites } from '../../../shared/sites.mjs'

dotenv.config({ path: resolve(process.cwd(), '.env') })

const SUBDIRECTORY = 'search'

const program = new Command()

program
  .name('search-exporter')
  .description('Search payload exporter for the global search')
  .version('1.0.0')
  .allowExcessArguments(false)
  .option('--force', 'Overwrite output directory if it already exists', false)
  .option('--output-dir <path>', 'Base output directory (relative to cwd or absolute)', 'output')
  .option('--base-url <url>', 'Base URL of the /pub picture renditions', process.env['BASE_URL'] ?? 'https://inventory.metanull.eu')
  .option('--publish', 'Stage the package, with a new version, into the data-packages checkout', false)
  .option('--data-packages <path>', 'Checkout of museumwithnofrontiers/data-packages', process.env['DATA_PACKAGES_DIR'] ?? '')
  .option('--package-version <semver>', 'Set an explicit version instead of auto-incrementing')
  .option('--npm-registry <url>', 'npm registry asked for the latest published version')
  .action(
    async (options: {
      force: boolean
      outputDir: string
      baseUrl: string
      publish: boolean
      dataPackages: string
      packageVersion?: string
      npmRegistry?: string
    }) => {
      const logger = new Logger('Exporter')
      const baseUrl = options.baseUrl.replace(/\/+$/, '')
      console.log(chalk.bold('='.repeat(70)))
      console.log(chalk.bold.cyan('MWNF SEARCH PAYLOAD EXPORTER'))
      console.log(chalk.bold('='.repeat(70)))

      const outputDir = resolve(process.cwd(), options.outputDir, SUBDIRECTORY)
      if (existsSync(outputDir)) {
        if (!options.force) {
          console.error(chalk.red(`\nOutput directory already exists: ${outputDir}\nUse --force to overwrite it.\n`))
          process.exit(1)
        }
        rmSync(outputDir, { recursive: true, force: true })
      }
      mkdirSync(resolve(outputDir, 'documents'), { recursive: true })

      const registry = options.npmRegistry || process.env['NPM_REGISTRY'] || 'https://registry.npmjs.org'
      const publishManager = new PublishManager({
        outputDir,
        dataPackagesDir: resolve(process.cwd(), options.dataPackages),
        packageName: PACKAGE_NAME,
        projectKeys: ['search'],
        logger,
        author: process.env['PACKAGE_AUTHOR'],
        license: process.env['PACKAGE_LICENSE'],
        registry,
      })
      if (options.publish) {
        try {
          assertPublishableBaseUrl(baseUrl)
          publishManager.assertDataPackagesCheckout()
        } catch (err) {
          console.error(chalk.red(`\n${err instanceof Error ? err.message : String(err)}\n`))
          process.exit(1)
        }
      }

      const db = new Database()
      try {
        await db.connect()
        logger.info('Database connected')
        const sites = loadSites()
        const input = await readInput((sql, params) => db.query(sql, params), sites, baseUrl)
        const { documents, excludedNoSite } = buildDocuments(input)
        const shards = shardDocuments(documents)
        for (const [file, content] of shards) writeFileSync(resolve(outputDir, file), content, 'utf-8')
        const sitesJson = sitesFile(sites)
        writeFileSync(resolve(outputDir, 'sites.json'), prettyJson(sitesJson), 'utf-8')
        const manifest = manifestFile(documents, shards, excludedNoSite, sitesJson.sites.length)
        writeFileSync(resolve(outputDir, 'manifest.json'), prettyJson(manifest), 'utf-8')

        console.log(chalk.green(`  ✓ ${documents.length} documents, ${excludedNoSite} items on no site left out`))
        console.log(chalk.green(`  ✓ languages: ${manifest.languages.join(', ')}`))
        console.log(chalk.green(`  ✓ ${sitesJson.sites.length} sites in sites.json`))

        if (options.publish) {
          const staged = publishManager.stage(options.packageVersion)
          console.log(
            staged.changed
              ? chalk.green(`  ✓ Staged: ${PACKAGE_NAME}@${staged.version} in ${staged.packageDir}`)
              : chalk.green(`  ✓ Unchanged: ${PACKAGE_NAME}@${staged.version} — nothing to publish`)
          )
        }
        console.log(chalk.bold.green('EXPORT COMPLETED'))
        process.exitCode = 0
      } catch (err) {
        console.error(chalk.red(`\nFatal error: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`))
        process.exitCode = 1
      } finally {
        await db.disconnect()
      }
    }
  )

program.parse()
