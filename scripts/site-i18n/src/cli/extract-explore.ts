#!/usr/bin/env node
/**
 * Extract Explore's texts from the legacy database and the legacy client's
 * source into its website's locales.
 *
 * Explore has no DXA registry row, so it is not one of `extract`'s selectors:
 * its six pages and its dictionary labels come from `mwnf3_explore`, its other
 * labels from the live client's templates (see ../explore.ts). The output is
 * the website layout's: one `locales/<lang>.json` per language, ready to copy
 * into the site repo for its texts PR.
 *
 * Usage:
 *   npm run extract:explore -- --namespace explore --client /legacy/explore-client --force
 *
 * Output, under --output-dir (default ./output):
 *   explore/locales/<lang>.json   the site's own viewer-i18n entries, Markdown values
 */

import dotenv from 'dotenv'
import { resolve, join } from 'path'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { Command } from 'commander'
import chalk from 'chalk'

import { LegacyDatabase } from '../core/database.js'
import { Logger } from '../core/logger.js'
import { elementText, parseTemplate, selectElement } from '../core/vue-template.js'
import {
  buildExploreCatalogue,
  EXPLORE_CLIENT_LABELS,
  EXPLORE_DICTIONARY_GROUP,
  EXPLORE_HOME_WORDS,
  EXPLORE_LABEL_WORDS,
} from '../explore.js'
import { NAMESPACE_PATTERN } from '../website.js'

interface ExtractExploreOptions {
  namespace: string
  client: string
  outputDir: string
  force: boolean
}

/**
 * Reads every client label out of the client's checkout. A label that can't be
 * read fails the run: legacy's code does not change, so a failure is a wrong
 * locator, never a label to skip.
 */
function readClientLabels(clientDir: string): Record<string, string> {
  const templates = new Map<string, ReturnType<typeof parseTemplate>>()
  const labels: Record<string, string> = {}
  for (const [entry, label] of Object.entries(EXPLORE_CLIENT_LABELS)) {
    let template = templates.get(label.file)
    if (template === undefined) {
      const path = join(clientDir, label.file)
      template = parseTemplate(readFileSync(path, 'utf8'), label.file)
      templates.set(label.file, template)
    }
    try {
      labels[entry] = elementText(selectElement(template, label.selector), label.options)
    } catch (error) {
      throw new Error(`${entry} (${label.file}): ${(error as Error).message}`, {
        cause: error,
      })
    }
  }
  return labels
}

dotenv.config({ path: resolve(process.cwd(), '.env') })

const program = new Command()

program
  .name('site-i18n-extract-explore')
  .description("Extract Explore's text pages into its website's locales")
  .requiredOption('--namespace <ns>', "The site's viewer-i18n namespace (e.g. explore)")
  .requiredOption(
    '--client <path>',
    "A checkout of legacy's Explore client (bitbucket.org/mwnf/explore-client)"
  )
  .option('--output-dir <path>', 'Output directory (relative to cwd or absolute)', 'output')
  .option('--force', 'Overwrite the output directory if it already exists', false)
  .action(async (options: ExtractExploreOptions) => {
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

    const clientDir = resolve(process.cwd(), options.client)
    if (!existsSync(join(clientDir, 'src'))) {
      console.error(chalk.red(`Not a checkout of the Explore client: ${clientDir}`))
      process.exitCode = 1
      return
    }

    const db = new LegacyDatabase()
    try {
      const clientLabels = readClientLabels(clientDir)
      logger.info(`Read ${Object.keys(clientLabels).length} labels from the client's templates`)

      await db.connect()
      logger.info('Connected to the legacy database (read-only)')

      const pages = await db.loadExplorePages()
      const words = await db.loadExploreWords(
        [...Object.keys(EXPLORE_HOME_WORDS), ...Object.keys(EXPLORE_LABEL_WORDS)],
        EXPLORE_DICTIONARY_GROUP
      )
      const { locales, notEmitted } = buildExploreCatalogue(
        pages,
        words,
        options.namespace,
        clientLabels
      )

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
