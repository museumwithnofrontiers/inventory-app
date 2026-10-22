import { readCapped, type FetchLike } from './registry.js'
import type { PackageView } from './package-view.js'

const PUB_URL = /https?:\/\/[A-Za-z0-9.-]+(?::\d+)?\/pub\/[A-Za-z0-9][A-Za-z0-9._-]*/g
const PUB_PATH = /^\/pub\/[A-Za-z0-9][A-Za-z0-9._-]*$/

const origins = new Map<string, Set<string>>()

/** Every origin a package's `/pub/` image URLs point at: the inventory host(s) it was exported against. */
export function pubOrigins(view: PackageView): Set<string> {
  const cached = origins.get(view.root)
  if (cached) return cached
  const found = new Set<string>()
  for (const file of view.listFiles()) {
    if (!file.endsWith('.json')) continue
    for (const match of view.text(file).matchAll(PUB_URL)) found.add(new URL(match[0]).origin)
  }
  origins.set(view.root, found)
  return found
}

/**
 * Checks that `url` is a `/pub/<filename>` image on a host the package itself
 * points at, and returns it parsed. Anything else — another host, another
 * path, a query string — is refused, so this never becomes a general fetcher.
 */
export function checkImageUrl(view: PackageView, url: string): URL {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error(`Not a URL: "${url}"`)
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error('Image URLs carry no credentials, query or fragment')
  }
  if (!PUB_PATH.test(parsed.pathname))
    throw new Error(`Only /pub/<filename> images can be viewed, not ${parsed.pathname}`)
  const allowed = pubOrigins(view)
  if (!allowed.has(parsed.origin)) {
    throw new Error(
      `${parsed.origin} is not an image host of ${view.label} (it uses: ${[...allowed].join(', ') || 'none'})`
    )
  }
  return parsed
}

export async function fetchImage(
  view: PackageView,
  url: string,
  maxBytes: number,
  fetchImpl: FetchLike = (u, init) => fetch(u, init)
): Promise<{ url: string; mimeType: string; bytes: number; data: string }> {
  const parsed = checkImageUrl(view, url)
  let response: Response
  try {
    response = await fetchImpl(parsed.href, {
      redirect: 'error',
      signal: AbortSignal.timeout(60_000),
    })
  } catch (error) {
    throw new Error(`Image fetch failed (${parsed.href}): ${(error as Error).message}`, {
      cause: error,
    })
  }
  if (!response.ok) throw new Error(`${parsed.href} answered ${response.status}`)
  const mimeType = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
  if (!mimeType.startsWith('image/'))
    throw new Error(`${parsed.href} is not an image (${mimeType || 'no content-type'})`)
  const body = await readCapped(response, maxBytes, `image ${parsed.href}`)
  return { url: parsed.href, mimeType, bytes: body.length, data: body.toString('base64') }
}
