import { createHash } from 'node:crypto'

export class IntegrityError extends Error {}

/** Strongest first: an SRI string may list several hashes, and the strongest one decides. */
const SUPPORTED = ['sha512', 'sha384', 'sha256'] as const

/**
 * Checks a tarball against the registry's `dist.integrity` (Subresource
 * Integrity, `sha512-<base64>`), falling back to the legacy `dist.shasum`
 * (sha1, hex) only when no SRI hash is usable. A tarball with neither is
 * refused: an unverifiable download never reaches the cache.
 */
export function verifyIntegrity(
  data: Buffer,
  integrity: string | null,
  shasum: string | null
): { algorithm: string; digest: string } {
  const hashes = new Map<string, string[]>()
  for (const token of (integrity ?? '').trim().split(/\s+/)) {
    const match = /^([a-z0-9]+)-([A-Za-z0-9+/=]+)(\?.*)?$/.exec(token)
    if (!match) continue
    const list = hashes.get(match[1]) ?? []
    list.push(match[2])
    hashes.set(match[1], list)
  }
  for (const algorithm of SUPPORTED) {
    const expected = hashes.get(algorithm)
    if (!expected) continue
    const digest = createHash(algorithm).update(data).digest('base64')
    if (!expected.includes(digest)) {
      throw new IntegrityError(
        `Integrity mismatch (${algorithm}): expected ${expected.join(' or ')}, got ${digest}`
      )
    }
    return { algorithm, digest }
  }
  if (shasum && /^[0-9a-f]{40}$/i.test(shasum)) {
    const digest = createHash('sha1').update(data).digest('hex')
    if (digest !== shasum.toLowerCase()) {
      throw new IntegrityError(`Shasum mismatch: expected ${shasum}, got ${digest}`)
    }
    return { algorithm: 'sha1', digest }
  }
  throw new IntegrityError('The registry gave no usable integrity hash; refusing the tarball')
}
