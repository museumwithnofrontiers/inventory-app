import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'fs'
import { spawnSync } from 'child_process'
import { dirname, join, relative, resolve } from 'path'
import { fileURLToPath } from 'url'
import { Logger } from './logger.js'

// Single source of truth for every exporter's LICENSE.md — kept once so the
// seven packages (and the `rights` block each ManifestExporter writes) cannot
// drift from each other. Path is relative to this file's own location, not
// to outputDir, so it resolves the same way regardless of --output-dir.
const LICENSE_TEMPLATE_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '../../../docs/LICENSE.md.template')

// Packages are published by museumwithnofrontiers/data-packages' release
// workflow, and npm provenance refuses a package.json that names another
// repository than the one the workflow runs in.
export const DATA_PACKAGES_REPOSITORY_URL = 'git+https://github.com/museumwithnofrontiers/data-packages.git'

export interface PublishConfig {
  outputDir: string
  /** A checkout of museumwithnofrontiers/data-packages: the package is staged into its packages/ folder. */
  dataPackagesDir: string
  packageName: string
  projectKeys: string[]
  logger: Logger
  // Package metadata — all optional; omitted fields are left out of package.json
  author?: string
  license?: string
  // The registry asked for the latest published version
  registry?: string
}

export interface SemanticVersion {
  major: number
  minor: number
  patch: number
}

export interface StageResult {
  /** False when the export matches what data-packages already holds: there is nothing to publish. */
  changed: boolean
  version: string
  packageDir: string
}

/** The layout data-packages commits: two-space indentation and a final newline, so diffs are line by line. */
export function prettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2) + '\n'
}

function filesUnder(dir: string): string[] {
  const out: string[] = []
  const walk = (current: string) => {
    for (const name of readdirSync(current).sort()) {
      const path = join(current, name)
      if (statSync(path).isDirectory()) walk(path)
      else out.push(relative(dir, path).split('\\').join('/'))
    }
  }
  if (existsSync(dir)) walk(dir)
  return out
}

/**
 * Stages an export into a data-packages checkout; the data-packages release
 * workflow publishes it once the pull request that carries it is merged.
 * Nothing here publishes or needs an npm login.
 */
export class PublishManager {
  private config: PublishConfig

  constructor(config: PublishConfig) {
    this.config = config
  }

  private parseVersion(versionString: string): SemanticVersion {
    const parts = versionString.trim().split('.')
    if (parts.length !== 3) {
      throw new Error(`Invalid version format: ${versionString} (expected X.Y.Z)`)
    }
    const [major, minor, patch] = parts.map(Number)
    if (isNaN(major) || isNaN(minor) || isNaN(patch)) {
      throw new Error(`Invalid version format: ${versionString} (parts must be numeric)`)
    }
    return { major, minor, patch }
  }

  private formatVersion(v: SemanticVersion): string {
    return `${v.major}.${v.minor}.${v.patch}`
  }

