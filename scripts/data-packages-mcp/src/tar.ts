import { gunzipSync } from 'node:zlib'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

export class TarError extends Error {}

export interface TarLimits {
  /** Largest uncompressed archive accepted, all entries together. */
  maxExtractedBytes: number
  /** Most entries accepted. */
  maxEntries: number
}

export interface TarFile {
  /** Relative POSIX path, with npm's leading `package/` removed. */
  path: string
  data: Buffer
}

const BLOCK = 512

const field = (header: Buffer, offset: number, length: number): string => {
  const raw = header.subarray(offset, offset + length)
  const end = raw.indexOf(0)
  return raw.subarray(0, end === -1 ? length : end).toString('utf8')
}

const octal = (header: Buffer, offset: number, length: number): number => {
  const raw = header.subarray(offset, offset + length)
  // GNU base-256: the high bit of the first byte marks a binary number.
  if (raw[0] & 0x80) {
    let value = raw[0] & 0x7f
    for (let i = 1; i < raw.length; i++) value = value * 256 + raw[i]
    return value
  }
  const text = field(header, offset, length).trim()
  if (text === '') return 0
  if (!/^[0-7]+$/.test(text)) throw new TarError(`Corrupt tar header: "${text}" is not octal`)
  return Number.parseInt(text, 8)
}

const checksumOk = (header: Buffer): boolean => {
  const stored = octal(header, 148, 8)
  let sum = 0
  for (let i = 0; i < BLOCK; i++) sum += i >= 148 && i < 156 ? 0x20 : header[i]
  return sum === stored
}

/** pax extended header records: `<length> <key>=<value>\n`. */
const parsePax = (data: Buffer): Record<string, string> => {
  const out: Record<string, string> = {}
  let pos = 0
  while (pos < data.length) {
    const space = data.indexOf(0x20, pos)
    if (space === -1) break
    const length = Number.parseInt(data.subarray(pos, space).toString('utf8'), 10)
    if (!Number.isFinite(length) || length <= 0) break
    const record = data.subarray(space + 1, pos + length - 1).toString('utf8')
    const eq = record.indexOf('=')
    if (eq > 0) out[record.slice(0, eq)] = record.slice(eq + 1)
    pos += length
  }
  return out
}

/**
 * The path a tar entry may be written to, or null when it must be refused:
 * absolute paths, drive letters, backslashes, NUL bytes and any `..`
 * segment never leave the archive. npm packs everything under `package/`;
 * that prefix is removed.
 */
export function sanitizeEntryPath(raw: string): string | null {
  if (raw.includes('\0') || raw.includes('\\')) return null
  if (raw.startsWith('/') || /^[A-Za-z]:/.test(raw)) return null
  const segments = raw.split('/').filter(s => s !== '' && s !== '.')
  if (segments.some(s => s === '..')) return null
  if (segments[0] === 'package') segments.shift()
  if (segments.length === 0) return null
  return segments.join('/')
}

/**
 * Parses a gzipped tarball in memory. Only regular files are returned;
 * directories are implied by file paths. Links, devices and FIFOs make the
 * whole archive invalid: a data package never contains one.
 */
export function readTarGz(gz: Buffer, limits: TarLimits): TarFile[] {
  let tar: Buffer
  try {
    // maxOutputLength stops a gzip bomb before it is inflated, not after.
    tar = gunzipSync(gz, { maxOutputLength: limits.maxExtractedBytes + 64 * BLOCK })
  } catch (error) {
    throw new TarError(`Cannot decompress the tarball: ${(error as Error).message}`, {
      cause: error,
    })
  }
  const files: TarFile[] = []
  const seen = new Set<string>()
  let pos = 0
  let entries = 0
  let total = 0
  let longName: string | null = null
  let pax: Record<string, string> = {}

  while (pos + BLOCK <= tar.length) {
    const header = tar.subarray(pos, pos + BLOCK)
    if (header.every(b => b === 0)) break
    if (!checksumOk(header)) throw new TarError(`Corrupt tar header at offset ${pos}`)
    const size = octal(header, 124, 12)
    const type = String.fromCharCode(header[156] || 0x30)
    const dataStart = pos + BLOCK
    const dataEnd = dataStart + size
    if (dataEnd > tar.length) throw new TarError('Truncated tarball')
    const data = tar.subarray(dataStart, dataEnd)
    pos = dataStart + Math.ceil(size / BLOCK) * BLOCK

    if (++entries > limits.maxEntries) {
      throw new TarError(`More than ${limits.maxEntries} entries in the tarball`)
    }

    if (type === 'x') {
      pax = parsePax(data)
      continue
    }
    if (type === 'g') continue
    if (type === 'L') {
      longName = data.toString('utf8').replace(/\0+$/, '')
      continue
    }

    const prefix = field(header, 345, 155)
    const name = field(header, 0, 100)
    const rawPath = pax.path ?? longName ?? (prefix ? `${prefix}/${name}` : name)
    longName = null
    pax = {}

    if (type === '5') continue
    if (type !== '0' && type !== '7') {
      throw new TarError(`Refusing tar entry "${rawPath}" of type "${type}" (only regular files)`)
    }
    const safe = sanitizeEntryPath(rawPath)
    if (safe === null) throw new TarError(`Refusing unsafe path in tarball: "${rawPath}"`)
    if (seen.has(safe)) throw new TarError(`Duplicate entry in tarball: "${safe}"`)
    seen.add(safe)
    total += size
    if (total > limits.maxExtractedBytes) {
      throw new TarError(`The tarball unpacks to more than ${limits.maxExtractedBytes} bytes`)
    }
    files.push({ path: safe, data: Buffer.from(data) })
  }
  return files
}

/** Writes parsed entries under `destDir`, re-checking that each one stays inside it. */
export async function writeEntries(files: TarFile[], destDir: string): Promise<void> {
  const root = path.resolve(destDir)
  await mkdir(root, { recursive: true })
  for (const file of files) {
    const target = path.resolve(root, ...file.path.split('/'))
    if (target !== root && !target.startsWith(root + path.sep)) {
      throw new TarError(`Refusing to write outside the cache: "${file.path}"`)
    }
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, file.data, { flag: 'wx' })
  }
}
