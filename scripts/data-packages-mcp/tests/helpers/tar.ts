import { gzipSync } from 'node:zlib'

export interface TarSpec {
  path: string
  data?: string | Buffer
  /** Tar typeflag: '0' file (default), '5' directory, '2' symlink, '1' hard link… */
  type?: string
  linkname?: string
  /** Put the path in a pax extended header instead of the ustar name field. */
  pax?: boolean
  /** Put the path in a GNU long-name entry. */
  gnuLongName?: boolean
}

const BLOCK = 512

function header(name: string, size: number, type: string, linkname = ''): Buffer {
  const h = Buffer.alloc(BLOCK)
  h.write(name.slice(0, 100), 0, 'utf8')
  h.write('0000644\0', 100)
  h.write('0000000\0', 108)
  h.write('0000000\0', 116)
  h.write(size.toString(8).padStart(11, '0') + '\0', 124)
  h.write('00000000000\0', 136)
  h.write(type, 156)
  h.write(linkname.slice(0, 100), 157)
  h.write('ustar\0', 257)
  h.write('00', 263)
  h.fill(0x20, 148, 156)
  let sum = 0
  for (const byte of h) sum += byte
  h.write(sum.toString(8).padStart(6, '0') + '\0 ', 148)
  return h
}

const pad = (data: Buffer) =>
  Buffer.concat([data, Buffer.alloc((BLOCK - (data.length % BLOCK)) % BLOCK)])

/** Builds a gzipped tarball, honest or hostile, for the extraction tests and the fake registry. */
export function makeTarGz(entries: TarSpec[]): Buffer {
  const blocks: Buffer[] = []
  for (const entry of entries) {
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data ?? '', 'utf8')
    const type = entry.type ?? '0'
    let name = entry.path
    if (entry.pax) {
      const record = (body: string) => {
        let length = body.length + 3
        while (`${length} ${body}\n`.length !== length) length = `${length} ${body}\n`.length
        return `${length} ${body}\n`
      }
      const paxData = Buffer.from(record(`path=${entry.path}`), 'utf8')
      blocks.push(header('PaxHeader', paxData.length, 'x'), pad(paxData))
      name = 'placeholder'
    }
    if (entry.gnuLongName) {
      const longData = Buffer.from(entry.path + '\0', 'utf8')
      blocks.push(header('././@LongLink', longData.length, 'L'), pad(longData))
      name = 'placeholder'
    }
    blocks.push(header(name, type === '0' ? data.length : 0, type, entry.linkname))
    if (type === '0') blocks.push(pad(data))
  }
  blocks.push(Buffer.alloc(BLOCK * 2))
  return gzipSync(Buffer.concat(blocks))
}

/** A package's files as npm packs them: everything under `package/`. */
export function packTarball(files: Record<string, unknown>): Buffer {
  return makeTarGz(
    Object.entries(files).map(([path, content]) => ({
      path: `package/${path}`,
      data: typeof content === 'string' ? content : JSON.stringify(content),
    }))
  )
}
