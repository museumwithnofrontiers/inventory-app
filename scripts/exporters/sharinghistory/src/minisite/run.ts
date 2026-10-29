import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import chalk from 'chalk'
import { Database } from '../core/database.js'
import { Logger } from '../core/logger.js'
import { PublishManager, assertPublishableBaseUrl } from '../core/publish-manager.js'
import type { ExportContext } from '../core/types.js'
import {
  CollectionExporter,
  CountryExporter,
  GlossaryExporter,
  ItemExporter,
  LanguageExporter,
  ManifestExporter,
  PartnerExporter,
} from '../exporters/index.js'
import { loadMinisiteInstance } from './instance.js'
import { resolveScope } from './scope.js'

export interface MinisiteOptions {
  force: boolean
  outputDir: string
  baseUrl: string
  publish: boolean
  packageVersion?: string
  npmRegistry?: string
}

/**
 * `--minisite <slug>`: export (and with --publish, publish) one mini-site's
 * package from the database: the sharinghistory exporters, each narrowed to
 * the mini-site's scope (src/minisite/scope.ts), in the same shapes.
 * Timelines are left out: an exhibition's pages link to the parent site's
 * timelines rather than show them.
 */
export async function runMinisite(ref: string, options: MinisiteOptions, projectKeys: string[]): Promise<void> {
  const logger = new Logger('Minisite')
  const instance = loadMinisiteInstance(ref)
  const outputBaseDir = resolve(process.cwd(), options.outputDir)
  const outputDir = resolve(outputBaseDir, instance.slug)
  const registry = options.npmRegistry || process.env['NPM_REGISTRY'] || 'https://registry.npmjs.org'
  const versionFile = resolve(outputBaseDir, `.version-${instance.slug}`)

  console.log(chalk.bold.cyan(`MINI-SITE ${instance.slug}`) + chalk.gray(` — collection ${instance.collectionId}`))
  if (existsSync(outputDir)) {
    if (!options.force) throw new Error(`Output directory already exists: ${outputDir} (use --force)`)
    rmSync(outputDir, { recursive: true, force: true })
  }
  mkdirSync(outputDir, { recursive: true })

  const publishManager = new PublishManager({
    outputDir,
    versionFile,
    packageName: instance.packageName,
    projectKeys,
    logger,
    author: process.env['PACKAGE_AUTHOR'],
    license: process.env['PACKAGE_LICENSE'],
    repositoryUrl: process.env['PACKAGE_REPO_URL'],
    registry,
  })
  if (options.publish) {
    assertPublishableBaseUrl(options.baseUrl)
    publishManager.assertLoggedIn()
  }

  const db = new Database()
  try {
    await db.connect()
    const scope = await resolveScope(db, instance)
    logger.info(
      `Scope: ${scope.collectionIds.length} collections, ${scope.itemIds.length} items, ${scope.partnerIds.length} partners`
    )
    const context: ExportContext = {
      db,
      outputDir,
      projectIds: await db.resolveProjectIds(projectKeys),
      contextIds: await db.resolveContextIds(projectKeys),
      projectKeys,
      baseUrl: options.baseUrl,
      logger,
      scope,
    }
    const exporters = [
      new ManifestExporter(context),
      new LanguageExporter(context),
      new CountryExporter(context),
      new PartnerExporter(context),
      new ItemExporter(context),
      new CollectionExporter(context),
      new GlossaryExporter(context),
    ]
    for (const exporter of exporters) {
      const result = await exporter.export()
      console.log(chalk.green(`  ✓ ${result.file} (${result.count})`))
    }
  } finally {
    await db.disconnect()
  }

  if (!options.publish) return
  const version = options.packageVersion ? publishManager.setVersion(options.packageVersion) : publishManager.getNextVersion()
  writeFileSync(resolve(outputDir, 'package.json'), JSON.stringify(publishManager.generatePackageJson(version), null, 2), 'utf-8')
  writeFileSync(resolve(outputDir, 'README.md'), publishManager.generateReadme(instance.packageName), 'utf-8')
  publishManager.writeLicense()
  publishManager.publish()
  publishManager.recordPublished(version)
  console.log(chalk.green(`  ✓ Published: ${instance.packageName}@${version}`))
}
