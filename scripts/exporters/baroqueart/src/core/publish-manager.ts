import { readFileSync, writeFileSync, existsSync } from 'fs'
import { spawnSync } from 'child_process'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { Logger } from './logger.js'

// Single source of truth for every exporter's LICENSE.md — kept once so the
// seven packages (and the `rights` block each ManifestExporter writes) cannot
// drift from each other. Path is relative to this file's own location, not
// to outputDir, so it resolves the same way regardless of --output-dir.
const LICENSE_TEMPLATE_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '../../../docs/LICENSE.md.template')

export interface PublishConfig {
  outputDir: string
  /** Path to the version counter file — must live OUTSIDE outputDir so --force doesn't reset it. */
  versionFile: string
  packageName: string
  projectKeys: string[]
  logger: Logger
  // Package metadata — all optional; omitted fields are left out of package.json
  author?: string
  license?: string
  repositoryUrl?: string
  // Publishing
  registry?: string
}

export interface SemanticVersion {
  major: number
  minor: number
  patch: number
}

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

  private readCurrentVersion(): string {
    if (existsSync(this.config.versionFile)) {
      const content = readFileSync(this.config.versionFile, 'utf-8').trim()
      return content || '1.0.0'
    }
    return '1.0.0'
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
   * Confirm the npm session is alive before the caller spends minutes on an
   * export that would otherwise only fail at the very end, as a registry 404
   * right after publish. Throws with the operator-facing fix rather than
   * just the raw `npm whoami` failure.
   */
  assertLoggedIn(): void {
    const args = ['whoami']
    if (this.config.registry) {
      args.push('--registry', this.config.registry)
    }
    const result = spawnSync('npm', args, {
      encoding: 'utf-8',
      env: process.env,
      shell: true,
    })
    const user = (result.stdout ?? '').trim()
    if (result.error || result.status !== 0 || !user) {
      throw new Error(
        'npm session is not authenticated (npm whoami failed). Run `npm login` on the host, ' +
          'and on Windows set $env:HOME = $env:USERPROFILE before `docker compose` so the ' +
          "container mounts the host's ~/.npmrc, then retry."
      )
    }
    this.config.logger.info(`npm session: logged in as ${user}`)
  }

  /**
   * Compute the version to publish next, without persisting it. Persisting
   * happens only once the publish that uses this version has actually
   * succeeded — see recordPublished() — so a failed publish never burns a
   * number.
   *
   * The registry is asked first, and wins whenever it is ahead. The counter
   * file is untracked, it lives per exporter, and nothing keeps it in step with
   * what was actually published — four of the seven datasets were found sitting
   * at 1.0.0 while the registry held 1.0.2 and 1.0.3, so the first --publish
   * walked straight into a taken number. The registry is the only thing that
   * knows for certain.
   *
   * The file is still the answer when the registry cannot be reached or has
   * never seen this package.
   */
  getNextVersion(): string {
    const local = this.readCurrentVersion()
    const published = this.publishedVersion()

    let current = local
    if (published && this.isAfter(this.parseVersion(published), this.parseVersion(local))) {
      this.config.logger.info(`Registry is ahead of ${this.config.versionFile}: ${local} → ${published}`)
      current = published
    } else if (!published) {
      this.config.logger.info(`Registry did not answer for ${this.config.packageName}; using ${local}`)
    }

    const v = this.parseVersion(current)
    v.patch += 1
    const next = this.formatVersion(v)
    this.config.logger.info(`Next version: ${current} → ${next}`)
    return next
  }

  /**
   * Set an explicit version. Use when the auto-incremented value is wrong
   * (e.g. first run after version file was lost). Not persisted until the
   * publish that uses it succeeds — see recordPublished().
   */
  setVersion(version: string): string {
    this.parseVersion(version)
    this.config.logger.info(`Version set: ${version}`)
    return version
  }

  /**
   * Persist the version that was just published successfully. Call only
   * after publish() returns without throwing. Right after a publish the
   * registry itself may still answer with the previous version for a
   * minute or so; this file is what keeps the next run ahead of that lag.
   */
  recordPublished(version: string): void {
    this.parseVersion(version)
    writeFileSync(this.config.versionFile, version, 'utf-8')
    this.config.logger.info(`Version recorded as published: ${version}`)
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
      // LICENSE.md, copied into the package by writeLicense() below.
      license: this.config.license ?? 'SEE LICENSE IN LICENSE.md',
      main: './manifest.json',
      exports: {
        '.': './manifest.json',
        './*.json': './*.json',
        './translations/*': './translations/*',
      },
      // Explicitly list .json only — .gz companion files are not useful to consumers
      files: ['*.json', 'translations/*.json', 'README.md'],
      engines: {
        node: '>=16.0.0',
        npm: '>=8.0.0',
      },
    }

    if (this.config.author) pkg['author'] = this.config.author
    if (this.config.repositoryUrl)
      pkg['repository'] = { type: 'git', url: this.config.repositoryUrl }

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
\`collections.json\`, \`countries.json\`, \`glossary.json\`, \`languages.json\`,
\`timelines.json\`, \`timeline_events.json\`. (No \`dynasties.json\` — dynasties are
a Discover Islamic Art concept and are absent from this dataset.)

Each has a per-language translation file under \`translations/{entity}.{lang}.json\`.

\`items.json\` contains objects and monuments only. Monument details (the
legacy "Special Features") are embedded as \`details[]\` on their parent
monument; a detail's texts live in \`translations/items.{lang}.json\` keyed by
the detail's \`id\`, alongside the item texts.

## Terms of use

This data is Content of the MWNF Website under the
[MWNF legal notice](https://www.museumwnf.org/about/legal-notice), which
governs its use (non-commercial, personal, educational and scientific use is
permitted, with attribution and mandatory reporting — see the notice for the
full terms). The notice text also ships in this package as \`LICENSE.md\`.
`
  }

  /**
   * Copy the shared MWNF licence template into the package output as
   * LICENSE.md. npm includes LICENSE.md in a published tarball automatically
   * (it does not need to be added to the `files` allow-list above), so this
   * only needs to land the file in outputDir before publish() runs.
   */
  writeLicense(): void {
    const template = readFileSync(LICENSE_TEMPLATE_PATH, 'utf-8')
    writeFileSync(resolve(this.config.outputDir, 'LICENSE.md'), template, 'utf-8')
  }

  /**
   * Run `npm publish` inside outputDir.
   * Throws if the publish command exits with a non-zero status.
   */
  publish(): void {
    const args = ['publish']
    if (this.config.registry) {
      args.push('--registry', this.config.registry)
    }
    // Scoped packages default to private on npmjs; these are meant to be
    // public (non-commercial MWNF data, no npmjs org billing for private
    // scoped packages either way). --access is a no-op against GitHub
    // Packages, which derives visibility from the repository instead.
    args.push('--access', 'public')

    this.config.logger.info(`Running: npm ${args.join(' ')}`)

    const result = spawnSync('npm', args, {
      cwd: this.config.outputDir,
      stdio: 'inherit',
      env: process.env,
      shell: true,
    })

    if (result.error) {
      throw new Error(`Failed to spawn npm: ${result.error.message}`)
    }
    if (result.status !== 0) {
      throw new Error(`npm publish exited with code ${result.status}`)
    }
  }
}
