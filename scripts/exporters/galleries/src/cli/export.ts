#!/usr/bin/env node
/**
 * Static JSON Exporter CLI — Galleries hub
 *
 * Reads the inventory database and writes `@museumwnf/galleries-data`, the
 * package behind the galleries hub that replaces galleries.museumwnf.org:
 * every gallery the hub lists, and its partner directory. It exports no items,
 * no item sheets and no timeline (Pascal, 2026-09-28; specification in
 * `scripts/exporters/docs/galleries-hub-data-package.md`).
 *
 * Usage:
 *   npm run export -- [--force] [--publish] [--base-url <url>]
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
  GalleriesExporter,
  LanguageExporter,
  CountryExporter,
  PartnerExporter,
} from '../exporters/index.js'

dotenv.config({ path: resolve(process.cwd(), '.env') })

// Dataset identity — hardcoded on purpose, as in every standalone exporter:
// this exporter makes exactly one package, so there is no scope argument to
// pass or get wrong.
//  - The hub's own collection is legacy gallery 45, which dxa-api served the
//    hub as. Its name, languages and i18n groups are the hub's.
//  - The partner directory is the museums of the GALLERIES project, legacy's
//    own hub partner list.
const SITE_KEY = 'galleries'
const PACKAGE_NAME = '@museumwnf/galleries-data'
const HUB_COLLECTION = 'mwnf3_thematic_gallery:thg_gallery:45'
const PARTNER_PROJECT = 'mwnf3:projects:GALLERIES'

const program = new Command()

program
  .name('galleries-hub-exporter')
  .description('Static JSON data exporter for the galleries hub website')
  .version('1.0.0')
  .allowExcessArguments(false)
  .option('--force', 'Overwrite output directory if it already exists', false)
  .option('--output-dir <path>', 'Base output directory (relative to cwd or absolute)', 'output')
  .option('--base-url <url>', 'Base URL for media files', process.env['BASE_URL'] ?? './images')
  .option('--publish', 'Generate npm package.json, bump version, and publish to registry', false)
  .option(
    '--package-version <semver>',
    'Set an explicit version instead of auto-incrementing (e.g. 1.0.4)'
  )
  .option('--npm-registry <url>', 'npm registry URL for publish (overrides NPM_REGISTRY env var)')
  .action(
    async (options: {
      force: boolean
      outputDir: string
      baseUrl: string
      publish: boolean
      packageVersion?: string
      npmRegistry?: string
    }) => {
      const logger = new Logger('Exporter')

      console.log(chalk.bold('='.repeat(70)))
      console.log(chalk.bold.cyan('MWNF STATIC DATA EXPORTER — GALLERIES HUB'))
      console.log(chalk.bold('='.repeat(70)))
      console.log(chalk.gray(`Start time:    ${new Date().toISOString()}`))
      console.log(chalk.gray(`Hub:           ${HUB_COLLECTION}`))
      console.log(chalk.gray(`Partners of:   ${PARTNER_PROJECT}`))
      console.log(chalk.gray(`Force:         ${options.force ? 'YES' : 'NO'}`))
      console.log('')

      const outputBaseDir = resolve(process.cwd(), options.outputDir)
      const outputDir = resolve(outputBaseDir, SITE_KEY)
      const versionFile = resolve(outputBaseDir, `.version-${SITE_KEY}`)
      const registry =
        options.npmRegistry || process.env['NPM_REGISTRY'] || 'https://registry.npmjs.org'

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

      const publishManager = new PublishManager({
        outputDir,
        versionFile,
        packageName: PACKAGE_NAME,
        projectKeys: [SITE_KEY],
        logger,
        author: process.env['PACKAGE_AUTHOR'],
        license: process.env['PACKAGE_LICENSE'],
        repositoryUrl: process.env['PACKAGE_REPO_URL'],
        registry,
      })

      // Preflight for --publish: confirm the npm session is alive before
      // spending time on the export, rather than finding out at the end.
      if (options.publish) {
        try {
          publishManager.assertLoggedIn()
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          console.error(chalk.red(`\n${message}\n`))
          process.exit(1)
        }
      }

      const db = new Database()

      try {
        logger.info('Connecting to database...')
        await db.connect()
        console.log(chalk.green('  ✓ Database connected'))

        const hub = await db.resolveHub(HUB_COLLECTION)
        const partnerProjectId = await db.resolveProjectId(PARTNER_PROJECT)
        console.log(chalk.green(`  ✓ Hub collection ${hub.id}, partner project ${partnerProjectId}`))
        console.log('')

        const context: ExportContext = {
          db,
          outputDir,
          hub,
          siteKey: SITE_KEY,
          partnerProjectId,
          baseUrl: options.baseUrl,
          logger,
        }

        const exporters = [
          new ManifestExporter(context),
          new GalleriesExporter(context),
          new LanguageExporter(context),
          new CountryExporter(context),
          new PartnerExporter(context),
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

        if (options.publish && !hasErrors) {
          console.log('')
          console.log(chalk.bold('='.repeat(70)))
          console.log(chalk.bold.cyan('PUBLISHING NPM PACKAGE'))
          console.log(chalk.bold('='.repeat(70)))

          try {
            const nextVersion = options.packageVersion
              ? publishManager.setVersion(options.packageVersion)
              : publishManager.getNextVersion()
            console.log(chalk.green(`  ✓ Version: ${nextVersion}`))

            writeFileSync(
              resolve(outputDir, 'package.json'),
              JSON.stringify(publishManager.generatePackageJson(nextVersion), null, 2),
              'utf-8'
            )
            console.log(chalk.green('  ✓ Generated: package.json'))

            writeFileSync(
              resolve(outputDir, 'README.md'),
              publishManager.generateReadme(PACKAGE_NAME),
              'utf-8'
            )
            console.log(chalk.green('  ✓ Generated: README.md'))

            publishManager.writeLicense()
            console.log(chalk.green('  ✓ Generated: LICENSE.md'))

            console.log('')
            publishManager.publish()
            publishManager.recordPublished(nextVersion)
            console.log(chalk.green(`  ✓ Published: ${PACKAGE_NAME}@${nextVersion}`))
            console.log('')
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            console.error(chalk.red(`\nPublish failed: ${message}`))
            process.exit(1)
          }
        }

        console.log('')
        console.log(chalk.bold('='.repeat(70)))
        console.log(
          hasErrors
            ? chalk.bold.red('EXPORT COMPLETED WITH ERRORS')
            : chalk.bold.green('EXPORT COMPLETED')
        )
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
