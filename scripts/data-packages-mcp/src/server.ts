import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import {
  getCollection,
  getGlossary,
  getItem,
  getPartner,
  getRecord,
  getTimeline,
  listCollections,
  listGlossary,
  listItems,
  listPartners,
  listTimelines,
} from './browse.js'
import type { Config } from './config.js'
import { diffVersions } from './diff.js'
import { detectFamily } from './family.js'
import { listFiles, readFile } from './files.js'
import { fetchImage } from './images.js'
import { PackageView } from './package-view.js'
import { runQuery } from './query.js'
import type { FetchLike, RegistryClient } from './registry.js'
import { entityStats, packageStats } from './stats.js'
import type { PackageStore } from './store.js'

export interface Deps {
  config: Pick<Config, 'maxImageBytes' | 'maxOutputChars'>
  registry: RegistryClient
  store: PackageStore
  /** Used by view_image only; the registry client has its own. */
  fetchImpl?: FetchLike
}

export const SERVER_NAME = 'mwnf-data-packages'
export const SERVER_VERSION = '1.0.0'

const INSTRUCTIONS = `Read-only access to the PUBLISHED @museumwnf/*-data npm data packages (what the
public websites install), for assessing import quality. Nothing here reads the inventory database
or writes anywhere.

Start with list_packages, then select(package, version) — every other tool works on the selection
unless it is given package (+ version) explicitly. Package names may be short: "islamicart" means
@museumwnf/islamicart-data. version accepts an exact version or a dist-tag (default "latest").

Records carry the inventory "id" (UUID) and the legacy "backward_compatibility" key; every lookup
accepts either. diff_versions is the main assessment tool: summary first, then file=, then id=.
query runs JMESPath over any JSON file of any package family.`

const target = {
  package: z
    .string()
    .optional()
    .describe(
      'Package, e.g. "islamicart" or "@museumwnf/islamicart-data". Defaults to the selection.'
    ),
  version: z
    .string()
    .optional()
    .describe('Exact version or dist-tag. Defaults to the selected version, else "latest".'),
}

const paging = {
  page: z.number().int().min(1).optional().describe('1-based page (default 1)'),
  page_size: z.number().int().min(1).max(500).optional().describe('Results per page'),
}

const languages = {
  languages: z
    .array(z.string())
    .optional()
    .describe('Only these translation languages (2-letter codes, e.g. ["en","fr"]). Default: all.'),
  language: z.string().optional().describe('Language used for display names (default "en")'),
}

const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
}

