import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { gzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { IntegrityError, verifyIntegrity } from '../src/integrity.js'
import { readTarGz, sanitizeEntryPath, TarError, writeEntries } from '../src/tar.js'
import { makeTarGz } from './helpers/tar.js'

const limits = { maxExtractedBytes: 10 * 1024 * 1024, maxEntries: 100 }

describe('verifyIntegrity', () => {
  const data = Buffer.from('tarball bytes')
  const sha512 = `sha512-${createHash('sha512').update(data).digest('base64')}`
  const sha1 = createHash('sha1').update(data).digest('hex')

  it('accepts a matching sha512 SRI hash', () => {
    expect(verifyIntegrity(data, sha512, null).algorithm).toBe('sha512')
  })

  it('refuses a mismatching hash', () => {
    const wrong = `sha512-${createHash('sha512').update('other').digest('base64')}`
    expect(() => verifyIntegrity(data, wrong, sha1)).toThrow(IntegrityError)
  })

  it('uses the strongest hash of a multi-hash SRI string', () => {
    const wrong256 = `sha256-${createHash('sha256').update('other').digest('base64')}`
    expect(verifyIntegrity(data, `${wrong256} ${sha512}`, null).algorithm).toBe('sha512')
  })

  it('falls back to the sha1 shasum only when no SRI hash is usable', () => {
    expect(verifyIntegrity(data, 'md5-abc', sha1).algorithm).toBe('sha1')
    expect(() => verifyIntegrity(data, null, '0'.repeat(40))).toThrow(IntegrityError)
  })

  it('refuses a tarball with no hash at all', () => {
    expect(() => verifyIntegrity(data, null, null)).toThrow(/no usable integrity/)
  })
})

describe('sanitizeEntryPath', () => {
  it('strips the package/ prefix', () => {
    expect(sanitizeEntryPath('package/translations/items.en.json')).toBe(
      'translations/items.en.json'
    )
  })

  it.each([
    '../evil',
    'package/../../evil',
    '/etc/passwd',
    'C:/evil',
    'package\\..\\evil',
    'a/\0b',
    'package/',
  ])('refuses %j', raw => {
    expect(sanitizeEntryPath(raw)).toBeNull()
  })
})

describe('readTarGz', () => {
  it('reads files, including pax and GNU long names', () => {
    const long = `package/translations/${'x'.repeat(120)}.en.json`
    const files = readTarGz(
      makeTarGz([
        { path: 'package/', type: '5' },
        { path: 'package/items.json', data: '[]' },
        { path: long, data: '{}', pax: true },
        { path: 'package/README.md', data: 'hi', gnuLongName: true },
      ]),
      limits
    )
    expect(files.map(f => f.path)).toEqual([
      'items.json',
      long.slice('package/'.length),
      'README.md',
    ])
    expect(files[0].data.toString()).toBe('[]')
  })

  it('refuses path traversal, absolute paths and links', () => {
    expect(() => readTarGz(makeTarGz([{ path: '../evil.json', data: 'x' }]), limits)).toThrow(
      TarError
    )
    expect(() =>
      readTarGz(makeTarGz([{ path: 'package/../../evil', data: 'x', pax: true }]), limits)
    ).toThrow(/unsafe path/)
    expect(() => readTarGz(makeTarGz([{ path: '/abs.json', data: 'x' }]), limits)).toThrow(
      /unsafe path/
    )
    expect(() =>
      readTarGz(makeTarGz([{ path: 'package/link', type: '2', linkname: '/etc/passwd' }]), limits)
    ).toThrow(/only regular files/)
    expect(() =>
      readTarGz(makeTarGz([{ path: 'package/hard', type: '1', linkname: 'package/a' }]), limits)
    ).toThrow(/only regular files/)
  })

  it('refuses duplicate entries, which could overwrite a checked file', () => {
    expect(() =>
      readTarGz(
        makeTarGz([
          { path: 'package/a.json', data: '1' },
          { path: 'package/a.json', data: '2' },
        ]),
        limits
      )
    ).toThrow(/Duplicate/)
  })

  it('enforces the size and entry limits, gzip bombs included', () => {
    const big = makeTarGz([{ path: 'package/big.json', data: Buffer.alloc(200_000) }])
    expect(() => readTarGz(big, { maxExtractedBytes: 100_000, maxEntries: 10 })).toThrow(TarError)
    const many = makeTarGz(
      Array.from({ length: 5 }, (_, i) => ({ path: `package/${i}.json`, data: '1' }))
    )
    expect(() => readTarGz(many, { maxExtractedBytes: 1_000_000, maxEntries: 3 })).toThrow(
      /entries/
    )
  })

  it('refuses a corrupt header', () => {
    const tar = Buffer.alloc(1024)
    tar.write('package/x.json', 0)
    expect(() => readTarGz(gzipSync(tar), limits)).toThrow(/Corrupt/)
  })

  it('refuses data that is not gzip', () => {
    expect(() => readTarGz(Buffer.from('not gzip'), limits)).toThrow(/decompress/)
  })
})

describe('writeEntries', () => {
  it('writes inside the destination only', async () => {
    const dest = mkdtempSync(path.join(tmpdir(), 'dpmcp-x-'))
    await writeEntries([{ path: 'translations/a.en.json', data: Buffer.from('{}') }], dest)
    expect(readFileSync(path.join(dest, 'translations', 'a.en.json'), 'utf8')).toBe('{}')
    await expect(
      writeEntries([{ path: '../escape.json', data: Buffer.from('x') }], dest)
    ).rejects.toThrow(/outside/)
    expect(existsSync(path.join(dest, '..', 'escape.json'))).toBe(false)
  })
})
