#!/usr/bin/env node
/**
 * Static JSON Exporter CLI — Discover Islamic Art
 *
 * Reads the inventory database and writes a set of denormalized JSON files
 * for consumption by frontend applications (the new Discover Islamic Art site).
 *
 * This exporter is single-purpose: it always exports the Discover Islamic
 * Art dataset — projects ISL (Discover Islamic Art) and EPM (Explore
 * Islamic Art Collections) together, as `@museumwnf/islamicart-data`. The
 * scope is not configurable: ISL and EPM are one dataset, and an ISL-only
 * export would silently drop the EPM project collection and every
 * `partner_group:museums:*` collection.
 *
 * Usage:
 *   npm run export -- [options]
 *
 * Examples:
 *   # Standard export
 *   npm run export -- --force
 *
 *   # Export, bump the version, generate package.json/README.md, and publish
 *   npm run export -- --force --publish
 */

import dotenv from 'dotenv'
import { resolve } from 'path'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import { Command } from 'commander'
import chalk from 'chalk'

import { Database } from '../core/database.js'
import { Logger } from '../core/logger.js'
import { PublishManager } from '../core/publish-manager.js'
import type { ExportContext } from '../core/types.js'
import {
  ManifestExporter,
  LanguageExporter,
  CountryExporter,
  DynastyExporter,
  TimelineExporter,
  PartnerExporter,
  ItemExporter,
  CollectionExporter,
  GlossaryExporter,
} from '../exporters/index.js'

dotenv.config({ path: resolve(process.cwd(), '.env') })

// Dataset identity — hardcoded on purpose. This fork exports exactly one
// dataset; there are no scope arguments to pass or get wrong. ISL and EPM
// must always be exported together (see the header comment).
const SUBDIRECTORY = 'islamicart'
const PROJECT_KEYS = ['ISL', 'EPM']
const PACKAGE_NAME = '@museumwnf/islamicart-data'

const program = new Command()