export function createServer(deps: Deps): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { instructions: INSTRUCTIONS, capabilities: { tools: {}, resources: {} } }
  )
  let selected: { name: string; version: string } | null = null

  const render = (value: unknown): CallToolResult => {
    const compact = JSON.stringify(value) ?? 'null'
    let text = compact.length < 4000 ? JSON.stringify(value, null, 2) : compact
    const max = deps.config.maxOutputChars
    if (text.length > max) {
      text =
        text.slice(0, max) +
        `\n…[cut: ${text.length - max} more characters. Narrow the request: page/page_size, a filter, languages, or a JMESPath query.]`
    }
    return { content: [{ type: 'text', text }] }
  }

  const fail = (error: unknown): CallToolResult => ({
    isError: true,
    content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }],
  })

  // One call at a time. Parsing and diffing tens of megabytes of JSON is
  // synchronous, so running calls side by side gains nothing; it only stalls
  // the event loop under another call's network timeouts, which then fire.
  let queue: Promise<unknown> = Promise.resolve()
  const serial = <T>(task: () => Promise<T>): Promise<T> => {
    const result = queue.then(task, task)
    queue = result.catch(() => undefined)
    return result
  }

  const run =
    <A>(handler: (args: A) => Promise<unknown> | unknown) =>
    async (args: A): Promise<CallToolResult> => {
      try {
        const value = await serial(async () => handler(args))
        return isToolResult(value) ? value : render(value)
      } catch (error) {
        return fail(error)
      }
    }

  /** The package version a call is about: explicit arguments first, then the selection. */
  const open = async (args: { package?: string; version?: string }): Promise<PackageView> => {
    let name: string
    let version: string
    if (args.package) {
      name = deps.registry.normaliseName(args.package)
      version = args.version ?? (selected?.name === name ? selected.version : 'latest')
    } else if (selected) {
      name = selected.name
      version = args.version ?? selected.version
    } else {
      throw new Error('No package selected: call select(package, version) first, or pass package.')
    }
    const cached = await deps.store.ensure(name, version)
    return new PackageView(cached.name, cached.version, cached.dir)
  }

  server.registerTool(
    'list_packages',
    {
      title: 'List data packages',
      description:
        'Every published @museumwnf/*-data package (discovered from the registry, never a fixed list), with its latest version and publish date.',
      annotations: READ_ONLY,
    },
    run(async () => {
      const packages = await deps.registry.listDataPackages()
      return { count: packages.length, selected, packages }
    })
  )

  server.registerTool(
    'list_versions',
    {
      title: 'List versions of a package',
      description:
        'Published versions of one package, newest first, with dist-tags, publish dates and sizes.',
      inputSchema: { package: target.package },
      annotations: READ_ONLY,
    },
    run(async (args: { package?: string }) => {
      const name = args.package ? deps.registry.normaliseName(args.package) : selected?.name
      if (!name) throw new Error('Pass package, or select one first.')
      const packument = await deps.registry.packument(name)
      return {
        package: name,
        dist_tags: packument.distTags,
        modified: packument.modified,
        versions: [...packument.versions].reverse().map(v => ({
          version: v.version,
          published: v.published,
          tags: v.tags,
          files: v.fileCount,
          unpacked_bytes: v.unpackedSize,
        })),
      }
    })
  )

  server.registerTool(
    'select',
    {
      title: 'Select a package version',
      description:
        'Downloads (once, then cached), verifies and opens a package version, and makes it the default for every other tool. A dist-tag is pinned to the version it names now.',
      inputSchema: {
        package: z.string().describe('Package, e.g. "islamicart" or "@museumwnf/carpets-data"'),
        version: z.string().optional().describe('Exact version or dist-tag (default "latest")'),
      },
      annotations: { ...READ_ONLY, idempotentHint: false },
    },
    run(async (args: { package: string; version?: string }) => {
      const name = deps.registry.normaliseName(args.package)
      const cached = await deps.store.ensure(name, args.version ?? 'latest')
      selected = { name: cached.name, version: cached.version }
      const view = new PackageView(cached.name, cached.version, cached.dir)
      const manifest = view.manifest()
      return {
        selected,
        family: detectFamily(view),
        files: view.listFiles().length,
        generatedAt: manifest?.generatedAt ?? null,
        languages: manifest?.languages ?? null,
        entities: view.topLevelJson(),
      }
    })
  )

  server.registerTool(
    'get_manifest',
    {
      title: 'Manifest',
      description: "The package's manifest.json and package.json, and its detected family.",
      inputSchema: target,
      annotations: READ_ONLY,
    },
    run(async (args: { package?: string; version?: string }) => {
      const view = await open(args)
      return {
        package: view.label,
        family: detectFamily(view),
        manifest: view.manifest(),
        package_json: view.object('package.json'),
      }
    })
  )

  server.registerTool(
    'list_files',
    {
      title: 'List files',
      description:
        'Every file of the package with its size, and the record count of each top-level JSON array.',
      inputSchema: {
        ...target,
        prefix: z
          .string()
          .optional()
          .describe('Only paths starting with this, e.g. "translations/items."'),
      },
      annotations: READ_ONLY,
    },
    run(async (args: { package?: string; version?: string; prefix?: string }) =>
      listFiles(await open(args), args.prefix)
    )
  )

  server.registerTool(
    'read_file',
    {
      title: 'Read a file',
      description:
        'One file, paged: a JSON array by records (default 25), a large JSON object such as a translation map by entries (default 50), text by characters.',
      inputSchema: {
        ...target,
        path: z.string().describe('Path inside the package, e.g. "items.json"'),
        ...paging,
      },
      annotations: READ_ONLY,
    },
    run(
      async (args: {
        package?: string
        version?: string
        path: string
        page?: number
        page_size?: number
      }) => readFile(await open(args), args.path, args)
    )
  )

  server.registerTool(
    'query',
    {
      title: 'JMESPath query',
      description:
        'Runs a JMESPath expression over one JSON file. Works on every package family. Examples: ' +
        '"length(@)", "[?type==\'monument\'].{id: id, bc: backward_compatibility}", ' +
        '"[?length(images)==`0`].id", "values(@)[?description==null] | length(@)" on a translation file. ' +
        'Array results are paged (default 100).',
      inputSchema: {
        ...target,
        file: z.string().describe('JSON file, e.g. "items.json" or "translations/items.en.json"'),
        expression: z.string().describe('JMESPath expression'),
        ...paging,
      },
      annotations: READ_ONLY,
    },
    run(
      async (args: {
        package?: string
        version?: string
        file: string
        expression: string
        page?: number
        page_size?: number
      }) => runQuery(await open(args), args.file, args.expression, args)
    )
  )

  server.registerTool(
    'list_items',
    {
      title: 'List items',
      description:
        'Items (objects, monuments, details…) with filters. collection takes an id or backward_compatibility key: a collections.json node (project, explore), a theme (exhibition) or the gallery.',
      inputSchema: {
        ...target,
        type: z.string().optional().describe('Item type: object, monument, detail…'),
        collection: z.string().optional().describe('Collection/theme id or backward_compatibility'),
        include_sub_collections: z
          .boolean()
          .optional()
          .describe('Include sub-collections (default true)'),
        partner: z.string().optional().describe('Partner id or backward_compatibility'),
        country: z
          .string()
          .optional()
          .describe('Country id as shipped (ISO 3166-1 alpha-3, e.g. "egy")'),
        has_images: z.boolean().optional(),
        text: z
          .string()
          .optional()
          .describe(
            'Substring of id, backward_compatibility, internal_name, references or translated name'
          ),
        language: z
          .string()
          .optional()
          .describe('Only items translated in this language; also the display language'),
        tag: z.string().optional().describe('Tag label (tags[] or tags.json via tag_ids)'),
        ...paging,
      },
      annotations: READ_ONLY,
    },
    run(async (args: { package?: string; version?: string } & Parameters<typeof listItems>[1]) =>
      listItems(await open(args), args)
    )
  )

  server.registerTool(
    'get_item',
    {
      title: 'Get an item',
      description:
        'One item by inventory id or backward_compatibility: the base record merged with its translations (translations/items.<lang>.json), with partner, project, collections, tags, dynasties, glossary and related items resolved, and a check of declared vs translated languages.',
      inputSchema: {
        ...target,
        ref: z.string().describe('Item id or backward_compatibility'),
        ...languages,
      },
      annotations: READ_ONLY,
    },
    run(
      async (args: {
        package?: string
        version?: string
        ref: string
        languages?: string[]
        language?: string
      }) => getItem(await open(args), args.ref, args)
    )
  )

  server.registerTool(
    'list_collections',
    {
      title: 'List collections',
      description:
        'The collection tree in tree order (depth, children and item counts): collections.json for project and explore packages, exhibition → themes → sub-themes for exhibitions, the gallery for galleries, the galleries for the hub.',
      inputSchema: {
        ...target,
        parent: z
          .string()
          .optional()
          .describe('Only descendants of this collection (id or backward_compatibility)'),
        type: z.string().optional().describe('Collection type, e.g. exhibition, theme, location'),
        text: z
          .string()
          .optional()
          .describe('Substring of id, backward_compatibility, title or purpose'),
        max_depth: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe('Levels below the parent (or the roots) to include'),
        language: languages.language,
        ...paging,
      },
      annotations: READ_ONLY,
    },
    run(
      async (
        args: { package?: string; version?: string } & Parameters<typeof listCollections>[1]
      ) => listCollections(await open(args), args)
    )
  )

  server.registerTool(
    'get_collection',
    {
      title: 'Get a collection',
      description:
        'One collection (or theme, gallery) by id or backward_compatibility: record, translations, ancestors, children and its member items (paged).',
      inputSchema: {
        ...target,
        ref: z.string().describe('Collection id or backward_compatibility'),
        ...languages,
        ...paging,
      },
      annotations: READ_ONLY,
    },
    run(
      async (args: {
        package?: string
        version?: string
        ref: string
        languages?: string[]
        language?: string
        page?: number
        page_size?: number
      }) => getCollection(await open(args), args.ref, args)
    )
  )

  server.registerTool(
    'list_partners',
    {
      title: 'List partners',
      description:
        'Partners (museums, institutions) with their declared item_count beside the items the package actually ships for them.',
      inputSchema: {
        ...target,
        text: z.string().optional(),
        type: z.string().optional().describe('museum, institution…'),
        country: z.string().optional(),
        language: languages.language,
        ...paging,
      },
      annotations: READ_ONLY,
    },
    run(async (args: { package?: string; version?: string } & Parameters<typeof listPartners>[1]) =>
      listPartners(await open(args), args)
    )
  )

  server.registerTool(
    'get_partner',
    {
      title: 'Get a partner',
      description:
        'One partner by id or backward_compatibility, with translations, parent/children and its items in the package.',
      inputSchema: { ...target, ref: z.string(), ...languages },
      annotations: READ_ONLY,
    },
    run(
      async (args: {
        package?: string
        version?: string
        ref: string
        languages?: string[]
        language?: string
      }) => getPartner(await open(args), args.ref, args)
    )
  )

  server.registerTool(
    'list_glossary',
    {
      title: 'List glossary entries',
      description:
        'Glossary words with their spellings in one language and whether a definition exists.',
      inputSchema: {
        ...target,
        text: z.string().optional(),
        language: languages.language,
        ...paging,
      },
      annotations: READ_ONLY,
    },
    run(
      async (args: {
        package?: string
        version?: string
        text?: string
        language?: string
        page?: number
        page_size?: number
      }) => listGlossary(await open(args), args)
    )
  )

  server.registerTool(
    'get_glossary',
    {
      title: 'Get a glossary entry',
      description:
        'One glossary entry by id or word, with every translation and the items that reference it.',
      inputSchema: { ...target, ref: z.string(), ...languages },
      annotations: READ_ONLY,
    },
    run(
      async (args: {
        package?: string
        version?: string
        ref: string
        languages?: string[]
        language?: string
      }) => getGlossary(await open(args), args.ref, args)
    )
  )

  server.registerTool(
    'list_timelines',
    {
      title: 'List timelines',
      description:
        'Timelines with their event counts, and events whose timeline is not in the package.',
      inputSchema: target,
      annotations: READ_ONLY,
    },
    run(async (args: { package?: string; version?: string }) => listTimelines(await open(args)))
  )

  server.registerTool(
    'get_timeline',
    {
      title: 'Get a timeline',
      description: 'One timeline with its events (paged) and their texts in one language.',
      inputSchema: { ...target, ref: z.string(), language: languages.language, ...paging },
      annotations: READ_ONLY,
    },
    run(
      async (args: {
        package?: string
        version?: string
        ref: string
        language?: string
        page?: number
        page_size?: number
      }) => getTimeline(await open(args), args.ref, args)
    )
  )

  server.registerTool(
    'get_record',
    {
      title: 'Get any record',
      description:
        'A record of any entity file (dynasties, tags, themes, galleries, related_content, countries, languages…) by id, backward_compatibility, legacy_id, slug, word or label, merged with its translations.',
      inputSchema: {
        ...target,
        file: z.string().describe('Entity file, e.g. "dynasties.json" or "tags"'),
        ref: z.string(),
        languages: languages.languages,
      },
      annotations: READ_ONLY,
    },
    run(
      async (args: {
        package?: string
        version?: string
        file: string
        ref: string
        languages?: string[]
      }) => getRecord(await open(args), args.file, args.ref, args)
    )
  )

  server.registerTool(
    'stats',
    {
      title: 'Package statistics',
      description:
        'Import-quality figures: records per type, translation coverage per language, fields left empty, items without images or translations, partner item_count checks. With file, one entity in depth including per-language field fill rates.',
      inputSchema: {
        ...target,
        file: z.string().optional().describe('Entity, e.g. "items" or "partners.json"'),
      },
      annotations: READ_ONLY,
    },
    run(async (args: { package?: string; version?: string; file?: string }) =>
      args.file ? entityStats(await open(args), args.file) : packageStats(await open(args))
    )
  )

  server.registerTool(
    'diff_versions',
    {
      title: 'Diff two versions',
      description:
        'What changed between two published versions of one package. Without file/id: a summary per changed file (records added/removed/changed and which fields moved). With file: the records behind it (paged). With id (inventory id, translation key or backward_compatibility): that record field by field in every file that holds it. Defaults: to = selected version (else latest), from = the version published before it.',
      inputSchema: {
        package: target.package,
        from: z.string().optional().describe('Older version (default: the one before "to")'),
        to: z
          .string()
          .optional()
          .describe('Newer version or dist-tag (default: selected, else latest)'),
        file: z
          .string()
          .optional()
          .describe('Drill into one file, e.g. "items.json" or "translations/items.fr.json"'),
        id: z.string().optional().describe('Drill into one record'),
        include_unchanged: z
          .boolean()
          .optional()
          .describe('Also list the unchanged files in the summary'),
        ...paging,
      },
      annotations: READ_ONLY,
    },
    run(
      async (args: {
        package?: string
        from?: string
        to?: string
        file?: string
        id?: string
        include_unchanged?: boolean
        page?: number
        page_size?: number
      }) => {
        const name = args.package ? deps.registry.normaliseName(args.package) : selected?.name
        if (!name) throw new Error('Pass package, or select one first.')
        const toRequested = args.to ?? (selected?.name === name ? selected.version : 'latest')
        const to = await deps.store.ensure(name, toRequested)
        let fromVersion = args.from
        if (!fromVersion) {
          const versions = (await deps.registry.packument(name)).versions.map(v => v.version)
          const index = versions.indexOf(to.version)
          if (index <= 0)
            throw new Error(
              `${name}@${to.version} has no earlier published version to compare with`
            )
          fromVersion = versions[index - 1]
        }
        const from = await deps.store.ensure(name, fromVersion)
        return diffVersions(
          new PackageView(from.name, from.version, from.dir),
          new PackageView(to.name, to.version, to.dir),
          args
        )
      }
    )
  )

  server.registerTool(
    'view_image',
    {
      title: 'View an image',
      description:
        'Fetches an image a record references and returns it as an image. Only /pub/<filename> URLs on the image host(s) the package itself uses; size-capped.',
      inputSchema: {
        ...target,
        url: z.string().describe('An image URL from the package, e.g. images[].url'),
      },
      annotations: READ_ONLY,
    },
    run(async (args: { package?: string; version?: string; url: string }) => {
      const view = await open(args)
      const image = await fetchImage(view, args.url, deps.config.maxImageBytes, deps.fetchImpl)
      const result: CallToolResult = {
        content: [
          { type: 'image', data: image.data, mimeType: image.mimeType },
          {
            type: 'text',
            text: JSON.stringify({ url: image.url, mimeType: image.mimeType, bytes: image.bytes }),
          },
        ],
      }
      return result
    })
  )

  server.registerResource(
    'data-package-file',
    new ResourceTemplate('datapackage://{name}@{version}/{+path}', {
      list: async () => {
        if (!selected) return { resources: [] }
        const view = await open({})
        const bare = view.name.split('/')[1]
        return {
          resources: view.listFiles().map(f => ({
            uri: `datapackage://${bare}@${view.version}/${f}`,
            name: f,
            mimeType: f.endsWith('.json') ? 'application/json' : 'text/plain',
          })),
        }
      },
    }),
    {
      title: 'Data package file',
      description:
        'A file of a published data package version: datapackage://<name>@<version>/<path>',
    },
    async (uri, variables) =>
      serial(async () => {
        const pick = (v: string | string[] | undefined) =>
          Array.isArray(v) ? v.join('/') : (v ?? '')
        const view = await open({ package: pick(variables.name), version: pick(variables.version) })
        const file = decodeURIComponent(pick(variables.path))
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: file.endsWith('.json') ? 'application/json' : 'text/plain',
              text: view.text(file),
            },
          ],
        }
      })
  )

  return server
}

function isToolResult(value: unknown): value is CallToolResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as { content?: unknown }).content)
  )
}
