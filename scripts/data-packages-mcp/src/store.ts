import { randomBytes } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { Config } from './config.js'
import { verifyIntegrity } from './integrity.js'
import type { RegistryClient, VersionInfo } from './registry.js'
import { isSemver } from './semver.js'
import { readTarGz, writeEntries } from './tar.js'

export interface CachedVersion {
  name: string
  version: string
  /** The extracted package root (what npm packs under `package/`). */
  dir: string
}

interface Marker {
  name: string
  version: string
  tarball: string
  integrity: { algorithm: string; digest: string }
  fetchedAt: string
}

/**
 * The on-disk cache of extracted package versions:
 * `<cacheDir>/<@scope>/<name>/<version>/package/…` plus a `meta.json` marker
 * written last. A version without its marker is incomplete and fetched again.
 * Published versions are immutable, so nothing in the cache ever expires.
 */
export class PackageStore {
  private readonly inflight = new Map<string, Promise<CachedVersion>>()

  constructor(
    private readonly config: Pick<
      Config,
      'cacheDir' | 'maxTarballBytes' | 'maxExtractedBytes' | 'maxEntries'
    >,
    private readonly registry: RegistryClient
  ) {}

  private versionDir(name: string, version: string): string {
    if (!this.registry.isDataPackage(name)) throw new Error(`Not a data package: ${name}`)
    if (!isSemver(version)) throw new Error(`Not a version: ${version}`)
    const [scope, bare] = name.split('/')
    return path.join(this.config.cacheDir, scope, bare, version)
  }

  private async isComplete(name: string, version: string): Promise<boolean> {
    try {
      const marker = JSON.parse(
        await readFile(path.join(this.versionDir(name, version), 'meta.json'), 'utf8')
      ) as Marker
      return marker.name === name && marker.version === version
    } catch {
      return false
    }
  }

  /**
   * The extracted package for `name@versionOrTag`, fetching it on first use.
   * An exact version already in the cache is served without asking the registry.
   */
  async ensure(name: string, versionOrTag = 'latest'): Promise<CachedVersion> {
    if (isSemver(versionOrTag) && (await this.isComplete(name, versionOrTag))) {
      return {
        name,
        version: versionOrTag,
        dir: path.join(this.versionDir(name, versionOrTag), 'package'),
      }
    }
    const info = await this.registry.resolve(name, versionOrTag)
    const key = `${name}@${info.version}`
    let pending = this.inflight.get(key)
    if (!pending) {
      pending = this.fetch(name, info).finally(() => this.inflight.delete(key))
      this.inflight.set(key, pending)
    }
    return pending
  }

  private async fetch(name: string, info: VersionInfo): Promise<CachedVersion> {
    const dir = this.versionDir(name, info.version)
    const result = { name, version: info.version, dir: path.join(dir, 'package') }
    if (await this.isComplete(name, info.version)) return result

    const tarball = await this.registry.downloadTarball(info, this.config.maxTarballBytes)
    const integrity = verifyIntegrity(tarball, info.integrity, info.shasum)
    const files = readTarGz(tarball, this.config)

    // Extract beside the final directory, then rename it into place, so a
    // crash or a concurrent server never leaves a half-written version that
    // looks complete.
    const staging = `${dir}.tmp-${process.pid}-${randomBytes(4).toString('hex')}`
    try {
      await writeEntries(files, path.join(staging, 'package'))
      const marker: Marker = {
        name,
        version: info.version,
        tarball: info.tarball,
        integrity,
        fetchedAt: new Date().toISOString(),
      }
      await writeFile(path.join(staging, 'meta.json'), JSON.stringify(marker, null, 2))
      await mkdir(path.dirname(dir), { recursive: true })
      await rm(dir, { recursive: true, force: true })
      try {
        await rename(staging, dir)
      } catch (error) {
        if (!(await this.isComplete(name, info.version))) throw error
      }
    } finally {
      await rm(staging, { recursive: true, force: true })
    }
    return result
  }
}
