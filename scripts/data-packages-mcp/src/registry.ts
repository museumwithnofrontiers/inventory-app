import { compareSemver, isSemver } from './semver.js'

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>

export interface PackageSummary {
  name: string
  latest: string | null
  published: string | null
  description: string | null
}

export interface VersionInfo {
  version: string
  published: string | null
  tags: string[]
  tarball: string
  integrity: string | null
  shasum: string | null
  unpackedSize: number | null
  fileCount: number | null
}

export interface Packument {
  name: string
  distTags: Record<string, string>
  /** Oldest first. Only versions still published: an unpublished one has no tarball. */
  versions: VersionInfo[]
  modified: string | null
}

export class RegistryError extends Error {}

type Json = Record<string, unknown>

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const str = (value: unknown): string | null => (typeof value === 'string' ? value : null)

const num = (value: unknown): number | null => (typeof value === 'number' ? value : null)

/**
 * Read-only client of the npm registry API: search, org listing, packuments
 * and tarballs. It never authenticates and never writes.
 */
export class RegistryClient {
  private readonly packuments = new Map<string, { at: number; value: Promise<Packument> }>()
  private listing: { at: number; value: Promise<PackageSummary[]> } | null = null

  constructor(
    private readonly options: { registryUrl: string; scope: string; ttlMs?: number },
    private readonly fetchImpl: FetchLike = (url, init) => fetch(url, init)
  ) {}

  private get ttl(): number {
    return this.options.ttlMs ?? 60_000
  }

  /** `@museumwnf/<anything>-data`: a data package of this scope. */
  isDataPackage(name: string): boolean {
    const prefix = `@${this.options.scope}/`
    return name.startsWith(prefix) && /^[a-z0-9][a-z0-9._-]*-data$/.test(name.slice(prefix.length))
  }

  /**
   * Accepts `islamicart`, `islamicart-data` or `@museumwnf/islamicart-data`
   * and returns the full package name, or throws when it cannot be a data package.
   */
  normaliseName(input: string): string {
    let name = input.trim()
    const prefix = `@${this.options.scope}/`
    if (!name.startsWith('@')) name = prefix + name
    if (!name.endsWith('-data')) name = `${name}-data`
    if (!this.isDataPackage(name)) {
      throw new RegistryError(`"${input}" is not a ${prefix}<name>-data package`)
    }
    return name
  }

  private async getJson(url: string): Promise<unknown> {
    let response: Response
    try {
      response = await this.fetchImpl(url, {
        headers: { accept: 'application/json' },
        redirect: 'follow',
        signal: AbortSignal.timeout(60_000),
      })
    } catch (error) {
      throw new RegistryError(`Registry unreachable (${url}): ${(error as Error).message}`, {
        cause: error,
      })
    }
    if (!response.ok) {
      throw new RegistryError(`Registry answered ${response.status} for ${url}`)
    }
    try {
      return await response.json()
    } catch (error) {
      throw new RegistryError(`Unreadable registry answer (${url}): ${(error as Error).message}`, {
        cause: error,
      })
    }
  }

  /**
   * Every package of the scope the search endpoint knows. The `scope:` search
   * qualifier returns nothing on registry.npmjs.org, so this searches for the
   * scope as text and keeps the names that carry it.
   */
  async searchScope(): Promise<PackageSummary[]> {
    const found = new Map<string, PackageSummary>()
    const prefix = `@${this.options.scope}/`
    const size = 250
    for (let from = 0; from < 5000; from += size) {
      const url = `${this.options.registryUrl}/-/v1/search?text=${encodeURIComponent(`@${this.options.scope}`)}&size=${size}&from=${from}`
      const body = await this.getJson(url)
      const objects = isObject(body) && Array.isArray(body.objects) ? body.objects : []
      for (const entry of objects) {
        const pkg = isObject(entry) && isObject(entry.package) ? entry.package : null
        const name = pkg ? str(pkg.name) : null
        if (!pkg || !name || !name.startsWith(prefix)) continue
        found.set(name, {
          name,
          latest: str(pkg.version),
          published: str(pkg.date),
          description: str(pkg.description),
        })
      }
      const total = isObject(body) ? num(body.total) : null
      if (objects.length < size || total === null || from + size >= total) break
    }
    return [...found.values()]
  }

  /** Names the org lists publicly. Empty when the endpoint refuses: search still answers. */
  async orgPackages(): Promise<string[]> {
    try {
      const body = await this.getJson(
        `${this.options.registryUrl}/-/org/${encodeURIComponent(this.options.scope)}/package`
      )
      return isObject(body) ? Object.keys(body) : []
    } catch {
      return []
    }
  }

