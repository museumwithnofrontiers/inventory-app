#!/usr/bin/env node
/**
 * Static JSON Exporter CLI — DXA exhibition
 *
 * Reads the inventory database and writes the data package for one DXA
 * exhibition website. Which exhibition is not hardcoded: it is read from an
 * `--instance <name|path>` file (`src/core/instance.ts`), so the same built
 * exporter serves every DXA exhibition site rather than one fork per site.
 *
 * Instance files live in `scripts/exporters/instances/` next to every
 * exporter package — see `../instances/README.md` for the format and how to
 * add one. `--instance <name>` looks up `../instances/<name>.json`; a value
 * containing a path separator or ending in `.json` is read from that path
 * instead (useful for a one-off or test fixture).
 *
 * An exhibition is a superset of a gallery: it adds a curated theme tree
 * (`themes.json`, `related_content.json` on top of `exhibition.json`) over
 * everything a gallery already exports — the membership union, tags,
 * partners, glossary, countries, languages, the worldwide timeline — which
 * behaves identically and is inherited rather than re-derived. See
 * `scripts/exporters/dxa-gallery` for the gallery-only layer and
 * `scripts/exporters/docs/dxa-exhibition-data-package.md` for the full
 * package specification.
 *
 * Usage:
 *   npm run export -- --instance <name|path> [options]
 *
 * Examples:
 *   # Standard export
 *   npm run export -- --instance <site-slug> --force
 *
 *   # Export, bump the version, generate package.json/README.md, and publish
 *   npm run export -- --instance <site-slug> --force --publish
 */

import dotenv from 'dotenv'
import { resolve } from 'path'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import { Command } from 'commander'
import chalk from 'chalk'

import { Database } from '../core/database.js'
import { Logger } from '../core/logger.js'
import { PublishManager } from '../core/publish-manager.js'
import { loadInstance } from '../core/instance.js'
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

const program = new Command()

program
  .name('dxa-exhibition-exporter')
  .description('Static JSON data exporter for any DXA exhibition website, driven by an instance file')
  .version('1.0.0')
  .allowExcessArguments(false)
  .requiredOption('--instance <name|path>', 'Instance file name (in ../instances/) or path')
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
      instance: string
      force: boolean
      outputDir: string
      baseUrl: string
      publish: boolean
      packageVersion?: string
      npmRegistry?: string
    }) => {
      const logger = new Logger('Exporter')

      const instance = loadInstance(options.instance)

      console.log(chalk.bold('='.repeat(70)))
      console.log(chalk.bold.cyan('MWNF STATIC DATA EXPORTER — ' + instance.name.toUpperCase()))
      console.log(chalk.bold('='.repeat(70)))
      console.log(chalk.gray(`Start time:    ${new Date().toISOString()}`))
      console.log(chalk.gray(`Exhibition:    ${instance.collectionId}`))
      console.log(chalk.gray(`Subdirectory:  ${instance.slug}`))
      console.log(chalk.gray(`Force:         ${options.force ? 'YES' : 'NO'}`))
      console.log('')

      const outputBaseDir = resolve(process.cwd(), options.outputDir)
      const outputDir = resolve(outputBaseDir, instance.slug)

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
          versionFile: resolve(outputBaseDir, `.version-${instance.slug}`),
          packageName: instance.packageName,
          projectKeys: [instance.slug],
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

        logger.info(`Resolving exhibition ${instance.collectionId}...`)
        const exhibition = await db.resolveExhibition(instance.collectionId)
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
            `Exhibition ${instance.collectionId} has no member items. ` +
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
          siteKey: instance.slug,
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
            const versionFile = resolve(outputBaseDir, `.version-${instance.slug}`)

            const publishManager = new PublishManager({
              outputDir,
              versionFile,
              packageName: instance.packageName,
              projectKeys: [exhibition.slug ?? instance.slug],
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
              publishManager.generateReadme(instance.packageName),
              'utf-8'
            )
            console.log(chalk.green('  ✓ Generated: README.md'))

            publishManager.writeLicense()
            console.log(chalk.green('  ✓ Generated: LICENSE.md'))

            console.log('')
            publishManager.publish()
            publishManager.recordPublished(nextVersion)
            console.log(chalk.green(`  ✓ Published: ${instance.packageName}@${nextVersion}`))
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
