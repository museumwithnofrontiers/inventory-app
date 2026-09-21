#!/usr/bin/env node
/**
 * Static JSON Exporter CLI — The Use of Colours in Art
 *
 * Reads the inventory database and writes the data package that replaces the
 * legacy `exhibitions.museumwnf.org/the_use_of_colours_in_art` API instance
 * (`@museumwnf/the-use-of-colours-in-art-data`).
 *
 * This exporter is single-purpose: it always exports thematic gallery 47. The
 * scope is not configurable — legacy pinned it in a per-deployment `.env`
 * (DXA_CONSTRAINT_GALLERY_ID=47) and there is nothing to pass or get wrong here
 * either.
 *
 * It is a fork of `scripts/exporters/carpets` (the reference gallery
 * implementation) with the exhibition layer added: `exhibition.json` replaces
 * `gallery.json`, and `themes.json` + `related_content.json` are new. An
 * exhibition is a superset of a gallery, so everything else — the membership
 * union, tags, partners, glossary, countries, languages, the worldwide timeline
 * — behaves identically and the scoping rules are inherited rather than
 * re-derived.
 *
 * Colours is the BORROWED case taken to its limit: only 24 of its 171 members
 * are its own EXHCOLOUR records, the other 147 coming from AWE, BAR, EPM, ISL,
 * DCA, GALLERIES and DGA. The per-item project key and per-item translation
 * context therefore matter on nearly every record, not just at the margins.
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
  ExhibitionExporter,
  ThemeExporter,
  RelatedContentExporter,
  LanguageExporter,
  CountryExporter,
  TagExporter,
  DynastyExporter,
  TimelineExporter,
  PartnerExporter,
  ItemExporter,
  GlossaryExporter,
} from '../exporters/index.js'

dotenv.config({ path: resolve(process.cwd(), '.env') })

// Site identity — hardcoded on purpose, see the header comment. The folder and
// package name are the kebab-cased legacy slug (decision Q4); the underscore
// form stays in the data as legacy identity.
const SUBDIRECTORY = 'the-use-of-colours-in-art'
const EXHIBITION_BACKWARD_COMPATIBILITY = 'mwnf3_thematic_gallery:thg_gallery:47'
const PACKAGE_NAME = '@museumwnf/the-use-of-colours-in-art-data'

const program = new Command()

program
  .name('the-use-of-colours-in-art-exporter')
  .description('Static JSON data exporter for The Use of Colours in Art exhibition website')
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
      console.log(chalk.bold.cyan('MWNF STATIC DATA EXPORTER — THE USE OF COLOURS IN ART'))
      console.log(chalk.bold('='.repeat(70)))
      console.log(chalk.gray(`Start time:    ${new Date().toISOString()}`))
      console.log(chalk.gray(`Exhibition:    ${EXHIBITION_BACKWARD_COMPATIBILITY}`))
      console.log(chalk.gray(`Subdirectory:  ${SUBDIRECTORY}`))
      console.log(chalk.gray(`Force:         ${options.force ? 'YES' : 'NO'}`))
      console.log('')

      const outputBaseDir = resolve(process.cwd(), options.outputDir)
      const outputDir = resolve(outputBaseDir, SUBDIRECTORY)

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

      // Preflight for --publish: confirm the npm session is alive before
      // spending minutes on the export below. A dead session would otherwise
      // only surface at the very end, as a registry 404 right after export.
      // The exhibition (and its real projectKeys) isn't resolved yet, so this
      // preflight-only instance uses a placeholder — assertLoggedIn() does
      // not use projectKeys.
      if (options.publish) {
        const registry =
          options.npmRegistry || process.env['NPM_REGISTRY'] || 'https://registry.npmjs.org'
        const preflight = new PublishManager({
          outputDir,
          versionFile: resolve(outputBaseDir, `.version-${SUBDIRECTORY}`),
          packageName: PACKAGE_NAME,
          projectKeys: [SUBDIRECTORY],
          logger,
          registry,
        })
        try {
          preflight.assertLoggedIn()
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

        logger.info(`Resolving exhibition ${EXHIBITION_BACKWARD_COMPATIBILITY}...`)
        const exhibition = await db.resolveExhibition(EXHIBITION_BACKWARD_COMPATIBILITY)
        console.log(
          chalk.green(
            `  ✓ Exhibition: ${exhibition.slug ?? exhibition.id} ` +
              `(project ${exhibition.mwnf3ProjectId ?? '—'})`
          )
        )

        logger.info('Resolving the curated theme tree...')
        const themes = await db.resolveThemes(exhibition.id)
        const topLevelThemes = themes.filter(theme => theme.parentId === exhibition.id).length
        console.log(
          chalk.green(
            `  ✓ ${topLevelThemes} themes + ${themes.length - topLevelThemes} sub-themes`
          )
        )

        logger.info('Resolving the membership union...')
        const members = await db.resolveMembers(exhibition.id)
        if (members.length === 0) {
          throw new Error(
            `Exhibition ${EXHIBITION_BACKWARD_COMPATIBILITY} has no member items. ` +
              `The importer materializes the membership union in collection_item — ` +
              `check that phase 10 ran against this database.`
          )
        }
        console.log(chalk.green(`  ✓ ${members.length} member items`))

        const { projectKeys, ownContextIds } = await db.resolveItemProjects(members)
        // Printed with counts, not just names: on an exhibition whose members
        // are overwhelmingly borrowed, the split between native and borrowed is
        // the single number that says whether the membership union was resolved
        // correctly, and it is worth seeing on every run rather than only in a
        // validation pass.
        const perProject = new Map<string, number>()
        for (const key of projectKeys.values()) {
          perProject.set(key, (perProject.get(key) ?? 0) + 1)
        }
        const breakdown = [...perProject.entries()]
          .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
          .map(([key, count]) => `${key} ${count}`)
          .join(', ')
        console.log(chalk.green(`  ✓ Source projects: ${breakdown || '—'}`))
        console.log('')

        const context: ExportContext = {
          db,
          outputDir,
          exhibition,
          themes,
          memberItemIds: members.map(m => m.item_id),
          itemOwnContextIds: ownContextIds,
          baseUrl: options.baseUrl,
          logger,
        }

        const exporters = [
          new ManifestExporter(context),
          new ExhibitionExporter(context),
          new ThemeExporter(context),
          new RelatedContentExporter(context),
          new LanguageExporter(context),
          new CountryExporter(context),
          new TagExporter(context),
          new DynastyExporter(context),
          new TimelineExporter(context),
          new PartnerExporter(context),
          new ItemExporter(context),
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

        if (options.publish && !hasErrors) {
          console.log('')
          console.log(chalk.bold('='.repeat(70)))
          console.log(chalk.bold.cyan('PUBLISHING NPM PACKAGE'))
          console.log(chalk.bold('='.repeat(70)))

          try {
            const registry =
              options.npmRegistry || process.env['NPM_REGISTRY'] || 'https://registry.npmjs.org'

            // Version file lives next to the output base dir, NOT inside the
            // project output directory, so it survives --force cleans.
            const versionFile = resolve(outputBaseDir, `.version-${SUBDIRECTORY}`)

            const publishManager = new PublishManager({
              outputDir,
              versionFile,
              packageName: PACKAGE_NAME,
              projectKeys: [exhibition.slug ?? SUBDIRECTORY],
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
            writeFileSync(
              resolve(outputDir, 'package.json'),
              JSON.stringify(packageJson, null, 2),
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