  /** The data packages of the scope: search ∪ org listing, never a hardcoded list. */
  async listDataPackages(): Promise<PackageSummary[]> {
    if (this.listing && Date.now() - this.listing.at < this.ttl) return this.listing.value
    const value = (async () => {
      const [searched, org] = await Promise.all([this.searchScope(), this.orgPackages()])
      const byName = new Map(searched.filter(p => this.isDataPackage(p.name)).map(p => [p.name, p]))
      const missing = org.filter(name => this.isDataPackage(name) && !byName.has(name))
      const filled = await Promise.all(
        missing.map(async name => {
          const packument = await this.packument(name)
          const latest = packument.distTags.latest ?? null
          const info = packument.versions.find(v => v.version === latest)
          return { name, latest, published: info?.published ?? null, description: null }
        })
      )
      for (const summary of filled) byName.set(summary.name, summary)
      return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name))
    })()
    this.listing = { at: Date.now(), value }
    value.catch(() => {
      this.listing = null
    })
    return value
  }

  async packument(name: string): Promise<Packument> {
    const cached = this.packuments.get(name)
    if (cached && Date.now() - cached.at < this.ttl) return cached.value
    const value = this.fetchPackument(name)
    this.packuments.set(name, { at: Date.now(), value })
    value.catch(() => this.packuments.delete(name))
    return value
  }

  private async fetchPackument(name: string): Promise<Packument> {
    const body = await this.getJson(`${this.options.registryUrl}/${name.replace('/', '%2f')}`)
    if (!isObject(body)) throw new RegistryError(`Unexpected packument for ${name}`)
    const distTags: Record<string, string> = {}
    if (isObject(body['dist-tags'])) {
      for (const [tag, version] of Object.entries(body['dist-tags'])) {
        if (typeof version === 'string') distTags[tag] = version
      }
    }
    const time = isObject(body.time) ? body.time : {}
    const versions: VersionInfo[] = []
    if (isObject(body.versions)) {
      for (const [version, manifest] of Object.entries(body.versions)) {
        if (!isObject(manifest) || !isObject(manifest.dist)) continue
        const tarball = str(manifest.dist.tarball)
        if (!tarball) continue
        versions.push({
          version,
          published: str(time[version]),
          tags: Object.entries(distTags)
            .filter(([, v]) => v === version)
            .map(([tag]) => tag),
          tarball,
          integrity: str(manifest.dist.integrity),
          shasum: str(manifest.dist.shasum),
          unpackedSize: num(manifest.dist.unpackedSize),
          fileCount: num(manifest.dist.fileCount),
        })
      }
    }
    versions.sort((a, b) => compareSemver(a.version, b.version))
    return { name, distTags, versions, modified: str(time.modified) }
  }

  /** A dist-tag (`latest`) or an exact version, to the published version it names. */
  async resolve(name: string, versionOrTag = 'latest'): Promise<VersionInfo> {
    const packument = await this.packument(name)
    const wanted = packument.distTags[versionOrTag] ?? versionOrTag
    const info = packument.versions.find(v => v.version === wanted)
    if (!info) {
      const recent = packument.versions
        .slice(-5)
        .map(v => v.version)
        .join(', ')
      throw new RegistryError(
        `${name} has no published version "${versionOrTag}"` +
          (isSemver(versionOrTag) ? '' : ' (and no such dist-tag)') +
          `. Most recent: ${recent || 'none'}`
      )
    }
    return info
  }

  /**
   * The tarball of a version. Only from the registry's own origin: a
   * packument pointing anywhere else is refused rather than followed.
   */
  async downloadTarball(info: VersionInfo, maxBytes: number): Promise<Buffer> {
    const registryOrigin = new URL(this.options.registryUrl).origin
    let url: URL
    try {
      url = new URL(info.tarball)
    } catch {
      throw new RegistryError(`Invalid tarball URL "${info.tarball}"`)
    }
    if (url.origin !== registryOrigin) {
      throw new RegistryError(
        `Refusing tarball outside the registry: ${info.tarball} (registry is ${registryOrigin})`
      )
    }
    let response: Response
    try {
      response = await this.fetchImpl(url.href, {
        redirect: 'error',
        signal: AbortSignal.timeout(300_000),
      })
    } catch (error) {
      throw new RegistryError(
        `Tarball download failed (${url.href}): ${(error as Error).message}`,
        { cause: error }
      )
    }
    if (!response.ok)
      throw new RegistryError(`Registry answered ${response.status} for ${url.href}`)
    return readCapped(response, maxBytes, `tarball ${url.href}`)
  }
}

/** Reads a response body, aborting as soon as it grows past `maxBytes`. */
export async function readCapped(
  response: Response,
  maxBytes: number,
  what: string
): Promise<Buffer> {
  const declared = Number(response.headers.get('content-length') ?? '0')
  if (declared > maxBytes) {
    throw new RegistryError(`${what} is ${declared} bytes, over the ${maxBytes}-byte limit`)
  }
  if (!response.body) return Buffer.alloc(0)
  const chunks: Buffer[] = []
  let total = 0
  const reader = response.body.getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel()
      throw new RegistryError(`${what} is over the ${maxBytes}-byte limit`)
    }
    chunks.push(Buffer.from(value))
  }
  return Buffer.concat(chunks)
}
