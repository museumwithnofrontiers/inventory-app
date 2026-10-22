import path from 'node:path'

/**
 * Everything the server reads from its environment. Each value has a default
 * that works in the Docker image, so `docker run` needs no variable at all.
 */
export interface Config {
  /** npm registry the packages are published to. */
  registryUrl: string
  /** npm scope, without the `@`. Only `@<scope>/<name>-data` packages are served. */
  scope: string
  /** Where extracted package versions are kept. A published version never changes, so nothing expires. */
  cacheDir: string
  /** Largest tarball accepted, compressed. */
  maxTarballBytes: number
  /** Largest package accepted, uncompressed: a gzip bomb stops here. */
  maxExtractedBytes: number
  /** Most entries accepted in one tarball. */
  maxEntries: number
  /** Largest image `view_image` returns. */
  maxImageBytes: number
  /** Longest text a tool returns before it is cut, with a note saying how to page. */
  maxOutputChars: number
}

const intFromEnv = (value: string | undefined, fallback: number): number => {
  if (value === undefined || value.trim() === '') return fallback
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Expected a positive integer, got "${value}"`)
  }
  return parsed
}

const MB = 1024 * 1024

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const scope = (env.DATA_PACKAGES_SCOPE ?? 'museumwnf').replace(/^@/, '')
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(scope)) {
    throw new Error(`DATA_PACKAGES_SCOPE is not an npm scope: "${scope}"`)
  }
  return {
    registryUrl: (env.NPM_REGISTRY_URL ?? 'https://registry.npmjs.org').replace(/\/+$/, ''),
    scope,
    cacheDir: path.resolve(env.DATA_PACKAGES_CACHE ?? path.join(process.cwd(), '.cache')),
    maxTarballBytes: intFromEnv(env.MAX_TARBALL_MB, 200) * MB,
    maxExtractedBytes: intFromEnv(env.MAX_EXTRACTED_MB, 1024) * MB,
    maxEntries: intFromEnv(env.MAX_TARBALL_ENTRIES, 20000),
    maxImageBytes: intFromEnv(env.MAX_IMAGE_KB, 4096) * 1024,
    maxOutputChars: intFromEnv(env.MAX_OUTPUT_CHARS, 60000),
  }
}