program
  .name('islamicart-exporter')
  .description('Static JSON data exporter for the Discover Islamic Art website')
  .version('1.0.0')
  .allowExcessArguments(false)
  .option('--force', 'Overwrite output directory if it already exists', false)
  .option('--output-dir <path>', 'Base output directory (relative to cwd or absolute)', 'output')
  .option(
    '--base-url <url>',
    'Base URL for media files',
    process.env['BASE_URL'] ?? './images'
  )
  .option('--publish', 'Generate npm package.json, bump version, and publish to registry', false)
  .option(
    '--package-version <semver>',
    'Set an explicit version instead of auto-incrementing (e.g. 1.0.4)'
  )
  .option(
    '--npm-registry <url>',
    'npm registry URL for publish (overrides NPM_REGISTRY env var)'
  )
  .action(
    async (options: {
      force: boolean
      outputDir: string
      baseUrl: string
      publish: boolean
      packageVersion?: string
      npmRegistry?: string
    }) => {
      const subdirectory = SUBDIRECTORY
      const projectKeys = PROJECT_KEYS
      const logger = new Logger('Exporter')

      console.log(chalk.bold('='.repeat(70)))
      console.log(chalk.bold.cyan('MWNF STATIC DATA EXPORTER'))
      console.log(chalk.bold('='.repeat(70)))
      console.log(chalk.gray(`Start time:    ${new Date().toISOString()}`))
      console.log(chalk.gray(`Project keys:  ${projectKeys.join(', ')}`))
      console.log(chalk.gray(`Subdirectory:  ${subdirectory}`))
      console.log(chalk.gray(`Force:         ${options.force ? 'YES' : 'NO'}`))
      console.log('')

      const outputBaseDir = resolve(process.cwd(), options.outputDir)
      const outputDir = resolve(outputBaseDir, subdirectory)

      // Guard: fail if output directory exists and --force not given
      if (existsSync(outputDir)) {
        if (!options.force) {
          console.error(chalk.red(`\nOutput directory already exists: ${outputDir}`))
          console.error(chalk.red('Use --force to overwrite it.\n'))
          process.exit(1)
        }
        logger.warning(`Removing existing output directory (--force): ${outputDir}`)
        rmSync(outputDir, { recursive: true, force: true })
      }

      mkdirSync(outputDir, { recursive: true })
      logger.info(`Output directory: ${outputDir}`)

      // Connect to the inventory database
      const db = new Database()

      try {
        logger.info('Connecting to database...')
        await db.connect()
        console.log(chalk.green('  ✓ Database connected'))

        // Resolve project IDs from the provided backward_compatibility keys
        logger.info(`Resolving project IDs for: ${projectKeys.join(', ')}`)
        const projectIds = await db.resolveProjectIds(projectKeys)
        console.log(chalk.green(`  ✓ Found ${projectIds.length} project(s)`))

        // Resolve context IDs — same keys, but contexts table.
        // Used to filter item_translations to only the right project context,
        // excluding explore-context translations that would otherwise overwrite.
        logger.info(`Resolving context IDs for: ${projectKeys.join(', ')}`)
        const contextIds = await db.resolveContextIds(projectKeys)
        console.log(chalk.green(`  ✓ Found ${contextIds.length} context(s)`))
        console.log('')

        const context: ExportContext = {
          db,
          outputDir,
          projectIds,
          contextIds,
          projectKeys,
          baseUrl: options.baseUrl,
          logger,
        }

        const exporters = [
          new ManifestExporter(context),
          new LanguageExporter(context),
          new CountryExporter(context),
          new DynastyExporter(context),
          new TimelineExporter(context),
          new PartnerExporter(context),
          new ItemExporter(context),
          new CollectionExporter(context),
          new GlossaryExporter(context),
        ]

        const results = []
        for (const exporter of exporters) {
          try {
            const result = await exporter.export()
            results.push({ name: exporter.getName(), ...result, error: null })
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            logger.error(`${exporter.getName()} failed: ${message}`)
            results.push({ name: exporter.getName(), file: '', count: 0, error: message })
          }
        }

        const hasErrors = results.some(r => r.error !== null)

        // Handle npm package publishing if --publish flag is set
        if (options.publish && !hasErrors) {
          console.log('')
          console.log(chalk.bold('='.repeat(70)))
          console.log(chalk.bold.cyan('PUBLISHING NPM PACKAGE'))
          console.log(chalk.bold('='.repeat(70)))

          try {
            const packageName = PACKAGE_NAME
            const registry =
              options.npmRegistry ||
              process.env['NPM_REGISTRY'] ||
              'https://registry.npmjs.org'

            // Version file lives next to the output base dir, NOT inside the project
            // output directory, so it survives --force cleans.
            const versionFile = resolve(outputBaseDir, `.version-${subdirectory}`)

            const publishManager = new PublishManager({
              outputDir,
              versionFile,
              packageName,
              projectKeys,
              logger,
              author: process.env['PACKAGE_AUTHOR'],
              license: process.env['PACKAGE_LICENSE'],
              repositoryUrl: process.env['PACKAGE_REPO_URL'],
              registry,
            })

            const nextVersion = options.packageVersion
              ? publishManager.setVersion(options.packageVersion)
              : publishManager.getNextVersion()
            console.log(chalk.green(`  ✓ Version: ${nextVersion}`))

            const packageJson = publishManager.generatePackageJson(nextVersion)
            const packageJsonPath = resolve(outputDir, 'package.json')
            writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf-8')
            console.log(chalk.green(`  ✓ Generated: package.json`))

            const readmePath = resolve(outputDir, 'README.md')
            const readmeContent = publishManager.generateReadme(packageName)
            writeFileSync(readmePath, readmeContent, 'utf-8')
            console.log(chalk.green(`  ✓ Generated: README.md`))

            publishManager.writeLicense()
            console.log(chalk.green(`  ✓ Generated: LICENSE.md`))

            console.log('')
            publishManager.publish()
            console.log(chalk.green(`  ✓ Published: ${packageName}@${nextVersion}`))
            console.log('')
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            console.error(chalk.red(`\nPublish failed: ${message}`))
            process.exit(1)
          }
        }

        console.log('')
        console.log(chalk.bold('='.repeat(70)))
        if (hasErrors) {
          console.log(chalk.bold.red('EXPORT COMPLETED WITH ERRORS'))
        } else {
          console.log(chalk.bold.green('EXPORT COMPLETED'))
        }
        console.log(chalk.gray(`End time: ${new Date().toISOString()}`))
        console.log(chalk.gray(`Output:   ${outputDir}`))
        console.log('')

        for (const r of results) {
          if (r.error) {
            console.log(chalk.red(`  ✗ ${r.name}: ${r.error}`))
          } else {
            console.log(chalk.green(`  ✓ ${r.file} (${r.count})`))
          }
        }

        console.log(chalk.bold('='.repeat(70)))

        process.exit(hasErrors ? 1 : 0)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error(chalk.red(`\nFatal error: ${message}`))
        if (err instanceof Error && err.stack) {
          console.error(chalk.gray(err.stack))
        }
        process.exit(1)
      } finally {
        await db.disconnect()
      }
    }
  )

program.parse()
