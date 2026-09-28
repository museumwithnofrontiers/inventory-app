#!/usr/bin/env node
/**
 * Extract Explore's texts from the legacy database into its website's locales.
 *
 * Explore has no DXA registry row, so it is not one of `extract`'s selectors:
 * its six pages come from `mwnf3_explore` (see ../explore.ts). The output is
 * the website layout's: one `locales/<lang>.json` per language, ready to copy
 * into the site repo for its texts PR.
 *
 * Usage:
 *   npm run extract:explore -- --namespace explore --force
 *
 * Output, under --output-dir (default ./output):
 *   explore/locales/<lang>.json   the site's own viewer-i18n entries, Markdown values
 */

import dotenv from 'dotenv'
import { resolve, join } from 'path'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import { Command } from 'commander'
import chalk from 'chalk'

import { LegacyDatabase } from '../core/database.js'
import { Logger } from '../core/logger.js'
import { buildExploreCatalogue, EXPLORE_HOME_WORDS } from '../explore.js'
import { NAMESPACE_PATTERN } from '../website.js'

dotenv.config({ path: resolve(process.cwd(), '.env') })

const program = new Command()

program
  .name('site-i18n-extract-explore')
  .description("Extract Explore's text pages into its website's locales")
  .requiredOption('--namespace <ns>', "The site's viewer-i18n namespace (e.g. explore)")
  .option('--output-dir <path>', 'Output directory (relative to cwd or absolute)', 'output')
  .option('--force', 'Overwrite the output directory if it already exists', false)
  .action(async (options: { namespace: string; outputDir: string; force: boolean }) => {
    const logger = new Logger('site-i18n')

    if (!NAMESPACE_PATTERN.test(options.namespace)) {
      console.error(
        chalk.red(`Invalid --namespace "${options.namespace}".\n`) +
          chalk.dim('Expected one lowercase-led word of letters and digits, no hyphens (e.g. explore).')
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

    const db = new LegacyDatabase()
    try {
      await db.connect()
      logger.info('Connected to the legacy database (read-only)')

      const pages = await db.loadExplorePages()
      const words = await db.loadExploreWords(Object.keys(EXPLORE_HOME_WORDS))
      const { locales, notEmitted } = buildExploreCatalogue(pages, words, options.namespace)

      const localesDir = join(outputRoot, 'explore', 'locales')
      mkdirSync(localesDir, { recursive: true })
      for (const locale of Object.keys(locales)) {
        writeFileSync(
          join(localesDir, `${locale}.json`),
          `${JSON.stringify(locales[locale], null, 2)}\n`,
          'utf8'
        )
        logger.success(`${locale}.json: ${Object.keys(locales[locale]!).length} entries`)
      }
      for (const pagename of notEmitted) {
        logger.warning(`Page "${pagename}" has a text but no section: not written`)
      }
      logger.info('Copy explore/locales/ into the site repo as-is.')
    } catch (error) {
      console.error(chalk.red(`Extraction failed: ${(error as Error).message}`))
      process.exitCode = 1
    } finally {
      await db.disconnect()
    }
  })

await program.parseAsync(process.argv)