  /** The package's folder in data-packages: its name without the scope. */
  get packageDir(): string {
    return resolve(this.config.dataPackagesDir, 'packages', this.config.packageName.replace(/^@[^/]+\//, ''))
  }

  /** Refuses a directory that is not a data-packages checkout, before the export spends minutes. */
  assertDataPackagesCheckout(): void {
    if (!existsSync(resolve(this.config.dataPackagesDir, 'scripts', 'check.mjs'))) {
      throw new Error(
        `${this.config.dataPackagesDir} is not a checkout of museumwithnofrontiers/data-packages. ` +
          'Clone it next to inventory-app (or set DATA_PACKAGES_DIR) and pull main before exporting.'
      )
    }
  }

  /** The version data-packages holds for this package, or null when it holds none. */
  private committedVersion(): string | null {
    const path = resolve(this.packageDir, 'package.json')
    if (!existsSync(path)) return null
    const version = JSON.parse(readFileSync(path, 'utf-8'))['version']
    return typeof version === 'string' ? version : null
  }

  /**
   * The version the registry already holds, or null when it cannot say —
   * because the package has never been published, or it is unreachable.
   */
  private publishedVersion(): string | null {
    const args = ['view', this.config.packageName, 'version']
    if (this.config.registry) {
      args.push('--registry', this.config.registry)
    }
    const result = spawnSync('npm', args, {
      encoding: 'utf-8',
      env: process.env,
      shell: true,
    })
    if (result.error || result.status !== 0) {
      return null
    }
    const version = (result.stdout ?? '').trim()
    try {
      this.parseVersion(version)
      return version
    } catch {
      return null
    }
  }

  /** Whether a is a later release than b. */
  private isAfter(a: SemanticVersion, b: SemanticVersion): boolean {
    if (a.major !== b.major) return a.major > b.major
    if (a.minor !== b.minor) return a.minor > b.minor
    return a.patch > b.patch
  }

  /**
   * The next version: one patch above the later of what data-packages holds
   * and what the registry holds. The registry can be ahead of a checkout
   * that was not pulled, and the checkout ahead of the registry while a
   * merged pull request waits for its release run.
   */
  getNextVersion(): string {
    const candidates = [this.committedVersion(), this.publishedVersion()].filter((v): v is string => v !== null)
    let current = '1.0.0'
    for (const candidate of candidates) {
      if (this.isAfter(this.parseVersion(candidate), this.parseVersion(current))) current = candidate
    }
    if (candidates.length === 0) {
      this.config.logger.warning(
        `${this.config.packageName} is neither in data-packages nor on the registry; ` +
          'its first version has to be published by hand (trusted publishing cannot create a package)'
      )
    }
    const v = this.parseVersion(current)
    v.patch += 1
    const next = this.formatVersion(v)
    this.config.logger.info(`Next version: ${current} → ${next}`)
    return next
  }

  /** Set an explicit version instead of the next patch. */
  setVersion(version: string): string {
    this.parseVersion(version)
    this.config.logger.info(`Version set: ${version}`)
    return version
  }

  generatePackageJson(version: string): Record<string, unknown> {
    const pkg: Record<string, unknown> = {
      name: this.config.packageName,
      version,
      type: 'module',
      private: false,
      description: `Static data export for ${this.config.projectKeys.join(', ')}`,
      // 'UNLICENSED' would mean "all rights reserved, no permission granted",
      // which contradicts the MWNF legal notice (non-commercial/educational
      // use is permitted). No SPDX identifier matches the notice's terms, so
      // this is the registry-sanctioned encoding for custom terms — see
      // LICENSE.md, which stage() writes into the package.
      license: this.config.license ?? 'SEE LICENSE IN LICENSE.md',
      main: './manifest.json',
      exports: {
        '.': './manifest.json',
        './*.json': './*.json',
        './translations/*': './translations/*',
      },
      files: [
        '*.json',
        'translations/*.json',
        'README.md',
      ],
      engines: {
        node: '>=16.0.0',
        npm: '>=8.0.0',
      },
    }

    if (this.config.author) pkg['author'] = this.config.author
    pkg['repository'] = {
      type: 'git',
      url: DATA_PACKAGES_REPOSITORY_URL,
      directory: `packages/${this.config.packageName.replace(/^@[^/]+\//, '')}`,
    }

    return pkg
  }

  generateReadme(packageName: string): string {
    const projectList = this.config.projectKeys.join(', ')
    // npmjs is npm's own default registry: naming it explicitly in the
    // example would be correct but redundant, so the flag only appears for a
    // genuinely different registry (e.g. GitHub Packages, still in use for
    // versions published before this package's move to npmjs).
    const isDefaultRegistry =
      !this.config.registry || this.config.registry.replace(/\/$/, '') === 'https://registry.npmjs.org'
    const installLine = isDefaultRegistry
      ? `npm install ${packageName}`
      : `npm install ${packageName} --registry ${this.config.registry}`

    return `# ${packageName}

Static data export — projects: ${projectList}.

## Installation

\`\`\`bash
${installLine}
\`\`\`

## Usage

\`\`\`javascript
import manifest from '${packageName}/manifest.json' assert { type: 'json' }
import items    from '${packageName}/items.json'    assert { type: 'json' }

// Lazy-load translations for a language
const { default: translations } = await import(\`${packageName}/translations/items.\${lang}.json\`)
\`\`\`

Available top-level JSON files: \`manifest.json\`, \`items.json\`, \`partners.json\`,
\`collections.json\`, \`dynasties.json\`, \`countries.json\`, \`glossary.json\`, \`languages.json\`.

Each has a per-language translation file under \`translations/{entity}.{lang}.json\`.

## Terms of use

This data is Content of the MWNF Website under the
[MWNF legal notice](https://www.museumwnf.org/about/legal-notice), which
governs its use (non-commercial, personal, educational and scientific use is
permitted, with attribution and mandatory reporting — see the notice for the
full terms). The notice text also ships in this package as \`LICENSE.md\`.
`
  }

  /** The package's files as data-packages commits them, keyed by path, package.json aside. */
  private stagedFiles(): Map<string, string> {
    const files = new Map<string, string>()
    for (const file of filesUnder(this.config.outputDir)) {
      // The .gz companions serve local previews only; the package never shipped them.
      if (!file.endsWith('.json') || file === 'package.json') continue
      const value = JSON.parse(readFileSync(resolve(this.config.outputDir, file), 'utf-8'))
      // The release workflow sets generatedAt from the commit time: kept
      // here, it would make every export a change.
      if (file === 'manifest.json') delete value['generatedAt']
      files.set(file, prettyJson(value))
    }
    files.set('README.md', this.generateReadme(this.config.packageName))
    files.set('LICENSE.md', readFileSync(LICENSE_TEMPLATE_PATH, 'utf-8'))
    return files
  }

  private matchesCommitted(files: Map<string, string>): boolean {
    const committed = filesUnder(this.packageDir).filter((file) => file !== 'package.json')
    if (committed.length !== files.size) return false
    return committed.every((file) => files.get(file) === readFileSync(resolve(this.packageDir, file), 'utf-8'))
  }

  /**
   * Writes the export into data-packages' packages/<name> folder, replacing
   * what was there, with a new version — unless it matches what the folder
   * already holds, in which case nothing is written.
   */
  stage(explicitVersion?: string): StageResult {
    const files = this.stagedFiles()
    if (this.matchesCommitted(files)) {
      const version = this.committedVersion() ?? ''
      this.config.logger.info(`${this.config.packageName} is unchanged from data-packages (${version}): nothing to publish`)
      return { changed: false, version, packageDir: this.packageDir }
    }

    const version = explicitVersion ? this.setVersion(explicitVersion) : this.getNextVersion()
    rmSync(this.packageDir, { recursive: true, force: true })
    for (const [file, content] of files) {
      const path = resolve(this.packageDir, file)
      mkdirSync(dirname(path), { recursive: true })
      writeFileSync(path, content, 'utf-8')
    }
    writeFileSync(resolve(this.packageDir, 'package.json'), prettyJson(this.generatePackageJson(version)), 'utf-8')
    return { changed: true, version, packageDir: this.packageDir }
  }
}

/**
 * A published package's image URLs must be absolute. `--base-url` falls back
 * to `./images` when BASE_URL is unset, which suits a local export but no
 * website: every site that installs the package would request its pictures
 * from its own host, where they don't exist. Only https is accepted, since the
 * sites are served over https.
 */
export function assertPublishableBaseUrl(baseUrl: string): void {
  let url: URL | null
  try {
    url = new URL(baseUrl)
  } catch {
    url = null
  }
  if (url?.protocol !== 'https:') {
    throw new Error(
      `--publish needs an absolute https image base URL, got ${JSON.stringify(baseUrl)}. ` +
        'Pass --base-url (e.g. https://inventory.metanull.eu) or set BASE_URL.'
    )
  }
}
