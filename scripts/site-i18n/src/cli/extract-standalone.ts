#!/usr/bin/env node
/**
 * Extract a standalone site's texts (Discover Islamic Art, Discover Baroque
 * Art, Sharing History) from the legacy database and the legacy PHP source
 * into its website's locales.
 *
 * A standalone site has no DXA registry row, so it is not one of `extract`'s
 * selectors: its labels and pages are words of `mwnf3.translation`, and some
 * of its pages are written into the PHP itself (see ../standalone.ts). The
 * output is the website layout's: one `locales/<lang>.json` per language,
 * ready to copy into the site repo.
 *
 * Usage:
 *   npm run extract:standalone -- islamicart --namespace islamicart --legacy-code /legacy --force
 *
 * Output, under --output-dir (default ./output):
 *   <site>/locales/<lang>.json   the site's own viewer-i18n entries, Markdown values
 *   <site>/data/<name>.json      rows a site lists itself (Baroque Art's sponsors)
 */

import dotenv from 'dotenv'
import { dirname, resolve, join } from 'path'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { Command } from 'commander'
import chalk from 'chalk'

import { LegacyDatabase } from '../core/database.js'
import { Logger } from '../core/logger.js'
import {
  buildStandaloneCatalogue,
  phpRegionHtml,
  siteGroups,
  siteWordIds,
  STANDALONE_SITES,
} from '../standalone.js'
import { runTables } from '../standalone-tables.js'
import { NAMESPACE_PATTERN } from '../website.js'

interface ExtractStandaloneOptions {
  namespace: string
  legacyCode: string
  outputDir: string
  force: boolean
}

dotenv.config({ path: resolve(process.cwd(), '.env') })

const program = new Command()

program
  .name('site-i18n-extract-standalone')
  .description("Extract a standalone site's texts into its website's locales")
  .argument('<site>', `One of: ${Object.keys(STANDALONE_SITES).join(', ')}`)
  .requiredOption('--namespace <ns>', "The site's viewer-i18n namespace (e.g. islamicart)")
  .requiredOption(
    '--legacy-code <path>',
    "The inventory repository's .legacy-code directory (the legacy PHP checkouts)"
  )
  .option('--output-dir <path>', 'Output directory (relative to cwd or absolute)', 'output')
  .option('--force', 'Overwrite the output directory if it already exists', false)
  .action(async (siteName: string, options: ExtractStandaloneOptions) => {
    const logger = new Logger('site-i18n')

    const site = STANDALONE_SITES[siteName]
    if (site === undefined) {
      console.error(
        chalk.red(`Unknown standalone site "${siteName}".\n`) +
          chalk.dim(`Known: ${Object.keys(STANDALONE_SITES).join(', ')}`)
      )
      process.exitCode = 1
      return
    }
    if (!NAMESPACE_PATTERN.test(options.namespace)) {
      console.error(
        chalk.red(`Invalid --namespace "${options.namespace}".\n`) +
          chalk.dim('Expected one lowercase-led word of letters and digits, no hyphens (e.g. islamicart).')
      )
      process.exitCode = 1
      return
    }

    const outputRoot = resolve(process.cwd(), options.outputDir)
    if (existsSync(outputRoot)) {
      if (!options.force) {
        console.error(
          chalk.red(`Output directory already exists: ${outputRoot}\n`) +
            chalk.dim('Pass --force to replace it.')
        )
        process.exitCode = 1
        return
      }
      rmSync(outputRoot, { recursive: true, force: true })
    }

    const siteDir = join(resolve(process.cwd(), options.legacyCode), site.root)
    if (!existsSync(siteDir)) {
      console.error(chalk.red(`Not a checkout of the legacy site: ${siteDir}`))
      process.exitCode = 1
      return
    }

    const db = new LegacyDatabase()
    try {
      // The PHP regions first: legacy's code does not change, so a region that
      // can't be read is a wrong marker, and the run stops before the database.
      const regions: Record<string, string> = {}
      for (const [entry, region] of Object.entries(site.regions ?? {})) {
        regions[entry] = phpRegionHtml(readFileSync(join(siteDir, region.file), 'utf8'), region)
      }
      logger.info(`Read ${Object.keys(regions).length} regions from the PHP source`)

      await db.connect()
      logger.info('Connected to the legacy database (read-only)')

      const rows = await db.loadDictionaryWords(siteWordIds(site), siteGroups(site))
      const tables = await runTables({
        db,
        site,
        namespace: options.namespace,
        warn: (message) => logger.warning(message),
      })
      const { locales, missingEnglish } = buildStandaloneCatalogue(
        site,
        rows,
        options.namespace,
        regions,
        tables.entries
      )

      for (const [path, data] of Object.entries(tables.files)) {
        const file = join(outputRoot, siteName, path)
        mkdirSync(dirname(file), { recursive: true })
        writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
        logger.success(`${path}: ${Array.isArray(data) ? `${data.length} rows` : 'written'}`)
      }

      const localesDir = join(outputRoot, siteName, 'locales')
      mkdirSync(localesDir, { recursive: true })
      for (const locale of Object.keys(locales)) {
        writeFileSync(
          join(localesDir, `${locale}.json`),
          `${JSON.stringify(locales[locale], null, 2)}\n`,
          'utf8'
        )
        logger.success(`${locale}.json: ${Object.keys(locales[locale]!).length} entries`)
      }
      for (const entry of missingEnglish) {
        logger.warning(`${entry}: legacy has no English text; not written`)
      }
      logger.info(`Copy ${siteName}/locales/ into the site repo as-is.`)
    } catch (error) {
      console.error(chalk.red(`Extraction failed: ${(error as Error).message}`))
      process.exitCode = 1
    } finally {
      await db.disconnect()
    }
  })

await program.parseAsync(process.argv)
